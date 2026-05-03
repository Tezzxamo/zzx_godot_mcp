/**
 * zzx-godot-mcp — Path Utilities
 */

import path from 'node:path';
import fs from 'node:fs';

/**
 * Convert a res:// path to an absolute filesystem path.
 */
export function resPathToAbsolute(resPath: string, projectRoot: string): string {
  if (!resPath.startsWith('res://')) {
    return path.resolve(projectRoot, resPath);
  }
  const relative = resPath.replace('res://', '').replace(/\//g, path.sep);
  return path.join(projectRoot, relative);
}

/**
 * Convert an absolute path to a res:// path.
 */
export function absoluteToResPath(absPath: string, projectRoot: string): string {
  const relative = path.relative(projectRoot, absPath).replace(/\\/g, '/');
  return `res://${relative}`;
}

/**
 * Normalize a path to use forward slashes (Godot convention).
 */
export function normalizeResPath(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * Check if a path is inside the project directory.
 */
export function isPathInsideProject(targetPath: string, projectRoot: string): boolean {
  const resolved = path.resolve(targetPath);
  const root = path.resolve(projectRoot);
  return resolved.startsWith(root);
}

/**
 * Validate that a file path is safe (no directory traversal).
 */
export function isSafePath(targetPath: string, projectRoot: string): boolean {
  if (targetPath.includes('..')) return false;
  return isPathInsideProject(targetPath, projectRoot);
}

/**
 * Find project.godot in a directory or its parents.
 */
export function findProjectRoot(startDir: string): string | null {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;

  while (current !== root) {
    const projectFile = path.join(current, 'project.godot');
    if (fs.existsSync(projectFile)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

/**
 * List all files recursively matching a pattern.
 */
export function listFiles(dir: string, pattern?: RegExp): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFiles(fullPath, pattern));
    } else if (!pattern || pattern.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}
