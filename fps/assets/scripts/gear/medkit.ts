import { Entity, Float, Inject, Int, JsonIgnore, Ref, Saved, Script, String, Time } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Inventory } from '../../services/inventory.service';
import { Health } from '../health/health';
import { playSound } from '../shared/sound';
import { Gear } from './gear';

/**
 * A medical kit the player carries and has a number of: the left mouse button held heals, over `Use Time`, and spends one when it is done. The count is an item of the `Inventory` (`Item Id`: a
 * `Pickup` of that id gives more, up to the `Limit`). Letting go of the button, taking another gear or dying stops it, and nothing is spent. It does nothing
 * for a player at full health (it says so).
 *
 * It is the same medicine as a `HealthSupply` on the ground, carried: the supply heals on the spot with E, this is for later.
 */
@Script({ inheritProperties: true })
export class Medkit extends Gear {

  label = 'Medkit';
  slot = 4;

  @String({ header: 'Item', label: 'Item Id', tooltip: 'What the Inventory counts it as. A Pickup with this id gives one more.' }) itemId = 'medkit';
  @Int({ label: 'Start With', tooltip: 'How many the player starts the game with (given once per game, and again when the player comes back from the dead).' }) startingCount = 1;
  @Int({ label: 'Limit', tooltip: 'The most the player can carry: a pickup finds the player full and stays where it is. 0 is no limit.' }) limit = 3;

  @Float({ header: 'Heal', label: 'Amount', suffix: 'HP', tooltip: 'How much one kit heals, up to the maximum.' }) amount = 50;
  @Float({ label: 'Use Time', suffix: 's', tooltip: 'How long the button is held for one kit.' }) useTime = 2.5;
  @Ref(Entity, { label: 'Use Sound', tooltip: 'An entity with an Audio Source, or with several as children, played when the kit is used.' }) useSound?: Entity;

  @Inject(Hud) hud!: Hud;
  @Inject(Inventory) inventory!: Inventory;

  /** How far the button has held (0 to 1) while the player heals; 0 when it does not. */
  @JsonIgnore() @Saved() progress = 0;
  @JsonIgnore() @Saved() private using = false;

  onStart() {
    this.inventory.onChange.on(() => this.onCountChange(), this);
  }

  // The gear's entity is off while it is put away, so this runs only while the kit is in hand.
  onUpdate() {
    if (!this.using) return;
    const health = this.health;
    if (!this.loadout?.isReady() || !health || health.isDead || health.current >= health.maximum) {
      this.stop();
      return;
    }
    this.progress = Math.min(1, this.progress + Time.deltaTime / Math.max(this.useTime, 0.05));
    if (this.progress >= 1) this.finish(health);
  }

  // A save brings the component back as it was, started: what `onStart()` subscribed to is not there any more.
  onRestore() {
    this.onStart();
  }

  //#region Gear
  get caption(): string {
    const count = this.count;
    return count > 0 ? `${this.label} ×${count}` : this.label;
  }

  prepare(): void {
    this.inventory.define(this.itemId, { name: this.label, limit: this.limit, hidden: true, start: this.startingCount });
  }

  refill(): void {
    this.stop();
    this.inventory.set(this.itemId, this.startingCount);
  }

  onBrought(): void {
    this.stop();
  }

  onPutAway(): void {
    this.stop();
  }

  showHud(): void {
    this.hud.setCrosshair('dot');
    this.hud.setSpread(0);
    this.hud.setAiming(false);
    this.hud.setAmmo(this.count, 0, -1);
  }

  onPrimaryDown(): void {
    const health = this.health;
    if (!health || health.isDead) return;
    if (this.count <= 0) {
      this.hud.showMessage(`No ${this.label.toLowerCase()}s`, 1.2);
      return;
    }
    if (health.current >= health.maximum) {
      this.hud.showMessage('Health full', 1.2);
      return;
    }
    this.using = true;
    this.progress = 0;
  }

  onPrimaryUp(): void {
    this.stop();
  }
  //#endregion Gear

  //#region Getters
  /** How many are carried. */
  get count(): number {
    return this.inventory.count(this.itemId);
  }

  private get health(): Health | undefined {
    return this.loadout ? Health.find(this.loadout.entity) : undefined;
  }
  //#endregion Getters

  private finish(health: Health) {
    this.stop();
    if (!this.inventory.remove(this.itemId)) return;
    health.heal(this.amount);
    this.hud.showMessage(`+${Math.round(this.amount)} health`, 1.5);
    playSound(this.useSound);
  }

  private stop() {
    this.using = false;
    this.progress = 0;
  }

  private onCountChange() {
    this.loadout?.refresh();
    if (this.loadout?.current === this && this.loadout.entity.activeInHierarchy) this.showHud();
  }
}
