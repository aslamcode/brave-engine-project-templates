import { AudioSource, IEntity, ScriptComponent, Signal } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Interactable } from './interactable';
/**
 * The player's side of interaction: put it on the player's eyes (the camera). Every frame a ray goes from the eyes along the look, `Reach` metres, ignoring the player's own body and everything
 * under it, and stops at the nearest thing it meets. From the collider it hit it walks up through the parents to the first entity that has an `Interactable`, and tells the `Hud` what E does
 * on it (`hud.setPrompt`), or an empty line when there is nothing. E (`Input.keyboard.keyE`) uses it.
 *
 * It does nothing while the game is paused or when the entity it is on is off (the other one of two players, say).
 *
 * It also has the sound of the player's side of an interaction: what is heard from the player, not from the thing used (the pickup's: the item's entity is switched off when it is taken, and
 * takes its own Audio Source with it), and the dull click of a use that cannot be done (`deny()`). Give it an Audio Source with Spatial off.
 */
export declare class Interactor extends ScriptComponent {
    reach: number;
    body?: IEntity;
    audio?: AudioSource;
    denySound: string;
    pitchVariation: number;
    hud: Hud;
    /** What the player is looking at and can use now, or nothing. */
    target?: Interactable;
    /** The target changed: the new one, or undefined when the player looks at nothing that can be used. */
    onTargetChange: Signal<Interactable>;
    private key?;
    private readonly origin;
    private readonly direction;
    onStart(): void;
    onRestore(): void;
    onUpdate(): void;
    onDisable(): void;
    onDestroy(): void;
    onAfterClone(): void;
    /** E: uses what the player looks at. Returns whether anything was used. */
    use(): boolean;
    /** A use that cannot be done: the dull click, and a line on the screen when there is something to say. */
    deny(message?: string): void;
    /** Plays a clip from the player (an Audio Source on this entity, Spatial off). */
    play(clip: string): void;
    private listen;
    private look;
    private watch;
    private root;
    private get running();
}
