import { Entity, ScriptComponent } from '@brave/core';
import { Hud } from '../../services/hud.service';
/**
 * How the character carries the rifle, as poses of the point the right hand reaches (`Hold Right`) and of the one the left hand reaches (`Grip Left`): the locomotion animations are the character's own and
 * are not touched, the weapon and the arms go where the IK targets go.
 *
 * Two stances. **Alert** is the pose `Hold Right` was authored in: the rifle at the shoulder (not aiming down the sights: it is how the character stands). **Relaxed** is that pose moved down and back and the
 * barrel tilted down: the rifle at the hip. A shot (or a reload) makes the character alert and keeps it so for `Alert Seconds` of game time after the last one; then it goes back to relaxed, slowly. Running
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
    gripLeft?: Entity;
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
    private authoredGrip;
    private axes;
    private weapon?;
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
    /** The character is alert from now, for `Alert Seconds`. */
    raise(): void;
    private updateAlert;
    private wantedRelaxed;
    private isSprinting;
    private follow;
    private pose;
    private poseLeftHand;
    private reloadEnvelope;
    private static leftHandAt;
    private measure;
    private loadRotation;
    private bind;
    private onShot;
}
