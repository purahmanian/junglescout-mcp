// src/createServer.ts
// Factory that builds the configured JungleScout McpServer.
// Refactor: move the tool registrations out of index.ts into here so BOTH
// the stdio entry (index.ts) and the new HTTP entry (http.ts) can reuse them.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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

export function createServer(): McpServer {
  const API_KEY = process.env["JUNGLESCOUT_API_KEY"];
  const KEY_NAME = process.env["JUNGLESCOUT_KEY_NAME"];
  const client =
    API_KEY && KEY_NAME ? new JsClient({ apiKey: API_KEY, keyName: KEY_NAME }) : null;

  if (!client) {
    process.stderr.write(
      "[junglescout-mcp] JUNGLESCOUT_API_KEY and/or JUNGLESCOUT_KEY_NAME not set. " +
        "Tools will return instructions instead of live data.\n",
    );
  }

  const server = new McpServer({ name: "junglescout-mcp", version: "0.1.0" });

  server.registerTool(
    "keyword_search_volume",
    {
      description:
        "Look up exact-match and broad-match search volume for one or more Amazon keywords.",
      inputSchema: KeywordSearchVolumeSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => handleKeywordSearchVolume(args, client),
  );

  server.registerTool(
    "keywords_by_asin",
    {
      description: "Discover which keywords drive traffic to a specific Amazon listing (by ASIN).",
      inputSchema: KeywordsByAsinSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => handleKeywordsByAsin(args, client),
  );

  server.registerTool(
    "product_database_query",
    {
      description: "Search the Jungle Scout product database for Amazon product opportunities.",
      inputSchema: ProductDatabaseQuerySchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => handleProductDatabaseQuery(args, client),
  );

  server.registerTool(
    "sales_estimates",
    {
      description: "Get Jungle Scout estimated monthly sales units and revenue for a specific ASIN.",
      inputSchema: SalesEstimatesSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => handleSalesEstimates(args, client),
  );

  server.registerTool(
    "share_of_voice",
    {
      description: "Analyze brand share of voice for a given Amazon search keyword.",
      inputSchema: ShareOfVoiceSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => handleShareOfVoice(args, client),
  );

  return server;
}
