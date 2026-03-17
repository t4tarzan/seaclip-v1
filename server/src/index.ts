import "dotenv/config";
import http from "node:http";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";
import { createLiveEventsWsServer } from "./realtime/live-events-ws.js";
import { getLogger } from "./middleware/index.js";
import { initDb, closeDb } from "./db.js";
import { pushSchema } from "./db-push.js";
import { startHeartbeatScheduler, stopHeartbeatScheduler } from "./services/heartbeat-scheduler.js";
import { startGitHubPoller, stopGitHubPoller } from "./services/github-poller.js";

async function main(): Promise<void> {
  // 1. Load config first — all modules depend on it
  const config = loadConfig();
  const logger = getLogger();

  // 1b. Initialize database connection (async — PGlite needs to boot)
  const db = await initDb(config.databaseUrl);
  logger.info("Database connection initialized");

  // 1c. Push schema — creates tables if they don't exist
  await pushSchema(db);
  logger.info("Database schema ready");

  // 2. Create Express app
  const app = createApp();

  // 3. Create underlying HTTP server so we can attach WebSocket upgrade handler
  const httpServer = http.createServer(app);

  // 4. Attach WebSocket server for live events
  createLiveEventsWsServer(httpServer);

  // 5. Start listening
  await new Promise<void>((resolve) => {
    httpServer.listen(config.port, config.host, resolve);
  });

  // 6. Start heartbeat scheduler if enabled
  if (config.heartbeatSchedulerEnabled) {
    startHeartbeatScheduler(config.heartbeatSchedulerIntervalMs);
    logger.info(
      { intervalMs: config.heartbeatSchedulerIntervalMs },
      "Heartbeat scheduler started",
    );
  }

  // 6b. Start GitHub poller for pipeline progress tracking
  startGitHubPoller();

  // 7. Print startup banner
  const banner = `
╔══════════════════════════════════════════════════════╗
║               SeaClip Server v${process.env.npm_package_version ?? "0.1.0"}                 ║
╠══════════════════════════════════════════════════════╣
║  Mode    : ${config.deploymentMode.padEnd(42)}║
║  Listen  : http://${config.host}:${String(config.port).padEnd(33)}║
║  DB      : ${config.databaseUrl.replace(/:[^:@]*@/, ":***@").padEnd(42)}║
║  Serve UI: ${String(config.serveUi).padEnd(42)}║
║  Heartbt : ${config.heartbeatSchedulerEnabled ? `enabled (${config.heartbeatSchedulerIntervalMs}ms)` : "disabled".padEnd(42)}║
╚══════════════════════════════════════════════════════╝
  `.trim();

  logger.info(banner);
  logger.info(
    { port: config.port, mode: config.deploymentMode },
    "SeaClip server started",
  );

  // 8. Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Shutting down SeaClip server...");

    stopHeartbeatScheduler();
    stopGitHubPoller();

    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await closeDb();
    logger.info("Server closed. Goodbye.");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Fatal error during startup:", err);
  process.exit(1);
});
