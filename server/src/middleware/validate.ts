import type { Request, Response, NextFunction } from "express";
import type { ZodTypeAny } from "zod";

type ValidationTarget = "body" | "query" | "params";

/**
 * Validate req[target] against a Zod schema.
 * Replaces req[target] with the parsed (coerced/stripped) result on success.
 * Calls next(err) with a 422 AppError on failure.
 */
export function validate<T extends ZodTypeAny>(
  schema: T,
  target: ValidationTarget = "body",
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      // Build a human-readable message from Zod's error list
      const message = result.error.errors
        .map((e) => {
          const path = e.path.length ? `${e.path.join(".")}: ` : "";
          return `${path}${e.message}`;
        })
        .join("; ");

      const err = Object.assign(new Error(message), {
        name: "ZodError",
        errors: result.error.errors,
        status: 422,
      });

      next(err);
      return;
    }

    // Overwrite with parsed/coerced data
    (req as unknown as Record<string, unknown>)[target] = result.data;
    next();
  };
}
