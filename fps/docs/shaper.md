# The Shaper (greybox modelling)

Modelling inside the editor: meshes made of n-gon faces, created from parametric shapes and edited in the Scene view the way Blender's edit mode is, combined with boolean cuts, and used by the game as a plain static mesh. It is for blocking out levels, walls, stairs, doors and props; finished art still comes from Blender or another tool as `.fbx` / `.glb`.

## What it is
- A Shaper piece is an entity with a **Shaper Mesh** component (Inspector), a Mesh Renderer, a Material and a Mesh Collider. Blender's edit mode is the reference for names, keys and behaviour.
- **The Shaper is an editor tool.** `ShaperMesh` and the half-edge classes are not in `brave/core`: a script cannot import them. The game sees the baked mesh, the Materials and the Collider; a build ships each piece without its editable topology, and the boolean cuts are worked out in the editor only, so moving a piece while the game runs does not cut anything again. A script treats a Shaper piece as any static mesh (`physics.md` for the Collider).
- Editable topology is saved in the `.scn` next to the baked mesh (a heavy piece makes a heavy scene). **Seal** (Inspector button, with a confirmation) removes the Shaper Mesh component and keeps the mesh as a plain one.

## Add it
- Toolbar of the Scene view: **Shaper** (tooltip "Shaper Mode (Ctrl+Tab)"), then **+** ("Create Shape"). Also the Scenes panel's right-click, **Shaper** submenu (after Geometry), which lists the same shapes. Editor only, not in Play; edit tools work on exactly ONE selected entity.
- **Create Shape** menu: **Cube**, **Plane**, **Circle**, **Cylinder**, **Cone**, **Pyramid**, **Sphere**, **Dome**, **Pipe**, **Ramp**, **Stairs**, **Arch**; after a divider **Rock**, **Piper**, **Text**. The entity is named "Shaper <Shape>", gets the light grid greybox material (`assets/materials/greybox/`: `greybox-light`, `-neutral`, `-dark`, one tile per metre; the editor restores them if deleted: leave them) and a Mesh collider.
- Other toolbar buttons in Shaper Mode: **Mesh** (every operation with its key), and an expand icon ("Open the Shaper in a window to model with the whole screen": switches **Orbit**, **Isolate**, **Environment**, all off at first; Esc does not close it).

## The shapes
Inspector, Shaper Mesh card, group **Shape**: **Dimensions** (the bounding box in metres; every shape is centred, Y up) and the parameters below. They lock (read-only) after the first hand edit of vertices, edges or faces; undoing back to the base unlocks them.
- **Cube**: Dimensions 1 x 1 x 1. **Plane** (open: one face, default 10 x 1 x 10) and **Circle** (open n-gon facing +Y; **Segments** 16, 3 to 256).
- **Cylinder**: **Segments** 16. **Cone** and **Pyramid**: **Segments** (16; Pyramid 4) and **Top Radius** (0 is an apex, up to 1 a frustum).
- **Sphere** (a UV sphere): **Segments** 16, **Rings** 8. **Dome**: Segments 16, **Rings** 4; default Dimensions 1 x 0.5 x 1, a true hemisphere.
- **Pipe** (a hollow tube; Dimensions X and Z are the outer diameter, Y the centre-line length): **Segments** 16, **Wall Thickness** (0.2 of the outer radius, 0.05 to 0.95), **Loops** (extra rings, 0 to 64), **Bend** (degrees, 0 to 270). The bend is limited so the pipe never folds: one band turns at most 120 degrees, add Loops for more.
- **Ramp**: a triangular prism climbing toward -Z. **Stairs**: **Steps** (5), **Riser Height**, **Tread Depth**, **Layout** (Straight, U-Shaped, L-Shaped), **Turn** (Left, Right; L only). The count comes from Riser Height when above 0, else Tread Depth, else Steps (the others go read-only); a U or L has at least 3. The Character Controller climbs risers of 0.30 m or less.
- **Arch**: **Arc Segments** (12), **Thickness** (0 is a solid doorway, above 0 a band with the opening cut through), **Angle** (180 default, 20 to 320: over 180 is a horseshoe). X is the span, Y the height to the crown, Z the depth.
- **Rock** (Rock Generator, declared in `brave/core`): **Seed**, **Width** 2, **Height** 1.4, **Depth** 2, **Detail** 12 (12 x Detail x Detail triangles), **Flat Base**, **Pivot At Base**, **Facets**, noise groups Shape, Bumps and Relief. Born with a Convex collider. **Piper**: a pipe along a path of points (see below). **Text**: a Text Renderer with Render As Mesh.
- Inspector extras: **Smooth Angle** (30 degrees: faces meeting at less than this are shaded smooth), **Mirror X / Y / Z** (model one half, the other follows) with **Apply Mirror**, **UV Mode**, **Operation**.

## Operation (boolean cuts)
**Operation**: **None** (default: cuts nothing and is cut by nothing), **Add** (a piece that can be cut), **Subtract** (a cutting volume: it is not drawn, and its collider is switched off). Each Add is cut by every Subtract that overlaps it; a Subtract that is a CHILD of an Add in the Scenes hierarchy cuts only that parent (a window in one wall, not the next). Overlapping Add pieces are not merged: both surfaces stay. Booleans want closed solids: leave **Plane** and **Circle** (open) at None. The cuts follow edits after a short pause and are baked for the game.

## Shaper Mode: selecting and editing
- Select: **1** vertex, **2** edge, **3** face mode. Click, Shift+click to toggle, drag a box, **Alt+click** an edge loop (Ctrl+Alt+click a ring), **Ctrl+A** all, **Alt+A** none, **Ctrl+I** invert, **L** / **Shift+L** linked, **Ctrl+=** / **Ctrl+-** grow and shrink. Move with the gizmo or **G** / **R** / **S** (X, Y, Z lock an axis, or type a number).
- Modal operations follow the mouse, accept typed numbers, confirm with click or Enter, cancel with Esc, then show an "adjust the last operation" panel (**OK** closes it). Every operation is one undo step; a refusal is a warning toast that says why.

| Operation | Key | Notes |
|---|---|---|
| Extrude | **E** (Shift+E individual faces) | Face mode extrudes joined faces as one slab; Edge mode makes flaps. A loop that closes (a hole's rim) gets a cap in the same step: delete the cap (X) to leave a tube open. |
| Inset | **I** (I again: individual) | Panel: Thickness, Depth, Individual, Outset. |
| Bevel | **Ctrl+B** | Edges, together or apart; **Amount**, **Segments** 1 to 64. Refused: a boundary edge, a vertex of 5 or more faces, an amount too large. |
| Bevel Vertices | **Ctrl+Shift+B** | Vertex mode: each vertex becomes a polygon; any vertex of 3 or more faces. |
| Loop Cut | **Ctrl+R** | Aim, wheel or type the cuts (1 to 32), click, slide, click. The ring stops at a boundary or a non-quad face. |
| Knife / Bisect | **K** / menu | Knife: click vertices or edges, Enter cuts, C cuts through. Bisect: drag a line; panel Distance, Flip, Fill, Clear Inner, Clear Outer. |
| Delete | **X**, Delete | By mode: a vertex takes its faces, an edge both faces. |
| Merge | **M** (At Center); Collapse, By Distance in the menu | Refuses a result that is not a valid surface. |
| Dissolve / Fill | **Ctrl+X** / **F** | Dissolve joins into one n-gon (warns if not flat); Fill closes a boundary loop. |
| Flip / Recalculate | **Alt+N** / **Shift+N** | Recalculate Outside; Inside is menu-only. |
| Subdivide, Bridge Edge Loops | menu | Bridge joins two loops of equal length. |
| Triangulate / Tris to Quads | **Ctrl+T** / **Alt+J** | |
| Duplicate / Separate | **Shift+D** / **P** | Duplicate grabs the copy; Separate moves faces to a new "<name> Part" entity. |

## Materials, UVs and colours
- **A material per face**: Mesh menu, **Material**: **Assign to Slot N**, **Assign to New Slot**, **Select / Deselect Slot N**; or drag a `.mat` from the Assets panel onto the viewport with faces selected (the selection decides, not the cursor). Slots are the entity's Materials in order (at most 32; each is a draw call). The trash button on a Materials row deletes a slot (its faces go to slot 0).
- **UV Mode**: **Auto** (default: faces are mapped by their place in the world, one tile per unit of the mesh, nothing stored; good with booleans) or **Manual** (per face, for pieces that do not grow, like a door): **Edit UVs** opens a window with the piece on the left and the texture on the right. Faces can show a **trim** (a named rectangle of a trim-sheet texture, defined there, fitted by Stretch, Fit, TileU or TileV) with turn, mirror, offset and zoom.
- **Face colours** (UV editor only, so Manual mode): a swatch and Clear tint the selected faces on top of the material, so one white material serves many colours; trims keep named colour presets, and editing a preset recolours its faces, in the build too. Sealing a piece freezes its colours.

## Edit in Shaper (generators become meshes)
**Rock Generator**, **Piper Generator** and a **Text Renderer** set to Render As Mesh have **Edit in Shaper** on their Inspector card. It is one way (Ctrl+Z right after brings the generator back) and the scene then carries every triangle (a confirmation says how big: about 1.1 kB a triangle for a rock or pipe, 2.3 kB for text). A rock keeps its Convex collider; a Piper and a Text have none.
**Piper**: a pipe swept along points (**Radius** 0.1 m outer, **Wall Thickness** 0.2, **Segments** 16, **Corner Radius** 0.4, **Corner Detail** 6). In Shaper Mode its points are what you select: **E** adds one after the selected point (it follows the mouse until the click), **Shift+E** before it, **X** or Delete removes (never fewer than 2), G moves; the Mesh menu has a **Pipe Path** group. Open paths only.

## Traps
- A Shaper Mesh collider is a Mesh shape: it cannot sit on a Dynamic Rigid Body (switch the Collider Shape to Convex or Box). A Subtract piece keeps no collider.
- Delete (and X) remove entities outside Shaper Mode and elements inside it.
- A Subtract piece is invisible by design: set Operation to None to see or move its shape as a normal mesh.
- Mirror a HALF: a fresh Cube crosses its mirror planes and overlaps its own reflection (the editor says so once when the switch goes on); delete the far faces first.
- Trims and colour presets live in the texture's `.asset` sidecar (written by the UV editor): a texture copied with its sidecar duplicates the preset ids.

## Not available yet
Torus, Grid and Icosphere shapes; a vertex extrude; a Knife cut that ends inside a face; scripting a Shaper piece (the types have no Shaper classes); a collider on a Piper.

Types: `brave/core/component/{rock-generator,mesh-renderer,collider,material}.d.ts` (the Shaper itself has no declarations)
