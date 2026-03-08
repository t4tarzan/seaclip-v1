# CLAUDE.md — SeaClip Codebase Guide

This file is for **Claude Code** (and other AI coding agents) working on the SeaClip codebase. It supplements `AGENTS.md` with operational details. Read both files in full before making any changes.

---

## Project Overview

SeaClip is a **hub-spoke AI agent orchestration platform** for on-premises, privacy-first deployments. It manages a fleet of AI agents running on edge devices (Raspberry Pi, Jetson boards, phones, laptops) and coordinates their work through a central hub.

- **Monorepo:** pnpm workspaces (5 packages)
- **Runtime:** Node 20+ (ESM everywhere)
- **Package manager:** pnpm 9.x — never use npm or yarn
- **GitHub:** `t4tarzan/seaclip-v1`

---

## Commands

```bash
pnpm install                # Install all workspace deps
pnpm dev                    # Start server + UI in parallel (scripts/dev-runner.mjs)
pnpm dev:server             # Server only (tsx watch)
pnpm dev:ui                 # UI only (Vite dev server)
pnpm build                  # Full production build (all packages)
pnpm typecheck              # tsc --noEmit across all packages
pnpm test                   # Vitest (all tests)
pnpm test:run               # Vitest single run (no watch)
pnpm db:generate            # Generate Drizzle migration from schema changes
pnpm db:migrate             # Apply pending migrations
pnpm seaclip <command>      # Run CLI in dev mode (via tsx)
```

### Per-package commands

| Package | Dev | Build |
|---|---|---|
| `@seaclip/server` | `tsx watch src/index.ts` | `tsc` |
| `@seaclip/ui` | `vite` | `tsc && vite build` |
| `@seaclip/cli` | `tsx src/index.ts` | `esbuild` (bundled) |
| `@seaclip/db` | — | — (source exports) |
| `@seaclip/shared` | — | — (source exports) |

---

## Architecture

```
seaclip-v1/
├── cli/                    @seaclip/cli — Commander.js CLI
│   └── src/
│       ├── index.ts            Entry point
│       ├── commands/           agent, company, configure, db-backup, device, doctor, hub, onboard, run
│       ├── config/             store.ts (persistent config), env.ts
│       └── checks/             database, ollama, port, storage, telegram health checks
├── server/                 @seaclip/server — Express 5 API
│   └── src/
│       ├── index.ts            Server bootstrap (config → DB → Express → WS → scheduler)
│       ├── app.ts              Express app factory (CORS, routes, error handler)
│       ├── config.ts           Env-based config singleton
│       ├── db.ts               Database singleton (PGlite or external PostgreSQL)
│       ├── db-push.ts          Schema push on startup
│       ├── errors.ts           Typed error classes (AppError, NotFoundError, etc.)
│       ├── routes/             Express routers (13 route files)
│       ├── services/           Business logic (16 service files)
│       ├── adapters/           Agent adapter implementations + registry
│       ├── middleware/         Request logger, error handler, auth
│       └── realtime/          WebSocket server for live events
├── ui/                     @seaclip/ui — React 19 + Vite 6
│   └── src/
│       ├── main.tsx            App entry
│       ├── App.tsx             Router setup
│       ├── pages/              Dashboard, Agents, AgentDetail, Issues, IssueDetail,
│       │                       Approvals, Costs, Activity, EdgeMesh, Settings, SpokeView
│       ├── components/         Layout, MetricCard, StatusBadge, AgentConfigForm, etc.
│       ├── context/            CompanyContext, ThemeContext
│       ├── api/                Typed fetch clients (one per domain)
│       └── lib/                types.ts, utils.ts
├── packages/
│   ├── db/                 @seaclip/db — Drizzle ORM schema + migrations
│   ├── shared/             @seaclip/shared — Shared Zod schemas and TS types
│   └── adapter-utils/      @seaclip/adapter-utils — Shared adapter helpers
├── doc/                    Protocol and architecture docs
│   ├── ARCHITECTURE.md         Stack overview and request flow
│   ├── ADAPTERS.md             Per-adapter documentation
│   ├── EDGE-MESH.md            Device registration, telemetry, health scoring, auto-reassignment
│   └── HUB-FEDERATION.md       Hub registration, sync protocol, cross-hub task routing, conflict resolution
├── scripts/                Dev runner, DB backup utilities
├── skills/                 Agent skill files (not for the web app)
├── AGENTS.md               Coding standards reference (also used as Windsurf user rules)
├── STRATEGY.md             SeaClip v2 strategic roadmap
└── CLAUDE.md               This file
```

### Workspace packages

| Package | Name | Purpose |
|---|---|---|
| `cli/` | `@seaclip/cli` | CLI tool (Commander.js + chalk + ora + inquirer) |
| `server/` | `@seaclip/server` | Express 5 API + WebSocket + heartbeat scheduler |
| `ui/` | `@seaclip/ui` | React 19 dashboard (Vite, TailwindCSS 4, Radix UI, TanStack Query) |
| `packages/db/` | `@seaclip/db` | Drizzle ORM schema (source of truth for all entities) |
| `packages/shared/` | `@seaclip/shared` | Shared TypeScript types and Zod schemas |
| `packages/adapter-utils/` | `@seaclip/adapter-utils` | Shared adapter utility functions |

---

## Server Startup Sequence

The server boots in this order (`server/src/index.ts`):

1. `loadConfig()` — parse environment variables into typed `Config`
2. `initDb(databaseUrl)` — connect PGlite (embedded) or external PostgreSQL
3. `pushSchema(db)` — create/update tables via Drizzle schema push
4. `createApp()` — build Express app with all routes and middleware
5. `http.createServer(app)` — create HTTP server
6. `createLiveEventsWsServer(httpServer)` — attach WebSocket upgrade handler
7. `httpServer.listen()` — start listening (default `:3001`)
8. `startHeartbeatScheduler()` — periodic agent heartbeat invocation (default 30s)
9. Graceful shutdown on `SIGTERM`/`SIGINT` — stops scheduler, closes HTTP, closes DB

---

## Database

- **Schema source of truth:** `packages/db/` (Drizzle ORM)
- **Two backends:** PGlite (embedded, zero-config) or external PostgreSQL
  - `DATABASE_URL` absent or `pglite://...` → PGlite (data in `.seaclip/data/`)
  - `DATABASE_URL=postgresql://...` → external PostgreSQL
- **Schema changes:** edit schema in `@seaclip/db`, then:
  ```bash
  pnpm db:generate   # Generate migration
  pnpm db:migrate    # Apply migration
  ```
- Never write raw SQL — use Drizzle's query builder
- Use transactions for any multi-table write
- In-memory PGlite (no `dataDir`) is used in tests

---

## Environment Variables

All config is loaded in `server/src/config.ts`. Key variables:

| Variable | Default | Description |
|---|---|---|
| `DEPLOYMENT_MODE` | `local_trusted` | `local_trusted` or `authenticated` |
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `3001` | Server port |
| `DATABASE_URL` | `pglite://.seaclip/data` | PGlite path or `postgresql://` URL |
| `SERVE_UI` | `false` | Serve built UI from `ui/dist/` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `TELEGRAM_BOT_TOKEN` | (empty) | Telegram bridge bot token |
| `HEARTBEAT_SCHEDULER_ENABLED` | `true` | Enable periodic heartbeats |
| `HEARTBEAT_SCHEDULER_INTERVAL_MS` | `30000` | Heartbeat interval |
| `SEACLIP_HOME` | `~/.seaclip` | Data/config home directory |
| `JWT_SECRET` | dev default | JWT signing secret (change in production) |
| `API_KEY_HASH` | (empty) | Pre-hashed API key for spoke auth |
| `CORS_ORIGINS` | `localhost:3000,localhost:5173` | Comma-separated allowed origins |
| `LOG_LEVEL` | `info` | Pino log level |
| `NODE_ENV` | `development` | Node environment |

---

## Adapters

Seven adapter types are registered in `server/src/adapters/registry.ts`:

| Adapter | Key | Protocol | Description |
|---|---|---|---|
| SeaClaw Edge | `seaclaw` | HTTP + custom headers | C11 edge binary on Raspberry Pi / Jetson |
| Ollama Local | `ollama_local` | HTTP (Ollama API) | Local LLM via Ollama |
| Agent Zero | `agent_zero` | HTTP | Agent Zero framework integration |
| Telegram Bridge | `telegram_bridge` | Telegram Bot API | Human-in-the-loop via Telegram |
| Process | `process` | Child process (stdin/stdout) | Spawn a local command as an agent |
| HTTP | `http` | Generic HTTP | Any HTTP-callable agent endpoint |
| Claude Code | `claude_code` | HTTP (Anthropic API) | Claude as an agent backend |

### Adding or modifying adapters

1. Read `doc/ADAPTERS.md` and `skills/create-agent-adapter/SKILL.md`
2. Implement `AgentAdapter` interface from `server/src/adapters/types.ts`
3. Add Zod config schema in `server/src/adapters/schemas.ts`
4. Register in `server/src/adapters/registry.ts`
5. Write tests in `server/src/adapters/__tests__/`

### Adapter interface

Every adapter module exports: `execute(ctx)`, `testEnvironment(ctx)`, `listModels()`, and metadata (`name`, `adapterType`, `description`, `configSchema`). See `server/src/adapters/types.ts` for the full `ServerAdapterModule` type.

---

## API Routes

All routes are mounted in `server/src/app.ts`:

| Mount | Router file | Purpose |
|---|---|---|
| `/health`, `/api/health` | `health.ts` | Health check |
| `/api/companies` | `companies.ts` | Company CRUD |
| `/api/companies/:id/agents` | `agents.ts` | Agent CRUD per company |
| `/api/companies/:id/issues` | `issues.ts` | Issue management |
| `/api/companies/:id/projects` | `projects.ts` | Project management |
| `/api/companies/:id/goals` | `goals.ts` | Goal tracking |
| `/api/companies/:id/approvals` | `approvals.ts` | Approval workflows |
| `/api/companies/:id/costs` | `costs.ts` | Cost tracking |
| `/api/companies/:id/dashboard` | `dashboard.ts` | Dashboard aggregations |
| `/api/companies/:id/activity` | `activity.ts` | Activity feed |
| `/api/companies/:id/devices` | `edge-devices.ts` | Edge device + mesh topology |
| `/api/federation` | `hub-federation.ts` | Hub-to-hub federation |
| `/api/spoke` | `spoke.ts` | Spoke device endpoints (no auth) |

### API response format

- Success: `{ data: T }`
- Error: `{ error: string, code: string }`
- IDs are always UUIDs (string). Never expose numeric IDs.
- Timestamps are ISO 8601 strings.
- Pagination uses `limit` + `cursor` (not `offset`).

---

## Error Handling

Typed error classes in `server/src/errors.ts`:

- `AppError(status, message)` — base class
- `NotFoundError` (404), `UnauthorizedError` (401), `ForbiddenError` (403)
- `ConflictError` (409), `UnprocessableError` (422)
- Helper factories: `notFound()`, `conflict()`, `unprocessable()`, `forbidden()`, `unauthorized()`

Service functions throw typed errors. Route handlers catch them. The Express `errorHandler` middleware maps `AppError.status` to HTTP status codes.

---

## Heartbeat Lifecycle

The core execution loop (`server/src/services/heartbeat.ts`):

1. Scheduler ticks every `HEARTBEAT_SCHEDULER_INTERVAL_MS`
2. For each active agent, calls the adapter's `execute()` function
3. Adapter communicates with the agent backend (HTTP, process, etc.)
4. Result is recorded as a `heartbeat_run` with status, duration, output
5. Environment routing guards prevent "local" agents from hitting external HTTP endpoints
6. Results are broadcast via WebSocket to connected dashboard clients

---

## Edge Mesh Protocol

Documented in `doc/EDGE-MESH.md`. Key concepts:

- **Device registration:** `POST /api/companies/:id/devices` → registration token
- **Telemetry reporting:** `POST /api/devices/telemetry` at 10–30s intervals
- **Health scoring:** 0–100 scale based on CPU, RAM, temperature, missed heartbeats
- **Auto-reassignment:** when a device goes offline/unhealthy, in-progress issues are reassigned to healthy agents of the same adapter type
- **Topology visualization:** `GET /api/companies/:id/mesh/topology` returns nodes + edges for the force-directed graph

Do not change the telemetry payload shape without updating `doc/EDGE-MESH.md`.

---

## Hub Federation Protocol

Documented in `doc/HUB-FEDERATION.md`. Key concepts:

- **Hub registration + handshake:** mutual identity exchange with public keys
- **Sync protocol:** event-driven + periodic reconciliation (every 5 min)
- **Cross-hub task routing:** create issue locally, set `assigneeHubId` to route to remote hub
- **Conflict resolution:** last-writer-wins on `updatedAt`, tombstones retained 30 days
- **Sync protocol versioning:** increment `syncProtocolVersion` in `shared/src/constants/federation.ts` for breaking changes

Do not change sync event shapes without updating `doc/HUB-FEDERATION.md`.

---

## UI Stack

- **React 19** with `react-router-dom` v7
- **Vite 6** dev server and build
- **TailwindCSS 4** (via `@tailwindcss/vite` plugin)
- **Radix UI** primitives (Dialog, DropdownMenu, Select, Tabs, Tooltip)
- **TanStack Query** (React Query v5) for data fetching
- **Lucide React** for icons
- **clsx + tailwind-merge** for className composition

API clients in `ui/src/api/` use typed fetch wrappers from `ui/src/api/client.ts`.

---

## CLI

Entry point: `cli/src/index.ts` (Commander.js)

Commands: `agent`, `company`, `configure`, `db-backup`, `device`, `doctor`, `hub`, `onboard`, `run`

Health checks: `database-check`, `ollama-check`, `port-check`, `storage-check`, `telegram-check`

Rules:
- Use `ora` spinners for async operations, `chalk` for colored output
- Destructive operations require `--confirm` flag or interactive prompt
- CLI communicates via HTTP to the running server — never import from `server/` directly

---

## Testing

- **Unit tests:** Vitest. Files named `*.test.ts`
- **Integration tests:** Vitest with a real SQLite/PGlite database. Files named `*.integration.test.ts`
- **E2E tests:** Playwright. Located in `ui/tests/`
- Do not mock the database in integration tests — use a real in-memory PGlite instance
- Mock external HTTP calls (Ollama, Telegram) with `msw` (Mock Service Worker)

```bash
pnpm test          # Watch mode
pnpm test:run      # Single run
```

---

## Coding Conventions

### TypeScript

- Strict mode enabled. All `any` must be justified with a comment.
- Prefer `unknown` over `any` for external data. Narrow with Zod or type guards.
- No `!` non-null assertions without a preceding null check.
- Use `satisfies` instead of type assertions where possible.

### Imports

- ESM only (`import`/`export`). No CommonJS.
- Internal packages: `@seaclip/<package>` (e.g., `@seaclip/db`, `@seaclip/shared`).
- Explicit file extensions in relative imports: `./foo.js` (not `./foo`).

### Naming

| Thing | Convention | Example |
|---|---|---|
| Files | kebab-case | `agent-service.ts` |
| Classes | PascalCase | `OllamaAdapter` |
| Functions | camelCase | `buildEnvFromConfig` |
| Constants | SCREAMING_SNAKE | `MAX_RETRIES` |
| DB tables | snake_case | `heartbeat_runs` |
| API routes | kebab-case | `/api/companies/:id/agents` |

### Commit messages

Use conventional commits: `feat:`, `fix:`, `docs:`, `ci:`, `chore:`, `refactor:`, `test:`

---

## Key Files to Read First

If unfamiliar with this codebase, start here:

1. `doc/ARCHITECTURE.md` — stack overview and request flow
2. `packages/db/` — Drizzle schema (all entities and their fields)
3. `server/src/adapters/types.ts` — the `AgentAdapter` interface
4. `server/src/config.ts` — all environment variables and their defaults
5. `server/src/app.ts` — route mounting and middleware order
6. `server/src/services/heartbeat.ts` — core agent execution loop
7. `skills/seaclip/SKILL.md` — how agents use the API
8. `cli/src/index.ts` — all CLI commands

---

## Pull Request Checklist

- [ ] `pnpm typecheck` passes with no errors
- [ ] `pnpm test:run` passes
- [ ] New public functions have JSDoc comments
- [ ] Database changes include a migration (`pnpm db:generate`)
- [ ] Protocol changes are reflected in the relevant `doc/` file
- [ ] `CHANGELOG.md` has an entry

---

## Do Not

- Do not run `npm install` or `yarn` — use `pnpm`
- Do not commit `.env` files or secrets
- Do not add new dependencies without checking lighter alternatives in the workspace
- Do not modify `pnpm-lock.yaml` manually
- Do not create files outside the established directory structure without good reason
- Do not silently swallow errors — log or rethrow
- Do not write raw SQL — use Drizzle query builder
- Do not change telemetry/sync payload shapes without updating `doc/EDGE-MESH.md` or `doc/HUB-FEDERATION.md`
- Do not import from `server/` in CLI code — communicate via HTTP
- Do not expose numeric auto-increment IDs — always use UUIDs
