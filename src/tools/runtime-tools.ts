/**
 * zzx-godot-mcp — Runtime Game Control Tools (20 tools)
 */

import type { ZzxGodotServer } from '../server.js';
import type { ToolRegistration } from '../types/index.js';
import { requireString, optionalString, optionalNumber, requireBoolean } from '../utils/validators.js';
import * as logger from '../utils/logger.js';

export function registerRuntimeTools(server: ZzxGodotServer): void {
  /** Try to connect TCP if not already connected. */
  async function ensureTcpConnected(): Promise<boolean> {
    const tcp = server.getTcp();
    if (tcp.isConnected()) return true;
    try {
      await tcp.connect();
      return true;
    } catch {
      return false;
    }
  }

  const WS_ERROR_MSG =
    'WebSocket not connected. Godot editor is not open or MCP plugin is not enabled.\n' +
    'Steps to fix:\n' +
    '1. Run: launch_editor (or open Godot manually)\n' +
    '2. In Godot: Project -> Project Settings -> Plugins -> Enable "ZZX Godot MCP"\n' +
    '3. Wait 3 seconds, then retry.';

  const TCP_ERROR_MSG =
    'TCP not connected. The game is not running or TCP server has not started.\n' +
    'Steps to fix:\n' +
    '1. Ensure WebSocket is connected (Godot editor is open)\n' +
    '2. Run: runtime_play (to start the game from the editor)\n' +
    '3. Wait 3-5 seconds for TCP server to initialize\n' +
    '4. Retry this tool.';

  const tools: ToolRegistration[] = [
    {
      definition: {
        name: 'runtime_play',
        description: 'Play the main or a specific scene in the Godot editor (requires WebSocket).',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene to play (default: main scene)' },
          },
        },
      },
      handler: async (args) => {
        const scenePath = optionalString(args, 'scene_path');
        const ws = server.getWebSocket();
        if (!ws.isConnected()) {
          return { content: [{ type: 'text', text: WS_ERROR_MSG }], isError: true };
        }
        const resp = await ws.send({
          id: `${Date.now()}`,
          method: 'runtime.play',
          params: scenePath ? { scene: scenePath } : {},
        });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };

        // Auto-connect TCP after game starts
        setTimeout(async () => {
          if (!server.getTcp().isConnected()) {
            try {
              await server.getTcp().connect();
              logger.info('TCP auto-connected after runtime_play.');
            } catch (e) {
              logger.warn('Auto TCP connect failed after runtime_play:', e);
            }
          }
        }, 3000);

        return {
          content: [{
            type: 'text',
            text: 'Game started from editor.\n' +
              'TCP status: connecting in 3 seconds...\n' +
              'If TCP tools fail immediately, wait 3 seconds and retry.',
          }],
        };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'runtime_stop',
        description: 'Stop the running game (requires WebSocket).',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async (_args) => {
        const ws = server.getWebSocket();
        if (!ws.isConnected()) {
          return { content: [{ type: 'text', text: WS_ERROR_MSG }], isError: true };
        }
        const resp = await ws.send({ id: `${Date.now()}`, method: 'runtime.stop', params: {} });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: 'Game stopped.' }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'runtime_pause',
        description: 'Pause or unpause the running game (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            paused: { type: 'boolean', description: 'true to pause, false to unpause' },
          },
          required: ['paused'],
        },
      },
      handler: async (args) => {
        const paused = requireBoolean(args, 'paused');
        if (!(await ensureTcpConnected())) {
          return { content: [{ type: 'text', text: TCP_ERROR_MSG }], isError: true };
        }
        const resp = await server.getTcp().send({ id: `${Date.now()}`, method: 'game.pause', params: { paused } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: paused ? 'Game paused.' : 'Game resumed.' }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'runtime_eval',
        description: 'Execute arbitrary GDScript in the running game (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'GDScript code to execute' },
          },
          required: ['code'],
        },
      },
      handler: async (args) => {
        const code = requireString(args, 'code');
        if (!(await ensureTcpConnected())) {
          return { content: [{ type: 'text', text: TCP_ERROR_MSG }], isError: true };
        }
        const resp = await server.getTcp().send({ id: `${Date.now()}`, method: 'game.eval', params: { code } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(resp.result, null, 2) }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'runtime_get_tree',
        description: 'Get the full scene tree from the running game (requires TCP).',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async (_args) => {
        if (!(await ensureTcpConnected())) {
          return { content: [{ type: 'text', text: TCP_ERROR_MSG }], isError: true };
        }
        const resp = await server.getTcp().send({ id: `${Date.now()}`, method: 'game.get_tree', params: {} });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(resp.result, null, 2) }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'runtime_get_property',
        description: 'Get a property value from a node in the running game (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            node_path: { type: 'string', description: 'Absolute node path (e.g. /root/Main/Player)' },
            property: { type: 'string', description: 'Property name' },
          },
          required: ['node_path', 'property'],
        },
      },
      handler: async (args) => {
        const nodePath = requireString(args, 'node_path');
        const property = requireString(args, 'property');
        if (!(await ensureTcpConnected())) {
          return { content: [{ type: 'text', text: TCP_ERROR_MSG }], isError: true };
        }
        const resp = await server.getTcp().send({ id: `${Date.now()}`, method: 'game.get_property', params: { path: nodePath, property } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(resp.result, null, 2) }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'runtime_set_property',
        description: 'Set a property value on a node in the running game (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            node_path: { type: 'string', description: 'Absolute node path' },
            property: { type: 'string', description: 'Property name' },
            value: { description: 'New value' },
          },
          required: ['node_path', 'property', 'value'],
        },
      },
      handler: async (args) => {
        const nodePath = requireString(args, 'node_path');
        const property = requireString(args, 'property');
        const value = args.value;
        if (!(await ensureTcpConnected())) {
          return { content: [{ type: 'text', text: TCP_ERROR_MSG }], isError: true };
        }
        const resp = await server.getTcp().send({ id: `${Date.now()}`, method: 'game.set_property', params: { path: nodePath, property, value } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: `Set ${nodePath}.${property} = ${JSON.stringify(value)}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'runtime_call_method',
        description: 'Call a method on a node in the running game (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            node_path: { type: 'string', description: 'Absolute node path' },
            method: { type: 'string', description: 'Method name' },
            args: { type: 'array', description: 'Method arguments' },
          },
          required: ['node_path', 'method'],
        },
      },
      handler: async (args) => {
        const nodePath = requireString(args, 'node_path');
        const method = requireString(args, 'method');
        const methodArgs = (args.args as unknown[]) || [];
        if (!(await ensureTcpConnected())) {
          return { content: [{ type: 'text', text: TCP_ERROR_MSG }], isError: true };
        }
        const resp = await server.getTcp().send({ id: `${Date.now()}`, method: 'game.call_method', params: { path: nodePath, method, args: methodArgs } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(resp.result, null, 2) }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'runtime_screenshot',
        description: 'Capture a screenshot from the running game (requires TCP). Returns base64 PNG. Note: screenshots require a running game with rendering. Headless mode (--headless) produces black images; use this tool or editor_screenshot instead.',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async (_args) => {
        if (!(await ensureTcpConnected())) {
          return { content: [{ type: 'text', text: TCP_ERROR_MSG }], isError: true };
        }
        const resp = await server.getTcp().send({ id: `${Date.now()}`, method: 'game.screenshot', params: {} });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        const base64 = resp.result as string;
        return {
          content: [
            { type: 'text', text: 'Screenshot captured:' },
            { type: 'image', data: base64, mimeType: 'image/png' },
          ],
        };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'runtime_performance',
        description: 'Get performance metrics from the running game (requires TCP).',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async (_args) => {
        if (!(await ensureTcpConnected())) {
          return { content: [{ type: 'text', text: TCP_ERROR_MSG }], isError: true };
        }
        const resp = await server.getTcp().send({ id: `${Date.now()}`, method: 'game.performance', params: {} });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(resp.result, null, 2) }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'runtime_errors',
        description: 'Get recent errors/warnings from the running game (requires TCP).',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async (_args) => {
        if (!(await ensureTcpConnected())) {
          return { content: [{ type: 'text', text: TCP_ERROR_MSG }], isError: true };
        }
        const resp = await server.getTcp().send({ id: `${Date.now()}`, method: 'game.get_errors', params: {} });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(resp.result, null, 2) }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'runtime_logs',
        description: 'Get recent print/output logs from the running game (requires TCP).',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async (_args) => {
        if (!(await ensureTcpConnected())) {
          return { content: [{ type: 'text', text: TCP_ERROR_MSG }], isError: true };
        }
        const resp = await server.getTcp().send({ id: `${Date.now()}`, method: 'game.get_logs', params: {} });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(resp.result, null, 2) }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'runtime_instantiate',
        description: 'Instantiate a PackedScene into the running game (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'PackedScene path (res://)' },
            parent_path: { type: 'string', description: 'Parent node path in running tree' },
            node_name: { type: 'string', description: 'Name for the new instance' },
          },
          required: ['scene_path', 'parent_path', 'node_name'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = requireString(args, 'parent_path');
        const nodeName = requireString(args, 'node_name');
        if (!(await ensureTcpConnected())) {
          return { content: [{ type: 'text', text: TCP_ERROR_MSG }], isError: true };
        }
        const resp = await server.getTcp().send({ id: `${Date.now()}`, method: 'game.instantiate', params: { scene: scenePath, parent: parentPath, name: nodeName } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: `Instantiated ${scenePath} as "${nodeName}" under ${parentPath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'runtime_remove_node',
        description: 'Remove a node from the running game (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            node_path: { type: 'string', description: 'Absolute node path' },
          },
          required: ['node_path'],
        },
      },
      handler: async (args) => {
        const nodePath = requireString(args, 'node_path');
        if (!(await ensureTcpConnected())) {
          return { content: [{ type: 'text', text: TCP_ERROR_MSG }], isError: true };
        }
        const resp = await server.getTcp().send({ id: `${Date.now()}`, method: 'game.remove_node', params: { path: nodePath } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: `Removed node: ${nodePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'runtime_change_scene',
        description: 'Change to a different scene in the running game (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'New scene path (res://)' },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        if (!(await ensureTcpConnected())) {
          return { content: [{ type: 'text', text: TCP_ERROR_MSG }], isError: true };
        }
        const resp = await server.getTcp().send({ id: `${Date.now()}`, method: 'game.change_scene', params: { scene: scenePath } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: `Changed scene to: ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'runtime_connect_signal',
        description: 'Connect a signal at runtime (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            emitter_path: { type: 'string', description: 'Signal emitter node path' },
            signal_name: { type: 'string', description: 'Signal name' },
            receiver_path: { type: 'string', description: 'Receiver node path' },
            method_name: { type: 'string', description: 'Method to call' },
          },
          required: ['emitter_path', 'signal_name', 'receiver_path', 'method_name'],
        },
      },
      handler: async (args) => {
        const emitter = requireString(args, 'emitter_path');
        const signal = requireString(args, 'signal_name');
        const receiver = requireString(args, 'receiver_path');
        const method = requireString(args, 'method_name');
        if (!(await ensureTcpConnected())) {
          return { content: [{ type: 'text', text: TCP_ERROR_MSG }], isError: true };
        }
        const resp = await server.getTcp().send({ id: `${Date.now()}`, method: 'game.connect_signal', params: { emitter, signal, receiver, method } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: `Connected ${emitter}.${signal} → ${receiver}.${method}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'runtime_emit_signal',
        description: 'Emit a signal with arguments at runtime (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            node_path: { type: 'string', description: 'Node path' },
            signal_name: { type: 'string', description: 'Signal name' },
            args: { type: 'array', description: 'Signal arguments' },
          },
          required: ['node_path', 'signal_name'],
        },
      },
      handler: async (args) => {
        const nodePath = requireString(args, 'node_path');
        const signal = requireString(args, 'signal_name');
        const sigArgs = (args.args as unknown[]) || [];
        if (!(await ensureTcpConnected())) {
          return { content: [{ type: 'text', text: TCP_ERROR_MSG }], isError: true };
        }
        const resp = await server.getTcp().send({ id: `${Date.now()}`, method: 'game.emit_signal', params: { path: nodePath, signal, args: sigArgs } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: `Emitted ${signal} on ${nodePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'runtime_get_camera',
        description: 'Get the active camera position/rotation/zoom (requires TCP).',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async (_args) => {
        if (!(await ensureTcpConnected())) {
          return { content: [{ type: 'text', text: TCP_ERROR_MSG }], isError: true };
        }
        const resp = await server.getTcp().send({ id: `${Date.now()}`, method: 'game.get_camera', params: {} });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(resp.result, null, 2) }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'runtime_set_camera',
        description: 'Set the active camera position/rotation (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            position: { type: 'object', description: '{x, y, z} or {x, y}' },
            rotation: { type: 'object', description: '{x, y, z} or float (for 2D)' },
            zoom: { type: 'object', description: '{x, y} for Camera2D zoom' },
          },
        },
      },
      handler: async (args) => {
        if (!(await ensureTcpConnected())) {
          return { content: [{ type: 'text', text: TCP_ERROR_MSG }], isError: true };
        }
        const resp = await server.getTcp().send({ id: `${Date.now()}`, method: 'game.set_camera', params: { position: args.position, rotation: args.rotation, zoom: args.zoom } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: 'Camera updated.' }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'runtime_wait',
        description: 'Wait N frames in the running game (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            frames: { type: 'number', description: 'Number of frames to wait' },
          },
          required: ['frames'],
        },
      },
      handler: async (args) => {
        const frames = optionalNumber(args, 'frames') || 1;
        if (!(await ensureTcpConnected())) {
          return { content: [{ type: 'text', text: TCP_ERROR_MSG }], isError: true };
        }
        const resp = await server.getTcp().send({ id: `${Date.now()}`, method: 'game.wait', params: { frames } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: `Waited ${frames} frames.` }] };
      },
      readOnly: false,
    },
  ];

  for (const tool of tools) {
    server.registerTool(tool);
  }
}
