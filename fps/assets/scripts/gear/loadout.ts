import { BraveEngine, BraveEngineModeEnum, Bool, Cursor, Entity, IEntity, Inject, Input, JsonIgnore, Ref, Saved, Script, ScriptComponent, Signal, TwoBoneIK } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Health } from '../health/health';
import { FirstPersonArms } from '../player/first-person-arms';
import { Gear } from './gear';

/**
 * What the first person player carries in hand: the gear under the entity in the right hand (`Gear`, one on each child), which one is in hand, and the keys that change it. The keys 1 to 9 and the mouse
 * wheel take a gear in hand, the key of the gear in hand puts it away, and the mouse and R are passed on to the gear in hand (its hooks, and the signals below for everything else that listens: the `Weapon`
 * fires a `Firearm` from them). It lives on the `Player` entity, next to the `FirstPersonArms` that holds the gear and the `Health` it asks whether the player is alive; it only reads them.
 *
 * A key takes a gear in hand: the arms go back to the body, the model changes, and the arms come out again (`Equip Time` twice); the key of the gear in hand puts it away. The HUD is told the list of
 * what is carried and which is in hand; what each gear shows of itself (its crosshair, its count) is its own `showHud()`.
 */
@Script()
export class Loadout extends ScriptComponent {

  @Ref(Entity, { header: 'Parts', label: 'Gear', tooltip: 'The entity in the right hand that has the gear as its children: each child has a Gear (a Firearm, a Throwable, a Medkit...).' }) holder!: Entity;

  @Bool({ header: 'Start', label: 'Start Equipped', tooltip: 'On: the first gear is in hand when the game starts. Off: it starts put away, and its key brings it up.' }) startEquipped = true;

  @Bool({ header: 'Testing', label: 'Fire Without Pointer Lock', tooltip: 'The game uses the mouse buttons only while it holds the pointer (the click that locks it is not a shot). A test, where the browser refuses the lock, turns this on.' }) fireWithoutLock = false;

  @Inject(Hud) hud!: Hud;

  /** The slot of the gear in hand, or of the one being raised: 0 until the first is taken. */
  @JsonIgnore() @Saved() slot = 0;

  /** A gear was brought out: the one the player now holds, or is raising. */
  onSwitch = new Signal<Gear>();
  /** The left mouse button went down while the gear in hand could be used. */
  onPrimaryDown = new Signal();
  onPrimaryUp = new Signal();
  /** The right mouse button went down with the pointer held (the gear is not asked whether it is ready: a button held while the arms come up still counts). */
  onSecondaryDown = new Signal();
  onSecondaryUp = new Signal();
  /** R was pressed while the gear in hand could be used. */
  onReload = new Signal();
  /** The player is back from the dead: every gear was refilled. */
  onRefill = new Signal();

  @JsonIgnore() private cache?: Gear[];
  @JsonIgnore() private arms?: FirstPersonArms;
  @JsonIgnore() private health?: Health;
  @JsonIgnore() private leftHand?: TwoBoneIK;
  @JsonIgnore() private tookInHand = false;
  // The gear the arms are going down to change to: it is brought out when they are at the body.
  @JsonIgnore() private pending?: Gear;
  @JsonIgnore() private listeners: Parameters<typeof Input.removeListner>[0][] = [];

  onAwake() {
    this.gear.forEach(gear => gear.prepare());
  }

  onStart() {
    this.bind();
    this.listen();
    const first = this.current ?? this.gear[0];
    if (first) this.bring(first);
  }

  // Switched off and on again (a body that is put away and brought back: the lab's V key): the HUD is a service every player shares and holds what the last one told it, so this one tells it its own again.
  onEnable() {
    if (this.started) this.showHud();
  }

  onUpdate() {
    this.takeInHand();
    this.changeGear();
  }

  // What a script registers it gives back: the callbacks would go on calling a script that is gone.
  onDestroy() {
    this.cancelListen();
  }

  // The copy holds the original's handles and its list of gear: it makes its own when it starts, and must never remove the original's.
  onAfterClone() {
    this.listeners = [];
    this.cache = undefined;
    this.leftHand = undefined;
    this.pending = undefined;
  }

  // A save brings the component back as it was, started: what `onStart()` registered is not there any more.
  onRestore() {
    this.cancelListen();
    this.cache = undefined;
    this.pending = undefined;
    this.bind();
    this.listen();
    this.show(this.current);
    // The arms do not keep what they hold in a save: the gear is taken in hand again on the next frame.
    this.tookInHand = false;
  }

  //#region Public
  /** The gear the player carries, in the order of their slots. */
  get gear(): readonly Gear[] {
    return this.cache ??= this.collect();
  }

  /** The gear in hand, or the one being raised. */
  get current(): Gear | undefined {
    return this.gear.find(gear => gear.slot === this.slot);
  }

  /** Takes the gear of a slot in hand: from the body, the arms come out with it; from another gear, the arms go back first; the key of the gear in hand puts it away. Returns whether the slot has a gear. */
  select(slot: number): boolean {
    const gear = this.gear.find(candidate => candidate.slot === slot);
    if (!gear || !this.canChange()) return false;
    const arms = this.arms;
    if (!arms) return false;

    if (arms.equipped && gear === this.current && !this.pending) {
      arms.unequip();
      return true;
    }
    this.drawTo(gear);
    return true;
  }

  /** The next gear (1) or the one before (-1), by slot, never putting one away: with none in hand it takes one out. */
  cycle(step: number): boolean {
    const all = this.gear;
    if (all.length === 0 || !this.canChange()) return false;
    const from = this.pending ?? this.current ?? all[0];
    const next = all[(all.indexOf(from) + step + all.length) % all.length];
    if (next === from && this.arms?.equipped) return false;
    this.drawTo(next);
    return true;
  }

  /** Whether the arms hold the gear, or are raising it: false with the hands free, and while the arms go down to change it. Until the first frame (and the first after a load) has taken the gear in hand it is true when it is going to be. */
  get isHolding(): boolean {
    return this.arms?.equipped === true || (!this.tookInHand && this.startEquipped);
  }

  /** Whether the gear may be used: its owner on (a character that is switched off still hears the mouse, and must not act from where it stands), in hand, alive, the game running. A game that stuns the player does it here. */
  isReady(): boolean {
    return this.canChange() && this.arms?.equipped === true && !this.pending;
  }

  /** The list of what is carried is written again: a gear's caption changed (a grenade was used or found). */
  refresh(): void {
    this.showHud();
  }

  /** Every gear holds its full amount again (the player is back from the dead), and the gear in hand tells the HUD. */
  refill(): void {
    this.gear.forEach(gear => gear.refill());
    this.onRefill.emit();
    this.current?.showHud();
  }
  //#endregion Public

  //#region Switching
  // The owner is on, alive and the game runs: a key does nothing otherwise (a character that is off still hears the keyboard).
  private canChange(): boolean {
    return this.entity.activeInHierarchy && !this.health?.isDead && BraveEngine.mode === BraveEngineModeEnum.Running;
  }

  // From the body the gear is brought out at once and the arms come out; in hand, the arms go down first and `changeGear()` brings it out when they are there.
  private drawTo(gear: Gear) {
    const arms = this.arms;
    if (!arms) return;
    if (arms.equipped) {
      if (gear === this.current) return;
      this.pending = gear;
      arms.unequip();
      return;
    }
    // The arms are going down: for the gear in hand it is a change of mind (they come out again), for another one it is the gear to bring out when they are down.
    if (this.pending || arms.reach > 0) {
      if (gear === this.current && this.pending) {
        this.pending = undefined;
        arms.equip();
      } else {
        this.pending = gear;
      }
      return;
    }
    this.bring(gear);
    arms.equip();
  }

  private changeGear() {
    const gear = this.pending;
    if (!gear || !this.arms || this.arms.equipped || this.arms.reach > 0) return;
    this.pending = undefined;
    this.bring(gear);
    this.arms.equip();
  }

  // Shows the model of a gear and hides the others, points the left hand at its grip and tells the HUD. What the gear held stays in the gear.
  private bring(gear: Gear) {
    const previous = this.current;
    this.slot = gear.slot;
    if (previous && previous !== gear) previous.onPutAway();
    this.show(gear);
    gear.onBrought();
    this.onSwitch.emit(gear);
  }

  // What a gear in hand looks like, with nothing told to the gear and no signal: the models, the left hand and the HUD (the same after a switch and after a save is loaded).
  private show(gear?: Gear) {
    if (!gear) return;
    this.gear.forEach(each => { each.entity.active = each === gear; });
    if (this.leftHand && gear.gripLeft) this.leftHand.target = gear.gripLeft;
    this.showHud();
  }

  // The list of what is carried with the one in hand marked, then what the gear in hand shows of itself.
  private showHud() {
    const gear = this.current;
    if (!gear) return;
    this.hud.setWeapons(this.gear.map(each => each.caption), this.gear.indexOf(gear));
    gear.showHud();
  }
  //#endregion Switching

  //#region Input
  // The click that locks the pointer arrives here too, before the lock: with no lock yet it is not a shot.
  private pressPrimary() {
    if (!this.hasPointer() || !this.isReady()) return;
    this.onPrimaryDown.emit();
    this.current?.onPrimaryDown();
  }

  private releasePrimary() {
    this.onPrimaryUp.emit();
    this.current?.onPrimaryUp();
  }

  private pressSecondary() {
    if (!this.hasPointer()) return;
    this.onSecondaryDown.emit();
    this.current?.onSecondaryDown();
  }

  private releaseSecondary() {
    this.onSecondaryUp.emit();
    this.current?.onSecondaryUp();
  }

  private pressReload() {
    if (!this.isReady()) return;
    this.onReload.emit();
    this.current?.onReload();
  }

  private hasPointer(): boolean {
    return this.fireWithoutLock || Cursor.isLocked;
  }
  //#endregion Input

  // The arms reset themselves in their own `onStart()`, which may run after this one: the gear is taken in hand on the first frame, once (unless it starts put away). After that its key puts it away and brings it back.
  private takeInHand() {
    if (this.tookInHand || !this.arms) return;
    this.tookInHand = true;
    if (this.startEquipped) this.arms.equip();
  }

  private collect(): Gear[] {
    const found: Gear[] = [];
    this.holder?.children.forEach(child => {
      const gear = child.getComponent(Gear);
      if (!gear) return;
      gear.loadout = this;
      found.push(gear);
    });
    return found.sort((a, b) => a.slot - b.slot);
  }

  private bind() {
    this.arms = this.entity.getComponent(FirstPersonArms);
    this.health = this.entity.getComponent(Health);
    // The left hand reaches for a grip of the gear in hand: the one of the two hands whose target is below the gear.
    this.leftHand = this.entity.components.find((component): component is TwoBoneIK => component instanceof TwoBoneIK && this.isInHolder(component.target));
  }

  private isInHolder(entity?: IEntity): boolean {
    for (let current = entity; current; current = current.parent) if (current === this.holder) return true;
    return false;
  }

  private listen() {
    const digits = [Input.keyboard.digit1, Input.keyboard.digit2, Input.keyboard.digit3, Input.keyboard.digit4, Input.keyboard.digit5, Input.keyboard.digit6, Input.keyboard.digit7, Input.keyboard.digit8, Input.keyboard.digit9];
    this.listeners.push(
      Input.mouse.left.down(() => this.pressPrimary()),
      Input.mouse.left.up(() => this.releasePrimary()),
      Input.mouse.right.down(() => this.pressSecondary()),
      Input.mouse.right.up(() => this.releaseSecondary()),
      Input.mouse.wheel.down(() => { this.cycle(1); }),
      Input.mouse.wheel.up(() => { this.cycle(-1); }),
      Input.keyboard.keyR.down(() => this.pressReload()),
      ...digits.map((key, index) => key.down(() => { this.select(index + 1); })),
    );
  }

  private cancelListen() {
    this.listeners.forEach(listener => Input.removeListner(listener));
    this.listeners = [];
  }
}
