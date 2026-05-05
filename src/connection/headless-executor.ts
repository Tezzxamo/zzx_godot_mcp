/**
 * zzx-godot-mcp — Headless CLI Executor
 * Runs Godot with --headless --script for file/scene operations.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_TIMEOUT_MS } from '../constants.js';
import type { HeadlessResult, GodotCommand, GodotResponse } from '../types/index.js';
import { BaseConnection } from './base-connection.js';
import * as logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.resolve(__dirname, '..', '..', 'scripts', 'headless_operations.gd');

export class HeadlessExecutor extends BaseConnection {
  private godotPath: string;
  private projectPath: string;

  constructor(godotPath: string, projectPath: string) {
    super();
    this.godotPath = godotPath;
    this.projectPath = projectPath;
  }

  async connect(): Promise<void> {
    // Headless doesn't need persistent connection
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async send(command: GodotCommand): Promise<GodotResponse> {
    const params = JSON.stringify({ method: command.method, params: command.params });
    const result = await this.executeHeadless(params);

    if (!result.success) {
      return {
        id: command.id,
        error: { code: 1, message: result.error || 'Headless execution failed', data: result.output },
      };
    }

    try {
      const parsed = JSON.parse(result.output);
      return { id: command.id, result: parsed };
    } catch {
      return { id: command.id, result: result.output };
    }
  }

  async executeHeadless(paramsJson: string): Promise<HeadlessResult> {
    return new Promise((resolve) => {
      const args = [
        '--headless',
        '--path', this.projectPath,
        '--script', SCRIPT_PATH,
        '--', paramsJson,
      ];

      logger.debug(`Headless: ${this.godotPath} ${args.join(' ')}`);

      const child = spawn(this.godotPath, args, {
        cwd: this.projectPath,
        env: process.env,
      });

      let stdout = '';
      let stderr = '';
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        resolve({
          success: false,
          output: stdout,
          error: `Headless execution timed out after ${HEADLESS_TIMEOUT_MS}ms`,
          exitCode: -1,
        });
      }, HEADLESS_TIMEOUT_MS);

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString('utf-8');
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString('utf-8');
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        const success = code === 0;
        resolve({
          success,
          output: stdout.trim(),
          error: stderr.trim() || undefined,
          exitCode: code ?? -1,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          output: stdout,
          error: `Spawn error: ${err.message}`,
          exitCode: -1,
        });
      });
    });
  }
}
