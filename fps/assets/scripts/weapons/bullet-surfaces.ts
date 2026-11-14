import { AssetSystem, Collider } from '@brave/core';

/**
 * How much of each material a bullet can go through: the thickness, in metres, that a bullet of `Penetration` 1 still passes (a thinner wall costs it part of its damage, a thicker one stops it). The material is
 * the physics material of the collider it hits, by the name of its `.pmat` file (`plaster.pmat` is `plaster`). A collider with no physics material, or one that is not here (steel is not: nothing goes
 * through it), stops the bullet, as it always did. To change what a bullet goes through, change a number here or add a line for a physics material of your own.
 */
export const BULLET_SURFACES: Record<string, number> = {
  plaster: 0.3,
  wood: 0.2,
  cardboard: 0.6,
  glass: 0.06,
  plastic: 0.12,
  tile: 0.05,
  duct: 0.04,
  concrete: 0.08,
  mud: 0.3,
  dirt: 0.25,
  gravel: 0.25,
  sand: 0.4,
  ice: 0.25,
  water: 0.5,
  wade: 0.5,
  foliage: 1,
  chainlink: 2,
  metalgrate: 2,
};

/** The share of its damage a bullet keeps after it went through a body (times its weapon's `Penetration`): a shot can hurt what stands behind what it hurt. */
export const BODY_KEEPS = 0.4;

/** The thickness of the collider's material that a bullet of `Penetration` 1 can go through: 0 when it goes through none. */
export function stopThickness(collider: Collider): number {
  const id = collider.physicsMaterialId;
  if (!id) return 0;

  const name = AssetSystem.definitions.get(id)?.name?.replace(/\.pmat$/, '').toLowerCase();
  return (name ? BULLET_SURFACES[name] : 0) ?? 0;
}
