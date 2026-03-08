/**
 * secrets service — secret storage/retrieval using Drizzle ORM against the
 * `company_secrets` table.
 *
 * Encryption strategy: values are stored as base64-encoded strings in the
 * `encryptedValue` column. Real AES-256-GCM encryption can be layered in later
 * by swapping encode/decode helpers without changing any function signatures.
 *
 * Public interface mirrors the original SecretEntry shape. The `value` field
 * is the decoded (plaintext) value returned by getSecret; setSecret accepts
 * the plaintext and stores it encoded.
 *
 * setSecret performs an upsert: insert or update on (companyId, key) conflict,
 * incrementing the version counter on update.
 */
import { getDb } from "../db.js";
import { eq, and, asc } from "drizzle-orm";
import { companySecrets as secretsTable } from "@seaclip/db";
import { notFound } from "../errors.js";

export interface SecretEntry {
  id: string;
  companyId: string;
  key: string;
  /** Decoded/plaintext value — only populated by getSecret */
  value: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Encoding helpers (base64 — swap for real encryption when ready)
// ---------------------------------------------------------------------------

function encode(plaintext: string): string {
  return Buffer.from(plaintext, "utf8").toString("base64");
}

function decode(encoded: string): string {
  return Buffer.from(encoded, "base64").toString("utf8");
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

type SecretRow = typeof secretsTable.$inferSelect;

function rowToEntry(row: SecretRow, decodedValue: string): SecretEntry {
  return {
    id: row.id,
    companyId: row.companyId,
    key: row.key,
    value: decodedValue,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Upsert a secret. If a secret with the given key already exists for the company,
 * it is updated (version incremented). Otherwise a new row is inserted.
 */
export async function setSecret(
  companyId: string,
  key: string,
  value: string,
): Promise<void> {
  const db = getDb();
  const encoded = encode(value);

  // Check for existing row
  const [existing] = await db
    .select()
    .from(secretsTable)
    .where(and(eq(secretsTable.companyId, companyId), eq(secretsTable.key, key)));

  if (existing) {
    await db
      .update(secretsTable)
      .set({
        encryptedValue: encoded,
        version: existing.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(secretsTable.id, existing.id));
  } else {
    await db
      .insert(secretsTable)
      .values({
        companyId,
        key,
        encryptedValue: encoded,
        version: 1,
      });
  }
}

/**
 * Retrieve and decode a secret value. Throws NotFoundError if not found.
 */
export async function getSecret(
  companyId: string,
  key: string,
): Promise<string> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(secretsTable)
    .where(and(eq(secretsTable.companyId, companyId), eq(secretsTable.key, key)));

  if (!row) {
    throw notFound(`Secret "${key}" not found for company "${companyId}"`);
  }

  return decode(row.encryptedValue);
}

/**
 * Delete a secret. Throws NotFoundError if not found.
 */
export async function deleteSecret(
  companyId: string,
  key: string,
): Promise<void> {
  const db = getDb();
  const [existing] = await db
    .select({ id: secretsTable.id })
    .from(secretsTable)
    .where(and(eq(secretsTable.companyId, companyId), eq(secretsTable.key, key)));

  if (!existing) {
    throw notFound(`Secret "${key}" not found`);
  }

  await db
    .delete(secretsTable)
    .where(eq(secretsTable.id, existing.id));
}

/**
 * List all secret keys for a company (values are not returned).
 */
export async function listSecretKeys(companyId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ key: secretsTable.key })
    .from(secretsTable)
    .where(eq(secretsTable.companyId, companyId))
    .orderBy(asc(secretsTable.key));

  return rows.map((r) => r.key);
}
