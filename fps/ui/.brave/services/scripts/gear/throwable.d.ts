import { Entity } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Inventory } from '../../services/inventory.service';
import { Gear } from './gear';
/**
 * Something the player throws and has a number of: a grenade. The count is an item of the `Inventory` (`Item Id`: a `Pickup` of that id gives more, up to the `Limit`), so it is the same count
 * the rest of the game reads. The left mouse button winds up (`Wind-up`) and lets go: one is taken off the count, the `Projectile` prefab is made in front of the eyes and sent where the player
 * looks, a little above it, with the speed of the throw plus the body's own. What the projectile does after that is its own script (the `Grenade`); a prefab of another kind of thing (a flare,
 * a decoy) is a `Throwable` with another `Projectile`.
 *
 * The wind-up is lost when another gear is taken, or the player dies, before it ends: nothing is thrown and nothing is spent.
 */
export declare class Throwable extends Gear {
    label: string;
    slot: number;
    itemId: string;
    startingCount: number;
    limit: number;
    projectile: string;
    eyes: Entity;
    throwSound?: Entity;
    throwSpeed: number;
    lift: number;
    windUp: number;
    cooldown: number;
    hud: Hud;
    inventory: Inventory;
    /** Seconds until the grenade leaves the hand; 0 when none is being thrown. */
    windLeft: number;
    cooldownLeft: number;
    private warned;
    onStart(): void;
    onUpdate(): void;
    onRestore(): void;
    get caption(): string;
    prepare(): void;
    refill(): void;
    onBrought(): void;
    onPutAway(): void;
    showHud(): void;
    onPrimaryDown(): void;
    /** How many are carried. */
    get count(): number;
    private release;
    private onCountChange;
    private warnOnce;
}
