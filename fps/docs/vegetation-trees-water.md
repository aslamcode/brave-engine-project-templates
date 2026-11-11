# Vegetation, trees, water and wind

The things that fill a landscape: procedural trees, layers of grass and plants, water surfaces, and the wind that moves them. All of them come from the Scenes panel's right-click menu. The ground they stand on is `terrain.md`.

## Trees
**What it is.** The **Tree Generator** component (category Procedural) makes a trunk, branches and needles or leaves as one mesh of two parts: the bark (Material slot 0) and the foliage (slot 1). The scene keeps the numbers and the Seed, never the triangles: the mesh is made again when the scene loads (about 10 ms), and trees with the same numbers are one mesh to the GPU. It is a tree object, not a Vegetation layer: a forest is entities (a handful of seeds, many copies).

**Add it.** Scenes panel, right-click, **Tree**, **Pine** or **Blossom** (a flowering broadleaf, pink by default; an author may call it the Ipe: same preset). The entity gets the generator, a mesh, two Materials (bark Opaque; foliage Cutout, both faces drawn, plain colours) and a static cylinder **Trunk Collider**. If the project has materials named `pine-bark.mat` and `pine-needles.mat` (Blossom: `blossom-bark.mat`, `blossom-flowers.mat`) the menu gives the new tree those; a new project has none, so give the trees your own textured `.mat`s (drop them on the Materials list rows), set their **Shader** to **Plant** (a Pbr that sways; a plain Pbr material does not move in the wind) and keep the foliage one Cutout.

**Key settings** (Pine / Blossom defaults, metres):
- **Preset** (choosing one loads that kind's numbers and keeps the Seed), **Seed** and **Randomize Seed**, **Height** (12 / 8.5, exact, 1 to 60), **Trunk Radius** (0.3 / 0.32, at the ground).
- **Crown**: **Crown Width** (5.5 / 10), **Crown Shape** (0 to 1; 0.55 / 0.4), **Clear Trunk** (3.2 / 2.3: the bare trunk, and the height of the collider).
- **Branches**: Pine **Whorls** (14, 2 to 40) and **Branches Per Whorl** (6, 3 to 10); Blossom **Limbs** (4, 2 to 8); **Droop** (0 to 1; 0.5 / 0.4).
- **Foliage**: **Foliage Density** (0 to 2; 0 is bare), **Foliage Size** (0.3 to 3). Blossom only: **Blossom Color**, **Blossom Amount** (1), **Leaf Amount** (0). **Advanced** (collapsed): **Foliage Lighting** (Soft, Balanced, Per Card), **Trunk Wander**, **Twigs**.
- **Wind**: **Strength** (1), **Bend Height**, **Branch Sway** (3), **Flutter** (0.4 / 0.7), **Bypass Time Scale**. **Level Of Detail** (on), **LOD Bias** (1), **Fade Time** (0.4 s), **Cull Distance** (0 never hides). **Trunk Collider** (on; only an entity's collider of that name is touched).

**Traps and cost.**
- A tree has three meshes: full, then lower ones from 3 times its height away and from 8 times (a 12 m pine: 36 m and 96 m), times **LOD Bias**, cross-faded over **Fade Time**. The collider is the trunk only: bodies walk under the branches. Nothing is solid but the cylinder.
- Instancing needs the same numbers AND the same `.mat` assets: many seeds or one-off materials mean many draw calls (a forest wants few seeds, rotated and scaled copies). A `.fab` of a tree is one seed.
- The wind numbers belong to the **material**: trees sharing a material share the first one's numbers (the console warns). A tree sways only with the Plant shader (the generator's own materials have it).
- Changing a number from a script rebuilds the mesh (5 to 10 ms): never animate them.
- A default pine is about 11 thousand triangles, a Blossom 17 to 18 thousand (the two lower levels keep roughly 37% and 10%). Measured: the geometry of a pine costs 0.4 to 1.0 ms of GPU; the rest of a forest's cost is the screen-space effects, paid by the pixels the trees cover.

## Vegetation
**What it is.** A **Vegetation** component is a LAYER of plants on a ground: the mesh of its **Target** entity, or of its own entity when Target is empty (a plane, a hill, a terrain, a rock). Plants stand on the highest surface, lean with the slope and are lit by its normal. Blades are not objects (the shader makes them from a number and a hash), so a meadow costs a handful of draws. The layer takes the sun's shadows and casts none. Bodies that move (a Rigid Body that is not Static) bend it and it gets up behind them. There is no collider and no per-plant API.

**Add it.** Scenes panel, right-click, **Vegetation**: **Grass**, **Wheat**, **Flowers**, **Mesh Plants** (and **Wind Zone**, below). Each is a 40 m plane (a floor a character can walk on) with a dark green Material and a Vegetation; stretch the plane with Scale. For a ground of your own: Add Component, **Vegetation**, on that entity, or on an Empty with **Target** set to it. Several layers can share a Target, each with its own Density Map.

**Key settings.**
- **Plant Type** (Plant): **Blades** (grass; with **Ear Length** above 0 it is wheat), **Cards** (a picture with transparency stood on the ground: flowers, ferns), **Mesh** (a `.mdl` of the project). Changing the type swaps Density, Draw Distance and Cover for the new type's defaults when they were the old one's.
- Blades: **Width** (0.03 m), **Lean** (0.35), **Root Color**, **Tip Color**, **Ear Width** / **Ear Droop** (30) / **Ear Color**, **Roughness** / **Reflectance** (0.5), **Detail Distance** (0 is off), **Curvature**, **Vein Depth**.
- Cards: **Texture** (nothing is drawn without one), **Layout** (Quad, Crossed, Star, Billboard (Y Axis), Billboard (Full) with **Pivot**), **Atlas Columns** / **Atlas Rows** (1 to 8 variants in one texture; leave transparent margins of the plant's colour), **Card Width** (0.4), **Alpha Cut** (0.5), **Tint**.
- Mesh: **Plant Model** (nothing is drawn without one; scaled to **Height**, lowest point on the ground, its origin is where it stands, at most 10000 vertices), **Texture**, **Alpha Cut**, **Tint**, **Receive Shadows** (off is about 2.5 times cheaper).
- Every type: **Height** (0.45 m) and **Height Variation** (0.35), **Density** per m² (120 blades, 6 cards, 2 meshes; at most 250, 100 and 25), **Draw Distance** (80, 30, 40 m), **Seed**, **Cover** (carpet of the average colour past the blades, on for blades) and **Cover Distance** (400, at most 1000), **Color Variation** (0.5), **Local Light Distance** (25: Point, Spot, Soft and Area lights light it, without shadows), **Wind Response** (1, 0 to 2), **Stiffness** (0.35), **Bypass Time Scale**, **Bend Response** (1, 0 for grass bodies do not bend).

**Density Map (where it grows).** The red channel of a texture in the **Density Map** field, laid over the Target's box seen from above (the first row of the image at the smallest z; not the mesh's UVs), or a map painted in the editor: select the Vegetation entity, **Paint** in the Scene view's toolbar, panel "Paint Density": **Paint** / **Erase** (Shift flips), **Radius**, **Strength**, **Hardness**, **Density** (what Paint takes it to), **Fill**, **Clear**; **[** and **]** resize. The map is text inside the layer (scene file: Ctrl+S) and a texture in the field wins while it is there. With neither the layer grows everywhere. **Clear Painted Density** (a button, only while a map exists) cannot be undone. A compressed texture, or one over 2048 texels, cannot be painted.

**Traps and cost.** Cards and meshes are not thinned with distance: the Draw Distance is their cost (blades thin out). Grass is not drawn in reflection-probe captures. An entity that has a Terrain and a Vegetation is sculpted by Paint, not painted: keep layers on their own entities.

## Water
**What it is.** There is no water component: a water is a **Material with the Water shader** on a mesh. The editor's water entities also carry a **Water Disturber** (splash and wake). While the game plays the Material makes the water known to the game: a ray can meet it, a script can ask its height, and Dynamic Rigid Bodies float on it (the Rigid Body's Water foldout is in `physics.md`). Nothing collides with water: it is not a solid.

**Add it.** Scenes panel, right-click, **Water**: **Sea** (rings of mesh that follow the camera, no edge; its level is the entity's y), **Still** (a 40 m plane: pond, lake, pool; it exists only inside its mesh) or **River** (a plane 10 m by 60 m with **Flow** (0, 1.5) m/s along +z). A water of your own: a flat mesh, Material, Shader **Water**, **Water Type**. Use Water, Sea for a sea: its mesh is what gives it no edge.

**Key settings** (Water shader, Material card; defaults):
- **Water Type** (Still, Sea, River), **Color**, **Absorption Color**, **Clarity** (5 m), **Murkiness** (0.25), **Roughness** (0.03), **Refraction** (1).
- Still and River **Waves**: **Wave Strength** (0.04), **Wave Scale** (3 m), **Wave Speed** (0.4). Sea: **Wave Height** (1.2 m), **Wave Length** (40 m), **Wind Direction** (30 degrees: 0 along +X, 90 along +Z), **Direction Spread**, **Choppiness**, **Whitecaps**, **Extent** (2000 m). **Flow** (River and Sea, m/s in the world) carries the waves, rings and floating bodies. **Bypass Time Scale** keeps the waves running in a pause menu.
- **Edge Softness**, **Foam Width**, **Foam Amount**, **Ripple Strength**, **Splash Foam**, **Caustic Amount** (0.7; 0 turns the caustics and their cost off), **Caustic Focus**.
- **Physics**: **Affects Bodies** (on; off is a decorative surface that can still be hit by a ray) and **Density** (2, in a Collider's Density units: a default body, Density 1, floats half under; use 1000 with `.pmat` presets).
- **Water Disturber**: **Enter Strength** (1), **Exit Strength** (0.6), **Ripple Radius** (0.3 m), **Size From Collider** (on), **Wake Strength** (0.8; 0 off), **Wake Speed** (0.4 m/s), **Wake Interval** (1 s). With no Collider on its entity it asks every moving body whether it crosses the surface; with a **Trigger** Collider that volume decides.

**Scripting.**
```ts
import { IWaterSplash, Script, ScriptComponent, WaterSystem } from '@brave/core';

@Script()
export class WaterWatcher extends ScriptComponent {
  private wasUnder = false;

  onStart() {
    WaterSystem.onSplash.on((splash: IWaterSplash) => console.log(`splash, strength ${splash.strength}`), this);
  }

  onUpdate() {
    const position = this.entity.transform.globalPosition;
    const water = WaterSystem.surfaceAt(position.x, position.z);
    const under = !!water && position.y < water.height;
    if (under !== this.wasUnder) console.log(under ? 'went under' : 'came up');
    this.wasUnder = under;
  }
}
```
- `WaterSystem.surfaceAt(x, z)`: `{ height, rise, density, flowX, flowZ, entity }` or undefined where there is no water. `raycast(origin, direction, maxDistance?)` meets a surface (physics rays do not). `splash(point, radius, speed?, gain?, water?)`, `disturb(position, strength, radius)` and `raycastSplash(...)` (a shot that hits by a ray) make rings; `onSplash` tells a script. Floating your own way: turn **Floats** off and `applyForce` from `onFixedUpdate()` by what `surfaceAt` says.

**Traps.** Floating is for Dynamic bodies, in Play only (not in the Scene view): a character (Kinematic) wades through and makes rings. Taking the Water Disturber off loses the splash and wake, not the floating or the ray. A Still or River mesh must be flat and level (it may turn about y and scale); one water per entity. The Sea's Wind Direction is its own field: it does not follow a Wind Zone.

## Wind Zone
**What it is.** The wind that grass, trees and bodies stand in. **Add it:** Scenes panel, right-click, **Vegetation**, **Wind Zone** (an Empty with a **Wind Zone** component, Global on). The wind blows the way the entity FACES, along the ground: turn the entity to turn the wind.
- **Global** (on): the wind of the scene. The last Global zone switched on wins; with none the engine has a gentle default. Off: a box (**Size** 10 x 6 x 10 m in the entity's space, scale applies; **Fade Distance** 2 m) with a wind of its own for what is inside: a fan, a gale in a pass, **Strength** 0 for a calm room. Where boxes nest the smallest wins.
- **Strength** (0.5, 0 to 1; 1 is a gale of about 20 m/s, 0.5 about 10 m/s), **Gust** (0.4), **Wave Speed** (3 m/s, Global only).
- Reacting: grass (**Wind Response**, **Stiffness**), cards and mesh plants, trees (their Wind group), Dynamic Rigid Bodies with **Wind Response** above 0 (default 0; light bodies move: give a paper ball a Collider Density near 20, a crate 600), and scripts through `WindZoneSystem.velocityAt(position)` (m/s along x and z). Grass and trees feel the 8 zones nearest the camera, bodies all of them. The wind is level: no updraft, no torque, nothing for characters or ragdolls.
```ts
import { Script, ScriptComponent, Time, WindZone } from '@brave/core';

@Script()
export class RisingStorm extends ScriptComponent {
  private zone?: WindZone;

  onStart() {
    this.zone = this.entity.getComponent(WindZone);
  }

  onUpdate() {
    if (!this.zone) return;
    this.zone.strength = Math.min(this.zone.strength + 0.02 * Time.deltaTime, 1);
  }
}
```
Drive the wind through the Global zone's fields: `WindSystem.wind` is overwritten by the zone at the next update.

## Not available yet
Swimming for the Character Controller, a tilted water, a vertical wind, kinds of tree other than Pine and Blossom, plants you can hit or collide with.

Types: `brave/core/component/{tree-generator,vegetation,water-disturber,wind-zone}.d.ts`, `brave/core/shader/water.d.ts`, `brave/core/system/water-system/water-system.d.ts`, `brave/core/system/wind-system/{wind-system,wind-zone-system}.d.ts`, `brave/core/system/vegetation-system/vegetation-system.d.ts`, `brave/core/system/tree-lod-system/tree-lod-system.d.ts`, `brave/core/enum/{vegetation-plant-type,vegetation-card-layout,water-type}.enum.d.ts`
