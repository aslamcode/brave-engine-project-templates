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
export declare function aimBoxOf(renderer: MeshRenderer): IAimBox | undefined;
/** The same box moved by `(x, y, z)`. */
export declare function shiftBox(box: IAimBox, x: number, y: number, z: number): IAimBox;
/** The same box, every side `margin` metres further out. */
export declare function growBox(box: IAimBox, margin: number): IAimBox;
/**
 * Where a ray from `origin` along `direction` (length 1) comes into the box, within `maxDistance`; none when it misses, when it is going away, or when it starts inside (someone standing in a doorway is not
 * looking at the door).
 */
export declare function rayThroughBox(origin: ArrayLike<number>, direction: ArrayLike<number>, box: IAimBox, maxDistance: number): IBoxCrossing | undefined;
