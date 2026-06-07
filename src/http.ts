// src/http.ts
// Streamable HTTP entry point so the server can be hosted and registered as a
// remote MCP connector (works in Cowork / web sessions, not just local stdio).
// Stateless pattern: a fresh server + transport per request.
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./createServer.js";

const app = express();
app.use(express.json());

// Simple token gate. Set MCP_AUTH_TOKEN in the host's env. The token may be
// supplied either via `Authorization: Bearer <token>` OR a `?token=<token>`
// query param. The query-param path exists because some MCP connector UIs
// (e.g. Claude's "Add custom connector") accept only a URL and cannot send a
// custom auth header, so the secret travels in the connector URL instead.
const AUTH = process.env["MCP_AUTH_TOKEN"];

function isAuthorized(req: express.Request): boolean {
  if (!AUTH) return true;
  if (req.headers.authorization === `Bearer ${AUTH}`) return true;
  if (req.query["token"] === AUTH) return true;
  return false;
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/mcp", async (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized" },
      id: null,
    });
  }

  try {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    process.stderr.write(`[junglescout-mcp] request error: ${String(err)}\n`);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal error" },
        id: null,
      });
    }
  }
});

const PORT = Number(process.env["PORT"] || 3000);
app.listen(PORT, () => process.stderr.write(`[junglescout-mcp] HTTP listening on :${PORT}\n`));
