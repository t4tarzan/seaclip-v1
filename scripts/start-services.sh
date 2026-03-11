#!/bin/bash
# SeaClip Services Startup Script
# Starts: PostgreSQL (Docker), SeaClip API + UI, Marketing Site
# Called by macOS LaunchAgent on login

set -e

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
REPO="/Users/whitenoise-oc/shrirama/seaclip-v1"
LOG_DIR="$REPO/.seaclip/logs"
mkdir -p "$LOG_DIR"

# --- 1. Ensure Docker is running ---
if ! docker info &>/dev/null; then
  open -a Docker
  for i in $(seq 1 30); do
    docker info &>/dev/null && break
    sleep 2
  done
fi

# --- 2. Ensure PostgreSQL container is running ---
if ! docker ps --format '{{.Names}}' | grep -q seaclip-postgres; then
  docker start seaclip-postgres 2>/dev/null || \
  docker run -d \
    --name seaclip-postgres \
    -e POSTGRES_USER=seaclip \
    -e POSTGRES_PASSWORD=seaclip \
    -e POSTGRES_DB=seaclip \
    -p 5432:5432 \
    --restart unless-stopped \
    postgres:16-alpine
fi

# Wait for Postgres to accept connections
for i in $(seq 1 15); do
  docker exec seaclip-postgres pg_isready -U seaclip &>/dev/null && break
  sleep 1
done

# --- 3. Start SeaClip API + UI ---
cd "$REPO"
pnpm dev > "$LOG_DIR/seaclip-dev.log" 2>&1 &
echo $! > "$LOG_DIR/seaclip-dev.pid"

# --- 4. Start Marketing Site ---
cd "$REPO/site"
npx astro dev --port 4321 > "$LOG_DIR/site-dev.log" 2>&1 &
echo $! > "$LOG_DIR/site-dev.pid"

echo "$(date): All SeaClip services started" >> "$LOG_DIR/startup.log"
