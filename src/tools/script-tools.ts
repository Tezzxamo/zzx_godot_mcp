/**
 * zzx-godot-mcp — Script Management Tools (10 tools)
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ZzxGodotServer } from '../server.js';
import type { ToolRegistration } from '../types/index.js';
import { requireString, optionalString, optionalNumber } from '../utils/validators.js';
import { isSafePath, listFiles, normalizeResPath } from '../utils/path-utils.js';

export function registerScriptTools(server: ZzxGodotServer): void {
  const projectPath = server.getConfig().projectPath || process.cwd();

  const tools: ToolRegistration[] = [
    {
      definition: {
        name: 'script_create',
        description: 'Create a new GDScript file with optional template.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Script file path (res:// or absolute)' },
            template: { type: 'string', description: 'Template type: empty, node2d, node3d, character2d, character3d, control' },
            class_name: { type: 'string', description: 'Optional class_name' },
            extends_class: { type: 'string', description: 'Class to extend (auto-detected from template)' },
          },
          required: ['path'],
        },
      },
      handler: async (args) => {
        const filePath = requireString(args, 'path');
        const template = (args.template as string) || 'empty';
        const className = (args.class_name as string) || '';
        const extendsClass = (args.extends_class as string) || getTemplateExtends(template);

        const resolved = filePath.startsWith('res://')
          ? path.join(projectPath, filePath.replace('res://', ''))
          : path.resolve(filePath);

        if (!isSafePath(resolved, projectPath)) {
          return { content: [{ type: 'text', text: 'Error: Path is outside the project directory.' }], isError: true };
        }

        const dir = path.dirname(resolved);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        let content = '';
        if (className) content += `class_name ${className}\n`;
        if (extendsClass) content += `extends ${extendsClass}\n\n`;
        content += getTemplateBody(template, className || extendsClass);

        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Created script: ${filePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'script_read',
        description: 'Read a GDScript file.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Script file path' },
            offset: { type: 'number', description: 'Line offset (0-based)' },
            limit: { type: 'number', description: 'Max lines' },
          },
          required: ['path'],
        },
      },
      handler: async (args) => {
        const filePath = requireString(args, 'path');
        const offset = (args.offset as number) ?? 0;
        const limit = (args.limit as number) ?? Infinity;

        const resolved = filePath.startsWith('res://')
          ? path.join(projectPath, filePath.replace('res://', ''))
          : path.resolve(filePath);

        if (!fs.existsSync(resolved)) {
          return { content: [{ type: 'text', text: `Error: Script not found: ${filePath}` }], isError: true };
        }

        const content = fs.readFileSync(resolved, 'utf-8');
        const lines = content.split('\n');
        const sliced = lines.slice(offset, offset + limit);

        return {
          content: [{ type: 'text', text: `Lines ${offset + 1}-${Math.min(offset + limit, lines.length)} of ${lines.length}:\n\n${sliced.join('\n')}` }],
        };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'script_edit',
        description: 'Edit a GDScript file. Supports full replace or range replace.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Script file path' },
            content: { type: 'string', description: 'New content (full replace if no range specified)' },
            start_line: { type: 'number', description: 'Start line for range replace (1-based, inclusive)' },
            end_line: { type: 'number', description: 'End line for range replace (1-based, inclusive)' },
          },
          required: ['path', 'content'],
        },
      },
      handler: async (args) => {
        const filePath = requireString(args, 'path');
        const newContent = requireString(args, 'content');
        const startLine = (args.start_line as number) || 0;
        const endLine = (args.end_line as number) || 0;

        const resolved = filePath.startsWith('res://')
          ? path.join(projectPath, filePath.replace('res://', ''))
          : path.resolve(filePath);

        if (!fs.existsSync(resolved)) {
          return { content: [{ type: 'text', text: `Error: Script not found: ${filePath}` }], isError: true };
        }

        let content = fs.readFileSync(resolved, 'utf-8');

        if (startLine > 0 && endLine >= startLine) {
          const lines = content.split('\n');
          const before = lines.slice(0, startLine - 1);
          const after = lines.slice(endLine);
          content = [...before, newContent, ...after].join('\n');
        } else {
          content = newContent;
        }

        fs.writeFileSync(resolved, content, 'utf-8');
        return { content: [{ type: 'text', text: `Edited ${filePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'script_attach',
        description: 'Attach a script to a node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            node_path: { type: 'string', description: 'Node path in scene' },
            script_path: { type: 'string', description: 'Script path (res://)' },
          },
          required: ['scene_path', 'node_path', 'script_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const nodePath = requireString(args, 'node_path');
        const scriptPath = requireString(args, 'script_path');

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const extResourceId = ensureExtResource(content, scriptPath, 'Script');
        content = content.replace(/\[gd_scene/, `[gd_scene`); // ensure header

        const nodeName = nodePath.split('/').pop() || nodePath;
        const parentPath = nodePath.includes('/') ? nodePath.substring(0, nodePath.lastIndexOf('/')) : '.';

        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(`name="${nodeName}"`) && lines[i].includes(`parent="${parentPath}"`)) {
            // Check if next line has script = ExtResource
            if (i + 1 < lines.length && lines[i + 1].includes('script = ExtResource')) {
              lines[i + 1] = `script = ExtResource("${extResourceId}")`;
            } else {
              lines.splice(i + 1, 0, `script = ExtResource("${extResourceId}")`);
            }
            break;
          }
        }

        fs.writeFileSync(resolved, lines.join('\n'), 'utf-8');
        return { content: [{ type: 'text', text: `Attached ${scriptPath} to "${nodePath}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'script_detach',
        description: 'Detach a script from a node in a scene file.',
        inputSchema: {
          type: 'object',
          properties: {
            scene_path: { type: 'string', description: 'Scene file path' },
            node_path: { type: 'string', description: 'Node path in scene' },
          },
          required: ['scene_path', 'node_path'],
        },
      },
      handler: async (args) => {
        const scenePath = requireString(args, 'scene_path');
        const nodePath = requireString(args, 'node_path');

        const resolved = scenePath.startsWith('res://')
          ? path.join(projectPath, scenePath.replace('res://', ''))
          : path.resolve(scenePath);

        let content = fs.readFileSync(resolved, 'utf-8');
        const nodeName = nodePath.split('/').pop() || nodePath;
        const parentPath = nodePath.includes('/') ? nodePath.substring(0, nodePath.lastIndexOf('/')) : '.';

        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(`name="${nodeName}"`) && lines[i].includes(`parent="${parentPath}"`)) {
            if (i + 1 < lines.length && lines[i + 1].includes('script = ExtResource')) {
              lines.splice(i + 1, 1);
            }
            break;
          }
        }

        fs.writeFileSync(resolved, lines.join('\n'), 'utf-8');
        return { content: [{ type: 'text', text: `Detached script from "${nodePath}" in ${scenePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'script_list',
        description: 'List all .gd script files in the project.',
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

        const scripts = listFiles(searchDir, /\.gd$/).map(f =>
          normalizeResPath(path.relative(projectPath, f))
        );

        return { content: [{ type: 'text', text: `Found ${scripts.length} scripts:\n${scripts.join('\n')}` }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'script_find_references',
        description: 'Find all references to a script path across the project.',
        inputSchema: {
          type: 'object',
          properties: {
            script_path: { type: 'string', description: 'Script path to search for' },
          },
          required: ['script_path'],
        },
      },
      handler: async (args) => {
        const scriptPath = requireString(args, 'script_path');
        const files = listFiles(projectPath);
        const references: Array<{ file: string; line: string; lineNumber: number }> = [];

        for (const file of files) {
          if (!file.endsWith('.tscn') && !file.endsWith('.gd') && !file.endsWith('.tres')) continue;
          const content = fs.readFileSync(file, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(scriptPath)) {
              references.push({
                file: normalizeResPath(path.relative(projectPath, file)),
                line: lines[i].trim(),
                lineNumber: i + 1,
              });
            }
          }
        }

        return { content: [{ type: 'text', text: JSON.stringify(references, null, 2) }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'script_get_open',
        description: 'Get the currently open script in the Godot editor (requires WebSocket).',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async (_args) => {
        const ws = server.getWebSocket();
        if (!ws.isConnected()) {
          return { content: [{ type: 'text', text: 'WebSocket not connected.' }], isError: true };
        }
        const resp = await ws.send({
          id: `${Date.now()}`,
          method: 'editor.get_open_script',
          params: {},
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
        name: 'script_validate',
        description: 'Validate a GDScript file using Godot headless parser.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Script file path' },
          },
          required: ['path'],
        },
      },
      handler: async (args) => {
        const filePath = requireString(args, 'path');
        const resolved = filePath.startsWith('res://')
          ? path.join(projectPath, filePath.replace('res://', ''))
          : path.resolve(filePath);

        if (!fs.existsSync(resolved)) {
          return { content: [{ type: 'text', text: `Error: Script not found: ${filePath}` }], isError: true };
        }

        const headless = server.getHeadless();
        const resp = await headless.send({
          id: `${Date.now()}`,
          method: 'validate_script',
          params: { path: filePath },
        });

        if (resp.error) {
          return { content: [{ type: 'text', text: `Validation failed: ${resp.error.message}` }], isError: true };
        }
        return { content: [{ type: 'text', text: `✅ ${filePath} is valid.` }] };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'script_generate_template',
        description: 'Generate a GDScript template for a common game component.',
        inputSchema: {
          type: 'object',
          properties: {
            template: { type: 'string', description: 'Template: player2d, player3d, enemy, ui_controller, game_manager, state_machine' },
            class_name: { type: 'string', description: 'Optional class_name' },
          },
          required: ['template'],
        },
      },
      handler: async (args) => {
        const template = requireString(args, 'template');
        const className = (args.class_name as string) || '';

        const body = getAdvancedTemplate(template, className);
        return { content: [{ type: 'text', text: body }] };
      },
      readOnly: true,
    },
  ];

  for (const tool of tools) {
    server.registerTool(tool);
  }
}

/* ── Helpers ── */

function getTemplateExtends(template: string): string {
  const map: Record<string, string> = {
    empty: '',
    node2d: 'Node2D',
    node3d: 'Node3D',
    character2d: 'CharacterBody2D',
    character3d: 'CharacterBody3D',
    control: 'Control',
    area2d: 'Area2D',
    area3d: 'Area3D',
    rigid2d: 'RigidBody2D',
    rigid3d: 'RigidBody3D',
    static2d: 'StaticBody2D',
    static3d: 'StaticBody3D',
  };
  return map[template] || 'Node';
}

function getTemplateBody(template: string, classHint: string): string {
  const bodies: Record<string, string> = {
    empty: '',
    node2d: `func _ready():\n    pass\n\nfunc _process(delta: float) -> void:\n    pass\n`,
    node3d: `func _ready():\n    pass\n\nfunc _process(delta: float) -> void:\n    pass\n`,
    character2d: `@export var speed: float = 300.0\n@export var jump_velocity: float = -400.0\n\nvar gravity: float = ProjectSettings.get_setting("physics/2d/default_gravity")\n\nfunc _physics_process(delta: float) -> void:\n    if not is_on_floor():\n        velocity.y += gravity * delta\n\n    var direction := Input.get_axis("ui_left", "ui_right")\n    if direction:\n        velocity.x = direction * speed\n    else:\n        velocity.x = move_toward(velocity.x, 0, speed)\n\n    move_and_slide()\n`,
    character3d: `@export var speed: float = 5.0\n@export var jump_velocity: float = 4.5\n\nvar gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")\n\nfunc _physics_process(delta: float) -> void:\n    if not is_on_floor():\n        velocity.y -= gravity * delta\n\n    var input_dir := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")\n    var direction := (transform.basis * Vector3(input_dir.x, 0, input_dir.y)).normalized()\n    if direction:\n        velocity.x = direction.x * speed\n        velocity.z = direction.z * speed\n    else:\n        velocity.x = move_toward(velocity.x, 0, speed)\n        velocity.z = move_toward(velocity.z, 0, speed)\n\n    move_and_slide()\n`,
    control: `func _ready():\n    pass\n`,
  };
  return bodies[template] || bodies.empty;
}

function getAdvancedTemplate(template: string, className: string): string {
  const nameDecl = className ? `class_name ${className}\n` : '';
  const templates: Record<string, string> = {
    player2d: `${nameDecl}extends CharacterBody2D\n\n@export var speed: float = 300.0\n@export var jump_velocity: float = -400.0\n@export var health: int = 100\n\n@onready var sprite: AnimatedSprite2D = $AnimatedSprite2D\n\nvar gravity: float = ProjectSettings.get_setting("physics/2d/default_gravity")\n\nfunc _ready() -> void:\n    pass\n\nfunc _physics_process(delta: float) -> void:\n    _apply_gravity(delta)\n    _handle_input()\n    _handle_jump()\n    move_and_slide()\n\nfunc _apply_gravity(delta: float) -> void:\n    if not is_on_floor():\n        velocity.y += gravity * delta\n\nfunc _handle_input() -> void:\n    var direction := Input.get_axis("move_left", "move_right")\n    if direction != 0:\n        velocity.x = direction * speed\n        sprite.flip_h = direction < 0\n    else:\n        velocity.x = move_toward(velocity.x, 0, speed)\n\nfunc _handle_jump() -> void:\n    if Input.is_action_just_pressed("jump") and is_on_floor():\n        velocity.y = jump_velocity\n\nfunc take_damage(amount: int) -> void:\n    health -= amount\n    if health <= 0:\n        die()\n\nfunc die() -> void:\n    queue_free()\n`,
    player3d: `${nameDecl}extends CharacterBody3D\n\n@export var speed: float = 5.0\n@export var jump_velocity: float = 4.5\n@export var mouse_sensitivity: float = 0.003\n@export var health: int = 100\n\n@onready var camera: Camera3D = $Camera3D\n\nvar gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")\n\nfunc _ready() -> void:\n    Input.mouse_mode = Input.MOUSE_MODE_CAPTURED\n\nfunc _input(event: InputEvent) -> void:\n    if event is InputEventMouseMotion:\n        rotate_y(-event.relative.x * mouse_sensitivity)\n        camera.rotate_x(-event.relative.y * mouse_sensitivity)\n        camera.rotation.x = clamp(camera.rotation.x, -PI/2, PI/2)\n\nfunc _physics_process(delta: float) -> void:\n    if not is_on_floor():\n        velocity.y -= gravity * delta\n\n    if Input.is_action_just_pressed("jump") and is_on_floor():\n        velocity.y = jump_velocity\n\n    var input_dir := Input.get_vector("move_left", "move_right", "move_forward", "move_back")\n    var direction := (transform.basis * Vector3(input_dir.x, 0, input_dir.y)).normalized()\n    if direction:\n        velocity.x = direction.x * speed\n        velocity.z = direction.z * speed\n    else:\n        velocity.x = move_toward(velocity.x, 0, speed)\n        velocity.z = move_toward(velocity.z, 0, speed)\n\n    move_and_slide()\n`,
    enemy: `${nameDecl}extends CharacterBody2D\n\n@export var speed: float = 100.0\n@export var health: int = 50\n@export var damage: int = 10\n\n@onready var player: Node2D = get_tree().get_first_node_in_group("player")\n\nfunc _physics_process(delta: float) -> void:\n    if player:\n        var direction := global_position.direction_to(player.global_position)\n        velocity = direction * speed\n        move_and_slide()\n\nfunc take_damage(amount: int) -> void:\n    health -= amount\n    if health <= 0:\n        die()\n\nfunc die() -> void:\n    queue_free()\n`,
    ui_controller: `${nameDecl}extends Control\n\n@onready var health_bar: ProgressBar = $HealthBar\n@onready var score_label: Label = $ScoreLabel\n\nvar score: int = 0\n\nfunc _ready() -> void:\n    update_health(100)\n    update_score(0)\n\nfunc update_health(value: int) -> void:\n    health_bar.value = value\n\nfunc update_score(value: int) -> void:\n    score = value\n    score_label.text = "Score: %d" % score\n`,
    game_manager: `${nameDecl}extends Node\n\nsignal score_changed(new_score: int)\nsignal health_changed(new_health: int)\nsignal game_over\n\nvar score: int = 0\nvar high_score: int = 0\nvar player_health: int = 100\n\nfunc _ready() -> void:\n    pass\n\nfunc add_score(points: int) -> void:\n    score += points\n    if score > high_score:\n        high_score = score\n    score_changed.emit(score)\n\nfunc set_health(value: int) -> void:\n    player_health = clamp(value, 0, 100)\n    health_changed.emit(player_health)\n    if player_health <= 0:\n        game_over.emit()\n\nfunc reset_game() -> void:\n    score = 0\n    player_health = 100\n    score_changed.emit(score)\n    health_changed.emit(player_health)\n`,
    state_machine: `${nameDecl}extends Node\n\nsignal state_changed(new_state: StringName)\n\nvar current_state: StringName = \"\"\nvar states: Dictionary = {}\n\nfunc _ready() -> void:\n    for child in get_children():\n        if child is State:\n            states[child.name.to_lower()] = child\n            child.state_machine = self\n\nfunc transition_to(state_name: StringName) -> void:\n    if not states.has(state_name):\n        push_warning("State '%s' not found" % state_name)\n        return\n\n    if current_state:\n        states[current_state].exit()\n\n    current_state = state_name\n    states[current_state].enter()\n    state_changed.emit(current_state)\n\nfunc _process(delta: float) -> void:\n    if current_state:\n        states[current_state].update(delta)\n\nfunc _physics_process(delta: float) -> void:\n    if current_state:\n        states[current_state].physics_update(delta)\n`,
  };
  return templates[template] || `# ${template} template not found`;
}

function ensureExtResource(content: string, path: string, type: string): string {
  const existing = content.match(new RegExp(`\\[ext_resource type="${type}" path="${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" id="([^"]+)"\\]`));
  if (existing) return existing[1];

  const ids = [...content.matchAll(/\[ext_resource[^\]]*id="([^"]+)"\]/g)].map(m => m[1]);
  let nextId = 1;
  while (ids.includes(String(nextId))) nextId++;

  const resourceLine = `[ext_resource type="${type}" path="${path}" id="${nextId}"]`;
  const lines = content.split('\n');
  let insertIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('[gd_scene') || lines[i].startsWith('[ext_resource')) {
      insertIndex = i + 1;
    }
  }
  lines.splice(insertIndex, 0, resourceLine);
  // Re-write content if needed - for now just return the ID
  // The caller should handle inserting the resource line
  return String(nextId);
}
