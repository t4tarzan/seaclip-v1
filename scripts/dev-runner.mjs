#!/usr/bin/env node
/**
 * SeaClip Development Runner
 * Starts the server and UI dev server in parallel with proper signal handling.
 * Usage: node scripts/dev-runner.mjs
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

// ANSI color helpers
const color = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
};

function tag(label, c) {
  return `${c}[${label}]${color.reset} `;
}

/**
 * Spawn a process and pipe its output with a colored prefix.
 */
function spawnProcess(name, cmd, args, opts = {}) {
  const c = opts.color ?? color.cyan;
  const prefix = tag(name.padEnd(8), c);

  const child = spawn(cmd, args, {
    cwd: opts.cwd ?? ROOT,
    env: { ...process.env, ...opts.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  function pipe(stream) {
    const rl = createInterface({ input: stream });
    rl.on('line', (line) => {
      process.stdout.write(prefix + line + '\n');
    });
  }

  pipe(child.stdout);
  pipe(child.stderr);

  child.once('exit', (code, signal) => {
    if (code !== null && code !== 0) {
      console.error(
        `${color.red}${color.bold}[${name}] exited with code ${code}${color.reset}`
      );
    } else if (signal) {
      console.log(`${color.dim}[${name}] terminated by signal ${signal}${color.reset}`);
    }
  });

  return child;
}

console.log(`\n${color.cyan}${color.bold}  🌊 SeaClip Dev Runner${color.reset}\n`);
console.log(`${color.dim}  Starting server + UI in parallel…${color.reset}\n`);

const processes = [];

// ── Server (tsx watch) ────────────────────────────────────────────────────────
processes.push(
  spawnProcess('server', 'pnpm', ['--filter', '@seaclip/server', 'dev'], {
    cwd: ROOT,
    color: color.cyan,
    env: {
      NODE_ENV: 'development',
      PORT: process.env.PORT ?? '3001',
      SEACLIP_DEPLOYMENT_MODE: process.env.SEACLIP_DEPLOYMENT_MODE ?? 'local_trusted',
    },
  })
);

// ── UI (Vite) ─────────────────────────────────────────────────────────────────
processes.push(
  spawnProcess('ui', 'pnpm', ['--filter', '@seaclip/ui', 'dev'], {
    cwd: ROOT,
    color: color.magenta,
    env: {
      NODE_ENV: 'development',
    },
  })
);

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(
    `\n${color.yellow}${color.bold}  Received ${signal} — shutting down…${color.reset}\n`
  );
  for (const child of processes) {
    if (!child.killed) {
      child.kill(signal);
    }
  }

  // Force exit after 5 seconds
  setTimeout(() => {
    console.error(`${color.red}  Force-killed after timeout${color.reset}`);
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Exit when all children have exited
let exitedCount = 0;
for (const child of processes) {
  child.once('exit', () => {
    exitedCount++;
    if (exitedCount === processes.length) {
      console.log(`\n${color.dim}  All processes stopped.${color.reset}\n`);
      process.exit(0);
    }
  });
}

console.log(
  `${color.dim}  Server:  http://localhost:${process.env.PORT ?? 3001}${color.reset}`
);
console.log(
  `${color.dim}  UI:      http://localhost:3100${color.reset}`
);
console.log(`${color.dim}  Press Ctrl+C to stop all processes.\n${color.reset}`);
