/**
 * zzx-godot-mcp — Networking Tools (6 tools)
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ZzxGodotServer } from '../server.js';
import type { ToolRegistration } from '../types/index.js';
import { requireString, optionalString, optionalNumber } from '../utils/validators.js';

export function registerNetworkingTools(server: ZzxGodotServer): void {
  const projectPath = server.getConfig().projectPath || process.cwd();

  const tools: ToolRegistration[] = [
    {
      definition: {
        name: 'net_http_request',
        description: 'Create an HTTPRequest node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name', default: 'HTTPRequest' },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = (args.name as string) || 'HTTPRequest';

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        content = content.trimEnd() + `\n[node name="${name}" type="HTTPRequest" parent="${parent}"]\n`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created HTTPRequest "${name}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'net_websocket',
        description: 'Generate WebSocket client code snippet.',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'WebSocket URL' },
          },
          required: ['url'],
        },
      },
      handler: async (args) => {
        const url = requireString(args, 'url');
        const code = `extends Node\n\nvar socket := WebSocketPeer.new()\n\nfunc _ready():\n    socket.connect_to_url("${url}")\n\nfunc _process(delta):\n    socket.poll()\n    var state = socket.get_ready_state()\n    if state == WebSocketPeer.STATE_OPEN:\n        while socket.get_available_packet_count() > 0:\n            var packet = socket.get_packet().get_string_from_utf8()\n            print("Received: ", packet)\n\nfunc send_message(message: String):\n    if socket.get_ready_state() == WebSocketPeer.STATE_OPEN:\n        socket.send_text(message)\n`;
        return { content: [{ type: 'text', text: `WebSocket client code:\n\n${code}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'net_multiplayer',
        description: 'Generate ENet multiplayer setup code snippet.',
        inputSchema: {
          type: 'object',
          properties: {
            mode: { type: 'string', description: 'server or client', default: 'server' },
            port: { type: 'number', description: 'Port number', default: 9090 },
            address: { type: 'string', description: 'Server address (for client)', default: '127.0.0.1' },
          },
          required: ['mode'],
        },
      },
      handler: async (args) => {
        const mode = requireString(args, 'mode');
        const port = (args.port as number) || 9090;
        const address = (args.address as string) || '127.0.0.1';

        let code = '';
        if (mode === 'server') {
          code = `extends Node\n\nvar multiplayer_peer = ENetMultiplayerPeer.new()\n\nfunc _ready():\n    multiplayer_peer.create_server(${port})\n    multiplayer.multiplayer_peer = multiplayer_peer\n    multiplayer.peer_connected.connect(_on_peer_connected)\n    multiplayer.peer_disconnected.connect(_on_peer_disconnected)\n\nfunc _on_peer_connected(id: int):\n    print("Peer connected: ", id)\n\nfunc _on_peer_disconnected(id: int):\n    print("Peer disconnected: ", id)\n\n@rpc(any_peer)\nfunc send_message(msg: String):\n    print("Message from ", multiplayer.get_remote_sender_id(), ": ", msg)\n`;
        } else {
          code = `extends Node\n\nvar multiplayer_peer = ENetMultiplayerPeer.new()\n\nfunc _ready():\n    multiplayer_peer.create_client("${address}", ${port})\n    multiplayer.multiplayer_peer = multiplayer_peer\n    multiplayer.connected_to_server.connect(_on_connected)\n    multiplayer.connection_failed.connect(_on_connection_failed)\n\nfunc _on_connected():\n    print("Connected to server")\n\nfunc _on_connection_failed():\n    print("Connection failed")\n\nfunc send_message(msg: String):\n    rpc_id(1, "send_message", msg)\n`;
        }

        return { content: [{ type: 'text', text: `ENet ${mode} code:\n\n${code}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'net_rpc',
        description: 'Generate RPC method declaration code snippet.',
        inputSchema: {
          type: 'object',
          properties: {
            method_name: { type: 'string', description: 'Method name' },
            params: { type: 'array', description: 'Parameter names' },
            mode: { type: 'string', description: 'authority, any_peer, or none', default: 'any_peer' },
            sync: { type: 'string', description: 'call_remote, call_local, or call_local_redirect', default: 'call_remote' },
          },
          required: ['method_name'],
        },
      },
      handler: async (args) => {
        const methodName = requireString(args, 'method_name');
        const params = (args.params as string[]) || [];
        const mode = (args.mode as string) || 'any_peer';
        const sync = (args.sync as string) || 'call_remote';

        const paramStr = params.map(p => `${p}: Variant`).join(', ');
        const code = `@rpc("${mode}", "${sync}")\nfunc ${methodName}(${paramStr}) -> void:\n    pass\n`;
        return { content: [{ type: 'text', text: `RPC declaration:\n\n${code}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'net_create_server',
        description: 'Create a network server node (TCP/UDP) in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name', default: 'NetworkServer' },
            protocol: { type: 'string', description: 'tcp or udp', default: 'tcp' },
            port: { type: 'number', description: 'Port', default: 8080 },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = (args.name as string) || 'NetworkServer';
        const protocol = (args.protocol as string) || 'tcp';
        const port = (args.port as number) || 8080;

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        const typeName = protocol === 'udp' ? 'PacketPeerUDP' : 'TCPServer';
        const scriptContent = `extends Node\n\nvar server\nvar port = ${port}\n\nfunc _ready():\n    server = ${typeName}.new()\n    server.listen(port)\n    print("${protocol.toUpperCase()} server listening on port ", port)\n`;

        content = content.trimEnd() + `\n[node name="${name}" type="Node" parent="${parent}"]\n`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created ${typeName} "${name}" in ${scenePath}\n\nAttach this script:\n${scriptContent}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'net_create_client',
        description: 'Create a network client setup code snippet.',
        inputSchema: {
          type: 'object',
          properties: {
            address: { type: 'string', description: 'Server address', default: '127.0.0.1' },
            port: { type: 'number', description: 'Server port', default: 8080 },
            protocol: { type: 'string', description: 'tcp or udp', default: 'tcp' },
          },
          required: ['address'],
        },
      },
      handler: async (args) => {
        const address = requireString(args, 'address');
        const port = (args.port as number) || 8080;
        const protocol = (args.protocol as string) || 'tcp';

        const code = protocol === 'udp'
          ? `var peer = PacketPeerUDP.new()\npeer.set_dest_address("${address}", ${port})\npeer.put_packet("Hello".to_utf8_buffer())`
          : `var peer = StreamPeerTCP.new()\npeer.connect_to_host("${address}", ${port})\nwhile peer.get_status() == StreamPeerTCP.STATUS_CONNECTING:\n    peer.poll()\npeer.put_data("Hello".to_utf8_buffer())`;

        return { content: [{ type: 'text', text: `${protocol.toUpperCase()} client code:\n\n${code}` }] };
      },
      readOnly: false,
    },
  ];

  for (const tool of tools) {
    server.registerTool(tool);
  }
}

function getRootNodeName(content: string): string {
  const match = content.match(/\[node name="([^"]+)"/);
  return match ? match[1] : '.';
}
