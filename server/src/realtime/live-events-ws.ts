/**
 * WebSocket server for live events per company.
 *
 * Clients connect to: /api/companies/:companyId/events/ws
 * Auth via Bearer token or ?token= query param.
 */
import type { IncomingMessage, Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { URL } from "node:url";
import jwt from "jsonwebtoken";
import { getConfig } from "../config.js";
import { subscribeCompanyLiveEvents } from "../services/live-events.js";
import { getLogger } from "../middleware/logger.js";

const PING_INTERVAL_MS = 30_000;
const WS_PATH_REGEX = /^\/api\/companies\/([^/]+)\/events\/ws/;

interface WsClient {
  ws: WebSocket;
  companyId: string;
  clientId: string;
  isAlive: boolean;
}

export function createLiveEventsWsServer(httpServer: Server): WebSocketServer {
  const logger = getLogger();

  const wss = new WebSocketServer({ noServer: true });

  // Handle HTTP upgrade manually so we can parse the path and authenticate
  httpServer.on("upgrade", (request: IncomingMessage, socket, head) => {
    const rawUrl = request.url ?? "";
    const match = WS_PATH_REGEX.exec(rawUrl);

    if (!match) {
      // Not our route — destroy to prevent dangling sockets
      socket.destroy();
      return;
    }

    const companyId = match[1];

    // Parse query string for token
    let token: string | null = null;
    try {
      const url = new URL(rawUrl, "http://localhost");
      token = url.searchParams.get("token");
    } catch {
      // ignore
    }

    // Also check Authorization header
    if (!token) {
      const authHeader = request.headers.authorization ?? "";
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.slice(7).trim();
      }
    }

    const config = getConfig();

    // In local_trusted mode, skip auth
    if (config.deploymentMode !== "local_trusted" && token) {
      try {
        jwt.verify(token, config.jwtSecret);
      } catch {
        logger.warn({ companyId }, "WS auth failed: invalid token");
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
    } else if (config.deploymentMode !== "local_trusted" && !token) {
      logger.warn({ companyId }, "WS auth failed: no token");
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, companyId);
    });
  });

  // Ping/pong keepalive
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const client = (ws as unknown as { _seaclipClient: WsClient })._seaclipClient;
      if (!client) return;

      if (!client.isAlive) {
        logger.debug({ clientId: client.clientId }, "WS client timed out, terminating");
        ws.terminate();
        return;
      }

      client.isAlive = false;
      ws.ping();
    });
  }, PING_INTERVAL_MS);

  wss.on("close", () => {
    clearInterval(pingInterval);
  });

  wss.on("connection", (ws: WebSocket, _request: IncomingMessage, companyId: string) => {
    const clientId = crypto.randomUUID();

    const client: WsClient = {
      ws,
      companyId,
      clientId,
      isAlive: true,
    };

    (ws as unknown as { _seaclipClient: WsClient })._seaclipClient = client;

    logger.info({ clientId, companyId }, "WS client connected");

    // Send welcome message
    sendJson(ws, {
      type: "connected",
      clientId,
      companyId,
      timestamp: new Date().toISOString(),
    });

    // Subscribe to live events for this company
    const unsubscribe = subscribeCompanyLiveEvents(companyId, (event) => {
      if (ws.readyState === WebSocket.OPEN) {
        sendJson(ws, event);
      }
    });

    ws.on("pong", () => {
      client.isAlive = true;
    });

    ws.on("message", (data) => {
      // Support ping messages from client
      try {
        const msg = JSON.parse(data.toString()) as { type?: string };
        if (msg.type === "ping") {
          sendJson(ws, { type: "pong", timestamp: new Date().toISOString() });
        }
      } catch {
        // Ignore non-JSON messages
      }
    });

    ws.on("close", (code, reason) => {
      unsubscribe();
      logger.info(
        { clientId, companyId, code, reason: reason.toString() },
        "WS client disconnected",
      );
    });

    ws.on("error", (err) => {
      unsubscribe();
      logger.error({ clientId, companyId, err }, "WS client error");
    });
  });

  logger.info("Live events WebSocket server attached");
  return wss;
}

function sendJson(ws: WebSocket, payload: unknown): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch (err) {
    getLogger().error({ err }, "Failed to send WS message");
  }
}
