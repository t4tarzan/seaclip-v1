#!/usr/bin/env bash
# setup-spoke.sh — SeaClip spoke node setup for edge devices (Pi5, Jetson, etc.)
# Usage: HUB_URL=http://hub:3001 SPOKE_URL=http://spoke:3002 ./scripts/setup-spoke.sh
set -euo pipefail

HUB_URL="${HUB_URL:?Error: HUB_URL is required}"
SPOKE_URL="${SPOKE_URL:?Error: SPOKE_URL is required}"
INSTALL_DIR="${INSTALL_DIR:-/opt/seaclip-spoke}"
SERVICE_USER="${SERVICE_USER:-pi}"

echo "=== SeaClip Spoke Setup ==="
echo "Hub URL  : $HUB_URL"
echo "Spoke URL: $SPOKE_URL"
echo "Install  : $INSTALL_DIR"
echo ""

# 1. Verify Node.js >= 20
echo "[1/6] Checking Node.js version..."
NODE_VERSION=$(node --version | grep -oP '\d+' | head -1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "  ERROR: Node.js 20+ is required. Found: $(node --version)"
  exit 1
fi
echo "  Node.js $(node --version) OK"

# 2. Verify pnpm
echo "[2/6] Checking pnpm..."
if ! command -v pnpm &>/dev/null; then
  echo "  Installing pnpm..."
  npm install -g pnpm@9
fi
echo "  pnpm $(pnpm --version) OK"

# 3. Verify hub connectivity
echo "[3/6] Testing hub connectivity..."
curl -sf "$HUB_URL/api/health" | grep -q '"status":"ok"' && echo "  Hub reachable" || {
  echo "  ERROR: Cannot reach hub at $HUB_URL"
  exit 1
}

# 4. Create install directory
echo "[4/6] Setting up install directory..."
sudo mkdir -p "$INSTALL_DIR"
sudo chown "$SERVICE_USER":"$SERVICE_USER" "$INSTALL_DIR"

# 5. Write environment config
echo "[5/6] Writing .env config..."
cat > "$INSTALL_DIR/.env" << ENV
HUB_URL=$HUB_URL
SPOKE_URL=$SPOKE_URL
DEVICE_TYPE=raspberry_pi
NODE_ENV=production
PORT=3002
ENV
echo "  Config written to $INSTALL_DIR/.env"

# 6. Done
echo "[6/6] Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Copy the spoke agent bundle to $INSTALL_DIR"
echo "  2. cd $INSTALL_DIR && pnpm install"
echo "  3. pnpm start"
echo ""
echo "The spoke will register with the hub at $HUB_URL on first start."
