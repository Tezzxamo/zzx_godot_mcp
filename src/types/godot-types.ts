/**
 * Godot ↔ JSON 类型映射定义
 * 完整覆盖 Godot 4.6.x 核心数据类型
 */

/* ── Vector types ── */

export interface Vector2 {
  x: number;
  y: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Vector2i {
  x: number;
  y: number;
}

export interface Vector3i {
  x: number;
  y: number;
  z: number;
}

/* ── Color ── */

export interface ColorObj {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type ColorInput = ColorObj | string; // string: "#RRGGBBAA" or "#RRGGBB"

/* ── Rect & Transform ── */

export interface Rect2 {
  position: Vector2;
  size: Vector2;
}

export interface Transform2D {
  x: Vector2;
  y: Vector2;
  origin: Vector2;
}

export interface Basis {
  x: Vector3;
  y: Vector3;
  z: Vector3;
}

export interface Transform3D {
  basis: Basis;
  origin: Vector3;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface AABB {
  position: Vector3;
  size: Vector3;
}

/* ── Packed arrays ── */

export type PackedVector2Array = Vector2[];
export type PackedVector3Array = Vector3[];
export type PackedColorArray = (ColorObj | string)[];
export type PackedStringArray = string[];
export type PackedInt32Array = number[];
export type PackedFloat32Array = number[];

/* ── Callable / Signal ── */

export interface CallableRef {
  object: string; // NodePath
  method: string;
}

export interface SignalRef {
  object: string; // NodePath
  signal: string;
}

/* ── Node info ── */

export interface NodeInfo {
  name: string;
  type: string;
  path: string;
  children: NodeInfo[];
  properties?: Record<string, unknown>;
  signals?: Array<{ name: string; connections: CallableRef[] }>;
  methods?: string[];
}

/* ── Scene tree ── */

export interface SceneTreeNode {
  name: string;
  type: string;
  path: string;
  children: SceneTreeNode[];
}

/* ── Property descriptor ── */

export interface PropertyDescriptor {
  name: string;
  type: string;
  value: unknown;
  usage?: number;
  hint?: number;
  hint_string?: string;
  class_name?: string;
}
