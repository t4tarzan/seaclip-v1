import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role").notNull().default("general"),
    title: text("title"),
    icon: text("icon"),
    status: text("status").notNull().default("idle"),
    reportsTo: uuid("reports_to"),
    capabilities: text("capabilities"),
    adapterType: text("adapter_type").notNull().default("process"),
    environment: text("environment").notNull().default("local"),
    adapterConfig: jsonb("adapter_config").notNull().default({}),
    runtimeConfig: jsonb("runtime_config").notNull().default({}),
    budgetMonthlyCents: integer("budget_monthly_cents").notNull().default(0),
    spentMonthlyCents: integer("spent_monthly_cents").notNull().default(0),
    permissions: jsonb("permissions").notNull().default({}),
    deviceType: text("device_type"),
    deviceMeta: jsonb("device_meta"),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("agents_company_status_idx").on(table.companyId, table.status),
    index("agents_company_reports_to_idx").on(table.companyId, table.reportsTo),
  ]
);
