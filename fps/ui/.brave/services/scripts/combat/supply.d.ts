import { Entity, ScriptComponent, Signal } from '@brave/core';
import { Hud } from '../../services/hud.service';
/**
 * Something the player takes by walking into it: a box on the ground that gives something (`AmmoSupply`, `HealthSupply`) and is gone, or back after a while. The entity has a trigger collider (the
 * space to walk into) and, as children, what it is drawn with; this hides `Visual` while it is used up. Its own sound (an Audio Source on this entity, Auto Play off) is heard when it is taken.
 *
 * It is the base the supplies build on: extend it and write `give()` to make your own kind (a key card, a grenade); what it returns is how much was given, and 0 means nothing was, so the player
 * walks over a supply it has no use for (full health) and it stays.
 *
 * ```ts
 * @Script({ inheritProperties: true })
 * export class Armor extends Supply {
 *   protected give(player: Entity): number { return player.getComponent(Armour)?.add(25) ?? 0; }
 * }
 * ```
 */
export declare class Supply extends ScriptComponent {
    visual?: Entity;
    respawnSeconds: number;
    message: string;
    hud: Hud;
    /** It was taken: the entity that took it. */
    onTaken: Signal<Entity>;
    /** It is used up, until it respawns. In a save. */
    isTaken: boolean;
    /** Seconds until it respawns. A count in the frame, not a timer, so that a save made while it is gone brings it back. */
    private respawnLeft;
    onStart(): void;
    onUpdate(): void;
    onRestore(): void;
    onAfterClone(): void;
    /** Brings it back at once: drawn again and taken by the next one that walks in. */
    restock(): void;
    /** What it gives to the one that walked in (the player's entity): how much was given. 0 gives nothing and leaves it where it is. A kind of supply overrides this. */
    protected give(player: Entity): number;
    private bind;
    private onEntered;
    private playerOf;
    private show;
}
