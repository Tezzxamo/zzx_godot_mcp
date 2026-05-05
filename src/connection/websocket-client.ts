/**
 * zzx-godot-mcp — WebSocket Client (connects to Godot Editor Plugin)
 */

import WebSocket from 'ws';
import { WEBSOCKET_TIMEOUT_MS } from '../constants.js';
import type { GodotCommand, GodotResponse } from '../types/index.js';
import { BaseConnection } from './base-connection.js';
import * as logger from '../utils/logger.js';

export class WebSocketClient extends BaseConnection {
  private url: string;
  private ws: WebSocket | null = null;
  private pendingRequests = new Map<string, (response: GodotResponse) => void>();

  constructor(port: number) {
    super();
    this.url = `ws://127.0.0.1:${port}`;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      const timeout = setTimeout(() => {
        ws.terminate();
        reject(new Error(`WebSocket connection timed out to ${this.url}`));
      }, WEBSOCKET_TIMEOUT_MS);

      ws.on('open', () => {
        clearTimeout(timeout);
        this.ws = ws;
        this.connected = true;
        logger.info(`WebSocket connected to ${this.url}`);
        resolve();
      });

      ws.on('message', (data: WebSocket.RawData) => {
        try {
          const response: GodotResponse = JSON.parse(data.toString());
          const resolver = this.pendingRequests.get(response.id);
          if (resolver) {
            this.pendingRequests.delete(response.id);
            resolver(response);
          }
        } catch (err) {
          logger.warn('Failed to parse WebSocket message', err);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket error: ${err.message}`));
      });

      ws.on('close', () => {
        this.connected = false;
        this.ws = null;
        logger.info('WebSocket disconnected');
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    // Reject all pending requests
    for (const [, reject] of this.pendingRequests) {
      reject({ id: '', error: { code: -1, message: 'Connection closed' } });
    }
    this.pendingRequests.clear();
  }

  async send(command: GodotCommand): Promise<GodotResponse> {
    if (!this.ws || !this.connected) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(command.id);
        reject(new Error(`Request ${command.id} timed out`));
      }, WEBSOCKET_TIMEOUT_MS);

      this.pendingRequests.set(command.id, (response: GodotResponse) => {
        clearTimeout(timeout);
        resolve(response);
      });

      this.ws!.send(JSON.stringify(command), (err) => {
        if (err) {
          clearTimeout(timeout);
          this.pendingRequests.delete(command.id);
          reject(err);
        }
      });
    });
  }
}
