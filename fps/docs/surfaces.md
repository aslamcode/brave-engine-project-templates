# Surfaces

What a floor is made of (Concrete, Wood, Gravel...), as the project names it, so that whatever reads the ground under a foot, a bullet or a wheel can answer in its own way: footsteps in a shooter, an impact sound or a decal in another game. A surface is not a physics material: a `.pmat` holds friction, bounciness and density, and a surface holds nothing but its name.

## The parts

- **Project Settings > Surfaces**: the project's list. Add, rename and delete. Each surface has an id that never changes, which is what everything stores, so renaming one breaks nothing, and a material that names a surface that was deleted has no surface from then on. The list is saved in `project.json` (`surfaces`).
- **A material says which surface it is**: the **Surface** field of a material, beside Cull Mode, on a `.mat` asset or on the Material of an entity (it is a property of the material, so every entity that uses the asset has it). A **variant** of a material is the surface of its original, live, unless it sets its own; None is a choice too, so a variant can say it is no surface over an original that is one.
- **The part of a mesh counts**: a mesh with several materials has a surface for each part. One mesh whose parts are concrete, metal and wood is three surfaces, with nothing marked on its collider.

## Asking the ground

`surfaceOfHit(hit)` takes what `PhysicsSystem.raycast()` gave and answers the id of the surface of the material that paints the spot the ray hit, or `undefined` when it has none.

- A **Mesh** collider says which triangle the ray hit (`hit.faceIndex`, a position in the groups of three of the mesh's indices), so which submesh and which material slot. A slot with no material of its own is painted with the first.
- Every other shape (a box, a sphere, a capsule, a convex hull, the terrain) has no triangle to name, so it answers with the first material of its entity.
- `SurfaceRegistry` has the list: `all`, `find(id)`, `findByName('Gravel')` and `onChange`. Keep the **id** in a field and look the name up when it is shown; a name is what a person changes.

```ts
// assets/scripts/ground-reader.ts
import { PhysicsSystem, Script, ScriptComponent, SurfaceRegistry, Vector3, surfaceOfHit } from '@brave/core';

@Script()
export class GroundReader extends ScriptComponent {
  /** The name of the surface under this entity, or undefined when the ground has none. */
  surfaceUnder(): string | undefined {
    const origin = this.entity.transform.globalPosition.clone();
    origin.y += 0.3;

    const hit = PhysicsSystem.raycast(origin, new Vector3(0, -1, 0), 1.2, { ignore: this.entity });
    return SurfaceRegistry.find(surfaceOfHit(hit))?.name;
  }
}
```

A field of a script that holds a surface is a `@Select` fed by `SurfaceRegistry.options` (None first, the same array until the list changes, which the Inspector needs):

```ts
// assets/scripts/impact-sound.ts
import { JsonIgnore, Script, ScriptComponent, Select, SurfaceRegistry } from '@brave/core';

@Script()
export class ImpactSound extends ScriptComponent {
  @Select({ label: 'Surface', optionsKey: 'surfaceOptions' }) surface: string | null = null;

  @JsonIgnore()
  protected get surfaceOptions() {
    return SurfaceRegistry.options;
  }
}
```

## Overriding it with the collider

A surface is what the material says, and that is usually right. When a collider must be another ground than its material (a metal grating laid over a floor that is drawn as concrete), whatever reads the ground can look at the collider's physics material first: `hit.collider.physicsMaterialId`. That is a rule of the one that asks, not of the engine: `surfaceOfHit()` only answers what the material says. A template that has footsteps by surface (see its `docs/template.md`) does exactly this: the collider's physics material first, then the surface of the material, then a default surface, then the character's own step sound.

## What it is not

- It does not change how a body moves: friction and bounciness are the physics material's.
- It plays nothing by itself: a surface is a name, and a script (the footsteps of a template, your own) decides what to do with it.
- The terrain's own layers (grass, rock, dirt, painted by weight) are not read by `surfaceOfHit()`: a collider of the Terrain shape answers with its entity's first material. Ask `layerWeightsAt(x, z)` of the Terrain for those.

Types: `brave/core/static/surface-registry.d.ts`, `brave/core/system/surface-system/`, `brave/core/component/material.d.ts`, `brave/core/system/physics-system/physics-system.d.ts`
