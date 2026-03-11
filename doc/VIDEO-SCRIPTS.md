# SeaClip Video Scripts

Two videos to produce: a **UI screen recording demo** and a **hardware/real-world demo**.

---

## Video 1: Product UI Demo (Screen Recording)

**Format:** Screen capture with voiceover narration
**Duration:** 3–5 minutes
**Resolution:** 1920x1080, 60fps
**Tools:** OBS / ScreenFlow + Loom-style webcam bubble (optional)

### Pre-Recording Setup

1. Seed the database with realistic demo data:
   - 2 companies ("SeaClip Labs", "Acme Robotics")
   - 8–12 agents across adapters (Claude Code, Ollama, SeaClaw, Process)
   - 20+ issues in various statuses (backlog, todo, in_progress, in_review, done)
   - 3 goals with cascading projects
   - 5 edge devices (2 online, 1 degraded, 2 offline)
   - Approval requests (2 pending, 3 approved)
   - Activity feed with 15+ recent events
   - Cost entries spanning 30 days

2. Start all services:
   ```bash
   ./scripts/start-services.sh
   ```
   - API on :3001
   - Dashboard on :3100
   - Marketing site on :4321
   - PostgreSQL on :5432
   - Ollama on :11434

3. Open browser to `http://localhost:3100` (dark theme, no extensions visible)

---

### Script & Shot List

#### Scene 1: Opening — Marketing Site (0:00–0:20)

**Show:** `seaclip.tech` landing page in browser

**Narration:**
> "SeaClip is an open-source orchestration platform for edge-native AI fleets. It manages AI agents running everywhere — from cloud APIs to Raspberry Pis on your desk. Let me show you the dashboard."

**Action:** Scroll slowly through the hero section, pause on the quickstart command, then navigate to the dashboard.

---

#### Scene 2: Dashboard Overview (0:20–1:00)

**Show:** Dashboard at `localhost:3100/`

**Narration:**
> "The dashboard gives you a single pane of glass for your entire fleet. At the top — total agents, active issues, monthly spend, and edge devices online. These are live numbers, updating in real time over WebSocket."

**Action:** Mouse over each metric card to show hover effects.

> "Below, we have activity charts showing agent distribution, issue status breakdown, and priority spread. The service status panel shows all five local services — API, UI, marketing site, Postgres, and Ollama — with live health checks every 15 seconds."

**Action:** Point to the service status section, show the green indicators.

> "The agent status breakdown shows running, idle, error, and offline counts. And the edge mesh panel gives a quick view of device connectivity."

**Action:** Click "View all" on the agent status section.

---

#### Scene 3: Agents (1:00–1:40)

**Show:** `/agents` page

**Narration:**
> "The agents page lists every agent in your fleet. Each agent has an adapter type — Claude Code for cloud coding tasks, Ollama for local inference, SeaClaw for edge devices, Process for spawned commands."

**Action:** Click into an agent detail page.

> "The detail view shows the agent's configuration, heartbeat history, recent runs, token usage, and cost attribution. You can see the last heartbeat timestamp, success rate, and which device it's running on."

**Action:** Scroll through heartbeat history, show the run output panel.

> "Heartbeats run on configurable cron schedules — every 30 seconds by default. The system automatically detects failures and can reassign work."

---

#### Scene 4: Issues & Kanban (1:40–2:20)

**Show:** `/issues` page in board view

**Narration:**
> "The issue tracker is a full kanban board with five columns — Backlog, Todo, In Progress, In Review, and Done. You can drag and drop issues between columns."

**Action:** Drag an issue from "Todo" to "In Progress".

> "Each issue card shows the title, priority indicator, project, assignee, and last updated time. Click into any issue for the full detail view."

**Action:** Click an issue, show detail page.

> "Issues have structured fields — priority, status, assignee agent, linked project, and a complete audit trail. When an agent picks up an issue, it creates a branch, does the work, and raises a PR — all tracked here."

**Action:** Toggle to list view to show the alternative layout.

---

#### Scene 5: Edge Mesh (2:20–2:50)

**Show:** `/edge-mesh` page

**Narration:**
> "The edge mesh is what makes SeaClip different. This is a force-directed topology graph showing all registered devices — Raspberry Pis, Jetson boards, Mac minis, phones — and their connections to the hub."

**Action:** Hover over device nodes to show telemetry tooltips.

> "Each device reports telemetry every 10 to 30 seconds — CPU usage, memory, temperature, disk space, and GPU utilization. The system calculates a health score from 0 to 100. If a device drops below threshold or goes offline, in-progress work is automatically reassigned to a healthy agent."

**Action:** Click a device node to show its detail panel.

---

#### Scene 6: Settings & Configuration (2:50–3:30)

**Show:** `/settings` page

**Narration:**
> "The settings page is the control center for your workspace. Five tabs — General for company info and budget, Services for live health monitoring, Claude & AI for model selection and git workflow configuration, Environment for isolation controls, and Notifications."

**Action:** Click through each tab.

> "In Claude & AI, you choose your cloud model — Opus, Sonnet, or Haiku — and configure auto-branching, auto-commit, and approval thresholds. The Ollama section shows your local models with available memory."

**Action:** Show the Claude model dropdown, toggle auto-branch.

> "Environment isolation is key. Toggle Tailscale integration, enforce local-only agents, and control which adapters can reach external APIs. Seven adapters are registered — each tagged as cloud or local."

**Action:** Show the adapter list with environment badges.

---

#### Scene 7: Approvals & Costs (3:30–4:00)

**Show:** `/approvals` then `/costs`

**Narration:**
> "Governance is built in. Agents request approval before expensive operations. You see pending requests with the action type, requesting agent, and estimated cost. Approve or reject with one click."

**Action:** Show a pending approval, click approve.

> "Cost tracking gives you per-agent, per-run token and dollar attribution. Set monthly budgets, see the burn rate, and identify which agents are most expensive."

**Action:** Show the cost breakdown chart.

---

#### Scene 8: Closing — Terminal (4:00–4:20)

**Show:** Terminal with the SeaClip CLI

**Narration:**
> "Everything you see in the dashboard is also available from the CLI. Run `pnpm seaclip onboard` to set up a new workspace in under a minute. SeaClip is open source, MIT licensed, and ready to deploy. Check it out at seaclip.tech."

**Action:** Type `pnpm seaclip doctor` to show the health check output, then cut to the SeaClip logo.

---

### Post-Production Notes

- Add subtle zoom transitions between scenes (1.5s ease-in-out)
- Lower-third labels for each section name
- Background music: lo-fi ambient, -20dB under voice
- End card: SeaClip logo + GitHub URL + seaclip.tech

---

---

## Video 2: Hardware Demo (Real-World Shot)

**Format:** Camera + screen capture hybrid
**Duration:** 2–4 minutes
**Resolution:** 4K camera, 1080p screen inserts
**Equipment:** iPhone/camera on tripod, good lighting, desk setup with devices visible

### Required Hardware

| Device | Role | Notes |
|--------|------|-------|
| Mac Studio M3 Ultra | Hub | Running all services, camera shows the machine |
| Raspberry Pi 4/5 | Spoke 1 | Running SeaClaw binary, visible on desk with LED activity |
| Jetson Nano/Orin | Spoke 2 | Running SeaClaw, GPU inference visible |
| iPhone/Android | Spoke 3 | Running spoke thin-client in mobile browser |
| Monitor | Dashboard | Showing the SeaClip dashboard full-screen |

### Pre-Recording Setup

1. All devices on the same Tailscale network
2. SeaClaw binary deployed to Pi and Jetson
3. Phone connected to `http://<hub-tailscale-ip>:3100/spoke/<deviceId>`
4. Dashboard showing edge mesh with all devices registered
5. At least one active issue assigned to a Pi agent

---

### Script & Shot List

#### Scene 1: The Desk (0:00–0:30)

**Shot:** Wide angle of the desk. Mac Studio center, Pi on the left with GPIO LEDs, Jetson on the right, phone propped up, monitor showing dashboard.

**Narration:**
> "This is a SeaClip fleet running on real hardware. The Mac Studio is the hub — it runs the API, database, and dashboard. These are the spokes — a Raspberry Pi 4, a Jetson Nano, and an iPhone. They're all on the same Tailscale network."

**Action:** Camera pans across each device. Brief close-up of the Pi's ethernet/LED activity.

---

#### Scene 2: Edge Mesh — Live Devices (0:30–1:10)

**Shot:** Close-up of the monitor showing the edge mesh topology.

**Narration:**
> "On the dashboard, the edge mesh shows all four devices. The hub is the central node. Each spoke reports telemetry — CPU, memory, temperature, disk. The Pi is at 62% CPU running a coding task. The Jetson is idle at 38 degrees. The phone is connected as a thin client."

**Action:** Hover over each node on screen. Show the health scores.

**Shot:** Cut to close-up of the Pi, showing terminal with SeaClaw process running.

> "The Pi is running SeaClaw — a 709-kilobyte C binary that acts as an agent. It receives tasks from the hub, executes them locally, and reports results back. No cloud APIs, no data leaving the network."

---

#### Scene 3: Assigning Work to a Spoke (1:10–1:50)

**Shot:** Screen recording of the issues page.

**Narration:**
> "Let's assign a task to the Pi. I'll create a new issue — 'Analyze sensor data from GPIO pins' — and assign it to the SeaClaw agent running on the Pi."

**Action:** Create issue in the UI, assign to Pi agent.

> "The hub sends the task to the Pi over Tailscale. The Pi picks it up on the next heartbeat cycle."

**Shot:** Cut to Pi terminal showing the heartbeat pickup and task execution.

> "There it goes. The Pi received the task, executed it, and reported back. The issue status just moved to In Progress on the dashboard."

**Shot:** Dashboard showing the issue card move to "In Progress" column.

---

#### Scene 4: Phone as Thin Client (1:50–2:20)

**Shot:** Close-up of the phone showing the spoke view.

**Narration:**
> "The phone runs a thin-client view — no app install needed, just a browser. It shows the device's assigned tasks, agent status, and telemetry. You can approve actions, view logs, and monitor health — all from your pocket."

**Action:** Tap through the spoke view sections on the phone.

> "This is useful for technicians in the field. Walk up to any edge device, scan its URL, and you have full visibility."

---

#### Scene 5: Device Failure & Auto-Reassignment (2:20–3:00)

**Shot:** Wide desk shot.

**Narration:**
> "Now let's see what happens when a device goes down. I'm going to unplug the Pi's ethernet cable."

**Action:** Physically unplug the Pi's ethernet. Camera shows the cable being pulled.

**Shot:** Cut to dashboard. The Pi node turns red/gray after ~30 seconds.

> "The hub detects the missed heartbeats. Health score drops to zero. The edge mesh shows it as offline. And here's the key part — the in-progress issue that was assigned to the Pi is automatically reassigned to the Jetson, which has the same adapter type and is healthy."

**Action:** Show the issue card moving from Pi agent to Jetson agent in the dashboard.

> "No manual intervention. The fleet self-heals."

**Action:** Plug the Pi back in. Show it come back online after ~30 seconds.

---

#### Scene 6: Closing (3:00–3:30)

**Shot:** Wide desk shot, all devices humming.

**Narration:**
> "That's SeaClip running on real hardware. A Mac as the hub. A Pi and Jetson as AI spokes. A phone as a monitoring client. All coordinated, all observable, all open source. Deploy your own fleet at seaclip.tech."

**Action:** Camera slowly pulls back. Dashboard visible on monitor. Fade to SeaClip logo.

---

### Post-Production Notes

- Picture-in-picture: camera shot with dashboard overlay in corner
- Callout arrows/circles when pointing to specific devices or UI elements
- Terminal text should be readable — use 16pt+ font, zoom if needed
- Telemetry numbers should be real, not mocked — let the system run for 5+ minutes before recording
- Background music: electronic ambient, slightly more energetic than Video 1
- End card: SeaClip logo + GitHub URL + seaclip.tech + "MIT Licensed"

---

## Recording Checklist

### Before Recording
- [ ] Database seeded with realistic data
- [ ] All 5 services running and healthy
- [ ] Browser in incognito/clean mode (no bookmarks bar, no extensions)
- [ ] Screen resolution set to 1920x1080
- [ ] Font size increased in terminal (16pt minimum)
- [ ] Notifications silenced (Do Not Disturb)
- [ ] For hardware video: all devices powered on, Tailscale connected, SeaClaw running

### During Recording
- [ ] Narrate at moderate pace — leave room for edits
- [ ] Pause 2 seconds between scenes for clean cuts
- [ ] Mouse movements should be deliberate, not frantic
- [ ] If something fails live, keep rolling — real failures are authentic

### After Recording
- [ ] Trim dead air and long loading times
- [ ] Add lower-third labels for each section
- [ ] Color-correct camera footage to match the dark UI theme
- [ ] Export at 1080p60 for YouTube, 1080p30 for Twitter/LinkedIn
- [ ] Thumbnail: dashboard screenshot with "SeaClip" overlay text
