import { Entity, MeshRenderer, Vector3 } from '@brave/core';

/** The renderer of the biggest thing an entity (and what is under it) is drawn with, by the size it has in the world; none when nothing is drawn. */
export function biggestRenderer(entity: Entity, best?: MeshRenderer): MeshRenderer | undefined {
  const renderer = entity.getComponent(MeshRenderer);
  if (renderer && volumeOf(renderer) > (best ? volumeOf(best) : 0)) best = renderer;
  entity.children.forEach(child => { best = biggestRenderer(child, best); });
  return best;
}

/** The centre of what a renderer draws, in the world as it is now; none when it has no mesh. */
export function centerOf(renderer: MeshRenderer): Vector3 | undefined {
  const bounds = renderer.mesh?.localBounds;
  if (!bounds) return undefined;

  const m = renderer.entity.transform.worldMatrix;
  const x = (bounds.min.x + bounds.max.x) / 2, y = (bounds.min.y + bounds.max.y) / 2, z = (bounds.min.z + bounds.max.z) / 2;
  return new Vector3(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
}

function volumeOf(renderer: MeshRenderer): number {
  const bounds = renderer.mesh?.localBounds;
  if (!bounds) return 0;

  const m = renderer.entity.transform.worldMatrix;
  return (bounds.max.x - bounds.min.x) * Math.hypot(m[0], m[1], m[2]) * (bounds.max.y - bounds.min.y) * Math.hypot(m[4], m[5], m[6]) * (bounds.max.z - bounds.min.z) * Math.hypot(m[8], m[9], m[10]);
}
