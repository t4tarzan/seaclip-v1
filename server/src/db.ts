/**
 * Database singleton — supports two backends:
 *
 * 1. **PGlite** (embedded PostgreSQL) — used when DATABASE_URL starts with
 *    "pglite://" or is absent entirely.  Zero‑config, stores data in a local
 *    directory under SEACLIP_HOME.
 *
 * 2. **postgres‑js** — used when DATABASE_URL is a standard
 *    postgresql:// connection string.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@seaclip/db";
import { getLogger } from "./middleware/logger.js";
import fs from "node:fs";
import path from "node:path";

export type Db = ReturnType<typeof drizzlePglite<typeof schema>> | ReturnType<typeof drizzlePostgres<typeof schema>>;

let _db: Db | null = null;
let _pglite: PGlite | null = null;
let _sql: ReturnType<typeof postgres> | null = null;

export async function initDb(databaseUrl: string): Promise<Db> {
  if (_db) return _db;

  const logger = getLogger();

  if (!databaseUrl || databaseUrl.startsWith("pglite://")) {
    // ── PGlite (embedded) ──────────────────────────────────────────────
    const rawDir = databaseUrl ? databaseUrl.replace("pglite://", "") : "";
    const dataDir = rawDir || undefined; // empty string → in-memory

    // Ensure data directory exists for persistent mode
    if (dataDir) {
      const absDir = path.resolve(dataDir);
      fs.mkdirSync(absDir, { recursive: true });
    }

    logger.info({ dataDir: dataDir ?? "<in-memory>" }, "Starting PGlite embedded database");

    _pglite = new PGlite(dataDir);
    await _pglite.waitReady;

    _db = drizzlePglite(_pglite, { schema }) as unknown as Db;
  } else {
    // ── External PostgreSQL ────────────────────────────────────────────
    logger.info(
      { url: databaseUrl.replace(/:[^:@]*@/, ":***@") },
      "Connecting to external PostgreSQL",
    );

    _sql = postgres(databaseUrl, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    _db = drizzlePostgres(_sql, { schema }) as unknown as Db;
  }

  return _db;
}

export function getDb(): Db {
  if (!_db) {
    throw new Error(
      "Database not initialized. Call initDb() first during server startup.",
    );
  }
  return _db;
}

export function getPglite(): PGlite | null {
  return _pglite;
}

export async function closeDb(): Promise<void> {
  if (_pglite) {
    await _pglite.close();
    _pglite = null;
  }
  if (_sql) {
    await _sql.end();
    _sql = null;
  }
  _db = null;
}
