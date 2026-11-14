import { Entity, ScriptComponent } from '@brave/core';
/**
 * The flash of a shot, made of the engine's own particles: a spray of hot sparks thrown along the barrel and a round glow at its tip, a few hundredths of a second each. It is on a weapon (next to its `Firearm`)
 * and `Weapon` calls `fire()` at every shot; the light that flashes on the weapon and the hands is the `Muzzle`'s, which the weapon switches on for `Flash Time`. The two emitters are made when the weapon
 * is first taken in hand, as children of the weapon (not of the `Muzzle`, which is switched off after a shot and would take the sparks with it), where the `Muzzle` is (which has no turn of its own, as in the kit), turned so that the sparks go the way its
 * forward axis points: the barrel. They are on the default layer, drawn by the main camera behind the weapon (the arms camera draws no particles).
 */
export declare class MuzzleFlash extends ScriptComponent {
    muzzle?: Entity;
    sparks: number;
    sparkSpeed: number;
    sparkSpread: number;
    glowSize: number;
    private sparkEmitter?;
    private glowEmitter?;
    onStart(): void;
    onRestore(): void;
    onAfterClone(): void;
    /** One shot's flash: the sparks and the glow, now. */
    fire(): void;
    private build;
    private makeEmitter;
}
