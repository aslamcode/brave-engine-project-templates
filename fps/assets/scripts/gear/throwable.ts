import { CharacterController, Entity, Float, Inject, Int, JsonIgnore, PrefabAssetMarker, Ref, RigidBody, Saved, Script, SpawnSystem, String, Time, Vector3 } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Inventory } from '../../services/inventory.service';
import { playSound } from '../shared/sound';
import { Gear } from './gear';

/**
 * Something the player throws and has a number of: a grenade. The count is an item of the `Inventory` (`Item Id`: a `Pickup` of that id gives more, up to the `Limit`), so it is the same count
 * the rest of the game reads. The left mouse button winds up (`Wind-up`) and lets go: one is taken off the count, the `Projectile` prefab is made in front of the eyes and sent where the player
 * looks, a little above it, with the speed of the throw plus the body's own. What the projectile does after that is its own script (the `Grenade`); a prefab of another kind of thing (a flare,
 * a decoy) is a `Throwable` with another `Projectile`.
 *
 * The wind-up is lost when another gear is taken, or the player dies, before it ends: nothing is thrown and nothing is spent.
 */
@Script({ inheritProperties: true })
export class Throwable extends Gear {

  label = 'Grenade';
  slot = 3;

  @String({ header: 'Item', label: 'Item Id', tooltip: 'What the Inventory counts it as. A Pickup with this id gives one more.' }) itemId = 'grenade';
  @Int({ label: 'Start With', tooltip: 'How many the player starts the game with (given once per game, and again when the player comes back from the dead).' }) startingCount = 2;
  @Int({ label: 'Limit', tooltip: 'The most the player can carry: a pickup finds the player full and stays where it is. 0 is no limit.' }) limit = 4;

  @Ref(PrefabAssetMarker, { header: 'Throw', label: 'Projectile', picker: true, tooltip: 'The prefab that flies: a Rigid Body with a Collider and a Grenade. It is made at the throw and removed when its own script ends it.' }) projectile = '';
  @Ref(Entity, { label: 'Eyes', tooltip: 'The camera: the throw starts here and goes where it looks.' }) eyes!: Entity;
  @Ref(Entity, { label: 'Throw Sound', tooltip: 'An entity with an Audio Source, or with several as children, played at the throw.' }) throwSound?: Entity;
  @Float({ label: 'Throw Speed', suffix: 'm/s', tooltip: 'How fast it leaves the hand, before the body\'s own speed is added.' }) throwSpeed = 14;
  @Float({ label: 'Lift', suffix: '°', tooltip: 'How far above where the camera looks it is sent: a throw that lobs.' }) lift = 8;
  @Float({ label: 'Wind-up', suffix: 's', tooltip: 'From the click to the grenade leaving the hand. 0: at the click.' }) windUp = 0.25;
  @Float({ label: 'Between Throws', suffix: 's', tooltip: 'How long after a throw the next can begin.' }) cooldown = 0.9;

  @Inject(Hud) hud!: Hud;
  @Inject(Inventory) inventory!: Inventory;

  /** Seconds until the grenade leaves the hand; 0 when none is being thrown. */
  @JsonIgnore() @Saved() windLeft = 0;
  @JsonIgnore() @Saved() cooldownLeft = 0;

  @JsonIgnore() private warned = false;

  onStart() {
    // The count is the Inventory's: a pickup changes what the HUD shows (only for the player that is on: the other one shares the count).
    this.inventory.onChange.on(() => this.onCountChange(), this);
  }

  // The gear's entity is off while it is put away, so this runs only while the grenade is in hand.
  onUpdate() {
    this.cooldownLeft = Math.max(0, this.cooldownLeft - Time.deltaTime);
    if (this.windLeft <= 0) return;
    this.windLeft -= Time.deltaTime;
    if (this.windLeft <= 0) this.release();
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
    this.windLeft = 0;
    this.cooldownLeft = 0;
    this.inventory.set(this.itemId, this.startingCount);
  }

  onBrought(): void {
    this.windLeft = 0;
  }

  onPutAway(): void {
    this.windLeft = 0;
  }

  showHud(): void {
    this.hud.setCrosshair('dot');
    this.hud.setSpread(0);
    this.hud.setAiming(false);
    this.hud.setAmmo(this.count, 0, -1);
  }

  onPrimaryDown(): void {
    if (this.windLeft > 0 || this.cooldownLeft > 0) return;
    if (this.count <= 0) {
      this.hud.showMessage(`No ${this.label.toLowerCase()}s`, 1.2);
      return;
    }
    this.windLeft = this.windUp;
    if (this.windLeft <= 0) this.release();
  }
  //#endregion Gear

  //#region Getters
  /** How many are carried. */
  get count(): number {
    return this.inventory.count(this.itemId);
  }
  //#endregion Getters

  // The grenade leaves the hand: the count goes down, the projectile is made in front of the eyes and sent.
  private release() {
    const loadout = this.loadout;
    if (!loadout?.isReady() || !this.inventory.remove(this.itemId)) return;
    const eyes = this.eyes.transform;
    const forward = eyes.forward.normalized, up = eyes.up.normalized;
    const tilt = Math.tan(this.lift * Math.PI / 180);
    const way = new Vector3(forward.x + up.x * tilt, forward.y + up.y * tilt, forward.z + up.z * tilt).normalized;
    const start = eyes.globalPosition;
    const thrown = SpawnSystem.spawn(this.projectile, { position: new Vector3(start.x + way.x * 0.5, start.y + way.y * 0.5, start.z + way.z * 0.5), rotation: eyes.globalRotationQ });
    if (!thrown) {
      this.warnOnce();
      this.inventory.add(this.itemId);
      return;
    }
    const own = loadout.entity.getComponent(CharacterController)?.actualVelocity ?? new Vector3();
    const body = thrown.getComponent(RigidBody);
    if (body) body.velocity = new Vector3(way.x * this.throwSpeed + own.x, way.y * this.throwSpeed + own.y, way.z * this.throwSpeed + own.z);
    this.cooldownLeft = this.cooldown;
    playSound(this.throwSound);
  }

  private onCountChange() {
    this.loadout?.refresh();
    if (this.loadout?.current === this && this.loadout.entity.activeInHierarchy) this.showHud();
  }

  private warnOnce() {
    if (this.warned) return;
    this.warned = true;
    console.warn(`[Throwable] "${this.entity.name}": Projectile is empty or is not a prefab of the project, so nothing was thrown (and nothing spent).`);
  }
}
