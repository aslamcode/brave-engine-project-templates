import { Entity, ScriptComponent } from '@brave/core';
import { Hud } from '../../services/hud.service';
/**
 * How the character carries the weapon, as poses of the point the right hand reaches (`Hold Right`) and of the one the left hand reaches (the `Grip Left` of the weapon in hand): the locomotion animations are
 * the character's own and are not touched, the weapon and the arms go where the IK targets go.
 *
 * Two stances. **Alert** is the pose `Hold Right` was authored in: the weapon at the shoulder (it is how the character stands). **Relaxed** is that pose moved down and back and the
 * barrel tilted down: the weapon at the hip. **Aiming** (the right mouse button, `Weapon.aim`) moves the weapon from the alert pose to the eye by the `Aim` numbers of its `Firearm`. A shot (or a reload) makes the character alert and keeps it so for `Alert Seconds` of game time after the last one, as long as the weapon is in the hands (put away, or with another kind of gear in them, it is relaxed at once); then it goes back to relaxed, slowly. Running
 * lowers the rifle like a sprint does (`Lower When Running`), except in the moment after a shot.
 *
 * On top of the stance come the kick of every shot (`Weapon.recoil`: the rifle back, up and tilted up) and the reload (`Weapon.reloadProgress`: the rifle dips and rolls, the left hand goes down and back
 * for the magazine and returns). All of it is written as an offset from the authored pose in the chest's own axes (so it follows the lean of the spine with the look), every frame from scratch: nothing
 * accumulates, and `Weapon Retreat`, which pulls `Hold Right` back from a wall after this has run, sees the pose it should start from.
 */
export declare class WeaponStance extends ScriptComponent {
    private static readonly SHOT_HOLD_SECONDS;
    private static readonly RELOAD_EASE;
    private static readonly LEFT_HAND_PATH;
    private static readonly scratch;
    hold: Entity;
    eyes: Entity;
    alertSeconds: number;
    lowerWhenRunning: boolean;
    raiseTime: number;
    lowerTime: number;
    relaxedLower: number;
    relaxedBack: number;
    relaxedSide: number;
    relaxedTilt: number;
    relaxedTurn: number;
    kickBack: number;
    kickUp: number;
    kickTilt: number;
    reloadDip: number;
    reloadTilt: number;
    reloadRoll: number;
    hud: Hud;
    /** The character is alert: it shot or reloaded within `Alert Seconds`. */
    isAlert: boolean;
    /** Seconds of alert left. */
    alertLeft: number;
    /** How far the rifle is from the alert pose (0) to the relaxed one (1). */
    relaxed: number;
    private authoredHold;
    private axes;
    private weapon?;
    private loadout?;
    private body?;
    private movement?;
    private clock;
    private shotHoldUntil;
    private readonly position;
    private readonly rotation;
    private readonly baseRotation;
    private readonly axis;
    onStart(): void;
    onUpdate(): void;
    onRestore(): void;
    onEnable(): void;
    /** The character is alert from now, for `Alert Seconds`. */
    raise(): void;
    private updateAlert;
    private endAlert;
    private wantedRelaxed;
    private isSprinting;
    private follow;
    private pose;
    private poseLeftHand;
    private reloadEnvelope;
    private static leftHandAt;
    private measure;
    private measureGrips;
    private loadRotation;
    private bind;
    private onShot;
}
