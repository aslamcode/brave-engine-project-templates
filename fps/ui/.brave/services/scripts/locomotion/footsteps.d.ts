import { Entity, ScriptComponent } from '@brave/core';
/**
 * The sound of a character's steps: when a foot comes down (its bone gets to `Plant Height` above the entity's origin, after having been above `Lift Height`) one of the step sounds plays, louder the faster the body
 * goes and softer crouched, and `Land Sound` plays when the body lands from a fall. It reads the feet from the animation, so it follows any clip (a walk, a run, a crouched walk, a sidestep) with no marks
 * in them, and it is silent when the body stands (a foot that moves to turn on the spot) or is in the air. It is on the player and on the humanoid enemy: for the player the sounds are not spatial, for the enemy
 * they are, so that its steps come from where it is.
 *
 * `Step Sound` is an entity with an Audio Source for each variation as children (one plays at random), or one Audio Source; each has Pooling on so that two steps may overlap. The script sets the gain of the
 * one it plays: `Volume` is the loudest, the Audio Source's own gain is not used. Read from the entity's origin, so on stairs a foot that lands higher than `Plant Height` is not heard: raise it for a level with steps.
 */
export declare class Footsteps extends ScriptComponent {
    leftFoot?: Entity;
    rightFoot?: Entity;
    stepSound?: Entity;
    landSound?: Entity;
    plantHeight: number;
    liftHeight: number;
    minSpeed: number;
    volume: number;
    runSpeed: number;
    walkShare: number;
    crouchShare: number;
    landVolume: number;
    private body?;
    private landListener?;
    private leftDown;
    private rightDown;
    onStart(): void;
    onUpdate(): void;
    onDestroy(): void;
    onAfterClone(): void;
    private follow;
    private step;
    private land;
    private play;
}
