# SeaClip

**Hub-Spoke AI Agent Orchestration for On-Prem Edge Mesh**

SeaClip is a self-hosted AI agent orchestration platform built for the **SpaceClaw / SeaClaw** architecture. It connects a central hub (Express API + React dashboard) to a constellation of edge spokes — Raspberry Pis, Jetson boards, phones, laptops — and coordinates AI agents running locally via Ollama, Agent Zero, and custom adapters.

SeaClip is a hardened fork of [Paperclip AI](https://github.com/paperclip-ai/paperclip), re-architected for federated, privacy-first, on-premises deployments where every compute node and every model run stays within your network.

---

## Features

| Feature | Description |
|---|---|
| **Edge Mesh Dashboard** | Real-time visibility into all spoke devices — status, telemetry, resource usage |
| **Ollama Integration** | Route tasks to local models (llama3, mistral, gemma2, etc.) with GPU tracking |
| **Agent Zero Support** | Deep integration with Agent Zero sessions, memory sync, and tool call logging |
| **Telegram Bridge** | Bot-based command interface and push notifications for your agent fleet |
| **Multi-Hub Federation** | Link multiple SeaClip hubs so task routing spans physical sites |
| **Budget Control** | Per-agent cost tracking (tokens, compute time) with configurable spending limits |
| **Governance** | Issue lifecycle (backlog → done), audit log, RBAC per company |

---

## Architecture

```
┌─────────────────────────────────────────┐
│  React Dashboard (Vite)                  │
│  Edge Mesh · Agents · Issues · Costs     │
├─────────────────────────────────────────┤
│  Express.js REST API + WebSocket         │
│  Routes · Services · Adapters            │
├─────────────────────────────────────────┤
│  PostgreSQL (Drizzle ORM)                │
│  Companies · Agents · Issues · Devices   │
├─────────────────────────────────────────┤
│  Adapters                                │
│  SeaClaw · Ollama · Agent Zero           │
│  Telegram · Process · HTTP               │
└─────────────────────────────────────────┘
       │              │              │
   ┌───┴───┐    ┌────┴────┐   ┌────┴────┐
   │  Pi   │    │ Jetson  │   │  Phone  │
   │ Spoke │    │  Spoke  │   │  Spoke  │
   └───────┘    └─────────┘   └─────────┘
```

The **hub** is this server. It holds state, runs the dashboard, and dispatches tasks.  
Each **spoke** is an edge device that runs one or more agents, sending periodic heartbeats and telemetry back to the hub.

---

## Quick Start

### Option A — npx (zero install)

```bash
npx seaclip onboard   # interactive setup wizard
seaclip doctor        # verify system health
seaclip run           # start the server
```

### Option B — from source

```bash
git clone https://github.com/your-org/seaclip.git
cd seaclip
pnpm install
pnpm build

# Set up CLI globally (one-time)
pnpm setup
source ~/.bashrc
cd cli && pnpm link --global && cd ..

# Run onboarding (optional)
seaclip onboard

# Start dev server + UI
pnpm dev
```

The server runs at `http://localhost:3001` (API) and UI at `http://localhost:3100` (Vite dev server with proxy to API).

### Option C — Docker Compose

```bash
git clone https://github.com/your-org/seaclip.git
cd seaclip
cp .env.example .env          # edit OLLAMA_BASE_URL, TELEGRAM_BOT_TOKEN, etc.
docker compose up -d
open http://localhost:3100
```

The UI is served by the same process at `http://localhost:3100`.

---

## CLI Reference

```
seaclip onboard             Interactive setup wizard
seaclip run                 Start the server
seaclip doctor              Check system health
seaclip configure           Reconfigure settings interactively
seaclip configure --show    Print current config (secrets redacted)
seaclip configure --set k=v Set a specific config key
seaclip db:backup           Backup the database
seaclip company list        List companies
seaclip company create      Create a company
seaclip agent list          List agents for a company
seaclip agent invoke <id>   Manually invoke an agent heartbeat
seaclip device list         List edge devices
seaclip device register     Register a new edge device
seaclip device ping <id>    Ping an edge device
seaclip hub list            List federated hubs
seaclip hub register        Register a remote hub
```

---

## Adapters

SeaClip dispatches work to agents through **adapters** — pluggable drivers that know how to communicate with a specific backend.

| Adapter | What it does |
|---|---|
| `seaclaw` | SSH + REST to SeaClaw edge nodes; full telemetry |
| `ollama` | HTTP to Ollama API; tracks model, GPU, token usage |
| `agent_zero` | Manages Agent Zero sessions; syncs memory and tool calls |
| `telegram` | Sends tasks as Telegram messages; reads replies as completions |
| `process` | Runs a local CLI command; captures stdout as result |
| `http` | Fires a webhook; expects a JSON response |

See [`doc/ADAPTERS.md`](doc/ADAPTERS.md) for full configuration reference.

---

## Configuration

SeaClip reads from `~/.seaclip/config.json` (created by `seaclip onboard`).

| Key | Description | Default |
|---|---|---|
| `server.port` | HTTP port | `3100` |
| `server.deploymentMode` | `local_trusted` or `authenticated` | `local_trusted` |
| `database.mode` | `embedded` (SQLite) or `postgres` | `embedded` |
| `database.connectionString` | PostgreSQL URL | — |
| `ollama.baseUrl` | Ollama base URL | `http://localhost:11434` |
| `telegram.botToken` | Telegram bot token | — |
| `telegram.chatId` | Default chat ID | — |
| `storage.baseDir` | Data directory | `~/.seaclip/data` |

Environment variables override config file values at runtime:

```
DATABASE_URL              OLLAMA_BASE_URL
TELEGRAM_BOT_TOKEN        TELEGRAM_CHAT_ID
SEACLIP_DEPLOYMENT_MODE   PORT
JWT_SECRET                SEACLIP_STORAGE_DIR
```

---

## Docker Deployment

```bash
# Start everything
docker compose up -d

# View logs
docker compose logs -f server

# Backup database
docker compose exec db pg_dump -U seaclip seaclip > backup.sql

# Tear down (data is preserved in volumes)
docker compose down
```

### Environment variables for Docker

Copy `.env.example` to `.env` and set:

```bash
OLLAMA_BASE_URL=http://host.docker.internal:11434
TELEGRAM_BOT_TOKEN=your_bot_token
SEACLIP_DEPLOYMENT_MODE=local_trusted
JWT_SECRET=change-me-in-production
```

---

## Hub-Spoke Architecture

A **hub** is a full SeaClip installation — it runs the API, dashboard, and database.  
A **spoke** is a lightweight agent process running on an edge device. It connects to a hub, polls for tasks, and reports telemetry.

Multiple hubs can be linked for **federation**: tasks can be routed across sites, and a dashboard on one hub can observe agents registered on another.

See [`doc/HUB-FEDERATION.md`](doc/HUB-FEDERATION.md) and [`doc/EDGE-MESH.md`](doc/EDGE-MESH.md) for protocol details.

---

## Connecting Edge Devices

Connect Raspberry Pi, Jetson boards, laptops, or any Linux device to your SeaClip hub:

### Quick Start

1. **Download the spoke agent script** to your edge device:
   ```bash
   curl -O http://YOUR_HUB_IP:3001/spoke-agent.sh
   chmod +x spoke-agent.sh
   ```

2. **Configure and run**:
   ```bash
   export SEACLIP_HUB_URL="http://YOUR_HUB_IP:3001"
   export SEACLIP_COMPANY_ID="your-company-id"
   export SEACLIP_DEVICE_TYPE="raspberry-pi"  # or jetson, laptop, container, etc.
   ./spoke-agent.sh
   ```

3. **Verify** — Your device will appear automatically in the Edge Mesh dashboard at `http://YOUR_HUB_IP:3100/edge-mesh`

### Via UI

1. Navigate to **Edge Mesh** in the dashboard
2. Click **"Register Device"**
3. Follow the on-screen instructions with pre-filled commands
4. Run the script on your device
5. Device appears automatically — no manual registration needed!

### What the Spoke Agent Does

- ✅ Registers device with hub (one-time)
- ✅ Sends telemetry every 30 seconds (CPU, RAM, disk, temperature)
- ✅ Polls for tasks every 10 seconds
- ✅ Executes assigned tasks and reports results
- ✅ Automatically reconnects if connection drops

### Supported Devices

| Device Type | Example Use Cases |
|-------------|-------------------|
| `raspberry-pi` | Home automation, IoT sensors, edge AI |
| `jetson` | Computer vision, GPU-accelerated inference |
| `laptop` | Mobile development, testing, on-the-go agents |
| `server` | High-performance computing, data processing |
| `container` | Containerized AI agents (Docker, Podman) |
| `vm` | Cloud instances, virtual machines |

### Run as System Service

For production deployments, run the spoke agent as a systemd service:

```bash
sudo nano /etc/systemd/system/seaclip-spoke.service
```

```ini
[Unit]
Description=SeaClip Spoke Agent
After=network.target

[Service]
Type=simple
User=pi
Environment="SEACLIP_HUB_URL=http://YOUR_HUB_IP:3001"
Environment="SEACLIP_COMPANY_ID=your-company-id"
Environment="SEACLIP_DEVICE_TYPE=raspberry-pi"
ExecStart=/home/pi/spoke-agent.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable seaclip-spoke
sudo systemctl start seaclip-spoke
```

For detailed setup instructions, see [`doc/SPOKE-AGENT-SETUP.md`](doc/SPOKE-AGENT-SETUP.md).

---

## Development

```bash
pnpm install
pnpm dev                  # starts server + UI in parallel via scripts/dev-runner.mjs
pnpm build                # full production build
pnpm test                 # run tests
pnpm lint                 # ESLint + Prettier check
```

### Repository structure

```
seaclip/
├── cli/            CLI tool (@seaclip/cli)
├── server/         Express API + adapters + Drizzle schema
├── ui/             React + Vite dashboard
├── shared/         Shared types and utilities
├── doc/            Architecture and protocol docs
├── scripts/        Dev runner, backup scripts
├── skills/         Agent skill files (heartbeat protocol)
└── AGENTS.md       Instructions for AI coding agents
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit with conventional commits: `feat:`, `fix:`, `docs:`, `chore:`
4. Run `pnpm lint && pnpm test` before pushing
5. Open a pull request — the template will guide you

Please read [`AGENTS.md`](AGENTS.md) if you are an AI coding agent contributing to this codebase.

---

## License

MIT — see [LICENSE](LICENSE).

---

*SeaClip is part of the SpaceClaw / SeaClaw ecosystem. It is not affiliated with Paperclip AI.*
