/**
 * zzx-godot-mcp — Core Type Definitions
 */

/* ── MCP Tool / Response types ── */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
}

export interface ToolResponse {
  content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>;
  isError?: boolean;
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResponse>;

export interface ToolRegistration {
  definition: ToolDefinition;
  handler: ToolHandler;
  readOnly: boolean;
}

/* ── Connection types ── */

export type ConnectionMode = 'headless' | 'websocket' | 'tcp';

export interface ConnectionConfig {
  godotPath: string;
  projectPath?: string;
  websocketPort: number;
  tcpPort: number;
  logLevel: LogLevel;
}

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

/* ── Godot command types ── */

export interface GodotCommand {
  id: string;
  method: string;
  params: Record<string, unknown>;
}

export interface GodotResponse {
  id: string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/* ── Headless execution types ── */

export interface HeadlessResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
}

/* ── Utility ── */

export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;
