# Services, the Vault and the in-game save

Three linked things: Services (game-wide singletons that scripts and the UI share), the Vault (storage that outlives the game) and the in-game save (the whole running game written to a slot and brought back).

## What it is
- A **Service** is a `@Service()` class: one object for the length of a Play, tied to no entity, never in **Add Component**. Scripts get it with `@Inject`, the UI through `remote()` (`ui.md`).
- The **Vault** is IndexedDB storage: key-value, collections, and `@Store` fields that read like plain fields. Saves live in it too, in a store of their own that `Vault.set()` and collections never touch.
- **`SaveSystem`** writes a snapshot of the running game to a named slot and restores it: a print of the game, not a merge.

## Add it
- Service: Assets panel, right-click an empty area of the folder (or the project root), **New Service**. It makes `service-00.ts` with class `Service00`. **The class name is the Service's name** (the UI says `remote('Service00')`): renaming the file does not rename the class, edit it by hand.
- Save and Vault are code only (no menu). Slots appear when a script calls `SaveSystem.save()`.
- Project Settings -> General -> **Package Name** names the game's database (below).

## Key settings
- **Package Name** (`com.example.newproject` in the template; the Hub stamps a project of its own): the Vault's database is `brave_vault_<Package Name>`. Everything stored (`@Store`, collections, saves) is in it. Renaming the package opens a different, empty database: the old data stays under the old name and is not read. An empty name falls back to one shared `brave_vault` (console warning). Set it once, early.
- `tsconfig.json` must keep `useDefineForClassFields: false`, or `@Store` and `@Inject` fields read nothing.

## Scripting
- `@Inject(Wallet)` takes the class (or its name as text). `ServiceSystem.get(Wallet)` is the same lookup without a property. Service hooks (`onAwake`, `onStart`, `onUpdate`, `onDestroy`) run once per Play on that Play's instance, not again on a resume from Pause.
- Vault: `Vault.set(key, value)`, `get<T>(key)` (gives `null` when missing), `delete`, `exists`, and `Vault.collection<T>(name)` with `add` (returns the `_id`), `get`, `getAll`, `update`, `delete`, `clear`. Values must be plain data. A `@Store` field is global to its key (every instance of the class shares it), reads `null` until written, persists in the background, and assigning `undefined` deletes it.
- Save: `SaveSystem.save(slot, details)`, `load(slot)` (false if the slot is empty, throws if damaged), `loadLatest()`, `slots()` (newest first: `slot`, `savedAt`, `size`, `scenes`, `details`), `removeSnapshot(slot)`, and `onSaved` / `onRestored` signals. `details` is plain data for your load menu.

```ts
// assets/services/wallet.service.ts
import { SaveSystem, Service, Signal } from '@brave/core';

@Service()
export class Wallet {
  gold = 0;
  onGoldChange = new Signal<number>();

  addGold(amount: number): number {
    this.gold += amount;
    this.onGoldChange.emit(this.gold);
    return this.gold;
  }

  saveGame(slot: string): Promise<unknown> { return SaveSystem.save(slot, { gold: this.gold }); }
  loadGame(slot: string): Promise<boolean> { return SaveSystem.load(slot); }

  onSave() { return { gold: this.gold }; }
  onRestore(data: { gold: number }) { this.gold = data.gold; this.onGoldChange.emit(this.gold); }
}
```

```ts
// assets/scripts/shop.ts
import { Inject, Script, ScriptComponent } from '@brave/core';
import { Wallet } from '../services/wallet.service';

@Script()
export class Shop extends ScriptComponent {
  @Inject(Wallet) wallet!: Wallet;

  onStart() {
    this.wallet.onGoldChange.on((gold: number) => console.log('gold', gold), this);
    this.wallet.addGold(10);
  }
}
```

```ts
// assets/scripts/progress.ts
import { Script, ScriptComponent, Store, Vault } from '@brave/core';

@Script()
export class Progress extends ScriptComponent {
  @Store({ customName: 'bestTime', prefix: 'game' }) bestTime?: number;

  onStart() { void this.record(); }

  private async record() {
    const scores = Vault.collection<{ player: string; points: number }>('scores');
    await scores.add({ player: 'Ana', points: 120 });
    this.bestTime = Math.min(this.bestTime ?? Infinity, 42);
  }
}
```

## What a save restores
- Every loaded scene (order, active flag), its entities and components: each field as a scene file writes it, plus `@Saved()` fields and what `onSave()` copied into a field. Entities spawned while playing and prefab instance subtrees are in it. Map, Set and Date are written in a save (not in a scene file).
- Each Service that has `onSave()` (return plain data) and `onRestore(data)`; the Audio Mixer's active preset. Engine components rebuild themselves (Audio Source and Player, physics bodies, nav agents, cameras); components of plain fields need nothing.
- **`@JsonIgnore() @Saved()`** keeps a runtime-built field in a save but out of scene files; `@Saved()` alone means nothing (an un-ignored field is in every save).
- Not saved: static or module-level variables, `Input` listeners, `Invoke` timers, `Signal` listeners, native handles, functions, instances of unregistered classes, references between entities of different scenes.

```ts
import { Class, Input, JsonIgnore, Saved, Script, ScriptComponent } from '@brave/core';

@Class()
export class Note {
  text = '';
  seen = false;
}

@Script()
export class Door extends ScriptComponent {
  @JsonIgnore() @Saved() openedAt = 0;
  notes = new Map<string, Note>();
  @JsonIgnore() private listener?: ReturnType<typeof Input.keyboard.keyE.down>;

  onStart() { this.listen(); }
  onRestore() { this.listen(); }
  onDestroy() { if (this.listener) Input.removeListner(this.listener); }

  private listen() {
    this.listener = Input.keyboard.keyE.down(() => { this.openedAt = Date.now(); });
  }
}
```

## Your own classes (TypedJson)
- A class that is a field of a script, or inside `onSave()` data, needs `@Class()`; an unregistered one is dropped silently. It must work with `new X()` and no arguments.
- `@JsonIgnore()` on anything native or rebuilt: subscriptions, listener handles, DOM nodes, timer ids, GPU or audio objects.
- Only own fields are written, back-fields of getter/setter pairs included; loading assigns them directly, so a setter's side effects do not run. Rebuild in `onLoad()` / `onRestore()`.
- Renaming or removing a field drops the stored value from old scenes and saves, with no warning.

## Traps
- A component that had started is restored without `onAwake()`, `onStart()` or `onEnable()`: register what they set up (`Input`, `Signal` listeners, timers, native handles) again in `onRestore()`, and remove old ones in `onDestroy()`.
- `load()` destroys the running scenes' scripts, including the one that called it: call it from a Service (they are not replaced) or the UI.
- Order: a Service's `onRestore(data)` runs first, while the old scenes still run (do not touch scene entities there); then the swap; then every component's `onRestore()`. A throwing `onSave()` fails the save; a throwing `onRestore()` is logged and the rest go on.
- In the editor `load()` works only while Play runs. A Service's UI page learns nothing by itself: emit a `Signal` in `onRestore()` (`ui.md`).
- A Service is built fresh each Play (a shipped game has one Play). Never keep an instance across Play: `@Inject` or `ServiceSystem.get()` again. The constructor runs more than once (also at hot reload): no timers there, use `onStart()`; `Invoke` timers stop at Stop.
- Scene scripts start before Services do, so an injected Service in `onStart()` is built but has not run its own `onStart()`.
- Two Services with the same class name collide.
- The Vault is real storage even in the editor: what Play writes stays after Stop.
- **After a load the private handles `onStart()` filled are `undefined`** (`this.health = getComponent(...)`) and a `Signal` field is a new empty one. Write ONE `bind()` that finds the handles and registers the listeners, and call it from `onStart()` and from `onRestore()` (`if (this.started)`).
- **`Invoke` timers and `NavAgent.target` are not saved.** A countdown that must survive a load (a respawn) is a `@Saved()` field decremented in `onUpdate()`, and the script that gave an agent its target gives it again in `onRestore()`.

## Not available yet
- A readiness gate for a load (the first frame after one may stutter while new scenes compile); scene-scoped Services.

Types: `brave/core/system/save-system/`, `brave/core/system/service-system/service-system.d.ts`, `brave/core/static/vault/`, `brave/core/decorator/{service,inject,store,class}.decorator.d.ts`, `brave/core/module/typed-json/`, `brave/core/interface/lifecycle-hooks.interface.d.ts`
