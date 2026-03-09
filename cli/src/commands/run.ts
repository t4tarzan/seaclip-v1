/**
 * seaclip run — Start the SeaClip server process
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { spawn } from 'child_process';
import { readConfig, configExists } from '../config/store.js';
import { buildEnvFromConfig } from '../config/env.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function registerRun(program: Command): void {
  program
    .command('run')
    .description('Start the SeaClip server')
    .option('-p, --port <port>', 'Override server port')
    .option('--host <host>', 'Override server host')
    .option('--dev', 'Run in dev mode using tsx (no build required)')
    .option('--env-file <path>', 'Load additional environment variables from a .env file')
    .action(async (opts: { port?: string; host?: string; dev?: boolean; envFile?: string }) => {
      await runServer(opts);
    });
}

async function runServer(opts: { port?: string; host?: string; dev?: boolean; envFile?: string }): Promise<void> {
  if (!configExists()) {
    console.error(chalk.red('\nSeaClip is not configured yet.'));
    console.log(chalk.dim('Run ') + chalk.cyan('seaclip onboard') + chalk.dim(' to get started.\n'));
    process.exit(1);
  }

  const config = readConfig();
  const env = buildEnvFromConfig(config);

  // Allow CLI option overrides
  if (opts.port) env['PORT'] = opts.port;
  if (opts.host) env['HOST'] = opts.host;

  // Load additional .env file if provided
  if (opts.envFile) {
    const { config: dotenvConfig } = await import('dotenv');
    dotenvConfig({ path: opts.envFile, override: false });
  }

  const port = env['PORT'] ?? String(config.server.port);

  // Dev mode: use tsx to run server source directly
  if (opts.dev) {
    return runDev(env, port);
  }

  // Production mode: use compiled server
  const candidates = [
    resolve(__dirname, '../../server/dist/index.js'),
    resolve(process.cwd(), 'server/dist/index.js'),
    resolve(process.cwd(), 'dist/index.js'),
  ];

  const serverEntry = candidates.find((p) => existsSync(p));

  if (!serverEntry) {
    console.error(chalk.red('\nCould not find the compiled server entry point.'));
    console.log(
      chalk.dim('  Options:\n') +
        chalk.dim('    1. ') + chalk.cyan('pnpm build') + chalk.dim(' first, then ') + chalk.cyan('seaclip run') + '\n' +
        chalk.dim('    2. ') + chalk.cyan('seaclip run --dev') + chalk.dim(' to run from source via tsx\n'),
    );
    process.exit(1);
  }

  const spinner = ora(`Starting SeaClip server on port ${port}…`).start();

  const child = spawn('node', [serverEntry], {
    env: env as NodeJS.ProcessEnv,
    stdio: 'inherit',
  });

  child.once('spawn', () => {
    spinner.succeed(
      chalk.green(`SeaClip server started`) +
        chalk.dim(` — http://localhost:${port}`),
    );
    console.log(chalk.dim('Press Ctrl+C to stop.\n'));
  });

  child.once('error', (err) => {
    spinner.fail(chalk.red(`Failed to start server: ${err.message}`));
    process.exit(1);
  });

  child.once('close', (code) => {
    if (code !== 0 && code !== null) {
      console.error(chalk.red(`\nServer exited with code ${code}`));
      process.exit(code);
    }
  });

  // Forward signals to child process
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      child.kill(sig);
    });
  }
}

function runDev(env: NodeJS.ProcessEnv, port: string): void {
  // Find project root and tsx binary
  const projectRoot = findProjectRoot();
  const serverEntry = resolve(projectRoot, 'server/src/index.ts');
  const tsxBin = resolve(projectRoot, 'node_modules/.bin/tsx');

  if (!existsSync(serverEntry)) {
    console.error(chalk.red(`\nCould not find server source at: ${serverEntry}`));
    process.exit(1);
  }

  const cmd = existsSync(tsxBin) ? tsxBin : 'npx';
  const args = existsSync(tsxBin) ? ['watch', serverEntry] : ['tsx', 'watch', serverEntry];

  const spinner = ora(`Starting SeaClip server (dev mode) on port ${port}…`).start();

  const child = spawn(cmd, args, {
    env: env as NodeJS.ProcessEnv,
    cwd: projectRoot,
    stdio: 'inherit',
  });

  child.once('spawn', () => {
    spinner.succeed(
      chalk.green(`SeaClip server started (dev mode)`) +
        chalk.dim(` — http://localhost:${port}`),
    );
    console.log(chalk.dim('Press Ctrl+C to stop.\n'));
  });

  child.once('error', (err) => {
    spinner.fail(chalk.red(`Failed to start server: ${err.message}`));
    process.exit(1);
  });

  child.once('close', (code) => {
    if (code !== 0 && code !== null) {
      console.error(chalk.red(`\nServer exited with code ${code}`));
      process.exit(code);
    }
  });

  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      child.kill(sig);
    });
  }
}

function findProjectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}
