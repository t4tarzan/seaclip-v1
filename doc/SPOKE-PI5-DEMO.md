# SeaClip Spoke — Raspberry Pi 5 Demo Setup

This guide walks through setting up a SeaClip spoke node on a Raspberry Pi 5, connecting it to your hub, and running an end-to-end demo.

---

## Prerequisites

- Raspberry Pi 5 (4 GB or 8 GB RAM) running Raspberry Pi OS Bookworm (64-bit)
- Network connectivity (Ethernet or Wi-Fi)
- A running SeaClip hub reachable from the Pi (Tailscale recommended)
- Node.js 20+ installed: `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - && sudo apt install -y nodejs`
- `pnpm` installed: `npm install -g pnpm`

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/t4tarzan/seaclip-v1.git
cd seaclip-v1
pnpm install
```

### 2. Configure the spoke

Copy the example environment file and edit it:

```bash
cp .env.example .env
```

Set the following values in `.env`:

```env
# Hub connection
HUB_URL=http://<your-hub-ip-or-tailscale>:3001

# This spoke's identity
SPOKE_NAME=rpi5-demo
SPOKE_ARCH=arm64

# Optional: device token issued by the hub
API_KEY=<token-from-hub>
```

---

## Configuration

### Register the spoke with the hub

Run the setup script (see `scripts/setup-spoke.sh`):

```bash
HUB_URL=http://hub.example.com:3001 SPOKE_NAME=rpi5-demo bash scripts/setup-spoke.sh
```

The script will:
1. Verify Node.js and pnpm are available
2. Install dependencies
3. Register the device with the hub via `POST /api/companies/:id/devices`
4. Print the registration token — save this as `API_KEY` in `.env`

---

## Running the Demo

### Start the spoke server

```bash
pnpm dev:server
```

Confirm the spoke appears in the hub dashboard under **Edge Mesh**.

### Trigger a demo pipeline

Use the demo script (see `scripts/demo-pipeline.sh`):

```bash
HUB_URL=http://hub.example.com:3001 bash scripts/demo-pipeline.sh
```

This will:
1. Verify hub connectivity
2. Create a test issue on the hub
3. Assign the issue to an agent running on the Pi
4. Wait for the agent to complete and log the result
5. Clean up the test issue

### Observe results

- Open the hub dashboard at `http://<hub>:5173`
- Navigate to **Edge Mesh** to see the Pi5 node
- Navigate to **Issues** to see the completed test task

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ECONNREFUSED` on hub URL | Check `HUB_URL` in `.env`, verify hub is running |
| `401 Unauthorized` | Check `API_KEY` — re-run setup script to generate a new token |
| High CPU temperature | Normal under load; the Pi5 has active cooling, ensure fan is spinning |
| `pnpm: command not found` | Run `npm install -g pnpm` then `source ~/.bashrc` |

---

## Architecture Notes

The Pi5 speaks to the hub over HTTPS (or HTTP on a trusted LAN). The hub assigns tasks via the spoke endpoint (`/api/spoke`) which requires only an `x-api-key` header — no JWT required for spoke devices.

For production deployments, connect both hub and spoke to a Tailscale network for zero-config encrypted tunneling.
