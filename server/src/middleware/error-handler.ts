import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors.js";
import { getLogger } from "./logger.js";

export interface ApiErrorResponse {
  error: string;
  status: number;
  details?: unknown;
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const logger = getLogger();

  if (err instanceof AppError) {
    const statusCode = err.status;

    if (statusCode >= 500) {
      logger.error({ err, url: req.originalUrl, method: req.method }, "Server error");
    } else if (statusCode >= 400) {
      logger.warn(
        { status: statusCode, message: err.message, url: req.originalUrl },
        "Client error",
      );
    }

    const body: ApiErrorResponse = {
      error: err.message,
      status: statusCode,
    };

    res.status(statusCode).json(body);
    return;
  }

  // Handle Zod validation errors
  if (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: string }).name === "ZodError"
  ) {
    const zodErr = err as unknown as { errors: Array<{ path: (string | number)[]; message: string }> };
    const message = zodErr.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");

    logger.warn({ url: req.originalUrl, message }, "Validation error");
    res.status(422).json({ error: message, status: 422 });
    return;
  }

  // Handle JWT errors
  if (
    typeof err === "object" &&
    err !== null &&
    "name" in err
  ) {
    const namedErr = err as { name: string; message: string };
    if (namedErr.name === "JsonWebTokenError" || namedErr.name === "TokenExpiredError") {
      logger.warn({ url: req.originalUrl, name: namedErr.name }, "JWT error");
      res.status(401).json({ error: "Invalid or expired token", status: 401 });
      return;
    }
  }

  // Unknown/unexpected errors
  logger.error({ err, url: req.originalUrl, method: req.method }, "Unhandled error");

  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err instanceof Error
        ? err.message
        : String(err);

  res.status(500).json({ error: message, status: 500 });
}
