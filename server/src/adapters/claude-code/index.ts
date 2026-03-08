/**
 * Claude Code adapter — spawns the `claude` CLI in non-interactive mode
 * with Symphony-style git management (branch, commit, PR).
 */
import { spawnProcess } from "../process/execute.js";
import type {
  ServerAdapterModule,
  AdapterExecuteContext,
  AdapterExecuteResult,
  AdapterEnvironmentTestResult,
  AdapterModel,
} from "../types.js";

/** Models available through Claude Code CLI. */
const CLAUDE_MODELS: AdapterModel[] = [
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", contextWindow: 200_000 },
  { id: "claude-opus-4-20250514", label: "Claude Opus 4", contextWindow: 200_000 },
  { id: "claude-haiku-3-5-20241022", label: "Claude 3.5 Haiku", contextWindow: 200_000 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shellEnv(): Record<string, string> {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([, v]) => v !== undefined),
  ) as Record<string, string>;
  // Remove CLAUDECODE so spawned claude CLI doesn't think it's nested
  delete env.CLAUDECODE;
  return env;
}

/** Run a shell command in the given cwd and return stdout (trimmed). */
async function run(
  command: string,
  cwd: string,
  timeoutMs = 30_000,
): Promise<string> {
  const result = await spawnProcess({
    command,
    shell: "/bin/sh",
    env: shellEnv(),
    cwd,
    timeoutMs,
  });
  if (result.exitCode !== 0 && result.exitCode !== null) {
    throw new Error(
      `Command failed (exit ${result.exitCode}): ${command}\nStderr: ${result.stderr}`,
    );
  }
  return result.stdout.trim();
}

/** Sanitise a string into a valid git branch name segment. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const claudeCodeAdapter: ServerAdapterModule = {
  type: "claude_code",
  label: "Claude Code",
  description:
    "Runs the Claude Code CLI with Symphony-style git management — automatic branching, commits, and pull requests.",

  models: CLAUDE_MODELS,

  // -----------------------------------------------------------------------
  // execute
  // -----------------------------------------------------------------------
  async execute(ctx: AdapterExecuteContext): Promise<AdapterExecuteResult> {
    const {
      workingDir,
      model,
      allowedTools,
      gitAutoCommit,
      gitAutoPR,
      targetBranch,
    } = ctx.adapterConfig as {
      workingDir?: string;
      model?: string;
      allowedTools?: string[];
      gitAutoCommit?: boolean;
      gitAutoPR?: boolean;
      targetBranch?: string;
    };

    if (!workingDir) {
      throw new Error("claude_code adapter: adapterConfig.workingDir is required");
    }

    const cwd = workingDir as string;
    const selectedModel = model ?? ctx.model ?? "claude-sonnet-4-20250514";
    const base = targetBranch ?? "main";

    // Build the task prompt — combine system prompt + context if provided.
    const parts: string[] = [];
    if (ctx.systemPrompt) parts.push(ctx.systemPrompt);
    parts.push(JSON.stringify(ctx.context));
    const taskPrompt = parts.join("\n\n");

    // 1. Create a feature branch -----------------------------------------
    const branchName = `seaclip/${slugify(ctx.runId)}`;
    await run(`git fetch origin ${base} 2>/dev/null || true`, cwd);
    await run(`git checkout -B ${branchName} origin/${base} 2>/dev/null || git checkout -B ${branchName} ${base} 2>/dev/null || git checkout -B ${branchName}`, cwd);

    // 2. Run claude CLI ---------------------------------------------------
    const toolFlags = (allowedTools ?? [])
      .map((t: string) => `--allowedTools '${t}'`)
      .join(" ");

    // Escape single quotes in the prompt for shell safety.
    const escapedPrompt = taskPrompt.replace(/'/g, "'\\''");

    const claudeCommand = [
      "claude",
      "--print",
      `--model ${selectedModel}`,
      toolFlags,
      `'${escapedPrompt}'`,
    ]
      .filter(Boolean)
      .join(" ");

    const startMs = Date.now();
    const claudeResult = await spawnProcess({
      command: claudeCommand,
      shell: "/bin/sh",
      env: {
        ...shellEnv(),
        SEACLIP_AGENT_ID: ctx.agentId,
        SEACLIP_COMPANY_ID: ctx.companyId,
        SEACLIP_RUN_ID: ctx.runId,
        SEACLIP_TRIGGERED_BY: ctx.triggeredBy,
      },
      cwd,
      timeoutMs: ctx.timeoutMs,
    });
    const durationMs = Date.now() - startMs;

    const claudeOutput = claudeResult.stdout || claudeResult.stderr;

    if (claudeResult.exitCode !== 0 && claudeResult.exitCode !== null) {
      throw new Error(
        `claude CLI exited with code ${claudeResult.exitCode}.\nOutput: ${claudeOutput}`,
      );
    }

    // 3. Auto-commit if enabled -------------------------------------------
    let commitSha: string | undefined;
    if (gitAutoCommit) {
      const status = await run("git status --porcelain", cwd);
      if (status.length > 0) {
        await run("git add -A", cwd);
        const commitMsg = `seaclip: auto-commit from run ${ctx.runId}`;
        await run(`git commit -m '${commitMsg}'`, cwd);
        commitSha = await run("git rev-parse HEAD", cwd);
      }
    }

    // 4. Auto-PR if enabled -----------------------------------------------
    let prUrl: string | undefined;
    if (gitAutoPR) {
      // Push the branch first
      await run(`git push -u origin ${branchName}`, cwd, 60_000);

      const prTitle = `[SeaClip] ${ctx.agentId} — run ${ctx.runId.slice(0, 8)}`;
      const prBody = [
        "## Auto-generated PR",
        "",
        `**Agent:** ${ctx.agentId}`,
        `**Run:** ${ctx.runId}`,
        `**Triggered by:** ${ctx.triggeredBy}`,
        "",
        "### Claude Output",
        "",
        claudeOutput.slice(0, 4000),
      ].join("\\n");

      // Escape single quotes in body
      const escapedBody = prBody.replace(/'/g, "'\\''");

      prUrl = await run(
        `gh pr create --base ${base} --head ${branchName} --title '${prTitle}' --body '${escapedBody}'`,
        cwd,
        60_000,
      );
    }

    return {
      output: claudeOutput,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      metadata: {
        model: selectedModel,
        branch: branchName,
        commitSha,
        prUrl,
        durationMs,
        exitCode: claudeResult.exitCode,
        stderr: claudeResult.stderr,
      },
    };
  },

  // -----------------------------------------------------------------------
  // testEnvironment
  // -----------------------------------------------------------------------
  async testEnvironment(
    config: Record<string, unknown>,
  ): Promise<AdapterEnvironmentTestResult> {
    const details: Record<string, unknown> = {};
    const missing: string[] = [];

    // Check `claude` CLI
    try {
      const claudeVersion = await run("claude --version", config.workingDir as string ?? "/tmp", 10_000);
      details.claudeVersion = claudeVersion;
    } catch {
      missing.push("claude CLI not found (install: npm i -g @anthropic-ai/claude-code)");
    }

    // Check `gh` CLI
    try {
      const ghVersion = await run("gh --version", config.workingDir as string ?? "/tmp", 10_000);
      details.ghVersion = ghVersion.split("\n")[0];
    } catch {
      missing.push("gh CLI not found (install: https://cli.github.com)");
    }

    // Check `git`
    try {
      const gitVersion = await run("git --version", config.workingDir as string ?? "/tmp", 10_000);
      details.gitVersion = gitVersion;
    } catch {
      missing.push("git not found");
    }

    if (missing.length > 0) {
      return {
        ok: false,
        message: `Missing dependencies: ${missing.join("; ")}`,
        details,
      };
    }

    return {
      ok: true,
      message: "claude, gh, and git CLIs are available",
      details,
    };
  },

  // -----------------------------------------------------------------------
  // listModels
  // -----------------------------------------------------------------------
  async listModels(_config: Record<string, unknown>): Promise<AdapterModel[]> {
    return CLAUDE_MODELS;
  },

  // -----------------------------------------------------------------------
  // Configuration docs
  // -----------------------------------------------------------------------
  agentConfigurationDoc: `
## Claude Code Adapter Configuration

| Field          | Type     | Required | Description                                                       |
|----------------|----------|----------|-------------------------------------------------------------------|
| workingDir     | string   | Yes      | Absolute path to the git repository to operate in                 |
| model          | string   | No       | Claude model to use (default: \`claude-sonnet-4-20250514\`)       |
| allowedTools   | string[] | No       | List of tool names to allow (passed as \`--allowedTools\`)         |
| gitAutoCommit  | boolean  | No       | Stage and commit all changes after the Claude run (default: false)|
| gitAutoPR      | boolean  | No       | Push the branch and create a PR via \`gh\` (default: false)       |
| targetBranch   | string   | No       | Base branch for feature branch and PR target (default: \`main\`)  |

### Prerequisites

- **claude** CLI installed (\`npm i -g @anthropic-ai/claude-code\`)
- **gh** CLI installed and authenticated (\`https://cli.github.com\`)
- **git** available and the workingDir must be a git repository

### Workflow

1. Creates a feature branch \`seaclip/<run-id-slug>\` from \`targetBranch\`
2. Runs \`claude --print --model <model> "<task>"\` in the working directory
3. If \`gitAutoCommit\` is true, stages and commits all changes
4. If \`gitAutoPR\` is true, pushes the branch and creates a PR via \`gh pr create\`
5. Returns the Claude output and PR URL (if created) in metadata
`.trim(),
};
