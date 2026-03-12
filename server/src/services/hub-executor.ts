import { exec } from "node:child_process";
import { promisify } from "node:util";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const execAsync = promisify(exec);

const LOG_DIR = join(homedir(), ".seaclip", "logs");
const LOG_FILE = join(LOG_DIR, "hub-executions.log");

interface ExecutionResult {
  executed: boolean;
  action: string;
  output?: string;
  error?: string;
}

async function log(message: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  await mkdir(LOG_DIR, { recursive: true });
  await appendFile(LOG_FILE, line);
}

async function runCommand(cmd: string, timeoutMs = 120_000): Promise<{ stdout: string; stderr: string }> {
  await log(`EXEC: ${cmd}`);
  const result = await execAsync(cmd, { timeout: timeoutMs, env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` } });
  if (result.stdout) await log(`STDOUT: ${result.stdout.trim()}`);
  if (result.stderr) await log(`STDERR: ${result.stderr.trim()}`);
  return result;
}

// ---------------------------------------------------------------------------
// Port — verify reachability, no system change needed (firewall is off)
// ---------------------------------------------------------------------------
async function executePort(metadata: Record<string, unknown>): Promise<ExecutionResult> {
  const port = metadata.port as number;
  const username = metadata.username as string;

  if (!port || port < 1 || port > 65535) {
    return { executed: false, action: "port", error: "Invalid port number" };
  }

  // Check if something is already listening
  try {
    const { stdout } = await runCommand(`lsof -i :${port} -P -n -sTCP:LISTEN 2>/dev/null | head -5`);
    const listening = stdout.trim().length > 0;

    await log(`PORT ${port} for ${username}: ${listening ? "already listening" : "not yet listening"}`);

    return {
      executed: true,
      action: `port:${port}`,
      output: listening
        ? `Port ${port} is already open and listening. Accessible via Tailscale at whitenoises-mac-studio.zapus-rohu.ts.net:${port}`
        : `Port ${port} approved. macOS firewall is off — once ${username} starts a service on this port, it will be accessible via Tailscale at whitenoises-mac-studio.zapus-rohu.ts.net:${port}`,
    };
  } catch {
    return {
      executed: true,
      action: `port:${port}`,
      output: `Port ${port} approved. Firewall is off — will be accessible via Tailscale once a service binds to 0.0.0.0:${port}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Package — brew install
// ---------------------------------------------------------------------------

// Allowed packages (safety whitelist — add more as needed)
const ALLOWED_PACKAGES = new Set([
  "ffmpeg", "imagemagick", "jq", "wget", "htop", "tree", "ripgrep", "fd",
  "bat", "fzf", "gh", "git-lfs", "redis", "sqlite", "graphviz", "cmake",
  "go", "rust", "python3", "ruby", "lua", "zig",
  "nginx", "caddy", "mkcert",
  "nmap", "curl", "httpie",
  "neovim", "tmux",
  "postgresql@16", "mysql",
]);

async function executePackage(metadata: Record<string, unknown>, title: string): Promise<ExecutionResult> {
  // Extract package name from title: "[PACKAGE] Install ffmpeg for ..."
  const match = title.match(/install\s+(\S+)/i);
  const pkg = match?.[1]?.toLowerCase();

  if (!pkg) {
    return { executed: false, action: "package", error: "Could not determine package name from request title. Admin should install manually." };
  }

  if (!ALLOWED_PACKAGES.has(pkg)) {
    return {
      executed: false,
      action: `package:${pkg}`,
      error: `Package "${pkg}" is not in the auto-install whitelist. Admin should install manually: brew install ${pkg}`,
    };
  }

  try {
    // Check if already installed
    const { stdout: already } = await runCommand(`brew list ${pkg} 2>/dev/null | head -1`).catch(() => ({ stdout: "" }));
    if (already.trim()) {
      return { executed: true, action: `package:${pkg}`, output: `${pkg} is already installed.` };
    }

    const { stdout, stderr } = await runCommand(`brew install ${pkg}`, 300_000);
    return {
      executed: true,
      action: `package:${pkg}`,
      output: `Installed ${pkg} via Homebrew.\n${stdout.slice(-500)}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { executed: false, action: `package:${pkg}`, error: `brew install ${pkg} failed: ${msg.slice(-500)}` };
  }
}

// ---------------------------------------------------------------------------
// Docker — run a docker command (limited to safe operations)
// ---------------------------------------------------------------------------
async function executeDocker(metadata: Record<string, unknown>, description: string): Promise<ExecutionResult> {
  const username = (metadata.username as string) ?? "unknown";

  // We don't auto-execute arbitrary docker commands — too risky.
  // Instead, provide a helper message with what the admin approved.
  return {
    executed: false,
    action: "docker",
    error: `Docker requests require manual execution. Approved for ${username}: ${description}`,
  };
}

// ---------------------------------------------------------------------------
// Cron — add a user crontab entry
// ---------------------------------------------------------------------------
async function executeCron(metadata: Record<string, unknown>, description: string): Promise<ExecutionResult> {
  const username = (metadata.username as string) ?? "unknown";

  // Cron is user-scoped — the user can add their own crontab
  return {
    executed: true,
    action: "cron",
    output: `Approved. ${username} can now add their cron entry: crontab -e\nRequested: ${description}`,
  };
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------
export async function executeApprovedRequest(
  requestType: string,
  title: string,
  description: string,
  metadata: Record<string, unknown>,
): Promise<ExecutionResult> {
  await log(`--- APPROVED: type=${requestType} title="${title}" user=${metadata.username ?? "?"} ---`);

  try {
    switch (requestType) {
      case "port":
        return await executePort(metadata);
      case "package":
        return await executePackage(metadata, title);
      case "docker":
        return await executeDocker(metadata, description ?? "");
      case "cron":
        return await executeCron(metadata, description ?? "");
      case "nginx":
      case "dns":
      case "access":
      case "other":
      default:
        return {
          executed: false,
          action: requestType,
          error: `"${requestType}" requests require manual admin action.`,
        };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await log(`EXECUTION ERROR: ${msg}`);
    return { executed: false, action: requestType, error: msg };
  }
}
