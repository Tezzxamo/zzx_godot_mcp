/**
 * zzx-godot-mcp — Godot Process Management Tools (4 tools)
 *
 * Inspired by coding-solo/godot-mcp:
 *   - launch_editor: open Godot editor for a project
 *   - run_project:   run project in debug mode and capture output
 *   - stop_project:  stop the active Godot process
 *   - get_debug_output: retrieve captured stdout/stderr
 */

import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { ZzxGodotServer } from '../server.js';
import type { ToolRegistration, ToolResponse } from '../types/index.js';
import { requireString, optionalString } from '../utils/validators.js';

interface CapturedProcess {
  process: ChildProcess;
  output: string[];
  errors: string[];
  projectPath: string;
}

/** Module-level singleton to keep the active Godot process alive across tool calls. */
let activeProcess: CapturedProcess | null = null;

function killActiveProcess(): void {
  if (activeProcess) {
    try {
      activeProcess.process.kill('SIGTERM');
    } catch {
      // ignore
    }
    activeProcess = null;
  }
}

function makeErrorResponse(message: string, solutions: string[] = []): ToolResponse {
  const content: ToolResponse['content'] = [{ type: 'text', text: message }];
  if (solutions.length > 0) {
    content.push({
      type: 'text',
      text: 'Possible solutions:\n- ' + solutions.join('\n- '),
    });
  }
  return { content, isError: true };
}

export function registerProcessTools(server: ZzxGodotServer): void {
  const tools: ToolRegistration[] = [
    {
      definition: {
        name: 'launch_editor',
        description: 'Launch the Godot editor for the current project. Use this when WebSocket is not connected.',
        inputSchema: {
          type: 'object',
          properties: {
            project_path: {
              type: 'string',
              description: 'Absolute path to the Godot project directory (must contain project.godot). Defaults to the detected project path.',
            },
          },
        },
      },
      handler: async (args) => {
        const projectPath = (args.project_path as string) || server.getConfig().projectPath;
        const godotPath = server.getConfig().godotPath;

        if (!projectPath) {
          return makeErrorResponse(
            'No project path available. Provide project_path or set ZZX_PROJECT_PATH env var.',
            ['Run from a Godot project directory.', 'Set ZZX_PROJECT_PATH environment variable.']
          );
        }

        if (!fs.existsSync(projectPath)) {
          return makeErrorResponse(
            `Project directory does not exist: ${projectPath}`,
            ['Provide a valid absolute path to a Godot project directory.']
          );
        }

        const projectFile = path.join(projectPath, 'project.godot');
        if (!fs.existsSync(projectFile)) {
          return makeErrorResponse(
            `Not a valid Godot project: ${projectPath} (missing project.godot).`,
            ['Ensure the path points to a directory containing project.godot.', 'Use list_projects to discover valid projects.']
          );
        }

        try {
          const proc = spawn(godotPath, ['-e', '--path', projectPath], {
            detached: true,
            stdio: 'ignore',
          });
          proc.unref();
          return {
            content: [{
              type: 'text',
              text: `Godot editor launched for project: ${projectPath}\n\n` +
                    'Next steps:\n' +
                    '1. Wait 5-10 seconds for the editor to fully load\n' +
                    '2. In Godot: Project -> Project Settings -> Plugins -> Enable "ZZX Godot MCP"\n' +
                    '3. MCP WebSocket will auto-connect. Then you can use editor and runtime tools.',
            }],
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return makeErrorResponse(
            `Failed to launch editor: ${msg}`,
            ['Ensure Godot is installed correctly.', `Set GODOT_PATH env var to the correct executable path.`]
          );
        }
      },
      readOnly: false,
    },

    {
      definition: {
        name: 'run_project',
        description: 'Run a Godot project in debug mode and start capturing stdout/stderr.',
        inputSchema: {
          type: 'object',
          properties: {
            project_path: {
              type: 'string',
              description: 'Absolute path to the Godot project directory.',
            },
            scene: {
              type: 'string',
              description: 'Optional specific scene file to run (relative to project or res:// path).',
            },
          },
          required: ['project_path'],
        },
      },
      handler: async (args) => {
        const projectPath = requireString(args, 'project_path');
        const scene = optionalString(args, 'scene');
        const godotPath = server.getConfig().godotPath;

        if (!fs.existsSync(projectPath)) {
          return makeErrorResponse(
            `Project directory does not exist: ${projectPath}`,
            ['Provide a valid absolute path.']
          );
        }

        const projectFile = path.join(projectPath, 'project.godot');
        if (!fs.existsSync(projectFile)) {
          return makeErrorResponse(
            `Not a valid Godot project: ${projectPath} (missing project.godot).`,
            ['Use list_projects to discover valid projects.']
          );
        }

        // Kill any existing process
        killActiveProcess();

        const cmdArgs = ['-d', '--path', projectPath];
        if (scene) {
          cmdArgs.push(scene);
        }

        try {
          const proc = spawn(godotPath, cmdArgs, { stdio: 'pipe' });
          const output: string[] = [];
          const errors: string[] = [];

          proc.stdout?.on('data', (data: Buffer) => {
            const lines = data.toString().split('\n');
            output.push(...lines.filter((l) => l.trim()));
          });

          proc.stderr?.on('data', (data: Buffer) => {
            const lines = data.toString().split('\n');
            errors.push(...lines.filter((l) => l.trim()));
          });

          proc.on('exit', (code) => {
            output.push(`[Process exited with code ${code}]`);
            if (activeProcess?.process === proc) {
              activeProcess = null;
            }
          });

          proc.on('error', (err) => {
            errors.push(`[Process error: ${err.message}]`);
            if (activeProcess?.process === proc) {
              activeProcess = null;
            }
          });

          activeProcess = { process: proc, output, errors, projectPath };

          return {
            content: [
              {
                type: 'text',
                text: `Godot project started in debug mode.\nProject: ${projectPath}${scene ? '\nScene: ' + scene : ''}\nUse get_debug_output to view logs.\n\n` +
                      '⚠️  Warning: run_project launches the game directly without the Godot editor.\n' +
                      'MCP runtime tools (screenshot, eval, get_tree) require the editor plugin TCP server,\n' +
                      'which only starts when the game is launched from the editor (F5).\n' +
                      'For full MCP functionality, use launch_editor + runtime_play instead.',
              },
            ],
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return makeErrorResponse(
            `Failed to run project: ${msg}`,
            ['Ensure Godot is installed correctly.', `Set GODOT_EXECUTABLE or GODOT_PATH env var to the correct executable path.`]
          );
        }
      },
      readOnly: false,
    },

    {
      definition: {
        name: 'stop_project',
        description: 'Stop the Godot project that was started by run_project.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async (_args) => {
        if (!activeProcess) {
          return makeErrorResponse(
            'No active Godot process to stop.',
            ['Use run_project to start a project first.', 'The process may have already terminated.']
          );
        }

        const finalOutput = [...activeProcess.output];
        const finalErrors = [...activeProcess.errors];

        killActiveProcess();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: 'Godot project stopped.',
                  final_output: finalOutput.slice(-50),
                  final_errors: finalErrors.slice(-50),
                },
                null,
                2
              ),
            },
          ],
        };
      },
      readOnly: false,
    },

    {
      definition: {
        name: 'get_debug_output',
        description: 'Get the current debug output and errors from the running Godot project.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async (_args) => {
        if (!activeProcess) {
          return makeErrorResponse(
            'No active Godot process.',
            ['Use run_project to start a Godot project first.', 'Check if the Godot process crashed unexpectedly.']
          );
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  project_path: activeProcess.projectPath,
                  output: activeProcess.output,
                  errors: activeProcess.errors,
                },
                null,
                2
              ),
            },
          ],
        };
      },
      readOnly: true,
    },
  ];

  server.registerTools(tools);
}
