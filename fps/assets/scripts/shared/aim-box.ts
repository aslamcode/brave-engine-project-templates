import type { MeshRenderer } from '@brave/core';

/** A box in the world, turned any way: a place where an aim counts as looking at something. Plain numbers, so the rule below can be checked without an engine. */
export interface IAimBox {
  /** The middle of the box. */
  center: [number, number, number];
  /** The three ways the box is turned, each of length 1. */
  axes: [[number, number, number], [number, number, number], [number, number, number]];
  /** Half of its size along each axis, metres. */
  half: [number, number, number];
}

/** Where a ray enters a box: how far from its origin, the point, and how deep in the box it goes (0 through the middle, 1 along an edge). */
export interface IBoxCrossing {
  distance: number;
  point: [number, number, number];
  depth: number;
}

/** The box of what a renderer draws, in the world as it is now: its mesh's bounds, turned and stretched as the entity is; none when it has no mesh. */
export function aimBoxOf(renderer: MeshRenderer): IAimBox | undefined {
  const bounds = renderer.mesh?.localBounds;
  if (!bounds) return undefined;

  const m = renderer.entity.transform.worldMatrix;
  const x = (bounds.min.x + bounds.max.x) / 2, y = (bounds.min.y + bounds.max.y) / 2, z = (bounds.min.z + bounds.max.z) / 2;
  const sizes = [Math.hypot(m[0], m[1], m[2]), Math.hypot(m[4], m[5], m[6]), Math.hypot(m[8], m[9], m[10])];
  if (sizes.some(size => size < 1e-9)) return undefined;

  return {
    center: [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]],
    axes: [[m[0] / sizes[0], m[1] / sizes[0], m[2] / sizes[0]], [m[4] / sizes[1], m[5] / sizes[1], m[6] / sizes[1]], [m[8] / sizes[2], m[9] / sizes[2], m[10] / sizes[2]]],
    half: [(bounds.max.x - bounds.min.x) / 2 * sizes[0], (bounds.max.y - bounds.min.y) / 2 * sizes[1], (bounds.max.z - bounds.min.z) / 2 * sizes[2]]
  };
}

/** The same box moved by `(x, y, z)`. */
export function shiftBox(box: IAimBox, x: number, y: number, z: number): IAimBox {
  return { center: [box.center[0] + x, box.center[1] + y, box.center[2] + z], axes: box.axes, half: box.half };
}

/** The same box, every side `margin` metres further out. */
export function growBox(box: IAimBox, margin: number): IAimBox {
  return { center: box.center, axes: box.axes, half: [box.half[0] + margin, box.half[1] + margin, box.half[2] + margin] };
}

/**
 * Where a ray from `origin` along `direction` (length 1) comes into the box, within `maxDistance`; none when it misses, when it is going away, or when it starts inside (someone standing in a doorway is not
 * looking at the door).
 */
export function rayThroughBox(origin: ArrayLike<number>, direction: ArrayLike<number>, box: IAimBox, maxDistance: number): IBoxCrossing | undefined {
  const from = [origin[0] - box.center[0], origin[1] - box.center[1], origin[2] - box.center[2]];
  let near = -Infinity, far = maxDistance;

  for (let i = 0; i < 3; i++) {
    const axis = box.axes[i];
    const start = from[0] * axis[0] + from[1] * axis[1] + from[2] * axis[2];
    const speed = direction[0] * axis[0] + direction[1] * axis[1] + direction[2] * axis[2];
    if (Math.abs(speed) < 1e-9) {
      if (Math.abs(start) > box.half[i]) return undefined;
      continue;
    }

    const a = (-box.half[i] - start) / speed, b = (box.half[i] - start) / speed;
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
    if (near > far) return undefined;
  }

  if (!(near > 0)) return undefined;

  const middle = (near + far) / 2;
  const depth = [0, 1, 2].reduce((deepest, i) => {
    const axis = box.axes[i];
    const across = (from[0] + direction[0] * middle) * axis[0] + (from[1] + direction[1] * middle) * axis[1] + (from[2] + direction[2] * middle) * axis[2];
    return Math.max(deepest, Math.abs(across) / box.half[i]);
  }, 0);

  return { distance: near, point: [origin[0] + direction[0] * near, origin[1] + direction[1] * near, origin[2] + direction[2] * near], depth };
}
