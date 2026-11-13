import { Entity, IRaycastHit, ScriptComponent, Signal, Vector3 } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Firearm } from './firearm';
/** One shot on its way: where it starts, which way it goes, what is left of its damage and of its reach. `Weapon.onBulletHit()` is where a bullet that goes on after a hit would be handled. */
export interface IBullet {
    origin: Vector3;
    direction: Vector3;
    damage: number;
    range: number;
}
/**
 * What the first person player does with a weapon: the left mouse fires, R reloads, the right mouse aims, the keys 1 to 9 and the wheel take a weapon in hand, and the shot is a ray from the camera. It lives
 * on the `Player` entity, next to the `Health`, the `WeaponStance` that poses the weapon and the `FirstPersonArms` that holds it; it only reads them. The weapons themselves are the `Firearm`s under the
 * `Weapons` entity in the right hand: their numbers, their parts and the rounds each one holds are theirs, and this fires whichever is in hand.
 *
 * A key takes a weapon in hand: the arms go back to the body, the model changes, and the arms come out again (`Equip Time` twice); the key of the weapon in hand puts it away. A hit finds the `Health` above the
 * collider it hit (`Health.find()`), scales the damage by the `Hitbox` of that collider (`zone`, `multiplier`) and tells the HUD. What a hit on scenery does (a mark on the wall) and what a bullet does after
 * a hit are in `onBulletHit()`: the rest of the script never asks what a shot hit.
 *
 * Reloading is a timeline in game time (`reloadProgress`, 0 to 1) that the sounds are cued on and that `WeaponStance` poses the arms from; the rounds are added at the end. It is cancelled when the weapon is
 * put away or changed, or the player dies, and a shot cannot be fired while it lasts. With `Auto Reload` on it begins by itself when the magazine runs empty. Aiming (`aim`, 0 to 1) narrows the field of view, closes the spread and brings the weapon to the eye; it ends with a
 * sprint, a reload, a switch.
 */
export declare class Weapon extends ScriptComponent {
    private static readonly RELOAD_CUE_TIMES;
    private static readonly PROBES;
    private static readonly PROBE_RING;
    private static readonly SHELL_LAYER;
    eyes: Entity;
    holder: Entity;
    startEquipped: boolean;
    autoReload: boolean;
    fireWithoutLock: boolean;
    hud: Hud;
    /** A reload is going on, and how far (0 to 1) it is. */
    isReloading: boolean;
    reloadProgress: number;
    /** The slot of the weapon in hand, or of the one being raised: 0 until the first is taken. */
    slot: number;
    /** The half angle of the cone the next shot goes in, in degrees. */
    spread: number;
    /** A shot was fired (and the round taken out). */
    onFire: Signal<IBullet>;
    /** The trigger was pulled on an empty magazine. */
    onDryFire: Signal<any>;
    onReloadStart: Signal<any>;
    /** The rounds are in. Not told for a reload that was cancelled. */
    onReloadEnd: Signal<any>;
    /** A weapon was brought out: the one the player now holds, or is raising. */
    onSwitch: Signal<Firearm>;
    /** The player began to aim. */
    onAimStart: Signal<any>;
    private cache?;
    private bulletMask?;
    private arms?;
    private health?;
    private body?;
    private movement?;
    private camera?;
    private eyesCamera?;
    private leftHand?;
    private clock;
    private nextShotAt;
    private triggerHeld;
    private aimHeld;
    private tookInHand;
    private flashLeft;
    private pending?;
    private aimRaw;
    private baseFieldOfView;
    private baseSensitivity;
    private readonly rifleSpring;
    private readonly viewSpring;
    private reloadCue;
    private listeners;
    onAwake(): void;
    onStart(): void;
    onEnable(): void;
    onUpdate(): void;
    onDestroy(): void;
    onAfterClone(): void;
    onRestore(): void;
    /** The weapons the player carries, in the order of their slots. */
    get firearms(): readonly Firearm[];
    /** The weapon in hand, or the one being raised. */
    get current(): Firearm | undefined;
    /** Rounds in the magazine and in reserve, of the weapon in hand. */
    get ammo(): number;
    get reserve(): number;
    /** How hard the weapon is kicked: 1 right after a shot, then back to 0. `WeaponStance` poses it from it. */
    get recoil(): number;
    /** How near the weapon is to the eye: 0 not aiming, 1 aiming (eased). */
    get aim(): number;
    get isAiming(): boolean;
    /** The body runs on the ground: the weapon goes down, and nothing can be aimed. */
    get isSprinting(): boolean;
    /** One shot, if the weapon is ready, is not being reloaded and has a round: the round goes, the bullet flies, the weapon kicks. Returns whether it fired. */
    fire(): boolean;
    /** Starts a reload, if there is something to reload and room for it. Returns whether it began. */
    reload(): boolean;
    /** Puts `rounds` in the reserve of the weapon of `slot` (0: the one in hand), up to its `Reserve Limit`. Returns how many went in: 0 for a weapon that is not carried or has no room. */
    give(rounds: number, slot?: number): number;
    /** Gives every weapon its magazine and its reserve back in full (the player is back from the dead). */
    refill(): void;
    /** Takes the weapon of a slot in hand: from the body, the arms come out with it; from another weapon, the arms go back first; the key of the weapon in hand puts it away. Returns whether the slot has a weapon. */
    select(slot: number): boolean;
    /** The next weapon (1) or the one before (-1), by slot, never putting one away: with none in hand it takes one out. */
    cycle(step: number): boolean;
    /** Whether the weapon may be used: its owner on (a character that is switched off still hears the mouse, and must not shoot from where it stands), in hand, alive, the game running. A game that stuns the player does it here. */
    isReady(): boolean;
    private canChange;
    private drawTo;
    private changeWeapon;
    private bring;
    private showHud;
    private makeBullet;
    private updateTarget;
    private hurtsAlong;
    private scatter;
    private fireBullet;
    /** What a bullet does to what it hit. Returns the damage it still has: 0, it stops. */
    protected onBulletHit(hit: IRaycastHit, bullet: IBullet): number;
    private hurt;
    private markScenery;
    private pullTrigger;
    private reloadWhenEmpty;
    private updateReload;
    private cancelReload;
    private updateAim;
    private updateSpread;
    private showSpread;
    private updateRecoil;
    private flash;
    private updateFlash;
    private takeInHand;
    private collect;
    private bind;
    private isInHolder;
    private listen;
    private cancelListen;
    private onTriggerDown;
    private showAmmo;
}
