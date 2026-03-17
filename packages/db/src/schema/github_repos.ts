import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const githubRepos = pgTable(
  "github_repos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    repoFullName: text("repo_full_name").notNull(),
    githubRepoId: integer("github_repo_id").notNull(),
    defaultBranch: text("default_branch").notNull().default("main"),
    webhookId: integer("webhook_id"),
    installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("github_repos_github_repo_id_unique").on(table.githubRepoId),
  ],
);
