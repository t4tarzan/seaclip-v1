# SeaClip — Onboarding Guide

Step-by-step guide to set up SeaClip on your hub and connect spoke devices over Tailscale.

---

## Prerequisites

- **Hub machine** — Mac/Linux with Node.js 20+, pnpm 9+
- **Spoke devices** — Any machine on your Tailnet (Pi, Jetson, laptop, phone)
- **Tailscale** — Installed and running on all devices (`tailscale status` shows peers)

---

## 1. Hub Setup

### 1a. Clone and install

```bash
git clone https://github.com/t4tarzan/seaclip-v1.git
cd seaclip-v1
pnpm install
```

### 1b. Run the onboard wizard

```bash
pnpm seaclip onboard
```

The wizard walks you through:

| Step | What it asks | Recommended |
|------|-------------|-------------|
| Deployment mode | `local_trusted` or `authenticated` | `local_trusted` for home lab |
| Database | PGlite (embedded) or PostgreSQL | PGlite for single-hub |
| Ollama URL | Where Ollama runs | `http://localhost:11434` |
| Telegram | Optional bot bridge | Skip unless needed |
| Server port | API port | `3001` |
| Company name | Your org name | Anything you want |
| First agent | Optional agent setup | Yes — pick Ollama or Claude |

Config is saved to `~/.seaclip/config.json`.

### 1c. Start the hub

```bash
pnpm dev
```

This starts:
- **API server** on `http://localhost:3001`
- **Dashboard UI** on `http://localhost:5173`

Note your hub's **Tailscale IP** (e.g. `100.x.y.z`):

```bash
tailscale ip -4
```

### 1d. Get your company ID

Open `http://localhost:5173` or run:

```bash
pnpm seaclip company list
```

Copy the company ID (UUID) — spokes need it to register.

---

## 2. Register a Spoke Device

Run these from the **spoke device** (or from the hub on behalf of the spoke).

### 2a. Register the device with the hub

```bash
HUB=http://100.x.y.z:3001   # your hub's Tailscale IP
COMPANY=<your-company-id>

curl -s -X POST "$HUB/api/companies/$COMPANY/edge-devices" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "pi-kitchen",
    "deviceType": "raspberry-pi",
    "ipAddress": "'$(tailscale ip -4)'",
    "capabilities": ["ollama", "seaclaw"],
    "metadata": { "location": "kitchen" }
  }' | jq .
```

Save the returned `id` — this is your `DEVICE_ID`.

### 2b. Start sending telemetry

The spoke should post telemetry every 30 seconds:

```bash
DEVICE_ID=<from-step-2a>

curl -s -X POST "$HUB/api/companies/$COMPANY/edge-devices/$DEVICE_ID/telemetry" \
  -H "Content-Type: application/json" \
  -d '{
    "cpuPercent": 15,
    "memoryPercent": 42,
    "diskPercent": 60,
    "temperatureCelsius": 52,
    "uptimeSeconds": 86400
  }'
```

The device status changes to `online` on the dashboard.

### 2c. Register an agent on the spoke

```bash
curl -s -X POST "$HUB/api/companies/$COMPANY/agents" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pi Analyst",
    "slug": "pi-analyst",
    "adapterType": "ollama_local",
    "role": "Local analysis on edge device",
    "systemPrompt": "You are a helpful agent running on an edge device.",
    "environmentTag": "local",
    "heartbeatEnabled": true,
    "status": "idle",
    "adapterConfig": {
      "baseUrl": "http://localhost:11434",
      "model": "llama3.2",
      "deviceId": "'$DEVICE_ID'"
    },
    "metadata": { "deviceId": "'$DEVICE_ID'" }
  }' | jq .
```

### 2d. View the spoke in the dashboard

Open `http://<hub-tailscale-ip>:5173/spoke/<DEVICE_ID>` from any device on your Tailnet.

This thin-client view shows:
- Device status and health
- Assigned tasks
- Heartbeat jobs
- Spoke git tasks with PR submission

---

## 3. Automate Spoke Telemetry

Create a simple cron or systemd timer on the spoke.

### Option A: cron (every 30s)

```bash
# Add to crontab -e
* * * * * /usr/local/bin/seaclip-telemetry.sh
* * * * * sleep 30 && /usr/local/bin/seaclip-telemetry.sh
```

`/usr/local/bin/seaclip-telemetry.sh`:

```bash
#!/bin/bash
HUB="http://100.x.y.z:3001"
COMPANY="<company-id>"
DEVICE_ID="<device-id>"

CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' 2>/dev/null || echo 0)
MEM=$(free | awk '/Mem:/{printf "%.0f", $3/$2*100}' 2>/dev/null || echo 0)
DISK=$(df / | awk 'NR==2{print $5}' | tr -d '%' 2>/dev/null || echo 0)
TEMP=$(cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null | awk '{printf "%.1f", $1/1000}' || echo 0)
UP=$(awk '{print int($1)}' /proc/uptime 2>/dev/null || echo 0)

curl -s -X POST "$HUB/api/companies/$COMPANY/edge-devices/$DEVICE_ID/telemetry" \
  -H "Content-Type: application/json" \
  -d "{\"cpuPercent\":$CPU,\"memoryPercent\":$MEM,\"diskPercent\":$DISK,\"temperatureCelsius\":$TEMP,\"uptimeSeconds\":$UP}" \
  > /dev/null 2>&1
```

### Option B: SeaClaw binary

If using the [SeaClaw](https://github.com/haeli05/seaclaw) C binary:

```bash
seaclaw --hub http://100.x.y.z:3001 --company <id> --device <id> --interval 30
```

---

## 4. Assign Work to Spokes

### Create a spoke task

```bash
curl -s -X POST "$HUB/api/companies/$COMPANY/spoke-tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Analyze server logs",
    "description": "Parse and summarize the last 24h of nginx logs",
    "deviceId": "'$DEVICE_ID'",
    "repoUrl": "https://github.com/your-org/your-repo"
  }' | jq .
```

### Update task status (from spoke)

```bash
TASK_ID=<from-above>

# Mark in_progress
curl -s -X PATCH "$HUB/api/companies/$COMPANY/spoke-tasks/$TASK_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'

# When done, submit a PR
curl -s -X POST "$HUB/api/companies/$COMPANY/pull-requests" \
  -H "Content-Type: application/json" \
  -d '{
    "spokeTaskId": "'$TASK_ID'",
    "deviceId": "'$DEVICE_ID'",
    "title": "feat: analyze server logs",
    "sourceBranch": "spoke/pi-kitchen/log-analysis",
    "targetBranch": "main"
  }' | jq .
```

---

## 5. Verify Everything

### From the hub

```bash
pnpm seaclip doctor          # System health
pnpm seaclip company list    # Companies
pnpm seaclip agent list -c <company-id>   # Agents
```

### From the dashboard

| Page | URL | What to check |
|------|-----|---------------|
| Dashboard | `/` | Metric cards, agent status, edge mesh count |
| Edge Mesh | `/edge-mesh` | All devices visible, online status |
| Spoke View | `/spoke/<device-id>` | Device health, tasks, jobs |
| Spoke Tasks | `/spoke-tasks` | Task list with status workflow |
| Pull Requests | `/pull-requests` | PRs from spokes |

---

## Quick Reference

### API endpoints for spokes

| Action | Method | Path |
|--------|--------|------|
| Register device | `POST` | `/api/companies/:cid/edge-devices` |
| Send telemetry | `POST` | `/api/companies/:cid/edge-devices/:did/telemetry` |
| List spoke tasks | `GET` | `/api/spoke/:did/spoke-tasks` |
| Submit feedback | `POST` | `/api/spoke/:did/feedback` |
| Get spoke status | `GET` | `/api/spoke/:did/status` |

### Spoke task status flow

```
pending → assigned → in_progress → pr_raised → merged → done
```

### Device health states

| State | Meaning |
|-------|---------|
| `online` | Health score ≥ 80, telemetry recent |
| `degraded` | Health score 50–79 |
| `offline` | No telemetry for 90s |

### Environment variables (spoke-relevant)

| Variable | Purpose |
|----------|---------|
| `DEPLOYMENT_MODE=local_trusted` | No auth needed (Tailnet is the trust boundary) |
| `CORS_ORIGINS` | Add spoke IPs if running UI from spoke |
| `OLLAMA_BASE_URL` | Set per-device if Ollama runs locally on spoke |
