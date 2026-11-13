import { Entity, Int, JsonIgnore, Ref, Script, ScriptComponent, String } from '@brave/core';
import type { Loadout } from './loadout';

/**
 * Something the player can take in hand: a firearm, a grenade, a medkit, a torch. It sits on the entity of the thing, a child of the entity in the right hand that the player's `Loadout` reads
 * (the model is the entity's own children), and the `Loadout` is what takes it in hand, shows it and puts it away; while it is in hand the `Loadout` tells it what the player does with the mouse and R.
 *
 * It is the base the kinds of gear build on (`Firearm`, `Throwable`, `Medkit`), and it works on its own as a thing that is only held. To make your own kind, extend it and override the hooks it uses:
 *
 * ```ts
 * @Script({ inheritProperties: true })
 * export class Torch extends Gear {
 *   label = 'Torch';
 *   onPrimaryDown() { this.light.active = !this.light.active; }
 * }
 * ```
 *
 * The hooks are called only for the gear in hand, and only when the player may use it (in hand, alive, the game running). A gear that has to know about the rest of the player asks its `loadout`.
 */
@Script()
export class Gear extends ScriptComponent {

  @String({ header: 'Gear', label: 'Name', tooltip: 'What the HUD calls it.' }) label = 'Gear';
  @Int({ label: 'Slot', tooltip: 'The key that takes it in hand: 1 to 9. The mouse wheel goes through the slots in order.' }) slot = 1;
  @Ref(Entity, { label: 'Grip Left', tooltip: 'The point the left hand reaches while this is in hand: a child of the gear. Empty: the left hand stays where the last gear left it.' }) gripLeft?: Entity;

  /** The `Loadout` that carries it: set when the `Loadout` lists its gear. */
  @JsonIgnore() loadout?: Loadout;

  /** What the list of what is carried says of it: its name, and whatever else the player should see at a glance (a grenade says how many are left). */
  get caption(): string {
    return this.label;
  }

  /** The game starts: the gear tells the Inventory what its items are and fills what it holds. Called by the `Loadout` for every gear, in hand or not (a gear that is put away has its entity off). */
  prepare(): void {}

  /** It was taken out: it is the one in hand now, or the one being raised. */
  onBrought(): void {}

  /** Another gear was taken out, or this one was put away for good. */
  onPutAway(): void {}

  /** What the HUD shows of it: its crosshair and its count. Called when it is brought and when the player is switched on again. */
  showHud(): void {}

  /** The player is back from the dead: whatever it holds is full again. */
  refill(): void {}

  /** The left mouse button went down. */
  onPrimaryDown(): void {}

  /** The left mouse button went up (called even when the gear could not be used when it went down). */
  onPrimaryUp(): void {}

  /** The right mouse button went down. Not asked whether the gear is ready: a button held while the arms come up still counts. */
  onSecondaryDown(): void {}

  onSecondaryUp(): void {}

  /** R was pressed. */
  onReload(): void {}
}
