import { Entity, Signal } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Interactable } from '../interaction/interactable';
import type { Interactor } from '../interaction/interactor';
/**
 * Something the player takes: a box on the ground that gives something (`AmmoSupply`, `HealthSupply`) and is gone, or back after a while. It is an `Interactable`, so the player sees it as the rest of what can be used
 * (the glass box with E and what it gives, tied to it by a line, when it is looked at) and takes it with E. The entity has the drawing as children, `Visual` pointing at them (hidden while it is used up), a solid
 * Collider on the `Visual` for the player to look at (a ray goes through triggers), and its own sound (an Audio Source on this entity, Auto Play off) heard when it is taken. `Walk Over` also lets the player take it
 * by walking into the trigger Collider of this entity.
 *
 * It is the base the supplies build on: extend it and write `give()` to make your own kind (a key card, a grenade); what it returns is how much was given, and 0 means nothing was: the player is told it has
 * no use for it (full health), the click, and it stays. `promptAmount()` is what `{amount}` stands for in the prompt.
 *
 * ```ts
 * @Script({ inheritProperties: true })
 * export class Armor extends Supply {
 *   prompt = 'Take armour';
 *   protected give(player: Entity): number { return player.getComponent(Armour)?.add(25) ?? 0; }
 * }
 * ```
 */
export declare class Supply extends Interactable {
    visual?: Entity;
    respawnSeconds: number;
    message: string;
    fullMessage: string;
    walkOver: boolean;
    hud: Hud;
    /** It was taken: the entity that took it. */
    onTaken: Signal<Entity>;
    /** It is used up, until it respawns. In a save. */
    isTaken: boolean;
    /** Seconds until it respawns. A count in the frame, not a timer, so that a save made while it is gone brings it back. */
    private respawnLeft;
    onStart(): void;
    /** What E does: the prompt, with {amount} for what it gives. */
    get currentPrompt(): string;
    /** It can be used until it is taken (a used up supply is not marked, and E does nothing on it). */
    get usable(): boolean;
    /** E: the player takes it, or is told it has no use for it. */
    interact(interactor: Interactor): boolean;
    onUpdate(): void;
    onRestore(): void;
    onAfterClone(): void;
    /** Brings it back at once: drawn again and taken by the next one that walks in. */
    restock(): void;
    /** What it gives to the player (its entity): how much was given. 0 gives nothing and leaves it where it is. A kind of supply overrides this. */
    protected give(player: Entity): number;
    /** What `{amount}` stands for in the prompt: what it gives, as far as it is known before it is taken. */
    protected promptAmount(): number;
    private bind;
    private onEntered;
    private take;
    private playerOf;
    private show;
}
