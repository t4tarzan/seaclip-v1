#!/bin/bash
################################################################################
# SeaClip Spoke — Quick Setup for shunya-agent-zero
# Run this inside the container:
#   curl -fsSL http://100.114.140.33:3001/spoke-agent.sh -o /tmp/spoke.sh
#   curl -fsSL http://100.114.140.33:3001/api/health  # test connectivity first
#   bash /tmp/setup-spoke.sh
################################################################################

set -euo pipefail

HUB_IP="100.114.140.33"
HUB_URL="http://${HUB_IP}:3001"
COMPANY_ID="203ebd27-7bb8-4a18-be62-338415b4c3ce"
DEVICE_TYPE="linux"

echo "==== SeaClip Spoke Setup ===="
echo "Hub: $HUB_URL"
echo ""

# 1. Install deps
echo "[1/4] Installing dependencies..."
if command -v apt-get &>/dev/null; then
  apt-get update -qq && apt-get install -y -qq curl jq procps >/dev/null 2>&1
elif command -v apk &>/dev/null; then
  apk add --no-cache curl jq procps >/dev/null 2>&1
elif command -v yum &>/dev/null; then
  yum install -y -q curl jq procps >/dev/null 2>&1
fi
echo "  Done."

# 2. Test connectivity
echo "[2/4] Testing hub connectivity..."
if ! curl -sf --connect-timeout 5 "$HUB_URL/health" >/dev/null 2>&1; then
  echo "  ERROR: Cannot reach hub at $HUB_URL"
  echo "  Check: is Tailscale connected? Try: ping $HUB_IP"
  exit 1
fi
echo "  Hub reachable."

# 3. Download spoke agent
echo "[3/4] Downloading spoke agent..."
curl -fsSL "$HUB_URL/spoke-agent.sh" -o /opt/spoke-agent.sh
chmod +x /opt/spoke-agent.sh
echo "  Saved to /opt/spoke-agent.sh"

# 4. Write env config
echo "[4/4] Writing config..."
cat > /opt/spoke-env.sh <<EOF
export SEACLIP_HUB_URL="$HUB_URL"
export SEACLIP_COMPANY_ID="$COMPANY_ID"
export SEACLIP_DEVICE_TYPE="$DEVICE_TYPE"
export SEACLIP_TELEMETRY_INTERVAL=30
export SEACLIP_TASK_POLL_INTERVAL=10
export SEACLIP_LOG_FILE=/var/log/seaclip-spoke.log
export SEACLIP_STATE_FILE=/opt/seaclip-spoke-state.json
EOF
chmod 600 /opt/spoke-env.sh
echo "  Config at /opt/spoke-env.sh"

echo ""
echo "==== Setup Complete ===="
echo ""
echo "To start the spoke agent:"
echo "  source /opt/spoke-env.sh && /opt/spoke-agent.sh"
echo ""
echo "To run in background:"
echo "  source /opt/spoke-env.sh && nohup /opt/spoke-agent.sh > /var/log/seaclip-spoke.log 2>&1 &"
echo ""
echo "To auto-start on boot (if systemd available):"
echo "  See below..."

# Create systemd service if systemd exists
if [ -d /etc/systemd/system ]; then
  cat > /etc/systemd/system/seaclip-spoke.service <<UNIT
[Unit]
Description=SeaClip Spoke Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/opt/spoke-env.sh
ExecStart=/opt/spoke-agent.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
UNIT
  echo "  Systemd service created. Enable with:"
  echo "    systemctl enable --now seaclip-spoke"
fi
