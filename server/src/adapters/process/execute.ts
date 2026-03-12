/**
 * Full child_process.spawn implementation with timeout, graceful kill,
 * stdout/stderr capture.
 */
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";

export interface SpawnOptions {
  command: string;
  shell?: string;
  env?: Record<string, string>;
  cwd?: string;
  timeoutMs?: number;
}

export interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signalUsed?: NodeJS.Signals;
  durationMs: number;
  timedOut: boolean;
}

export async function spawnProcess(options: SpawnOptions): Promise<SpawnResult> {
  const {
    command,
    shell = "/bin/sh",
    env,
    cwd,
    timeoutMs = 60_000,
  } = options;

  const startMs = Date.now();

  return new Promise<SpawnResult>((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let timedOut = false;
    let signalUsed: NodeJS.Signals | undefined;

    const child: ChildProcess = spawn(shell, ["-c", command], {
      env,
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Capture stdout
    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    // Capture stderr
    child.stderr?.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    // Set up timeout
    const timer = setTimeout(() => {
      timedOut = true;
      signalUsed = "SIGTERM";
      child.kill("SIGTERM");

      // Force kill after 5 seconds if still alive
      const forceKill = setTimeout(() => {
        if (!child.killed) {
          signalUsed = "SIGKILL";
          child.kill("SIGKILL");
        }
      }, 5_000);

      forceKill.unref();
    }, timeoutMs);

    (child as any).once("error", (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });

    (child as any).once("close", (exitCode: number | null, signal: NodeJS.Signals | null) => {
      clearTimeout(timer);

      const durationMs = Date.now() - startMs;
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");

      if (timedOut) {
        reject(
          new Error(
            `Process timed out after ${timeoutMs}ms (signal: ${signalUsed})\nStdout: ${stdout}\nStderr: ${stderr}`,
          ),
        );
        return;
      }

      resolve({
        stdout,
        stderr,
        exitCode,
        signalUsed: signal as NodeJS.Signals | undefined,
        durationMs,
        timedOut: false,
      });
    });
  });
}
