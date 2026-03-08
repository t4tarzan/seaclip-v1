/**
 * hub-federation service — hub registration, sync protocol, cross-hub task routing.
 */
import { randomUUID } from "node:crypto";
import { getDb } from "../db.js";
import { eq, asc, sql } from "drizzle-orm";
import { hubFederation } from "@seaclip/db";
import { notFound, conflict } from "../errors.js";
import { getLogger } from "../middleware/logger.js";

export type HubStatus = "active" | "inactive" | "unreachable" | "syncing";

export interface Hub {
  id: string;
  name: string;
  url: string;
  publicKey?: string;
  region?: string;
  capabilities: string[];
  status: HubStatus;
  lastSyncAt?: string;
  lastSyncSequence: number;
  metadata: Record<string, unknown>;
  registeredAt: string;
  updatedAt: string;
}

export interface SyncPayload {
  sourceHubId: string;
  sequenceNumber: number;
  timestamp: string;
  events: Array<{
    id: string;
    type: string;
    companyId?: string;
    payload: Record<string, unknown>;
    occurredAt: string;
  }>;
  checksum?: string;
}

export interface SyncResult {
  accepted: boolean;
  eventsProcessed: number;
  errors: string[];
  syncedAt: string;
}

export interface FederationStatus {
  localHubId: string;
  connectedHubs: number;
  totalHubs: number;
  lastSyncAt?: string;
  syncLag?: number;
  hubs: Array<{
    id: string;
    name: string;
    status: HubStatus;
    lastSyncAt?: string;
  }>;
  healthyAt: string;
}

const LOCAL_HUB_ID = process.env.LOCAL_HUB_ID ?? randomUUID();

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function rowToHub(row: typeof hubFederation.$inferSelect): Hub {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const capabilities = Array.isArray(meta.capabilities)
    ? (meta.capabilities as string[])
    : [];
  const lastSyncSequence =
    typeof meta.lastSyncSequence === "number" ? meta.lastSyncSequence : 0;

  return {
    id: row.hubId,
    name: row.name,
    url: row.url,
    publicKey: typeof meta.publicKey === "string" ? meta.publicKey : undefined,
    region: typeof meta.region === "string" ? meta.region : undefined,
    capabilities,
    status: (row.status as HubStatus) ?? "active",
    lastSyncAt: row.lastSyncAt?.toISOString(),
    lastSyncSequence,
    metadata: meta,
    registeredAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listHubs(): Promise<Hub[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(hubFederation)
    .orderBy(asc(hubFederation.createdAt));

  return rows.map(rowToHub);
}

export async function registerHub(input: {
  name: string;
  url: string;
  publicKey?: string;
  region?: string;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}): Promise<Hub> {
  const db = getDb();

  // Check URL uniqueness
  const [existing] = await db
    .select()
    .from(hubFederation)
    .where(eq(hubFederation.url, input.url));

  if (existing) {
    throw conflict(`A hub with URL "${input.url}" is already registered`);
  }

  const metadata: Record<string, unknown> = { ...(input.metadata ?? {}) };
  if (input.publicKey) metadata.publicKey = input.publicKey;
  if (input.region) metadata.region = input.region;
  metadata.capabilities = input.capabilities ?? [];
  metadata.lastSyncSequence = 0;

  const hubId = randomUUID();

  const [row] = await db
    .insert(hubFederation)
    .values({
      hubId,
      name: input.name,
      url: input.url,
      status: "active",
      metadata,
    })
    .returning();

  return rowToHub(row);
}

export async function getHub(id: string): Promise<Hub> {
  const db = getDb();

  const [row] = await db
    .select()
    .from(hubFederation)
    .where(eq(hubFederation.hubId, id));

  if (!row) throw notFound(`Hub "${id}" not found`);
  return rowToHub(row);
}

export async function receiveSyncPayload(
  payload: SyncPayload,
): Promise<SyncResult> {
  const logger = getLogger();
  const db = getDb();
  const errors: string[] = [];
  let eventsProcessed = 0;

  const [hubRow] = await db
    .select()
    .from(hubFederation)
    .where(eq(hubFederation.hubId, payload.sourceHubId));

  if (!hubRow) {
    logger.warn(
      { sourceHubId: payload.sourceHubId },
      "Received sync from unknown hub",
    );
  }

  // Retrieve last processed sequence from metadata
  const meta = hubRow
    ? ((hubRow.metadata ?? {}) as Record<string, unknown>)
    : {};
  const lastSeq =
    typeof meta.lastSyncSequence === "number" ? meta.lastSyncSequence : 0;

  if (payload.sequenceNumber <= lastSeq) {
    logger.warn(
      {
        sourceHubId: payload.sourceHubId,
        received: payload.sequenceNumber,
        lastProcessed: lastSeq,
      },
      "Dropping duplicate or out-of-order sync payload",
    );
    return {
      accepted: false,
      eventsProcessed: 0,
      errors: [
        `Sequence ${payload.sequenceNumber} already processed (last: ${lastSeq})`,
      ],
      syncedAt: new Date().toISOString(),
    };
  }

  // Process events
  for (const event of payload.events) {
    try {
      logger.debug(
        {
          eventId: event.id,
          eventType: event.type,
          companyId: event.companyId,
        },
        "Processing federated event",
      );
      eventsProcessed++;
    } catch (err) {
      errors.push(
        `Event ${event.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Persist updated sequence + lastSyncAt
  if (hubRow) {
    const now = new Date();
    const updatedMeta: Record<string, unknown> = {
      ...meta,
      lastSyncSequence: payload.sequenceNumber,
    };

    await db
      .update(hubFederation)
      .set({
        status: "active",
        lastSyncAt: now,
        updatedAt: now,
        metadata: updatedMeta,
      })
      .where(eq(hubFederation.hubId, payload.sourceHubId));
  }

  logger.info(
    {
      sourceHubId: payload.sourceHubId,
      eventsProcessed,
      errors: errors.length,
    },
    "Sync payload processed",
  );

  return {
    accepted: true,
    eventsProcessed,
    errors,
    syncedAt: new Date().toISOString(),
  };
}

export async function getFederationStatus(): Promise<FederationStatus> {
  const db = getDb();

  const rows = await db
    .select()
    .from(hubFederation)
    .orderBy(asc(hubFederation.createdAt));

  const hubs = rows.map(rowToHub);
  const connectedHubs = hubs.filter((h) => h.status === "active").length;

  const lastSyncTimes = hubs
    .filter((h) => h.lastSyncAt)
    .map((h) => new Date(h.lastSyncAt!).getTime());

  const lastSyncAt =
    lastSyncTimes.length > 0
      ? new Date(Math.max(...lastSyncTimes)).toISOString()
      : undefined;

  const syncLag = lastSyncAt
    ? Math.floor((Date.now() - new Date(lastSyncAt).getTime()) / 1000)
    : undefined;

  return {
    localHubId: LOCAL_HUB_ID,
    connectedHubs,
    totalHubs: hubs.length,
    lastSyncAt,
    syncLag,
    hubs: hubs.map((h) => ({
      id: h.id,
      name: h.name,
      status: h.status,
      lastSyncAt: h.lastSyncAt,
    })),
    healthyAt: new Date().toISOString(),
  };
}
