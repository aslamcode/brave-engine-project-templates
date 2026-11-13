import { IEntity, Signal, Vector3 } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Inventory } from '../../services/inventory.service';
import { Journal } from '../../services/journal.service';
import { Interactable } from './interactable';
import type { Interactor } from './interactor';
export type DoorMode = 'rotate' | 'slide';
export type DoorEasing = 'linear' | 'smooth' | 'ease-in' | 'ease-out';
/** Which sides a hinged door opens from: either, always swinging the same way; either, swinging away from whoever opens it; only the side it swings away from. */
export type DoorSides = 'fixed' | 'both' | 'front';
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
 * Sides: a hinged door swings the way `Amount` says (turn its sign to swing it the other way), and `Opens From` says who may open it: `Either side, one swing` (the default: the door always swings
 * the same way, so from the far side it swings TOWARDS the player), `Either side, away from the player` (it swings away from whoever opens it: a door in a corridor) or `Front side only` (only
 * from the side it swings away from; the other side is refused, a door to a room that is entered from one side). Which side the player is on is measured from the hinge and the place of the panel (the
 * biggest thing the leaf is drawn with), so the leaf needs a mesh for the last two. A door that is open is closed from either side, and a script (`open()`, a Socket, a Director) opens it whatever the side.
 *
 * Locked: a locked door refuses E (the locked sound, `Locked Message`, `onLocked`) unless the player carries `Key Item` (then the bolt slides: the unlock sound, `onUnlocked`, and a moment later
 * the door opens; the key is taken out of the inventory unless `Use Up Key` is off: the Journal still lists it, as used). The prompt says what is missing (`Needs Prompt`: "Needs key"), and a lock that
 * asks for several things (`piece-1, piece-2, piece-3`, or `fuse x3`) says how far the player is ("Needs piece 3 (2 of 3)"). With no `Key Item` only a script unlocks it: `unlock()`, which a `Socket` or a Director calls.
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
    sides: DoorSides;
    duration: number;
    easing: DoorEasing;
    leaf?: IEntity;
    startsOpen: boolean;
    locked: boolean;
    keyItemId: string;
    consumesKey: boolean;
    closePrompt: string;
    lockedPrompt: string;
    needsPrompt: string;
    unlockPrompt: string;
    lockedMessage: string;
    wrongSidePrompt: string;
    wrongSideMessage: string;
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
    protected sidesOptions: {
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
    private hinge?;
    private normal?;
    private swing;
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
    promptFor(interactor: Interactor): string;
    protected onUse(interactor: Interactor): void;
    /** It is open, or on its way to be: what the prompt and a Director's condition go by. */
    get isOpen(): boolean;
    get isLocked(): boolean;
    /** It is between closed and open. */
    get isMoving(): boolean;
    private get requirement();
    private get keyProgress();
    private get canUnlock();
    private get mover();
    private arrived;
    private capture;
    private measureSides;
    private sideOf;
    private refusedFrom;
    private chooseSwing;
    private place;
    private eased;
}
