# Scenes, prefabs, assets and project.json

What the files in the project are, which ones the editor owns, and how scenes are loaded.

## Scenes
- A scene is a `.scn` file: a JSON list of entities with their components (TypedJson: each object carries its `$type`). The editor can have **several scenes open at once**, each with its own on/off switch; the order of the loaded scenes is the order they update in.
- First scene to open: the project's template starts with `scenes/main/main.scn`. Give every scene its own folder (`scenes/<name>/`) and keep what only that scene uses in it: its scripts, `.pps`, `.director`, clips, materials.
- **Scene names are the file names and must be unique in the project** (`level-2.scn`): the build, the runtime and `SceneSystem` find a scene by that name, not by path.
- Project Settings -> **Build**: the **start scene** (opened when the game boots) and the list of scenes the build ships. A scene that is not on the list is not in the game and `SceneSystem.load()` will not find it.
- In a script (`SceneSystem` takes the file name):
```ts
import { BraveEngine, SceneSystem, Script, ScriptComponent } from '@brave/core';

@Script()
export class LevelChanger extends ScriptComponent {
  // Swaps every loaded scene for another one.
  async goTo(name: string) {
    const before = [...BraveEngine.scenes];
    const next = await SceneSystem.load(name);
    if (!next) return;
    before.forEach(scene => SceneSystem.unload(scene));
  }
}
```
  `SceneSystem.load(name)` builds the scene and switches it on; it gives `null` when the name is unknown or the scene is already loaded. `preLoad(name)` builds it switched off, so you can load during a transition and call `SceneSystem.enable(scene)` later; `disable(scene)` switches one off without losing it; `unload(scene)` destroys it.

## Prefabs
- A prefab is a `.fab`: a saved entity with its children. Make one from an entity in the Scenes panel (right-click: **Save as Prefab**) or by dragging the entity into the Assets panel; the entity in the scene then becomes an instance (a `PrefabInstance` component). Edit the prefab and every instance follows.
- Place one in a scene by dragging the `.fab` from the Assets panel. Imported models (`.mdl`) can be dragged into a scene directly and need no prefab.
- Keep a prefab and the model, materials, textures, animator and clips it uses together in one folder (`prefabs/<name>/`). Spawning from a script: `scripts.md`.

## Assets and their sidecars
Every asset file has a **sidecar** next to it: `name.ext.asset`, a one-line JSON with the asset's `id`, its `name` and its `type` (textures and others add a `data` object with the import settings). **The id is how everything refers to the asset**, never the path, so moving or renaming keeps every reference alive.
- The editor creates the sidecar when a file appears in `assets/`. Drop files into the Assets panel or copy them into the folder: they are imported.
- **Never write, copy, duplicate or delete a sidecar by hand.** A sidecar copied to a second file makes two assets with one id. Move, rename and delete assets in the Assets panel; outside it, move the sidecar together with its file and with the editor closed.
- Import settings (texture size and filtering, compression, a font's character sets, ...) are the sidecar's `data`, edited in the Inspector when the asset is selected.
- Generated and ignored by Git: `*.ktx2` (compressed texture caches), `brave/` (the engine's type declarations), `node_modules/`.

| Extension | What it is | Made by |
|---|---|---|
| `.scn` | Scene | Assets panel: **New Scene** |
| `.fab` | Prefab | Save as Prefab |
| `.mat` | Material | **New Material**, or Save As Material Asset on a material in the Inspector |
| `.pmat` | Physics material (friction, bounciness, density) | **New Physics Material** |
| `.pps` | Post-process stack (a camera's screen effects) | **New Post-Process Stack** |
| `.anim`, `.animator` | Animation clip (binary), animator controller | **New Animation Clip**, **New Animator Controller**, imports |
| `.director` | Director (a state machine for an area) | **New Director**, or "+ New" on a Director Volume |
| `.mdl` | Model in the engine's own format | Import of `.fbx`, `.gltf`, `.glb`, `.obj` (the source stays beside it) |
| `.font` | Baked font | Import of `.ttf`, `.otf`, `.woff` |
| `.wav` `.mp3` `.ogg` `.opus` `.webm` | Audio | Drop in |
| `.png` `.jpg` `.webp` `.hdr` `.exr` `.dds` `.tga` | Textures (an `.hdr` or `.exr` can be a sky) | Drop in |
| `.ts` | Scripts and services | **New Script**, **New Service** |
| `.sdr`, `.ppfx` | Custom shader, custom post-process effect | **New Shader**, **New Post-Process Effect** |

A model imported from `x.fbx` writes `x.mdl` and folders `x-materials`, `x-textures` and `x-animations` beside it (older imports may say `x_materials`).

## project.json
Edited in **Project Settings** (General, Layers, Quality, Physics, Navigation, Director, UI, Build). Sections: `name`, `engineVersion` (the Hub's: which editor build opens the project; never edit it), `layers`, `quality`, `general` (`version`, `packageName`, `company`, `copyright`, `description`, `iconAssetId`), `physics` (`tickRateHz`, `gravity`, `ignoredLayerPairs`), `navigation`, `director` (the roles), `build` (`scene.start`, `scene.scenes`, `screen.defaultMode`).
- `general.packageName` is the game's identity: the Vault's database is `brave_vault_<packageName>` and the build is named from it. Changing it later starts an empty save database. Set it once, early.
- The editor **writes the whole file** whenever it saves the settings.

## Who edits what
- **Yours, freely:** `.ts` scripts and services, Markdown, `eslint.config.js`.
- **The editor owns; edit by hand only when asked and with the editor closed:** `.scn`, `.fab`, `.mat`, `.pmat`, `.pps`, `.animator`, `.director`, `project.json`.
- **Never by hand:** `*.asset` sidecars, `.anim`, `.mdl`, `.font`, `*.ktx2`, everything under `brave/`.

The editor keeps an open scene in memory and rewrites its file on save, so a scene edited on disk while it is open is overwritten. For scene work, give the developer the editor steps (menu, component, field and value) instead of editing the file.

Types: `brave/core/system/scene-system/`, `brave/core/system/prefab-system/`, `brave/core/system/asset-system/`, `brave/core/common/scene.d.ts`, `brave/core/interface/project-file.interface.d.ts`
