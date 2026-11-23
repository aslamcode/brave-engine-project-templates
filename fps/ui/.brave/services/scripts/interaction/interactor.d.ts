import { AudioSource, IEntity, ScriptComponent, Signal } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Interactable } from './interactable';
/**
 * The player's side of interaction: put it on the player's eyes (the camera). Every frame a ray goes from the eyes along the look, `Reach` metres, ignoring the player's own body and everything
 * under it, and stops at the nearest thing it meets. From the collider it hit it walks up through the parents to the first entity that has an `Interactable`, and tells the `Hud` what `interact` does
 * on it (`hud.setPrompt`), or an empty line when there is nothing. The `interact` action (E by default, the pad's Y: the player can move it) uses it.
 *
 * Aiming at a small thing does not have to be exact. Three rules, in this order, and the first one is what keeps the aim precise:
 * 1. What the crosshair is on wins. A ray that lands on something that can be used is that thing, whatever else is near.
 * 2. Where it is on nothing to use (the floor beside a key, the air above it), a thing that has an `Aim Radius` is looked at when the ray passes within that radius of its centre; the one the aim is deepest
 *    in wins when two are in reach of it. A thing behind a wall is never looked at this way.
 * 3. A thing looked at through its `Aim Radius` stays looked at for `Aim Hold` seconds after the aim left it, so that a shaking hand does not make its box blink. It stays while the aim is within one and a half times
 *    its radius, and only a thing that has an `Aim Radius` is held at all.
 * `interact` uses what is looked at, so the box that is shown is what it does: nothing is used that the box does not say.
 *
 * It also tells the `Hud` which things that can be used are near and in sight (`Marker Range`, at most `Max Markers`, the nearest first), where on the screen, so the page can mark them: the one looked at gets a
 * glass box with what `interact` does (tied to the thing by a line, or on it, by the `Marker` of its Interactable), the others a small mark. The mark nearest to where the player looks, within `Peek Angle`, says its
 * name next to it (what a thing is can be learned without aiming at it exactly; a door has no name to give, a pickup has its item's). The point on the screen comes from the camera on this entity (the eyes)
 * and the anchor of each thing (the centre of what it is drawn with, and its `Marker Height`); a thing behind a wall is not marked.
 *
 * It does nothing while the game is paused or when the entity it is on is off (the other one of two players, say).
 *
 * It also has the sound of the player's side of an interaction: what is heard from the player, not from the thing used (the pickup's: the item's entity is switched off when it is taken, and
 * takes its own Audio Source with it), and the dull click of a use that cannot be done (`deny()`). Give it an Audio Source with Spatial off.
 */
export declare class Interactor extends ScriptComponent {
    reach: number;
    lookDistance: number;
    body?: IEntity;
    aimHold: number;
    audio?: AudioSource;
    denySound: string;
    pitchVariation: number;
    markerRange: number;
    maxMarkers: number;
    peekAngle: number;
    hud: Hud;
    /** What the player is looking at and can use now, or nothing. */
    target?: Interactable;
    /** The target changed: the new one, or undefined when the player looks at nothing that can be used. */
    onTargetChange: Signal<Interactable>;
    private key?;
    private readonly origin;
    private readonly direction;
    private readonly toward;
    private candidates;
    private sinceScan;
    private held?;
    private lostFor;
    private peeked?;
    onStart(): void;
    onRestore(): void;
    onUpdate(): void;
    onDisable(): void;
    onDestroy(): void;
    onAfterClone(): void;
    /** The `interact` action: uses what the player looks at. Returns whether anything was used. */
    use(): boolean;
    /** A use that cannot be done: the dull click, and a line on the screen when there is something to say. */
    deny(message?: string): void;
    /** Plays a clip from the player (an Audio Source on this entity, Spatial off). */
    play(clip: string): void;
    private listen;
    private aim;
    private hold;
    private interactableAbove;
    private helped;
    private linger;
    private stillThere;
    private zoneOf;
    private mark;
    private nearness;
    private isBehindSomething;
    private anchorOf;
    private aimPointOf;
    private candidateOf;
    private refresh;
    private watch;
    private forget;
    private root;
    private get running();
}
