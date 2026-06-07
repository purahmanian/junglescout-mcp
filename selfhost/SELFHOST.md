# Self-host JungleScout MCP on the Mac mini (Tailscale Funnel)

Run the MCP on your own hardware — **$0/mo, always-on, API key never leaves the mini** —
and let Claude (Cowork included) reach it over Tailscale Funnel. Matches your existing
local-cloud convention (`com.*.server` LaunchAgents, logs in `~/Library/Logs/`).

## Why Funnel
Your tailnet is private — Claude's cloud isn't on it, so a plain Tailscale IP won't work for
Cowork sessions. **Funnel** publishes one port to a public HTTPS URL
(`https://<machine>.<tailnet>.ts.net`) with TLS handled for you. No Cloudflare, no
port-forwarding, no exposed home IP. The bearer token keeps it private to you.

## One-time tailnet prerequisite
Funnel must be allowed for this node. In the Tailscale admin console (or your
`local-cloud-setup/tailscale-acl.jsonc`) ensure HTTPS certs are enabled and the mini has the
Funnel attribute, e.g.:
```jsonc
"nodeAttrs": [
  { "target": ["tag:hub", "the-mac-mini"], "attr": ["funnel"] }
]
```
Then in Tailscale admin: **DNS → enable HTTPS certificates**, and **Funnel** is on for the node.

## Setup (on the mini)
```bash
# 1. Clone the repo
git clone https://github.com/purahmanian/junglescout-mcp.git
cd junglescout-mcp

# 2. Configure env (rotate your JS key first!)
cp selfhost/.env.example selfhost/.env
#   edit selfhost/.env → JUNGLESCOUT_API_KEY + JUNGLESCOUT_KEY_NAME
#   leave MCP_AUTH_TOKEN blank (auto-generated)

# 3. Run the installer (idempotent)
bash selfhost/selfhost-setup.sh
```
The script: builds the project, writes + loads the `com.thewav.junglescout-mcp` LaunchAgent
(RunAtLoad + KeepAlive, logs in `~/Library/Logs/junglescout-mcp/`), waits for `/health`,
turns on Funnel, generates the bearer token, and disables sleep on AC. It prints your public
`/mcp` URL and the token at the end.

## Register the connector in Claude
**Settings → Connectors → Add custom connector**
- **URL:** `https://<machine>.<tailnet>.ts.net/mcp`
- **Auth header:** `Authorization: Bearer <MCP_AUTH_TOKEN>`

Then the 5 tools appear in every session: `keyword_search_volume`, `keywords_by_asin`,
`product_database_query`, `sales_estimates`, `share_of_voice`.

## Ops
| Action | Command |
|---|---|
| Restart | `launchctl kickstart -k gui/$(id -u)/com.thewav.junglescout-mcp` |
| Logs | `tail -f ~/Library/Logs/junglescout-mcp/err.log` |
| Public URL | `tailscale funnel status` |
| Stop service | `launchctl bootout gui/$(id -u)/com.thewav.junglescout-mcp` |
| Turn off Funnel | `tailscale funnel --https=443 off` |
| Update + redeploy | `git pull && npm install && npm run build && launchctl kickstart -k gui/$(id -u)/com.thewav.junglescout-mcp` |

## Notes
- **Keep the bearer token on.** Funnel URLs (`machine.tailnet.ts.net`) are somewhat guessable,
  so the token is what keeps your JungleScout quota private. Don't blank it here.
- **Always-on = mini uptime.** The LaunchAgent auto-starts on boot/login and restarts on crash;
  `pmset` keeps the mini awake on AC. If the mini is off, the connector is down (expected).
- **Cost:** $0/mo. You pay only your own JungleScout API usage, same as before.
- **Desktop-only alternative:** if you ever want it *only* in Claude Desktop (not Cowork), you
  can skip Funnel entirely and use the stdio binary via the desktop MCP config — but Funnel is
  required for Cowork/web.

## Troubleshooting
- `/health` ok but tools absent → connector URL must end in **`/mcp`**.
- 401 → token mismatch; re-copy `MCP_AUTH_TOKEN` from `selfhost/.env`.
- Funnel "command failed" → tailnet prerequisite above (HTTPS certs + funnel nodeAttr) not set.
- Tools say "not set" instead of data → key vars missing/blank in `selfhost/.env` (re-run script).
