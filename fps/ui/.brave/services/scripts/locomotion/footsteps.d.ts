import { Entity, ScriptComponent } from '@brave/core';
/**
 * The sound of a character's steps: when a foot comes down one of the step sounds plays, louder the faster the body goes and softer crouched, and `Land Sound` plays when the body lands from a fall.
 * A foot comes down at the point where it gets farthest ahead of the body along the way the body goes (a heel strike): it swings forward, reaches that point, and from there goes back with the ground.
 * That is read from the bones frame by frame, so it is the same for a walk, a run, a crouched walk and a sidestep, and no clip needs a mark in it; it is silent when the body stands (a foot that moves to
 * turn on the spot) or is in the air. It is on the player and on the humanoid enemy: for the player the sounds are not spatial, for the enemy they are, so that its steps come from where it is.
 *
 * Walking BACKWARDS the clips play in reverse and a foot lands on its toes, with the heel up, so its ankle is higher when it touches the ground (measured on Bravo, as the detector reads it, the pose of the frame before: 0.24 to 0.29 m walking and 0.33 to 0.38 running, where
 * going forward it is 0.19 to 0.22): the height a foot may be at and still count as down goes from `Contact Height` to `Backward Contact Height` as the body goes from forward (or sideways) to straight back.
 *
 * (A first version took a foot as down when its ankle fell below a height. The ankle is still 3 cm above its resting height at the heel strike and falls through any such height in the middle of the swing:
 * measured, the sound came about 160 ms before the foot, and the more so the slower the walk.)
 *
 * With `By Surface` on it steps by the ground: one ray down from the character at each step finds what is under it, and the `Footstep Surface` of the scene that matches gives the sounds (walk or run, by the
 * speed). What matches, from the most specific: the physics material of the collider (an override somebody put there on purpose: a metal grating over a floor drawn as concrete), then the surface of the MATERIAL
 * that paints the spot the ray hit (a surface of the project; on a mesh with several materials the one of the part the foot is on, so a floor of concrete, metal and wood steps differently on each). A ground
 * with no surface of its own is stepped on as the `Default Surface` (Tile for the kit's players), and `Step Sound` is what is left when there is no bank at all. The surfaces are found in the scene; a scene that
 * has none gets the `Surface Bank` prefab made into it when this character starts, so any scene has the steps by surface with nothing placed in it.
 *
 * `Step Sound` is an entity with an Audio Source for each variation as children, or one Audio Source. `Step Order` says which plays at each step: **Pattern** (the default), the variations in the order of `Step Pattern`
 * (`1 2 3 4 3 4 2 3`: each number is the place of a variation among the children, so four recordings make a walk of eight steps that repeats a sound now and then and never twice in a row, and sounds like a person and not
 * like a machine); the counter is the character's own, one for both feet and for walking and running, and it starts again from the first place when the ground changes; **Sequence**, the order of the children (drag them
 * in the Hierarchy to change it), starting again; or **Random**, which never repeats the one before. A sound that plays twice in a row, which a plain random choice does now and then, is what makes a walk sound like a machine; each has Pooling on so that two steps may overlap. The script sets the gain of the
 * one it plays: `Volume` is the loudest, the Audio Source's own gain is not used. Read from the entity's origin, so on stairs a foot that lands higher than `Contact Height` is not heard: raise it for a level with steps.
 */
export declare class Footsteps extends ScriptComponent {
    leftFoot?: Entity;
    rightFoot?: Entity;
    stepSound?: Entity;
    landSound?: Entity;
    order: 'pattern' | 'sequence' | 'random';
    pattern: string;
    surfaceBank: string;
    defaultSurface: string | null;
    bySurface: boolean;
    contactHeight: number;
    backwardContactHeight: number;
    minSpeed: number;
    volume: number;
    runSpeed: number;
    walkShare: number;
    crouchShare: number;
    landVolume: number;
    protected orderOptions: {
        value: string;
        description: string;
    }[];
    protected get surfaceOptions(): any;
    private body?;
    private bank?;
    private landListener?;
    private leftStride;
    private rightStride;
    private patternPosition;
    private groundOfLastStep?;
    private places;
    private backwardness;
    onStart(): void;
    onRestore(): void;
    onUpdate(): void;
    onDestroy(): void;
    onAfterClone(): void;
    private travelDirection;
    private contactLimit;
    private follow;
    private step;
    private soundsOf;
    private patternPlaces;
    private playStep;
    private surfaceUnder;
    private groundHit;
    private bankOfScene;
    private ensureBank;
    private land;
    private play;
}
