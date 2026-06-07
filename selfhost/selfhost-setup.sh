#!/usr/bin/env bash
# selfhost-setup.sh — run JungleScout MCP on this Mac (mini) as an always-on
# LaunchAgent, exposed to Claude via Tailscale Funnel. Idempotent; safe to re-run.
# Usage (from repo root):  bash selfhost/selfhost-setup.sh
set -euo pipefail
say(){ printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
warn(){ printf "\n\033[1;33m!!  %s\033[0m\n" "$*"; }
die(){ printf "\n\033[1;31mXX  %s\033[0m\n" "$*"; exit 1; }

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
ENV_FILE="$HERE/.env"
LABEL="com.thewav.junglescout-mcp"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="$HOME/Library/Logs/junglescout-mcp"

command -v node >/dev/null 2>&1 || die "node not found. 'brew install node', then re-run."
command -v npm  >/dev/null 2>&1 || die "npm not found."
command -v tailscale >/dev/null 2>&1 || die "tailscale CLI not found. Install Tailscale and 'sudo tailscale up' first."
NODE_BIN="$(command -v node)"

if [ ! -f "$ENV_FILE" ]; then
  cp "$HERE/.env.example" "$ENV_FILE"
  die "Created selfhost/.env — edit it with your (rotated) JungleScout key + key name, then re-run."
fi
set -a; source "$ENV_FILE"; set +a
: "${PORT:=3000}"
[ -n "${JUNGLESCOUT_API_KEY:-}" ] || die "JUNGLESCOUT_API_KEY is empty in selfhost/.env"
[ -n "${JUNGLESCOUT_KEY_NAME:-}" ] || warn "JUNGLESCOUT_KEY_NAME empty in selfhost/.env"

if [ -z "${MCP_AUTH_TOKEN:-}" ]; then
  MCP_AUTH_TOKEN="$(openssl rand -hex 24)"
  if grep -q '^MCP_AUTH_TOKEN=' "$ENV_FILE"; then
    sed -i '' "s|^MCP_AUTH_TOKEN=.*|MCP_AUTH_TOKEN=${MCP_AUTH_TOKEN}|" "$ENV_FILE"
  else
    echo "MCP_AUTH_TOKEN=${MCP_AUTH_TOKEN}" >> "$ENV_FILE"
  fi
  say "Generated MCP_AUTH_TOKEN (saved to selfhost/.env)"
fi

say "Building if needed (npm install + build)"
cd "$REPO"
[ -d node_modules ] || npm install
[ -f dist/http.js ] || npm run build

mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"
say "Writing + loading LaunchAgent ${LABEL}"
launchctl bootout "gui/$(id -u)/${LABEL}" >/dev/null 2>&1 || true
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array><string>${NODE_BIN}</string><string>${REPO}/dist/http.js</string></array>
  <key>WorkingDirectory</key><string>${REPO}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key><string>${PORT}</string>
    <key>JUNGLESCOUT_API_KEY</key><string>${JUNGLESCOUT_API_KEY}</string>
    <key>JUNGLESCOUT_KEY_NAME</key><string>${JUNGLESCOUT_KEY_NAME:-}</string>
    <key>MCP_AUTH_TOKEN</key><string>${MCP_AUTH_TOKEN}</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${LOG_DIR}/out.log</string>
  <key>StandardErrorPath</key><string>${LOG_DIR}/err.log</string>
</dict></plist>
PLIST

launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/${LABEL}"

say "Waiting for /health on 127.0.0.1:${PORT}"
for i in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1 && break
  sleep 1; [ "$i" = 30 ] && die "Server didn't start — check ${LOG_DIR}/err.log"
done
say "Local server up."

say "Exposing via Tailscale Funnel (public HTTPS)"
tailscale funnel --bg "${PORT}" 2>/dev/null \
  || warn "Funnel command failed — enable Funnel + HTTPS in your tailnet policy (see SELFHOST.md), then run: tailscale funnel --bg ${PORT}"
sleep 2
URL="$(tailscale funnel status 2>/dev/null | grep -Eo 'https://[^ ]+' | head -1 || true)"

say "Preventing sleep on AC so the mini stays reachable (needs sudo)"
sudo pmset -c sleep 0 disablesleep 1 2>/dev/null || warn "pmset failed; set 'prevent sleeping on power adapter' manually."

say "DONE."
cat <<DONE
  Public MCP URL : ${URL:-https://<this-machine>.<tailnet>.ts.net}/mcp
  Auth header    : Authorization: Bearer ${MCP_AUTH_TOKEN}
  Health check   : ${URL:-https://<...>.ts.net}/health   -> {"ok":true}

  Register in Claude: Settings -> Connectors -> Add custom connector
    URL    = the Public MCP URL above (must end in /mcp)
    Header = Authorization: Bearer <token above>

  Ops:
    restart : launchctl kickstart -k gui/$(id -u)/${LABEL}
    logs    : tail -f ${LOG_DIR}/err.log
    url     : tailscale funnel status
    stop    : launchctl bootout gui/$(id -u)/${LABEL}; tailscale funnel --https=443 off
DONE
