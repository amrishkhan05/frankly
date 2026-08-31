#!/usr/bin/env node
import { startMcpServer } from "./server.js";

startMcpServer().catch((error) => {
  console.error("Frankly MCP server failed:", error);
  process.exit(1);
});
