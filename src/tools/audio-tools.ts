/**
 * zzx-godot-mcp — Audio Tools (6 tools)
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ZzxGodotServer } from '../server.js';
import type { ToolRegistration } from '../types/index.js';
import { requireString, optionalString, optionalNumber, optionalBoolean } from '../utils/validators.js';

export function registerAudioTools(server: ZzxGodotServer): void {
  const projectPath = server.getConfig().projectPath || process.cwd();

  const tools: ToolRegistration[] = [
    {
      definition: {
        name: 'audio_create_player',
        description: 'Create an AudioStreamPlayer node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            parent_path: { type: 'string', description: 'Parent node path', default: '.' },
            name: { type: 'string', description: 'Node name', default: 'AudioStreamPlayer' },
            stream: { type: 'string', description: 'Audio stream path (res://)' },
            autoplay: { type: 'boolean', description: 'Auto-play on ready', default: false },
            dimension: { type: 'string', description: '2d or 3d for spatial audio', default: '' },
          },
          required: ['scene_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const parentPath = (args.parent_path as string) || '.';
        const name = (args.name as string) || 'AudioStreamPlayer';
        const stream = optionalString(args, 'stream');
        const autoplay = (args.autoplay as boolean) ?? false;
        const dimension = (args.dimension as string) || '';

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const parent = parentPath === '.' ? getRootNodeName(content) : parentPath;
        const typeName = dimension === '2d' ? 'AudioStreamPlayer2D' : dimension === '3d' ? 'AudioStreamPlayer3D' : 'AudioStreamPlayer';
        let props = '';
        if (stream) {
          const extId = ensureExtResource(content, stream, 'AudioStream');
          props += `stream = ExtResource("${extId}")\n`;
        }
        if (autoplay) props += 'autoplay = true\n';

        content = content.trimEnd() + `\n[node name="${name}" type="${typeName}" parent="${parent}"]\n${props}`;
        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created ${typeName} "${name}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'audio_play',
        description: 'Play an audio stream (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            player_path: { type: 'string', description: 'AudioStreamPlayer node path' },
          },
          required: ['player_path'],
        },
      },
      handler: async (args) => {
        const playerPath = requireString(args, 'player_path');
        const tcp = server.getTcp();
        if (!tcp.isConnected()) return { content: [{ type: 'text', text: 'TCP not connected.' }], isError: true };
        const resp = await tcp.send({ id: `${Date.now()}`, method: 'game.eval', params: { code: `get_node("${playerPath}").play()` } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: `Playing: ${playerPath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'audio_stop',
        description: 'Stop an audio stream (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            player_path: { type: 'string', description: 'AudioStreamPlayer node path' },
          },
          required: ['player_path'],
        },
      },
      handler: async (args) => {
        const playerPath = requireString(args, 'player_path');
        const tcp = server.getTcp();
        if (!tcp.isConnected()) return { content: [{ type: 'text', text: 'TCP not connected.' }], isError: true };
        const resp = await tcp.send({ id: `${Date.now()}`, method: 'game.eval', params: { code: `get_node("${playerPath}").stop()` } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: `Stopped: ${playerPath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'audio_bus',
        description: 'Get or set audio bus properties (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            bus_name: { type: 'string', description: 'Bus name', default: 'Master' },
            volume_db: { type: 'number', description: 'Volume in dB' },
            mute: { type: 'boolean', description: 'Mute state' },
            solo: { type: 'boolean', description: 'Solo state' },
          },
          required: ['bus_name'],
        },
      },
      handler: async (args) => {
        const busName = requireString(args, 'bus_name');
        const volumeDb = args.volume_db as number | undefined;
        const mute = args.mute as boolean | undefined;
        const solo = args.solo as boolean | undefined;
        const tcp = server.getTcp();

        if (!tcp.isConnected()) return { content: [{ type: 'text', text: 'TCP not connected.' }], isError: true };

        let code = '';
        const idx = `AudioServer.get_bus_index("${busName}")`;
        if (volumeDb !== undefined) code += `AudioServer.set_bus_volume_db(${idx}, ${volumeDb})\n`;
        if (mute !== undefined) code += `AudioServer.set_bus_mute(${idx}, ${mute ? 'true' : 'false'})\n`;
        if (solo !== undefined) code += `AudioServer.set_bus_solo(${idx}, ${solo ? 'true' : 'false'})\n`;

        if (!code) {
          code = `return { "volume_db": AudioServer.get_bus_volume_db(${idx}), "mute": AudioServer.is_bus_mute(${idx}), "solo": AudioServer.is_bus_solo(${idx}) }`;
        }

        const resp = await tcp.send({ id: `${Date.now()}`, method: 'game.eval', params: { code } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(resp.result, null, 2) }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'audio_effect',
        description: 'Add an audio effect to a bus (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            bus_name: { type: 'string', description: 'Bus name', default: 'Master' },
            effect_type: { type: 'string', description: 'Reverb, Delay, EQ, Compressor, Limiter' },
            enable: { type: 'boolean', description: 'Enable effect', default: true },
          },
          required: ['effect_type'],
        },
      },
      handler: async (args) => {
        const busName = (args.bus_name as string) || 'Master';
        const effectType = requireString(args, 'effect_type');
        const enable = (args.enable as boolean) ?? true;
        const tcp = server.getTcp();

        if (!tcp.isConnected()) return { content: [{ type: 'text', text: 'TCP not connected.' }], isError: true };

        const effectMap: Record<string, string> = {
          Reverb: 'AudioEffectReverb',
          Delay: 'AudioEffectDelay',
          EQ: 'AudioEffectEQ',
          Compressor: 'AudioEffectCompressor',
          Limiter: 'AudioEffectLimiter',
        };
        const className = effectMap[effectType] || effectType;

        const code = `var bus = AudioServer.get_bus_index("${busName}")\nvar effect = ${className}.new()\nAudioServer.add_bus_effect(bus, effect)\nAudioServer.set_bus_effect_enabled(bus, AudioServer.get_bus_effect_count(bus) - 1, ${enable ? 'true' : 'false'})`;

        const resp = await tcp.send({ id: `${Date.now()}`, method: 'game.eval', params: { code } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: `Added ${effectType} to ${busName}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'audio_spatial',
        description: 'Configure AudioStreamPlayer3D spatial properties (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            player_path: { type: 'string', description: 'AudioStreamPlayer3D node path' },
            attenuation_model: { type: 'string', description: 'inverse, exponential, logarithmic' },
            max_distance: { type: 'number', description: 'Max hearing distance' },
            unit_size: { type: 'number', description: 'Unit size' },
          },
          required: ['player_path'],
        },
      },
      handler: async (args) => {
        const playerPath = requireString(args, 'player_path');
        const attenuation = optionalString(args, 'attenuation_model');
        const maxDistance = optionalNumber(args, 'max_distance');
        const unitSize = optionalNumber(args, 'unit_size');
        const tcp = server.getTcp();

        if (!tcp.isConnected()) return { content: [{ type: 'text', text: 'TCP not connected.' }], isError: true };

        let code = `var player = get_node("${playerPath}")\n`;
        if (attenuation) {
          const modelMap: Record<string, string> = { inverse: '0', exponential: '1', logarithmic: '2' };
          code += `player.attenuation_model = ${modelMap[attenuation] || '0'}\n`;
        }
        if (maxDistance !== undefined) code += `player.max_distance = ${maxDistance}\n`;
        if (unitSize !== undefined) code += `player.unit_size = ${unitSize}\n`;

        const resp = await tcp.send({ id: `${Date.now()}`, method: 'game.eval', params: { code } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: `Spatial audio configured for ${playerPath}` }] };
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
