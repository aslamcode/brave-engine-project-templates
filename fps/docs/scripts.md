# Scripts and components

A game's code is TypeScript files under `assets/`. Each file defines a component (`@Script()` + `extends ScriptComponent`) that you add to entities in the editor; the engine calls its lifecycle methods.

## Add it
- Assets panel, right-click an empty area of a folder (or of the project root; folder rows have no such menu): **New Script** (a component) or **New Service** (a singleton, see `save-and-services.md`). Files are kebab-case (`enemy-brain.ts`); put them next to the scene or feature that uses them (`scenes/<name>/`), or in `scripts/` when shared.
- Entity selected: Inspector, **Add Component**, pick the script. Fields you decorated show up there.
- The editor bundles scripts with esbuild and **does not type-check**: a type error never stops the build, it shows only in VS Code (Problems panel). Saving a script hot-reloads it into the running editor: instances keep their values, methods are replaced, new fields get their defaults, removed ones are deleted, `onHotReload()` is called.
- Keep ONE `@Script()` component per file. Other npm packages need `npm install` in the project folder (the only thing here that needs Node).

## When things run
`onLoad` -> `onAwake` -> `onStart` -> `onUpdate` every frame.
- `onLoad()`: once, when the entity is loaded into a scene, in the editor too. Rarely needed in game scripts.
- `onAwake()`: once at Play start (or when instantiated while playing). Other components may not have awoken yet.
- `onStart()`: once, before the first update, after every `onAwake()` has run. Use it to talk to other entities and to register listeners.
- `onUpdate()`: every frame while the game runs. Not called in the editor, not while paused. Use `Time.deltaTime` (scaled by `Time.scale`) or `Time.unscaledDeltaTime`.
- `onFixedUpdate()`: a physics hook. It rides the physics step (rate: Project Settings -> Physics), not its own clock. Put physics forces here.
- `onEnable()` / `onDisable()`: each time the entity or component goes active/inactive. A component enabled again gets `onEnable()` again, never `onAwake()`/`onStart()` again.
- `onDestroy()`: before removal. Remove listeners here.
- `onHotReload()`, `onAfterClone()`: see above and below. `onSave()` / `onRestore()`: see `save-and-services.md`.

The game has three modes (`BraveEngine.mode`): editor, running, paused. **Pause** stops `onUpdate`, `Invoke` timers, animation and physics steps; rendering goes on. **Stop** destroys what Play made, cancels every `Invoke` timer and removes every `Input` listener.

## Skeleton
```ts
import { Float, Script, ScriptComponent, Time } from '@brave/core';

@Script()
export class Spinner extends ScriptComponent {
  @Float({ label: 'Speed', suffix: 'deg/s' }) speed = 90;

  onUpdate() {
    this.entity.transform.rotation.y += this.speed * Time.deltaTime;
  }
}
```

## Inspector fields
A field shows in the Inspector only if decorated: `@Float`, `@Int`, `@Bool`, `@String`, `@Vec2`, `@Vec3`, `@Quat`, `@Color`, `@Select`, `@Slider`, `@Button` (on a method), `@Texture`, `@List(Type)`. Common options: `label`, `header`, `tooltip`, `suffix`, `visibleWhen`, `disabledWhen`. They work on setters too (use a setter when assigning must do something).
- `@Ref(Type)` references something in the scene: `@Ref(Entity) target!: Entity;` or `@Ref(AudioSource) audio!: AudioSource;` (an entity, or a component of an entity). The `!` is needed: the project compiles in strict mode (TypeScript 6's default) and the Inspector, not the constructor, fills the field. Use `target?: Entity` when it may stay empty. Prefer it to searching by name: it is set in the Inspector and survives renames.
- `@Ref(Marker, { picker: true })` references an asset (markers such as `FontAssetMarker`, `DirectorAssetMarker`); `@Texture()` holds a texture asset id.
- `@State()` marks a boolean state the Sprite Animator can listen to; `@Callable()` marks a method a `.director` may call. Neither shows in the Inspector.
- Every field is **saved in the scene** unless `@JsonIgnore()`. Mark listeners, handles and anything native or rebuilt at runtime `@JsonIgnore()`.

## Finding and making things
- `this.entity` is the owner; `.transform` (`position`, `rotation` in degrees, `scale`, `globalPosition`, `forward`, `right`, `up`, `lookAt()`, `translate()`), `.name`, `.parent`, `.children`, `.active`, `.layer`, `.scene`.
- `entity.getComponent(Type)` returns the component (or nothing); `entity.addComponent(Type)` adds one. **Never `new MyComponent()`**: the engine must build it.
- `entity.clone()` copies an entity; `scene.add(entity)` puts a new or cloned one in a scene. A prefab instance is spawned with `PrefabSystem.instantiate(prefabId)`, which returns detached roots to add under an entity inside a scene; the id is the one in the prefab's `.fab.asset`.
- Other scenes: `scenes-and-assets.md` (`SceneSystem.load('level-2.scn')`).

## Events, timers, input
```ts
import { Entity, Float, Ref, Script, ScriptComponent, Signal, Vector3 } from '@brave/core';

@Script()
export class Proximity extends ScriptComponent {
  @Ref(Entity) target!: Entity;
  @Float({ suffix: 'm' }) radius = 3;

  onEntered = new Signal<Entity>();
  private inside = false;

  onUpdate() {
    if (!this.target) return;
    const near = Vector3.distance(this.entity.transform.globalPosition, this.target.transform.globalPosition) < this.radius;
    if (near && !this.inside) this.onEntered.emit(this.target);
    this.inside = near;
  }
}
```
- Events for scripts are **`Signal`**: `signal.on(callback, this)` (the target is held weakly, so a script that is gone is dropped on the next `emit`), `signal.emit(data)`. Never expose an RxJS `Subject`.
- Timers: use **`Invoke.setTimeout` / `setInterval`** (and the `Unscaled` variants), not the browser's: they freeze on Pause and are cancelled on Stop. A native timer survives Stop and keeps running.
- Input is callback-based; there is no polling (`input.md`). Register in `onStart()`, remove in `onDestroy()`:
```ts
import { Entity, Input, JsonIgnore, Ref, Script, ScriptComponent } from '@brave/core';

@Script()
export class Flashlight extends ScriptComponent {
  @Ref(Entity) lamp!: Entity;
  @JsonIgnore() private listener?: ReturnType<typeof Input.keyboard.keyF.down>;

  onStart() {
    this.listener = Input.keyboard.keyF.down(() => { this.lamp.active = !this.lamp.active; });
  }

  onDestroy() {
    if (this.listener) Input.removeListner(this.listener);
  }
}
```

## Traps
- **Do not change `useDefineForClassFields: false`** in `tsconfig.json`. With it on, declared fields become own properties that shadow the accessors `@Store` and `@Inject` install; they then read nothing, and the editor's Play hides it (a compiled build does not).
- **In the editor, Play runs on a clone of the open scenes**, and the clone is not `onLoad`ed. Register listeners in `onStart()`/`onAwake()`, not in the constructor or `onLoad()`. Changes made during Play are not kept; Stop returns the scene as it was. A shipped build runs the scene as saved, with no clone.
- Talk to other components and entities in `onStart()`, not in the constructor: that is the point where all of them exist and have awoken.
- **A class that builds on another script** takes the base class's Inspector fields with `@Script({ inheritProperties: true })` (the base is a script of its own: it shows in Add Component unless it says `hidden: true`; a subclass changes a base field's DEFAULT with a plain initializer, `prompt = 'Open door'`). `@Select` on a script field needs `optionsKey` naming a `@JsonIgnore() protected` array of `{ value, description }`.
- **`getComponent` looks at one entity**: to find a component upward walk `entity.parent`. `component.activeInHierarchy` says the component and every entity above it are on (`entity.active` is only its own).
- **The engine's own components have common names** (`Spawner`, ...): a project script with the same class name clashes in the registry. Pick another (`WaveSpawner`).
- **To write a bone-like transform every frame**: `transform.setLocalSilently(position, rotation, scale)` then `transform.updateTransform()`. `Quaternion` has no `set(x, y, z, w)`: assign `x`, `y`, `z`, `w`.

Types: `brave/core/component/component.d.ts`, `brave/core/component/script/`, `brave/core/entity/entity.d.ts`, `brave/core/component/transform.d.ts`, `brave/core/interface/lifecycle-hooks.interface.d.ts`, `brave/core/decorator/`, `brave/core/static/{time,invoke}.d.ts`, `brave/core/module/signal/`
