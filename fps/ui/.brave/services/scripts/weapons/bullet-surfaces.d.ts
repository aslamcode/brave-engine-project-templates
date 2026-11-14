import { Collider } from '@brave/core';
/**
 * How much of each material a bullet can go through: the thickness, in metres, that a bullet of `Penetration` 1 still passes (a thinner wall costs it part of its damage, a thicker one stops it). The material is
 * the physics material of the collider it hits, by the name of its `.pmat` file (`plaster.pmat` is `plaster`). A collider with no physics material, or one that is not here (steel is not: nothing goes
 * through it), stops the bullet, as it always did. To change what a bullet goes through, change a number here or add a line for a physics material of your own.
 */
export declare const BULLET_SURFACES: Record<string, number>;
/** The share of its damage a bullet keeps after it went through a body (times its weapon's `Penetration`): a shot can hurt what stands behind what it hurt. */
export declare const BODY_KEEPS = 0.4;
/** The thickness of the collider's material that a bullet of `Penetration` 1 can go through: 0 when it goes through none. */
export declare function stopThickness(collider: Collider): number;
