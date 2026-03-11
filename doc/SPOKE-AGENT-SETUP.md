# SeaClip Spoke Agent Setup Guide

This guide explains how to connect edge devices (Raspberry Pi, Jetson boards, laptops, containers, etc.) to your SeaClip hub as spoke devices.

---

## What is a Spoke Agent?

A **spoke agent** is a lightweight script that runs on edge devices to:
- Register the device with the SeaClip hub
- Report system telemetry (CPU, RAM, disk usage)
- Poll for tasks assigned to agents on the device
- Execute tasks and report results back to the hub

---

## Prerequisites

### System Requirements
- Linux-based OS (Debian, Ubuntu, Raspbian, etc.)
- Bash 4.0+
- Internet connection to reach the SeaClip hub

### Install Dependencies
```bash
sudo apt-get update
sudo apt-get install -y curl jq
```

### Get Your Company ID
From the SeaClip hub, get your company ID:

```bash
curl http://YOUR_HUB_IP:3001/api/companies | jq -r '.data[0].id'
```

---

## Installation

### Step 1: Download the Spoke Agent Script

**Option A: Download from Hub (Recommended)**
```bash
# Download directly from your running SeaClip hub
curl -O http://YOUR_HUB_IP:3001/spoke-agent.sh
chmod +x spoke-agent.sh
```

**Option B: Copy from Repository**
```bash
# If you have the SeaClip repository cloned
cp /path/to/seaclip/scripts/spoke-agent.sh ~/
chmod +x spoke-agent.sh
```

**Option C: Via UI**
1. Navigate to **Edge Mesh** in the SeaClip dashboard
2. Click **"Register Device"**
3. Click **"Download Script"** button
4. Transfer the downloaded file to your edge device

### Step 2: Configure Environment Variables

```bash
# Required: SeaClip hub URL
export SEACLIP_HUB_URL="http://YOUR_HUB_IP:3001"

# Required: Your company ID
export SEACLIP_COMPANY_ID="your-company-id-here"

# Optional: Device type (for organization)
export SEACLIP_DEVICE_TYPE="raspberry-pi"  # or jetson, laptop, container, etc.

# Optional: Telemetry interval (default: 30 seconds)
export SEACLIP_TELEMETRY_INTERVAL="30"

# Optional: Task polling interval (default: 10 seconds)
export SEACLIP_TASK_POLL_INTERVAL="10"
```

### Step 3: Run the Spoke Agent

```bash
./spoke-agent.sh
```

**What happens:**
1. ✅ Device registers with the hub
2. ✅ Receives a unique device ID and API key
3. ✅ Saves state to `~/.seaclip-spoke-state.json`
4. ✅ Starts telemetry reporting (every 30s)
5. ✅ Starts task polling (every 10s)

---

## Verify Device Registration

### Check in the UI
1. Navigate to **Edge Mesh > Devices** in the SeaClip dashboard
2. You should see your device listed with status "Online"
3. View real-time telemetry (CPU, RAM, disk usage)

### Check via API
```bash
# Get device ID from state file
DEVICE_ID=$(jq -r '.deviceId' ~/.seaclip-spoke-state.json)

# Check device status
curl "http://YOUR_HUB_IP:3001/api/companies/YOUR_COMPANY_ID/devices/$DEVICE_ID" | jq
```

---

## Register Agents on the Device

Once the device is connected, register agents that will run on it:

### Via UI
1. Go to **Agents** page
2. Click **New Agent**
3. Fill in the form:
   - **Name:** My Edge Agent
   - **Adapter Type:** External Agent (or appropriate type)
   - **Device:** Select your registered device
   - **Config:** Agent-specific configuration

### Via API
```bash
curl -X POST "http://YOUR_HUB_IP:3001/api/companies/YOUR_COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Edge Agent",
    "role": "engineer",
    "title": "Edge AI agent",
    "adapterType": "external_agent",
    "deviceId": "YOUR_DEVICE_ID",
    "adapterConfig": {
      "baseUrl": "http://localhost:8000",
      "protocol": "https",
      "authType": "api-key",
      "apiKey": "your-agent-api-key"
    },
    "heartbeatEnabled": true,
    "environment": "local"
  }'
```

---

## Run as a System Service

For production deployments, run the spoke agent as a systemd service:

### Create Service File

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
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### Enable and Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable seaclip-spoke
sudo systemctl start seaclip-spoke
sudo systemctl status seaclip-spoke
```

### View Logs

```bash
# Real-time logs
sudo journalctl -u seaclip-spoke -f

# Recent logs
sudo journalctl -u seaclip-spoke -n 100
```

---

## Task Execution

When a task is assigned to an agent on this device:

1. **Hub** marks the issue as assigned
2. **Spoke agent** polls and receives the task
3. **Spoke agent** forwards task to the agent's API endpoint
4. **Agent** processes the task
5. **Agent** returns result
6. **Spoke agent** reports result back to hub
7. **Hub** marks issue as completed

### Customize Task Execution

The spoke agent script has a placeholder for task execution (line 350-373). Modify this section to integrate with your specific agent:

```bash
execute_task() {
    local device_id="$1"
    local api_key="$2"
    local task="$3"
    
    local issue_id title description
    issue_id=$(echo "$task" | jq -r '.issueId')
    title=$(echo "$task" | jq -r '.title')
    description=$(echo "$task" | jq -r '.description')
    
    # ========================================================================
    # CUSTOMIZE THIS SECTION FOR YOUR AGENT
    # ========================================================================
    
    # Example: Forward to local AI agent
    result=$(curl -X POST "http://localhost:8000/execute" \
        -H "Content-Type: application/json" \
        -d "{\"task\": \"$description\"}" | jq -r '.result')
    
    # Send feedback to hub
    send_feedback "$device_id" "$api_key" "$issue_id" "done" "$result"
}
```

---

## Troubleshooting

### Device Not Registering

```bash
# Check hub is reachable
curl http://YOUR_HUB_IP:3001/health

# Verify company ID
curl http://YOUR_HUB_IP:3001/api/companies | jq

# Check spoke agent logs
tail -f /tmp/seaclip-spoke-agent.log
```

### Telemetry Not Sending

```bash
# Check state file exists
cat ~/.seaclip-spoke-state.json | jq

# Test telemetry manually
curl -X POST "http://YOUR_HUB_IP:3001/api/devices/telemetry" \
  -H "X-SeaClip-Device-Id: YOUR_DEVICE_ID" \
  -H "X-SeaClip-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"timestamp":"2026-03-11T12:00:00Z","cpuPercent":10,"ramUsedGb":1,"ramTotalGb":8,"diskUsedGb":10,"diskTotalGb":100,"uptimeSeconds":1000,"agentStatuses":{}}'
```

### Tasks Not Received

```bash
# Check if tasks are assigned to agents on this device
curl "http://YOUR_HUB_IP:3001/api/spoke/YOUR_DEVICE_ID/tasks" \
  -H "X-SeaClip-Device-Id: YOUR_DEVICE_ID" \
  -H "X-SeaClip-Key: YOUR_API_KEY"
```

---

## Device Types

The spoke agent works with any Linux device:

| Device Type | Example Use Case |
|-------------|------------------|
| `raspberry-pi` | Home automation, IoT sensors |
| `jetson` | Computer vision, edge AI |
| `laptop` | Mobile development, testing |
| `server` | High-performance computing |
| `container` | Containerized AI agents |
| `vm` | Cloud instances, virtual machines |

---

## Security Considerations

1. **API Keys:** Stored in `~/.seaclip-spoke-state.json` with 600 permissions
2. **Network:** Use HTTPS for production deployments
3. **Firewall:** Ensure outbound access to hub on port 3001
4. **Authentication:** Each device has a unique API key

---

## Next Steps

1. ✅ Install spoke agent on your edge device
2. ✅ Verify device appears in the dashboard
3. ✅ Register agents on the device
4. ✅ Create and assign tasks
5. ✅ Monitor execution in real-time

For more information, see:
- [Edge Mesh Protocol](./EDGE-MESH.md)
- [Adapter Documentation](./ADAPTERS.md)
- [Hub Federation](./HUB-FEDERATION.md)
