import { Entity, ScriptComponent } from '@brave/core';
/**
 * The sounds of a step on one kind of ground. It says which ground in two ways, and either is enough:
 *
 * - `Surface`: a surface of the project (Project Settings > Surfaces: Concrete, Wood, Gravel...), the one the MATERIALS say they are. A material that is a surface (the `Surface` field of a material, or of its
 *   original) makes every floor painted with it sound like this, whatever collider it has and whichever part of a mesh the foot is on: one mesh whose parts are concrete, metal and wood steps differently on each.
 * - `Physics Material`: the physics material of the collider, an override. A collider that has a physics material with a surface here steps as that surface, whatever its material says: a metal grating laid over
 *   a floor that is drawn as concrete.
 *
 * A `Footsteps` with `By Surface` on looks at what is under the foot and plays the sounds of the `Footstep Surface` that has it (the collider's physics material first, then the surface of the material under the
 * foot); a ground with no surface of its own is stepped on with the character's `Step Sound`.
 *
 * A surface is an entity with this script, and its sounds are the entities it points at, the way `Footsteps` takes its own: an entity with an Audio Source for each variation as children (one plays at each
 * step), or one Audio Source; each with Pooling on, so that two steps may overlap. The kit keeps all of its surfaces in ONE prefab (`Footstep Surfaces`) that a `Footsteps` brings into any scene that has none, so the
 * sounds are changed in one place; a game that wants its own surfaces for a scene puts them in the scene, and the prefab is not brought.
 */
export declare class FootstepSurface extends ScriptComponent {
    surface: string | null;
    materialId: string;
    walk?: Entity;
    run?: Entity;
    private materials;
    protected get surfaceOptions(): any;
    protected get materialOptions(): {
        value: string;
        description: string;
    }[];
    /** The sounds for a step, run or walk (the walk ones when it has no run ones). */
    soundsFor(running: boolean): Entity | undefined;
}
