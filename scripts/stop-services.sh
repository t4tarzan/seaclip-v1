#!/bin/bash
# SeaClip Services Stop Script

LOG_DIR="/Users/whitenoise-oc/shrirama/seaclip-v1/.seaclip/logs"

# Stop Node processes
for pidfile in "$LOG_DIR"/*.pid; do
  [ -f "$pidfile" ] && kill "$(cat "$pidfile")" 2>/dev/null && rm "$pidfile"
done

# Stop any remaining pnpm/node dev processes for seaclip
pkill -f "seaclip-v1.*tsx watch" 2>/dev/null
pkill -f "seaclip-v1.*astro dev" 2>/dev/null
pkill -f "seaclip-v1.*vite" 2>/dev/null

echo "$(date): SeaClip services stopped" >> "$LOG_DIR/startup.log"
