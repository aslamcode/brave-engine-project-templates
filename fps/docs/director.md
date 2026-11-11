# The Director

The Director is a controller for an area of the game: a **Director Volume** is the area, a **Director Actor** marks who matters (the player, an enemy), and a `.director` asset says what happens while the volume has the control: states, timers, reactions and actions, edited as a graph in a full-screen window.

## What it is
- A **Director Volume** is a box (or a **Global**, with no box). It is *occupied* while at least one Director Actor of the role it watches is inside the box. Several volumes can be occupied at once (a room inside a building): **one has the control, the occupied one with the smallest box**; the others are suspended, and the next smallest gets the control back when it leaves. A Global is outside this: every active Global runs and never loses the control.
- A `.director` is a state machine: **scopes** (states, and machines that hold states), **slots** (the things it reaches: an entity, a group, a role, a prefab, an audio source, another director), **parameters** (bool, int, float, trigger), and on each scope **On Enter** / **On Exit** action lists, **reactions** (a trigger and actions) and **transitions** (to another scope, with a trigger, an optional condition and actions). The file names no scene object, so one asset can serve several volumes: each volume binds the slots.
- A local volume has no run until it first has the control. Nothing runs in the editor's Scene view: runs happen while the game plays, and Pause freezes them.

## Add it
1. **Project Settings, Director**: the roles (a new project has **Player**). Roles are picked from a list, stored by id: renaming one breaks nothing.
2. **Director Actor**: Add Component, category Director, on the player's entity (the Scenes menu's **Director Actor** makes an empty entity with it). Set its **Role**.
3. **Director Volume**: Scenes panel, right-click, **Director Volume**. Size it with **Box Size** (default 10 x 10 x 10 m, times the entity's scale; the box follows the entity's position, rotation and scale) and **Box Offset**. A local volume with no actor of its role in the loaded scenes shows a warning on its card.
4. **Director** field: pick a `.director`, or **+ New** (makes `New Director.director` in the scene's folder), or Assets panel, **New Director**. Then **Edit Director** opens the window.
5. The **Slots** section under the field lists the asset's slots: bind each one in the Inspector (an entity, a role, a `.fab`, ...) or the actions that use it do nothing.
6. A first director to try: in the window, **Add State** until there are two (the first one starts the machine; **Starts Here** moves that), right-click the first, **Add Transition To** the second, and in the details set its Trigger to After 8 s and add a **Log** action to the transition's Actions. Turn on **Log Events**, play, and walk the player into the box: the Console shows the events and the Log line 8 s later.

## Key settings
- **Director Volume**: Director, **Is Global** (off), **Watches** (the role), **Re-enter** (what a run does when the actors leave and return: **Restart**, the default, ends it with its On Exit lists and begins a new one; **Resume** freezes it with no On Exit and carries on; **Once** ends it and the volume never runs again in this Play), Box Size, Box Offset, **Log Events** (writes each event to the Console).
- **Director window**: top bar (file name, counts, `Saved` / `Saving...` / `Unsaved changes`, Undo, Redo, **Add State**, **Add Machine**, **Starts Here**, Delete); left, the outline with Slots and Parameters (add with +); middle, the graph of ONE machine; right, the details of the selection. Double-click a machine to go into it, double-click a name to rename; right-click a node for **Add Transition To**, Make It Start Here, Rename, Delete, an empty spot for Add State / Machine, an arrow for Delete Transition. The file is written as you edit; Escape does not close the window, its close button does. If the file does not parse the window shows the reason and turns editing off.
- **Triggers** (the When select): After and Every (seconds), Gained Control, Lost Control, Exited, Parameter (fires when its condition turns true), Event (an Emit Event of the same run) and Signal (a Signal of one of your scripts). **Conditions** are clauses that all must hold, on parameters or on a script's `@State()` boolean.
- **Actions**: Set Active, Destroy, **Spawn** (a prefab slot, at the place of each entity of an optional At slot, else at the volume's entity; it keeps the prefab's scale), Play Audio, Stop Audio, **Wait** (not in On Exit), **Branch** (If, Then, Else), Set Parameter, Set Parameter On (another director's, by name), Emit Event, **Log** (writes `[Director] <entity>: text` to the Console) and **Call** (a method of your script).
- **Live view**: while the game plays, **Edit Director** opens the same window read-only: who has the control (Has Control, Suspended, Waiting, Has Not Started, Not Running), the active path, the parameters now, and an event log.

## Scripting
A volume tells your scripts, in a fixed order within one frame (Stopped, Started, Exited, LostControl, Entered, GainedControl): Signals `onEntered`, `onExited`, `onGainedControl`, `onLostControl`, `onStarted`, `onStopped`; and state `isRunning`, `isOccupied`, `hasControl`, `isSuspended`. `DirectorSystem.onEvent` carries every volume's events (`volume`, `kind`). A script tells the director something by parameter NAME: `setParameter(name, value)` (a trigger is set with `true`; false when the name or the kind is wrong or the volume has no run now), `addToParameter(name, amount)`, `getParameter(name)`.
```ts
import { DirectorVolume, Script, ScriptComponent, Time } from '@brave/core';

@Script()
export class AlarmRoom extends ScriptComponent {
  private volume?: DirectorVolume;

  onStart() {
    this.volume = this.entity.getComponent(DirectorVolume);
    this.volume.onGainedControl.on(() => this.volume?.setParameter('alarm', true), this);
    this.volume.onExited.on(() => console.log('the player left the room'), this);
  }

  onUpdate() {
    // A siren light that turns while this room has the control and its director says the alarm is on.
    if (this.volume?.hasControl && this.volume.getParameter('alarm') === true) this.entity.transform.rotation.y += 90 * Time.deltaTime;
  }
}
```
**The bridge to a director.** The graph reaches only YOUR scripts (a `@Script()` component), by what they mark: a public field that holds a `Signal` is a trigger, a field or getter marked `@State()` is a boolean for conditions, a method marked `@Callable()` is a Call action (no arguments, may be `async`; `label` is what the window shows). The window lists them under the script's name; a script renamed or without the member shows `Missing`.
```ts
// assets/scripts/door.ts
import { Callable, Script, ScriptComponent, Signal, State } from '@brave/core';

@Script()
export class Door extends ScriptComponent {
  onPressed = new Signal();
  @State() isOpen = false;

  @Callable() open() { this.isOpen = true; }
  @Callable({ label: 'Close Door' }) close() { this.isOpen = false; }
}
```
In the window: add a slot `Door` (type Entity), bind it to the door entity in the volume's Slots section, then use **Call** (Slot Door, the Door script's Close Door), a **Signal** trigger (Slot Door, the Door script's onPressed) or a condition on the Door script's isOpen. On a group slot, a boolean is on when ANY entity has it on.

## Traps
- **Slots are bound per volume.** An unbound slot, or one whose entity or role actor is gone, makes the action do nothing and the Console says so once per run (`[Director] <entity>: the slot "X" is not bound to anything...`).
- `setParameter` returns false while the volume has no run: a local volume gets one when it first has the control, so set parameters from `onGainedControl` (the run already exists then) or use a Global.
- A parameter is addressed by NAME from scripts and other directors; its id never changes, so renaming it changes what scripts must say.
- A Signal is answered at the next tick, not on the spot. A transition on **After** looks at its condition when the timer fires: if false it does not fire later; use a Parameter trigger to wait for a condition.
- The Director ticks once a frame after the scripts' `onUpdate`, only while the game runs (not in the editor, not while paused).
- On Exit lists that run when the editor's Play stops touch nothing in the scenes (nothing is spawned or changed); Log and parameters still work.
- What Spawn makes belongs to the scene from then on: the Director does not track it and a Destroy action never reaches it.
- Do not edit a `.director` by hand: the window owns the file and writes it as you edit. `@Callable` methods and `@State()` booleans are found by name when used, so a hot reload is followed.

## Not available yet
The `setTarget` action (the file parser refuses it); arguments to a Call, and a Signal's payload as a parameter; a handle or count of what Spawn made; occupancy by "all actors of a role" (today any one actor counts); saving a run's state in the game save; breakpoints and timer countdowns in the live view; an Inspector list of a script's `@Callable` methods.

Types: `brave/core/component/{director-volume,director-actor}.d.ts`, `brave/core/system/director-system/` (`director-system.d.ts`, `director-file.d.ts` for the file's shape, the `*.enum.d.ts` for triggers and actions), `brave/core/decorator/{callable,state}.decorator.d.ts`
