import { IEntity, Signal, Vector3 } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Inventory } from '../../services/inventory.service';
import { Journal } from '../../services/journal.service';
import { Interactable } from './interactable';
export type DoorMode = 'rotate' | 'slide';
export type DoorEasing = 'linear' | 'smooth' | 'ease-in' | 'ease-out';
/**
 * A door, or anything that moves out of the way and back: a hinged door TURNS about an axis, a drawer, a shutter or a gate SLIDES along one. One script for both: `Mode` says which, `Axis` the
 * line it turns about or the way it slides, `Amount` how far (degrees or metres), `Duration` how long, `Easing` how it speeds up and slows down. E toggles it, and a door in the middle of a swing
 * goes back from where it is.
 *
 * ```
 * Front Door          <- this script (and the Audio Source of its sounds). Put it where the hinge is, or where the slide starts.
 *   Front Door Leaf   <- the part that MOVES (Leaf). A Rigid Body of type Kinematic (Interpolate off) is what makes the colliders move with it.
 *     Front Door Panel   <- the mesh, and a Collider: a closed door blocks the player because the collider is where the panel is.
 * ```
 *
 * The leaf's origin is the hinge, so the panel hangs off it (a child, a half-width to the side). The pose the leaf has in the scene is its CLOSED pose; `Starts Open` puts it open when the game
 * starts. With no `Leaf` set, the moving part is this entity itself.
 *
 * Locked: a locked door refuses E (the locked sound, `Locked Message`, `onLocked`) unless the player carries `Key Item` (then the bolt slides: the unlock sound, `onUnlocked`, and a moment later
 * the door opens; the key stays in the inventory). With no `Key Item` only a script unlocks it: `unlock()`, which a `Socket` or a Director calls.
 *
 * What a Director or another script can use: `@State()` `isOpen` (it is open, or on its way to be) and `isLocked`; `@Callable()` `open()`, `close()`, `toggle()`, `lock()`, `unlock()` (these do not
 * ask for the key: a script that opens a locked door opens it); `Signal`s `onOpened` and `onClosed` (when the movement is finished), `onLocked` (the player tried it) and `onUnlocked`.
 *
 * Sounds are the four fields of the Sounds group, played through the Audio Source (see `Interactable`). A rotating door's close sound is the latch, so by default it is played when the door
 * SHUTS (`Close Sound When Shut`); a drawer's is a slide, played as it starts to go.
 */
export declare class Door extends Interactable {
    prompt: string;
    mode: DoorMode;
    axis: Vector3;
    amount: number;
    duration: number;
    easing: DoorEasing;
    leaf?: IEntity;
    startsOpen: boolean;
    locked: boolean;
    keyItemId: string;
    closePrompt: string;
    lockedPrompt: string;
    unlockPrompt: string;
    lockedMessage: string;
    openSound: string;
    closeSound: string;
    lockedSound: string;
    unlockSound: string;
    unlockDelay: number;
    closeSoundWhenShut: boolean;
    inventory: Inventory;
    journal: Journal;
    hud: Hud;
    /** The movement to open is finished. */
    onOpened: Signal<any>;
    /** The movement to close is finished. */
    onClosed: Signal<any>;
    /** The player tried it locked, and could not. */
    onLocked: Signal<any>;
    /** It was unlocked, by its key or by a script. */
    onUnlocked: Signal<any>;
    /** 0 closed, 1 open, in between while it moves (before the easing). */
    progress: number;
    protected modeOptions: {
        value: string;
        description: string;
    }[];
    protected easingOptions: {
        value: string;
        description: string;
    }[];
    private wantsOpen;
    private closedPosition?;
    private closedRotation?;
    private unlockTimer?;
    onStart(): void;
    onUpdate(): void;
    onDestroy(): void;
    onAfterClone(): void;
    open(): void;
    close(): void;
    toggle(): void;
    lock(): void;
    unlock(): void;
    get currentPrompt(): string;
    protected onUse(): void;
    /** It is open, or on its way to be: what the prompt and a Director's condition go by. */
    get isOpen(): boolean;
    get isLocked(): boolean;
    /** It is between closed and open. */
    get isMoving(): boolean;
    private get canUnlock();
    private get mover();
    private arrived;
    private capture;
    private place;
    private eased;
}
