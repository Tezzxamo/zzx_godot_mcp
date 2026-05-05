/**
 * zzx-godot-mcp — Scene Management Tools (12 tools)
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ZzxGodotServer } from '../server.js';
import type { ToolRegistration } from '../types/index.js';
import { requireString, optionalString } from '../utils/validators.js';
import { isSafePath, listFiles, normalizeResPath } from '../utils/path-utils.js';

export function registerSceneTools(server: ZzxGodotServer): void {
  const projectPath = server.getConfig().projectPath || process.cwd();

  const tools: ToolRegistration[] = [
    {
      definition: {
        name: 'scene_create',
        description: 'Create a new empty scene file (.tscn).',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Scene file path (res:// or absolute)' },
            root_type: { type: 'string', description: 'Root node type (default: Node2D for 2D, Node3D for 3D, Node for generic)', default: 'Node' },
            root_name: { type: 'string', description: 'Root node name (default: root name from filename)', default: 'Root' },
          },
          required: ['path'],
        },
      },
      handler: async (args) => {
        const filePath = requireString(args, 'path');
        const rootType = (args.root_type as string) || 'Node';
        const rootName = (args.root_name as string) || path.basename(filePath, '.tscn');

        const resolved = filePath.startsWith('res://')
          ? path.join(projectPath, filePath.replace('res://', ''))
          : path.resolve(filePath);

        if (!isSafePath(resolved, projectPath)) {
          return { content: [{ type: 'text', text: 'Error: Path is outside the project directory.' }], isError: true };
        }

        const dir = path.dirname(resolved);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const sceneContent = `[gd_scene format=3 uid="uid://${generateUid()}" load_steps=1]

[node name="${rootName}" type="${rootType}"]
`;
        fs.writeFileSync(resolved, sceneContent, 'utf-8');
        return { content: [{ type: 'text', text: `Created scene: ${filePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'scene_open',
        description: 'Open a scene in the Godot editor (requires WebSocket).',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Scene file path (res://)' },
          },
          required: ['path'],
        },
      },
      handler: async (args) => {
        const filePath = requireString(args, 'path');
        const ws = server.getWebSocket();
        if (!ws.isConnected()) {
          return { content: [{ type: 'text', text: 'WebSocket not connected. Open the scene manually in Godot editor.' }], isError: true };
        }
        const resp = await ws.send({
          id: `${Date.now()}`,
          method: 'editor.open_scene',
          params: { path: filePath },
        });
        if (resp.error) {
          return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        }
        return { content: [{ type: 'text', text: `Opened scene: ${filePath}` }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'scene_save',
        description: 'Save the currently open scene in the Godot editor (requires WebSocket).',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async (_args) => {
        const ws = server.getWebSocket();
        if (!ws.isConnected()) {
          return { content: [{ type: 'text', text: 'WebSocket not connected. Cannot save via editor.' }], isError: true };
        }
        const resp = await ws.send({
          id: `${Date.now()}`,
          method: 'editor.save_scene',
          params: {},
        });
        if (resp.error) {
          return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        }
        return { content: [{ type: 'text', text: 'Scene saved.' }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'editor_screenshot',
        description: 'Capture a screenshot from the Godot editor viewport (requires WebSocket). Returns base64 PNG. Use this when the game is not running or for inspecting the editor UI.',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async (_args) => {
        const ws = server.getWebSocket();
        if (!ws.isConnected()) {
          return {
            content: [{
              type: 'text',
              text: 'WebSocket not connected. Godot editor is not open or MCP plugin is not enabled.\n' +
                    'Steps to fix:\n' +
                    '1. Run: launch_editor (or open Godot manually)\n' +
                    '2. In Godot: Project -> Project Settings -> Plugins -> Enable "ZZX Godot MCP"\n' +
                    '3. Wait 3 seconds, then retry.',
            }],
            isError: true,
          };
        }
        const resp = await ws.send({
          id: `${Date.now()}`,
          method: 'editor.take_screenshot',
          params: {},
        });
        if (resp.error) {
          return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        }
        const base64 = resp.result as string;
        return {
          content: [
            { type: 'text', text: 'Editor screenshot captured:' },
            { type: 'image', data: base64, mimeType: 'image/png' },
          ],
        };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'scene_get_tree',
        description: 'Get the node tree structure of a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Scene file path (res:// or absolute)' },
          },
          required: ['path'],
        },
      },
      handler: async (args) => {
        const filePath = requireString(args, 'path');
        const resolved = filePath.startsWith('res://')
          ? path.join(projectPath, filePath.replace('res://', ''))
          : path.resolve(filePath);

        if (!fs.existsSync(resolved)) {
          return { content: [{ type: 'text', text: `Error: Scene not found: ${filePath}` }], isError: true };
        }

        const content = fs.readFileSync(resolved, 'utf-8');
        const tree = parseSceneTree(content);
        return { content: [{ type: 'text', text: JSON.stringify(tree, null, 2) }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'scene_get_content',
        description: 'Read the raw text content of a .tscn scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Scene file path (res:// or absolute)' },
          },
          required: ['path'],
        },
      },
      handler: async (args) => {
        const filePath = requireString(args, 'path');
        const resolved = filePath.startsWith('res://')
          ? path.join(projectPath, filePath.replace('res://', ''))
          : path.resolve(filePath);

        if (!fs.existsSync(resolved)) {
          return { content: [{ type: 'text', text: `Error: Scene not found: ${filePath}` }], isError: true };
        }

        const content = fs.readFileSync(resolved, 'utf-8');
        return { content: [{ type: 'text', text: content }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'scene_add_instance',
        description: 'Add a PackedScene instance to a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Target scene file path' },
            instance_path: { type: 'string', description: 'PackedScene to instance (res:// path)' },
            parent_path: { type: 'string', description: 'Parent node path in scene (default: root)', default: '.' },
            node_name: { type: 'string', description: 'Name for the instanced node' },
          },
          required: ['scene_path', 'instance_path', 'node_name'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const instancePath = requireString(args, 'instance_path');
        const parentPath = (args.parent_path as string) || '.';
        const nodeName = requireString(args, 'node_name');

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        if (!fs.existsSync(resolved)) {
          return { content: [{ type: 'text', text: `Error: Scene not found: ${scenePath}` }], isError: true };
        }

        let content = fs.readFileSync(resolved, 'utf-8');
        const extResourceId = ensureExtResource(content, instancePath);
        content = content.replace(/\[gd_scene/, `[gd_scene`); // ensure header exists

        const parentName = parentPath === '.' ? getRootNodeName(content) : parentPath;
        const instanceLine = `[node name="${nodeName}" parent="${parentName}" instance=ExtResource("${extResourceId}")]`;

        content = content.trimEnd() + '\n' + instanceLine + '\n';
        fs.writeFileSync(resolved, content, 'utf-8');

        return { content: [{ type: 'text', text: `Instanced ${instancePath} as "${nodeName}" under "${parentName}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'scene_set_main',
        description: 'Set the main scene in project.godot.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Scene path (res://)' },
          },
          required: ['path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'path');
        const projectFile = path.join(projectPath, 'project.godot');

        if (!fs.existsSync(projectFile)) {
          return { content: [{ type: 'text', text: 'Error: project.godot not found.' }], isError: true };
        }

        let content = fs.readFileSync(projectFile, 'utf-8');
        const runMainScene = `run/main_scene="${scenePath}"`;

        if (content.includes('run/main_scene=')) {
          content = content.replace(/run\/main_scene=".*"/, runMainScene);
        } else {
          content += `\n${runMainScene}\n`;
        }

        fs.writeFileSync(projectFile, content, 'utf-8');
        return { content: [{ type: 'text', text: `Set main scene to ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'scene_duplicate',
        description: 'Duplicate a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Source scene path' },
            to: { type: 'string', description: 'Destination scene path' },
          },
          required: ['from', 'to'],
        },
      },
      handler: async (args) => {
        const fromPath = requireString(args, 'from');
        const toPath = requireString(args, 'to');

        const resolvedFrom = fromPath.startsWith('res://')
          ? path.join(projectPath, fromPath.replace('res://', ''))
          : path.resolve(fromPath);
        const resolvedTo = toPath.startsWith('res://')
          ? path.join(projectPath, toPath.replace('res://', ''))
          : path.resolve(toPath);

        if (!fs.existsSync(resolvedFrom)) {
          return { content: [{ type: 'text', text: `Error: Source scene not found: ${fromPath}` }], isError: true };
        }

        fs.copyFileSync(resolvedFrom, resolvedTo);
        return { content: [{ type: 'text', text: `Duplicated ${fromPath} → ${toPath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'scene_rename',
        description: 'Rename a scene file and update internal references.',
        inputSchema: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Current path' },
            to: { type: 'string', description: 'New path' },
          },
          required: ['from', 'to'],
        },
      },
      handler: async (args) => {
        const fromPath = requireString(args, 'from');
        const toPath = requireString(args, 'to');

        const resolvedFrom = fromPath.startsWith('res://')
          ? path.join(projectPath, fromPath.replace('res://', ''))
          : path.resolve(fromPath);
        const resolvedTo = toPath.startsWith('res://')
          ? path.join(projectPath, toPath.replace('res://', ''))
          : path.resolve(toPath);

        if (!fs.existsSync(resolvedFrom)) {
          return { content: [{ type: 'text', text: `Error: Source not found: ${fromPath}` }], isError: true };
        }

        const dir = path.dirname(resolvedTo);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.renameSync(resolvedFrom, resolvedTo);

        return { content: [{ type: 'text', text: `Renamed ${fromPath} → ${toPath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'scene_delete',
        description: 'Delete a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Scene file path' },
          },
          required: ['path'],
        },
      },
      handler: async (args) => {
        const filePath = requireString(args, 'path');
        const resolved = filePath.startsWith('res://')
          ? path.join(projectPath, filePath.replace('res://', ''))
          : path.resolve(filePath);

        if (!fs.existsSync(resolved)) {
          return { content: [{ type: 'text', text: `Error: Scene not found: ${filePath}` }], isError: true };
        }

        fs.unlinkSync(resolved);
        return { content: [{ type: 'text', text: `Deleted scene: ${filePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'scene_list',
        description: 'List all .tscn scene files in the project.',
        inputSchema: {
          type: 'object',
          properties: {
            directory: { type: 'string', description: 'Subdirectory to search (default: entire project)' },
          },
        },
      },
      handler: async (args) => {
        const searchDir = (args.directory as string)
          ? path.join(projectPath, (args.directory as string).replace('res://', ''))
          : projectPath;

        const scenes = listFiles(searchDir, /\.tscn$/).map(f =>
          normalizeResPath(path.relative(projectPath, f))
        );

        return { content: [{ type: 'text', text: `Found ${scenes.length} scenes:\n${scenes.join('\n')}` }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'scene_analyze',
        description: 'Analyze a scene structure and provide optimization suggestions.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Scene file path' },
          },
          required: ['path'],
        },
      },
      handler: async (args) => {
        const filePath = requireString(args, 'path');
        const resolved = filePath.startsWith('res://')
          ? path.join(projectPath, filePath.replace('res://', ''))
          : path.resolve(filePath);

        if (!fs.existsSync(resolved)) {
          return { content: [{ type: 'text', text: `Error: Scene not found: ${filePath}` }], isError: true };
        }

        const content = fs.readFileSync(resolved, 'utf-8');
        const tree = parseSceneTree(content);
        const suggestions: string[] = [];

        const nodeCount = countNodes(tree);
        if (nodeCount > 1000) suggestions.push('⚠️ Scene has many nodes (' + nodeCount + '). Consider splitting into sub-scenes.');
        if (!content.includes('[node name="Camera')) suggestions.push('💡 No Camera node found. Consider adding one.');
        if (content.includes('process_mode = 0')) suggestions.push('💡 Some nodes have process_mode=0 (inherit). Review if all need processing.');

        const report = {
          file: filePath,
          node_count: nodeCount,
          root_type: tree.type,
          root_name: tree.name,
          suggestions: suggestions.length ? suggestions : ['✅ Scene looks good!'],
        };

        return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
      },
      readOnly: true,
    },
  ];

  for (const tool of tools) {
    server.registerTool(tool);
  }
}

/* ── Scene parsing helpers ── */

interface ParsedNode {
  name: string;
  type: string;
  path: string;
  children: ParsedNode[];
}

function parseSceneTree(content: string): ParsedNode {
  const lines = content.split('\n');
  const nodes: Array<{ name: string; type: string; parent?: string }> = [];

  for (const line of lines) {
    const nodeMatch = line.match(/\[node name="([^"]+)"(?: type="([^"]+)")?(?: parent="([^"]+)")?/);
    if (nodeMatch) {
      nodes.push({
        name: nodeMatch[1],
        type: nodeMatch[2] || 'Node',
        parent: nodeMatch[3],
      });
    }
  }

  if (nodes.length === 0) return { name: 'Unknown', type: 'Node', path: '/', children: [] };

  const root = nodes[0];
  const rootNode: ParsedNode = { name: root.name, type: root.type, path: root.name, children: [] };
  const nodeMap = new Map<string, ParsedNode>();
  nodeMap.set(root.name, rootNode);

  for (let i = 1; i < nodes.length; i++) {
    const n = nodes[i];
    const parentPath = n.parent || root.name;
    const parent = nodeMap.get(parentPath);
    const fullPath = parentPath === '.' ? n.name : `${parentPath}/${n.name}`;
    const parsed: ParsedNode = { name: n.name, type: n.type, path: fullPath, children: [] };
    nodeMap.set(fullPath, parsed);
    if (parent) parent.children.push(parsed);
  }

  return rootNode;
}

function countNodes(node: ParsedNode): number {
  let count = 1;
  for (const child of node.children) count += countNodes(child);
  return count;
}

function getRootNodeName(content: string): string {
  const match = content.match(/\[node name="([^"]+)"/);
  return match ? match[1] : '.';
}

function ensureExtResource(content: string, path: string): string {
  const existing = content.match(new RegExp(`\\[ext_resource type="PackedScene" path="${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" id="([^"]+)"\\]`));
  if (existing) return existing[1];

  // Find next available ID
  const ids = [...content.matchAll(/\[ext_resource[^\]]*id="([^"]+)"\]/g)].map(m => m[1]);
  let nextId = 1;
  while (ids.includes(String(nextId))) nextId++;

  const resourceLine = `[ext_resource type="PackedScene" path="${path}" id="${nextId}"]`;
  // Insert after load_steps line or at top
  const lines = content.split('\n');
  let insertIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('[gd_scene') || lines[i].startsWith('[ext_resource')) {
      insertIndex = i + 1;
    }
  }
  lines.splice(insertIndex, 0, resourceLine);
  return String(nextId);
}

function generateUid(): string {
  return Array.from({ length: 13 }, () =>
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)]
  ).join('');
}
