# UI

The game's interface (menus, HUD, inventory) is a web page layered over the game canvas, built as a separate project in `ui/`: plain HTML/CSS/JS or any framework that produces static files. It talks to the game only through Services.

## What it is
- The engine does not draw it. The page is a transparent overlay (an iframe) over the game. In-world text (nameplates, signs) is the Text component, not this.
- **The Bridge**: the page calls `remote<T>('ClassName')` and gets that Service's methods as async calls, its plain fields as get/set, and its `Signal` fields as subscriptions, typed with `import type`. No event-name strings. Services themselves: `save-and-services.md`.
- `ui/` is at the project root, a sibling of `assets/`, never inside it.

## Add it
- Create `ui/` with an `index.html` in it (a plain page needs no build step). There is no starter yet.
- Create the Services the page talks to: Assets panel, **New Service** (`save-and-services.md`).
- The editor writes TypeScript declarations for the page into `ui/.brave/services/`, one `.d.ts` per `.ts` under `assets/` and mirroring its folders (`assets/services/wallet.service.ts` becomes `ui/.brave/services/services/wallet.service.d.ts`). It does so only when `ui/` exists, a moment after an asset changes. Import types from there; nothing of the engine reaches the page.
- See it: the **Scene view** shows the overlay (header toggle **Show UI (Scene view)** / **Hide UI (Scene view)**); the Editor view hides it. It also shows while stopped, as a layout preview of the Services' editor-time state.

## Key settings
Project Settings -> **UI** (shown as UI Overlay). Stored on this machine, not in `project.json`, so teammates can differ.
- **Serve Mode**: **Editor (automatic)** (default): the editor serves `ui/dist/` if `ui/dist/index.html` exists, else `ui/` if `ui/index.html` exists, on `127.0.0.1`, at **Port** 3010; file changes reload the overlay. If the port is taken (another editor) it uses a free one and says so under the field. **External (I run my own server)**: **Dev Server URL** (`http://localhost:3010`), for `ng serve` and similar; the editor only points at it.
- These settings only affect the editor's preview, never a build.
- **What a build ships**: Project Settings -> **Build** copies `ui/` into the game; when `ui/package.json` has a `build` script it runs `npm run build` first and copies `ui/dist/` instead (`dist/` must exist afterward). The shipped game loads `ui/index.html` from the build; with no `ui/` it simply has no overlay. Packaging details are the build system's concern.

## Scripting
Game side: write Services (`save-and-services.md`). The one switch is `UISystem.interactive` (default `true`):

```ts
import { Script, ScriptComponent, UISystem } from '@brave/core';

@Script()
export class PauseMenu extends ScriptComponent {
  open() { UISystem.interactive = true; }
  close() { UISystem.interactive = false; }
}
```

`false` gives the page no events at all (the mouse goes straight to the game) and hands keyboard focus back to the game: use it while only a HUD is on screen. With the `Wallet` Service of `save-and-services.md`, the page side looks like this (fragment, not compiled with the game):

```text
import { remote, enablePointerBridging } from '@brave/ui-bridge';
import type { Wallet } from './.brave/services/services/wallet.service';

enablePointerBridging();                    // once, at start
const wallet = remote<Wallet>('Wallet');    // the class name is the address

const total = await wallet.addGold(5);      // method: always a Promise; a throw rejects with its message
const gold = await wallet.gold();           // plain field read: no argument
await wallet.gold(50);                      // plain field write: one argument
wallet.gold().then(render);                 // the state now ...
const sub = wallet.onGoldChange.on(render, { sampleEvery: 250 });   // ... and every change; sub.off() stops
```

Without a bundler load `./node_modules/@brave/ui-bridge/dist/index.global.js` in a `<script>` and use `BraveUiBridge.remote('Wallet')` and `BraveUiBridge.enablePointerBridging()`.

Rules for what crosses:
- Lifecycle members (`onStart`, `onUpdate`, `onSave`, `onRestore`, `active`, ...) are not callable from the page.
- Signals are throttled, not queued: per subscription only the latest value, at most once per `sampleEvery` ms (default 100), and only if it is not `===` the last one sent. `emit({ hp, max })` always looks new; prefer primitives for per-frame signals.
- Payloads and arguments must survive `postMessage`: no functions, no engine objects such as a `Vector3`. Send numbers, strings and plain objects.

Click-through: start the page's stylesheet from "nothing is clickable" and opt controls in, or the page swallows every mouse event over the game (camera, gizmos, click-to-lock):

```css
* { pointer-events: none; }
a, button, input, select, textarea, [role="button"] { pointer-events: auto; }
```

## Traps
- **A Signal delivers changes, not state.** A page that loads or reloads hears nothing until the next `emit`, so it shows its placeholder while the Service holds the real value. Read the field once, then subscribe. A Service should also emit its starting values in `onStart()` and after a load in `onRestore()`.
- The class name is the address: renaming a Service class breaks the page's `remote('...')`. Two Services with one class name collide.
- Each Play builds fresh Services; in the editor the page reloads when a Play ends. A Service's state does not carry into the next Play.
- The page runs sandboxed (scripts only, no origin of its own) in the editor's automatic mode and in a build: no `localStorage`, cookies or IndexedDB, and `fetch`/XHR/WebSocket only reach the page's own files (plus `blob:` and `data:`). Keep data in a Service or the Vault. In External mode the page is a normal one on your dev server, so it does not show these limits: check the editor-served or built UI before shipping.
- Keyboard goes to the page while it holds focus. Only Escape is forwarded to the game, always. A mouse press on empty page space returns keyboard focus to the game.
- `remote()` only works inside the game's overlay; opened in a browser tab nobody answers. A subscription to something that is not a Signal logs once and never fires.
- If `ui/` has neither `index.html` nor `dist/index.html` the editor logs "nothing to serve" and shows no overlay.

## Not available yet
- A "Create UI Project" starter, and `@brave/ui-bridge` is not in the new-project template: the package the page imports (`remote`, `enablePointerBridging`) has to be provided to `ui/` by hand for now.
- Forwarding keys other than Escape to the game; Services that live across several Plays or per scene.

Types: `brave/core/module/bridge/remote.d.ts`, `brave/core/module/bridge/bridge-protocol.d.ts`, `brave/core/system/ui-system/ui-system.d.ts`, `brave/core/system/service-system/service-system.d.ts`, `brave/core/decorator/service.decorator.d.ts`
