/**
 * zzx-godot-mcp — Configuration Manager
 */

import {
  DEFAULT_WEBSOCKET_PORT,
  DEFAULT_TCP_PORT,
  ENV_GODOT_EXECUTABLE,
  ENV_GODOT_PATH,
  ENV_WEBSOCKET_PORT,
  ENV_TCP_PORT,
  ENV_LOG_LEVEL,
  ENV_PROJECT_PATH,
} from './constants.js';
import { detectGodotPath } from './utils/godot-detector.js';
import { findProjectRoot } from './utils/path-utils.js';
import type { ConnectionConfig, LogLevel } from './types/index.js';
import * as logger from './utils/logger.js';

let cachedConfig: ConnectionConfig | null = null;

export function loadConfig(): ConnectionConfig {
  if (cachedConfig) return cachedConfig;

  const godotPath = process.env[ENV_GODOT_EXECUTABLE] || process.env[ENV_GODOT_PATH] || detectGodotPath();
  const projectPath = process.env[ENV_PROJECT_PATH] || findProjectRoot(process.cwd()) || process.cwd();
  const websocketPort = parseInt(process.env[ENV_WEBSOCKET_PORT] || String(DEFAULT_WEBSOCKET_PORT), 10);
  const tcpPort = parseInt(process.env[ENV_TCP_PORT] || String(DEFAULT_TCP_PORT), 10);
  const logLevel = (process.env[ENV_LOG_LEVEL] || 'info') as LogLevel;

  logger.setLogLevel(logLevel);

  cachedConfig = {
    godotPath,
    projectPath,
    websocketPort,
    tcpPort,
    logLevel,
  };

  logger.info('Config loaded', { godotPath, projectPath, websocketPort, tcpPort, logLevel });
  return cachedConfig;
}

export function getConfig(): ConnectionConfig {
  return cachedConfig || loadConfig();
}

export function resetConfig(): void {
  cachedConfig = null;
}
