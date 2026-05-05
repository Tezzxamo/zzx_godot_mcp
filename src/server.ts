/**
 * zzx-godot-mcp — Core Server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { ConnectionConfig, ToolRegistration } from './types/index.js';
import { HeadlessExecutor } from './connection/headless-executor.js';
import { WebSocketClient } from './connection/websocket-client.js';
import { TcpClient } from './connection/tcp-client.js';
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from './constants.js';
import { ValidationError } from './utils/validators.js';
import * as logger from './utils/logger.js';

/**
 * Parameter name mappings: snake_case → camelCase.
 * Allows clients to use either naming convention.
 */
const PARAMETER_MAPPINGS: Record<string, string> = {
  project_path: 'projectPath',
  scene_path: 'scenePath',
  root_node_type: 'rootNodeType',
  parent_node_path: 'parentNodePath',
  node_type: 'nodeType',
  node_name: 'nodeName',
  texture_path: 'texturePath',
  node_path: 'nodePath',
  output_path: 'outputPath',
  mesh_item_names: 'meshItemNames',
  new_path: 'newPath',
  file_path: 'filePath',
  action_name: 'actionName',
  preset_name: 'presetName',
  max_depth: 'maxDepth',
  font_path: 'fontPath',
};

function normalizeParameters(args: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    const normalizedKey = PARAMETER_MAPPINGS[key] || key;
    result[normalizedKey] = value;
  }
  return result;
}

export class ZzxGodotServer {
  private mcpServer: Server;
  private config: ConnectionConfig;
  private headless: HeadlessExecutor;
  private websocket: WebSocketClient;
  private tcp: TcpClient;
  private tools = new Map<string, ToolRegistration>();

  constructor(config: ConnectionConfig) {
    this.config = config;
    this.headless = new HeadlessExecutor(config.godotPath, config.projectPath || process.cwd());
    this.websocket = new WebSocketClient(config.websocketPort);
    this.tcp = new TcpClient(config.tcpPort);

    this.mcpServer = new Server(
      { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
      { capabilities: { tools: {} } }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: Array.from(this.tools.values()).map((t) => t.definition),
      };
    });

    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (req) => {
      const { name, arguments: args } = req.params;
      const registration = this.tools.get(name);

      if (!registration) {
        return {
          content: [{ type: 'text', text: `Tool "${name}" not found.` }],
          isError: true,
        };
      }

      try {
        // Normalize parameter names (snake_case → camelCase)
        const normalizedArgs = normalizeParameters(args as Record<string, unknown>);
        const result = await registration.handler(normalizedArgs);
        return result as { content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>; isError?: boolean };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Tool "${name}" failed:`, message);

        const content: Array<{ type: 'text'; text: string }> = [{ type: 'text', text: message }];

        // Append possible solutions for validation errors
        if (err instanceof ValidationError) {
          content.push({
            type: 'text',
            text: 'Tip: Check that all required parameters are provided and use the correct types.',
          });
        }

        return { content, isError: true };
      }
    });
  }

  registerTool(registration: ToolRegistration): void {
    this.tools.set(registration.definition.name, registration);
    logger.debug(`Registered tool: ${registration.definition.name}`);
  }

  registerTools(registrations: ToolRegistration[]): void {
    for (const reg of registrations) {
      this.registerTool(reg);
    }
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.mcpServer.connect(transport);
    logger.info(`${MCP_SERVER_NAME} v${MCP_SERVER_VERSION} started with ${this.tools.size} tools.`);

    // Try to connect to WebSocket (Godot Editor)
    try {
      await this.websocket.connect();
    } catch {
      logger.warn(`WebSocket not available at port ${this.config.websocketPort}. Falling back to headless mode.`);
    }

    logger.info('Server ready. Waiting for MCP requests.');
  }

  async stop(): Promise<void> {
    await this.websocket.disconnect();
    await this.tcp.disconnect();
    await this.headless.disconnect();
    await this.mcpServer.close();
  }

  getHeadless(): HeadlessExecutor {
    return this.headless;
  }

  getWebSocket(): WebSocketClient {
    return this.websocket;
  }

  getTcp(): TcpClient {
    return this.tcp;
  }

  getConfig(): ConnectionConfig {
    return this.config;
  }
}
