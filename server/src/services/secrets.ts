/**
 * secrets service — secret storage/retrieval using Drizzle ORM against the
 * `company_secrets` table.
 *
 * Encryption strategy: values are encrypted with AES-256-GCM using a key
 * derived from the JWT secret via scrypt before being stored in the
 * `encryptedValue` column.
 *
 * Public interface mirrors the original SecretEntry shape. The `value` field
 * is the decrypted (plaintext) value returned by getSecret; setSecret accepts
 * the plaintext and stores it encrypted.
 *
 * setSecret performs an upsert: insert or update on (companyId, key) conflict,
 * incrementing the version counter on update.
 */
import { getDb } from "../db.js";
import { eq, and, asc } from "drizzle-orm";
import { companySecrets as secretsTable } from "@seaclip/db";
import { notFound } from "../errors.js";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { getConfig } from "../config.js";

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
// AES-256-GCM encryption helpers
// ---------------------------------------------------------------------------

const ALGORITHM = "aes-256-gcm";
const KEY_LEN = 32;

function deriveKey(masterSecret: string): Buffer {
  return scryptSync(masterSecret, "seaclip-secrets-salt", KEY_LEN);
}

function encrypt(plaintext: string): string {
  const config = getConfig();
  const key = deriveKey(config.jwtSecret);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv.encrypted.authTag (all base64)
  return `${iv.toString("base64")}.${encrypted.toString("base64")}.${authTag.toString("base64")}`;
}

function decrypt(stored: string): string {
  const config = getConfig();
  const key = deriveKey(config.jwtSecret);
  const parts = stored.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted secret");
  }
  const [ivB64, encB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const encrypted = Buffer.from(encB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
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
  const encoded = encrypt(value);

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

  return decrypt(row.encryptedValue);
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
