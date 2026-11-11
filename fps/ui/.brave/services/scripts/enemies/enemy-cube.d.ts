import { Entity, ScriptComponent } from '@brave/core';
/**
 * A cube that hunts the player. It waits until the player is within `Aggro Range` (or is shot, or is told to `hunt()`), then walks to the player over the navigation grid and hits it in reach, every
 * `Attack Interval` seconds. Its `Health` and the `Hitbox`es on its parts are separate components: the hits are the weapon's business, this only reacts to them (a squash, a sound, a fall).
 *
 * Why the navigation and not a plain steering: the level has walls and a doorway, and a cube that steers straight at the player would stand pressed against the house. `NavAgent` finds the way round and
 * through; with a Character Controller on the same entity it walks as the player does, solid against the level and the player, and needs no bake (it reads the colliders as the game runs).
 */
export declare class EnemyCube extends ScriptComponent {
    private static readonly SQUASH_STIFFNESS;
    private static readonly SQUASH_DAMPING;
    private static readonly FALL_SECONDS;
    private static readonly VANISH_SECONDS;
    target?: Entity;
    aggroRange: number;
    speed: number;
    attackRange: number;
    attackDamage: number;
    attackInterval: number;
    corpseSeconds: number;
    visual?: Entity;
    hitSound?: Entity;
    dieSound?: Entity;
    attackSound?: Entity;
    /** It is after its target. */
    isChasing: boolean;
    isDead: boolean;
    private health;
    private agent?;
    private attackLeft;
    private deadTime;
    private squash;
    private squashVelocity;
    onStart(): void;
    onRestore(): void;
    onUpdate(): void;
    private bind;
    /** Starts the hunt now, whatever the distance (a wave of enemies is told to at the spawn). */
    hunt(target?: Entity): void;
    private attack;
    private onHurt;
    private die;
    private animateSquash;
    private animateDeath;
    private remove;
    private distanceTo;
    private canReach;
    private findPlayer;
    private collidersBelow;
}
