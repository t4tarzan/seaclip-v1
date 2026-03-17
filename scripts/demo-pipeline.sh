#!/usr/bin/env bash
#
# SeaClip + Hopebot Pipeline Demo Script
# ========================================
# Demonstrates the full workflow for 5 team members:
#   Path A: Direct Hopebot (port 80) — trigger agents manually
#   Path B: SeaClip Dashboard (:5180) — create issue, pick repo, start pipeline
#
# Usage:
#   bash scripts/demo-pipeline.sh          # Run all demos
#   bash scripts/demo-pipeline.sh pathA    # Only direct Hopebot demos
#   bash scripts/demo-pipeline.sh pathB    # Only SeaClip pipeline demos
#
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
CID="203ebd27-7bb8-4a18-be62-338415b4c3ce"
SEACLIP="http://localhost:3001"
HOPEBOT="http://localhost:80"
GH_TOKEN="${GH_TOKEN:?Set GH_TOKEN env var}"
API_KEY="${API_KEY:?Set API_KEY env var}"
CLUSTER_ID="8fb76938-b81e-489d-940e-c31ee6fc551a"
REPO="t4tarzan/seaclip-v1"

# Agent role IDs on Hopebot
CHARLIE_ROLE="12e09acf-8d35-4ff1-a1cf-ef45d30588f5"
PETER_ROLE="c0e89367-115a-4f48-ae2b-c3f8a0f5bbd6"
DAVID_ROLE="462b360c-7c03-470a-8368-0e0ab85a219d"
TINA_ROLE="5ed6ecf3-151a-4344-b7d4-3d3e17d64aad"
SUZY_ROLE="be70cab5-5e84-43fa-ae39-09f9a6d17f7c"
MATTHEWS_ROLE="b46df03d-097e-4bff-999c-69c6d77f8bed"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

banner() { echo -e "\n${BOLD}${BLUE}═══════════════════════════════════════════════════════${RESET}"; echo -e "${BOLD}${BLUE}  $1${RESET}"; echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════${RESET}\n"; }
step()   { echo -e "${YELLOW}▸ STEP $1:${RESET} $2"; }
ok()     { echo -e "  ${GREEN}✓${RESET} $1"; }
fail()   { echo -e "  ${RED}✗${RESET} $1"; }
info()   { echo -e "  ${DIM}$1${RESET}"; }
member() { echo -e "\n${CYAN}┌─────────────────────────────────────────────────┐${RESET}"; echo -e "${CYAN}│${RESET} ${BOLD}$1${RESET} — $2"; echo -e "${CYAN}└─────────────────────────────────────────────────┘${RESET}"; }
pause()  { echo -e "\n${DIM}  Press Enter to continue...${RESET}"; read -r; }

# ── Pre-flight checks ────────────────────────────────────────────────────────
preflight() {
  banner "PRE-FLIGHT CHECKS"

  step 0 "Checking SeaClip API..."
  if curl -sf "$SEACLIP/api/health" > /dev/null 2>&1; then
    ok "SeaClip API at :3001"
  else
    fail "SeaClip API not reachable at :3001 — run: pm2 start seaclip-dev"
    exit 1
  fi

  step 0 "Checking SeaClip UI..."
  if curl -sf "http://localhost:5180/" > /dev/null 2>&1; then
    ok "SeaClip UI at :5180"
  else
    fail "SeaClip UI not reachable at :5180"
    exit 1
  fi

  step 0 "Checking Hopebot..."
  if curl -sf "$HOPEBOT" > /dev/null 2>&1; then
    ok "Hopebot at :80"
  else
    fail "Hopebot not reachable at :80 — is Docker running?"
    echo -e "  ${DIM}(Path A demos will be skipped)${RESET}"
    HOPEBOT_UP=false
  fi

  step 0 "Checking GitHub API..."
  REPO_CHECK=$(curl -s -H "Authorization: token $GH_TOKEN" "https://api.github.com/repos/$REPO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('full_name','FAIL'))" 2>/dev/null)
  if [ "$REPO_CHECK" = "$REPO" ]; then
    ok "GitHub repo: $REPO"
  else
    fail "Cannot access $REPO"
    exit 1
  fi

  step 0 "Checking agents..."
  AGENT_COUNT=$(curl -s "$SEACLIP/api/companies/$CID/agents" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('data',[])))" 2>/dev/null)
  ok "$AGENT_COUNT agents registered"

  echo -e "\n${GREEN}${BOLD}  All systems go!${RESET}\n"
}

HOPEBOT_UP=true

# ══════════════════════════════════════════════════════════════════════════════
# PATH A: Direct Hopebot at :80 — One simple task per team member
# ══════════════════════════════════════════════════════════════════════════════

path_a() {
  banner "PATH A: DIRECT HOPEBOT (port 80)"
  echo -e "${DIM}Each team member triggers one agent directly via Hopebot's API.${RESET}"
  echo -e "${DIM}This bypasses SeaClip — useful for quick one-off tasks.${RESET}\n"

  if [ "$HOPEBOT_UP" = false ]; then
    echo -e "${YELLOW}⚠ Hopebot not running — skipping Path A${RESET}"
    return
  fi

  # ── Member 1: Mahesh (Backend Lead) ──────────────────────────────────────
  member "Mahesh (Backend Lead)" "Asks Charlie to research a feature"

  step 1 "Triggering Curious Charlie to research adding a health-check dashboard widget"
  info "POST $HOPEBOT/api/cluster/$CLUSTER_ID/role/$CHARLIE_ROLE/webhook"

  RESP=$(curl -s -X POST "$HOPEBOT/api/cluster/$CLUSTER_ID/role/$CHARLIE_ROLE/webhook" \
    -H "x-api-key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"prompt": "Research what health-check metrics we currently expose at /api/health and /api/companies/:id/dashboard. List what is missing for a production health dashboard widget (uptime, error rates, p95 latency, active connections). Write findings to shared/docs/health-widget-research.md"}' 2>/dev/null || echo '{"error":"connection refused"}')

  if echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('success') or d.get('id') or d.get('jobId') else 1)" 2>/dev/null; then
    ok "Charlie triggered — researching health metrics"
    info "Check Hopebot console at :80 to see Charlie working"
  else
    fail "Charlie trigger failed: $(echo "$RESP" | head -c 200)"
    info "This is OK if Hopebot containers are still starting"
  fi

  pause

  # ── Member 2: Priya (Frontend Lead) ─────────────────────────────────────
  member "Priya (Frontend Lead)" "Asks David to build a small component"

  step 2 "Triggering David Dev to create a StatusDot component"
  info "POST $HOPEBOT/api/cluster/$CLUSTER_ID/role/$DAVID_ROLE/webhook"

  RESP=$(curl -s -X POST "$HOPEBOT/api/cluster/$CLUSTER_ID/role/$DAVID_ROLE/webhook" \
    -H "x-api-key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"prompt": "Create a small reusable StatusDot component at ui/src/components/StatusDot.tsx. It should accept props: status (online|offline|degraded|idle|active|error), size (sm|md|lg), and pulse (boolean). Use CSS variables from the existing theme. Export it. Do NOT modify any other files."}' 2>/dev/null || echo '{"error":"connection refused"}')

  if echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('success') or d.get('id') or d.get('jobId') else 1)" 2>/dev/null; then
    ok "David triggered — building StatusDot component"
  else
    fail "David trigger failed: $(echo "$RESP" | head -c 200)"
  fi

  pause

  # ── Member 3: Arjun (QA Lead) ──────────────────────────────────────────
  member "Arjun (QA Lead)" "Asks Tina to write tests for an existing component"

  step 3 "Triggering Test Tina to write tests for StatusBadge"
  info "POST $HOPEBOT/api/cluster/$CLUSTER_ID/role/$TINA_ROLE/webhook"

  RESP=$(curl -s -X POST "$HOPEBOT/api/cluster/$CLUSTER_ID/role/$TINA_ROLE/webhook" \
    -H "x-api-key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"prompt": "Write unit tests for the StatusBadge component at ui/src/components/StatusBadge.tsx. Create tests at ui/src/components/__tests__/StatusBadge.test.tsx. Test all status variants (agent statuses, issue statuses, priority levels). Use vitest and @testing-library/react. Run the tests and report results."}' 2>/dev/null || echo '{"error":"connection refused"}')

  if echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('success') or d.get('id') or d.get('jobId') else 1)" 2>/dev/null; then
    ok "Tina triggered — writing StatusBadge tests"
  else
    fail "Tina trigger failed: $(echo "$RESP" | head -c 200)"
  fi

  pause

  # ── Member 4: Divya (DevOps) ────────────────────────────────────────────
  member "Divya (DevOps)" "Asks Suzy to review the GitHub bridge code"

  step 4 "Triggering Sceptic Suzy to review github-bridge.ts"
  info "POST $HOPEBOT/api/cluster/$CLUSTER_ID/role/$SUZY_ROLE/webhook"

  RESP=$(curl -s -X POST "$HOPEBOT/api/cluster/$CLUSTER_ID/role/$SUZY_ROLE/webhook" \
    -H "x-api-key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"prompt": "Review the file server/src/services/github-bridge.ts for security issues, error handling gaps, and code quality. Check: 1) Is the GitHub token handled safely? 2) Are all fetch calls properly error-handled? 3) Is the Hopebot webhook trigger safe from injection? Write your review as a comment."}' 2>/dev/null || echo '{"error":"connection refused"}')

  if echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('success') or d.get('id') or d.get('jobId') else 1)" 2>/dev/null; then
    ok "Suzy triggered — reviewing github-bridge.ts"
  else
    fail "Suzy trigger failed: $(echo "$RESP" | head -c 200)"
  fi

  pause

  # ── Member 5: Raj (Tech Lead) ──────────────────────────────────────────
  member "Raj (Tech Lead)" "Asks Peter to plan a new feature"

  step 5 "Triggering Peter Plan to architect a notification system"
  info "POST $HOPEBOT/api/cluster/$CLUSTER_ID/role/$PETER_ROLE/webhook"

  RESP=$(curl -s -X POST "$HOPEBOT/api/cluster/$CLUSTER_ID/role/$PETER_ROLE/webhook" \
    -H "x-api-key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"prompt": "Design the architecture for adding browser push notifications to SeaClip. When pipeline stages complete, the dashboard should show a toast AND send a browser notification. Consider: 1) Service Worker setup 2) Notification permission flow 3) Which events trigger notifications 4) How to integrate with the existing WebSocket live-events system. Write the plan to shared/docs/notification-plan.md"}' 2>/dev/null || echo '{"error":"connection refused"}')

  if echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('success') or d.get('id') or d.get('jobId') else 1)" 2>/dev/null; then
    ok "Peter triggered — planning notification system"
  else
    fail "Peter trigger failed: $(echo "$RESP" | head -c 200)"
  fi

  echo -e "\n${GREEN}${BOLD}  Path A complete!${RESET}"
  echo -e "${DIM}  Check Hopebot at :80 → Console to see agents working.${RESET}"
  echo -e "${DIM}  Each agent runs in its own Docker container.${RESET}\n"
}

# ══════════════════════════════════════════════════════════════════════════════
# PATH B: SeaClip Dashboard — Full pipeline with repo selector
# ══════════════════════════════════════════════════════════════════════════════

path_b() {
  banner "PATH B: SEACLIP DASHBOARD PIPELINE"
  echo -e "${DIM}Each team member creates an issue on SeaClip, picks a repo,${RESET}"
  echo -e "${DIM}syncs to GitHub, and starts the 6-agent pipeline.${RESET}"
  echo -e "${DIM}Open http://localhost:5180 to watch the kanban board update live.${RESET}\n"

  pause

  # ── Member 1: Mahesh — Full pipeline ────────────────────────────────────
  member "Mahesh (Backend Lead)" "Add dark/light theme toggle"

  step 1 "Creating issue on SeaClip..."
  ISSUE1=$(curl -s -X POST "$SEACLIP/api/companies/$CID/issues" \
    -H "Content-Type: application/json" \
    -d '{
      "title": "Add dark/light theme toggle to Settings page",
      "description": "Users should be able to switch between dark and light themes from the Settings page. The toggle should persist in localStorage and apply immediately without page reload. Use CSS variables that already exist in the codebase.",
      "status": "todo",
      "priority": "medium",
      "metadata": {"githubRepo": "t4tarzan/seaclip-v1"}
    }')
  ID1=$(echo "$ISSUE1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',json.load(sys.stdin) if False else 'FAIL'))" 2>/dev/null)
  IDENT1=$(echo "$ISSUE1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('identifier','?'))" 2>/dev/null)
  ok "Issue created: $IDENT1"

  step 2 "Syncing to GitHub..."
  SYNC1=$(curl -s -X POST "$SEACLIP/api/companies/$CID/github/sync-issue" \
    -H "Content-Type: application/json" \
    -d "{\"issueId\":\"$ID1\"}")
  GH_NUM1=$(echo "$SYNC1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('githubIssueNumber','?'))" 2>/dev/null)
  GH_URL1=$(echo "$SYNC1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('githubIssueUrl','?'))" 2>/dev/null)
  ok "GitHub issue #$GH_NUM1 created → $GH_URL1"

  step 3 "Starting full pipeline (Charlie → Peter → David → Tina → Suzy → Matthews)..."
  START1=$(curl -s -X POST "$SEACLIP/api/companies/$CID/github/pipeline/start" \
    -H "Content-Type: application/json" \
    -d "{\"issueId\":\"$ID1\",\"stage\":\"plan\"}")
  ok "Pipeline started at 'plan' — Charlie is researching"
  info "Watch the kanban at :5180 — card will show stage progress"
  info "GitHub: $GH_URL1"

  pause

  # ── Member 2: Priya — Full pipeline ────────────────────────────────────
  member "Priya (Frontend Lead)" "Improve mobile responsiveness"

  step 1 "Creating issue..."
  ISSUE2=$(curl -s -X POST "$SEACLIP/api/companies/$CID/issues" \
    -H "Content-Type: application/json" \
    -d '{
      "title": "Make KanbanBoard responsive for tablet and mobile",
      "description": "The kanban board currently only works on desktop. On tablet (768px), stack columns 2-wide. On mobile (< 640px), show a single-column list view with swipe-to-change-status. Use existing Tailwind breakpoints.",
      "status": "todo",
      "priority": "high",
      "metadata": {"githubRepo": "t4tarzan/seaclip-v1"}
    }')
  ID2=$(echo "$ISSUE2" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id','FAIL'))" 2>/dev/null)
  ok "Issue created"

  step 2 "Syncing + starting pipeline..."
  curl -s -X POST "$SEACLIP/api/companies/$CID/github/sync-issue" \
    -H "Content-Type: application/json" \
    -d "{\"issueId\":\"$ID2\"}" > /dev/null
  curl -s -X POST "$SEACLIP/api/companies/$CID/github/pipeline/start" \
    -H "Content-Type: application/json" \
    -d "{\"issueId\":\"$ID2\",\"stage\":\"plan\"}" > /dev/null
  ok "Pipeline started — Charlie researching mobile patterns"

  pause

  # ── Member 3: Arjun — Skip to testing (code already done) ──────────────
  member "Arjun (QA Lead)" "Test the RepoSelector component (code exists, needs testing)"

  step 1 "Creating issue..."
  ISSUE3=$(curl -s -X POST "$SEACLIP/api/companies/$CID/issues" \
    -H "Content-Type: application/json" \
    -d '{
      "title": "Write integration tests for RepoSelector component",
      "description": "The RepoSelector component at ui/src/components/RepoSelector.tsx needs test coverage. Test: renders loading state, renders repo list, handles selection, handles empty state. Mock the GitHub repos API response.",
      "status": "in_progress",
      "priority": "medium",
      "metadata": {"githubRepo": "t4tarzan/seaclip-v1"}
    }')
  ID3=$(echo "$ISSUE3" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id','FAIL'))" 2>/dev/null)
  ok "Issue created"

  step 2 "Syncing to GitHub..."
  curl -s -X POST "$SEACLIP/api/companies/$CID/github/sync-issue" \
    -H "Content-Type: application/json" \
    -d "{\"issueId\":\"$ID3\"}" > /dev/null
  ok "Synced"

  step 3 "Skipping to 'coded' stage — Tina will test directly..."
  curl -s -X POST "$SEACLIP/api/companies/$CID/github/pipeline/start" \
    -H "Content-Type: application/json" \
    -d "{\"issueId\":\"$ID3\",\"stage\":\"coded\"}" > /dev/null
  ok "Pipeline started at 'coded' — Tina testing, then Suzy reviews, then Matthews merges"
  info "This demonstrates partial pipeline — skipping research/planning/coding"

  pause

  # ── Member 4: Divya — Resume from review ───────────────────────────────
  member "Divya (DevOps)" "Review + merge the GitHub poller (code & tests done)"

  step 1 "Creating issue..."
  ISSUE4=$(curl -s -X POST "$SEACLIP/api/companies/$CID/issues" \
    -H "Content-Type: application/json" \
    -d '{
      "title": "Review and merge GitHub poller service",
      "description": "The github-poller.ts service has been coded and tested. Needs security review (token handling, error recovery, poll interval safety) and then merge to main. Check for memory leaks in the setInterval pattern.",
      "status": "in_review",
      "priority": "high",
      "metadata": {"githubRepo": "t4tarzan/seaclip-v1"}
    }')
  ID4=$(echo "$ISSUE4" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id','FAIL'))" 2>/dev/null)
  ok "Issue created"

  step 2 "Syncing + starting at 'tested' (Suzy reviews, Matthews merges)..."
  curl -s -X POST "$SEACLIP/api/companies/$CID/github/sync-issue" \
    -H "Content-Type: application/json" \
    -d "{\"issueId\":\"$ID4\"}" > /dev/null
  curl -s -X POST "$SEACLIP/api/companies/$CID/github/pipeline/start" \
    -H "Content-Type: application/json" \
    -d "{\"issueId\":\"$ID4\",\"stage\":\"tested\"}" > /dev/null
  ok "Pipeline started at 'tested' — Suzy reviewing, then Matthews merges"
  info "Only 2 agents will run (Suzy + Matthews)"

  pause

  # ── Member 5: Raj — Full pipeline on a different repo ──────────────────
  member "Raj (Tech Lead)" "Add README badges to worldmonitor repo"

  step 1 "Creating issue targeting a DIFFERENT repo..."
  ISSUE5=$(curl -s -X POST "$SEACLIP/api/companies/$CID/issues" \
    -H "Content-Type: application/json" \
    -d '{
      "title": "Add CI/CD status badges to README.md",
      "description": "Add GitHub Actions workflow status badge, CodeQL badge, and deployment status badge to the top of README.md. Also add a brief architecture diagram section using Mermaid syntax.",
      "status": "todo",
      "priority": "low",
      "metadata": {"githubRepo": "t4tarzan/worldmonitor"}
    }')
  ID5=$(echo "$ISSUE5" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id','FAIL'))" 2>/dev/null)
  ok "Issue created — targeting t4tarzan/worldmonitor (not seaclip-v1!)"

  step 2 "Syncing + starting full pipeline on worldmonitor..."
  SYNC5=$(curl -s -X POST "$SEACLIP/api/companies/$CID/github/sync-issue" \
    -H "Content-Type: application/json" \
    -d "{\"issueId\":\"$ID5\"}")
  GH_URL5=$(echo "$SYNC5" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('githubIssueUrl','?'))" 2>/dev/null)
  curl -s -X POST "$SEACLIP/api/companies/$CID/github/pipeline/start" \
    -H "Content-Type: application/json" \
    -d "{\"issueId\":\"$ID5\",\"stage\":\"plan\"}" > /dev/null
  ok "Pipeline started on worldmonitor — proves multi-repo works"
  info "GitHub: $GH_URL5"

  echo ""
  banner "PIPELINE STATUS SUMMARY"

  echo -e "${BOLD}  All 5 issues created and pipelines running:${RESET}\n"

  # Show status of all issues
  for ID in "$ID1" "$ID2" "$ID3" "$ID4" "$ID5"; do
    if [ "$ID" = "FAIL" ] || [ -z "$ID" ]; then
      fail "Issue creation failed"
      continue
    fi
    ISSUE_DATA=$(curl -s "$SEACLIP/api/companies/$CID/issues/$ID" 2>/dev/null)
    STATUS_DATA=$(curl -s "$SEACLIP/api/companies/$CID/github/pipeline/status/$ID" 2>/dev/null)

    TITLE=$(echo "$ISSUE_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin).get('title','?')[:50])" 2>/dev/null)
    ISTATUS=$(echo "$ISSUE_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null)
    STAGE=$(echo "$STATUS_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('stage','none'))" 2>/dev/null)
    LABELS=$(echo "$STATUS_DATA" | python3 -c "import sys,json; print(', '.join(json.load(sys.stdin).get('data',{}).get('labels',[])))" 2>/dev/null)
    REPO_NAME=$(echo "$ISSUE_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin).get('metadata',{}).get('githubRepo','?'))" 2>/dev/null)

    echo -e "  ${CYAN}$TITLE${RESET}"
    echo -e "    repo: ${DIM}$REPO_NAME${RESET}  status: ${GREEN}$ISTATUS${RESET}  stage: ${YELLOW}$STAGE${RESET}  labels: ${DIM}[$LABELS]${RESET}"
    echo ""
  done

  echo -e "${BOLD}${GREEN}  Path B complete!${RESET}\n"
  echo -e "  ${BOLD}What to observe:${RESET}"
  echo -e "  ${CYAN}1.${RESET} Kanban board (:5180/issues)  — cards in different columns with stage dots"
  echo -e "  ${CYAN}2.${RESET} Issue detail (click a card)  — Pipeline panel in sidebar with GitHub link"
  echo -e "  ${CYAN}3.${RESET} Agents page (:5180/agents)   — agents go active as pipeline fires them"
  echo -e "  ${CYAN}4.${RESET} Activity feed (:5180/activity)— pipeline events appear in real-time"
  echo -e "  ${CYAN}5.${RESET} GitHub issues tab             — labels added, agent comments appearing"
  echo -e "  ${CYAN}6.${RESET} Hopebot console (:80)         — Docker containers spinning up per agent"
  echo -e "  ${CYAN}7.${RESET} Multi-repo                    — Raj's task targets worldmonitor, not seaclip"
  echo ""
  echo -e "  ${DIM}The poller syncs every 30s — refresh the kanban to see progress.${RESET}"
  echo ""
}

# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

preflight

MODE="${1:-all}"

case "$MODE" in
  pathA|a|A|hopebot)
    path_a
    ;;
  pathB|b|B|seaclip|pipeline)
    path_b
    ;;
  all|"")
    path_a
    echo ""
    path_b
    ;;
  *)
    echo "Usage: $0 [pathA|pathB|all]"
    exit 1
    ;;
esac

banner "DEMO COMPLETE"
echo -e "  ${BOLD}Quick reference:${RESET}"
echo -e "  SeaClip Dashboard:  ${CYAN}http://localhost:5180${RESET}"
echo -e "  Hopebot Console:    ${CYAN}http://localhost:80${RESET}"
echo -e "  GitHub Issues:      ${CYAN}https://github.com/$REPO/issues${RESET}"
echo -e "  SeaClip API:        ${CYAN}http://localhost:3001/api/health${RESET}"
echo ""
echo -e "  ${DIM}Tip: Run 'bash scripts/demo-pipeline.sh pathB' to re-run just the SeaClip demos${RESET}"
echo ""
