import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getConfig } from "../config.js";
import { getLogger } from "./logger.js";
import { unauthorized, forbidden } from "../errors.js";

export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "member" | "viewer";
  companyIds: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const LOCAL_TRUSTED_USER: AuthUser = {
  id: "local-board-user",
  email: "local@seaclip.local",
  role: "admin",
  companyIds: [],
};

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  const apiKey = req.headers["x-api-key"];
  if (typeof apiKey === "string" && apiKey.length > 0) {
    return apiKey;
  }

  // Support token in query string for WS upgrades
  if (typeof req.query.token === "string") {
    return req.query.token;
  }

  return null;
}

async function verifyToken(token: string): Promise<AuthUser> {
  const config = getConfig();

  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload & {
      sub?: string;
      email?: string;
      role?: string;
      companyIds?: string[];
    };

    return {
      id: payload.sub ?? payload.email ?? "unknown",
      email: payload.email ?? "",
      role: (payload.role as AuthUser["role"]) ?? "member",
      companyIds: payload.companyIds ?? [],
    };
  } catch (err) {
    throw unauthorized("Invalid or expired token");
  }
}

/**
 * Require authentication. In local_trusted mode, auto-creates a board user.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const config = getConfig();

  if (config.deploymentMode === "local_trusted") {
    req.user = { ...LOCAL_TRUSTED_USER };
    next();
    return;
  }

  const token = extractToken(req);
  if (!token) {
    next(unauthorized("Authentication required"));
    return;
  }

  try {
    req.user = await verifyToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional auth — populates req.user if a valid token is present, but does not
 * reject unauthenticated requests.
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const config = getConfig();

  if (config.deploymentMode === "local_trusted") {
    req.user = { ...LOCAL_TRUSTED_USER };
    next();
    return;
  }

  const token = extractToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    req.user = await verifyToken(token);
  } catch {
    // Silently ignore invalid tokens for optional auth
    getLogger().debug("Optional auth: invalid token, continuing unauthenticated");
  }

  next();
}

/**
 * Require user to have access to the given companyId.
 * Admin users can access all companies.
 */
export function requireCompanyAccess(
  req: Request,
  companyId: string,
): void {
  const user = req.user;
  if (!user) {
    throw unauthorized("Authentication required");
  }
  if (user.role === "admin") return;
  if (!user.companyIds.includes(companyId)) {
    throw forbidden("Access to this company is not permitted");
  }
}
