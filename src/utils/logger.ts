/**
 * zzx-godot-mcp — Logger
 */

import type { LogLevel } from '../types/index.js';

const LEVELS: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

let currentLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] <= LEVELS[currentLevel];
}

function timestamp(): string {
  return new Date().toISOString();
}

export function debug(message: string, ...args: unknown[]): void {
  if (shouldLog('debug')) {
    console.error(`[${timestamp()}] [DEBUG] ${message}`, ...args);
  }
}

export function info(message: string, ...args: unknown[]): void {
  if (shouldLog('info')) {
    console.error(`[${timestamp()}] [INFO] ${message}`, ...args);
  }
}

export function warn(message: string, ...args: unknown[]): void {
  if (shouldLog('warn')) {
    console.error(`[${timestamp()}] [WARN] ${message}`, ...args);
  }
}

export function error(message: string, ...args: unknown[]): void {
  if (shouldLog('error')) {
    console.error(`[${timestamp()}] [ERROR] ${message}`, ...args);
  }
}
