# Input

Keyboard and mouse are push-based: you register a callback and the engine calls it. There is no polling (`Input.getKey()` does not exist).

## Scripting
- Per-key callbacks: `Input.keyboard.keyW.down(cb)`, `.up(cb)`, `.typed(cb)`, `.press(cb)`. Keys are `keyA`..`keyZ`, `digit0`..`digit9`, arrows, `shiftLeft`/`shiftRight`, `controlLeft`, `altLeft`, `space`, `backspace`, numpad, function and navigation keys (the full list is in `brave/core/input/input-event-system-keyboard.d.ts`).
- Mouse: `Input.mouse.left.down(cb)` / `.up(cb)` (also `middle`, `right`), `Input.mouse.wheel.up(cb)` / `.down(cb)` (by the wheel's direction), `Input.mouse.move(cb)`, `enter`, `leave`, `over`, `out`.
- Raw events of any key or button: `Input.keyDown(cb)`, `keyUp`, `keyPress`, `mouseDown`, `mouseUp`, `mouseMove`, `mouseWheel`.
- Composed: `Input.move(cb)` gives a `Vector2` from WASD (each axis -1, 0 or 1; opposite keys cancel); `Input.look(smoothSamples, cb)` gives the mouse delta as a `Vector2`, averaged over the last `smoothSamples` frames.
- Every registration returns an `EventListner`; give it to `Input.removeListner(listener)` to unregister. `Input.removeAllListners()` runs on Stop, `Input.active = false` silences everything, `Input.context` is the DOM element that receives the events (the window by default).

```ts
import { Float, Input, JsonIgnore, Script, ScriptComponent, Time } from '@brave/core';

@Script()
export class WasdMover extends ScriptComponent {
  @Float({ suffix: 'm/s' }) speed = 4;
  @JsonIgnore() private listener?: ReturnType<typeof Input.move>;
  @JsonIgnore() private direction = { x: 0, y: 0 };

  onStart() {
    this.listener = Input.move(direction => { this.direction = { x: direction.x, y: direction.y }; });
  }

  onUpdate() {
    this.entity.transform.position.x += this.direction.x * this.speed * Time.deltaTime;
    this.entity.transform.position.z -= this.direction.y * this.speed * Time.deltaTime;
  }

  onDestroy() {
    if (this.listener) Input.removeListner(this.listener);
  }
}
```

## Traps
- **`down` fires once per press.** A held key sends `keydown` repeats from the operating system; they do not reach `down`. Use **`typed`** when the repeats are the point (erasing with a held Backspace). The raw `Input.keyDown(...)` sees every repeat, with `event.repeat` set.
- **Callbacks are a chain.** Each handler receives `(event, next)` and the chain goes on only if it calls `next(event)`; the last one needs no `next`. Most scripts pass one callback and ignore `next`.
- Register in `onStart()` and remove in `onDestroy()`; a listener left behind keeps calling a destroyed script.
- Pointer lock: `Cursor.lock()` must run inside a real user event; it resolves `true` when locked and `false` when refused, never rejects. A click on the game view locks the cursor by itself while the game runs (`Cursor.autoLockOnClick`, default on); a menu-driven or 2D game sets it to `false` once.
- Character movement (`Player Movement`, the cameras) reads input for you: see `characters-and-animation.md` before writing your own.
- **The click that locks the pointer also reaches `Input.mouse.left.down(...)`**, before the lock exists: a shooter must not fire on it. Check `Cursor.isLocked` at the press (false for the locking click).
- **Input callbacks keep firing while the game is paused**: check `BraveEngine.mode === BraveEngineModeEnum.Running` inside them, or a script shoots from the pause menu.

Types: `brave/core/static/input.d.ts`, `brave/core/input/`, `brave/core/static/cursor.d.ts`
