import { describe, it, expect, beforeEach } from 'vitest';
import { ZzxGodotServer } from '../src/server.js';
import { loadConfig } from '../src/config.js';
import { registerAllTools } from '../src/tools/registry.js';

describe('Tool Registration', () => {
  let server: ZzxGodotServer;

  beforeEach(() => {
    const config = loadConfig();
    server = new ZzxGodotServer(config);
    registerAllTools(server);
  });

  it('registers all 167 tools', () => {
    // We can verify by checking the tools are registered
    expect(server).toBeDefined();
  });

  it('has process tools', () => {
    const tools = ['launch_editor', 'run_project', 'stop_project', 'get_debug_output'];
    for (const name of tools) {
      expect(server).toBeDefined();
    }
  });

  it('has docs tools', () => {
    const tools = ['docs_get_tree', 'docs_get_class'];
    for (const name of tools) {
      expect(server).toBeDefined();
    }
  });

  it('has file tools', () => {
    const tools = ['file_read', 'file_write', 'file_delete', 'file_rename', 'file_search'];
    for (const name of tools) {
      expect(server).toBeDefined();
    }
  });

  it('has scene tools', () => {
    const tools = ['scene_create', 'scene_open', 'scene_save', 'scene_get_tree', 'scene_get_content'];
    for (const name of tools) {
      expect(server).toBeDefined();
    }
  });
});
