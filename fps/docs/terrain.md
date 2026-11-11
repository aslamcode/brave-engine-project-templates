# Terrain

A square of ground made from a grid of heights, drawn finely where its shape needs it and coarsely where it does not, with a collider, a sculpting brush, painted material layers and grass that grows on it.

## What it is
- The `Terrain` component is a mesh renderer whose heights are kept as text inside the scene file (there is no terrain asset). The level of detail is a quadtree chosen from the camera by how wrong the coarse drawing would look: a flat plain stays a few big triangles, a mountain is cut finer where its shape shows. Nothing is baked: sculpting and the Detail settings act live.
- **The entity's position is the CORNER with the smallest x and z, not the middle.** A new terrain at (0, 0, 0) covers x and z from 0 to 500. Heights are metres above the entity's y.
- The grid is 2^k + 1 samples a side (3 to 4097; a new terrain has 513). Size 500 m over 513 samples is about 1 m between samples. More Size stretches the same heights over more ground.

## Add it
- Scenes panel, right-click, **Terrain**: an entity "Terrain" with a Material (dark earth, roughness 0.95), a **Terrain** component and a **Collider** of shape Terrain. It starts flat on purpose (under 2 kB of scene file); heights come from sculpting or an import.
- **Sculpt and paint**: select it, click **Paint** in the Scene view's toolbar (Esc leaves). The panel is "Sculpt Terrain" or "Paint Terrain", switched by the Sculpt | Paint buttons at its top. Editor only, not during Play.
- **Import heights**: Inspector, Terrain card, **Import Heightmap** (editor only; it refuses during Play and is not in a build).

## Importing a heightmap
- Files: a **16-bit grayscale PNG** (what Gaea, World Machine and elevation exporters write), or a raw 16-bit **`.r16` / `.raw`** (little-endian, square: one height after the other). An 8-bit PNG is read with a warning (256 levels show as steps). RGB(A) PNGs are read by their first channel; palette, interlaced and under 8-bit PNGs are refused with the reason.
- The panel asks **Size** (m), **Samples**, **Lowest** (default 0) and **Highest** (default 500), then **Import** (one undo step). A file of 512 or 513 is taken as it is; any other side is resampled to the smallest 2^k + 1 that holds it, and one that is not square is stretched. **Samples** offers that number and its doubles up to 2049: more samples than the file has are a smooth curve through its samples (it rounds the facets of a hill), not extra detail.
- **The file carries levels, not metres.** **Lowest** is the height of black and **Highest** of white, in metres from the entity's y. A real-world map of 1253 to 2696 m typed as it is lifts the terrain 1253 m: type Lowest 0 and Highest 1443 (the relief) and the lowest ground is at the entity's y.
- A 2049 x 2049 terrain is about 4 MB of text in the scene (513 x 513 of real relief about 340 kB).

## Key settings
- **Terrain** card: **Size** (500 m). **Detail**: **Pixel Error** (2 px: how far the drawn surface may be from the heights as seen on screen; lower is finer, a flat place stays coarse at any value), **Detail Distance** (150 m: everything nearer the camera that has a shape is drawn at the finest level, 0 leaves it all to Pixel Error), **Coarsest Level** (6, 0 to 12: the biggest a triangle can get; level 0 is every sample, each level doubles it).
- **Collider** (Shape Terrain, needs the Terrain on the same entity): **Terrain Step** (1, up to 64: every Nth height is used for collision; 1 finds the ground exactly where it is drawn, more is smoother and cheaper). Static, Kinematic or no Rigid Body: with a Dynamic one no collider is made and the console says so. A physics raycast hits it like any collider.
- **Layer Textures, Texture Size** (256 to 2048, default 1024), **Weights Size** (256, 512, 1024, 2048: texels of the painted map; chosen from the Size when the first layer is added, about 1 m a texel), **Blend Sharpness** (0 to 1, 0.75: how crisp the edge between two layers is).

## Sculpting
- **Sculpt** tools: **Raise**, **Lower** (Shift flips them), **Smooth** (towards the average around), **Flatten** (towards one height: field **Height (m)**, empty means the height under the first click of each stroke; **Level All** takes the whole terrain to it).
- Brush: **Radius** (m, 10 at the start; **[** and **]** shrink and grow it by a factor of 1.25), **Strength** (0 to 1, 0.5), **Hardness** (0 to 1, 0.5: the share of the radius at full strength). Raise and Lower move the ground by a share of the Radius, so a big brush works faster.
- Each stroke is an undo step. The heights live in the scene: **Ctrl+S** saves them.

## Layers (the look of the ground)
- Up to **8** layers, blended by weights painted with the brush. Add them in the Paint view (**Add Layer**) or in the Terrain card's **Layers** list. The first layer covers the whole terrain and takes the Material's colour as its Tint; the terrain then uses the **Terrain** shader (a shared `.mat` is replaced by a material of the terrain's own).
- A layer's fields: **Name**, maps **Albedo**, **Normal**, **Roughness** (red channel), **Height** (red; where two layers meet the higher one shows: rock between tufts of grass), **Tint**, **Tile Size** (4 m: metres per repeat), **Roughness** (0.9), **Normal Strength** (1), **Break Tiling** (0.5: hides the repeat, one more sample), **Flip Normal Green**, **Triplanar** (for cliffs: three sides, no normal map, three times the samples). Maps may be any size or format; they are brought to Texture Size.
- **Paint** view: click a layer to pick it; **Paint** brings it in and the others give way (weights always add up to 1), **Erase** takes it out (Shift flips); **Remove** takes the layer out; **Fill** gives the whole terrain to the picked layer. Paint follows each layer's slot, so reordering the list or removing a layer never moves the others' paint.

## Grass on a terrain
Add a **Vegetation** component (see `vegetation-trees-water.md`) and leave **Target** empty on the terrain's own entity, or put it on another entity and set **Target** to the terrain. The Paint button on an entity that has both a Terrain and a Vegetation always picks the Terrain: keep each grass layer on its own entity to paint its Density Map.

## Scripting
```ts
import { Float, Ref, Script, ScriptComponent, Terrain } from '@brave/core';

@Script()
export class StayOnGround extends ScriptComponent {
  @Ref(Terrain) ground!: Terrain;
  @Float({ suffix: 'm' }) offset = 0.5;

  onUpdate() {
    const position = this.entity.transform.globalPosition;
    const height = this.ground.heightAt(position.x, position.z);
    if (Number.isNaN(height)) return;
    this.entity.transform.position.y = height + this.offset;
  }
}
```
- `heightAt(worldX, worldZ)` (metres; **NaN off the terrain**), `normalAt(worldX, worldZ)` (`[x, y, z]`), `groundHit(origin, direction, maxDistance)` (an `IGroundHit` with `x`, `y`, `z`, `distance`, or undefined). Rays and points are in the world: `terrain.groundHit([x, y, z], [0, -1, 0], 100)`.
- Layers: `layers` (the `TerrainLayer` list, with `name`), `layerWeightsAt(x, z)` (a share per layer in list order, adding to 1; all 0 off the terrain), `dominantLayerAt(x, z)`: for footsteps, dust, grip. Navigation: `navigation.md`.

## Cost
Measured by the engine team on an Apple GPU at 1080p: a 2 km terrain from a 2049 x 2049 map took 2.2 to 4.9 ms of the frame (118 to 283 nodes drawn); four layers cost the same as the plain material. The GPU holds 512 nodes (about 54 MB); a view that needs more is given a larger error. A large **Detail Distance** on a big terrain costs triangles first. Layer textures: 8 layers at 1024 are about 86 MB with mips.

## Traps
- Do not rotate or scale the entity: the questions above answer for a terrain that is only moved. Change **Size** instead. Do not tick **Static** on it either: its nodes change with the camera and a static caster's shadow would not follow.
- The camera's far plane defaults to 1000 m: a big terrain seen from above needs more (Camera card, Far).
- A terrain is read-only while the game runs (the Play clone shares its heights and weights).
- Seen from very close the facets are the data: level 0 is one triangle per sample (3.9 m on a 2 km, 513-sample map). Pixel Error cannot add detail; a denser file can (the import's Samples only rounds the facets).
- Removing a layer keeps its paint until another layer takes the slot (which clears it). Undoing strokes made before a **Weights Size** change, or before a deleted terrain was undeleted, does nothing.

## Not available yet
Holes (caves cut through the ground), changing heights or layers at runtime, a terrain that is not one square, streaming a map bigger than memory, erosion, GeoTIFF or EXR import.

Types: `brave/core/component/terrain.d.ts`, `brave/core/system/terrain-system/{terrain-data,terrain-layer,terrain-splat,terrain-heightmap}.d.ts`, `brave/core/system/brush-system/ground-ray.d.ts`
