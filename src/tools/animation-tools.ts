/**
 * zzx-godot-mcp — Animation Tools (8 tools)
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ZzxGodotServer } from '../server.js';
import type { ToolRegistration } from '../types/index.js';
import { requireString, optionalString, optionalNumber } from '../utils/validators.js';

export function registerAnimationTools(server: ZzxGodotServer): void {
  const projectPath = server.getConfig().projectPath || process.cwd();

  const tools: ToolRegistration[] = [
    {
      definition: {
        name: 'anim_create_player',
        description: 'Create an AnimationPlayer node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name', default: 'AnimationPlayer' },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = (args.name as string) || 'AnimationPlayer';

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        content = content.trimEnd() + `\n[node name="${name}" type="AnimationPlayer" parent="${parent}"]\n`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created AnimationPlayer "${name}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'anim_add_track',
        description: 'Add an animation track to an Animation resource in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            anim_player: { type: 'string', description: 'AnimationPlayer node path' },
            anim_name: { type: 'string', description: 'Animation name' },
            track_type: { type: 'string', description: 'value, method, or bezier', default: 'value' },
            node_path: { type: 'string', description: 'Target node path for track' },
            property: { type: 'string', description: 'Property to animate' },
            keyframes: { type: 'array', description: 'Array of {time, value, easing}' },
            length: { type: 'number', description: 'Animation length in seconds', default: 1 },
            loop: { type: 'boolean', description: 'Loop animation', default: false },
          },
          required: ['scene_path', 'anim_player', 'anim_name', 'node_path', 'property', 'keyframes'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const animPlayer = requireString(args, 'anim_player');
        const animName = requireString(args, 'anim_name');
        const nodePath = requireString(args, 'node_path');
        const property = requireString(args, 'property');
        const keyframes = args.keyframes as Array<{ time: number; value: unknown; easing?: number }>;
        const length = (args.length as number) || 1;
        const loop = (args.loop as boolean) ?? false;

        return { content: [{ type: 'text', text: `Animation track editing in raw .tscn is complex. Use Godot editor or runtime_eval to add tracks programmatically via AnimationPlayer API.` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'anim_play',
        description: 'Play, pause, or stop an animation (requires TCP/WebSocket).',
        inputSchema: {
          type: 'object',
          properties: {
            anim_player: { type: 'string', description: 'AnimationPlayer node path' },
            anim_name: { type: 'string', description: 'Animation name (omit for stop/pause)' },
            action: { type: 'string', description: 'play, pause, or stop', default: 'play' },
          },
          required: ['anim_player'],
        },
      },
      handler: async (args) => {
        const animPlayer = requireString(args, 'anim_player');
        const animName = optionalString(args, 'anim_name');
        const action = (args.action as string) || 'play';
        const tcp = server.getTcp();

        if (!tcp.isConnected()) {
          return { content: [{ type: 'text', text: 'TCP not connected.' }], isError: true };
        }

        const method = action === 'play' ? 'play' : action === 'pause' ? 'pause' : 'stop';
        const code = animName
          ? `get_node("${animPlayer}").${method}("${animName}")`
          : `get_node("${animPlayer}").${method}()`;

        const resp = await tcp.send({ id: `${Date.now()}`, method: 'game.eval', params: { code } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: `Animation ${action}: ${animName || 'current'}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'anim_seek',
        description: 'Seek to a specific time in an animation (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            anim_player: { type: 'string', description: 'AnimationPlayer node path' },
            time: { type: 'number', description: 'Time in seconds' },
          },
          required: ['anim_player', 'time'],
        },
      },
      handler: async (args) => {
        const animPlayer = requireString(args, 'anim_player');
        const time = (args.time as number) || 0;
        const tcp = server.getTcp();

        if (!tcp.isConnected()) {
          return { content: [{ type: 'text', text: 'TCP not connected.' }], isError: true };
        }

        const resp = await tcp.send({ id: `${Date.now()}`, method: 'game.eval', params: { code: `get_node("${animPlayer}").seek(${time})` } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: `Seeked to ${time}s` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'anim_create_tween',
        description: 'Create a Tween animation via GDScript code generation.',
        inputSchema: {
          type: 'object',
          properties: {
            node_path: { type: 'string', description: 'Target node path' },
            property: { type: 'string', description: 'Property to tween' },
            to_value: { description: 'Target value' },
            duration: { type: 'number', description: 'Duration in seconds', default: 1 },
            easing: { type: 'string', description: 'Easing type: linear, ease_in, ease_out, ease_in_out, elastic, bounce', default: 'ease_out' },
            trans: { type: 'string', description: 'Transition type', default: 'quad' },
          },
          required: ['node_path', 'property', 'to_value'],
        },
      },
      handler: async (args) => {
        const nodePath = requireString(args, 'node_path');
        const property = requireString(args, 'property');
        const toValue = args.to_value;
        const duration = (args.duration as number) || 1;
        const easing = (args.easing as string) || 'ease_out';
        const trans = (args.trans as string) || 'quad';

        const easingMap: Record<string, string> = {
          linear: 'Tween.EASE_IN_OUT',
          ease_in: 'Tween.EASE_IN',
          ease_out: 'Tween.EASE_OUT',
          ease_in_out: 'Tween.EASE_IN_OUT',
          elastic: 'Tween.EASE_OUT',
          bounce: 'Tween.EASE_OUT',
        };
        const transMap: Record<string, string> = {
          linear: 'Tween.TRANS_LINEAR',
          quad: 'Tween.TRANS_QUAD',
          cubic: 'Tween.TRANS_CUBIC',
          elastic: 'Tween.TRANS_ELASTIC',
          bounce: 'Tween.TRANS_BOUNCE',
        };

        const code = `var tween = create_tween()
tween.tween_property(get_node("${nodePath}"), "${property}", ${JSON.stringify(toValue)}, ${duration}).set_ease(${easingMap[easing] || 'Tween.EASE_OUT'}).set_trans(${transMap[trans] || 'Tween.TRANS_QUAD'})`;

        return { content: [{ type: 'text', text: `Tween code generated:\n\n${code}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'anim_animation_tree',
        description: 'Control an AnimationTree state machine (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            tree_path: { type: 'string', description: 'AnimationTree node path' },
            state: { type: 'string', description: 'State to travel to' },
            parameter: { type: 'string', description: 'Parameter to set' },
            value: { description: 'Parameter value' },
          },
          required: ['tree_path'],
        },
      },
      handler: async (args) => {
        const treePath = requireString(args, 'tree_path');
        const state = optionalString(args, 'state');
        const parameter = optionalString(args, 'parameter');
        const value = args.value;
        const tcp = server.getTcp();

        if (!tcp.isConnected()) {
          return { content: [{ type: 'text', text: 'TCP not connected.' }], isError: true };
        }

        let code = '';
        if (state) code = `get_node("${treePath}").get("parameters/playback").travel("${state}")`;
        else if (parameter) code = `get_node("${treePath}").set("parameters/${parameter}", ${JSON.stringify(value)})`;
        else return { content: [{ type: 'text', text: 'Specify state or parameter.' }], isError: true };

        const resp = await tcp.send({ id: `${Date.now()}`, method: 'game.eval', params: { code } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: `AnimationTree updated.` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'anim_blend_space',
        description: 'Configure a BlendSpace1D/2D parameter (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            tree_path: { type: 'string', description: 'AnimationTree node path' },
            blendspace: { type: 'string', description: 'BlendSpace node name' },
            x: { type: 'number', description: 'Blend x value' },
            y: { type: 'number', description: 'Blend y value (for 2D)' },
          },
          required: ['tree_path', 'blendspace', 'x'],
        },
      },
      handler: async (args) => {
        const treePath = requireString(args, 'tree_path');
        const blendspace = requireString(args, 'blendspace');
        const x = (args.x as number) || 0;
        const y = args.y as number | undefined;
        const tcp = server.getTcp();

        if (!tcp.isConnected()) {
          return { content: [{ type: 'text', text: 'TCP not connected.' }], isError: true };
        }

        const param = y !== undefined ? `blend_position` : `blend_position`;
        const code = y !== undefined
          ? `get_node("${treePath}").set("parameters/${blendspace}/${param}", Vector2(${x}, ${y}))`
          : `get_node("${treePath}").set("parameters/${blendspace}/${param}", ${x})`;

        const resp = await tcp.send({ id: `${Date.now()}`, method: 'game.eval', params: { code } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: `BlendSpace updated: ${x}${y !== undefined ? `, ${y}` : ''}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'anim_skeleton_ik',
        description: 'Control a SkeletonIK3D node (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            ik_path: { type: 'string', description: 'SkeletonIK3D node path' },
            target_position: { type: 'object', description: '{x, y, z} target position' },
            start: { type: 'boolean', description: 'Start IK', default: true },
          },
          required: ['ik_path'],
        },
      },
      handler: async (args) => {
        const ikPath = requireString(args, 'ik_path');
        const targetPos = args.target_position as { x?: number; y?: number; z?: number } | undefined;
        const start = (args.start as boolean) ?? true;
        const tcp = server.getTcp();

        if (!tcp.isConnected()) {
          return { content: [{ type: 'text', text: 'TCP not connected.' }], isError: true };
        }

        let code = '';
        if (targetPos) {
          code = `get_node("${ikPath}").target = Vector3(${targetPos.x || 0}, ${targetPos.y || 0}, ${targetPos.z || 0})\n`;
        }
        code += start ? `get_node("${ikPath}").start()` : `get_node("${ikPath}").stop()`;

        const resp = await tcp.send({ id: `${Date.now()}`, method: 'game.eval', params: { code } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: `SkeletonIK3D ${start ? 'started' : 'stopped'}.` }] };
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
