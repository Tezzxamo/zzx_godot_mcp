/**
 * zzx-godot-mcp — 2D Rendering Tools (12 tools)
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ZzxGodotServer } from '../server.js';
import type { ToolRegistration } from '../types/index.js';
import { requireString, optionalString, requireNumber, optionalNumber } from '../utils/validators.js';

export function registerRendering2DTools(server: ZzxGodotServer): void {
  const projectPath = server.getConfig().projectPath || process.cwd();

  const tools: ToolRegistration[] = [
    {
      definition: {
        name: 'render2d_create_sprite',
        description: 'Create a Sprite2D node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name' },
            texture: { type: 'string', description: 'Texture path (res://)' },
            position: { type: 'object', description: '{x, y}' },
            scale: { type: 'object', description: '{x, y}' },
          },
          required: ['scene_path', 'name'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = requireString(args, 'name');
        const texture = optionalString(args, 'texture');
        const position = args.position as { x?: number; y?: number } | undefined;
        const scale = args.scale as { x?: number; y?: number } | undefined;

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        let props = '';
        if (position) props += `position = Vector2(${position.x || 0}, ${position.y || 0})\n`;
        if (scale) props += `scale = Vector2(${scale.x || 1}, ${scale.y || 1})\n`;

        if (texture) {
          const extId = ensureExtResource(content, texture, 'Texture2D');
          content = content.replace(/\[gd_scene/, `[gd_scene`);
          props += `texture = ExtResource("${extId}")\n`;
        }

        content = content.trimEnd() + `\n[node name="${name}" type="Sprite2D" parent="${parent}"]\n${props}`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created Sprite2D "${name}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'render2d_create_tilemap',
        description: 'Create a TileMap node with TileMapLayers in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'TileMap node name', default: 'TileMap' },
            layers: { type: 'array', description: 'Layer names (default: ["Ground"])' },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = (args.name as string) || 'TileMap';
        const layers = (args.layers as string[]) || ['Ground'];

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;

        content = content.trimEnd() + `\n[node name="${name}" type="TileMap" parent="${parent}"]\nformat = 2\n`;
        for (let i = 0; i < layers.length; i++) {
          content += `\n[node name="${layers[i]}" type="TileMapLayer" parent="${parent === '.' ? name : parentPath + '/' + name}"]\ntile_map_data = PackedByteArray()\ntile_set = SubResource("TileSet_${i + 1}")\n`;
        }

        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created TileMap "${name}" with ${layers.length} layers in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'render2d_tilemap_set_cells',
        description: 'Set tile cells in a TileMapLayer (via scene file edit).',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            layer_path: { type: 'string', description: 'TileMapLayer node path in scene' },
            cells: { type: 'array', description: 'Array of {x, y, atlas_coords, source_id}' },
          },
          required: ['scene_path', 'layer_path', 'cells'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const layerPath = requireString(args, 'layer_path');
        const cells = args.cells as Array<{ x: number; y: number; atlas_coords?: { x: number; y: number }; source_id?: number }>;

        return { content: [{ type: 'text', text: `TileMap cell editing is best done via Godot editor or runtime_eval. Use runtime_eval to set cells programmatically.` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'render2d_tilemap_get_cells',
        description: 'Get tile cell data from a TileMapLayer node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            layer_path: { type: 'string', description: 'TileMapLayer node path' },
          },
          required: ['scene_path', 'layer_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const layerPath = requireString(args, 'layer_path');

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        const content = fs.readFileSync(resolved, 'utf-8');
        return { content: [{ type: 'text', text: `TileMap cell data is stored in binary PackedByteArray in .tscn. Use runtime_get_property to read live tile data.` }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'render2d_create_particles',
        description: 'Create a GPUParticles2D node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name', default: 'GPUParticles2D' },
            texture: { type: 'string', description: 'Particle texture path (res://)' },
            amount: { type: 'number', description: 'Particle amount', default: 32 },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = (args.name as string) || 'GPUParticles2D';
        const amount = (args.amount as number) || 32;
        const texture = optionalString(args, 'texture');

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        let props = `amount = ${amount}\n`;

        if (texture) {
          const extId = ensureExtResource(content, texture, 'Texture2D');
          props += `texture = ExtResource("${extId}")\n`;
        }

        content = content.trimEnd() + `\n[node name="${name}" type="GPUParticles2D" parent="${parent}"]\n${props}`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created GPUParticles2D "${name}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'render2d_create_light',
        description: 'Create a 2D light node (PointLight2D or DirectionalLight2D).',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name' },
            light_type: { type: 'string', description: 'point or directional', default: 'point' },
            color: { type: 'string', description: 'Light color hex (default: #ffffff)' },
            energy: { type: 'number', description: 'Light energy', default: 1 },
            range: { type: 'number', description: 'Range (for point light)', default: 300 },
          },
          required: ['scene_path', 'name'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = requireString(args, 'name');
        const lightType = (args.light_type as string) || 'point';
        const color = (args.color as string) || '#ffffff';
        const energy = (args.energy as number) || 1;
        const range = (args.range as number) || 300;

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        const typeName = lightType === 'directional' ? 'DirectionalLight2D' : 'PointLight2D';
        const props = `color = Color("${color}")\nenergy = ${energy}\n${lightType === 'point' ? `texture_scale = ${range / 100.0}\n` : ''}`;

        content = content.trimEnd() + `\n[node name="${name}" type="${typeName}" parent="${parent}"]\n${props}`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created ${typeName} "${name}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'render2d_create_camera',
        description: 'Create a Camera2D node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name', default: 'Camera2D' },
            zoom: { type: 'object', description: 'Zoom {x, y}', default: { x: 1, y: 1 } },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = (args.name as string) || 'Camera2D';
        const zoom = (args.zoom as { x?: number; y?: number }) || { x: 1, y: 1 };

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        const props = `zoom = Vector2(${zoom.x || 1}, ${zoom.y || 1})\n`;

        content = content.trimEnd() + `\n[node name="${name}" type="Camera2D" parent="${parent}"]\n${props}`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created Camera2D "${name}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'render2d_create_canvas_layer',
        description: 'Create a CanvasLayer node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name', default: 'CanvasLayer' },
            layer: { type: 'number', description: 'Layer index', default: 1 },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = (args.name as string) || 'CanvasLayer';
        const layer = (args.layer as number) || 1;

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        const props = `layer = ${layer}\n`;

        content = content.trimEnd() + `\n[node name="${name}" type="CanvasLayer" parent="${parent}"]\n${props}`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created CanvasLayer "${name}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'render2d_set_viewport',
        description: 'Configure viewport settings in project.godot.',
        inputSchema: {
          type: 'object',
          properties: {
            width: { type: 'number', description: 'Viewport width' },
            height: { type: 'number', description: 'Viewport height' },
            stretch_mode: { type: 'string', description: 'canvas_items, viewport, or disabled' },
            stretch_aspect: { type: 'string', description: 'ignore, keep, keep_width, keep_height, expand' },
          },
        },
      },
      handler: async (args) => {
        const projectFile = path.join(projectPath, 'project.godot');
        let content = fs.readFileSync(projectFile, 'utf-8');

        const width = args.width as number | undefined;
        const height = args.height as number | undefined;
        const stretchMode = args.stretch_mode as string | undefined;
        const stretchAspect = args.stretch_aspect as string | undefined;

        if (width !== undefined) content = content.replace(/size\/viewport_width=.*/, `size/viewport_width=${width}`);
        if (height !== undefined) content = content.replace(/size\/viewport_height=.*/, `size/viewport_height=${height}`);
        if (stretchMode) content = content.replace(/stretch\/mode=".*"/, `stretch/mode="${stretchMode}"`);
        if (stretchAspect) content = content.replace(/stretch\/aspect=".*"/, `stretch/aspect="${stretchAspect}"`);

        fs.writeFileSync(projectFile, content, 'utf-8');
        return { content: [{ type: 'text', text: 'Viewport settings updated.' }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'render2d_create_animation_sprite',
        description: 'Create an AnimatedSprite2D node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name', default: 'AnimatedSprite2D' },
            sprite_frames: { type: 'string', description: 'SpriteFrames resource path (res://)' },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = (args.name as string) || 'AnimatedSprite2D';
        const spriteFrames = optionalString(args, 'sprite_frames');

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        let props = '';

        if (spriteFrames) {
          const extId = ensureExtResource(content, spriteFrames, 'SpriteFrames');
          props += `sprite_frames = ExtResource("${extId}")\n`;
        }

        content = content.trimEnd() + `\n[node name="${name}" type="AnimatedSprite2D" parent="${parent}"]\n${props}`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created AnimatedSprite2D "${name}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'render2d_configure_tileset',
        description: 'Create a basic TileSet resource file for a TileMap.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'TileSet resource path (.tres)' },
            atlas_texture: { type: 'string', description: 'Atlas texture path (res://)' },
            tile_size: { type: 'object', description: '{x, y} tile size', default: { x: 16, y: 16 } },
          },
          required: ['path'],
        },
      },
      handler: async (args) => {
        const filePath = requireString(args, 'path');
        const atlasTexture = optionalString(args, 'atlas_texture');
        const tileSize = (args.tile_size as { x?: number; y?: number }) || { x: 16, y: 16 };

        const resolved = filePath.startsWith('res://')
          ? path.join(projectPath, filePath.replace('res://', ''))
          : path.resolve(filePath);

        let content = `[gd_resource type="TileSet" format=3]\n\n`;
        if (atlasTexture) {
          content += `[ext_resource type="Texture2D" path="${atlasTexture}" id="1"]\n\n`;
        }
        content += `[resource]\ntile_size = Vector2i(${tileSize.x || 16}, ${tileSize.y || 16})\n`;
        if (atlasTexture) {
          content += `
[sub_resource type="TileSetAtlasSource" id="1"]
texture = ExtResource("1")
margins = Vector2i(0, 0)
separation = Vector2i(0, 0)
texture_region_size = Vector2i(${tileSize.x || 16}, ${tileSize.y || 16})
0:0/0 = 0
`;
          content += `sources/0 = SubResource("1")\n`;
        }

        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created TileSet: ${filePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'render2d_create_parallax',
        description: 'Create a ParallaxBackground with ParallaxLayer in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name', default: 'ParallaxBackground' },
            layers: { type: 'array', description: 'Layer configs [{name, motion_scale, texture}]' },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = (args.name as string) || 'ParallaxBackground';
        const layers = (args.layers as Array<{ name?: string; motion_scale?: { x?: number; y?: number }; texture?: string }>) || [{ name: 'Layer1' }];

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;

        content = content.trimEnd() + `\n[node name="${name}" type="ParallaxBackground" parent="${parent}"]\n`;
        for (const layer of layers) {
          const lName = layer.name || 'Layer';
          const scale = layer.motion_scale || { x: 0.5, y: 0.5 };
          content += `\n[node name="${lName}" type="ParallaxLayer" parent="${parent === '.' ? name : parentPath + '/' + name}"]\nmotion_scale = Vector2(${scale.x || 0.5}, ${scale.y || 0.5})\n`;
          if (layer.texture) {
            const extId = ensureExtResource(content, layer.texture, 'Texture2D');
            content += `[node name="Sprite2D" type="Sprite2D" parent="${parent === '.' ? name : parentPath + '/' + name}/${lName}"]\ntexture = ExtResource("${extId}")\n`;
          }
        }

        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created ParallaxBackground "${name}" with ${layers.length} layers in ${scenePath}` }] };
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
