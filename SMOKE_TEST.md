# Live smoke test: junglescout-mcp

Run this the moment you have Jungle Scout API access. It exercises all 5 tools
against the real Jungle Scout Cobalt/Developer API. These are manual checks only.
The automated test suite stays fully mocked and must never make live calls.

## Prerequisites

Requires a Jungle Scout plan with API access. Create an API key in the Jungle
Scout API settings; you get a key name and a key secret.

```bash
cd junglescout-mcp
npm install
npm run build
export JUNGLESCOUT_API_KEY="your-key-secret"
export JUNGLESCOUT_KEY_NAME="your-key-name"
```

The client sends `Authorization: <KEY_NAME>:<API_KEY>`, `X-API-Type: junglescout`,
content type `application/vnd.api+json`, marketplace defaults to `us`.

## Option A: MCP Inspector CLI (recommended, no extra files)

List tools (no key needed, proves the server starts):

```bash
npx @modelcontextprotocol/inspector --cli node dist/index.js --method tools/list
```

Call each tool. Substitute a current ASIN if the example is stale.

```bash
# 1. keyword_search_volume
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method tools/call --tool-name keyword_search_volume \
  --tool-arg keywords='["jigsaw puzzle","puzzle mat"]'

# 2. keywords_by_asin
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method tools/call --tool-name keywords_by_asin --tool-arg asin=B08N5WRWNW

# 3. product_database_query (find opportunities)
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method tools/call --tool-name product_database_query \
  --tool-arg category="Toys & Games" --tool-arg min_revenue=10000

# 4. sales_estimates
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method tools/call --tool-name sales_estimates --tool-arg asin=B08N5WRWNW

# 5. share_of_voice
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method tools/call --tool-name share_of_voice --tool-arg keyword="jigsaw puzzle"
```

If the inspector cannot pass an array via --tool-arg in your shell, use the
inspector UI instead: `npx @modelcontextprotocol/inspector node dist/index.js`,
then open the printed localhost URL and call the tools from the form.

## What "pass" looks like

- tools/list returns 5 tools: keyword_search_volume, keywords_by_asin,
  product_database_query, sales_estimates, share_of_voice.
- keyword_search_volume returns exact-match volume plus 30/90 day trends.
- keywords_by_asin returns a keyword list for the ASIN.
- product_database_query returns matching products.
- sales_estimates returns an estimated monthly sales figure.
- share_of_voice returns brand share for the keyword.
- No "missing JUNGLESCOUT_API_KEY", 401/403 auth, or unexpected-shape errors.

## If something is wrong

The Jungle Scout client has NOT been verified against the live API before this
test. If a tool returns an auth error, recheck the Authorization header format
(KEY_NAME:API_KEY) and X-API-Type. If a tool returns a parsing error, the likely
cause is a JSON:API attribute-name mismatch in src/. Capture the raw error, fix
the mapping, add or update a mocked fixture in tests/ to lock the fix in, then
rebuild and rerun. Keep all automated tests mocked.
