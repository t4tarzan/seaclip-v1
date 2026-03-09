#!/usr/bin/env bash
# ============================================================================
# SeaClip Agent Team Dispatcher
# Launches parallel Claude Code agents in tmux windows, each with a focused task.
#
# Usage: bash scripts/dispatch-agents.sh
# Prerequisites: tmux session "hub" running, claude CLI available
# ============================================================================

set -euo pipefail

SESSION="hub"
WORKDIR="/Users/whitenoise-oc/shrirama/seaclip-v1"
API="http://localhost:3001/api/enhancements"

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo -e "${CYAN}  SeaClip Agent Team Dispatcher${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo ""

# Check server is running
if ! curl -s "$API/stats" > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠ Server not running. Starting...${NC}"
  tmux send-keys -t "$SESSION:services" "cd $WORKDIR && pnpm dev:server" Enter
  sleep 5
  if ! curl -s "$API/stats" > /dev/null 2>&1; then
    echo "❌ Server failed to start. Run 'pnpm dev:server' first."
    exit 1
  fi
fi

echo -e "${GREEN}✓ Server running${NC}"
echo ""

# Show current stats
echo "Enhancement stats:"
curl -s "$API/stats" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f\"  Total: {d['total']}  Done: {d['byStatus'].get('done',0)}  Pending: {d['byStatus'].get('pending',0)}  In Progress: {d['byStatus'].get('in_progress',0)}\")
for phase, count in sorted(d['byPhase'].items()):
    print(f'  {phase}: {count}')
"
echo ""

# ────────────────────────────────────────────────────────────────────
# Agent definitions: name, phase-filter, prompt
# ────────────────────────────────────────────────────────────────────

dispatch_agent() {
  local WINDOW_NAME="$1"
  local PROMPT="$2"

  echo -e "${CYAN}Dispatching: ${WINDOW_NAME}${NC}"

  # Create tmux window if it doesn't exist
  if tmux list-windows -t "$SESSION" -F '#{window_name}' | grep -q "^${WINDOW_NAME}$"; then
    echo "  Window '$WINDOW_NAME' already exists — skipping (kill it first to re-dispatch)"
    return
  fi

  tmux new-window -t "$SESSION" -n "$WINDOW_NAME" -c "$WORKDIR"
  sleep 0.5

  # Write prompt to a temp file (avoids shell escaping issues)
  local PROMPT_FILE="/tmp/seaclip-agent-${WINDOW_NAME}.md"
  echo "$PROMPT" > "$PROMPT_FILE"

  # Launch claude with --dangerously-skip-permissions to avoid interactive trust prompt in tmux
  tmux send-keys -t "$SESSION:$WINDOW_NAME" "cd $WORKDIR && claude --dangerously-skip-permissions -p \"\$(cat $PROMPT_FILE)\"" Enter

  echo -e "  ${GREEN}✓ Launched in tmux window: $WINDOW_NAME${NC}"
}

# ════════════════════════════════════════════════════════════════════
# AGENT 1: Kanban Board (P2)
# ════════════════════════════════════════════════════════════════════

KANBAN_PROMPT='You are working on the SeaClip project at /Users/whitenoise-oc/shrirama/seaclip-v1

Your task: Build the KanbanBoard component for the Issues page.

## Context
- SeaClip is forked from Paperclip (cloned at /tmp/paperclip for reference)
- Paperclip has a working KanbanBoard at /tmp/paperclip/ui/src/components/KanbanBoard.tsx — USE IT AS REFERENCE
- SeaClip uses TailwindCSS 4 with dark theme (bg-[#0a0f1a], text-[#f9fafb], borders #374151)
- UI uses React 19, react-router-dom, TanStack Query, lucide-react icons

## Steps
1. Install dnd-kit: run `pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities --filter @seaclip/ui`
2. Create `ui/src/components/PriorityIcon.tsx` — colored icon per priority (urgent=red, high=orange, medium=yellow, low=gray)
3. Create `ui/src/components/StatusIcon.tsx` — colored dot/icon per issue status
4. Create `ui/src/components/KanbanBoard.tsx` — port from Paperclip but adapt to SeaClip dark theme colors:
   - Columns: backlog, todo, in_progress, in_review, done
   - Draggable cards with identifier, title, priority icon, assignee
   - onUpdateIssue callback when card is dropped to new column
   - Use SeaClip colors: primary #20808D, cyan #06b6d4, bg-card #1f2937
5. Update `ui/src/pages/Issues.tsx` — add a toggle (List | Board) in the header. Board view uses KanbanBoard, List view keeps current table. Store preference in localStorage.
6. Run `pnpm --filter @seaclip/ui build` to verify no errors

## Files to read first
- /tmp/paperclip/ui/src/components/KanbanBoard.tsx (reference)
- ui/src/pages/Issues.tsx (current implementation)
- ui/src/lib/types.ts (Issue type)
- ui/src/api/issues.ts (data hooks)
- ui/src/components/StatusBadge.tsx (existing styling patterns)

## Update enhancements DB when done
After building, mark tasks as done:
```
curl -X PATCH http://localhost:3001/api/enhancements/<id> -H "Content-Type: application/json" -d "{\"status\":\"done\"}"
```
Get the IDs: `curl -s "http://localhost:3001/api/enhancements?phase=P2-kanban" | python3 -m json.tool`

DO NOT modify Layout.tsx, App.tsx, or any server files. Only work on ui/src/components/ and ui/src/pages/Issues.tsx.'

# ════════════════════════════════════════════════════════════════════
# AGENT 2: Spoke Services (P3 backend)
# ════════════════════════════════════════════════════════════════════

SPOKE_SVC_PROMPT='You are working on the SeaClip project at /Users/whitenoise-oc/shrirama/seaclip-v1

Your task: Build the spoke-tasks and pull-requests backend services + API routes.

## Context
- SeaClip is a hub-spoke AI agent orchestration platform
- Tables `spoke_tasks` and `pull_requests` already exist in the DB (see server/src/db-push.ts)
- Follow the same patterns as existing services (server/src/services/issues.ts, server/src/services/edge-devices.ts)
- Follow the same route patterns as existing routes (server/src/routes/spoke.ts, server/src/routes/issues.ts)

## Steps

### 1. Create `server/src/services/spoke-tasks.ts`
Methods needed:
- `createTask(companyId, data)` — insert into spoke_tasks, return row
- `listTasks(companyId, filters?)` — filter by deviceId, status
- `getTask(id)` — single row
- `updateTaskStatus(id, status)` — valid transitions: pending→assigned→in_progress→pr_raised→merged→done
- Task fields: company_id, device_id, issue_id (optional), title, description, repo_url, branch, worktree_path, status

### 2. Create `server/src/services/pull-requests.ts`
Methods needed:
- `createPR(companyId, data)` — insert into pull_requests, return row
- `listPRs(companyId, filters?)` — filter by status, review_status, device_id
- `getPR(id)` — single row
- `reviewPR(id, action, reviewedBy)` — set review_status to approved/rejected
- `mergePR(id)` — set status=merged, merged_at=now()

### 3. Create `server/src/routes/spoke-tasks.ts`
- GET `/:companyId/spoke-tasks` — list with filters
- POST `/:companyId/spoke-tasks` — create task
- GET `/:companyId/spoke-tasks/:taskId` — get detail
- PATCH `/:companyId/spoke-tasks/:taskId/status` — update status

### 4. Create `server/src/routes/pull-requests.ts`
- GET `/:companyId/pull-requests` — list with filters
- POST `/:companyId/pull-requests` — create PR
- GET `/:companyId/pull-requests/:prId` — get detail
- PATCH `/:companyId/pull-requests/:prId/review` — approve/reject
- POST `/:companyId/pull-requests/:prId/merge` — merge

### 5. Register routes in `server/src/app.ts`
Add after the spoke router:
```typescript
import { spokeTasksRouter } from "./routes/spoke-tasks.js";
import { pullRequestsRouter } from "./routes/pull-requests.js";
app.use("/api/companies", spokeTasksRouter);
app.use("/api/companies", pullRequestsRouter);
```
Also export from `server/src/routes/index.ts`.

### 6. Extend `server/src/routes/spoke.ts`
Add a new endpoint: GET `/:deviceId/spoke-tasks` that returns spoke_tasks assigned to this device.

## Pattern to follow
- Use raw SQL via `sql.raw()` like server/src/services/enhancements.ts
- Or use the Drizzle tables from @seaclip/db if available
- Read server/src/db-push.ts for the exact column names
- Use Router({ mergeParams: true }) for company-scoped routes
- Include requireAuth middleware from server/src/middleware/index.js
- Use Zod validation schemas

## Files to read first
- server/src/db-push.ts (table DDL — look for spoke_tasks and pull_requests)
- server/src/services/issues.ts (pattern reference)
- server/src/routes/issues.ts (route pattern)
- server/src/routes/spoke.ts (existing spoke routes to extend)
- server/src/middleware/index.ts (requireAuth, validate)

## Update enhancements DB when done
Get IDs: `curl -s "http://localhost:3001/api/enhancements?phase=P3-spoke-git&category=service" | python3 -m json.tool`
Also get route task IDs: `curl -s "http://localhost:3001/api/enhancements?phase=P3-spoke-git&category=api" | python3 -m json.tool`
Mark each as done when complete.

DO NOT modify any ui/ files. Only work on server/src/.'

# ════════════════════════════════════════════════════════════════════
# AGENT 3: Sidebar Badges API (P1 remaining)
# ════════════════════════════════════════════════════════════════════

BADGES_PROMPT='You are working on the SeaClip project at /Users/whitenoise-oc/shrirama/seaclip-v1

Your task: Build the sidebar badges API endpoint.

## Context
- SeaClip sidebar needs real-time badge counts (pending approvals, running agents, online devices, etc.)
- Follow existing patterns in the codebase

## Steps

### 1. Create `server/src/services/sidebar-badges.ts`
Query the DB and return:
```typescript
{
  pendingApprovals: number;   // approvals where status = "pending"
  activeIssues: number;       // issues where status in ("in_progress", "in_review")
  runningAgents: number;      // agents where status = "active" or "running"
  onlineDevices: number;      // edge_devices where status = "online"
  openPRs: number;            // pull_requests where status = "open"
  errorAgents: number;        // agents where status = "error"
}
```
Use raw SQL via `sql.raw()` pattern from server/src/services/enhancements.ts.

### 2. Create `server/src/routes/sidebar-badges.ts`
- GET `/:companyId/sidebar-badges` — returns the badge counts
- Use Router({ mergeParams: true })
- Include requireAuth middleware

### 3. Register in `server/src/app.ts`
Add: `app.use("/api/companies", sidebarBadgesRouter);`
Export from routes/index.ts.

### 4. Create `ui/src/api/sidebar-badges.ts`
TanStack Query hook:
```typescript
export function useSidebarBadges(companyId: string | undefined) {
  return useQuery({
    queryKey: ["sidebar-badges", companyId],
    queryFn: () => api.get<SidebarBadges>(`/companies/${companyId}/sidebar-badges`),
    enabled: !!companyId,
    refetchInterval: 15_000,
  });
}
```

### 5. Wire into Layout.tsx
In `ui/src/components/Layout.tsx`:
- Import useSidebarBadges
- Call it with company.id
- Pass badge counts to the relevant SidebarNavItems (approvals count, issues count, etc.)
- Show error agent count on the Agents section header

## Files to read first
- server/src/services/enhancements.ts (SQL pattern)
- server/src/routes/enhancements.ts (route pattern)
- server/src/app.ts (route registration)
- ui/src/components/Layout.tsx (where badges will be used)
- ui/src/api/approvals.ts (existing hook pattern)

## Update enhancements when done
Get ID: `curl -s "http://localhost:3001/api/enhancements?phase=P1-sidebar&status=pending" | python3 -m json.tool`
Mark as done when complete.

DO NOT modify KanbanBoard, Issues page, or spoke services — other agents handle those.'

# ════════════════════════════════════════════════════════════════════
# AGENT 4: UI API clients + Spoke/PR pages (P3 frontend)
# ════════════════════════════════════════════════════════════════════

SPOKE_UI_PROMPT='You are working on the SeaClip project at /Users/whitenoise-oc/shrirama/seaclip-v1

Your task: Build the UI API clients and pages for Spoke Tasks and Pull Requests.

## IMPORTANT: Wait for backend
Before starting, check if the spoke-tasks and pull-requests API routes exist:
```bash
curl -s http://localhost:3001/api/companies/test/spoke-tasks 2>/dev/null
```
If you get connection refused or 404, WAIT 2 minutes and retry. Another agent is building the backend.

## Steps

### 1. Create `ui/src/api/spoke-tasks.ts`
Hooks:
- `useSpokeTasks(companyId, filters?)` — GET /companies/:id/spoke-tasks
- `useSpokeTask(companyId, taskId)` — GET /companies/:id/spoke-tasks/:taskId
- `useCreateSpokeTask()` — POST mutation
- `useUpdateSpokeTaskStatus()` — PATCH mutation

### 2. Create `ui/src/api/pull-requests.ts`
Hooks:
- `usePullRequests(companyId, filters?)` — GET /companies/:id/pull-requests
- `usePullRequest(companyId, prId)` — GET /companies/:id/pull-requests/:prId
- `useReviewPR()` — PATCH mutation (approve/reject)
- `useMergePR()` — POST mutation

### 3. Add types to `ui/src/lib/types.ts`
```typescript
export type SpokeTaskStatus = "pending" | "assigned" | "in_progress" | "pr_raised" | "merged" | "done";
export type PRStatus = "open" | "merged" | "closed";
export type PRReviewStatus = "pending" | "approved" | "rejected";

export interface SpokeTask {
  id: string; companyId: string; deviceId: string; issueId?: string;
  title: string; description?: string; repoUrl: string; branch?: string;
  worktreePath?: string; status: SpokeTaskStatus;
  assignedAt: string; startedAt?: string; completedAt?: string;
  createdAt: string; updatedAt: string;
}

export interface PullRequest {
  id: string; companyId: string; spokeTaskId: string; deviceId: string;
  title: string; description?: string; sourceBranch: string; targetBranch: string;
  status: PRStatus; reviewStatus: PRReviewStatus;
  diffStat?: Record<string, unknown>;
  reviewedBy?: string; reviewedAt?: string; mergedAt?: string;
  createdAt: string; updatedAt: string;
}
```

### 4. Build `ui/src/pages/SpokeTasks.tsx` (replace placeholder)
- Table showing all spoke tasks with columns: Title, Device, Branch, Status, Created
- Filter by status (tabs: All, Pending, In Progress, PR Raised, Done)
- "New Task" button (dialog with title, description, repo URL, device selector)
- Use SeaClip dark theme colors

### 5. Build `ui/src/pages/PullRequests.tsx` (replace placeholder)
- Table showing all PRs with columns: Title, Branch, Device, Status, Review, Created
- Filter by review_status (tabs: Pending Review, Approved, Rejected, All)
- Action buttons per row: Approve, Reject, Merge
- Merge confirmation dialog

### 6. Enhance `ui/src/pages/SpokeView.tsx`
- Add a "Spoke Tasks" section showing tasks assigned to this device
- Add "Submit PR" button for in_progress tasks

## Files to read first
- ui/src/api/agents.ts (hook patterns)
- ui/src/api/client.ts (api helper)
- ui/src/pages/Agents.tsx (table + filter pattern)
- ui/src/pages/SpokeView.tsx (existing spoke page)
- ui/src/lib/types.ts (type patterns)
- ui/src/components/StatusBadge.tsx (badge styles)

## Update enhancements when done
Get IDs: `curl -s "http://localhost:3001/api/enhancements?phase=P3-spoke-git" | python3 -m json.tool`
Mark UI-related tasks as done.

DO NOT modify server/ files, Layout.tsx, or KanbanBoard — other agents handle those.'

# ════════════════════════════════════════════════════════════════════
# DISPATCH
# ════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}Dispatching 4 agents...${NC}"
echo ""

dispatch_agent "agent-kanban"      "$KANBAN_PROMPT"
sleep 1
dispatch_agent "agent-spoke-svc"   "$SPOKE_SVC_PROMPT"
sleep 1
dispatch_agent "agent-badges"      "$BADGES_PROMPT"
sleep 1
dispatch_agent "agent-spoke-ui"    "$SPOKE_UI_PROMPT"

echo ""
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  4 agents dispatched!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo ""
echo "Monitor with:"
echo "  tmux switch-client -t hub:agent-kanban"
echo "  tmux switch-client -t hub:agent-spoke-svc"
echo "  tmux switch-client -t hub:agent-badges"
echo "  tmux switch-client -t hub:agent-spoke-ui"
echo ""
echo "Check progress:"
echo "  curl -s http://localhost:3001/api/enhancements/stats | python3 -m json.tool"
echo ""
echo "Kill all agents:"
echo "  for w in agent-kanban agent-spoke-svc agent-badges agent-spoke-ui; do tmux kill-window -t hub:\$w 2>/dev/null; done"
