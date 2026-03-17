#!/usr/bin/env bash
# demo-pipeline.sh — End-to-end SeaClip pipeline demo.
#
# Usage:
#   HUB_URL=http://hub:3001 COMPANY_ID=<uuid> bash scripts/demo-pipeline.sh
#
# Environment variables:
#   HUB_URL      Base URL of the SeaClip hub  (default: http://localhost:3001)
#   COMPANY_ID   UUID of the company to use   (required)
#   API_KEY      API key for authentication   (optional)

set -euo pipefail

HUB_URL="${HUB_URL:-http://localhost:3001}"
COMPANY_ID="${COMPANY_ID:-}"
API_KEY="${API_KEY:-}"

# ── helpers ────────────────────────────────────────────────────────────────────

log()  { echo "[demo-pipeline] $*"; }
fail() { echo "[demo-pipeline] ERROR: $*" >&2; exit 1; }

hub_get() {
  local path="$1"
  curl -sf \
    ${API_KEY:+-H "x-api-key: ${API_KEY}"} \
    "${HUB_URL}${path}"
}

hub_post() {
  local path="$1"
  local body="$2"
  curl -sf -X POST \
    -H "Content-Type: application/json" \
    ${API_KEY:+-H "x-api-key: ${API_KEY}"} \
    -d "${body}" \
    "${HUB_URL}${path}"
}

hub_delete() {
  local path="$1"
  curl -sf -X DELETE \
    ${API_KEY:+-H "x-api-key: ${API_KEY}"} \
    "${HUB_URL}${path}" || true
}

# ── preflight ──────────────────────────────────────────────────────────────────

[[ -z "${COMPANY_ID}" ]] && fail "COMPANY_ID is required. Export it before running."

log "Hub:       ${HUB_URL}"
log "Company:   ${COMPANY_ID}"
log ""

# Step 1: verify hub connectivity
log "Step 1/5 — Verifying hub connectivity..."
hub_get "/api/health" | grep -q '"status":"ok"' || fail "Hub health check failed — is the hub running at ${HUB_URL}?"
log "  Hub is healthy."

# Step 2: list existing agents
log "Step 2/5 — Listing agents..."
AGENT_COUNT=$(hub_get "/api/companies/${COMPANY_ID}/agents" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('count', len(d.get('data', []))))" 2>/dev/null || echo "0")
log "  Found ${AGENT_COUNT} agent(s)."

# Step 3: create a test issue
log "Step 3/5 — Creating test issue..."
ISSUE_PAYLOAD='{"title":"[Demo] Pipeline smoke test","description":"Created by demo-pipeline.sh — safe to delete","status":"backlog","priority":"low"}'
ISSUE_RESPONSE=$(hub_post "/api/companies/${COMPANY_ID}/issues" "${ISSUE_PAYLOAD}")
ISSUE_ID=$(echo "${ISSUE_RESPONSE}" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
[[ -z "${ISSUE_ID}" ]] && fail "Failed to create test issue"
log "  Created issue: ${ISSUE_ID}"

# Step 4: verify the issue appears in the list
log "Step 4/5 — Verifying issue in list..."
ISSUE_COUNT=$(hub_get "/api/companies/${COMPANY_ID}/issues" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('count', len(d.get('data', []))))" 2>/dev/null || echo "0")
log "  Issues in backlog: ${ISSUE_COUNT}"

# Step 5: clean up
log "Step 5/5 — Cleaning up test issue..."
hub_delete "/api/companies/${COMPANY_ID}/issues/${ISSUE_ID}"
log "  Test issue deleted."

log ""
log "Demo pipeline completed successfully."
