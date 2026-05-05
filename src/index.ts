#!/usr/bin/env node
/**
 * zzx-godot-mcp — MCP Server Entry Point
 */

import { ZzxGodotServer } from './server.js';
import { loadConfig } from './config.js';
import { registerAllTools } from './tools/registry.js';
import * as logger from './utils/logger.js';

async function main(): Promise<void> {
  try {
    const config = loadConfig();
    const server = new ZzxGodotServer(config);
    registerAllTools(server);
    await server.start();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to start server:', message);
    process.exit(1);
  }
}

main();
