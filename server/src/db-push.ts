/**
 * Push Drizzle schema to the database — creates tables if they don't exist.
 * Called once during server startup.
 *
 * DDL is generated directly from the Drizzle schema definitions to stay in sync.
 */
import type { Db } from "./db.js";
import { getPglite } from "./db.js";
import { getLogger } from "./middleware/logger.js";

/**
 * DDL derived from packages/db/src/schema/*.ts
 * Must match the Drizzle table definitions exactly.
 */
const DDL = `

-- 1. companies (no FK deps)
CREATE TABLE IF NOT EXISTS companies (
  id                                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                                 TEXT NOT NULL,
  description                          TEXT,
  status                               TEXT NOT NULL DEFAULT 'active',
  issue_prefix                         TEXT NOT NULL DEFAULT 'SC',
  issue_counter                        INT  NOT NULL DEFAULT 0,
  budget_monthly_cents                  INT  NOT NULL DEFAULT 0,
  spent_monthly_cents                   INT  NOT NULL DEFAULT 0,
  require_board_approval_for_new_agents BOOLEAN NOT NULL DEFAULT true,
  brand_color                          TEXT,
  hub_id                               TEXT,
  created_at                           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. hub_federation (no FK deps)
CREATE TABLE IF NOT EXISTS hub_federation (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id        TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  url           TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  last_sync_at  TIMESTAMPTZ,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. agents (FK → companies)
CREATE TABLE IF NOT EXISTS agents (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  role                 TEXT NOT NULL DEFAULT 'general',
  title                TEXT,
  icon                 TEXT,
  status               TEXT NOT NULL DEFAULT 'idle',
  reports_to           UUID,
  capabilities         TEXT,
  adapter_type         TEXT NOT NULL DEFAULT 'process',
  environment          TEXT NOT NULL DEFAULT 'local',
  adapter_config       JSONB NOT NULL DEFAULT '{}',
  runtime_config       JSONB NOT NULL DEFAULT '{}',
  budget_monthly_cents INT  NOT NULL DEFAULT 0,
  spent_monthly_cents  INT  NOT NULL DEFAULT 0,
  permissions          JSONB NOT NULL DEFAULT '{}',
  device_type          TEXT,
  device_meta          JSONB,
  last_heartbeat_at    TIMESTAMPTZ,
  metadata             JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. projects (FK → companies)
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  archived    BOOLEAN NOT NULL DEFAULT false,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. goals (FK → companies)
CREATE TABLE IF NOT EXISTS goals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  parent_id   UUID,
  status      TEXT NOT NULL DEFAULT 'active',
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. issues (FK → companies, projects, goals, agents)
CREATE TABLE IF NOT EXISTS issues (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
  goal_id             UUID REFERENCES goals(id) ON DELETE SET NULL,
  parent_id           UUID,
  title               TEXT NOT NULL,
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'backlog',
  priority            TEXT NOT NULL DEFAULT 'medium',
  assignee_agent_id   UUID REFERENCES agents(id) ON DELETE SET NULL,
  assignee_user_id    TEXT,
  checkout_run_id     UUID,
  execution_run_id    UUID,
  created_by_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  created_by_user_id  TEXT,
  issue_number        INT  NOT NULL,
  identifier          TEXT NOT NULL UNIQUE,
  request_depth       INT  NOT NULL DEFAULT 0,
  billing_code        TEXT,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. issue_comments (FK → issues, agents)
CREATE TABLE IF NOT EXISTS issue_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id        UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  author_user_id  TEXT,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. heartbeat_runs (FK → companies, agents)
CREATE TABLE IF NOT EXISTS heartbeat_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  source          TEXT,
  trigger_detail  TEXT,
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  adapter_type    TEXT,
  issue_id        UUID,
  excerpt         TEXT,
  cost_cents      INT  NOT NULL DEFAULT 0,
  token_count     INT  NOT NULL DEFAULT 0,
  session_params  JSONB,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. heartbeat_run_events (FK → heartbeat_runs)
CREATE TABLE IF NOT EXISTS heartbeat_run_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      UUID NOT NULL REFERENCES heartbeat_runs(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. cost_events (FK → companies, agents, heartbeat_runs)
CREATE TABLE IF NOT EXISTS cost_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  run_id      UUID REFERENCES heartbeat_runs(id) ON DELETE SET NULL,
  cost_cents  INT  NOT NULL,
  token_count INT  NOT NULL,
  model       TEXT,
  provider    TEXT,
  detail      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. approvals (FK → companies, agents)
CREATE TABLE IF NOT EXISTS approvals (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type                   TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'pending',
  requested_by_agent_id  UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  request_payload        JSONB,
  resolution             TEXT,
  resolved_by_user_id    TEXT,
  resolved_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. activity_log (FK → companies)
CREATE TABLE IF NOT EXISTS activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_type  TEXT NOT NULL,
  actor_id    TEXT NOT NULL,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  detail      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. agent_runtime_state (FK → agents)
CREATE TABLE IF NOT EXISTS agent_runtime_state (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id   UUID NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
  state      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. agent_task_sessions (FK → agents, issues)
CREATE TABLE IF NOT EXISTS agent_task_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id       UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  issue_id       UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  session_params JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, issue_id)
);

-- 15. company_secrets (FK → companies)
CREATE TABLE IF NOT EXISTS company_secrets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  key             TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  version         INT  NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, key)
);

-- 16. edge_devices (FK → companies, agents)
CREATE TABLE IF NOT EXISTS edge_devices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id         UUID REFERENCES agents(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  device_type      TEXT NOT NULL,
  hostname         TEXT,
  ip_address       TEXT,
  tailscale_ip     TEXT,
  status           TEXT NOT NULL DEFAULT 'offline',
  cpu_usage        REAL,
  memory_usage_mb  INT,
  gpu_usage_pct    REAL,
  disk_usage_pct   REAL,
  temperature      REAL,
  last_ping_at     TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,
  capabilities     JSONB,
  metadata         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 17. enhancements (internal task tracking for development)
CREATE TABLE IF NOT EXISTS enhancements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   UUID REFERENCES enhancements(id) ON DELETE CASCADE,
  phase       TEXT NOT NULL,
  category    TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  priority    INT  NOT NULL DEFAULT 50,
  sort_order  INT  NOT NULL DEFAULT 0,
  files       JSONB NOT NULL DEFAULT '[]',
  tests       JSONB NOT NULL DEFAULT '[]',
  depends_on  JSONB NOT NULL DEFAULT '[]',
  notes       TEXT,
  code_generated BOOLEAN NOT NULL DEFAULT FALSE,
  code_tested    BOOLEAN NOT NULL DEFAULT FALSE,
  started_at  TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 18. spoke_tasks (hub-to-spoke task assignment with git workflow)
CREATE TABLE IF NOT EXISTS spoke_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_id       UUID NOT NULL REFERENCES edge_devices(id) ON DELETE CASCADE,
  issue_id        UUID REFERENCES issues(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  repo_url        TEXT NOT NULL,
  branch          TEXT,
  worktree_path   TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 19. pull_requests (PR tracking from spokes)
CREATE TABLE IF NOT EXISTS pull_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  spoke_task_id   UUID NOT NULL REFERENCES spoke_tasks(id) ON DELETE CASCADE,
  device_id       UUID NOT NULL REFERENCES edge_devices(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  source_branch   TEXT NOT NULL,
  target_branch   TEXT NOT NULL DEFAULT 'main',
  status          TEXT NOT NULL DEFAULT 'open',
  review_status   TEXT NOT NULL DEFAULT 'pending',
  diff_stat       JSONB,
  reviewed_by     TEXT,
  reviewed_at     TIMESTAMPTZ,
  merged_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS enhancements_status_idx ON enhancements(status);
CREATE INDEX IF NOT EXISTS enhancements_parent_idx ON enhancements(parent_id);
CREATE INDEX IF NOT EXISTS enhancements_phase_idx ON enhancements(phase);
CREATE INDEX IF NOT EXISTS spoke_tasks_company_device_idx ON spoke_tasks(company_id, device_id);
CREATE INDEX IF NOT EXISTS spoke_tasks_status_idx ON spoke_tasks(status);
CREATE INDEX IF NOT EXISTS pull_requests_company_status_idx ON pull_requests(company_id, status);
CREATE INDEX IF NOT EXISTS pull_requests_spoke_task_idx ON pull_requests(spoke_task_id);
CREATE INDEX IF NOT EXISTS agents_company_status_idx ON agents(company_id, status);
CREATE INDEX IF NOT EXISTS agents_company_reports_to_idx ON agents(company_id, reports_to);
CREATE INDEX IF NOT EXISTS issues_company_status_idx ON issues(company_id, status);
CREATE INDEX IF NOT EXISTS issues_company_assignee_status_idx ON issues(company_id, assignee_agent_id, status);
CREATE INDEX IF NOT EXISTS issues_company_parent_idx ON issues(company_id, parent_id);
CREATE INDEX IF NOT EXISTS issues_company_project_idx ON issues(company_id, project_id);
CREATE INDEX IF NOT EXISTS edge_devices_company_status_idx ON edge_devices(company_id, status);
CREATE INDEX IF NOT EXISTS idx_heartbeat_runs_agent ON heartbeat_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_heartbeat_runs_company ON heartbeat_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_cost_events_company ON cost_events(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_company ON activity_log(company_id);
`;

export async function pushSchema(db: Db): Promise<void> {
  const logger = getLogger();
  logger.info("Pushing database schema (CREATE TABLE IF NOT EXISTS)...");

  const pglite = getPglite();

  if (pglite) {
    // PGlite — use its native exec() for multi-statement SQL
    await pglite.exec(DDL);
  } else {
    // postgres-js — use the raw sql connection for multi-statement DDL
    const { getSql } = await import("./db.js");
    const sqlConn = getSql();
    if (!sqlConn) throw new Error("No postgres-js connection available");
    await sqlConn.unsafe(DDL);
  }

  logger.info("Database schema ready.");
}
