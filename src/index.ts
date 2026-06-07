#!/usr/bin/env node
// junglescout-mcp — stdio entry. Tool registrations live in createServer.ts so the
// HTTP entry (http.ts) can reuse them for remote / Cowork connectors.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./createServer.js";

const server = createServer();
await server.connect(new StdioServerTransport());
