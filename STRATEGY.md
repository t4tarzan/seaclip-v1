# SeaClip v2 — Lean Clean Mean Machine Strategy

## Your Ecosystem at a Glance

| Project | What It Is | Status | Tech |
|---------|-----------|--------|------|
| **SeaClip** | Hub orchestrator (fork of Paperclip AI) | Running locally, v1 live | TypeScript, Express, React, PGlite |
| **SeaClaw** | C binary edge agent (OpenClaw rewritten in C) | Public repo (haeli05/seaclaw) | C, 709KB static binary, <50ms cold start |
| **ClawSwarm** | Multi-agent swarm (Swarms framework) | Public (The-Swarm-Corporation) | Python, gRPC, Claude API |
| **OpenClaw** | Full personal AI agent platform | Public, 100K+ stars | TypeScript, WebSocket, MCP |
| **OpenClaw K8** | Kubernetes operator for OpenClaw | Public (openclaw-rocks) | Go, Helm |
| **BMAD** | AI-driven agile dev lifecycle | Public (bmad-code-org) | Markdown agents, YAML config |
| **SeaBot** | TBD — likely Telegram/Discord bot layer | Private/unreleased | Unknown |
| **SeaZero** | Agent Zero wrapper/fork | Private/unreleased | Python (Agent Zero upstream) |

---

## The Problem You're Solving

You want ONE platform that:
1. Orchestrates AI agents across cloud API (Claude) AND local models (qwen3.5, GLM4)
2. Runs on a Mac Studio (96GB) as the hub
3. Deploys thin C binaries to edge devices as spokes
4. Manages git workflows (branch, commit, PR) autonomously
5. Provides a dashboard with RBAC for all devices
6. Keeps sensitive/IP data strictly local (never hits cloud APIs)

---

## Competitive Landscape (What Exists)

### Thin Client Binaries
| Project | Size | Startup | Language | Notes |
|---------|------|---------|----------|-------|
| **SeaClaw** | 709KB | <50ms | C | YOUR project. SSH+REST API. Best fit. |
| **ZeroClaw** | 3.4MB | <10ms | Rust | Reads OpenClaw config. 5MB memory footprint. |
| **acpx** | ~5MB | Fast | TypeScript | OpenClaw's headless CLI. "curl for ACP". |

### Multi-Agent Swarm Frameworks
| Framework | Language | Local LLM | Swarm Style | Overhead |
|-----------|----------|-----------|-------------|----------|
| **CrewAI** | Python | Ollama via LiteLLM | Role-based | Medium |
| **Agno** | Python | Direct Ollama | Lightweight, no graphs | Minimal |
| **Swarms/ClawSwarm** | Python | Configurable | Hierarchical director | Medium |
| **Jido** | Elixir | Configurable | BEAM actors (~2KB/agent) | Minimal |
| **Ruflo** | TypeScript | Via MCP | 60+ agents, self-learning | Heavy |
| **MetaGPT** | Python | Configurable | Software company sim | Heavy |

### Hub-Spoke Platforms
| Platform | Hub | Spoke | RBAC | Git Workflow |
|----------|-----|-------|------|-------------|
| **SeaClip (yours)** | Express+React | SeaClaw C binary | Per-company | Claude Code adapter |
| **OpenClaw** | WebSocket gateway | acpx / ZeroClaw | Per-session | GitHub Actions |
| **Ruflo** | claude-flow | Claude Code agents | Basic | Built-in |

---

## The Gap Analysis: What SeaClip Already Has vs What's Missing

### Already Built (SeaClip v1)
- Hub server with PGlite (zero-config DB)
- 7 adapter types (seaclaw, ollama, agent_zero, telegram, process, http, claude_code)
- Dashboard with metric cards, agent status, activity feed, edge mesh
- Environment isolation (cloud vs local tags with routing guards)
- Per-agent cron scheduling
- AES-256-GCM secret encryption
- Spoke thin-client view (`/spoke/:deviceId`)
- Cost tracking per agent

### Missing / Gaps to Fill

| Gap | Priority | Effort | Solution |
|-----|----------|--------|----------|
| **SeaClaw C binary integration** | HIGH | Medium | Build/compile SeaClaw, register as spoke device, test heartbeat loop |
| **Multi-agent swarm orchestration** | HIGH | Medium | Add swarm topology support (sequential, parallel, hierarchical) to agent scheduler |
| **RBAC beyond company-level** | MEDIUM | Medium | Add roles (admin, operator, viewer) per user, device-level permissions |
| **Git workflow automation** | HIGH | Low | Claude Code adapter works — needs proper git repo setup, PR templates |
| **Real-time WebSocket streaming** | MEDIUM | Medium | Agent output streaming to dashboard (currently poll-based) |
| **Device task queue** | HIGH | Low | Spoke devices pull tasks from queue instead of hub pushing |
| **Multi-model routing** | MEDIUM | Low | Route tasks to best model based on task type (coding→GLM4, analysis→qwen3.5) |
| **Observability** | LOW | Low | Structured logs, metrics export (Prometheus/Grafana optional) |

---

## Recommended Architecture: "SeaClip v2"

```
                    ┌─────────────────────────────┐
                    │     Mac Studio (96GB Hub)     │
                    │                               │
                    │  ┌─────────┐  ┌───────────┐  │
                    │  │ Ollama  │  │ Claude API│  │
                    │  │qwen3.5  │  │ (cloud)   │  │
                    │  │glm4-flash│  │           │  │
                    │  └────┬────┘  └─────┬─────┘  │
                    │       │             │         │
                    │  ┌────┴─────────────┴────┐   │
                    │  │    SeaClip Hub Server   │   │
                    │  │  (Express + PGlite)     │   │
                    │  │                         │   │
                    │  │  ┌──────────────────┐   │   │
                    │  │  │  Swarm Scheduler  │   │   │
                    │  │  │  - Sequential     │   │   │
                    │  │  │  - Parallel       │   │   │
                    │  │  │  - Hierarchical   │   │   │
                    │  │  │  - Model Router   │   │   │
                    │  │  └──────────────────┘   │   │
                    │  │                         │   │
                    │  │  ┌──────────────────┐   │   │
                    │  │  │  Adapter Registry │   │   │
                    │  │  │  ollama_local     │   │   │
                    │  │  │  claude_code      │   │   │
                    │  │  │  seaclaw          │   │   │
                    │  │  │  http / process   │   │   │
                    │  │  └──────────────────┘   │   │
                    │  └────────────┬────────────┘   │
                    │               │                 │
                    │  ┌────────────┴────────────┐   │
                    │  │   React Dashboard (UI)   │   │
                    │  │  - Agent orchestration   │   │
                    │  │  - Edge mesh topology    │   │
                    │  │  - Git workflow view     │   │
                    │  │  - RBAC / device views   │   │
                    │  └─────────────────────────┘   │
                    └───────────────┬─────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
              ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴─────┐
              │  SeaClaw   │  │  SeaClaw   │  │  Phone/   │
              │  (RPi)     │  │  (Laptop)  │  │  Tablet   │
              │  709KB C   │  │  709KB C   │  │  Thin Web │
              │  binary    │  │  binary    │  │  Client   │
              └───────────┘  └───────────┘  └───────────┘
              Tailnet only    Tailnet only    SSH/VNC view
```

---

## The Build Plan: 5 Phases

### Phase 1: Stabilize (NOW — this session)
- [x] Dashboard rendering without crashes
- [x] Agent configs updated (qwen3.5:35b, Claude Code adapter fixed)
- [ ] Models downloaded and heartbeats succeeding
- [ ] Git init the repo so Claude Code adapter can branch/commit

### Phase 2: Swarm Orchestration (Next)
- Add `SwarmScheduler` service that chains multiple agents:
  - **Sequential**: Agent A output → Agent B input → Agent C input
  - **Parallel**: Fan-out to multiple agents, collect results
  - **Hierarchical**: Director agent delegates subtasks
- Add `swarm` table to DB (id, topology, agents[], status, output)
- Dashboard: swarm visualization panel

### Phase 3: SeaClaw Spoke Integration
- Compile SeaClaw C binary for macOS ARM64 and Linux ARM64
- Auto-register spoke devices via the existing edge-device API
- Task queue: spoke pulls tasks from `/api/spoke/:deviceId/tasks`
- Heartbeat: spoke reports status to `/api/spoke/:deviceId/status`
- Data isolation enforced: local spokes NEVER hit cloud adapter

### Phase 4: Git Workflow Automation
- Claude Code adapter: auto-branch per task, commit, PR
- BMAD-style workflow: Brief → PRD → Architecture → Code → Review
- Dashboard: git activity feed (branches, commits, PRs)
- Webhook receiver for GitHub events

### Phase 5: RBAC & Multi-Client
- User roles: admin, operator, viewer (per company)
- Device-scoped permissions (which agents a device can trigger)
- API key auth for spoke devices
- Thin web client: mobile-friendly `/spoke/:deviceId` view (already exists)

---

## Memory Budget (96GB Mac Studio)

| Component | RAM Usage |
|-----------|-----------|
| macOS + system | ~8 GB |
| qwen3.5:35b (primary local model) | ~24 GB |
| glm-4.7-flash (fast coding model) | ~18 GB |
| SeaClip server (Node.js + PGlite) | ~500 MB |
| SeaClip UI build (served static) | ~0 |
| Ollama runtime overhead | ~2 GB |
| Claude Code processes (spawned) | ~1 GB |
| **Headroom** | **~42 GB free** |

You can comfortably run both local models simultaneously with plenty of room.

---

## Why This Beats the Alternatives

| vs. | SeaClip v2 Advantage |
|-----|---------------------|
| **OpenClaw** | Lighter (no Docker required), PGlite embedded DB, designed for edge-first |
| **CrewAI/Agno** | Has a dashboard, device management, git workflows built-in |
| **Ruflo** | Not locked to Claude — supports any Ollama model + cloud APIs |
| **Kubernetes** | Runs on a single Mac, no cluster needed, SeaClaw binaries instead of pods |
| **Raw Ollama** | Adds orchestration, scheduling, cost tracking, multi-agent swarms |

---

## Key Insight: SeaClaw C Binary is Your Superpower

The 709KB C binary that runs on any Linux/ARM device is the differentiator no other framework has. Combined with SeaClip's hub orchestration:

- **$10 Raspberry Pi** becomes a capable AI spoke (runs SeaClaw, talks to hub)
- **Zero cloud dependency** for local-tagged agents
- **Tailscale mesh** connects all devices securely without port forwarding
- **Sub-50ms cold start** means spokes can sleep and wake on demand

This is the "lean clean mean machine" — a TypeScript hub with C spokes.
