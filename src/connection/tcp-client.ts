/**
 * zzx-godot-mcp — TCP Client (connects to Running Game)
 */

import { Socket } from 'node:net';
import { TCP_TIMEOUT_MS } from '../constants.js';
import type { GodotCommand, GodotResponse } from '../types/index.js';
import { BaseConnection } from './base-connection.js';
import * as logger from '../utils/logger.js';

export class TcpClient extends BaseConnection {
  private host: string;
  private port: number;
  private socket: Socket | null = null;
  private buffer = '';
  private pendingRequests = new Map<string, (response: GodotResponse) => void>();

  constructor(port: number, host = '127.0.0.1') {
    super();
    this.host = host;
    this.port = port;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error(`TCP connection timed out to ${this.host}:${this.port}`));
      }, TCP_TIMEOUT_MS);

      socket.connect(this.port, this.host, () => {
        clearTimeout(timeout);
        this.socket = socket;
        this.connected = true;
        logger.info(`TCP connected to ${this.host}:${this.port}`);
        resolve();
      });

      socket.on('data', (data: Buffer) => {
        this.buffer += data.toString('utf-8');
        this.processBuffer();
      });

      socket.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`TCP error: ${err.message}`));
      });

      socket.on('close', () => {
        this.connected = false;
        this.socket = null;
        // Clean up pending requests
        for (const [id, resolver] of this.pendingRequests) {
          resolver({ id, error: { code: -1, message: 'Connection closed' } });
        }
        this.pendingRequests.clear();
        logger.info('TCP disconnected');
      });
    });
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const response: GodotResponse = JSON.parse(line);
        const resolver = this.pendingRequests.get(response.id);
        if (resolver) {
          this.pendingRequests.delete(response.id);
          resolver(response);
        }
      } catch {
        logger.warn('Failed to parse TCP message', line.substring(0, 200));
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
    for (const [, reject] of this.pendingRequests) {
      reject({ id: '', error: { code: -1, message: 'Connection closed' } });
    }
    this.pendingRequests.clear();
  }

  async send(command: GodotCommand): Promise<GodotResponse> {
    if (!this.socket || !this.connected) {
      throw new Error('TCP not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(command.id);
        reject(new Error(`Request ${command.id} timed out`));
      }, TCP_TIMEOUT_MS);

      this.pendingRequests.set(command.id, (response: GodotResponse) => {
        clearTimeout(timeout);
        resolve(response);
      });

      this.socket!.write(JSON.stringify(command) + '\n', (err) => {
        if (err) {
          clearTimeout(timeout);
          this.pendingRequests.delete(command.id);
          reject(err);
        }
      });
    });
  }
}
