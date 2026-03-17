/**
 * identify routes — chat with AI about a codebase, extract issues.
 *
 * Primary: Claude via CLI (uses Max subscription) with Sonnet model.
 * Fallback: Local Ollama qwen3.5:35b.
 */
import { Router } from "express";
import { z } from "zod";
import { execFile } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { requireAuth, validate } from "../middleware/index.js";
import { getLogger } from "../middleware/logger.js";
import * as issuesService from "../services/issues.js";

const router = Router({ mergeParams: true });

const CLAUDE_BIN = "/opt/homebrew/bin/claude";
const CLAUDE_MODEL = "sonnet";
const OLLAMA_MODEL = "qwen3.5:35b";

/** Build a reasonable title from the first user message in the chat. */
function buildTitleFromMessages(messages: { role: string; content: string }[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "Issue from Identify chat";
  const text = firstUser.content.replace(/\n/g, " ").trim();
  return text.length > 80 ? text.slice(0, 77) + "..." : text;
}

/**
 * Call Claude Code CLI with a prompt. Returns the text response.
 * Uses the user's Max subscription via OAuth — no API key needed.
 */
async function claudeChat(prompt: string): Promise<string> {
  // Write prompt to temp file to avoid arg length limits
  const tmpPath = join(tmpdir(), `seaclip-identify-${randomUUID()}.txt`);
  await writeFile(tmpPath, prompt, "utf-8");

  return new Promise((resolve, reject) => {
    const child = execFile(
      CLAUDE_BIN,
      ["-p", "--model", CLAUDE_MODEL, "--output-format", "text"],
      {
        timeout: 90_000,
        maxBuffer: 1024 * 1024,
        env: {
          ...process.env,
          // Ensure clean Claude session (not nested)
          CLAUDECODE: undefined,
          CLAUDE_CODE_SESSION: undefined,
        },
        shell: true,
      },
      async (err, stdout, stderr) => {
        // Clean up temp file
        unlink(tmpPath).catch(() => {});

        if (err) {
          getLogger().warn({ err: err.message, stderr }, "Claude CLI failed");
          reject(new Error(err.message));
          return;
        }
        const output = stdout.trim();
        if (!output) {
          reject(new Error("Claude returned empty response"));
          return;
        }
        resolve(output);
      },
    );

    // Pipe prompt via stdin
    if (child.stdin) {
      child.stdin.write(prompt);
      child.stdin.end();
    }
  });
}

/** Ollama fallback */
async function ollamaChat(
  systemPrompt: string,
  messages: { role: string; content: string }[],
): Promise<string> {
  const ollamaMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const res = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, messages: ollamaMessages, stream: false }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
    const data = (await res.json()) as any;
    return data.message?.content ?? "No response generated.";
  } finally {
    clearTimeout(timeout);
  }
}

const ChatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().max(10000),
    }),
  ),
  repo: z.string().max(500).optional(),
});

const ExtractIssueSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().max(10000),
    }),
  ),
  repo: z.string().max(500).optional(),
});

// POST /api/companies/:companyId/identify/chat
router.post(
  "/:companyId/identify/chat",
  requireAuth,
  validate(ChatSchema),
  async (req, res, next) => {
    try {
      const { messages, repo } = req.body;

      const systemPrompt = repo
        ? `You are a helpful AI assistant discussing the codebase at ${repo}. Help the user explore, debug, and identify improvements or issues. Be concise and technical. When the user has identified a clear issue or feature request, suggest they create an issue from the conversation.`
        : `You are a helpful AI assistant for software development. Help the user explore ideas, debug problems, and identify improvements. Be concise and technical. When the user has identified a clear issue or feature request, suggest they create an issue from the conversation.`;

      // Build a single prompt with conversation context for Claude CLI
      const conversationBlock = messages
        .map((m: { role: string; content: string }) =>
          `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`
        )
        .join("\n\n");

      const fullPrompt = `${systemPrompt}\n\nConversation so far:\n${conversationBlock}\n\nRespond to the user's last message. Be concise and helpful.`;

      let reply: string;
      try {
        reply = await claudeChat(fullPrompt);
      } catch (err) {
        getLogger().warn({ err }, "Claude CLI failed, falling back to Ollama qwen3.5");
        reply = await ollamaChat(systemPrompt, messages);
      }

      res.json({ data: { reply } });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/companies/:companyId/identify/extract-issue
router.post(
  "/:companyId/identify/extract-issue",
  requireAuth,
  validate(ExtractIssueSchema),
  async (req, res, next) => {
    try {
      const { messages, repo } = req.body;
      const companyId = String(req.params.companyId);

      const fallbackIssue = {
        title: buildTitleFromMessages(messages),
        description: messages
          .map((m: { role: string; content: string }) => `**${m.role}:** ${m.content}`)
          .join("\n\n"),
      };

      const conversationText = messages
        .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
        .join("\n\n");

      const repoContext = repo
        ? `\nRepository: ${repo}\nInclude this repo context in the description.`
        : "";

      const extractPrompt = `Based on the following conversation, extract a single GitHub-style issue. Return ONLY valid JSON with these fields:
- "title": a concise issue title (max 100 chars), use conventional commit style (e.g. "fix: ...", "feat: ...")
- "description": a detailed description in markdown format with problem, root cause, and proposed fix sections
- "priority": one of "urgent", "high", "medium", "low" based on severity${repoContext}

Do not wrap in markdown code fences. Output raw JSON only.

Conversation:
${conversationText}`;

      let issueJson: { title: string; description: string; priority?: string };
      try {
        const raw = await claudeChat(extractPrompt);
        // Strip markdown fences if present
        const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
        const parsed = JSON.parse(cleaned);
        issueJson = {
          title: parsed.title || fallbackIssue.title,
          description: parsed.description || fallbackIssue.description,
          priority: parsed.priority,
        };
      } catch (err) {
        getLogger().warn({ err }, "Claude extraction failed, using fallback");
        issueJson = fallbackIssue;
      }

      // Validate priority
      const validPriorities = ["urgent", "high", "medium", "low"];
      const priority = validPriorities.includes(issueJson.priority ?? "")
        ? issueJson.priority!
        : "medium";

      // Build metadata — always include repo if provided
      const metadata: Record<string, unknown> = {};
      if (repo) {
        const normalized = repo
          .replace(/^https?:\/\/github\.com\//, "")
          .replace(/\.git$/, "")
          .replace(/\/$/, "");
        metadata.githubRepo = normalized;
      }

      const issue = await issuesService.createIssue(companyId, {
        title: issueJson.title || "Untitled Issue",
        description: issueJson.description || "",
        priority: priority as any,
        status: "backlog" as any,
        metadata,
      });

      res.json({ data: { issueId: issue.id, title: issue.title } });
    } catch (err) {
      next(err);
    }
  },
);

export { router as identifyRouter };
