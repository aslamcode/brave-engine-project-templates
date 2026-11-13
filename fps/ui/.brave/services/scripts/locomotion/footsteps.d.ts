import { Entity, ScriptComponent } from '@brave/core';
/**
 * The sound of a character's steps: when a foot comes down one of the step sounds plays, louder the faster the body goes and softer crouched, and `Land Sound` plays when the body lands from a fall.
 * A foot comes down at the point where it gets farthest ahead of the body along the way the body goes (a heel strike): it swings forward, reaches that point, and from there goes back with the ground.
 * That is read from the bones frame by frame, so it is the same for a walk, a run, a crouched walk and a sidestep, and no clip needs a mark in it; it is silent when the body stands (a foot that moves to
 * turn on the spot) or is in the air. It is on the player and on the humanoid enemy: for the player the sounds are not spatial, for the enemy they are, so that its steps come from where it is.
 *
 * (A first version took a foot as down when its ankle fell below a height. The ankle is still 3 cm above its resting height at the heel strike and falls through any such height in the middle of the swing:
 * measured, the sound came about 160 ms before the foot, and the more so the slower the walk.)
 *
 * With `By Surface` on it steps by the ground: one ray down from the character at each step finds the collider under it, and the `Footstep Surface` of the scene that has that collider's physics material gives
 * the sounds (walk or run, by the speed). A ground with no surface of its own is stepped on with `Step Sound`, which stays the default of everything else.
 *
 * `Step Sound` is an entity with an Audio Source for each variation as children (one plays at random), or one Audio Source; each has Pooling on so that two steps may overlap. The script sets the gain of the
 * one it plays: `Volume` is the loudest, the Audio Source's own gain is not used. Read from the entity's origin, so on stairs a foot that lands higher than `Contact Height` is not heard: raise it for a level with steps.
 */
export declare class Footsteps extends ScriptComponent {
    leftFoot?: Entity;
    rightFoot?: Entity;
    stepSound?: Entity;
    landSound?: Entity;
    bySurface: boolean;
    contactHeight: number;
    minSpeed: number;
    volume: number;
    runSpeed: number;
    walkShare: number;
    crouchShare: number;
    landVolume: number;
    private body?;
    private surfaces?;
    private landListener?;
    private leftStride;
    private rightStride;
    onStart(): void;
    onUpdate(): void;
    onDestroy(): void;
    onAfterClone(): void;
    private travelDirection;
    private follow;
    private step;
    private soundsOf;
    private groundMaterial;
    private surfacesOfScene;
    private land;
    private play;
}
