import { Entity, ScriptComponent, Signal, Vector3 } from '@brave/core';
/** What a blow carries. Every field is optional: a fall or a trap has no source, an explosion no zone. */
export interface IDamageInfo {
    /** The name of the part that was hit (`Hitbox.zone`: head, body, ...). */
    zone?: string;
    /** Where it landed, in the world. */
    point?: Vector3;
    /** Which way it was going, a unit vector: what a knock-back or a blood spurt follows. */
    direction?: Vector3;
    /** Who dealt it. */
    source?: Entity;
}
/** What `Health.onDamaged` and `Health.onDied` tell. */
export interface IDamageEvent extends IDamageInfo {
    /** What was really taken: a blow past zero takes only what there was left. */
    amount: number;
    /** What is left. */
    health: number;
}
/**
 * Something that can be hurt and die: the player, an enemy, a dummy. It only keeps the number and tells; what dying looks like is the business of whoever listens (`EnemyCube`, `PlayerHealth`).
 * A `Hitbox` on a collider below this entity says where on it a shot landed, and `Health.find()` is how a shot finds the one to hurt.
 */
export declare class Health extends ScriptComponent {
    /** The health of the thing the entity `hit` belongs to: the nearest `Health` on it or above it. A shot hits a collider on a child (a head, an arm) and the `Health` is on the root. */
    static find(entity?: Entity): Health | undefined;
    maximum: number;
    /** What is left. It starts at the maximum when the game does, and is not in the scene file: a save keeps it. */
    current: number;
    isDead: boolean;
    /** Told after any change of `current`, with the new value. */
    onChange: Signal<number>;
    onDamaged: Signal<IDamageEvent>;
    /** Told once, when a blow takes the last of it: after `onDamaged`, with the same event. */
    onDied: Signal<IDamageEvent>;
    onAwake(): void;
    /** Takes `amount` off (what `Hitbox.multiplier` already scaled). Returns what was really taken. Nothing happens to something that is dead. */
    damage(amount: number, info?: IDamageInfo): number;
    /** Gives health back, up to the maximum. Nothing for the dead: `revive()` is the way back. */
    heal(amount: number): void;
    /** Back from the dead with the maximum. */
    revive(): void;
}
