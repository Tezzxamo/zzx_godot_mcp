/**
 * zzx-godot-mcp — Physics Tools (8 tools)
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ZzxGodotServer } from '../server.js';
import type { ToolRegistration } from '../types/index.js';
import { requireString, optionalString, optionalNumber } from '../utils/validators.js';

export function registerPhysicsTools(server: ZzxGodotServer): void {
  const projectPath = server.getConfig().projectPath || process.cwd();

  const tools: ToolRegistration[] = [
    {
      definition: {
        name: 'physics_create_body',
        description: 'Create a physics body node (RigidBody, StaticBody, CharacterBody) in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name' },
            body_type: { type: 'string', description: '2d or 3d', default: '2d' },
            physics_type: { type: 'string', description: 'rigid, static, character, area', default: 'rigid' },
            position: { type: 'object', description: '{x, y} or {x, y, z}' },
          },
          required: ['scene_path', 'name'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = requireString(args, 'name');
        const bodyType = (args.body_type as string) || '2d';
        const physicsType = (args.physics_type as string) || 'rigid';
        const position = args.position as Record<string, number> | undefined;

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;

        const typeMap2D: Record<string, string> = { rigid: 'RigidBody2D', static: 'StaticBody2D', character: 'CharacterBody2D', area: 'Area2D' };
        const typeMap3D: Record<string, string> = { rigid: 'RigidBody3D', static: 'StaticBody3D', character: 'CharacterBody3D', area: 'Area3D' };
        const typeName = bodyType === '3d' ? typeMap3D[physicsType] || 'RigidBody3D' : typeMap2D[physicsType] || 'RigidBody2D';

        let props = '';
        if (position) {
          if (bodyType === '3d') {
            props += `transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, ${position.x || 0}, ${position.y || 0}, ${position.z || 0})\n`;
          } else {
            props += `position = Vector2(${position.x || 0}, ${position.y || 0})\n`;
          }
        }

        content = content.trimEnd() + `\n[node name="${name}" type="${typeName}" parent="${parent}"]\n${props}`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created ${typeName} "${name}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'physics_add_shape',
        description: 'Add a collision shape to a physics body in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            body_path: { type: 'string', description: 'Physics body node path' },
            shape: { type: 'string', description: 'Box, Sphere, Capsule, Cylinder, ConvexPolygon, ConcavePolygon', default: 'Box' },
            size: { type: 'object', description: '{x, y} or {x, y, z}' },
            name: { type: 'string', description: 'Shape node name', default: 'CollisionShape' },
          },
          required: ['scene_path', 'body_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const bodyPath = requireString(args, 'body_path');
        const shape = (args.shape as string) || 'Box';
        const size = args.size as Record<string, number> | undefined;
        const shapeName = (args.name as string) || 'CollisionShape';

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const bodyName = bodyPath.split('/').pop() || bodyPath;
        const is3D = content.includes('Body3D') || shape.includes('3D');
        const shapeClass = is3D ? `${shape}Shape3D` : `${shape}Shape2D`;
        const shapeType = is3D ? 'CollisionShape3D' : 'CollisionShape2D';
        const subId = ensureSubResource(content, 'Shape', shapeClass);

        let props = `shape = SubResource("${subId}")\n`;
        content = content.trimEnd() + `\n[node name="${shapeName}" type="${shapeType}" parent="${bodyPath}"]\n${props}`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Added ${shapeType} to ${bodyPath} in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'physics_configure_material',
        description: 'Create or modify a PhysicsMaterial resource.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Resource path (.tres)' },
            friction: { type: 'number', description: 'Friction value', default: 1 },
            bounce: { type: 'number', description: 'Bounciness', default: 0 },
            absorbent: { type: 'boolean', description: 'Absorbent', default: false },
          },
          required: ['path'],
        },
      },
      handler: async (args) => {
        const filePath = requireString(args, 'path');
        const friction = (args.friction as number) ?? 1;
        const bounce = (args.bounce as number) ?? 0;
        const absorbent = (args.absorbent as boolean) ?? false;

        const resolved = filePath.startsWith('res://')
          ? path.join(projectPath, filePath.replace('res://', ''))
          : path.resolve(filePath);

        const content = `[gd_resource type="PhysicsMaterial" format=3]\n\n[resource]\nfriction = ${friction}\nbounce = ${bounce}\nabsorbent = ${absorbent ? 'true' : 'false'}\n`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created PhysicsMaterial: ${filePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'physics_set_gravity',
        description: 'Set gravity in project.godot.',
        inputSchema: {
          type: 'object',
          properties: {
            gravity: { type: 'number', description: 'Gravity value' },
            dimension: { type: 'string', description: '2d or 3d', default: '2d' },
          },
          required: ['gravity'],
        },
      },
      handler: async (args) => {
        const gravity = (args.gravity as number) || 980;
        const dimension = (args.dimension as string) || '2d';
        const projectFile = path.join(projectPath, 'project.godot');

        let content = fs.readFileSync(projectFile, 'utf-8');
        const key = dimension === '3d' ? '3d/default_gravity' : '2d/default_gravity';
        if (content.includes(key)) {
          content = content.replace(new RegExp(`${key}=.+`, 'm'), `${key}=${gravity}`);
        } else {
          if (!content.includes('[physics]')) content += '\n[physics]\n';
          content += `${key}=${gravity}\n`;
        }
        fs.writeFileSync(projectFile, content, 'utf-8');
        return { content: [{ type: 'text', text: `Set ${dimension} gravity to ${gravity}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'physics_raycast',
        description: 'Cast a ray in the running game (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            from: { type: 'object', description: '{x, y} or {x, y, z} origin' },
            to: { type: 'object', description: '{x, y} or {x, y, z} target' },
            collision_mask: { type: 'number', description: 'Collision mask', default: 1 },
          },
          required: ['from', 'to'],
        },
      },
      handler: async (args) => {
        const from = args.from as Record<string, number>;
        const to = args.to as Record<string, number>;
        const mask = (args.collision_mask as number) || 1;
        const tcp = server.getTcp();

        if (!tcp.isConnected()) {
          return { content: [{ type: 'text', text: 'TCP not connected.' }], isError: true };
        }

        const is3D = from.z !== undefined;
        const code = is3D
          ? `var space = get_world_3d().direct_space_state\nvar query = PhysicsRayQueryParameters3D.new()\nquery.from = Vector3(${from.x}, ${from.y}, ${from.z})\nquery.to = Vector3(${to.x}, ${to.y}, ${to.z})\nquery.collision_mask = ${mask}\nspace.intersect_ray(query)`
          : `var space = get_world_2d().direct_space_state\nvar query = PhysicsRayQueryParameters2D.new()\nquery.from = Vector2(${from.x}, ${from.y})\nquery.to = Vector2(${to.x}, ${to.y})\nquery.collision_mask = ${mask}\nspace.intersect_ray(query)`;

        const resp = await tcp.send({ id: `${Date.now()}`, method: 'game.eval', params: { code } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(resp.result, null, 2) }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'physics_shape_cast',
        description: 'Cast a shape in the running game (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            shape: { type: 'string', description: 'Shape type' },
            position: { type: 'object', description: '{x, y} or {x, y, z}' },
            motion: { type: 'object', description: 'Cast motion' },
            collision_mask: { type: 'number', description: 'Collision mask', default: 1 },
          },
          required: ['shape', 'position', 'motion'],
        },
      },
      handler: async (args) => {
        return { content: [{ type: 'text', text: 'Shape casting is best done via runtime_eval with a custom GDScript snippet using PhysicsShapeQueryParameters.' }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'physics_get_collision',
        description: 'Get collision information from a body in the running game (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            body_path: { type: 'string', description: 'Physics body node path' },
          },
          required: ['body_path'],
        },
      },
      handler: async (args) => {
        const bodyPath = requireString(args, 'body_path');
        const tcp = server.getTcp();

        if (!tcp.isConnected()) {
          return { content: [{ type: 'text', text: 'TCP not connected.' }], isError: true };
        }

        const code = `var body = get_node("${bodyPath}")\nreturn { "position": body.position, "velocity": body.velocity, "collision_count": body.get_slide_collision_count() if body.has_method("get_slide_collision_count") else 0 }`;
        const resp = await tcp.send({ id: `${Date.now()}`, method: 'game.eval', params: { code } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(resp.result, null, 2) }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'physics_create_joint',
        description: 'Create a physics joint in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Joint node name' },
            joint_type: { type: 'string', description: 'pin, hinge, slider, spring', default: 'pin' },
            body_a: { type: 'string', description: 'First body node path' },
            body_b: { type: 'string', description: 'Second body node path' },
            dimension: { type: 'string', description: '2d or 3d', default: '2d' },
          },
          required: ['scene_path', 'name', 'body_a', 'body_b'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = requireString(args, 'name');
        const jointType = (args.joint_type as string) || 'pin';
        const bodyA = requireString(args, 'body_a');
        const bodyB = requireString(args, 'body_b');
        const dimension = (args.dimension as string) || '2d';

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        const is3D = dimension === '3d';
        const typeMap: Record<string, string> = {
          pin: is3D ? 'PinJoint3D' : 'PinJoint2D',
          hinge: is3D ? 'HingeJoint3D' : 'HingeJoint2D',
          slider: is3D ? 'SliderJoint3D' : 'SliderJoint2D',
          spring: is3D ? 'Generic6DOFJoint3D' : 'DampedSpringJoint2D',
        };
        const typeName = typeMap[jointType] || typeMap.pin;
        const props = `node_a = NodePath("${bodyA}")\nnode_b = NodePath("${bodyB}")\n`;

        content = content.trimEnd() + `\n[node name="${name}" type="${typeName}" parent="${parent}"]\n${props}`;
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

function ensureSubResource(content: string, category: string, type: string): string {
  const ids = [...content.matchAll(/\[sub_resource[^\]]*id="([^"]+)"\]/g)].map(m => m[1]);
  let nextId = 1;
  while (ids.includes(`${category}_${nextId}`)) nextId++;
  return `${category}_${nextId}`;
}
