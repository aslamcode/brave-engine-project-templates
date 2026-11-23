# Input

Input is push-based: you register a callback and the engine calls it. There is no polling (`Input.getKey()` does not exist). Ask for what the player **does** (an *action*: `jump`, `interact`), not for a key: the keyboard, the mouse and a gamepad then all work, and the player can move any key in the game's Controls screen.

## Actions: what a script asks for
An action is a name, a type and a list of controls (its *bindings*). You declare them in **Project Settings > Input** (they are saved in `project.json` under `input`), and a script asks by name:

```ts
import { EventListner, Input, JsonIgnore, Script, ScriptComponent } from '@brave/core';

@Script()
export class Flashlight extends ScriptComponent {
  @JsonIgnore() private listener?: EventListner;

  onStart() {
    this.listener = Input.action('flashlight').down(() => { this.entity.active = !this.entity.active; });
  }

  onDestroy() {
    if (this.listener) Input.removeListner(this.listener);
  }
}
```

- Types: **`button`** (`down`, `up`, `on(boolean)`), **`axis`** (a number, `on(number)`), **`vector2`** (two, `on(Vector2)`: a compass such as WASD or a stick). For an axis or a vector2 `down` means "left rest" and `up` "came back to rest". `on` fires at every change, including back to 0.
- A binding is a key (`code`: the *place* of the key, so WASD is the same place on an AZERTY keyboard), a mouse button, the wheel, the mouse's movement, a gamepad button, a stick or a trigger, or a **composite** (four buttons as a compass, two as an axis). An action can have several, on the keyboard and on a pad at once: they all work at the same time.
- **Declare no key in a script.** The engine's own actions are always there and the engine's components use them: `move` (WASD / left stick), `look` (mouse / right stick), `jump` (Space / A), `run` (Shift / left stick click), `crouch` (Ctrl / B), `zoom` (wheel / D-pad). `Player Movement` and the cameras have a `Player` field (0 is the first player).
- A `delta` action (`look`, `zoom`) gives an amount of change in the mouse's counts, y growing downward: the mouse and the wheel as they come, a stick as `value x scale x seconds` every frame (`scale`: counts a second at full tilt).
- The callback gets `{ action, player, device, native?, preventDefault() }` (`device` is `keyboardMouse` or `gamepad`). Every registration is an `EventListner` like the raw ones: `Input.removeListner(listener)`, and Stop removes them all.
- What is held when a script starts listening is not a press. An action the project does not have warns once and does nothing.
- A gamepad is read once a frame (the browser has no event for a button). The Xbox, PlayStation and Switch Pro layouts are the same to a script; the names and icons follow the pad.

### What a prompt shows
`Input.actions.labelOf('interact')` is what the control is called now (`E`, `Left Mouse`, `X`, `RT`...), in the device the player used last, with the player's own keys: use it, never write "Press E". In the UI (HUD, menus) `Input` of `@brave/ui-bridge` does the same, and plain HTML needs no code: `<kbd data-input-action="interact">E</kbd>` (the page keeps it up to date and says what it shows with `data-input-showing`, `data-input-button`, `data-input-style`, for CSS to draw an icon). `Input.actions.onChange` (engine) / `Input.actions.onChange.on(...)` (UI) tells when the controls or the device change. The project's own words for a key go in the language files: `input.keys.Space`, `input.mouse.left`, `input.actions.interact`.

### The player changes a key
`Input.actions.rebind({ action, family, slot })` (the UI's `Input.actions.rebind` too) waits for the next key or button and binds it; Esc cancels. A key that is already used is swapped with its owner by default (`policy`: `swap`, `unbind`, `refuse`, `allow`). While it waits nothing pressed does anything in the game. The change is kept by the engine, in its own room of the Vault, in the game's database: the game writes no save code, and a default you fix later reaches every player who never moved that key. `Input.actions.resetBindings()` goes back. The editor's Play keeps a developer's own changes too: Project Settings > Input has "Clear saved player bindings".

### Players
A game for one never thinks about it: the keyboard, the mouse and every pad are player 0. For local co-op assign each pad when its person joins (`Input.actions.players.assignGamepad(index, player)`, `keyboardPlayer`), and use `Input.action('jump', { player: 1 })` or the `Player` field of the components.

## The raw keys and mouse events
They are what the engine is built on and stay for a debug hotkey; a script that reads one is that key for ever and the player cannot move it.
- Per-key callbacks: `Input.keyboard.keyW.down(cb)`, `.up(cb)`, `.typed(cb)`, `.press(cb)` (the full list is in `brave/core/input/input-event-system-keyboard.d.ts`); mouse: `Input.mouse.left.down(cb)`, `Input.mouse.wheel.up(cb)`, `Input.mouse.move(cb)`...
- Raw events of any key or button: `Input.keyDown(cb)`, `keyUp`, `keyPress`, `mouseDown`, `mouseUp`, `mouseMove`, `mouseWheel`. Composed: `Input.move(cb)` (WASD as a `Vector2`) and `Input.look(smoothSamples, cb)`.
- Every registration returns an `EventListner`; `Input.removeListner(listener)` unregisters it. `Input.removeAllListners()` runs on Stop, `Input.active = false` silences everything (actions too), `Input.context` is the DOM element that receives the events (the window by default).

## Traps
- **`down` fires once per press.** A held key sends `keydown` repeats from the operating system; they do not reach `down`. Use **`typed`** (a raw key) when the repeats are the point. The raw `Input.keyDown(...)` sees every repeat, with `event.repeat` set.
- **Callbacks are a chain.** Each handler receives `(event, next)` and the chain goes on only if it calls `next(event)`; the last one needs no `next`. Most scripts pass one callback and ignore `next`.
- Register in `onStart()` and remove in `onDestroy()`; a listener left behind keeps calling a destroyed script.
- Pointer lock: `Cursor.lock()` must run inside a real user event; it resolves `true` when locked and `false` when refused, never rejects. A click on the game view locks the cursor by itself while the game runs (`Cursor.autoLockOnClick`, default on); a menu-driven or 2D game sets it to `false` once.
- Character movement (`Player Movement`, the cameras) reads the actions for you: see `characters-and-animation.md` before writing your own.
- **The click that locks the pointer also reaches an action bound to the mouse button**, before the lock exists: a shooter must not fire on it. Check `Cursor.isLocked` at the press (false for the locking click).
- **Input callbacks keep firing while the game is paused**: check `BraveEngine.mode === BraveEngineModeEnum.Running` inside them, or a script shoots from the pause menu. (Menus against gameplay are not separate contexts: an action listens as long as it is registered.)
- A stick drifting on a table never counts as the player picking up the pad, and the pad is read from the first frame it is touched.

Types: `brave/core/static/input.d.ts`, `brave/core/input/action/` (the actions), `brave/core/input/`, `brave/core/static/cursor.d.ts`
