# Physics

Rigid bodies, colliders, joints, layers and physics materials, simulated in a fixed-step physics world that runs while the game plays.

## What it is
- A **Collider** gives an entity a shape. A **Rigid Body** makes it a simulated body. A Collider belongs to the Rigid Body on its own entity or on the nearest entity above it (so hitboxes can be child entities); with none it is static level geometry.
- Rigid Body **Type**: **Dynamic** (the solver moves it: gravity, forces, collisions), **Kinematic** (you move it, by setting the entity's position; it pushes and carries Dynamic bodies, nothing pushes it), **Static** (never moves).
- The world steps at a fixed rate (Project Settings). It exists only in Play and holds while the game is paused.
- `onFixedUpdate()` is a **physics hook**: it runs right before each physics step, on the physics clock and not on its own. In a frame it can run 0, 1 or 2 times; it does not run in the editor or while paused. Put forces and physics-rate logic there, everything else in `onUpdate()` (see `scripts.md`).

## Add it
- Scenes panel, right-click, **Geometry**: every primitive comes with a Collider (Plane, Quad and Pyramid use Shape **Mesh**) and no Rigid Body, so it is static. Add a Rigid Body to make it fall.
- Add Component, category **Physics**: **Rigid Body**, **Collider**, **Joint** (**Character Controller** and **Ragdoll** are in `characters-and-animation.md`).
- Assets panel, right-click: **New Physics Material** (`.pmat`). The template's `assets/physics-materials/` has presets (ice, rubber, steel, wood, ...).
- **Project Settings, Layers** names the layers; **Project Settings, Physics** has **Tick Rate**, **Gravity** and the **Collision** table (which layers touch). They are saved in `project.json` under `physics` (`tickRateHz`, `gravity`, `ignoredLayerPairs`).

## Key settings
- **Collider** Shape: Box (Size 1, 1, 1), Sphere (Radius 0.5), Capsule (Radius 0.5, Height 2, tip to tip), Cylinder, Cone, **Convex**, **Mesh**, Terrain (the ground of the Terrain on the same entity; **Terrain Step** takes every Nth height). Also **Center** (offset), **Trigger** (detects without blocking, adds no mass), **Layer**, **Physics Material**, Friction 0.5, Bounciness 0, Density 1.
- **Mesh** is the entity's own triangles, a surface: exact for level geometry, only on a Static or Kinematic body or none. On a Dynamic body no collider is made (a console warning says so). **Convex** is the hull of the same mesh, a solid, so a Dynamic body may use it; **Hull Points** (default 128, 8 to 256) is the budget: fewer is cheaper and rounder, and the hull sits slightly inside the mesh. Primitives are the cheapest shapes.
- **Rigid Body**: Type Dynamic, Gravity Scale 1, Linear Damping 0, Angular Damping 0.05, Continuous Collision off (turn it on for fast, small bodies that pass through walls), Can Sleep on, Interpolate on, Freeze Position / Freeze Rotation (X, Y, Z). There is no Mass field: mass is the colliders' **Density** times their volume (`RigidBody.mass`, read only).
- **Physics Material** on a Collider: pick a `.pmat` or Custom. A `.pmat` holds Friction, Bounciness (above 1 gains energy: a trampoline) and Density, in kg per cubic metre for the presets (steel 7850, wood 600).
- **Project Settings, Physics**: Tick Rate 30, 50, **60** (default), 120 or Custom (10 to 240 Hz); Gravity (0, -9.81, 0); the **Collision** table: a row per layer, its lit cards are the layers it collides with, click a card to make that pair go through each other (both rows change, and a pair that does not collide gives no trigger events either). Physics has the first **16** layers; a later layer collides like Default.
- **Joint** (needs a Rigid Body on its entity): **Type** Fixed, Revolute (hinge; **Limit**, Min / Max Angle, **Motor**), Prismatic (slider), Spherical (**Limit Rotation**: twist and swing), Rope (**Length**), Spring (**Rest Length**, Stiffness, Damping), Free. **Connected Body** empty ties it to the world. Auto Configure (on) takes the bodies as placed, Collide Connected off, **Break Distance** 0 = never breaks.
- **In water**: a Dynamic body floats by default (Rigid Body foldout **Water**: Floats, Damping, Drag, Drag Coefficient, Ballast). It needs a water (Scenes right-click, **Water**: Sea, Still, River). The Water material's **Physics** group has **Affects Bodies** (on) and **Density** (2). There is no component to add for floating.

## Scripting
```ts
import { Collider, ICollisionEvent, Script, ScriptComponent } from '@brave/core';

@Script()
export class Pickup extends ScriptComponent {
  onStart() {
    const zone = this.entity.getComponent(Collider);
    zone.onTriggerEnter.on((event: ICollisionEvent) => {
      console.log(`${event.entity.name} entered`);
      this.entity.active = false;
    }, this);
  }
}
```
- **Collider signals**: `onCollisionEnter`, `onCollisionExit`, `onTriggerEnter`, `onTriggerExit`. Each side of a pair is told about the OTHER one: `{ collider, entity, rigidBody? }` (`ICollisionEvent`; `rigidBody` is missing for plain static geometry).
- **RigidBody**: `velocity`, `angularVelocity`, `applyForce(force)`, `applyForceAtPoint(force, point)`, `applyImpulse(impulse)`, `applyTorque`, `applyTorqueImpulse`, `wakeUp()`, `sleep()`, `isSleeping`, `mass`, `volume`; water: `submerged` (0 to 1), `inWater`, `water`, signals `onWaterEnter`, `onWaterExit` (`{ water, speed }`). A force acts for ONE step: apply it again every step.
- **PhysicsSystem**: `gravity`, `tickRateHz`, `fixedDeltaTime`, `layersCollide(a, b)`, `ignoreLayerCollision(a, b, ignore?)`, `layerMask('Enemy', 'Default')`, `raycast(origin, direction, maxDistance?, options?)`. A collider's layer: `collider.layer = LayerRegistry.indexOf('Hitbox')`, or `-1` for Same As Entity; setting `entity.layer` moves the entity, and the colliders that follow it, to another layer.
- **Raycast** returns `{ entity, collider, rigidBody?, distance, point, normal }` or `undefined`. Options: `mask` (layers it can hit), `triggers` (default false: a ray goes through triggers), `ignore` (an entity and everything under it: the shooter's own body), `solid` (a ray that starts inside a collider hits it at distance 0).
```ts
import { Float, PhysicsSystem, RigidBody, Script, ScriptComponent, Vector3 } from '@brave/core';

@Script()
export class Hover extends ScriptComponent {
  @Float({ suffix: 'N' }) lift = 30;
  @Float({ suffix: 'm' }) height = 2;
  private body?: RigidBody;

  onStart() {
    this.body = this.entity.getComponent(RigidBody);
  }

  onFixedUpdate() {
    const origin = this.entity.transform.globalPosition;
    const hit = PhysicsSystem.raycast(origin, new Vector3(0, -1, 0), this.height, { ignore: this.entity });
    if (hit) this.body?.applyForce({ x: 0, y: this.lift * (1 - hit.distance / this.height), z: 0 });
  }
}
```
- Moving by hand: setting a Kinematic body's entity position moves it at the next step and carries what stands on it; setting a Dynamic body's position teleports it. Push a Dynamic body with velocity, forces or impulses.

## Traps
- Solid collision events need at least one Dynamic body: two Kinematic bodies, or a Kinematic one against level geometry, give none. A **Trigger** sees every body that moves, Kinematic ones too (a character walking into a Trigger works); a Trigger on level geometry does not detect other level geometry. A Character Controller reports what it walks into on its own `onCollisionEnter` (see `characters-and-animation.md`).
- Collider Shape, Size, Radius, Height and Center edited during Play do nothing until the next Play. Joint settings changed during Play need `rebuild()`.
- A raycast `direction` must be a unit vector (`new Vector3(0, -1, 0)`, `transform.forward.normalized`), because `distance` is measured in lengths of it. Rays ignore the Collision table, and Triggers unless asked.
- Physics takes at most 2 steps per frame and drops the time it cannot catch up: a slow frame makes the simulation run slower than real time (the console warns once). Lower the Tick Rate or the number of active bodies.
- Floating compares the body's Density with the water's. A Collider's default Density is 1 and the water's 2, so a default box floats half under. A `.pmat` preset has real densities (wood 600, steel 7850): set the Water **Density** in the same units (1000 for water) or a wood crate sinks.
- With a `.pmat` selected, editing Friction, Bounciness or Density on the Collider edits the shared asset for every collider that uses it. Choose Custom first to break away from it.
- The entity's scale multiplies its Collider's size (a sphere or capsule uses the largest axis), and a scale changed during Play is not followed either.
- **A ray's `hit.entity` is the entity that owns the collider** (a child "head" hitbox), not the entity of the body; `hit.rigidBody` is the body above it and is `undefined` for static level geometry, which is how a script tells a wall from a character. Nothing finds a component upward (`getComponent` looks at one entity): walk `entity.parent` until one has it.
- **A Kinematic body is an obstacle to a Character Controller**; colliders on the CHILD entities of its entity move with it (a door: the leaf holds the body, the panels the colliders; setting the leaf's position or rotation from a script moves them all). Child colliders of a body are NOT obstacles to that body's own Character Controller, so hitboxes below an enemy do not block it. `collider.active = false` on every collider of a dead enemy takes it out of the physics, silently: it stops being shot and stops blocking.

## Not available yet
Overlap queries (a sphere or box asking what is inside it) and shape casts for scripts: use a Trigger collider and its signals, or a ray.

Types: `brave/core/component/{rigid-body,collider,joint}.d.ts`, `brave/core/system/physics-system/`, `brave/core/system/physics-material-system/`, `brave/core/static/layer-registry.d.ts`
