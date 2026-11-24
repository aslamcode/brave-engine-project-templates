import { Entity, MeshRenderer, Vector3 } from '@brave/core';
/** The renderer of the biggest thing an entity (and what is under it) is drawn with, by the size it has in the world; none when nothing is drawn. */
export declare function biggestRenderer(entity: Entity, best?: MeshRenderer): MeshRenderer | undefined;
/** The centre of what a renderer draws, in the world as it is now; none when it has no mesh. */
export declare function centerOf(renderer: MeshRenderer): Vector3 | undefined;
/** Whether an entity, or something under it, has a collider the player's look can land on: one that is on, and not a trigger (a ray goes through those). */
export declare function hasSolid(entity: Entity): boolean;
