/**
 * zzx-godot-mcp — Input Simulation Tools (6 tools)
 */

import type { ZzxGodotServer } from '../server.js';
import type { ToolRegistration } from '../types/index.js';
import { requireString, optionalString, optionalNumber } from '../utils/validators.js';

export function registerInputTools(server: ZzxGodotServer): void {
  const tools: ToolRegistration[] = [
    {
      definition: {
        name: 'input_synthesize',
        description: 'Synthesize any InputEvent in the running game (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            event_type: { type: 'string', description: 'key, mouse_button, mouse_motion, joypad_button, screen_touch' },
            params: { type: 'object', description: 'Event-specific parameters' },
          },
          required: ['event_type', 'params'],
        },
      },
      handler: async (args) => {
        const eventType = requireString(args, 'event_type');
        const params = args.params as Record<string, unknown>;
        const tcp = server.getTcp();
        if (!tcp.isConnected()) return { content: [{ type: 'text', text: 'TCP not connected.' }], isError: true };

        let code = '';
        switch (eventType) {
          case 'key': {
            const keycode = params.keycode as number;
            const pressed = (params.pressed as boolean) ?? true;
            code = `var evt = InputEventKey.new()\nevt.keycode = ${keycode}\nevt.pressed = ${pressed ? 'true' : 'false'}\nInput.parse_input_event(evt)`;
            break;
          }
          case 'mouse_button': {
            const button = (params.button as number) || 1;
            const pressed = (params.pressed as boolean) ?? true;
            const x = (params.x as number) || 0;
            const y = (params.y as number) || 0;
            code = `var evt = InputEventMouseButton.new()\nevt.button_index = ${button}\nevt.pressed = ${pressed ? 'true' : 'false'}\nevt.position = Vector2(${x}, ${y})\nInput.parse_input_event(evt)`;
            break;
          }
          case 'mouse_motion': {
            const x = (params.x as number) || 0;
            const y = (params.y as number) || 0;
            const relX = (params.relative_x as number) || 0;
            const relY = (params.relative_y as number) || 0;
            code = `var evt = InputEventMouseMotion.new()\nevt.position = Vector2(${x}, ${y})\nevt.relative = Vector2(${relX}, ${relY})\nInput.parse_input_event(evt)`;
            break;
          }
          case 'joypad_button': {
            const button = (params.button as number) || 0;
            const pressed = (params.pressed as boolean) ?? true;
            code = `var evt = InputEventJoypadButton.new()\nevt.button_index = ${button}\nevt.pressed = ${pressed ? 'true' : 'false'}\nInput.parse_input_event(evt)`;
            break;
          }
          case 'screen_touch': {
            const idx = (params.index as number) || 0;
            const pressed = (params.pressed as boolean) ?? true;
            const x = (params.x as number) || 0;
            const y = (params.y as number) || 0;
            code = `var evt = InputEventScreenTouch.new()\nevt.index = ${idx}\nevt.pressed = ${pressed ? 'true' : 'false'}\nevt.position = Vector2(${x}, ${y})\nInput.parse_input_event(evt)`;
            break;
          }
          default:
            return { content: [{ type: 'text', text: `Unknown event type: ${eventType}` }], isError: true };
        }

        const resp = await tcp.send({ id: `${Date.now()}`, method: 'game.eval', params: { code } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: `Synthesized ${eventType} event.` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'input_key_press',
        description: 'Simulate a key press in the running game (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            keycode: { type: 'number', description: 'Keycode (e.g. 65 for A, 32 for Space)' },
            action: { type: 'string', description: 'press, release, or tap', default: 'press' },
          },
          required: ['keycode'],
        },
      },
      handler: async (args) => {
        const keycode = (args.keycode as number) || 0;
        const action = (args.action as string) || 'press';
        const tcp = server.getTcp();
        if (!tcp.isConnected()) return { content: [{ type: 'text', text: 'TCP not connected.' }], isError: true };

        let code = '';
        if (action === 'tap') {
          code = `var evt = InputEventKey.new()\nevt.keycode = ${keycode}\nevt.pressed = true\nInput.parse_input_event(evt)\nevt = InputEventKey.new()\nevt.keycode = ${keycode}\nevt.pressed = false\nInput.parse_input_event(evt)`;
        } else {
          code = `var evt = InputEventKey.new()\nevt.keycode = ${keycode}\nevt.pressed = ${action === 'press' ? 'true' : 'false'}\nInput.parse_input_event(evt)`;
        }

        const resp = await tcp.send({ id: `${Date.now()}`, method: 'game.eval', params: { code } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: `Key ${action}: ${keycode}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'input_mouse_click',
        description: 'Simulate a mouse click in the running game (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X position' },
            y: { type: 'number', description: 'Y position' },
            button: { type: 'number', description: '1=left, 2=right, 3=middle', default: 1 },
            double_click: { type: 'boolean', description: 'Double click', default: false },
          },
          required: ['x', 'y'],
        },
      },
      handler: async (args) => {
        const x = (args.x as number) || 0;
        const y = (args.y as number) || 0;
        const button = (args.button as number) || 1;
        const doubleClick = (args.double_click as boolean) ?? false;
        const tcp = server.getTcp();
        if (!tcp.isConnected()) return { content: [{ type: 'text', text: 'TCP not connected.' }], isError: true };

        const code = `var evt = InputEventMouseButton.new()\nevt.button_index = ${button}\nevt.pressed = true\nevt.position = Vector2(${x}, ${y})\nevt.double_click = ${doubleClick ? 'true' : 'false'}\nInput.parse_input_event(evt)\nevt = InputEventMouseButton.new()\nevt.button_index = ${button}\nevt.pressed = false\nevt.position = Vector2(${x}, ${y})\nInput.parse_input_event(evt)`;

        const resp = await tcp.send({ id: `${Date.now()}`, method: 'game.eval', params: { code } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: `Mouse clicked at (${x}, ${y}) button ${button}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'input_mouse_move',
        description: 'Simulate mouse movement in the running game (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X position' },
            y: { type: 'number', description: 'Y position' },
            relative_x: { type: 'number', description: 'Relative X' },
            relative_y: { type: 'number', description: 'Relative Y' },
          },
          required: ['x', 'y'],
        },
      },
      handler: async (args) => {
        const x = (args.x as number) || 0;
        const y = (args.y as number) || 0;
        const relX = (args.relative_x as number) || 0;
        const relY = (args.relative_y as number) || 0;
        const tcp = server.getTcp();
        if (!tcp.isConnected()) return { content: [{ type: 'text', text: 'TCP not connected.' }], isError: true };

        const code = `var evt = InputEventMouseMotion.new()\nevt.position = Vector2(${x}, ${y})\nevt.relative = Vector2(${relX}, ${relY})\nInput.parse_input_event(evt)`;

        const resp = await tcp.send({ id: `${Date.now()}`, method: 'game.eval', params: { code } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: `Mouse moved to (${x}, ${y})` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'input_gamepad',
        description: 'Simulate gamepad input in the running game (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            button: { type: 'number', description: 'Button index (0-23)' },
            axis: { type: 'number', description: 'Axis index (0-5)' },
            axis_value: { type: 'number', description: 'Axis value (-1 to 1)' },
            pressed: { type: 'boolean', description: 'Button pressed state', default: true },
          },
        },
      },
      handler: async (args) => {
        const tcp = server.getTcp();
        if (!tcp.isConnected()) return { content: [{ type: 'text', text: 'TCP not connected.' }], isError: true };

        let code = '';
        if (args.button !== undefined) {
          const button = (args.button as number) || 0;
          const pressed = (args.pressed as boolean) ?? true;
          code = `var evt = InputEventJoypadButton.new()\nevt.button_index = ${button}\nevt.pressed = ${pressed ? 'true' : 'false'}\nInput.parse_input_event(evt)`;
        } else if (args.axis !== undefined) {
          const axis = (args.axis as number) || 0;
          const axisValue = (args.axis_value as number) || 0;
          code = `var evt = InputEventJoypadMotion.new()\nevt.axis = ${axis}\nevt.axis_value = ${axisValue}\nInput.parse_input_event(evt)`;
        }

        const resp = await tcp.send({ id: `${Date.now()}`, method: 'game.eval', params: { code } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: 'Gamepad input synthesized.' }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'input_touch',
        description: 'Simulate touch input in the running game (requires TCP).',
        inputSchema: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X position' },
            y: { type: 'number', description: 'Y position' },
            index: { type: 'number', description: 'Touch index', default: 0 },
            pressed: { type: 'boolean', description: 'Touch pressed', default: true },
          },
          required: ['x', 'y'],
        },
      },
      handler: async (args) => {
        const x = (args.x as number) || 0;
        const y = (args.y as number) || 0;
        const idx = (args.index as number) || 0;
        const pressed = (args.pressed as boolean) ?? true;
        const tcp = server.getTcp();
        if (!tcp.isConnected()) return { content: [{ type: 'text', text: 'TCP not connected.' }], isError: true };

        const code = `var evt = InputEventScreenTouch.new()\nevt.index = ${idx}\nevt.pressed = ${pressed ? 'true' : 'false'}\nevt.position = Vector2(${x}, ${y})\nInput.parse_input_event(evt)`;

        const resp = await tcp.send({ id: `${Date.now()}`, method: 'game.eval', params: { code } });
        if (resp.error) return { content: [{ type: 'text', text: `Error: ${resp.error.message}` }], isError: true };
        return { content: [{ type: 'text', text: `Touch ${pressed ? 'pressed' : 'released'} at (${x}, ${y})` }] };
      },
      readOnly: false,
    },
  ];

  for (const tool of tools) {
    server.registerTool(tool);
  }
}
