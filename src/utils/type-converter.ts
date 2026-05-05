/**
 * zzx-godot-mcp — Godot ↔ JSON Type Converter
 */

import type {
  Vector2, Vector3, Vector2i, Vector3i,
  ColorObj, ColorInput,
  Rect2, Transform2D, Basis, Transform3D,
  Quaternion, AABB,
} from '../types/godot-types.js';

/* ── To JSON (Godot → JSON) ── */

export function vector2ToJson(v: Vector2): Vector2 {
  return { x: v.x, y: v.y };
}

export function vector3ToJson(v: Vector3): Vector3 {
  return { x: v.x, y: v.y, z: v.z };
}

export function colorToJson(c: ColorObj): ColorObj {
  return { r: c.r, g: c.g, b: c.b, a: c.a };
}

export function colorToHex(c: ColorObj): string {
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}${toHex(c.a)}`;
}

export function rect2ToJson(r: Rect2): Rect2 {
  return {
    position: vector2ToJson(r.position),
    size: vector2ToJson(r.size),
  };
}

export function basisToJson(b: Basis): Basis {
  return {
    x: vector3ToJson(b.x),
    y: vector3ToJson(b.y),
    z: vector3ToJson(b.z),
  };
}

export function transform2DToJson(t: Transform2D): Transform2D {
  return {
    x: vector2ToJson(t.x),
    y: vector2ToJson(t.y),
    origin: vector2ToJson(t.origin),
  };
}

export function transform3DToJson(t: Transform3D): Transform3D {
  return {
    basis: basisToJson(t.basis),
    origin: vector3ToJson(t.origin),
  };
}

export function quaternionToJson(q: Quaternion): Quaternion {
  return { x: q.x, y: q.y, z: q.z, w: q.w };
}

export function aabbToJson(a: AABB): AABB {
  return {
    position: vector3ToJson(a.position),
    size: vector3ToJson(a.size),
  };
}

/* ── From JSON (JSON → Godot) ── */

export function jsonToVector2(v: unknown): Vector2 {
  if (typeof v === 'string') {
    const parts = v.split(',').map(s => parseFloat(s.trim()));
    return { x: parts[0] || 0, y: parts[1] || 0 };
  }
  const o = v as Record<string, number>;
  return { x: o.x ?? 0, y: o.y ?? 0 };
}

export function jsonToVector3(v: unknown): Vector3 {
  if (typeof v === 'string') {
    const parts = v.split(',').map(s => parseFloat(s.trim()));
    return { x: parts[0] || 0, y: parts[1] || 0, z: parts[2] || 0 };
  }
  const o = v as Record<string, number>;
  return { x: o.x ?? 0, y: o.y ?? 0, z: o.z ?? 0 };
}

export function jsonToVector2i(v: unknown): Vector2i {
  const r = jsonToVector2(v);
  return { x: Math.round(r.x), y: Math.round(r.y) };
}

export function jsonToVector3i(v: unknown): Vector3i {
  const r = jsonToVector3(v);
  return { x: Math.round(r.x), y: Math.round(r.y), z: Math.round(r.z) };
}

export function jsonToColor(c: ColorInput): ColorObj {
  if (typeof c === 'string') {
    return hexToColor(c);
  }
  return { r: c.r ?? 0, g: c.g ?? 0, b: c.b ?? 0, a: c.a ?? 1 };
}

export function hexToColor(hex: string): ColorObj {
  const cleaned = hex.replace('#', '');
  if (cleaned.length === 6) {
    return {
      r: parseInt(cleaned.substring(0, 2), 16) / 255,
      g: parseInt(cleaned.substring(2, 4), 16) / 255,
      b: parseInt(cleaned.substring(4, 6), 16) / 255,
      a: 1,
    };
  }
  if (cleaned.length === 8) {
    return {
      r: parseInt(cleaned.substring(0, 2), 16) / 255,
      g: parseInt(cleaned.substring(2, 4), 16) / 255,
      b: parseInt(cleaned.substring(4, 6), 16) / 255,
      a: parseInt(cleaned.substring(6, 8), 16) / 255,
    };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

export function jsonToRect2(r: unknown): Rect2 {
  const o = r as Record<string, unknown>;
  return {
    position: jsonToVector2(o.position),
    size: jsonToVector2(o.size),
  };
}

export function jsonToBasis(b: unknown): Basis {
  const o = b as Record<string, unknown>;
  return {
    x: jsonToVector3(o.x),
    y: jsonToVector3(o.y),
    z: jsonToVector3(o.z),
  };
}

export function jsonToTransform2D(t: unknown): Transform2D {
  const o = t as Record<string, unknown>;
  return {
    x: jsonToVector2(o.x),
    y: jsonToVector2(o.y),
    origin: jsonToVector2(o.origin),
  };
}

export function jsonToTransform3D(t: unknown): Transform3D {
  const o = t as Record<string, unknown>;
  return {
    basis: jsonToBasis(o.basis),
    origin: jsonToVector3(o.origin),
  };
}

export function jsonToQuaternion(q: unknown): Quaternion {
  const o = q as Record<string, number>;
  return { x: o.x ?? 0, y: o.y ?? 0, z: o.z ?? 0, w: o.w ?? 1 };
}

export function jsonToAABB(a: unknown): AABB {
  const o = a as Record<string, unknown>;
  return {
    position: jsonToVector3(o.position),
    size: jsonToVector3(o.size),
  };
}

/* ── Generic converter ── */

export function convertGodotValueToJson(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(convertGodotValueToJson);
  if (typeof value === 'object') {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      obj[k] = convertGodotValueToJson(v);
    }
    return obj;
  }
  return String(value);
}
