/**
 * zzx-godot-mcp — Resource Management Tools (10 tools)
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ZzxGodotServer } from '../server.js';
import type { ToolRegistration } from '../types/index.js';
import { requireString, optionalString } from '../utils/validators.js';
import { isSafePath, listFiles, normalizeResPath } from '../utils/path-utils.js';

export function registerResourceTools(server: ZzxGodotServer): void {
  const projectPath = server.getConfig().projectPath || process.cwd();

  const tools: ToolRegistration[] = [
    {
      definition: {
        name: 'res_create_material',
        description: 'Create a StandardMaterial3D or CanvasItemMaterial resource file.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Resource file path (.tres)' },
            type: { type: 'string', description: 'Material type: standard3d, canvas_item', default: 'standard3d' },
            properties: { type: 'object', description: 'Material properties' },
          },
          required: ['path'],
        },
      },
      handler: async (args) => {
        const filePath = requireString(args, 'path');
        const matType = (args.type as string) || 'standard3d';
        const properties = (args.properties as Record<string, unknown>) || {};

        const resolved = filePath.startsWith('res://')
          ? path.join(projectPath, filePath.replace('res://', ''))
          : path.resolve(filePath);

        const typeName = matType === 'canvas_item' ? 'CanvasItemMaterial' : 'StandardMaterial3D';
        let content = `[gd_resource type="${typeName}" format=3]\n\n[resource]\n`;
        for (const [k, v] of Object.entries(properties)) {
          content += `${k} = ${formatResValue(v)}\n`;
        }

        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created material: ${filePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'res_create_shader',
        description: 'Create a GDShader file.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Shader file path (.gdshader)' },
            type: { type: 'string', description: 'Shader type: spatial, canvas_item, particles, sky, fog', default: 'spatial' },
            code: { type: 'string', description: 'Shader code (optional, generates template if empty)' },
          },
          required: ['path'],
        },
      },
      handler: async (args) => {
        const filePath = requireString(args, 'path');
        const shaderType = (args.type as string) || 'spatial';
        const code = (args.code as string) || getShaderTemplate(shaderType);

        const resolved = filePath.startsWith('res://')
          ? path.join(projectPath, filePath.replace('res://', ''))
          : path.resolve(filePath);

        fs.writeFileSync(resolved, `shader_type ${shaderType};\n\n${code}`, 'utf-8');
        return { content: [{ type: 'text', text: `Created shader: ${filePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'res_import_texture',
        description: 'Configure texture import settings (.import file).',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Texture path (res://)' },
            settings: { type: 'object', description: 'Import settings: { compress/mode, mipmaps/generate, etc. }' },
          },
          required: ['path'],
        },
      },
      handler: async (args) => {
        const texPath = requireString(args, 'path');
        const settings = (args.settings as Record<string, unknown>) || {};

        const resolved = texPath.startsWith('res://')
          ? path.join(projectPath, texPath.replace('res://', ''))
          : path.resolve(texPath);

        const importFile = resolved + '.import';
        if (!fs.existsSync(importFile)) {
          // Create basic import file
          const uid = generateUid();
          const content = `[remap]\nimporter="texture"\ntype="CompressedTexture2D"\nuid="uid://${uid}"\npath="res://.godot/imported/${path.basename(resolved)}-${uid}.ctex"\n\n[deps]\nsource_file="${texPath}"\n\n[params]\ncompress/mode=0\nmipmaps/generate=false\n`;
          fs.writeFileSync(importFile, content, 'utf-8');
        }

        let content = fs.readFileSync(importFile, 'utf-8');
        for (const [k, v] of Object.entries(settings)) {
          if (content.includes(`${k}=`)) {
            content = content.replace(new RegExp(`^${k}=.+$`, 'm'), `${k}=${v}`);
          } else {
            content += `\n${k}=${v}`;
          }
        }
        fs.writeFileSync(importFile, content, 'utf-8');

        return { content: [{ type: 'text', text: `Updated import settings for ${texPath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'res_import_model',
        description: 'Configure 3D model import settings (.import file).',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Model path (res://, .glb/.gltf/.fbx)' },
            settings: { type: 'object', description: 'Import settings' },
          },
          required: ['path'],
        },
      },
      handler: async (args) => {
        const modelPath = requireString(args, 'path');
        const settings = (args.settings as Record<string, unknown>) || {};

        const resolved = modelPath.startsWith('res://')
          ? path.join(projectPath, modelPath.replace('res://', ''))
          : path.resolve(modelPath);

        const importFile = resolved + '.import';
        if (!fs.existsSync(importFile)) {
          return { content: [{ type: 'text', text: `Import file not found. Open the model in Godot first to generate .import file.` }], isError: true };
        }

        let content = fs.readFileSync(importFile, 'utf-8');
        for (const [k, v] of Object.entries(settings)) {
          if (content.includes(`${k}=`)) {
            content = content.replace(new RegExp(`^${k}=.+$`, 'm'), `${k}=${v}`);
          } else {
            content += `\n${k}=${v}`;
          }
        }
        fs.writeFileSync(importFile, content, 'utf-8');

        return { content: [{ type: 'text', text: `Updated import settings for ${modelPath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'res_manage_theme',
        description: 'Create or read a Theme resource file.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Theme file path (.tres)' },
            action: { type: 'string', description: 'Action: create, read', default: 'read' },
          },
          required: ['path'],
        },
      },
      handler: async (args) => {
        const filePath = requireString(args, 'path');
        const action = (args.action as string) || 'read';

        const resolved = filePath.startsWith('res://')
          ? path.join(projectPath, filePath.replace('res://', ''))
          : path.resolve(filePath);

        if (action === 'create') {
          const content = `[gd_resource type="Theme" format=3]\n\n[resource]\n`;
          fs.writeFileSync(resolved, content, 'utf-8');
          return { content: [{ type: 'text', text: `Created theme: ${filePath}` }] };
        }

        if (!fs.existsSync(resolved)) {
          return { content: [{ type: 'text', text: `Theme not found: ${filePath}` }], isError: true };
        }
        const content = fs.readFileSync(resolved, 'utf-8');
        return { content: [{ type: 'text', text: content }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'res_create_font',
        description: 'Create a FontFile or LabelSettings resource referencing a font.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Resource file path (.tres)' },
            font_path: { type: 'string', description: 'Font file path (.ttf/.otf)' },
            size: { type: 'number', description: 'Font size', default: 16 },
          },
          required: ['path'],
        },
      },
      handler: async (args) => {
        const filePath = requireString(args, 'path');
        const fontPath = optionalString(args, 'font_path');
        const size = (args.size as number) || 16;

        const resolved = filePath.startsWith('res://')
          ? path.join(projectPath, filePath.replace('res://', ''))
          : path.resolve(filePath);

        let content = `[gd_resource type="LabelSettings" format=3]\n\n[resource]`;
        if (fontPath) {
          content = `[gd_resource type="LabelSettings" load_steps=2 format=3]\n\n[ext_resource type="FontFile" path="${fontPath}" id="1"]\n\n[resource]\nfont = ExtResource("1")`;
        }
        content += `\nfont_size = ${size}\n`;

        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created font resource: ${filePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'res_create_curve',
        description: 'Create a Curve or Curve2D resource file.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Resource file path (.tres)' },
            type: { type: 'string', description: 'Curve type: curve, curve2d, curve3d', default: 'curve' },
            points: { type: 'array', description: 'Points array' },
          },
          required: ['path'],
        },
      },
      handler: async (args) => {
        const filePath = requireString(args, 'path');
        const curveType = (args.type as string) || 'curve';
        const points = (args.points as Array<Record<string, unknown>>) || [];

        const resolved = filePath.startsWith('res://')
          ? path.join(projectPath, filePath.replace('res://', ''))
          : path.resolve(filePath);

        const typeName = curveType === 'curve2d' ? 'Curve2D' : curveType === 'curve3d' ? 'Curve3D' : 'Curve';
        let content = `[gd_resource type="${typeName}" format=3]\n\n[resource]`;

        if (curveType === 'curve') {
          content += '\n_data = [';
          for (const pt of points) {
            content += `Vector2(${pt.x || 0}, ${pt.y || 0}), `;
          }
          content += ']\n';
        }

        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created curve: ${filePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'res_create_gradient',
        description: 'Create a Gradient resource file.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Resource file path (.tres)' },
            colors: { type: 'array', description: 'Array of { color, offset } objects' },
          },
          required: ['path'],
        },
      },
      handler: async (args) => {
        const filePath = requireString(args, 'path');
        const colors = (args.colors as Array<{ color?: string; offset?: number }>) || [];

        const resolved = filePath.startsWith('res://')
          ? path.join(projectPath, filePath.replace('res://', ''))
          : path.resolve(filePath);

        let content = `[gd_resource type="Gradient" format=3]\n\n[resource]`;
        if (colors.length > 0) {
          const offsets = colors.map(c => c.offset ?? 0).join(', ');
          const colorVals = colors.map(c => `Color(${c.color || '#ffffff'})`).join(', ');
          content += `\noffsets = PackedFloat32Array(${offsets})\ncolors = PackedColorArray(${colorVals})\n`;
        }

        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created gradient: ${filePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'res_pack',
        description: 'Pack resources into a .pck file using Godot CLI.',
        inputSchema: {
          type: 'object',
          properties: {
            output: { type: 'string', description: 'Output .pck path' },
          },
          required: ['output'],
        },
      },
      handler: async (args) => {
        const outputPath = requireString(args, 'output');
        return { content: [{ type: 'text', text: `PCK export requires running Godot export. Use project export presets instead.` }], isError: true };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'res_list',
        description: 'List all resource files (.tres, .res, .tscn, .gdshader) in the project.',
        inputSchema: {
          type: 'object',
          properties: {
            directory: { type: 'string', description: 'Subdirectory to search' },
          },
        },
      },
      handler: async (args) => {
        const searchDir = (args.directory as string)
          ? path.join(projectPath, (args.directory as string).replace('res://', ''))
          : projectPath;

        const resources = listFiles(searchDir, /\.(tres|res|tscn|gdshader)$/).map(f =>
          normalizeResPath(path.relative(projectPath, f))
        );

        return { content: [{ type: 'text', text: `Found ${resources.length} resources:\n${resources.join('\n')}` }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'export_mesh_library',
        description: 'Export a 3D scene as a MeshLibrary resource for GridMap.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Path to the scene file (.tscn, relative or res://)' },
            output_path: { type: 'string', description: 'Output path for the MeshLibrary (.res or .tres)' },
            mesh_item_names: { type: 'array', description: 'Optional: specific mesh item names to include (defaults to all)' },
          },
          required: ['scene_path', 'output_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const outputPath = requireString(args, 'output_path');
        const meshItemNames = (args.mesh_item_names as string[]) || [];

        const headless = server.getHeadless();
        const resp = await headless.send({
          id: `${Date.now()}`,
          method: 'export_mesh_library',
          params: {
            scene_path: scenePath,
            output_path: outputPath,
            mesh_item_names: meshItemNames,
          },
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

function formatResValue(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `PackedStringArray(${value.map(v => `"${v}"`).join(', ')})`;
  return String(value);
}

function getShaderTemplate(type: string): string {
  const templates: Record<string, string> = {
    spatial: `void fragment() {\n    ALBEDO = vec3(0.8, 0.3, 0.3);\n}\n`,
    canvas_item: `void fragment() {\n    COLOR = vec4(1.0, 0.5, 0.5, 1.0);\n}\n`,
    particles: `void process() {\n    // Particle processing\n}\n`,
    sky: `void sky() {\n    COLOR = vec3(0.2, 0.4, 0.8);\n}\n`,
    fog: `void fog() {\n    DENSITY = 0.1;\n}\n`,
  };
  return templates[type] || templates.spatial;
}

function generateUid(): string {
  return Array.from({ length: 13 }, () =>
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)]
  ).join('');
}
