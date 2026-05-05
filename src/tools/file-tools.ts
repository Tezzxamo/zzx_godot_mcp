/**
 * zzx-godot-mcp — File I/O Tools (5 tools)
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ZzxGodotServer } from '../server.js';
import type { ToolRegistration } from '../types/index.js';
import { requireString, optionalString } from '../utils/validators.js';
import { isSafePath, listFiles } from '../utils/path-utils.js';

export function registerFileTools(server: ZzxGodotServer): void {
  const projectPath = server.getConfig().projectPath || process.cwd();

  const tools: ToolRegistration[] = [
    {
      definition: {
        name: 'file_read',
        description: 'Read a text file from the Godot project.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path (res:// or absolute)' },
            offset: { type: 'number', description: 'Line offset (0-based, optional)' },
            limit: { type: 'number', description: 'Max lines to read (optional)' },
          },
          required: ['path'],
        },
      },
      handler: async (args) => {
        const filePath = requireString(args, 'path');
        const resolved = filePath.startsWith('res://')
          ? path.join(projectPath, filePath.replace('res://', ''))
          : path.resolve(filePath);

        if (!isSafePath(resolved, projectPath)) {
          return { content: [{ type: 'text', text: 'Error: Path is outside the project directory.' }], isError: true };
        }

        if (!fs.existsSync(resolved)) {
          return { content: [{ type: 'text', text: `Error: File not found: ${filePath}` }], isError: true };
        }

        const content = fs.readFileSync(resolved, 'utf-8');
        const offset = (args.offset as number) ?? 0;
        const limit = (args.limit as number) ?? Infinity;
        const lines = content.split('\n');
        const sliced = lines.slice(offset, offset + limit);
        const result = sliced.join('\n');
        const totalLines = lines.length;

        return {
          content: [{ type: 'text', text: `Lines ${offset + 1}-${Math.min(offset + limit, totalLines)} of ${totalLines}:\n\n${result}` }],
        };
      },
      readOnly: true,
    },
    {
      definition: {
        name: 'file_write',
        description: 'Create or overwrite a text file in the Godot project.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path (res:// or absolute)' },
            content: { type: 'string', description: 'File content' },
            append: { type: 'boolean', description: 'Append instead of overwrite (default false)' },
          },
          required: ['path', 'content'],
        },
      },
      handler: async (args) => {
        const filePath = requireString(args, 'path');
        const content = requireString(args, 'content');
        const append = (args.append as boolean) ?? false;

        const resolved = filePath.startsWith('res://')
          ? path.join(projectPath, filePath.replace('res://', ''))
          : path.resolve(filePath);

        if (!isSafePath(resolved, projectPath)) {
          return { content: [{ type: 'text', text: 'Error: Path is outside the project directory.' }], isError: true };
        }

        const dir = path.dirname(resolved);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(resolved, content, { flag: append ? 'a' : 'w', encoding: 'utf-8' });
        return {
          content: [{ type: 'text', text: `${append ? 'Appended to' : 'Wrote'} ${filePath} (${content.length} chars)` }],
        };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'file_delete',
        description: 'Delete a file from the Godot project.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path (res:// or absolute)' },
          },
          required: ['path'],
        },
      },
      handler: async (args) => {
        const filePath = requireString(args, 'path');
        const resolved = filePath.startsWith('res://')
          ? path.join(projectPath, filePath.replace('res://', ''))
          : path.resolve(filePath);

        if (!isSafePath(resolved, projectPath)) {
          return { content: [{ type: 'text', text: 'Error: Path is outside the project directory.' }], isError: true };
        }

        if (!fs.existsSync(resolved)) {
          return { content: [{ type: 'text', text: `Error: File not found: ${filePath}` }], isError: true };
        }

        fs.unlinkSync(resolved);
        return { content: [{ type: 'text', text: `Deleted ${filePath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'file_rename',
        description: 'Rename or move a file within the project.',
        inputSchema: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Source file path' },
            to: { type: 'string', description: 'Destination file path' },
          },
          required: ['from', 'to'],
        },
      },
      handler: async (args) => {
        const fromPath = requireString(args, 'from');
        const toPath = requireString(args, 'to');

        const resolvedFrom = fromPath.startsWith('res://')
          ? path.join(projectPath, fromPath.replace('res://', ''))
          : path.resolve(fromPath);
        const resolvedTo = toPath.startsWith('res://')
          ? path.join(projectPath, toPath.replace('res://', ''))
          : path.resolve(toPath);

        if (!isSafePath(resolvedFrom, projectPath) || !isSafePath(resolvedTo, projectPath)) {
          return { content: [{ type: 'text', text: 'Error: Path is outside the project directory.' }], isError: true };
        }

        if (!fs.existsSync(resolvedFrom)) {
          return { content: [{ type: 'text', text: `Error: Source file not found: ${fromPath}` }], isError: true };
        }

        const dir = path.dirname(resolvedTo);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.renameSync(resolvedFrom, resolvedTo);
        return { content: [{ type: 'text', text: `Renamed ${fromPath} → ${toPath}` }] };
      },
      readOnly: false,
    },
    {
      definition: {
        name: 'file_search',
        description: 'Search files in the project by pattern.',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Glob pattern or regex (e.g. "*.gd", "player")' },
            directory: { type: 'string', description: 'Directory to search (default: project root)' },
          },
          required: ['pattern'],
        },
      },
      handler: async (args) => {
        const pattern = requireString(args, 'pattern');
        const searchDir = optionalString(args, 'directory') || projectPath;
        const resolvedDir = path.resolve(searchDir);

        if (!isSafePath(resolvedDir, projectPath)) {
          return { content: [{ type: 'text', text: 'Error: Search directory is outside the project.' }], isError: true };
        }

        let regex: RegExp;
        try {
          regex = new RegExp(pattern, 'i');
        } catch {
          // Fallback to simple glob-like matching
          const globPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
          regex = new RegExp(globPattern, 'i');
        }

        const files = listFiles(resolvedDir, regex);
        const relativeFiles = files.map(f => path.relative(projectPath, f).replace(/\\/g, '/'));

        return {
          content: [{ type: 'text', text: `Found ${relativeFiles.length} files:\n${relativeFiles.join('\n')}` }],
        };
      },
      readOnly: true,
    },
  ];

  for (const tool of tools) {
    server.registerTool(tool);
  }
}
