/**
 * zzx-godot-mcp — UI Tools (8 tools)
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ZzxGodotServer } from '../server.js';
import type { ToolRegistration } from '../types/index.js';
import { requireString, optionalString, optionalNumber } from '../utils/validators.js';

export function registerUiTools(server: ZzxGodotServer): void {
  const projectPath = server.getConfig().projectPath || process.cwd();

  const tools: ToolRegistration[] = [
    {
      definition: {
        name: 'ui_create_control',
        description: 'Create a Control node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name' },
            size: { type: 'object', description: '{x, y} size' },
            position: { type: 'object', description: '{x, y} position' },
          },
          required: ['scene_path', 'name'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = requireString(args, 'name');
        const size = args.size as { x?: number; y?: number } | undefined;
        const position = args.position as { x?: number; y?: number } | undefined;

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        let props = '';
        if (size) props += `custom_minimum_size = Vector2(${size.x || 0}, ${size.y || 0})\n`;
        if (position) props += `offset_left = ${position.x || 0}\noffset_top = ${position.y || 0}\n`;

        content = content.trimEnd() + `\n[node name="${name}" type="Control" parent="${parent}"]\n${props}`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created Control "${name}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'ui_create_button',
        description: 'Create a Button node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name', default: 'Button' },
            text: { type: 'string', description: 'Button text', default: 'Button' },
            size: { type: 'object', description: '{x, y} size' },
            position: { type: 'object', description: '{x, y} position' },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = (args.name as string) || 'Button';
        const text = (args.text as string) || 'Button';
        const size = args.size as { x?: number; y?: number } | undefined;
        const position = args.position as { x?: number; y?: number } | undefined;

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        let props = `text = "${text}"\n`;
        if (size) props += `custom_minimum_size = Vector2(${size.x || 0}, ${size.y || 0})\n`;
        if (position) {
          props += `offset_left = ${position.x || 0}\noffset_top = ${position.y || 0}\n`;
        }

        content = content.trimEnd() + `\n[node name="${name}" type="Button" parent="${parent}"]\n${props}`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created Button "${name}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'ui_create_label',
        description: 'Create a Label or RichTextLabel node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name', default: 'Label' },
            text: { type: 'string', description: 'Label text', default: 'Label' },
            rich: { type: 'boolean', description: 'Use RichTextLabel', default: false },
            font_size: { type: 'number', description: 'Font size override' },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = (args.name as string) || 'Label';
        const text = (args.text as string) || 'Label';
        const rich = (args.rich as boolean) ?? false;
        const fontSize = optionalNumber(args, 'font_size');

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        const typeName = rich ? 'RichTextLabel' : 'Label';
        let props = rich ? `text = "${text}"\n` : `text = "${text}"\n`;
        if (fontSize) props += `theme_override_font_sizes/font_size = ${fontSize}\n`;

        content = content.trimEnd() + `\n[node name="${name}" type="${typeName}" parent="${parent}"]\n${props}`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created ${typeName} "${name}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'ui_create_panel',
        description: 'Create a Panel or PanelContainer node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name', default: 'Panel' },
            container: { type: 'boolean', description: 'Use PanelContainer', default: false },
            size: { type: 'object', description: '{x, y} size' },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = (args.name as string) || 'Panel';
        const container = (args.container as boolean) ?? false;
        const size = args.size as { x?: number; y?: number } | undefined;

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        const typeName = container ? 'PanelContainer' : 'Panel';
        let props = '';
        if (size) props += `custom_minimum_size = Vector2(${size.x || 0}, ${size.y || 0})\n`;

        content = content.trimEnd() + `\n[node name="${name}" type="${typeName}" parent="${parent}"]\n${props}`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created ${typeName} "${name}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'ui_create_progress',
        description: 'Create a ProgressBar or TextureProgressBar node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name', default: 'ProgressBar' },
            texture: { type: 'string', description: 'Texture for TextureProgressBar (res://)' },
            max_value: { type: 'number', description: 'Max value', default: 100 },
            value: { type: 'number', description: 'Current value', default: 0 },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = (args.name as string) || 'ProgressBar';
        const texture = optionalString(args, 'texture');
        const maxValue = (args.max_value as number) || 100;
        const value = (args.value as number) || 0;

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        const typeName = texture ? 'TextureProgressBar' : 'ProgressBar';
        let props = `max_value = ${maxValue}\nvalue = ${value}\n`;
        if (texture) {
          const extId = ensureExtResource(content, texture, 'Texture2D');
          props += `texture_progress = ExtResource("${extId}")\n`;
        }

        content = content.trimEnd() + `\n[node name="${name}" type="${typeName}" parent="${parent}"]\n${props}`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created ${typeName} "${name}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'ui_set_theme',
        description: 'Apply or create a Theme resource for a Control node.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            node_path: { type: 'string', description: 'Control node path' },
            theme_path: { type: 'string', description: 'Theme resource path (res://, optional)' },
            font_size: { type: 'number', description: 'Override font size' },
          },
          required: ['scene_path', 'node_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const nodePath = requireString(args, 'node_path');
        const themePath = optionalString(args, 'theme_path');
        const fontSize = optionalNumber(args, 'font_size');

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const nodeName = nodePath.split('/').pop() || nodePath;
        const parentPath = nodePath.includes('/') ? nodePath.substring(0, nodePath.lastIndexOf('/')) : '.';

        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(`name="${nodeName}"`) && lines[i].includes('type="Control"')) {
            if (themePath) {
              const extId = ensureExtResource(content, themePath, 'Theme');
              lines.splice(i + 1, 0, `theme = ExtResource("${extId}")`);
            }
            if (fontSize) {
              lines.splice(i + 1, 0, `theme_override_font_sizes/font_size = ${fontSize}`);
            }
            break;
          }
        }

        fs.writeFileSync(resolved, lines.join('\n'), 'utf-8');
        return { content: [{ type: 'text', text: `Theme applied to ${nodePath} in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'ui_set_anchor',
        description: 'Set anchor preset for a Control node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            node_path: { type: 'string', description: 'Control node path' },
            preset: { type: 'string', description: 'Preset name: top_left, top_right, bottom_left, bottom_right, center, center_top, center_bottom, center_left, center_right, full_rect, hcenter_wide, vcenter_wide' },
          },
          required: ['scene_path', 'node_path', 'preset'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const nodePath = requireString(args, 'node_path');
        const preset = requireString(args, 'preset');

        const presetMap: Record<string, number> = {
          top_left: 0, top_right: 1, bottom_left: 2, bottom_right: 3,
          center_left: 4, center_top: 5, center_right: 6, center_bottom: 7,
          center: 8, left_wide: 9, top_wide: 10, right_wide: 11, bottom_wide: 12,
          vcenter_wide: 13, hcenter_wide: 14, full_rect: 15,
        };
        const presetValue = presetMap[preset];
        if (presetValue === undefined) {
          return { content: [{ type: 'text', text: `Unknown preset: ${preset}` }], isError: true };
        }

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const nodeName = nodePath.split('/').pop() || nodePath;
        const parentPath = nodePath.includes('/') ? nodePath.substring(0, nodePath.lastIndexOf('/')) : '.';

        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(`name="${nodeName}"`) && (lines[i].includes('Control') || lines[i].includes('Button') || lines[i].includes('Label'))) {
            lines.splice(i + 1, 0, `anchors_preset = ${presetValue}`);
            break;
          }
        }

        fs.writeFileSync(resolved, lines.join('\n'), 'utf-8');
        return { content: [{ type: 'text', text: `Set anchor preset "${preset}" on ${nodePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'ui_create_container',
        description: 'Create a container node (HBox, VBox, Grid, etc.) in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name', default: 'Container' },
            container_type: { type: 'string', description: 'hbox, vbox, grid, margin, scroll, tab', default: 'hbox' },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = (args.name as string) || 'Container';
        const containerType = (args.container_type as string) || 'hbox';

        const typeMap: Record<string, string> = {
          hbox: 'HBoxContainer',
          vbox: 'VBoxContainer',
          grid: 'GridContainer',
          margin: 'MarginContainer',
          scroll: 'ScrollContainer',
          tab: 'TabContainer',
          center: 'CenterContainer',
        };
        const typeName = typeMap[containerType] || 'HBoxContainer';

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        content = content.trimEnd() + `\n[node name="${name}" type="${typeName}" parent="${parent}"]\n`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created ${typeName} "${name}" in ${scenePath}` }] };
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

function ensureExtResource(content: string, path: string, type: string): string {
  const existing = content.match(new RegExp(`\\[ext_resource type="${type}" path="${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" id="([^"]+)"\\]`));
  if (existing) return existing[1];
  const ids = [...content.matchAll(/\[ext_resource[^\]]*id="([^"]+)"\]/g)].map(m => m[1]);
  let nextId = 1;
  while (ids.includes(String(nextId))) nextId++;
  return String(nextId);
}
