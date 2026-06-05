# junglescout-mcp

MCP server for the Jungle Scout Cobalt/Developer API: keyword search volume, ASIN keyword analysis, product database queries, sales estimates, and share of voice.

![CI](https://github.com/purahmanian/junglescout-mcp/actions/workflows/ci.yml/badge.svg)
![npm](https://img.shields.io/npm/v/junglescout-mcp)

---

> **Unofficial:** This project is not affiliated with, endorsed by, or sponsored by Jungle Scout.
> "Jungle Scout" is a trademark of Jungle Scout Group LLC. All rights belong to their respective owners.

---

## What it does

| Tool | Description | Example prompt |
|---|---|---|
| `keyword_search_volume` | Exact-match and broad-match volume for up to 100 keywords, plus 30-day trend, quarterly trend, and PPC bid estimates | "What is the search volume for 'yoga mat' and 'foam roller' on Amazon?" |
| `keywords_by_asin` | Which keywords drive traffic to a specific Amazon listing | "What keywords is ASIN B07XJ8C8F5 ranking for?" |
| `product_database_query` | Find product opportunities filtered by category, title keywords, price, minimum revenue, and max reviews | "Find Sports and Outdoors products under $40 with at least $5k monthly revenue and fewer than 300 reviews" |
| `sales_estimates` | Estimated monthly units sold and revenue for an ASIN | "How many units per month does B07XJ8C8F5 sell?" |
| `share_of_voice` | Brand share of organic and sponsored results for a keyword | "Which brands dominate the 'protein powder' keyword on Amazon?" |

---

## Quick start

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or
`%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "junglescout": {
      "command": "npx",
      "args": ["-y", "junglescout-mcp"],
      "env": {
        "JUNGLESCOUT_API_KEY": "your-api-key-here",
        "JUNGLESCOUT_KEY_NAME": "your-key-name-here"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

### Claude Code

```bash
claude mcp add junglescout \
  -e JUNGLESCOUT_API_KEY=your-api-key-here \
  -e JUNGLESCOUT_KEY_NAME=your-key-name-here \
  -- npx -y junglescout-mcp
```

### OpenAI Codex CLI

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.junglescout]
command = "npx"
args = ["-y", "junglescout-mcp"]

[mcp_servers.junglescout.env]
JUNGLESCOUT_API_KEY = "your-api-key-here"
JUNGLESCOUT_KEY_NAME = "your-key-name-here"
```

---

## Getting an API key

The Jungle Scout Developer API requires an active Jungle Scout subscription that includes API access.

<!-- AFFILIATE -->
Sign up or upgrade your Jungle Scout plan: [https://www.junglescout.com/pricing/](https://www.junglescout.com/pricing/)
<!-- /AFFILIATE -->

Once you have a plan with API access:

1. Log in to Jungle Scout and navigate to **Settings > Manage API Keys**.
2. Create a new API key. You will receive both a **Key Name** and an **API Key**.
3. Set the environment variables:

```bash
export JUNGLESCOUT_API_KEY="your-api-key-here"
export JUNGLESCOUT_KEY_NAME="your-key-name-here"
```

The server will start without credentials and tools will return setup instructions
until both variables are configured.

---

## Example conversations

**Keyword research for a new product:**

> "Give me the Amazon US search volume and PPC bid estimates for 'bamboo cutting board', 'wooden cutting board', and 'plastic cutting board'. Which has the best volume-to-competition ratio?"

The model calls `keyword_search_volume` with all three terms, compares volumes and ease-of-ranking scores, and summarizes which keyword is the best entry point.

**Competitor keyword gap analysis:**

> "I am competing with ASIN B07XJ8C8F5. What are the top 20 keywords driving traffic to that listing?"

The model calls `keywords_by_asin` and returns the ranking keywords sorted by relevancy, including organic and sponsored positions.

**Product opportunity discovery:**

> "Find me product opportunities in the Kitchen category priced between $20 and $60 with at least $8,000 monthly revenue and fewer than 150 reviews."

The model calls `product_database_query` with the filters and returns a ranked list of products with revenue, BSR, and listing quality scores.

---

## Development

```bash
# Install dependencies
npm install

# Run tests (no live API calls)
npm test

# Build
npm run build

# Run locally (credentials required for live data)
JUNGLESCOUT_API_KEY=xxx JUNGLESCOUT_KEY_NAME=yyy node dist/index.js
```

### Authentication

The Jungle Scout API uses a custom authorization format:

```
Authorization: <KEY_NAME>:<API_KEY>
X-API-Type: junglescout
Content-Type: application/vnd.api+json
Accept: application/vnd.junglescout.v1+json
```

The `Accept` header selects the API version and must be the
`application/vnd.junglescout.v1+json` media type. Sending a different
`Accept` value causes the API to return HTTP 404.

All marketplace parameters default to `us`. Other supported values include `ca`, `uk`, `de`, `fr`, `it`, `es`, `jp`, `au`, `in`, and more.

---

## Built by

Built by **Puya Ventures LLC**. I build custom MCP servers and AI integrations for
product, e-commerce, and data teams. Get in touch: purahmanian@gmail.com |
Portfolio: [puyarahmanian.com](https://puyarahmanian.com)

Part of the **Product-Research MCP Suite**:
[keepa-mcp](https://github.com/purahmanian/keepa-mcp) ·
[google-trends-mcp](https://github.com/purahmanian/google-trends-mcp) ·
[junglescout-mcp](https://github.com/purahmanian/junglescout-mcp)

---

## License

MIT. See [LICENSE](./LICENSE).
