#!/bin/bash

################################################################################
# SeaClip Spoke Agent Connection Script
################################################################################
#
# This script enables an external AI agent to connect to a SeaClip hub server,
# register as a spoke device, authenticate, send telemetry, poll for tasks,
# and execute assigned work.
#
# USAGE:
#   1. Configure the variables below (HUB_URL, COMPANY_ID, etc.)
#   2. Make executable: chmod +x spoke-agent.sh
#   3. Run: ./spoke-agent.sh
#
# REQUIREMENTS:
#   - curl (for HTTP requests)
#   - jq (for JSON parsing)
#   - bash 4.0+
#
################################################################################

set -euo pipefail

# ============================================================================
# CONFIGURATION - EDIT THESE VALUES
# ============================================================================

# SeaClip hub server URL (no trailing slash)
HUB_URL="${SEACLIP_HUB_URL:-http://localhost:3001}"

# Company ID (get from hub dashboard or API)
COMPANY_ID="${SEACLIP_COMPANY_ID:-}"

# Device information
DEVICE_HOSTNAME="${HOSTNAME:-$(hostname)}"
DEVICE_TYPE="${SEACLIP_DEVICE_TYPE:-generic}"  # raspberry-pi, jetson, laptop, server, etc.

# Telemetry interval (seconds)
TELEMETRY_INTERVAL="${SEACLIP_TELEMETRY_INTERVAL:-30}"

# Task polling interval (seconds)
TASK_POLL_INTERVAL="${SEACLIP_TASK_POLL_INTERVAL:-10}"

# Log file
LOG_FILE="${SEACLIP_LOG_FILE:-/tmp/seaclip-spoke-agent.log}"

# State file (stores device ID and API key)
STATE_FILE="${SEACLIP_STATE_FILE:-$HOME/.seaclip-spoke-state.json}"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" | tee -a "$LOG_FILE" >&2
}

check_dependencies() {
    local missing=()
    
    command -v curl >/dev/null 2>&1 || missing+=("curl")
    command -v jq >/dev/null 2>&1 || missing+=("jq")
    
    if [ ${#missing[@]} -gt 0 ]; then
        error "Missing required dependencies: ${missing[*]}"
        error "Install with: sudo apt-get install ${missing[*]}"
        exit 1
    fi
}

validate_config() {
    if [ -z "$COMPANY_ID" ]; then
        error "COMPANY_ID is required. Set SEACLIP_COMPANY_ID environment variable."
        exit 1
    fi
    
    log "Configuration validated"
    log "  Hub URL: $HUB_URL"
    log "  Company ID: $COMPANY_ID"
    log "  Device: $DEVICE_HOSTNAME ($DEVICE_TYPE)"
}

get_system_info() {
    local cpu_cores ram_gb architecture os_version
    
    cpu_cores=$(nproc 2>/dev/null || echo "1")
    ram_gb=$(free -g 2>/dev/null | awk '/^Mem:/{print $2}' || echo "1")
    architecture=$(uname -m)
    
    # Get OS version and strip ANSI escape sequences and control characters
    os_version=$(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"' -f2 | sed 's/\x1b\[[0-9;]*m//g' | tr -cd '[:print:]' | tr -d '\n\r\t' || uname -s)
    
    # Use jq to properly escape JSON strings
    jq -n \
        --arg cpu "$cpu_cores" \
        --arg ram "$ram_gb" \
        --arg arch "$architecture" \
        --arg os "$os_version" \
        '{cpuCores: ($cpu | tonumber), ramGb: ($ram | tonumber), architecture: $arch, osVersion: $os}'
}

get_telemetry() {
    local cpu_percent memory_percent disk_percent uptime_seconds
    local temperature_celsius network_bytes_in network_bytes_out
    
    # CPU usage
    cpu_percent=$(top -bn1 2>/dev/null | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 || echo "0")
    
    # Memory percentage
    memory_percent=$(free 2>/dev/null | awk '/^Mem:/{printf "%.1f", ($3/$2)*100}' || echo "0")
    
    # Disk percentage
    disk_percent=$(df / 2>/dev/null | awk 'NR==2 {print $5}' | sed 's/%//' || echo "0")
    
    # Uptime
    uptime_seconds=$(cat /proc/uptime 2>/dev/null | awk '{print int($1)}' || echo "0")
    
    # CPU temperature (if available)
    temperature_celsius=$(cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null | awk '{print $1/1000}' || echo "0")
    
    # Network stats (bytes in/out)
    network_bytes_in=$(cat /sys/class/net/eth0/statistics/rx_bytes 2>/dev/null || echo "0")
    network_bytes_out=$(cat /sys/class/net/eth0/statistics/tx_bytes 2>/dev/null || echo "0")
    
    cat <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "cpuPercent": $cpu_percent,
  "memoryPercent": $memory_percent,
  "diskPercent": $disk_percent,
  "temperatureCelsius": $temperature_celsius,
  "networkBytesIn": $network_bytes_in,
  "networkBytesOut": $network_bytes_out,
  "uptimeSeconds": $uptime_seconds
}
EOF
}

# ============================================================================
# DEVICE REGISTRATION
# ============================================================================

register_device() {
    log "Registering device with hub..."
    
    local ip_address
    ip_address=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")
    
    local payload
    payload=$(cat <<EOF
{
  "name": "$DEVICE_HOSTNAME",
  "deviceType": "$DEVICE_TYPE",
  "ipAddress": "$ip_address",
  "metadata": $(get_system_info)
}
EOF
)
    
    local response
    response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$HUB_URL/api/companies/$COMPANY_ID/edge-devices" \
        -H "Content-Type: application/json" \
        -d "$payload" 2>&1)
    
    local http_code
    http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    response=$(echo "$response" | sed '/HTTP_CODE:/d')
    
    if [ "$http_code" != "201" ] && [ "$http_code" != "200" ]; then
        error "Failed to register device (HTTP $http_code): $response"
        error "Payload sent: $payload"
        return 1
    fi
    
    local device_id
    device_id=$(echo "$response" | jq -r '.id // empty')
    
    if [ -z "$device_id" ]; then
        error "Invalid registration response: $response"
        return 1
    fi
    
    log "Device registered successfully"
    log "  Device ID: $device_id"
    
    echo "$device_id"
}

# ============================================================================
# AUTHENTICATION
# ============================================================================

authenticate_device() {
    local device_id="$1"
    
    log "Sending initial telemetry..."
    
    local telemetry
    telemetry=$(get_telemetry)
    
    local response
    response=$(curl -s -X POST "$HUB_URL/api/companies/$COMPANY_ID/edge-devices/$device_id/telemetry" \
        -H "Content-Type: application/json" \
        -d "$telemetry" 2>&1)
    
    if [ $? -ne 0 ]; then
        log "Warning: Failed to send initial telemetry: $response"
    else
        log "Initial telemetry sent successfully"
    fi
    
    # Use device ID as the API key for now
    echo "$device_id"
}

# ============================================================================
# STATE MANAGEMENT
# ============================================================================

save_state() {
    local device_id="$1"
    local api_key="$2"
    
    cat > "$STATE_FILE" <<EOF
{
  "deviceId": "$device_id",
  "apiKey": "$api_key",
  "hubUrl": "$HUB_URL",
  "companyId": "$COMPANY_ID",
  "registeredAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    
    chmod 600 "$STATE_FILE"
    log "State saved to $STATE_FILE"
}

load_state() {
    if [ ! -f "$STATE_FILE" ]; then
        return 1
    fi
    
    local device_id api_key
    device_id=$(jq -r '.deviceId // empty' "$STATE_FILE")
    api_key=$(jq -r '.apiKey // empty' "$STATE_FILE")
    
    if [ -z "$device_id" ] || [ -z "$api_key" ]; then
        return 1
    fi
    
    log "Loaded existing state"
    log "  Device ID: $device_id"
    
    echo "$device_id"
    echo "$api_key"
    return 0
}

# ============================================================================
# TELEMETRY REPORTING
# ============================================================================

send_telemetry() {
    local device_id="$1"
    local api_key="$2"
    
    local telemetry
    telemetry=$(get_telemetry)
    
    local response
    response=$(curl -s -X POST "$HUB_URL/api/companies/$COMPANY_ID/edge-devices/$device_id/telemetry" \
        -H "X-SeaClip-Device-Id: $device_id" \
        -H "X-SeaClip-Key: $api_key" \
        -H "Content-Type: application/json" \
        -d "$telemetry" 2>&1)
    
    if [ $? -ne 0 ]; then
        error "Failed to send telemetry: $response"
        return 1
    fi
    
    log "Telemetry sent successfully"
    return 0
}

# ============================================================================
# TASK POLLING & EXECUTION
# ============================================================================

poll_tasks() {
    local device_id="$1"
    local api_key="$2"
    
    local response
    response=$(curl -s -X GET "$HUB_URL/api/spoke/$device_id/tasks" \
        -H "X-SeaClip-Device-Id: $device_id" \
        -H "X-SeaClip-Key: $api_key" 2>&1)
    
    if [ $? -ne 0 ]; then
        error "Failed to poll tasks: $response"
        return 1
    fi
    
    local task_count
    task_count=$(echo "$response" | jq -r '.count // 0')
    
    if [ "$task_count" -gt 0 ]; then
        log "Found $task_count task(s)"
        echo "$response"
    fi
    
    return 0
}

execute_task() {
    local device_id="$1"
    local api_key="$2"
    local task="$3"
    
    local issue_id title description
    issue_id=$(echo "$task" | jq -r '.issueId')
    title=$(echo "$task" | jq -r '.title')
    description=$(echo "$task" | jq -r '.description')
    
    log "Executing task: $title"
    log "  Issue ID: $issue_id"
    log "  Description: $description"
    
    # ========================================================================
    # TASK EXECUTION LOGIC
    # ========================================================================
    # This is where your AI agent would process the task.
    # For this example, we'll simulate task execution.
    # 
    # In a real implementation, you would:
    # 1. Parse the task requirements
    # 2. Execute the appropriate agent logic
    # 3. Generate results/output
    # 4. Send feedback to hub
    # ========================================================================
    
    log "Task execution started..."
    sleep 2  # Simulate work
    
    local result
    result="Task '$title' completed successfully. This is a simulated response from the spoke agent."
    
    log "Task execution completed"
    
    # Send feedback to hub
    send_feedback "$device_id" "$api_key" "$issue_id" "done" "$result"
}

send_feedback() {
    local device_id="$1"
    local api_key="$2"
    local issue_id="$3"
    local status="$4"
    local comment="$5"
    
    local payload
    payload=$(cat <<EOF
{
  "issueId": "$issue_id",
  "status": "$status",
  "comment": "$comment"
}
EOF
)
    
    local response
    response=$(curl -s -X POST "$HUB_URL/api/spoke/$device_id/feedback" \
        -H "X-SeaClip-Device-Id: $device_id" \
        -H "X-SeaClip-Key: $api_key" \
        -H "Content-Type: application/json" \
        -d "$payload" 2>&1)
    
    if [ $? -ne 0 ]; then
        error "Failed to send feedback: $response"
        return 1
    fi
    
    log "Feedback sent successfully for issue $issue_id"
    return 0
}

# ============================================================================
# MAIN LOOP
# ============================================================================

run_telemetry_loop() {
    local device_id="$1"
    local api_key="$2"
    
    log "Starting telemetry loop (interval: ${TELEMETRY_INTERVAL}s)"
    
    while true; do
        send_telemetry "$device_id" "$api_key" || true
        sleep "$TELEMETRY_INTERVAL"
    done
}

run_task_loop() {
    local device_id="$1"
    local api_key="$2"
    
    log "Starting task polling loop (interval: ${TASK_POLL_INTERVAL}s)"
    
    while true; do
        local tasks
        tasks=$(poll_tasks "$device_id" "$api_key" 2>/dev/null || echo "")
        
        if [ -n "$tasks" ]; then
            local task_count
            task_count=$(echo "$tasks" | jq -r '.count // 0')
            
            if [ "$task_count" -gt 0 ]; then
                # Process each task
                echo "$tasks" | jq -c '.data[]' | while read -r task; do
                    execute_task "$device_id" "$api_key" "$task" || true
                done
            fi
        fi
        
        sleep "$TASK_POLL_INTERVAL"
    done
}

cleanup() {
    log "Shutting down spoke agent..."
    
    # Kill background jobs
    jobs -p | xargs -r kill 2>/dev/null || true
    
    log "Spoke agent stopped"
    exit 0
}

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

main() {
    log "=========================================="
    log "SeaClip Spoke Agent Starting"
    log "=========================================="
    
    # Check dependencies
    check_dependencies
    
    # Validate configuration
    validate_config
    
    # Set up signal handlers
    trap cleanup SIGINT SIGTERM
    
    # Try to load existing state
    local device_id api_key
    if load_state; then
        read -r device_id api_key < <(load_state)
        log "Using existing device registration"
    else
        log "No existing state found, registering new device..."
        
        # Register device
        device_id=$(register_device)
        
        if [ -z "$device_id" ]; then
            error "Device registration failed"
            exit 1
        fi
        
        # Send initial telemetry
        api_key=$(authenticate_device "$device_id")
        
        if [ -z "$api_key" ]; then
            error "Device authentication failed"
            exit 1
        fi
        
        # Save state
        save_state "$device_id" "$api_key"
    fi
    
    log "Device ready: $device_id"
    log "Starting background loops..."
    
    # Start telemetry loop in background
    run_telemetry_loop "$device_id" "$api_key" &
    local telemetry_pid=$!
    log "Telemetry loop started (PID: $telemetry_pid)"
    
    # Start task polling loop in background
    run_task_loop "$device_id" "$api_key" &
    local task_pid=$!
    log "Task loop started (PID: $task_pid)"
    
    log "=========================================="
    log "Spoke agent is now operational"
    log "Press Ctrl+C to stop"
    log "=========================================="
    
    # Wait for background jobs
    wait
}

# Run main function
main "$@"
