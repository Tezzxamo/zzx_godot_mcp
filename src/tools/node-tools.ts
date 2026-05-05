/**
 * zzx-godot-mcp — Node Operation Tools (15 tools)
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ZzxGodotServer } from '../server.js';
import type { ToolRegistration } from '../types/index.js';
import { requireString, optionalString, requireObject, optionalObject } from '../utils/validators.js';
import { isSafePath, normalizeResPath } from '../utils/path-utils.js';

export function registerNodeTools(server: ZzxGodotServer): void {
  const projectPath = server.getConfig().projectPath || process.cwd();

  const tools: ToolRegistration[] = [
    {
      definition: {
        name: 'node_add',
        description: 'Add a node to a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path (default: root)', default: '.' },
            node_type: { type: 'string', description: 'Node class type (e.g. Sprite2D, Camera3D)' },
            node_name: { type: 'string', description: 'Name for the new node' },
            properties: { type: 'object', description: 'Initial properties as key-value pairs' },
          },
          required: ['scene_path', 'node_type', 'node_name'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const nodeType = requireString(args, 'node_type');
        const nodeName = requireString(args, 'node_name');
        const properties = (args.properties as Record<string, unknown>) || {};

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        if (!fs.existsSync(resolved)) {
          return { content: [{ type: 'text', text: `Error: Scene not found: ${scenePath}` }], isError: true };
        }

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        const propLines = Object.entries(properties)
          .map(([k, v]) => `${k} = ${formatPropertyValue(v)}`)
          .join('\n');

        const nodeBlock = `\n[node name="${nodeName}" type="${nodeType}" parent="${parent}"]\n${propLines ? propLines + '\n' : ''}`;
        content = content.trimEnd() + nodeBlock;
        fs.writeFileSync(resolved, content, 'utf-8');

        return { content: [{ type: 'text', text: `Added ${nodeType} "${nodeName}" to ${scenePath} under "${parent}"` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'node_delete',
        description: 'Delete a node from a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            node_path: { type: 'string', description: 'Node path in scene (e.g. Player/Sprite2D)' },
          },
          required: ['scene_path', 'node_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const nodePath = requireString(args, 'node_path');

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        if (!fs.existsSync(resolved)) {
          return { content: [{ type: 'text', text: `Error: Scene not found: ${scenePath}` }], isError: true };
        }

        let content = fs.readFileSync(resolved, 'utf-8');
        const lines = content.split('\n');
        const result = removeNodeAndChildren(lines, nodePath);
        fs.writeFileSync(resolved, result.join('\n'), 'utf-8');

        return { content: [{ type: 'text', text: `Deleted node "${nodePath}" from ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'node_rename',
        description: 'Rename a node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            node_path: { type: 'string', description: 'Current node path' },
            new_name: { type: 'string', description: 'New node name' },
          },
          required: ['scene_path', 'node_path', 'new_name'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const nodePath = requireString(args, 'node_path');
        const newName = requireString(args, 'new_name');

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const oldName = nodePath.split('/').pop() || nodePath;
        const parentPath = nodePath.includes('/') ? nodePath.substring(0, nodePath.lastIndexOf('/')) : '.';

        // Update the node's own name
        const regex = new RegExp(`(parent="${escapeRegex(nodePath)}"|name="${escapeRegex(oldName)}" parent="${escapeRegex(parentPath)}")`, 'g');
        content = content.replace(regex, (match) => {
          if (match.includes('name=')) {
            return match.replace(`name="${oldName}"`, `name="${newName}"`);
          }
          return match;
        });

        // Update child parent references
        const childRegex = new RegExp(`parent="${escapeRegex(nodePath)}`, 'g');
        content = content.replace(childRegex, `parent="${parentPath === '.' ? newName : parentPath + '/' + newName}`);

        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Renamed "${nodePath}" → "${newName}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'node_move',
        description: 'Move a node to a new position (change parent) in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            node_path: { type: 'string', description: 'Current node path' },
            new_parent: { type: 'string', description: 'New parent node path' },
          },
          required: ['scene_path', 'node_path', 'new_parent'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const nodePath = requireString(args, 'node_path');
        const newParent = requireString(args, 'new_parent');

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const oldParent = nodePath.includes('/') ? nodePath.substring(0, nodePath.lastIndexOf('/')) : '.';
        const nodeName = nodePath.split('/').pop() || nodePath;

        const regex = new RegExp(`parent="${escapeRegex(oldParent)}"(?!.*parent=)`, 'g');
        // This is a simplified move - for the specific node only
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(`name="${nodeName}"`) && lines[i].includes(`parent="${oldParent}"`)) {
            lines[i] = lines[i].replace(`parent="${oldParent}"`, `parent="${newParent}"`);
            // Update children parent references too
            break;
          }
        }

        fs.writeFileSync(resolved, lines.join('\n'), 'utf-8');
        return { content: [{ type: 'text', text: `Moved "${nodePath}" → parent "${newParent}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'node_duplicate',
        description: 'Duplicate a node within a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            node_path: { type: 'string', description: 'Node path to duplicate' },
            new_name: { type: 'string', description: 'Name for the duplicate' },
          },
          required: ['scene_path', 'node_path', 'new_name'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const nodePath = requireString(args, 'node_path');
        const newName = requireString(args, 'new_name');

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const lines = content.split('\n');
        const nodeBlock = extractNodeBlock(lines, nodePath);
        if (!nodeBlock) {
          return { content: [{ type: 'text', text: `Error: Node "${nodePath}" not found.` }], isError: true };
        }

        const renamedBlock = nodeBlock.replace(/name="[^"]+"/, `name="${newName}"`);
        const insertIndex = lines.findIndex(l => l.includes(`name="${nodePath.split('/').pop()}"`));
        if (insertIndex >= 0) {
          lines.splice(insertIndex + 1, 0, ...renamedBlock.split('\n'));
        }

        fs.writeFileSync(resolved, lines.join('\n'), 'utf-8');
        return { content: [{ type: 'text', text: `Duplicated "${nodePath}" as "${newName}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'node_get_properties',
        description: 'Get all properties of a node from a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            node_path: { type: 'string', description: 'Node path in scene' },
          },
          required: ['scene_path', 'node_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const nodePath = requireString(args, 'node_path');

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        if (!fs.existsSync(resolved)) {
          return { content: [{ type: 'text', text: `Error: Scene not found: ${scenePath}` }], isError: true };
        }

        const content = fs.readFileSync(resolved, 'utf-8');
        const props = extractNodeProperties(content, nodePath);
        return { content: [{ type: 'text', text: JSON.stringify(props, null, 2) }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'node_set_property',
        description: 'Set a property value on a node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            node_path: { type: 'string', description: 'Node path in scene' },
            property: { type: 'string', description: 'Property name' },
            value: { description: 'Property value (string, number, bool, object, array)' },
          },
          required: ['scene_path', 'node_path', 'property', 'value'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const nodePath = requireString(args, 'node_path');
        const property = requireString(args, 'property');
        const value = args.value;

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        content = updateNodeProperty(content, nodePath, property, value);
        fs.writeFileSync(resolved, content, 'utf-8');

        return { content: [{ type: 'text', text: `Set ${nodePath}.${property} = ${formatPropertyValue(value)} in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'node_get_info',
        description: 'Get detailed info about a node: properties, signals, methods (requires WebSocket).',
        inputSchema: {
          type: 'object',
          properties: {
            node_path: { type: 'string', description: 'Absolute node path in running scene tree' },
          },
          required: ['node_path'],
        },
      },
      handler: async (args) => {
        const nodePath = requireString(args, 'node_path');
        const ws = server.getWebSocket();
        if (!ws.isConnected()) {
          return { content: [{ type: 'text', text: 'WebSocket not connected. Use scene_get_tree for file-based inspection.' }], isError: true };
        }
        const resp = await ws.send({
          id: `${Date.now()}`,
          method: 'node.get_info',
          params: { path: nodePath },
        });
        if (resp.error) {
          return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(resp.result, null, 2) }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'node_connect_signal',
        description: 'Connect a signal in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            emitter_path: { type: 'string', description: 'Node that emits the signal' },
            signal_name: { type: 'string', description: 'Signal name' },
            receiver_path: { type: 'string', description: 'Node that receives' },
            method_name: { type: 'string', description: 'Method to call' },
          },
          required: ['scene_path', 'emitter_path', 'signal_name', 'receiver_path', 'method_name'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const emitter = requireString(args, 'emitter_path');
        const signal = requireString(args, 'signal_name');
        const receiver = requireString(args, 'receiver_path');
        const method = requireString(args, 'method_name');

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const connectionLine = `[connection signal="${signal}" from="${emitter}" to="${receiver}" method="${method}"]`;
        if (!content.includes(connectionLine)) {
          content = content.trimEnd() + '\n' + connectionLine + '\n';
          fs.writeFileSync(resolved, content, 'utf-8');
        }

        return { content: [{ type: 'text', text: `Connected ${emitter}.${signal} → ${receiver}.${method} in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'node_disconnect_signal',
        description: 'Disconnect a signal in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            emitter_path: { type: 'string', description: 'Node that emits the signal' },
            signal_name: { type: 'string', description: 'Signal name' },
            receiver_path: { type: 'string', description: 'Node that receives' },
            method_name: { type: 'string', description: 'Method to call' },
          },
          required: ['scene_path', 'emitter_path', 'signal_name', 'receiver_path', 'method_name'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const emitter = requireString(args, 'emitter_path');
        const signal = requireString(args, 'signal_name');
        const receiver = requireString(args, 'receiver_path');
        const method = requireString(args, 'method_name');

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const connectionLine = `[connection signal="${signal}" from="${emitter}" to="${receiver}" method="${method}"]`;
        content = content.replace(connectionLine + '\n', '').replace(connectionLine, '');
        fs.writeFileSync(resolved, content, 'utf-8');

        return { content: [{ type: 'text', text: `Disconnected ${emitter}.${signal} → ${receiver}.${method} in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'node_list_signals',
        description: 'List all signal connections in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        const content = fs.readFileSync(resolved, 'utf-8');
        const connections: Array<{ signal: string; from: string; to: string; method: string }> = [];
        const matches = content.matchAll(/\[connection signal="([^"]+)" from="([^"]+)" to="([^"]+)" method="([^"]+)"\]/g);
        for (const m of matches) {
          connections.push({ signal: m[1], from: m[2], to: m[3], method: m[4] });
        }

        return { content: [{ type: 'text', text: JSON.stringify(connections, null, 2) }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'node_reparent',
        description: 'Reparent a node to a new parent in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            node_path: { type: 'string', description: 'Node to reparent' },
            new_parent: { type: 'string', description: 'New parent node path' },
          },
          required: ['scene_path', 'node_path', 'new_parent'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const nodePath = requireString(args, 'node_path');
        const newParent = requireString(args, 'new_parent');

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const oldParent = nodePath.includes('/') ? nodePath.substring(0, nodePath.lastIndexOf('/')) : '.';
        const nodeName = nodePath.split('/').pop() || nodePath;

        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(`name="${nodeName}"`) && lines[i].includes(`parent="${oldParent}"`)) {
            lines[i] = lines[i].replace(`parent="${oldParent}"`, `parent="${newParent}"`);
            break;
          }
        }

        fs.writeFileSync(resolved, lines.join('\n'), 'utf-8');
        return { content: [{ type: 'text', text: `Reparented "${nodePath}" → "${newParent}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'node_find_by_class',
        description: 'Find all nodes of a specific class in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            class_name: { type: 'string', description: 'Node class to search for' },
          },
          required: ['scene_path', 'class_name'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const className = requireString(args, 'class_name');

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        const content = fs.readFileSync(resolved, 'utf-8');
        const matches: Array<{ name: string; type: string; parent?: string }> = [];
        const regex = new RegExp(`\\[node name="([^"]+)" type="${escapeRegex(className)}"(?: parent="([^"]+)")?\\]`, 'g');
        let m;
        while ((m = regex.exec(content)) !== null) {
          matches.push({ name: m[1], type: className, parent: m[2] });
        }

        return { content: [{ type: 'text', text: JSON.stringify(matches, null, 2) }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'node_find_by_name',
        description: 'Find nodes by name in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            name_pattern: { type: 'string', description: 'Node name or pattern' },
          },
          required: ['scene_path', 'name_pattern'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const namePattern = requireString(args, 'name_pattern');

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        const content = fs.readFileSync(resolved, 'utf-8');
        const matches: Array<{ name: string; type: string; parent?: string }> = [];
        const regex = new RegExp(`\\[node name="([^"]*${escapeRegex(namePattern)}[^"]*)" type="([^"]+)"(?: parent="([^"]+)")?\\]`, 'gi');
        let m;
        while ((m = regex.exec(content)) !== null) {
          matches.push({ name: m[1], type: m[2], parent: m[3] });
        }

        return { content: [{ type: 'text', text: JSON.stringify(matches, null, 2) }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'node_batch_update',
        description: 'Batch update multiple properties on a node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            node_path: { type: 'string', description: 'Node path in scene' },
            properties: { type: 'object', description: 'Properties to update as key-value pairs' },
          },
          required: ['scene_path', 'node_path', 'properties'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const nodePath = requireString(args, 'node_path');
        const properties = requireObject(args, 'properties');

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        for (const [prop, val] of Object.entries(properties)) {
          content = updateNodeProperty(content, nodePath, prop, val);
        }
        fs.writeFileSync(resolved, content, 'utf-8');

        return { content: [{ type: 'text', text: `Batch updated ${Object.keys(properties).length} properties on "${nodePath}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
  ];

  for (const tool of tools) {
    server.registerTool(tool);
  }
}

/* ── Helpers ── */

function getRootNodeName(content: string): string {
  const match = content.match(/\[node name="([^"]+)"/);
  return match ? match[1] : '.';
}

function formatPropertyValue(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) {
    const items = value.map(formatPropertyValue).join(', ');
    return `[${items}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value)
      .map(([k, v]) => `"${k}": ${formatPropertyValue(v)}`)
      .join(', ');
    return `{${entries}}`;
  }
  return 'null';
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeNodeAndChildren(lines: string[], nodePath: string): string[] {
  const nodeName = nodePath.split('/').pop() || nodePath;
  const parentPath = nodePath.includes('/') ? nodePath.substring(0, nodePath.lastIndexOf('/')) : '.';
  const result: string[] = [];
  let skipDepth = 0;

  for (const line of lines) {
    const nodeMatch = line.match(/\[node name="([^"]+)".*parent="([^"]*)"/);
    if (nodeMatch) {
      const name = nodeMatch[1];
      const parent = nodeMatch[2];
      if (name === nodeName && parent === parentPath) {
        skipDepth = 1;
        continue;
      }
      if (skipDepth > 0) {
        skipDepth++;
        continue;
      }
    }
    if (skipDepth > 0) {
      // Check if we've exited the block - simplistic: next [node] or [connection]
      if (line.startsWith('[')) skipDepth = 0;
      else continue;
    }
    result.push(line);
  }

  return result;
}

function extractNodeProperties(content: string, nodePath: string): Record<string, string> {
  const lines = content.split('\n');
  const nodeName = nodePath.split('/').pop() || nodePath;
  const parentPath = nodePath.includes('/') ? nodePath.substring(0, nodePath.lastIndexOf('/')) : '.';
  const props: Record<string, string> = {};
  let inBlock = false;

  for (const line of lines) {
    if (line.match(new RegExp(`\\[node name="${escapeRegex(nodeName)}".*parent="${escapeRegex(parentPath)}"`))) {
      inBlock = true;
      continue;
    }
    if (inBlock) {
      if (line.startsWith('[') || line.trim() === '') break;
      const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
      if (match) props[match[1]] = match[2];
    }
  }

  return props;
}

function updateNodeProperty(content: string, nodePath: string, property: string, value: unknown): string {
  const lines = content.split('\n');
  const nodeName = nodePath.split('/').pop() || nodePath;
  const parentPath = nodePath.includes('/') ? nodePath.substring(0, nodePath.lastIndexOf('/')) : '.';
  let inBlock = false;
  let updated = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(new RegExp(`\\[node name="${escapeRegex(nodeName)}".*parent="${escapeRegex(parentPath)}"`))) {
      inBlock = true;
      continue;
    }
    if (inBlock) {
      if (lines[i].startsWith('[') || lines[i].trim() === '') {
        // Insert property before end of block
        lines.splice(i, 0, `${property} = ${formatPropertyValue(value)}`);
        updated = true;
        break;
      }
      if (lines[i].startsWith(`${property} = `)) {
        lines[i] = `${property} = ${formatPropertyValue(value)}`;
        updated = true;
        break;
      }
    }
  }

  return lines.join('\n');
}

function extractNodeBlock(lines: string[], nodePath: string): string | null {
  const nodeName = nodePath.split('/').pop() || nodePath;
  const parentPath = nodePath.includes('/') ? nodePath.substring(0, nodePath.lastIndexOf('/')) : '.';
  const result: string[] = [];
  let inBlock = false;

  for (const line of lines) {
    if (line.match(new RegExp(`\\[node name="${escapeRegex(nodeName)}".*parent="${escapeRegex(parentPath)}"`))) {
      inBlock = true;
      result.push(line);
      continue;
    }
    if (inBlock) {
      if (line.startsWith('[') || line.trim() === '') break;
      result.push(line);
    }
  }

  return result.length > 0 ? result.join('\n') : null;
}
