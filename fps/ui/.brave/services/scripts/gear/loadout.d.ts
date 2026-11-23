import { Entity, InputDeviceEnum, ScriptComponent, Signal } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Journal } from '../../services/journal.service';
import { PauseMenu } from '../../services/pause-menu.service';
import { Gear } from './gear';
/**
 * What the first person player carries in hand: the gear under the entity in the right hand (`Gear`, one on each child), which one is in hand, and the controls that change it. They are actions of the
 * project (`project.json`, Project Settings > Input), so the player can move them: `slot-1` to `slot-9` (the keys 1 to 9, and the D-pad for the first four) take a gear in hand, `next-weapon` and
 * `previous-weapon` (the mouse wheel, the shoulder buttons) go through them, the control of the gear in hand puts it away, and `fire`, `aim` and `reload` are passed on to the gear in hand (its hooks, and
 * the signals below for everything else that listens: the `Weapon` fires a `Firearm` from them). It lives on the `Player` entity, next to the `FirstPersonArms` that holds the gear and the `Health` it asks
 * whether the player is alive; it only reads them.
 *
 * A slot takes a gear in hand: the arms go back to the body, the model changes, and the arms come out again (`Equip Time` twice); the slot of the gear in hand puts it away. The HUD is told the list of
 * what is carried and which is in hand; what each gear shows of itself (its crosshair, its count) is its own `showHud()`.
 */
export declare class Loadout extends ScriptComponent {
    holder: Entity;
    startEquipped: boolean;
    fireWithoutLock: boolean;
    hud: Hud;
    journal: Journal;
    pauseMenu: PauseMenu;
    /** The slot of the gear in hand, or of the one being raised: 0 until the first is taken. */
    slot: number;
    /** A gear was brought out: the one the player now holds, or is raising. */
    onSwitch: Signal<Gear>;
    /** The `fire` action went down while the gear in hand could be used. */
    onPrimaryDown: Signal<any>;
    onPrimaryUp: Signal<any>;
    /** The `aim` action went down with the pointer held (the gear is not asked whether it is ready: a button held while the arms come up still counts). */
    onSecondaryDown: Signal<any>;
    onSecondaryUp: Signal<any>;
    /** The `reload` action was pressed while the gear in hand could be used. */
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
    /** Whether the arms are down to bring out another gear: the gear in hand is still the old one until they are at the body. A put-away is not a change (no gear is waiting). */
    get isChanging(): boolean;
    /** Whether the gear may be used: its owner on (a character that is switched off still hears the mouse, and must not act from where it stands), in hand, alive, the game running. A game that stuns the player does it here. */
    isReady(): boolean;
    /** The list of what is carried is written again: a gear's caption changed (a grenade was used or found). */
    refresh(): void;
    /**
     * Whether the controls of the mouse count: the game holds the pointer (the click that locks it is not a shot), or the player is on a pad, which never needed it (a pause menu closed from the pad has
     * no click to give the pointer back) while the game runs with no menu in front: the unlocked pointer is what keeps a mouse's shots out of a menu, and a menu that does not pause the game (`pausesGame` off)
     * has to keep a pad's out as well. `device` is the family of the control that was pressed; without one, the one the player used last.
     */
    holdsPointer(device?: InputDeviceEnum): boolean;
    /** Every gear holds its full amount again (the player is back from the dead), and the gear in hand tells the HUD. */
    refill(): void;
    private isPlaying;
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
    private takeInHand;
    private collect;
    private bind;
    private isInHolder;
    private listen;
    private cancelListen;
}
