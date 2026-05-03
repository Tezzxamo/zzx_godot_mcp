/**
 * zzx-godot-mcp — HD-2D Specialized Tools (8 tools)
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ZzxGodotServer } from '../server.js';
import type { ToolRegistration } from '../types/index.js';
import { requireString, optionalString } from '../utils/validators.js';

export function registerHd2dTools(server: ZzxGodotServer): void {
  const projectPath = server.getConfig().projectPath || process.cwd();

  const tools: ToolRegistration[] = [
    {
      definition: {
        name: 'hd2d_setup_pixel_perfect',
        description: 'Configure pixel-perfect rendering settings in project.godot for HD-2D games.',
        inputSchema: {
          type: 'object',
          properties: {
            base_resolution: { type: 'object', description: '{width, height} base pixel resolution', default: { width: 320, height: 180 } },
            window_size: { type: 'object', description: '{width, height} window size', default: { width: 1280, height: 720 } },
          },
        },
      },
      handler: async (args) => {
        const baseRes = (args.base_resolution as { width?: number; height?: number }) || { width: 320, height: 180 };
        const windowSize = (args.window_size as { width?: number; height?: number }) || { width: 1280, height: 720 };
        const projectFile = path.join(projectPath, 'project.godot');

        let content = fs.readFileSync(projectFile, 'utf-8');

        // Update viewport size to base resolution
        content = content.replace(/size\/viewport_width=.*/m, `size/viewport_width=${baseRes.width || 320}`);
        content = content.replace(/size\/viewport_height=.*/m, `size/viewport_height=${baseRes.height || 180}`);
        content = content.replace(/size\/window_width_override=.*/m, `size/window_width_override=${windowSize.width || 1280}`);
        content = content.replace(/size\/window_height_override=.*/m, `size/window_height_override=${windowSize.height || 720}`);

        // Set stretch mode for pixel-perfect
        if (!content.includes('stretch/mode=')) {
          content += '\n[display]\nstretch/mode="canvas_items"\n';
        } else {
          content = content.replace(/stretch\/mode=".*"/m, 'stretch/mode="canvas_items"');
        }

        // Ensure 2D physics and rendering are pixel-snapped
        if (!content.includes('2d/snapping/use_gpu_pixel_snap')) {
          content += '\n[rendering]\n2d/snapping/use_gpu_pixel_snap=true\n';
        }

        fs.writeFileSync(projectFile, content, 'utf-8');
        return { content: [{ type: 'text', text: `Configured pixel-perfect rendering: base ${baseRes.width}x${baseRes.height}, window ${windowSize.width}x${windowSize.height}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'hd2d_create_sprite_atlas',
        description: 'Create a Sprite2D configured for sprite atlas usage in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name' },
            atlas_texture: { type: 'string', description: 'Atlas texture path (res://)' },
            region: { type: 'object', description: 'Atlas region {x, y, width, height}' },
          },
          required: ['scene_path', 'name', 'atlas_texture'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = requireString(args, 'name');
        const atlasTexture = requireString(args, 'atlas_texture');
        const region = args.region as { x?: number; y?: number; width?: number; height?: number } | undefined;

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        const extId = ensureExtResource(content, atlasTexture, 'Texture2D');
        let props = `texture = ExtResource("${extId}")\n`;
        if (region) {
          props += `region_enabled = true\nregion_rect = Rect2(${region.x || 0}, ${region.y || 0}, ${region.width || 16}, ${region.height || 16})\n`;
        }

        content = content.trimEnd() + `\n[node name="${name}" type="Sprite2D" parent="${parent}"]\n${props}`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created atlas sprite "${name}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'hd2d_configure_snap',
        description: 'Configure pixel snap settings in project.godot.',
        inputSchema: {
          type: 'object',
          properties: {
            pixel_snap: { type: 'boolean', description: 'Enable pixel snap', default: true },
            grid_size: { type: 'number', description: 'Grid size in pixels', default: 8 },
          },
        },
      },
      handler: async (args) => {
        const pixelSnap = (args.pixel_snap as boolean) ?? true;
        const gridSize = (args.grid_size as number) || 8;
        const projectFile = path.join(projectPath, 'project.godot');

        let content = fs.readFileSync(projectFile, 'utf-8');

        if (!content.includes('[rendering]')) content += '\n[rendering]\n';
        const snapLine = `2d/snapping/use_gpu_pixel_snap=${pixelSnap ? 'true' : 'false'}`;
        if (content.includes('2d/snapping/use_gpu_pixel_snap=')) {
          content = content.replace(/2d\/snapping\/use_gpu_pixel_snap=.*/m, snapLine);
        } else {
          content += `${snapLine}\n`;
        }

        fs.writeFileSync(projectFile, content, 'utf-8');
        return { content: [{ type: 'text', text: `Pixel snap ${pixelSnap ? 'enabled' : 'disabled'}, grid size: ${gridSize}px` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'hd2d_setup_lighting',
        description: 'Set up HD-2D hybrid lighting: PointLight2D with normal maps support in a scene.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            light_name: { type: 'string', description: 'Light node name', default: 'HD2DLight' },
            color: { type: 'string', description: 'Light color', default: '#ffeedd' },
            energy: { type: 'number', description: 'Light energy', default: 1.5 },
            range: { type: 'number', description: 'Light range', default: 400 },
            shadow_enabled: { type: 'boolean', description: 'Enable shadows', default: true },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const lightName = (args.light_name as string) || 'HD2DLight';
        const color = (args.color as string) || '#ffeedd';
        const energy = (args.energy as number) || 1.5;
        const range = (args.range as number) || 400;
        const shadowEnabled = (args.shadow_enabled as boolean) ?? true;

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = getRootNodeName(content);
        const props = `color = Color("${color}")\nenergy = ${energy}\ntexture_scale = ${range / 100.0}\nshadow_enabled = ${shadowEnabled ? 'true' : 'false'}\n`;

        content = content.trimEnd() + `\n[node name="${lightName}" type="PointLight2D" parent="${parent}"]\n${props}`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created HD-2D PointLight2D "${lightName}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'hd2d_create_depth_effect',
        description: 'Create a parallax depth effect using multiple CanvasLayers in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            layers: { type: 'array', description: 'Layer configs [{name, z_index, parallax_factor}]' },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const layers = (args.layers as Array<{ name?: string; z_index?: number; parallax_factor?: number }>) || [
          { name: 'Background', z_index: -10, parallax_factor: 0.2 },
          { name: 'Midground', z_index: 0, parallax_factor: 0.5 },
          { name: 'Foreground', z_index: 10, parallax_factor: 1.0 },
        ];

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = getRootNodeName(content);

        for (const layer of layers) {
          const lName = layer.name || 'Layer';
          content = content.trimEnd() + `\n[node name="${lName}" type="CanvasLayer" parent="${parent}"]\nz_index = ${layer.z_index || 0}\n`;
        }

        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created ${layers.length} depth layers in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'hd2d_configure_shadow',
        description: 'Configure 2D sprite shadow settings for HD-2D look.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            sprite_path: { type: 'string', description: 'Sprite2D node path' },
            shadow_color: { type: 'string', description: 'Shadow color hex', default: '#00000080' },
            shadow_offset: { type: 'object', description: '{x, y} shadow offset', default: { x: 4, y: 4 } },
          },
          required: ['scene_path', 'sprite_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const spritePath = requireString(args, 'sprite_path');
        const shadowColor = (args.shadow_color as string) || '#00000080';
        const shadowOffset = (args.shadow_offset as { x?: number; y?: number }) || { x: 4, y: 4 };

        // Shadow in Godot 2D can be done with a duplicate sprite or via shader
        // Recommend a shadow sprite approach
        return { content: [{ type: 'text', text: `To add a shadow to ${spritePath}, create a child Sprite2D with the same texture, offset by (${shadowOffset.x}, ${shadowOffset.y}), and tinted to ${shadowColor}. Use node_add with type Sprite2D.` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'hd2d_setup_palette',
        description: 'Configure a limited color palette shader for retro HD-2D look.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            target_node: { type: 'string', description: 'Node to apply palette to (e.g. CanvasLayer)' },
            palette_colors: { type: 'array', description: 'Array of hex colors' },
          },
          required: ['scene_path', 'palette_colors'],
        },
      },
      handler: async (args) => {
        const paletteColors = args.palette_colors as string[];
        const paletteShader = `shader_type canvas_item;\n\nuniform vec4 palette[${paletteColors.length}];\nuniform float threshold : hint_range(0.0, 1.0) = 0.1;\n\nvoid fragment() {\n    vec4 col = texture(TEXTURE, UV);\n    float min_dist = 999.0;\n    vec4 nearest = col;\n    for (int i = 0; i < ${paletteColors.length}; i++) {\n        float d = distance(col.rgb, palette[i].rgb);\n        if (d < min_dist) {\n            min_dist = d;\n            nearest = palette[i];\n        }\n    }\n    COLOR = nearest;\n    COLOR.a = col.a;\n}\n`;
        return { content: [{ type: 'text', text: `Palette shader generated. Save it to a .gdshader file and apply as a material:\n\n${paletteShader}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'hd2d_create_outline',
        description: 'Create an outline effect shader for a sprite.',
        inputSchema: {
          type: 'object',
          properties: {
            outline_color: { type: 'string', description: 'Outline color hex', default: '#000000' },
            outline_width: { type: 'number', description: 'Outline width in pixels', default: 2 },
          },
        },
      },
      handler: async (args) => {
        const color = (args.outline_color as string) || '#000000';
        const width = (args.outline_width as number) || 2;

        const shader = `shader_type canvas_item;\n\nuniform vec4 outline_color : source_color = vec4(${hexToVec4(color)});\nuniform float outline_width : hint_range(0.0, 10.0) = ${width.toFixed(1)};\n\nvoid fragment() {\n    vec4 col = texture(TEXTURE, UV);\n    float alpha = 0.0;\n    for (float x = -outline_width; x <= outline_width; x++) {\n        for (float y = -outline_width; y <= outline_width; y++) {\n            if (x == 0.0 && y == 0.0) continue;\n            alpha += texture(TEXTURE, UV + vec2(x, y) * TEXTURE_PIXEL_SIZE).a;\n        }\n    }\n    vec4 outline = outline_color * clamp(alpha, 0.0, 1.0);\n    COLOR = mix(outline, col, col.a);\n}\n`;
        return { content: [{ type: 'text', text: `Outline shader generated:\n\n${shader}` }] };
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

function hexToVec4(hex: string): string {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16) / 255;
  const g = parseInt(cleaned.substring(2, 4), 16) / 255;
  const b = parseInt(cleaned.substring(4, 6), 16) / 255;
  const a = cleaned.length >= 8 ? parseInt(cleaned.substring(6, 8), 16) / 255 : 1;
  return `${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)}, ${a.toFixed(3)}`;
}
