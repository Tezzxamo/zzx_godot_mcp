import { describe, it, expect } from 'vitest';
import { jsonToVector2, jsonToVector3, jsonToColor, colorToHex, hexToColor } from '../src/utils/type-converter.js';
import { isSafePath, normalizeResPath, findProjectRoot } from '../src/utils/path-utils.js';
import { requireString, requireNumber, ValidationError } from '../src/utils/validators.js';

describe('Type Converter', () => {
  it('converts JSON to Vector2', () => {
    expect(jsonToVector2({ x: 1, y: 2 })).toEqual({ x: 1, y: 2 });
    expect(jsonToVector2('3, 4')).toEqual({ x: 3, y: 4 });
  });

  it('converts JSON to Vector3', () => {
    expect(jsonToVector3({ x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('converts hex to Color', () => {
    expect(hexToColor('#FF0000')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    expect(hexToColor('#00FF00FF')).toEqual({ r: 0, g: 1, b: 0, a: 1 });
  });

  it('converts Color to hex', () => {
    expect(colorToHex({ r: 1, g: 0, b: 0, a: 1 })).toBe('#ff0000ff');
  });
});

describe('Path Utils', () => {
  it('normalizes paths', () => {
    expect(normalizeResPath('scenes\\main.tscn')).toBe('scenes/main.tscn');
  });

  it('checks safe paths', () => {
    expect(isSafePath('E:/project/scenes/main.tscn', 'E:/project')).toBe(true);
    expect(isSafePath('E:/other/file.txt', 'E:/project')).toBe(false);
    expect(isSafePath('../../../etc/passwd', 'E:/project')).toBe(false);
  });
});

describe('Validators', () => {
  it('requires string', () => {
    expect(requireString({ name: 'test' }, 'name')).toBe('test');
    expect(() => requireString({}, 'name')).toThrow(ValidationError);
  });

  it('requires number', () => {
    expect(requireNumber({ age: 25 }, 'age')).toBe(25);
    expect(() => requireNumber({}, 'age')).toThrow(ValidationError);
  });
});
