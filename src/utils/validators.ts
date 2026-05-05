/**
 * zzx-godot-mcp — Input Validators
 */

import path from 'node:path';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationError(`Parameter "${key}" is required and must be a non-empty string.`);
  }
  return value;
}

export function optionalString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new ValidationError(`Parameter "${key}" must be a string.`);
  }
  return value;
}

export function requireNumber(args: Record<string, unknown>, key: string): number {
  const value = args[key];
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new ValidationError(`Parameter "${key}" is required and must be a number.`);
  }
  return value;
}

export function optionalNumber(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new ValidationError(`Parameter "${key}" must be a number.`);
  }
  return value;
}

export function requireBoolean(args: Record<string, unknown>, key: string): boolean {
  const value = args[key];
  if (typeof value !== 'boolean') {
    throw new ValidationError(`Parameter "${key}" is required and must be a boolean.`);
  }
  return value;
}

export function optionalBoolean(args: Record<string, unknown>, key: string): boolean | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw new ValidationError(`Parameter "${key}" must be a boolean.`);
  }
  return value;
}

export function requireArray<T>(args: Record<string, unknown>, key: string): T[] {
  const value = args[key];
  if (!Array.isArray(value)) {
    throw new ValidationError(`Parameter "${key}" is required and must be an array.`);
  }
  return value as T[];
}

export function optionalArray<T>(args: Record<string, unknown>, key: string): T[] | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new ValidationError(`Parameter "${key}" must be an array.`);
  }
  return value as T[];
}

export function requireObject(args: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = args[key];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(`Parameter "${key}" is required and must be an object.`);
  }
  return value as Record<string, unknown>;
}

export function optionalObject(args: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(`Parameter "${key}" must be an object.`);
  }
  return value as Record<string, unknown>;
}

export function requireOneOf<T extends string>(args: Record<string, unknown>, key: string, options: readonly T[]): T {
  const value = args[key];
  if (typeof value !== 'string' || !options.includes(value as T)) {
    throw new ValidationError(`Parameter "${key}" must be one of: ${options.join(', ')}.`);
  }
  return value as T;
}

export function validateNodePath(pathStr: string): string {
  if (typeof pathStr !== 'string') {
    throw new ValidationError('Node path must be a string.');
  }
  if (pathStr.includes('..')) {
    throw new ValidationError('Node path cannot contain "..".');
  }
  return pathStr;
}

export function validateResPath(pathStr: string): string {
  if (typeof pathStr !== 'string') {
    throw new ValidationError('Resource path must be a string.');
  }
  if (!pathStr.startsWith('res://') && !path.isAbsolute(pathStr)) {
    throw new ValidationError('Resource path must start with "res://" or be absolute.');
  }
  return pathStr;
}
