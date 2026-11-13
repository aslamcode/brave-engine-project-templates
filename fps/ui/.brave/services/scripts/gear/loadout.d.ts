import { Entity, ScriptComponent, Signal } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Gear } from './gear';
/**
 * What the first person player carries in hand: the gear under the entity in the right hand (`Gear`, one on each child), which one is in hand, and the keys that change it. The keys 1 to 9 and the mouse
 * wheel take a gear in hand, the key of the gear in hand puts it away, and the mouse and R are passed on to the gear in hand (its hooks, and the signals below for everything else that listens: the `Weapon`
 * fires a `Firearm` from them). It lives on the `Player` entity, next to the `FirstPersonArms` that holds the gear and the `Health` it asks whether the player is alive; it only reads them.
 *
 * A key takes a gear in hand: the arms go back to the body, the model changes, and the arms come out again (`Equip Time` twice); the key of the gear in hand puts it away. The HUD is told the list of
 * what is carried and which is in hand; what each gear shows of itself (its crosshair, its count) is its own `showHud()`.
 */
export declare class Loadout extends ScriptComponent {
    holder: Entity;
    startEquipped: boolean;
    fireWithoutLock: boolean;
    hud: Hud;
    /** The slot of the gear in hand, or of the one being raised: 0 until the first is taken. */
    slot: number;
    /** A gear was brought out: the one the player now holds, or is raising. */
    onSwitch: Signal<Gear>;
    /** The left mouse button went down while the gear in hand could be used. */
    onPrimaryDown: Signal<any>;
    onPrimaryUp: Signal<any>;
    /** The right mouse button went down with the pointer held (the gear is not asked whether it is ready: a button held while the arms come up still counts). */
    onSecondaryDown: Signal<any>;
    onSecondaryUp: Signal<any>;
    /** R was pressed while the gear in hand could be used. */
    onReload: Signal<any>;
    /** The player is back from the dead: every gear was refilled. */
    onRefill: Signal<any>;
    private cache?;
    private arms?;
    private health?;
    private leftHand?;
    private tookInHand;
    private pending?;
    private listeners;
    onAwake(): void;
    onStart(): void;
    onEnable(): void;
    onUpdate(): void;
    onDestroy(): void;
    onAfterClone(): void;
    onRestore(): void;
    /** The gear the player carries, in the order of their slots. */
    get gear(): readonly Gear[];
    /** The gear in hand, or the one being raised. */
    get current(): Gear | undefined;
    /** Takes the gear of a slot in hand: from the body, the arms come out with it; from another gear, the arms go back first; the key of the gear in hand puts it away. Returns whether the slot has a gear. */
    select(slot: number): boolean;
    /** The next gear (1) or the one before (-1), by slot, never putting one away: with none in hand it takes one out. */
    cycle(step: number): boolean;
    /** Whether the arms hold the gear, or are raising it: false with the hands free, and while the arms go down to change it. Until the first frame (and the first after a load) has taken the gear in hand it is true when it is going to be. */
    get isHolding(): boolean;
    /** Whether the gear may be used: its owner on (a character that is switched off still hears the mouse, and must not act from where it stands), in hand, alive, the game running. A game that stuns the player does it here. */
    isReady(): boolean;
    /** The list of what is carried is written again: a gear's caption changed (a grenade was used or found). */
    refresh(): void;
    /** Every gear holds its full amount again (the player is back from the dead), and the gear in hand tells the HUD. */
    refill(): void;
    private canChange;
    private drawTo;
    private changeGear;
    private bring;
    private show;
    private showHud;
    private pressPrimary;
    private releasePrimary;
    private pressSecondary;
    private releaseSecondary;
    private pressReload;
    private hasPointer;
    private takeInHand;
    private collect;
    private bind;
    private isInHolder;
    private listen;
    private cancelListen;
}
