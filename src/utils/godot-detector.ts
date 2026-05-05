/**
 * zzx-godot-mcp — Godot Path & Version Detector
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { GODOT_EXECUTABLE_NAMES, GODOT_COMMON_PATHS } from '../constants.js';
import * as logger from './logger.js';

/**
 * Auto-detect Godot executable path.
 */
export function detectGodotPath(): string {
  // 1. Check PATH
  for (const name of GODOT_EXECUTABLE_NAMES) {
    try {
      const result = spawnSync('where', [name], { encoding: 'utf-8', shell: true });
      if (result.status === 0 && result.stdout) {
        const paths = result.stdout.trim().split('\n').map(s => s.trim()).filter(Boolean);
        for (const p of paths) {
          if (fs.existsSync(p)) {
            logger.debug(`Godot found via PATH: ${p}`);
            return p;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Check common installation paths
  for (const dir of GODOT_COMMON_PATHS) {
    for (const name of GODOT_EXECUTABLE_NAMES) {
      const fullPath = path.join(dir, name);
      if (fs.existsSync(fullPath)) {
        logger.debug(`Godot found in common path: ${fullPath}`);
        return fullPath;
      }
    }
  }

  // 3. Fallback to bare 'godot' command
  logger.warn('Could not auto-detect Godot path. Falling back to "godot". Set GODOT_EXECUTABLE or GODOT_PATH env var.');
  return 'godot';
}

/**
 * Get Godot version string.
 */
export function getGodotVersion(godotPath: string): string | null {
  try {
    const result = spawnSync(godotPath, ['--version'], { encoding: 'utf-8', timeout: 5000 });
    if (result.status === 0) {
      return result.stdout.trim();
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Check if Godot path is valid and executable.
 */
export function isGodotValid(godotPath: string): boolean {
  return fs.existsSync(godotPath);
}
