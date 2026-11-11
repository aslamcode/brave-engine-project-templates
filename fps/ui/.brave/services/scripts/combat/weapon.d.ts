import { Entity, IRaycastHit, ScriptComponent, Signal, Vector3 } from '@brave/core';
import { Hud } from '../../services/hud.service';
/** One shot on its way: where it starts, which way it goes, what is left of its damage and of its reach. `Weapon.onBulletHit()` is where a bullet that goes on after a hit would be handled. */
export interface IBullet {
    origin: Vector3;
    direction: Vector3;
    damage: number;
    range: number;
}
/**
 * The rifle of the first person player: the left mouse fires, R reloads, the shot is a ray from the camera. It lives on the `Player` entity, next to the `Health`, the `WeaponStance` that poses the
 * rifle and the `FirstPersonArms` that holds it; it only reads them.
 *
 * A hit finds the `Health` above the collider it hit (`Health.find()`), scales the damage by the `Hitbox` of that collider (`zone`, `multiplier`) and tells the HUD. What a hit on scenery does (a mark on
 * the wall) and what a bullet does after a hit are in `onBulletHit()`: the rest of the script never asks what a shot hit.
 *
 * Reloading is a timeline in game time (`reloadProgress`, 0 to 1) that the sounds are cued on and that `WeaponStance` poses the arms from; the rounds are added at the end. It is cancelled when the weapon
 * is put away (`1`) or the player dies, and a shot cannot be fired while it lasts.
 */
export declare class Weapon extends ScriptComponent {
    private static readonly RELOAD_CUE_TIMES;
    eyes: Entity;
    muzzle?: Entity;
    shotSound?: Entity;
    dryFireSound?: Entity;
    magazineOutSound?: Entity;
    magazineInSound?: Entity;
    boltSound?: Entity;
    automatic: boolean;
    roundsPerMinute: number;
    damage: number;
    range: number;
    spreadStill: number;
    spreadMoving: number;
    spreadAir: number;
    spreadTime: number;
    magazineSize: number;
    startingReserve: number;
    reloadTime: number;
    cameraKick: number;
    flashSeconds: number;
    fireWithoutLock: boolean;
    hud: Hud;
    /** Rounds in the magazine and in reserve. In a save, not in the scene file. */
    ammo: number;
    reserve: number;
    /** A reload is going on, and how far (0 to 1) it is. */
    isReloading: boolean;
    reloadProgress: number;
    /** The half angle of the cone the next shot goes in, in degrees. */
    spread: number;
    /** A shot was fired (and the round taken out). */
    onFire: Signal<IBullet>;
    /** The trigger was pulled on an empty magazine. */
    onDryFire: Signal<any>;
    onReloadStart: Signal<any>;
    /** The rounds are in. Not told for a reload that was cancelled. */
    onReloadEnd: Signal<any>;
    private arms?;
    private health?;
    private body?;
    private movement?;
    private camera?;
    private clock;
    private nextShotAt;
    private triggerHeld;
    private tookInHand;
    private flashLeft;
    private readonly rifleSpring;
    private readonly viewSpring;
    private reloadCue;
    private listeners;
    onAwake(): void;
    onStart(): void;
    onUpdate(): void;
    onDestroy(): void;
    onAfterClone(): void;
    onRestore(): void;
    /** How hard the rifle is kicked: 1 right after a shot, then back to 0. `WeaponStance` poses the rifle from it. */
    get recoil(): number;
    /** One shot, if the weapon is ready, is not being reloaded and has a round: the round goes, the bullet flies, the rifle kicks. Returns whether it fired. */
    fire(): boolean;
    /** Starts a reload, if there is something to reload and room for it. Returns whether it began. */
    reload(): boolean;
    /** Gives the magazine and the reserve back in full (the player is back from the dead). */
    refill(): void;
    /** Whether the weapon may be used: in hand, its owner alive, the game running. A game that stuns the player does it here. */
    isReady(): boolean;
    private makeBullet;
    private scatter;
    private fireBullet;
    /** What a bullet does to what it hit. Returns the damage it still has: 0, it stops. */
    protected onBulletHit(hit: IRaycastHit, bullet: IBullet): number;
    private hurt;
    private markScenery;
    private pullTrigger;
    private updateReload;
    private cancelReload;
    private updateSpread;
    private updateRecoil;
    private flash;
    private updateFlash;
    private takeInHand;
    private bind;
    private listen;
    private cancelListen;
    private onTriggerDown;
    private showAmmo;
}
