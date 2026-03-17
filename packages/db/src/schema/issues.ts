import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { projects } from "./projects.js";
import { goals } from "./goals.js";

export const issues = pgTable(
  "issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    parentId: uuid("parent_id"),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("backlog"),
    priority: text("priority").notNull().default("medium"),
    assigneeAgentId: uuid("assignee_agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    assigneeUserId: text("assignee_user_id"),
    checkoutRunId: uuid("checkout_run_id"),
    executionRunId: uuid("execution_run_id"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    createdByUserId: text("created_by_user_id"),
    issueNumber: integer("issue_number").notNull(),
    identifier: text("identifier").notNull(),
    requestDepth: integer("request_depth").notNull().default(0),
    billingCode: text("billing_code"),
    githubIssueId: integer("github_issue_id"),
    githubRepoId: text("github_repo_id"),
    externalId: text("external_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("issues_company_status_idx").on(table.companyId, table.status),
    index("issues_company_assignee_status_idx").on(
      table.companyId,
      table.assigneeAgentId,
      table.status
    ),
    index("issues_company_parent_idx").on(table.companyId, table.parentId),
    index("issues_company_project_idx").on(table.companyId, table.projectId),
    uniqueIndex("issues_identifier_unique").on(table.identifier),
  ]
);
