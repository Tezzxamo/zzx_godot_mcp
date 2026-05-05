/**
 * zzx-godot-mcp — Project Management Tools (8 tools)
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { ZzxGodotServer } from '../server.js';
import type { ToolRegistration } from '../types/index.js';
import { requireString, optionalString, requireObject } from '../utils/validators.js';
import { isSafePath, listFiles, normalizeResPath } from '../utils/path-utils.js';

export function registerProjectTools(server: ZzxGodotServer): void {
  const projectPath = server.getConfig().projectPath || process.cwd();

  const tools: ToolRegistration[] = [
    {
      definition: {
        name: 'project_create',
        description: 'Create a new Godot project from scratch with optional renderer.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Project directory path' },
            name: { type: 'string', description: 'Project name' },
            renderer: { type: 'string', description: 'Renderer: forward_plus, mobile, gl_compatibility', default: 'forward_plus' },
            template: { type: 'string', description: 'Template: empty, 2d, hd2d, 3d', default: 'empty' },
          },
          required: ['path', 'name'],
        },
      },
      handler: async (args) => {
        const dirPath = requireString(args, 'path');
        const name = requireString(args, 'name');
        const renderer = (args.renderer as string) || 'forward_plus';
        const template = (args.template as string) || 'empty';

        const resolved = path.resolve(dirPath);
        if (!fs.existsSync(resolved)) {
          fs.mkdirSync(resolved, { recursive: true });
        }

        const projectFile = path.join(resolved, 'project.godot');
        const config = `; Engine Configuration File.
; Godot version: 4.6

[application]
config/name="${name}"
config/features=PackedStringArray("4.6", "${renderer === 'gl_compatibility' ? 'GL Compatibility' : 'Forward Plus'}")
config/icon="res://icon.svg"

[rendering]
renderer/rendering_method="${renderer}"
`;
        fs.writeFileSync(projectFile, config, 'utf-8');

        // Create basic directory structure
        const dirs = ['scenes', 'scripts', 'assets', 'resources'];
        for (const d of dirs) {
          fs.mkdirSync(path.join(resolved, d), { recursive: true });
        }

        // Add template starter scene if requested
        if (template !== 'empty') {
          const rootType = template === '3d' ? 'Node3D' : 'Node2D';
          const sceneContent = `[gd_scene format=3 uid="uid://${generateUid()}" load_steps=1]

[node name="Main" type="${rootType}"]
`;
          fs.writeFileSync(path.join(resolved, 'scenes', 'main.tscn'), sceneContent, 'utf-8');

          // Update main scene
          let proj = fs.readFileSync(projectFile, 'utf-8');
          proj += `\n[application]\nrun/main_scene="res://scenes/main.tscn"\n`;
          fs.writeFileSync(projectFile, proj, 'utf-8');
        }

        return { content: [{ type: 'text', text: `Created project "${name}" at ${resolved}\nRenderer: ${renderer}\nTemplate: ${template}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'project_info',
        description: 'Get project information from project.godot.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async (_args) => {
        const projectFile = path.join(projectPath, 'project.godot');
        if (!fs.existsSync(projectFile)) {
          return { content: [{ type: 'text', text: 'Error: project.godot not found.' }], isError: true };
        }

        const content = fs.readFileSync(projectFile, 'utf-8');
        const info: Record<string, string> = {};
        const lines = content.split('\n');
        for (const line of lines) {
          const match = line.match(/^([a-z_/]+)="?([^"\n]+)"?/);
          if (match) info[match[1]] = match[2];
        }

        return { content: [{ type: 'text', text: JSON.stringify(info, null, 2) }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'project_settings',
        description: 'Get or set a project setting in project.godot.',
        inputSchema: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Setting key (e.g. display/window/size/viewport_width)' },
            value: { description: 'New value (omit to get current value)' },
          },
          required: ['key'],
        },
      },
      handler: async (args) => {
        const key = requireString(args, 'key');
        const value = args.value;
        const projectFile = path.join(projectPath, 'project.godot');

        if (!fs.existsSync(projectFile)) {
          return { content: [{ type: 'text', text: 'Error: project.godot not found.' }], isError: true };
        }

        let content = fs.readFileSync(projectFile, 'utf-8');

        if (value === undefined) {
          // Get value
          const regex = new RegExp(`^${key.replace(/\//g, '\\/')}=(.+)$`, 'm');
          const match = content.match(regex);
          if (match) {
            return { content: [{ type: 'text', text: `${key} = ${match[1]}` }] };
          }
          return { content: [{ type: 'text', text: `Setting "${key}" not found.` }] };
        }

        // Set value
        const formattedValue = formatSettingValue(value);
        const regex = new RegExp(`^(${key.replace(/\//g, '\\/')}=).+$`, 'm');
        if (regex.test(content)) {
          content = content.replace(regex, `$1${formattedValue}`);
        } else {
          content += `\n${key}=${formattedValue}\n`;
        }

        fs.writeFileSync(projectFile, content, 'utf-8');
        return { content: [{ type: 'text', text: `Set ${key} = ${formattedValue}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'project_autoloads',
        description: 'List, add, or remove autoload singletons.',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', description: 'Action: list, add, remove' },
            name: { type: 'string', description: 'Autoload name (for add/remove)' },
            path: { type: 'string', description: 'Script path (for add)' },
          },
          required: ['action'],
        },
      },
      handler: async (args) => {
        const action = requireString(args, 'action');
        const projectFile = path.join(projectPath, 'project.godot');

        if (!fs.existsSync(projectFile)) {
          return { content: [{ type: 'text', text: 'Error: project.godot not found.' }], isError: true };
        }

        let content = fs.readFileSync(projectFile, 'utf-8');

        if (action === 'list') {
          const autoloads: Array<{ name: string; path: string }> = [];
          const matches = content.matchAll(/^(\w+)="\*?res:\/\/(.+)"$/gm);
          for (const m of matches) {
            if (m[0].includes('*')) {
              autoloads.push({ name: m[1], path: 'res://' + m[2] });
            }
          }
          return { content: [{ type: 'text', text: JSON.stringify(autoloads, null, 2) }] };
        }

        if (action === 'add') {
          const autoName = requireString(args, 'name');
          const autoPath = requireString(args, 'path');
          const line = `${autoName}="*${autoPath}"`;

          if (content.includes(`${autoName}=`)) {
            content = content.replace(new RegExp(`^${autoName}=.+$`, 'm'), line);
          } else {
            if (!content.includes('[autoload]')) content += '\n[autoload]\n';
            content = content.replace('[autoload]', `[autoload]\n${line}`);
          }
          fs.writeFileSync(projectFile, content, 'utf-8');
          return { content: [{ type: 'text', text: `Added autoload: ${autoName} → ${autoPath}` }] };
        }

        if (action === 'remove') {
          const autoName = requireString(args, 'name');
          content = content.replace(new RegExp(`^${autoName}=.+$\\n?`, 'm'), '');
          fs.writeFileSync(projectFile, content, 'utf-8');
          return { content: [{ type: 'text', text: `Removed autoload: ${autoName}` }] };
        }

        return { content: [{ type: 'text', text: 'Error: action must be list, add, or remove.' }], isError: true };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'project_input_map',
        description: 'List, add, or remove InputMap actions.',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', description: 'Action: list, add, remove' },
            action_name: { type: 'string', description: 'Input action name' },
            events: { type: 'array', description: 'Input events array for add (e.g. [{"type":"key","keycode":65}])' },
          },
          required: ['action'],
        },
      },
      handler: async (args) => {
        const action = requireString(args, 'action');
        const projectFile = path.join(projectPath, 'project.godot');

        if (!fs.existsSync(projectFile)) {
          return { content: [{ type: 'text', text: 'Error: project.godot not found.' }], isError: true };
        }

        let content = fs.readFileSync(projectFile, 'utf-8');

        if (action === 'list') {
          const actions: string[] = [];
          const matches = content.matchAll(/^([a-zA-Z_]\w+)=$/gm);
          for (const m of matches) {
            // This is a heuristic - true input actions have events following
            if (content.includes(`${m[1]}=`)) actions.push(m[1]);
          }
          // Better approach: find [input] section
          const inputSection = content.match(/\[input\]([\s\S]*?)(?=\n\[|$)/);
          const result: string[] = [];
          if (inputSection) {
            const lines = inputSection[1].split('\n');
            for (const line of lines) {
              const match = line.match(/^(\w+)=\{/);
              if (match) result.push(match[1]);
            }
          }
          return { content: [{ type: 'text', text: `Input actions:\n${result.join('\n')}` }] };
        }

        if (action === 'add') {
          const actionName = requireString(args, 'action_name');
          const events = (args.events as Array<Record<string, unknown>>) || [];

          if (!content.includes('[input]')) content += '\n[input]\n';

          let eventLines = '';
          for (const evt of events) {
            const type = evt.type as string;
            if (type === 'key') {
              eventLines += `${actionName}={"deadzone":0.5,"events":[${JSON.stringify({ physical_keycode: evt.keycode, keycode: 0, unicode: 0, echo: false, pressed: true, alt_pressed: false, shift_pressed: false, ctrl_pressed: false, meta_pressed: false, button_mask: 0, "device": -1 })}]}\n`;
            }
          }

          if (!eventLines) {
            eventLines = `${actionName}={"deadzone":0.5,"events":[]}\n`;
          }

          // Replace existing or append
          if (content.includes(`${actionName}=`)) {
            content = content.replace(new RegExp(`^${actionName}=.+$\\n?`, 'm'), eventLines);
          } else {
            content = content.replace('[input]', `[input]\n${eventLines}`);
          }

          fs.writeFileSync(projectFile, content, 'utf-8');
          return { content: [{ type: 'text', text: `Added input action: ${actionName}` }] };
        }

        if (action === 'remove') {
          const actionName = requireString(args, 'action_name');
          content = content.replace(new RegExp(`^${actionName}=.+$\\n?`, 'm'), '');
          fs.writeFileSync(projectFile, content, 'utf-8');
          return { content: [{ type: 'text', text: `Removed input action: ${actionName}` }] };
        }

        return { content: [{ type: 'text', text: 'Error: action must be list, add, or remove.' }], isError: true };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'project_layers',
        description: 'Get or set physics/rendering layer names.',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Layer type: 2d_physics, 3d_physics, 2d_navigation, 2d_render' },
            layers: { type: 'object', description: 'Layer map: { "1": "Player", "2": "Enemy" }' },
          },
          required: ['type'],
        },
      },
      handler: async (args) => {
        const layerType = requireString(args, 'type');
        const layers = args.layers as Record<string, string> | undefined;
        const projectFile = path.join(projectPath, 'project.godot');

        if (!fs.existsSync(projectFile)) {
          return { content: [{ type: 'text', text: 'Error: project.godot not found.' }], isError: true };
        }

        let content = fs.readFileSync(projectFile, 'utf-8');
        const sectionMap: Record<string, string> = {
          '2d_physics': 'layer_names/2d_physics',
          '3d_physics': 'layer_names/3d_physics',
          '2d_navigation': 'layer_names/2d_navigation',
          '2d_render': 'layer_names/2d_render',
        };
        const prefix = sectionMap[layerType];

        if (!layers) {
          // Get current layers
          const result: Record<string, string> = {};
          const regex = new RegExp(`^${prefix}/layer_(\\d+)="?([^"\n]+)"?`, 'gm');
          let m;
          while ((m = regex.exec(content)) !== null) {
            result[m[1]] = m[2];
          }
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        // Set layers
        if (!content.includes('[layer_names]')) content += '\n[layer_names]\n';
        for (const [num, name] of Object.entries(layers)) {
          const key = `${prefix}/layer_${num}`;
          const line = `${key}="${name}"`;
          if (content.includes(`${key}=`)) {
            content = content.replace(new RegExp(`^${key.replace(/\//g, '\\/')}=.+$`, 'm'), line);
          } else {
            content = content.replace('[layer_names]', `[layer_names]\n${line}`);
          }
        }

        fs.writeFileSync(projectFile, content, 'utf-8');
        return { content: [{ type: 'text', text: `Updated ${layerType} layers.` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'project_export_presets',
        description: 'List or configure export presets.',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', description: 'Action: list, add' },
            preset_name: { type: 'string', description: 'Preset name' },
            platform: { type: 'string', description: 'Platform: windows, macos, linux, android, ios, web' },
          },
          required: ['action'],
        },
      },
      handler: async (args) => {
        const action = requireString(args, 'action');
        const exportFile = path.join(projectPath, 'export_presets.cfg');

        if (action === 'list') {
          if (!fs.existsSync(exportFile)) {
            return { content: [{ type: 'text', text: 'No export presets configured.' }] };
          }
          const content = fs.readFileSync(exportFile, 'utf-8');
          const presets: Array<{ name: string; platform: string }> = [];
          const matches = content.matchAll(/\[preset\.(\d+)\]\nname="([^"]+)"\nplatform="([^"]+)"/g);
          for (const m of matches) {
            presets.push({ name: m[2], platform: m[3] });
          }
          return { content: [{ type: 'text', text: JSON.stringify(presets, null, 2) }] };
        }

        if (action === 'add') {
          const presetName = requireString(args, 'preset_name');
          const platform = requireString(args, 'platform');

          let content = '';
          if (fs.existsSync(exportFile)) {
            content = fs.readFileSync(exportFile, 'utf-8');
          }

          const presetCount = (content.match(/\[preset\.\d+\]/g) || []).length;
          const newPreset = `[preset.${presetCount}]\nname="${presetName}"\nplatform="${platform}"\nrunnable=true\n`;
          content += newPreset;

          fs.writeFileSync(exportFile, content, 'utf-8');
          return { content: [{ type: 'text', text: `Added export preset: ${presetName} (${platform})` }] };
        }

        return { content: [{ type: 'text', text: 'Error: action must be list or add.' }], isError: true };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'project_filesystem',
        description: 'Get the project file system tree.',
        inputSchema: {
          type: 'object',
          properties: {
            directory: { type: 'string', description: 'Subdirectory (default: project root)' },
            max_depth: { type: 'number', description: 'Maximum depth (default: 10)' },
          },
        },
      },
      handler: async (args) => {
        const dir = (args.directory as string)
          ? path.join(projectPath, (args.directory as string).replace('res://', ''))
          : projectPath;
        const maxDepth = (args.max_depth as number) || 10;

        function buildTree(currentDir: string, depth: number): Record<string, unknown> {
          const name = path.basename(currentDir);
          const result: Record<string, unknown> = { name, type: 'directory' };

          if (depth >= maxDepth) {
            result.children = [];
            return result;
          }

          const entries = fs.readdirSync(currentDir, { withFileTypes: true });
          const children: Array<Record<string, unknown>> = [];

          for (const entry of entries) {
            if (entry.name.startsWith('.') && entry.name !== '.git') continue;
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
              children.push(buildTree(fullPath, depth + 1));
            } else {
              children.push({ name: entry.name, type: 'file' });
            }
          }

          result.children = children;
          return result;
        }

        const tree = buildTree(dir, 0);
        return { content: [{ type: 'text', text: JSON.stringify(tree, null, 2) }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'list_projects',
        description: 'Find Godot projects in a directory (optionally recursive).',
        inputSchema: {
          type: 'object',
          properties: {
            directory: { type: 'string', description: 'Directory to search' },
            recursive: { type: 'boolean', description: 'Whether to search recursively (default: false)', default: false },
          },
          required: ['directory'],
        },
      },
      handler: async (args) => {
        const directory = requireString(args, 'directory');
        const recursive = (args.recursive as boolean) ?? false;

        if (!fs.existsSync(directory)) {
          return { content: [{ type: 'text', text: `Directory does not exist: ${directory}` }], isError: true };
        }

        const projects: Array<{ path: string; name: string }> = [];

        function scan(dir: string, depth: number): void {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.name.startsWith('.')) continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              const projectFile = path.join(fullPath, 'project.godot');
              if (fs.existsSync(projectFile)) {
                projects.push({ path: fullPath, name: entry.name });
              } else if (recursive && depth < 5) {
                scan(fullPath, depth + 1);
              }
            }
          }
        }

        // Also check if the directory itself is a project
        const rootProjectFile = path.join(directory, 'project.godot');
        if (fs.existsSync(rootProjectFile)) {
          projects.push({ path: directory, name: path.basename(directory) });
        }

        scan(directory, 0);
        return { content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'get_uid',
        description: 'Get the UID for a specific file in a Godot project (Godot 4.4+).',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'File path (relative to project or res://)' },
          },
          required: ['file_path'],
        },
      },
      handler: async (args) => {
        const filePath = requireString(args, 'file_path');
        const headless = server.getHeadless();
        const resp = await headless.send({
          id: `${Date.now()}`,
          method: 'get_uid',
          params: { file_path: filePath },
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
        name: 'update_project_uids',
        description: 'Update UID references in a Godot project by resaving resources (Godot 4.4+).',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async (_args) => {
        const headless = server.getHeadless();
        const resp = await headless.send({
          id: `${Date.now()}`,
          method: 'update_project_uids',
          params: {},
        });
        if (resp.error) {
          return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(resp.result, null, 2) }] };
      },
      readOnly: false,
    },
  ];

  for (const tool of tools) {
    server.registerTool(tool);
  }
}

function formatSettingValue(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return JSON.stringify(value);
  return String(value);
}

function generateUid(): string {
  return Array.from({ length: 13 }, () =>
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)]
  ).join('');
}
