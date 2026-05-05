/**
 * zzx-godot-mcp — Constants
 */

export const ZZX_VERSION = '1.0.0';

export const DEFAULT_WEBSOCKET_PORT = 9678;
export const DEFAULT_TCP_PORT = 9679;

export const MCP_SERVER_NAME = 'zzx-godot-mcp';
export const MCP_SERVER_VERSION = ZZX_VERSION;

export const GODOT_EXECUTABLE_NAMES = [
  'godot',
  'godot.exe',
  'Godot',
  'Godot.exe',
  'Godot_v4.6-stable_win64.exe',
  'Godot_v4.6-stable_mono_win64.exe',
];

export const GODOT_COMMON_PATHS: string[] = [
  'C:\\Program Files\\Godot',
  'C:\\Program Files (x86)\\Godot',
  'C:\\Godot',
  'D:\\Godot',
  'E:\\Godot',
];

export const HEADLESS_TIMEOUT_MS = 30000;
export const WEBSOCKET_TIMEOUT_MS = 10000;
export const TCP_TIMEOUT_MS = 10000;

export const ENV_GODOT_EXECUTABLE = 'GODOT_EXECUTABLE';
export const ENV_GODOT_PATH = 'GODOT_PATH';
export const ENV_WEBSOCKET_PORT = 'ZZX_WEBSOCKET_PORT';
export const ENV_TCP_PORT = 'ZZX_TCP_PORT';
export const ENV_LOG_LEVEL = 'ZZX_LOG_LEVEL';
export const ENV_PROJECT_PATH = 'ZZX_PROJECT_PATH';
