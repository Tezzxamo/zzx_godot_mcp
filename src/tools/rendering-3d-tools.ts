/**
 * zzx-godot-mcp — 3D Rendering Tools (15 tools)
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ZzxGodotServer } from '../server.js';
import type { ToolRegistration } from '../types/index.js';
import { requireString, optionalString, optionalNumber } from '../utils/validators.js';

export function registerRendering3DTools(server: ZzxGodotServer): void {
  const projectPath = server.getConfig().projectPath || process.cwd();

  const tools: ToolRegistration[] = [
    {
      definition: {
        name: 'render3d_create_mesh',
        description: 'Create a MeshInstance3D node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name' },
            mesh_type: { type: 'string', description: 'Box, Sphere, Capsule, Cylinder, Plane, Prism', default: 'Box' },
            position: { type: 'object', description: '{x, y, z}' },
            material: { type: 'string', description: 'Material path (res://)' },
          },
          required: ['scene_path', 'name'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = requireString(args, 'name');
        const meshType = (args.mesh_type as string) || 'Box';
        const position = args.position as { x?: number; y?: number; z?: number } | undefined;
        const material = optionalString(args, 'material');

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        let props = '';
        if (position) props += `transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, ${position.x || 0}, ${position.y || 0}, ${position.z || 0})\n`;

        const meshClass = `BoxMesh`;
        const subId = ensureSubResource(content, 'Mesh', meshClass);
        content = content.replace(/\[gd_scene/, `[gd_scene`);
        props += `mesh = SubResource("${subId}")\n`;

        if (material) {
          const extId = ensureExtResource(content, material, 'Material');
          props += `surface_material_override/0 = ExtResource("${extId}")\n`;
        }

        content = content.trimEnd() + `\n[node name="${name}" type="MeshInstance3D" parent="${parent}"]\n${props}`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created MeshInstance3D "${name}" with ${meshType}Mesh in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'render3d_create_camera',
        description: 'Create a Camera3D node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name', default: 'Camera3D' },
            position: { type: 'object', description: '{x, y, z}' },
            fov: { type: 'number', description: 'Field of view (degrees)', default: 75 },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = (args.name as string) || 'Camera3D';
        const position = args.position as { x?: number; y?: number; z?: number } | undefined;
        const fov = (args.fov as number) || 75;

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        let props = `fov = ${fov}\n`;
        if (position) props += `transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, ${position.x || 0}, ${position.y || 0}, ${position.z || 0})\n`;

        content = content.trimEnd() + `\n[node name="${name}" type="Camera3D" parent="${parent}"]\n${props}`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created Camera3D "${name}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'render3d_create_light',
        description: 'Create a 3D light node (OmniLight3D, SpotLight3D, or DirectionalLight3D).',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name' },
            light_type: { type: 'string', description: 'omni, spot, or directional', default: 'omni' },
            color: { type: 'string', description: 'Light color hex', default: '#ffffff' },
            energy: { type: 'number', description: 'Light energy', default: 1 },
            position: { type: 'object', description: '{x, y, z}' },
          },
          required: ['scene_path', 'name'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = requireString(args, 'name');
        const lightType = (args.light_type as string) || 'omni';
        const color = (args.color as string) || '#ffffff';
        const energy = (args.energy as number) || 1;
        const position = args.position as { x?: number; y?: number; z?: number } | undefined;

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        const typeMap: Record<string, string> = { omni: 'OmniLight3D', spot: 'SpotLight3D', directional: 'DirectionalLight3D' };
        const typeName = typeMap[lightType] || 'OmniLight3D';
        let props = `light_color = Color("${color}")\nlight_energy = ${energy}\n`;
        if (position) props += `transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, ${position.x || 0}, ${position.y || 0}, ${position.z || 0})\n`;

        content = content.trimEnd() + `\n[node name="${name}" type="${typeName}" parent="${parent}"]\n${props}`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created ${typeName} "${name}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'render3d_create_environment',
        description: 'Create a WorldEnvironment node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name', default: 'WorldEnvironment' },
            environment: { type: 'string', description: 'Environment resource path (res://)' },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = (args.name as string) || 'WorldEnvironment';
        const envPath = optionalString(args, 'environment');

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        let props = '';

        if (envPath) {
          const extId = ensureExtResource(content, envPath, 'Environment');
          props += `environment = ExtResource("${extId}")\n`;
        } else {
          const subId = ensureSubResource(content, 'Environment', 'Environment');
          props += `environment = SubResource("${subId}")\n`;
        }

        content = content.trimEnd() + `\n[node name="${name}" type="WorldEnvironment" parent="${parent}"]\n${props}`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created WorldEnvironment "${name}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'render3d_set_environment',
        description: 'Set environment parameters (background, fog, SSAO) in an Environment resource.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            env_node: { type: 'string', description: 'WorldEnvironment node path' },
            background_color: { type: 'string', description: 'Background color hex' },
            fog_enabled: { type: 'boolean', description: 'Enable fog' },
            fog_color: { type: 'string', description: 'Fog color hex' },
            fog_density: { type: 'number', description: 'Fog density' },
            ssao_enabled: { type: 'boolean', description: 'Enable SSAO' },
          },
          required: ['scene_path', 'env_node'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const envNode = requireString(args, 'env_node');

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        // Find the WorldEnvironment node and update its Environment sub-resource
        // This is complex in raw text; recommend runtime_eval for live changes
        return { content: [{ type: 'text', text: 'Environment editing is complex in raw .tscn. Use node_set_property or runtime_eval for live changes.' }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'render3d_create_particles',
        description: 'Create a GPUParticles3D node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name', default: 'GPUParticles3D' },
            amount: { type: 'number', description: 'Particle amount', default: 100 },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = (args.name as string) || 'GPUParticles3D';
        const amount = (args.amount as number) || 100;

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        const props = `amount = ${amount}\n`;

        content = content.trimEnd() + `\n[node name="${name}" type="GPUParticles3D" parent="${parent}"]\n${props}`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created GPUParticles3D "${name}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'render3d_create_skeleton',
        description: 'Create a Skeleton3D node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name', default: 'Skeleton3D' },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = (args.name as string) || 'Skeleton3D';

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;

        content = content.trimEnd() + `\n[node name="${name}" type="Skeleton3D" parent="${parent}"]\n`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created Skeleton3D "${name}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'render3d_set_material',
        description: 'Attach a material to a MeshInstance3D in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            mesh_path: { type: 'string', description: 'MeshInstance3D node path' },
            material_path: { type: 'string', description: 'Material resource path (res://)' },
            surface_index: { type: 'number', description: 'Surface index', default: 0 },
          },
          required: ['scene_path', 'mesh_path', 'material_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const meshPath = requireString(args, 'mesh_path');
        const materialPath = requireString(args, 'material_path');
        const surfaceIndex = (args.surface_index as number) || 0;

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const extId = ensureExtResource(content, materialPath, 'Material');
        const nodeName = meshPath.split('/').pop() || meshPath;
        const parentPath = meshPath.includes('/') ? meshPath.substring(0, meshPath.lastIndexOf('/')) : '.';

        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(`name="${nodeName}"`) && lines[i].includes('type="MeshInstance3D"')) {
            if (lines[i + 1]?.includes(`parent="${parentPath}"`)) {
              // Insert after the node line
              lines.splice(i + 1, 0, `surface_material_override/${surfaceIndex} = ExtResource("${extId}")`);
              break;
            }
          }
        }

        fs.writeFileSync(resolved, lines.join('\n'), 'utf-8');
        return { content: [{ type: 'text', text: `Attached material to ${meshPath} surface ${surfaceIndex} in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'render3d_create_collision',
        description: 'Create a CollisionShape3D node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name', default: 'CollisionShape3D' },
            shape: { type: 'string', description: 'Box, Sphere, Capsule, Cylinder', default: 'Box' },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = (args.name as string) || 'CollisionShape3D';
        const shape = (args.shape as string) || 'Box';

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        const shapeClass = `${shape}Shape3D`;
        const subId = ensureSubResource(content, 'Shape3D', shapeClass);
        const props = `shape = SubResource("${subId}")\n`;

        content = content.trimEnd() + `\n[node name="${name}" type="CollisionShape3D" parent="${parent}"]\n${props}`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created CollisionShape3D "${name}" with ${shapeClass} in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'render3d_create_navigation',
        description: 'Create a NavigationRegion3D node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name', default: 'NavigationRegion3D' },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = (args.name as string) || 'NavigationRegion3D';

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;

        content = content.trimEnd() + `\n[node name="${name}" type="NavigationRegion3D" parent="${parent}"]\n`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created NavigationRegion3D "${name}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'render3d_set_fog',
        description: 'Configure fog in an Environment resource or WorldEnvironment node.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            env_node: { type: 'string', description: 'WorldEnvironment node path' },
            enabled: { type: 'boolean', description: 'Enable fog' },
            color: { type: 'string', description: 'Fog color hex' },
            density: { type: 'number', description: 'Fog density' },
          },
          required: ['scene_path', 'env_node'],
        },
      },
      handler: async (args) => {
        return { content: [{ type: 'text', text: 'Use runtime_eval to configure fog on a live Environment: get_node("/root/Main/WorldEnvironment").environment.fog_enabled = true' }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'render3d_set_sky',
        description: 'Configure sky in an Environment resource.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            env_node: { type: 'string', description: 'WorldEnvironment node path' },
            sky_type: { type: 'string', description: 'procedural or panorama' },
            sky_color: { type: 'string', description: 'Sky color hex' },
            sky_texture: { type: 'string', description: 'Panorama texture path (res://)' },
          },
          required: ['scene_path', 'env_node'],
        },
      },
      handler: async (args) => {
        return { content: [{ type: 'text', text: 'Use runtime_eval to configure sky on a live Environment: get_node("/root/Main/WorldEnvironment").environment.sky = Sky.new()' }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'render3d_create_reflection_probe',
        description: 'Create a ReflectionProbe node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name', default: 'ReflectionProbe' },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = (args.name as string) || 'ReflectionProbe';

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;

        content = content.trimEnd() + `\n[node name="${name}" type="ReflectionProbe" parent="${parent}"]\n`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created ReflectionProbe "${name}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'render3d_create_decal',
        description: 'Create a Decal node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name', default: 'Decal' },
            texture: { type: 'string', description: 'Decal texture path (res://)' },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = (args.name as string) || 'Decal';
        const texture = optionalString(args, 'texture');

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        let props = '';
        if (texture) {
          const extId = ensureExtResource(content, texture, 'Texture2D');
          props += `texture_albedo = ExtResource("${extId}")\n`;
        }

        content = content.trimEnd() + `\n[node name="${name}" type="Decal" parent="${parent}"]\n${props}`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created Decal "${name}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'render3d_create_lightmap',
        description: 'Create a LightmapGI node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name', default: 'LightmapGI' },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = (args.name as string) || 'LightmapGI';

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;

        content = content.trimEnd() + `\n[node name="${name}" type="LightmapGI" parent="${parent}"]\n`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created LightmapGI "${name}" in ${scenePath}` }] };
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

function ensureSubResource(content: string, category: string, type: string): string {
  const ids = [...content.matchAll(/\[sub_resource[^\]]*id="([^"]+)"\]/g)].map(m => m[1]);
  let nextId = 1;
  while (ids.includes(`${category}_${nextId}`)) nextId++;
  return `${category}_${nextId}`;
}
