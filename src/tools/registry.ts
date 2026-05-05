/**
 * zzx-godot-mcp — Tool Registry Builder
 */

import type { ZzxGodotServer } from '../server.js';
import * as logger from '../utils/logger.js';

// Tool modules will be imported here
import { registerFileTools } from './file-tools.js';
import { registerSceneTools } from './scene-tools.js';
import { registerNodeTools } from './node-tools.js';
import { registerScriptTools } from './script-tools.js';
import { registerProjectTools } from './project-tools.js';
import { registerRuntimeTools } from './runtime-tools.js';
import { registerResourceTools } from './resource-tools.js';
import { registerRendering2DTools } from './rendering-2d-tools.js';
import { registerRendering3DTools } from './rendering-3d-tools.js';
import { registerHd2dTools } from './hd2d-tools.js';
import { registerAnimationTools } from './animation-tools.js';
import { registerPhysicsTools } from './physics-tools.js';
import { registerAudioTools } from './audio-tools.js';
import { registerInputTools } from './input-tools.js';
import { registerUiTools } from './ui-tools.js';
import { registerNetworkingTools } from './networking-tools.js';
import { registerProcessTools } from './process-tools.js';
import { registerDocsTools } from './docs-tools.js';

export function registerAllTools(server: ZzxGodotServer): void {
  logger.info('Registering all tools...');

  registerFileTools(server);
  registerSceneTools(server);
  registerNodeTools(server);
  registerScriptTools(server);
  registerProjectTools(server);
  registerRuntimeTools(server);
  registerResourceTools(server);
  registerRendering2DTools(server);
  registerRendering3DTools(server);
  registerHd2dTools(server);
  registerAnimationTools(server);
  registerPhysicsTools(server);
  registerAudioTools(server);
  registerInputTools(server);
  registerUiTools(server);
  registerNetworkingTools(server);
  registerProcessTools(server);
  registerDocsTools(server);

  logger.info('All tools registered.');
}
