import { Entity, ScriptComponent } from '@brave/core';
/**
 * A target for practice: it does not move or hit back, it squashes when it is shot, falls over when it dies and stands up again `Stand Up After` seconds later with full health. The hit zones are
 * `Hitbox` components on colliders below it, as on an `EnemyCube`.
 */
export declare class TargetDummy extends ScriptComponent {
    private static readonly FALL_SECONDS;
    standUpAfter: number;
    visual?: Entity;
    hitSound?: Entity;
    isDown: boolean;
    private health;
    private downTime;
    private squash;
    private angle;
    onStart(): void;
    onRestore(): void;
    onUpdate(): void;
    private bind;
    private onHurt;
}
