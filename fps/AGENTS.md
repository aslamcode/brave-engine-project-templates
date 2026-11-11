# AGENTS.md

This is a **Brave Engine** game project: a 3D game made with the Brave Editor, TypeScript scripts and WebGPU. This file is for AI coding assistants and for developers. It is short on purpose: read it all, then open the topic file for the work in front of you.

> **Your tool does not read `AGENTS.md`?** Create the file it expects (`CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.github/copilot-instructions.md`, ...) and put in it one line that points here (for Claude Code: `@AGENTS.md`), or the tool's own import syntax. If it cannot import, copy this file under the name it wants. Keep **one** source of truth: change `AGENTS.md`, not the copy.

## What you must know first
- The developer builds scenes in the **Brave Editor** and writes **scripts in TypeScript**. Projects are created and opened by the Brave Hub. Play is **Ctrl+P** in the editor; a shipped game comes from Project Settings -> Build. Players and developers need no Node.
- **You cannot see the editor.** Ask what is selected, what the Console says, or for a screenshot. Do not guess what is in a scene.
- **The API is the types.** `brave/core/**/*.d.ts` is the whole public API with its comments (the Hub puts the declarations of the project's engine version there, and replaces them when it moves the project to another version). Search it before you use any class, method or decorator, and never invent a name. When these docs and the types disagree, **the types win**. The docs were written for engine 0.9; `engineVersion` in `project.json` says which build the project uses.
- If the engine does not do something, say so plainly. Do not fake it with browser APIs or workarounds the developer did not ask for.
- A project made from a **template** (a shooter, a platformer) may have `docs/template.md`: what that template is, how its parts are built and how to extend them. Read it before changing what the template brought.

## Topic files (`docs/`)
| Open it for | File |
|---|---|
| Writing a script: lifecycle, Inspector fields, events, timers, spawning | `docs/scripts.md` |
| Keyboard, mouse, pointer lock | `docs/input.md` |
| Scenes, loading scenes from code, prefabs, asset types, sidecars, `project.json`, who edits what | `docs/scenes-and-assets.md` |
| The editor's panels, shortcuts, how to give editor steps | `docs/editor.md` |
| Characters, character cameras, animation, 2D sprite animation | `docs/characters-and-animation.md` |
| Physics: bodies, colliders, layers, triggers | `docs/physics.md` |
| AI that walks | `docs/navigation.md` |
| Sound and the mixer | `docs/audio.md` |
| Services, the Vault, saving the game | `docs/save-and-services.md` |
| The game's UI (web overlay) | `docs/ui.md` |
| Lights, shadows, the sky, reflection probes | `docs/lighting.md` |
| The Camera component, post-processing (`.pps`), materials, shaders, quality settings | `docs/rendering.md` |
| Terrain and its sculpting and painting | `docs/terrain.md` |
| Trees, grass and other vegetation, water, wind | `docs/vegetation-trees-water.md` |
| The Shaper: greybox modelling in the editor | `docs/shaper.md` |
| Particles, fire, explosions, decals and stains | `docs/effects.md` |
| Text in the world, fonts, sprites | `docs/text-and-sprites.md` |
| The Director: a controller for an area | `docs/director.md` |

## The project
```text
project.json         settings (edited by Project Settings; the editor writes the whole file)
assets/              everything the game is made of
  scenes/<name>/     one folder per scene: the .scn and what only it uses (scripts, .pps, .director, clips, materials)
  scripts/ services/ shared scripts and services
  prefabs/<name>/    things you place in scenes: a model, its materials and textures, its prefab
  materials/ textures/ audio/ fonts/ physics-materials/ shaders/   shared assets
ui/                  the game's web UI, if it has one (docs/ui.md)
docs/                these files
brave/               the engine's type declarations (generated; not committed)
```
Organise by scene and feature, not by file type: what only one scene uses lives in that scene's folder; only what is shared gets a top-level folder. Empty folders hold a `.gitkeep`. The editor needs none of these folders to exist.

## Rules that save an afternoon
1. **Scripts**: `@Script()` and `extends ScriptComponent`, one component per file, added to entities in the editor. Never `new MyComponent()`: use `entity.addComponent(MyComponent)`. See `docs/scripts.md` for when each lifecycle method runs.
2. **Do not touch `useDefineForClassFields: false`** in `tsconfig.json`; `@Store` and `@Inject` stop working without it. The project compiles in **strict mode** (TypeScript 6's default): declare a field the Inspector fills as `target!: Entity` (or `target?: Entity` when it may stay empty).
3. **The editor owns** `.scn`, `.fab`, `.mat`, `.pmat`, `.pps`, `.animator`, `.director` and `project.json`: it keeps them in memory and rewrites them on save. Do not edit them by hand unless asked, and then with the editor closed. For scene work give editor steps (menu, component, field, value).
4. **Never write, copy or delete a `*.asset` sidecar.** It holds the asset's id; everything refers to assets by id. Move and rename assets in the Assets panel.
5. **Binary assets** (`.mdl`, `.anim`, `.font`, textures, audio) are not text: never rewrite them. They are tracked by Git LFS (see `.gitattributes`).
6. **Events for scripts are `Signal`s**, not RxJS subjects. Timers are `Invoke.setTimeout`, not `setTimeout` (the engine freezes them on Pause and cancels them on Stop). Input is callbacks, not polling.
7. **In the editor, Play runs on a clone of the scenes**: what you do during Play is not kept, and listeners belong in `onStart()`.
8. **The editor does not type-check scripts.** A type error does not stop anything; VS Code shows it (Problems panel), so read it there and fix what it reports.
9. **`general.packageName`** in `project.json` names the game's save database; changing it later starts an empty one. Set it early.
10. **Never commit** `brave/`, `node_modules/`, `*.ktx2` (already in `.gitignore`).

## How to help
- For a **script**: write the whole file, say where it goes (`assets/scenes/<name>/...` or `assets/scripts/...`) and which fields to set in the Inspector.
- For **scene or asset work**: give literal editor steps. If the developer asks you to edit a JSON asset, ask them to close the editor first, keep every `id` as it is, and say what you changed.
- Match the project's style: the shipped `eslint.config.js` (single quotes, two spaces, semicolons). TypeScript, English identifiers and comments unless the developer says otherwise.
- Prefer the engine's own components (Character Controller, Audio Source, Nav Agent, ...) to rebuilding them; the topic files say what exists.
- Before a long change, state the plan in a few lines and which files it touches.
