import { Entity, ScriptComponent } from '@brave/core';
/**
 * The sounds of a step on one kind of ground: the physics material that makes the ground, and, as entities, the sounds of a walking step and of a running one. A `Footsteps` with `By Surface` on looks at the
 * physics material of the collider under its feet and plays the sounds of the `Footstep Surface` that has it; a ground with no surface of its own (a collider with no physics material, or one nobody gave
 * sounds to) is stepped on with the character's own `Step Sound`.
 *
 * A surface is an entity with this script, and its sounds are the entities it points at, the way `Footsteps` already takes its own: an entity with an Audio Source for each variation as children (one plays
 * at each step), or one Audio Source; each with Pooling on, so that two steps may overlap. Put all of a game's surfaces in the scene (the kit keeps them under `Footstep Surfaces`): they cost nothing but
 * their sounds being read, and a new kind of ground is a physics material, a floor that has it and one more of these.
 */
export declare class FootstepSurface extends ScriptComponent {
    materialId: string;
    walk?: Entity;
    run?: Entity;
    private materials;
    protected get materialOptions(): {
        value: string;
        description: string;
    }[];
    /** The sounds for a step, run or walk (the walk ones when it has no run ones). */
    soundsFor(running: boolean): Entity | undefined;
}
