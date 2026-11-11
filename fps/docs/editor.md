# The Brave Editor and the Hub

How the developer works, so that an assistant can give steps in the editor's own words. The assistant cannot see the editor: ask what is on the entity, what the Console says, or for a screenshot.

## The Hub
Projects are created and opened by the **Brave Hub** (New Project, a template, or Add for an existing folder). It opens each project in its own editor window, with the editor build named by `engineVersion` in `project.json`, and it can move a project to another build (the project's `brave/core` types follow). Several projects can be open at once, one window each.

## The editor
- **Scenes panel** (the hierarchy): the entities of every open scene. Right-click lists what can be added: Empty, Camera, Free Camera, Light (Ambient, Directional, Point, Spot, Soft, Area), Reflection Probe, Skybox, Water (Sea, Still, River), Vegetation (Grass, Wheat, Flowers, Mesh Plants, Wind Zone), Tree (Pine, Blossom), Terrain, Effects (Fire, Gas Flame, Explosion: Small, Medium, Large, Atomic), Audio Volume, Audio Source, Director Volume, Director Actor, Geometry (Cube, Sphere, Cylinder, Cone, Pyramid, Plane, Quad), Shaper (the Create Shape entries), Sprite, Text, Text Area. Drag a model or a prefab from the Assets panel into it or into the Scene view to place it. Rows of scenes can be dragged to reorder the loaded scenes.
- **Scene view**: the canvas with the editor's own fly camera and the gizmos. **Shift+F** moves the camera to look at the selection (the whole scene when nothing is selected). **G / R / S** move, rotate and scale the selection (then X, Y or Z to lock an axis, and a number to type a value).
- **Inspector**: the selected entity's components as cards, **Add Component** at the end. Selecting an asset in the Assets panel shows its import settings and a viewer there instead.
- **Assets panel**: the project's `assets/` folder; right-click an empty area of a folder to create (New Folder, Script, Service, Shader, Post-Process Effect, Post-Process Stack, Material, Physics Material, Animator Controller, Animation Clip, Director, Scene) or drop files in.
- **Console**: `console.log`, warnings and errors of the editor and of Play. Read it first when something does not work.
- **Animation panel** and **Animator** window (clips, controllers), **Audio Mixer** (footer), **Project Settings** (a window: General, Layers, Quality, Physics, Navigation, Director, UI, Build).
- **Shaper**: a mode for modelling greybox meshes in the scene (Create Shape menu: Cube, Plane, Cylinder, Stairs, Arch, Rock, Piper, ...), with Blender's keys in edit mode (E extrude, I inset, Ctrl+R loop cut, X delete). It is for blocking out levels; finished models come from Blender or another tool as `.fbx` / `.glb`.

## Play
**Ctrl+P** plays and stops. In the editor, Play runs on a clone of the open scenes: nothing done during Play is kept, and Stop puts the scenes back as they were. A shipped game runs the saved scenes directly. **Ctrl+S** saves every open scene; **Ctrl+Z / Ctrl+Y** undo and redo what the editor did (edits made by a script at runtime are not in that history).

Builds: Project Settings -> Build chooses the start scene and the scenes that ship, and builds the game for the player's computer. Players need nothing installed.

## Giving editor steps
Be literal: the menu entry, the component name, the field label and its value. "Select Sun in the Scenes panel -> in the Inspector, on the Light card, set Intensity to 2" is a step; "make the light stronger" is not. For a script, give the whole file, where to save it, and which fields to fill in the Inspector.

Types: none (this is about the editor, not the API).
