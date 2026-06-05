#!/usr/bin/env node
// junglescout-mcp: MCP server wrapping the Jungle Scout Cobalt/Developer API

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { JsClient } from "./client.js";
import {
  KeywordSearchVolumeSchema,
  KeywordsByAsinSchema,
  ProductDatabaseQuerySchema,
  SalesEstimatesSchema,
  ShareOfVoiceSchema,
  handleKeywordSearchVolume,
  handleKeywordsByAsin,
  handleProductDatabaseQuery,
  handleSalesEstimates,
  handleShareOfVoice,
} from "./tools.js";

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

const API_KEY = process.env["JUNGLESCOUT_API_KEY"];
const KEY_NAME = process.env["JUNGLESCOUT_KEY_NAME"];

const client: JsClient | null =
  API_KEY && KEY_NAME
    ? new JsClient({ apiKey: API_KEY, keyName: KEY_NAME })
    : null;

if (!client) {
  process.stderr.write(
    "[junglescout-mcp] JUNGLESCOUT_API_KEY and/or JUNGLESCOUT_KEY_NAME not set. " +
      "Tools will return instructions instead of live data.\n",
  );
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "junglescout-mcp",
  version: "0.1.0",
});

// ---------------------------------------------------------------------------
// Tool: keyword_search_volume
// ---------------------------------------------------------------------------

server.registerTool(
  "keyword_search_volume",
  {
    description:
      "Look up exact-match and broad-match search volume for one or more Amazon keywords. " +
      "Returns 30-day volume, year-over-year trend, quarterly trend, PPC bid estimates, " +
      "and ease-of-ranking score. Uses the Jungle Scout keywords_by_keyword_query endpoint.",
    inputSchema: KeywordSearchVolumeSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
    },
  },
  async (args) => handleKeywordSearchVolume(args, client),
);

// ---------------------------------------------------------------------------
// Tool: keywords_by_asin
// ---------------------------------------------------------------------------

server.registerTool(
  "keywords_by_asin",
  {
    description:
      "Discover which keywords drive traffic to a specific Amazon listing (by ASIN). " +
      "Returns keyword name, search volume, organic rank, sponsored rank, and relevancy score. " +
      "Useful for competitor keyword gap analysis.",
    inputSchema: KeywordsByAsinSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
    },
  },
  async (args) => handleKeywordsByAsin(args, client),
);

// ---------------------------------------------------------------------------
// Tool: product_database_query
// ---------------------------------------------------------------------------

server.registerTool(
  "product_database_query",
  {
    description:
      "Search the Jungle Scout product database for Amazon product opportunities. " +
      "Filter by category, price range, minimum monthly revenue, and maximum review count. " +
      "Returns estimated revenue, units sold, BSR, and listing quality score per product.",
    inputSchema: ProductDatabaseQuerySchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
    },
  },
  async (args) => handleProductDatabaseQuery(args, client),
);

// ---------------------------------------------------------------------------
// Tool: sales_estimates
// ---------------------------------------------------------------------------

server.registerTool(
  "sales_estimates",
  {
    description:
      "Get Jungle Scout estimated monthly sales units and revenue for a specific Amazon ASIN. " +
      "Also returns current BSR, price, reviews, and rating to provide context for the estimate.",
    inputSchema: SalesEstimatesSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
    },
  },
  async (args) => handleSalesEstimates(args, client),
);

// ---------------------------------------------------------------------------
// Tool: share_of_voice
// ---------------------------------------------------------------------------

server.registerTool(
  "share_of_voice",
  {
    description:
      "Analyze brand share of voice for a given Amazon search keyword. " +
      "Shows which brands dominate organic and sponsored results, their combined/organic/sponsored " +
      "SOV percentages, product counts, average price, and average rating. " +
      "Useful for competitive landscape analysis.",
    inputSchema: ShareOfVoiceSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
    },
  },
  async (args) => handleShareOfVoice(args, client),
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
