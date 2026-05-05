/**
 * zzx-godot-mcp — Base Connection
 */

import type { GodotCommand, GodotResponse } from '../types/index.js';

export abstract class BaseConnection {
  protected connected = false;

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract send(command: GodotCommand): Promise<GodotResponse>;

  isConnected(): boolean {
    return this.connected;
  }

  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
