/**
 * seaclip onboard — Interactive setup wizard
 * Walks users through first-time configuration, then bootstraps the system
 * with a default company and optional first agent.
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { writeConfig, readConfig, getConfigDir, getConfigPath, type SeaClipConfig } from '../config/store.js';
import { buildEnvFromConfig } from '../config/env.js';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { createServer } from 'net';
import { spawn, type ChildProcess } from 'child_process';

const ADAPTER_TYPES = [
  { name: 'Ollama Local    — Run local LLMs via Ollama', value: 'ollama_local' },
  { name: 'Claude Code     — Claude as an agent backend', value: 'claude_code' },
  { name: 'HTTP            — Any HTTP-callable agent endpoint', value: 'http' },
  { name: 'Process         — Spawn a local command as an agent', value: 'process' },
  { name: 'SeaClaw Edge    — C11 edge binary on IoT devices', value: 'seaclaw' },
  { name: 'Agent Zero      — Agent Zero framework integration', value: 'agent_zero' },
  { name: 'Telegram Bridge — Human-in-the-loop via Telegram', value: 'telegram_bridge' },
] as const;

export function registerOnboard(program: Command): void {
  program
    .command('onboard')
    .description('Interactive setup wizard — configure SeaClip for the first time')
    .option('--reset', 'Overwrite existing configuration')
    .option('--skip-bootstrap', 'Skip company/agent creation after configuration')
    .action(async (opts: { reset?: boolean; skipBootstrap?: boolean }) => {
      await runOnboard(opts.reset ?? false, opts.skipBootstrap ?? false);
    });
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function checkPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '0.0.0.0');
  });
}

async function checkOllamaReachable(url: string): Promise<{ ok: boolean; models: number }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${url}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return { ok: false, models: 0 };
    const data = (await res.json()) as { models?: unknown[] };
    return { ok: true, models: data.models?.length ?? 0 };
  } catch {
    return { ok: false, models: 0 };
  }
}

async function waitForServer(port: number, maxWaitMs = 15_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`http://localhost:${port}/api/health`, { signal: controller.signal });
      clearTimeout(t);
      if (res.ok) return true;
    } catch { /* keep trying */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function apiPost<T>(baseUrl: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function runOnboard(reset: boolean, skipBootstrap: boolean): Promise<void> {
  const configPath = getConfigPath();

  if (existsSync(configPath) && !reset) {
    console.log(chalk.yellow('\nSeaClip is already configured.'));
    console.log(chalk.dim('  Config: ') + chalk.cyan(configPath));
    console.log(
      chalk.dim('  Run ') +
        chalk.cyan('seaclip onboard --reset') +
        chalk.dim(' to overwrite, or ') +
        chalk.cyan('seaclip configure') +
        chalk.dim(' to update individual settings.\n'),
    );
    return;
  }

  console.log(chalk.bold('\n── SeaClip Setup Wizard ──\n'));
  console.log(chalk.dim('This wizard configures your SeaClip installation.'));
  console.log(chalk.dim(`Config will be saved to: ${getConfigDir()}\n`));

  // ── Step 1: Deployment mode ────────────────────────────────────────────
  const { deploymentMode } = await inquirer.prompt<{ deploymentMode: 'local_trusted' | 'authenticated' }>([
    {
      type: 'list',
      name: 'deploymentMode',
      message: 'Select deployment mode:',
      choices: [
        {
          name: 'local_trusted  — No auth required, suitable for home/lab networks',
          value: 'local_trusted',
        },
        {
          name: 'authenticated  — JWT-based auth, suitable for multi-user or internet-facing',
          value: 'authenticated',
        },
      ],
    },
  ]);

  // ── Step 2: Database ───────────────────────────────────────────────────
  const { databaseMode } = await inquirer.prompt<{ databaseMode: 'embedded' | 'postgres' }>([
    {
      type: 'list',
      name: 'databaseMode',
      message: 'Database backend:',
      choices: [
        { name: 'PGlite (Embedded)  — Zero-config embedded PostgreSQL in ~/.seaclip/data/', value: 'embedded' },
        { name: 'PostgreSQL         — External database for production use', value: 'postgres' },
      ],
    },
  ]);

  let connectionString: string | undefined;
  if (databaseMode === 'postgres') {
    const { dbUrl } = await inquirer.prompt<{ dbUrl: string }>([
      {
        type: 'input',
        name: 'dbUrl',
        message: 'PostgreSQL connection URL:',
        default: 'postgres://seaclip:seaclip@localhost:5432/seaclip',
        validate: (v: string) => {
          try {
            new URL(v);
            return true;
          } catch {
            return 'Please enter a valid PostgreSQL URL (e.g. postgres://user:pass@host:5432/db)';
          }
        },
      },
    ]);
    connectionString = dbUrl;
  }

  // ── Step 3: Ollama ─────────────────────────────────────────────────────
  const { ollamaUrl } = await inquirer.prompt<{ ollamaUrl: string }>([
    {
      type: 'input',
      name: 'ollamaUrl',
      message: 'Ollama base URL:',
      default: 'http://localhost:11434',
      validate: (v: string) => {
        try {
          new URL(v);
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      },
    },
  ]);

  // Pre-flight: check Ollama reachability
  const ollamaCheck = await checkOllamaReachable(ollamaUrl);
  if (ollamaCheck.ok) {
    console.log(chalk.green(`  ✓ Ollama reachable — ${ollamaCheck.models} model(s) available`));
  } else {
    console.log(chalk.yellow(`  ⚠ Ollama not reachable at ${ollamaUrl} — you can configure it later`));
  }

  // ── Step 4: Telegram (optional) ────────────────────────────────────────
  const { useTelegram } = await inquirer.prompt<{ useTelegram: boolean }>([
    {
      type: 'confirm',
      name: 'useTelegram',
      message: 'Configure Telegram bridge? (optional)',
      default: false,
    },
  ]);

  let telegramBotToken: string | undefined;
  let telegramChatId: string | undefined;

  if (useTelegram) {
    const telegramAnswers = await inquirer.prompt<{ botToken: string; chatId: string }>([
      {
        type: 'password',
        name: 'botToken',
        message: 'Telegram bot token (from @BotFather):',
        validate: (v: string) => v.trim().length > 0 || 'Bot token is required',
      },
      {
        type: 'input',
        name: 'chatId',
        message: 'Telegram chat ID (leave blank to configure later):',
      },
    ]);
    telegramBotToken = telegramAnswers.botToken;
    telegramChatId = telegramAnswers.chatId || undefined;
  }

  // ── Step 5: Server port ────────────────────────────────────────────────
  const { serverPort } = await inquirer.prompt<{ serverPort: number }>([
    {
      type: 'number',
      name: 'serverPort',
      message: 'Server port:',
      default: 3001,
      validate: (v: number) =>
        (v >= 1024 && v <= 65535) || 'Port must be between 1024 and 65535',
    },
  ]);

  // Pre-flight: check port availability
  const portOk = await checkPortAvailable(serverPort);
  if (portOk) {
    console.log(chalk.green(`  ✓ Port ${serverPort} is available`));
  } else {
    console.log(chalk.yellow(`  ⚠ Port ${serverPort} is already in use — server may fail to start`));
  }

  // ── Save config ────────────────────────────────────────────────────────
  const config: SeaClipConfig = {
    server: {
      host: '0.0.0.0',
      port: serverPort,
      deploymentMode,
    },
    database: {
      mode: databaseMode,
      connectionString,
    },
    ollama: { baseUrl: ollamaUrl },
    telegram: {
      botToken: telegramBotToken,
      chatId: telegramChatId,
    },
    storage: {
      provider: 'local_disk',
      baseDir: join(homedir(), '.seaclip', 'data'),
    },
  };

  // Ensure storage directory exists
  const storageDir = config.storage.baseDir;
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }

  // Write config
  const spinner = ora('Saving configuration…').start();
  try {
    writeConfig(config);
    spinner.succeed(chalk.green('Configuration saved'));
  } catch (err) {
    spinner.fail(chalk.red('Failed to save configuration'));
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }

  console.log(chalk.dim(`  Config: ${configPath}`));
  console.log(chalk.dim(`  Storage: ${storageDir}\n`));

  // ── Bootstrap: start server + create company + agent ───────────────────
  if (skipBootstrap) {
    printNextSteps(serverPort);
    return;
  }

  const { wantBootstrap } = await inquirer.prompt<{ wantBootstrap: boolean }>([
    {
      type: 'confirm',
      name: 'wantBootstrap',
      message: 'Start the server now and create your first company?',
      default: true,
    },
  ]);

  if (!wantBootstrap) {
    printNextSteps(serverPort);
    return;
  }

  // Start the server in the background using tsx (dev mode)
  const serverSpinner = ora('Starting SeaClip server…').start();
  let serverProcess: ChildProcess | null = null;

  try {
    const env = buildEnvFromConfig(config);
    env['PORT'] = String(serverPort);
    env['NODE_ENV'] = 'development';

    // Use tsx to run the server (since @seaclip/db exports raw .ts)
    const projectRoot = findProjectRoot();
    const serverEntry = join(projectRoot, 'server/src/index.ts');

    if (!existsSync(serverEntry)) {
      serverSpinner.warn(chalk.yellow('Could not find server entry — skipping bootstrap'));
      printNextSteps(serverPort);
      return;
    }

    const tsxBin = join(projectRoot, 'node_modules/.bin/tsx');
    const cmd = existsSync(tsxBin) ? tsxBin : 'npx';
    const args = existsSync(tsxBin) ? [serverEntry] : ['tsx', serverEntry];

    serverProcess = spawn(cmd, args, {
      env: env as NodeJS.ProcessEnv,
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });

    // Wait for the server to be healthy
    const serverReady = await waitForServer(serverPort);
    if (!serverReady) {
      serverSpinner.fail(chalk.red('Server failed to start within 15 seconds'));
      serverProcess?.kill();
      printNextSteps(serverPort);
      return;
    }

    serverSpinner.succeed(chalk.green(`Server running on port ${serverPort}`));
  } catch (err) {
    serverSpinner.fail(chalk.red('Failed to start server'));
    console.error(chalk.dim(err instanceof Error ? err.message : String(err)));
    printNextSteps(serverPort);
    return;
  }

  const baseUrl = `http://localhost:${serverPort}`;

  // ── Create company ─────────────────────────────────────────────────────
  const { companyName } = await inquirer.prompt<{ companyName: string }>([
    {
      type: 'input',
      name: 'companyName',
      message: 'Organization name:',
      default: 'My Lab',
      validate: (v: string) => v.trim().length > 0 || 'Name is required',
    },
  ]);

  const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my-lab';

  const companySpinner = ora(`Creating company "${companyName}"…`).start();
  let companyId: string;
  try {
    const result = await apiPost<{ id: string; name: string; slug: string }>(
      baseUrl, '/api/companies', { name: companyName, slug },
    );
    companyId = result.id;
    companySpinner.succeed(chalk.green(`Company created: ${companyName}`) + chalk.dim(` (${companyId.slice(0, 8)}…)`));
  } catch (err) {
    companySpinner.fail(chalk.red('Failed to create company'));
    console.error(chalk.dim(err instanceof Error ? err.message : String(err)));
    stopServer(serverProcess);
    printNextSteps(serverPort);
    return;
  }

  // ── Create first agent (optional) ──────────────────────────────────────
  const { wantAgent } = await inquirer.prompt<{ wantAgent: boolean }>([
    {
      type: 'confirm',
      name: 'wantAgent',
      message: 'Create your first agent?',
      default: true,
    },
  ]);

  if (wantAgent) {
    const agentAnswers = await inquirer.prompt<{
      agentName: string;
      adapterType: string;
      role: string;
      systemPrompt: string;
    }>([
      {
        type: 'input',
        name: 'agentName',
        message: 'Agent name:',
        default: 'Local Analyst',
        validate: (v: string) => v.trim().length > 0 || 'Name is required',
      },
      {
        type: 'list',
        name: 'adapterType',
        message: 'Agent adapter type:',
        choices: ADAPTER_TYPES,
        default: ollamaCheck.ok ? 'ollama_local' : 'claude_code',
      },
      {
        type: 'input',
        name: 'role',
        message: 'Agent role (short description):',
        default: 'General-purpose analysis and code review',
      },
      {
        type: 'input',
        name: 'systemPrompt',
        message: 'System prompt (or press Enter for default):',
        default: 'You are a helpful AI agent. Analyze tasks carefully and provide actionable responses.',
      },
    ]);

    // Build adapter config
    let adapterConfig: Record<string, unknown> = {};
    if (agentAnswers.adapterType === 'ollama_local') {
      const { model } = await inquirer.prompt<{ model: string }>([
        {
          type: 'input',
          name: 'model',
          message: 'Ollama model name:',
          default: 'llama3.2',
        },
      ]);
      adapterConfig = { baseUrl: ollamaUrl, model };
    }

    const agentSlug = agentAnswers.agentName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const agentSpinner = ora(`Creating agent "${agentAnswers.agentName}"…`).start();
    try {
      const agent = await apiPost<{ id: string; name: string }>(
        baseUrl, `/api/companies/${companyId}/agents`,
        {
          name: agentAnswers.agentName,
          slug: agentSlug,
          adapterType: agentAnswers.adapterType,
          role: agentAnswers.role,
          systemPrompt: agentAnswers.systemPrompt,
          adapterConfig,
          status: 'idle',
          heartbeatEnabled: true,
          environmentTag: agentAnswers.adapterType === 'ollama_local' ? 'local' : 'cloud',
        },
      );
      agentSpinner.succeed(
        chalk.green(`Agent created: ${agentAnswers.agentName}`) +
          chalk.dim(` (${agent.id.slice(0, 8)}…) [${agentAnswers.adapterType}]`),
      );
    } catch (err) {
      agentSpinner.fail(chalk.red('Failed to create agent'));
      console.error(chalk.dim(err instanceof Error ? err.message : String(err)));
    }
  }

  // ── Done ───────────────────────────────────────────────────────────────
  stopServer(serverProcess);

  console.log(chalk.bold('\n✓ SeaClip is ready!\n'));
  console.log(chalk.dim('─'.repeat(48)));
  console.log(chalk.bold('  Quick start:\n'));
  console.log(
    '  1. ' + chalk.cyan('pnpm dev') + chalk.dim('              — start server + UI in dev mode'),
  );
  console.log(
    '  2. Open ' + chalk.cyan(`http://localhost:5173`) + chalk.dim(' — dashboard UI'),
  );
  console.log(
    '  3. ' + chalk.cyan('seaclip doctor') + chalk.dim('        — verify system health'),
  );
  console.log(chalk.dim('\n  Or for production:'));
  console.log(
    '  1. ' + chalk.cyan('pnpm build') + chalk.dim('            — build all packages'),
  );
  console.log(
    '  2. ' + chalk.cyan('seaclip run') + chalk.dim('           — start the production server'),
  );
  console.log(
    `  3. Open ${chalk.cyan(`http://localhost:${serverPort}`)}`,
  );
  console.log(chalk.dim('\n─'.repeat(48)));
  console.log(chalk.dim(`  Config: ${configPath}`));
  console.log(chalk.dim(`  Data:   ${storageDir}\n`));
}

// ─── Utilities ────────────────────────────────────────────────────────────

function findProjectRoot(): string {
  // Walk up from CWD looking for package.json with "seaclip" name
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    if (existsSync(join(dir, 'package.json'))) {
      try {
        const pkg = JSON.parse(require('fs').readFileSync(join(dir, 'package.json'), 'utf-8'));
        if (pkg.name === 'seaclip') return dir;
      } catch { /* continue */ }
    }
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function stopServer(proc: ChildProcess | null): void {
  if (!proc) return;
  try {
    proc.kill('SIGTERM');
  } catch { /* already dead */ }
}

function printNextSteps(port: number): void {
  console.log(chalk.bold('\n✓ SeaClip is configured!\n'));
  console.log(chalk.dim('─'.repeat(42)));
  console.log(chalk.bold('  Next steps:\n'));
  console.log(
    '  1. ' + chalk.cyan('seaclip doctor') + chalk.dim('    — verify system health'),
  );
  console.log(
    '  2. ' + chalk.cyan('pnpm dev') + chalk.dim('          — start dev server + UI'),
  );
  console.log(
    `  3. Open ${chalk.cyan(`http://localhost:5173`)} in your browser`,
  );
  console.log(chalk.dim('\n─'.repeat(42)));
  console.log(chalk.dim(`\n  Config stored at: ${getConfigPath()}\n`));
}
