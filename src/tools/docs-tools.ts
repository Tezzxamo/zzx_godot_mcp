/**
 * zzx-godot-mcp — Godot Documentation Query Tools (2 tools)
 *
 * Inspired by Nihilantropy/godot-mcp-docs:
 *   - docs_get_tree:    overview of available documentation categories
 *   - docs_get_class:   fetch class reference from Godot online docs
 */

import type { ZzxGodotServer } from '../server.js';
import type { ToolRegistration } from '../types/index.js';
import { requireString } from '../utils/validators.js';

const GODOT_DOCS_BASE = 'https://docs.godotengine.org/en/stable';

const DOCS_TREE = {
  getting_started: [
    'introduction/index',
    'step_by_step/index',
    'first_2d_game/index',
    'first_3d_game/index',
  ],
  tutorials: {
    '2d': ['2d_movement', '2d_sprite_animation', 'tilemap', 'particles_2d'],
    '3d': ['3d_transforms', 'lights_and_shadows', 'global_illumination', 'particles'],
    animation: ['animation', 'animation_tree', 'cutout_animation', '2d_skeletons'],
    assets_pipeline: ['importing_images', 'importing_3d_scenes', 'importing_audio_samples'],
    audio: ['audio_buses', '2d_and_3d_audio', 'sync_with_audio'],
    editor: ['inspector_dock', 'script_editor', 'debugging'],
    exporting: ['exporting_basics', 'exporting_for_pc', 'exporting_for_android', 'exporting_for_ios', 'exporting_for_web'],
    inputs: ['input_examples', 'mouse_and_input_coordinates', 'custom_mouse_cursor'],
    io: ['data_paths', 'saving_games', 'encrypting_save_games'],
    math: ['vector_math', 'interpolation', 'Matrices_and_transforms'],
    networking: ['high_level_multiplayer', 'web_socket'],
    physics: ['kinematic_character_2d', 'ragdoll', 'soft_body', 'collision_shapes_2d', 'collision_shapes_3d'],
    rendering: ['shader_basics', 'standard_material_3d', 'controlling_thousands_of_lights'],
    scripting: ['gdscript/index', 'csharp/index', 'cross_language_scripting'],
    shaders: ['your_first_shader', 'shader_materials', 'visual_shaders'],
    ui: ['size_and_anchors', 'gui_container', 'custom_gui_controls'],
  },
  classes: 'See https://docs.godotengine.org/en/stable/classes/index.html for full class reference.',
};

export function registerDocsTools(server: ZzxGodotServer): void {
  const tools: ToolRegistration[] = [
    {
      definition: {
        name: 'docs_get_tree',
        description: 'Get an overview of available Godot documentation categories and topics.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async (_args) => {
        return {
          content: [
            {
              type: 'text',
              text: `Godot Documentation Overview\n\n${JSON.stringify(DOCS_TREE, null, 2)}\n\nFull class reference: ${GODOT_DOCS_BASE}/classes/index.html`,
            },
          ],
        };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'docs_get_class',
        description: 'Get the URL to a Godot class reference page. Use this to look up specific class documentation.',
        inputSchema: {
          type: 'object',
          properties: {
            class_name: { type: 'string', description: 'Godot class name (e.g. CharacterBody2D, Node3D, AnimationPlayer)' },
          },
          required: ['class_name'],
        },
      },
      handler: async (args) => {
        const className = requireString(args, 'class_name');
        const url = `${GODOT_DOCS_BASE}/classes/class_${className.toLowerCase()}.html`;
        return {
          content: [
            {
              type: 'text',
              text: `Class reference URL for ${className}:\n${url}\n\nOpen this URL in a browser to view the full documentation, or use a web-fetching tool to retrieve its content.`,
            },
          ],
        };
      },
      readOnly: true,
    },
  ];

  server.registerTools(tools);
}
