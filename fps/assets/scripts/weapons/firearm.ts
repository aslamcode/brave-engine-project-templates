import { Bool, Entity, Float, Inject, Int, JsonIgnore, Ref, Saved, Script, Select, String } from '@brave/core';
import { Inventory } from '../../services/inventory.service';
import { Gear } from '../gear/gear';

/** The crosshair a firearm has: a centre and four ticks (`dot`), a ring of four arcs round a dot (`arcs`), or two arcs, one each side of a dot, with a thin arc outside each (`twin-arcs`, the shotgun's): the arcs open with the spread, so they show where the pellets may go. */
export type CrosshairStyle = 'dot' | 'arcs' | 'twin-arcs';

/**
 * One weapon the player can carry: its numbers, its parts and the rounds it holds. It is a `Gear`, on the weapon's own entity, a child of the entity in the right hand that the `Loadout` reads (the model,
 * the `Muzzle` and the `Grip Left` are its children), and does nothing by itself: the `Weapon` on the player reads the one in hand and fires it, reloads it and aims it, and keeps what each of them holds.
 *
 * A new weapon is a copy of one of these entities with other numbers and another model (keep `Muzzle` at the end of the barrel and `Grip Left` where the left hand goes); its `Slot` is the key that
 * takes it in hand.
 */
@Script({ inheritProperties: true })
export class Firearm extends Gear {

  label = 'Rifle';

  @Ref(Entity, { header: 'Parts', label: 'Muzzle', tooltip: 'A point at the barrel tip, off at the start, with a Light on it: it is switched on for a few frames at each shot.' }) muzzle?: Entity;
  @Ref(Entity, { label: 'Shot Sound', tooltip: 'An entity with an Audio Source, or with several as children: one of them plays at each shot.' }) shotSound?: Entity;
  @Ref(Entity, { label: 'Dry Fire Sound', tooltip: 'The click of a trigger pulled on an empty magazine.' }) dryFireSound?: Entity;
  @Ref(Entity, { label: 'Reload Sound 1', tooltip: 'The first of the three sounds of a reload: the magazine out, or the shell in.' }) magazineOutSound?: Entity;
  @Ref(Entity, { label: 'Reload Sound 2', tooltip: 'The second: the magazine in, or the shell in again.' }) magazineInSound?: Entity;
  @Ref(Entity, { label: 'Reload Sound 3', tooltip: 'The third: the bolt, or the pump.' }) boltSound?: Entity;

  @Float({ header: 'Fire', label: 'Rounds per Minute' }) roundsPerMinute = 600;
  @Int({ label: 'Pellets', tooltip: 'How many bullets one shot sends, each in its own direction inside the cone: 1 is a rifle, 8 to 12 a shotgun (give it a wide Spread and a low Rounds per Minute).' }) pellets = 1;
  @Float({ label: 'Damage', suffix: 'HP', tooltip: 'What a bullet takes from a body zone (multiplier 1; each pellet of a shotgun takes this); a head takes its Hitbox multiplier times this.' }) damage = 25;
  @Float({ label: 'Range', suffix: 'm' }) range = 120;
  @Bool({ label: 'Automatic', tooltip: 'On: holding the button keeps firing. Off: one shot for each click.' }) automatic = true;

  @Float({ header: 'Spread', label: 'Still', suffix: '°', tooltip: 'The half angle of the cone a shot goes in, standing still.' }) spreadStill = 0.15;
  @Float({ label: 'Moving', suffix: '°', tooltip: 'The same at the run speed. In between it follows the speed.' }) spreadMoving = 1.2;
  @Float({ label: 'In the Air', suffix: '°', tooltip: 'The same while jumping or falling.' }) spreadAir = 3;
  @Float({ label: 'Settle Time', suffix: 's', tooltip: 'How long the spread takes to follow what the player does.' }) spreadTime = 0.12;

  @Select({ header: 'Crosshair', label: 'Crosshair', optionsKey: 'crosshairOptions', sort: false, tooltip: 'Dot: a centre and four ticks that open with the spread. Arcs: a ring of four arcs round a dot. Twin Arcs: two arcs, one each side of a dot, with a thin arc outside each (the shotgun\'s). All open with the spread.' }) crosshair: CrosshairStyle = 'dot';

  @String({ header: 'Ammo', label: 'Ammo Type', tooltip: 'The item of the Inventory this weapon fires: the rounds it does not hold in its magazine are the Inventory\'s count of this item, so weapons of one type share them, and a pickup or an ammo box of this type fills them. Weapons of one type should agree on Reserve and Reserve Limit.' }) ammoType = 'ammo';
  @Int({ label: 'Magazine', tooltip: 'Rounds in a full magazine.' }) magazineSize = 30;
  @Int({ label: 'Reserve', tooltip: 'Rounds of the Ammo Type the player starts the game with, besides the magazine (given once per game, and again when the player comes back from the dead).' }) startingReserve = 120;
  @Int({ label: 'Reserve Limit', tooltip: 'The most rounds of the Ammo Type the player can carry besides the magazine: an ammo box or a pickup stops giving there. 0 is no limit.' }) reserveLimit = 0;
  @Float({ label: 'Reload Time', suffix: 's' }) reloadTime = 2.2;

  @Float({ header: 'Feel', label: 'Camera Kick', suffix: '°', tooltip: 'How far the view climbs at each shot before it settles back.' }) cameraKick = 0.8;
  @Float({ label: 'Flash Time', suffix: 's', tooltip: 'How long the muzzle light stays on.' }) flashSeconds = 0.07;

  @Float({ header: 'Aim', label: 'Aim Field of View', suffix: '°', tooltip: 'The vertical field of view of the camera while aiming (the right mouse button held): narrower than the normal one, the world comes nearer.' }) aimFieldOfView = 45;
  @Float({ label: 'Aim Time', suffix: 's', tooltip: 'How long the weapon takes to come to the eye, and to go back.' }) aimTime = 0.18;
  @Float({ label: 'Aim Spread', tooltip: 'What share of the spread is left while aiming: 1 the same, 0 none.' }) aimSpreadScale = 0.4;
  @Float({ label: 'Aim Side', suffix: 'm', tooltip: 'How far the weapon moves to the right while aiming (negative: left), so that the barrel ends on the line of the eye.' }) aimSide = -0.133;
  @Float({ label: 'Aim Lower', suffix: 'm', tooltip: 'How far the weapon goes down while aiming (negative: up), so that it ends just under the line of the eye.' }) aimLower = -0.033;
  @Float({ label: 'Aim Back', suffix: 'm', tooltip: 'How far the weapon comes back, towards the body, while aiming (negative: forward).' }) aimBack = -0.35;
  @Float({ label: 'Aim Tilt', suffix: '°', tooltip: 'How far the barrel is raised about the hand while aiming (negative: lowered), so that it points where the camera looks.' }) aimTilt = 8.5;

  @JsonIgnore() protected crosshairOptions = [{ value: 'dot', description: 'Dot' }, { value: 'arcs', description: 'Arcs' }, { value: 'twin-arcs', description: 'Twin Arcs' }];

  /** Rounds in the magazine. In a save, not in the scene file. */
  @JsonIgnore() @Saved() ammo = 0;

  @Inject(Inventory) inventory!: Inventory;
  /** Where the point the left hand reaches was authored, in its parent's space: the `Weapon Stance` poses it from here every frame, so it is read once. In a save, so that it is never read from a posed pose. */
  @JsonIgnore() @Saved() authoredGrip: number[] = [];

  /** Rounds of the Ammo Type in the Inventory, besides the magazine: weapons of one type draw from the same. */
  get reserve(): number {
    return this.inventory.count(this.ammoType);
  }

  set reserve(value: number) {
    this.inventory.set(this.ammoType, value);
  }

  /** The game starts (the `Loadout` asks every gear): the Ammo Type is made known to the Inventory (its limit, left out of the list the HUD shows, its starting reserve given once) and the magazine is full. */
  prepare(): void {
    this.inventory.define(this.ammoType, { limit: this.reserveLimit, hidden: true, start: this.startingReserve });
    this.ammo = this.magazineSize;
  }

  /** A full magazine and the starting reserve: what the weapon has when the player is back from the dead. */
  refill(): void {
    this.ammo = this.magazineSize;
    this.reserve = this.startingReserve;
  }
}
