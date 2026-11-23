import { Bool, Camera, CharacterController, DecalSystem, Entity, FirstPersonCamera, Inject, IRaycastHit, JsonIgnore, PhysicsSystem, PlayerMovement, Ref, Saved, Script, ScriptComponent, Signal, Time, Vector3 } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Inventory } from '../../services/inventory.service';
import { Gear } from '../gear/gear';
import { Loadout } from '../gear/loadout';
import { Firearm } from './firearm';
import { Health } from '../health/health';
import { Hitbox } from '../health/hitbox';
import { BODY_KEEPS, stopThickness } from './bullet-surfaces';
import { MuzzleFlash } from './muzzle-flash';
import { playSound } from '../shared/sound';

/** One shot on its way: where it starts, which way it goes, what is left of its damage and of its reach. `Weapon.onBulletHit()` says what a hit leaves of it: a bullet that goes on (through a thin wall, through a body) is a new one from where it came out. */
export interface IBullet {
  origin: Vector3;
  direction: Vector3;
  damage: number;
  range: number;
}

/**
 * What the first person player does with a firearm: the left mouse fires, R reloads, the right mouse aims, and the shot is a ray from the camera. It lives on the `Player` entity, next to the `Loadout` that
 * takes the gear in hand and tells it the mouse and R, the `Health`, and the `WeaponStance` that poses the weapon; it only reads them. The weapons themselves are the `Firearm`s among the `Loadout`'s gear:
 * their numbers, their parts and the rounds each one holds are theirs, and this fires whichever is in hand (with a grenade or a medkit in hand it does nothing).
 *
 * A hit finds the `Health` above the collider it hit (`Health.find()`), scales the damage by the `Hitbox` of that collider (`zone`, `multiplier`) and tells the HUD. What a hit on scenery does (a mark on the
 * wall) and what a bullet does after a hit are in `onBulletHit()`: the rest of the script never asks what a shot hit. A bullet flies a straight ray, or, when its weapon has a `Muzzle Velocity`, a curve that gravity
 * bends; it goes through a body (keeping part of its damage) and through a wall or a crate of a material that allows it (`bullet-surfaces.ts`), by the thickness, weaker for it, if its weapon's `Penetration` allows it.
 *
 * Reloading is a timeline in game time (`reloadProgress`, 0 to 1) that the sounds are cued on and that `WeaponStance` poses the arms from; the rounds are added at the end. It is cancelled when the weapon is
 * put away or changed, or the player dies, and a shot cannot be fired while it lasts. With `Auto Reload` on it begins by itself when the magazine runs empty. Aiming (`aim`, 0 to 1) narrows the field of view, closes the spread and brings the weapon to the eye; it ends with a
 * sprint, a reload, a switch.
 */
@Script()
export class Weapon extends ScriptComponent {

  // Where in the reload (0 to 1) the three sounds are: the magazine out, the magazine in, the bolt.
  private static readonly RELOAD_CUE_TIMES = [0.18, 0.62, 0.88];
  // The rays a weapon with several pellets asks along besides the middle one (to know whether the crosshair turns red): this many, round a ring this share of the way out in the cone.
  private static readonly PROBES = 6;
  private static readonly PROBE_RING = 0.8;
  // The layer of the body shell of a character whose hit zones are on its bones (a capsule that is only for walking): a shot passes it and meets the zones.
  private static readonly SHELL_LAYER = 'Enemy Shell';
  // A bullet goes on after a hit this many times at most, a curve is cast in pieces of this many metres, a bullet is put this far past where it came out (so that it does not meet that wall again), and one with less damage than this is spent.
  private static readonly MAX_PASSES = 4;
  private static readonly PIECE = 10;
  private static readonly MARGIN = 0.002;
  private static readonly MIN_DAMAGE = 2;
  // The most a bullet goes through of one body (a zone of a character is far thinner than this): a collider it cannot get out of stops it.
  private static readonly BODY_REACH = 1;

  @Ref(Entity, { header: 'Parts', label: 'Eyes', tooltip: 'The camera: a shot starts here and goes where it looks.' }) eyes!: Entity;

  @Bool({ header: 'Reload', label: 'Auto Reload', tooltip: 'On: a magazine that runs empty is reloaded by itself, once the shot is over, if there are rounds in reserve (a weapon put in hand empty reloads too). Off: R reloads, and the trigger on an empty magazine clicks.' }) autoReload = true;

  @Inject(Hud) hud!: Hud;
  @Inject(Inventory) inventory!: Inventory;

  /** A reload is going on, and how far (0 to 1) it is. */
  @JsonIgnore() @Saved() isReloading = false;
  @JsonIgnore() @Saved() reloadProgress = 0;
  /** The half angle of the cone the next shot goes in, in degrees. */
  @JsonIgnore() spread = 0;

  /** A shot was fired (and the round taken out). */
  onFire = new Signal<IBullet>();
  /** The trigger was pulled on an empty magazine. */
  onDryFire = new Signal();
  onReloadStart = new Signal();
  /** The rounds are in. Not told for a reload that was cancelled. */
  onReloadEnd = new Signal();
  /** The player began to aim. */
  onAimStart = new Signal();

  @JsonIgnore() private loadout?: Loadout;
  @JsonIgnore() private cache?: Firearm[];
  // The hands are free: the gear was put away and no other is on its way. The HUD then holds the plain dot, and the weapon's own crosshair comes back when one is in hand again.
  @JsonIgnore() private bare = false;
  // What a ray of this weapon can hit: everything but the body shells.
  @JsonIgnore() private bulletMask?: number;
  @JsonIgnore() private body?: CharacterController;
  @JsonIgnore() private movement?: PlayerMovement;
  @JsonIgnore() private camera?: FirstPersonCamera;
  @JsonIgnore() private eyesCamera?: Camera;
  @JsonIgnore() private clock = 0;
  @JsonIgnore() private nextShotAt = 0;
  // What the bullet in the air has hurt: a body with more than one collider (a zone and the root's) is hurt once by it, however many it goes through.
  @JsonIgnore() private readonly struck = new Set<Health>();
  @JsonIgnore() private triggerHeld = false;
  @JsonIgnore() private aimHeld = false;
  @JsonIgnore() private flashLeft = 0;
  // Aiming: how far (0 to 1, linear in time), and the field of view and the look sensitivity the camera had before it began (what it goes back to).
  @JsonIgnore() @Saved() private aimRaw = 0;
  @JsonIgnore() @Saved() private baseFieldOfView = 0;
  @JsonIgnore() @Saved() private baseSensitivity = 0;
  // The kick of the weapon and the climb of the view: a shot gives each a push (1 for the weapon, as many degrees as `Camera Kick` for the view).
  @JsonIgnore() private readonly rifleSpring = new Spring();
  @JsonIgnore() private readonly viewSpring = new Spring();
  @JsonIgnore() @Saved() private reloadCue = 0;

  onAwake() {
    this.loadout = this.entity.getComponent(Loadout);
    this.isReloading = false;
    this.reloadProgress = 0;
  }

  onStart() {
    this.bind();
    // The rounds are the Inventory's: a pickup or an ammo box changes the count the HUD shows (only for the player that is on: the other one has a magazine of its own).
    this.inventory.onChange.on(() => { if (this.entity.activeInHierarchy) this.showAmmo(); }, this);
    const shells = PhysicsSystem.layerMask(Weapon.SHELL_LAYER);
    this.bulletMask = shells ? 0xFFFF & ~shells : undefined;
    this.firearms.forEach(firearm => { if (firearm.muzzle) firearm.muzzle.active = false; });
    // The `Loadout` may have brought the first weapon out before this subscribed to it.
    const gun = this.current;
    if (gun) this.onGearChange(gun);
  }

  // Switched off and on again (a body that is put away and brought back: the lab's V key): the HUD is a service every player shares and holds what the last one told it, so this one tells it its own again.
  onEnable() {
    const gun = this.current;
    if (!this.started || !gun) return;
    // Told again below if the hands are still free.
    this.bare = false;
    this.showHud(gun);
  }

  onUpdate() {
    const deltaTime = Time.deltaTime;
    this.clock += deltaTime;
    this.pullTrigger();
    this.reloadWhenEmpty();
    this.updateReload(deltaTime);
    this.updateAim(deltaTime);
    this.updateCrosshair();
    this.updateSpread(deltaTime);
    this.updateRecoil(deltaTime);
    this.updateFlash(deltaTime);
    this.updateTarget();
  }

  // The copy holds the original's handle and its list of weapons: it makes its own when it starts.
  onAfterClone() {
    this.loadout = undefined;
    this.cache = undefined;
  }

  // A save brings the component back as it was, started: what `onStart()` bound is not there any more. The aim is kept (it is saved); the rest of a switch is done again.
  onRestore() {
    this.cache = undefined;
    this.bind();
    const gun = this.current;
    if (!gun) return;
    this.cancelReload();
    this.triggerHeld = false;
    this.spread = gun.spreadStill;
    this.showHud(gun);
  }

  //#region Public
  /** The weapons the player carries, in the order of their slots. */
  get firearms(): readonly Firearm[] {
    return this.cache ??= (this.loadout?.gear ?? []).filter((gear): gear is Firearm => gear instanceof Firearm);
  }

  /** The weapon in hand, or the one being raised: none while another kind of gear is. */
  get current(): Firearm | undefined {
    const gear = this.loadout?.current;
    return gear instanceof Firearm ? gear : undefined;
  }

  /** Rounds in the magazine and in reserve, of the weapon in hand. */
  get ammo(): number {
    return this.current?.ammo ?? 0;
  }

  get reserve(): number {
    return this.current?.reserve ?? 0;
  }

  /** How hard the weapon is kicked: 1 right after a shot, then back to 0. `WeaponStance` poses it from it. */
  get recoil(): number {
    return this.rifleSpring.value;
  }

  /** How near the weapon is to the eye: 0 not aiming, 1 aiming (eased). */
  get aim(): number {
    return this.aimRaw * this.aimRaw * (3 - 2 * this.aimRaw);
  }

  get isAiming(): boolean {
    return this.aimRaw > 0;
  }

  /** The body runs on the ground: the weapon goes down, and nothing can be aimed. */
  get isSprinting(): boolean {
    if (!this.movement || !this.body) return false;
    const velocity = this.body.actualVelocity;
    return this.movement.isRunning && this.body.isGrounded && Math.hypot(velocity.x, velocity.z) > 0.5;
  }

  /** One shot, if the weapon is ready, is not being reloaded and has a round: the round goes, the bullet flies, the weapon kicks. Returns whether it fired. */
  fire(): boolean {
    const gun = this.current;
    if (!gun || !this.isReady() || this.isReloading || gun.ammo <= 0 || this.clock < this.nextShotAt) return false;
    gun.ammo--;
    this.nextShotAt = this.clock + 60 / Math.max(gun.roundsPerMinute, 1);

    // Each pellet has a direction of its own inside the cone; what listens to the shot is told of the first.
    const bullet = this.makeBullet(gun);
    this.fireBullet(bullet);
    for (let pellet = 1; pellet < gun.pellets; pellet++) this.fireBullet(this.makeBullet(gun));
    this.flash(gun);
    playSound(gun.shotSound);
    this.rifleSpring.kick(1);
    this.viewSpring.kick(gun.cameraKick);
    this.showAmmo();
    this.onFire.emit(bullet);
    return true;
  }

  /** Starts a reload, if there is something to reload and room for it. Returns whether it began. */
  reload(): boolean {
    const gun = this.current;
    if (!gun || this.isReloading || !this.isReady() || gun.ammo >= gun.magazineSize || gun.reserve <= 0) return false;
    this.isReloading = true;
    this.reloadProgress = 0;
    this.reloadCue = 0;
    this.onReloadStart.emit();
    return true;
  }

  /** Whether the weapon may be used: the `Loadout` has it in hand, alive, the game running. A game that stuns the player does it in the `Loadout`. */
  isReady(): boolean {
    return this.loadout?.isReady() === true;
  }
  //#endregion Public

  //#region Switching
  // The `Loadout` brought a gear out: a reload or an aim does not go on with another one in hand, and the HUD shows what is the firearm's.
  private onGearChange(gear: Gear) {
    this.cancelReload();
    this.triggerHeld = false;
    this.endAim();
    this.hud.setTarget(false);
    if (!(gear instanceof Firearm)) return;
    this.spread = gear.spreadStill;
    this.showHud(gear);
  }

  // What the HUD shows of the weapon in hand: its crosshair and its rounds. The list of what is carried is the `Loadout`'s.
  private showHud(gun: Firearm) {
    this.hud.setCrosshair(gun.crosshair);
    this.showAmmo();
  }

  // The player is back from the dead: the `Loadout` refilled the weapons, this forgets the reload that was going on.
  private onRefilled() {
    this.cancelReload();
    this.showAmmo();
  }
  //#endregion Switching

  //#region Shots
  private makeBullet(gun: Firearm): IBullet {
    const eyes = this.eyes.transform;
    const direction = this.scatter(eyes.forward.normalized, eyes.right.normalized, eyes.up.normalized);
    return { origin: eyes.globalPosition.clone(), direction, damage: gun.damage, range: gun.range };
  }

  // Whether a shot now would hurt something: the same ray as a shot (it ignores the player's own body and the triggers), as far as the weapon reaches, so that anything in the way (a wall in front of an
  // enemy) is what the ray meets. A dead body, a door and the scenery do not count, and nothing does while the weapon is not in hand. A weapon with several pellets scatters them over the cone, so it asks
  // along the middle and along a ring inside the cone too: the crosshair is red when some pellet could hurt, not only when the middle is on it. The HUD only hears when the answer changes.
  private updateTarget(): void {
    const gun = this.current;
    if (!gun || !this.isReady()) {
      this.hud.setTarget(false);
      return;
    }

    const eyes = this.eyes.transform;
    const origin = eyes.globalPosition, forward = eyes.forward.normalized;
    let hurts = this.hurtsAlong(origin, forward, gun.range);
    if (!hurts && gun.pellets > 1 && this.spread > 0) {
      const right = eyes.right.normalized, up = eyes.up.normalized;
      const radius = Math.tan(this.spread * Weapon.PROBE_RING * Math.PI / 180);
      for (let probe = 0; probe < Weapon.PROBES && !hurts; probe++) {
        const angle = probe * 2 * Math.PI / Weapon.PROBES;
        const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
        const direction = new Vector3(forward.x + right.x * x + up.x * y, forward.y + right.y * x + up.y * y, forward.z + right.z * x + up.z * y).normalized;
        hurts = this.hurtsAlong(origin, direction, gun.range);
      }
    }
    this.hud.setTarget(hurts);
  }

  private hurtsAlong(origin: Vector3, direction: Vector3, range: number): boolean {
    const hit = PhysicsSystem.raycast(origin, direction, range, { ignore: this.entity, mask: this.bulletMask });
    const health = hit ? Health.find(hit.entity) : undefined;
    return !!health && !health.isDead;
  }

  // A direction inside a cone of `spread` degrees about `forward`: the radius is the square root of a random number, so the shots lie evenly over the disc and are not bunched at its centre.
  private scatter(forward: Vector3, right: Vector3, up: Vector3): Vector3 {
    if (this.spread <= 0) return forward;
    const radius = Math.tan(this.spread * Math.PI / 180) * Math.sqrt(Math.random());
    const angle = Math.random() * Math.PI * 2;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    return new Vector3(forward.x + right.x * x + up.x * y, forward.y + right.y * x + up.y * y, forward.z + right.z * x + up.z * y).normalized;
  }

  // A bullet flies the ray of its weapon, or, with a `Muzzle Velocity`, a curve that gravity bends. The ray ignores the player's own body and every trigger (a zone is not a thing in the way). `onBulletHit()` says what
  // a hit leaves of the bullet and where it goes on from, and the bullet is cast again from there, up to a few passes.
  private fireBullet(bullet: IBullet): void {
    this.struck.clear();
    let flying: IBullet | undefined = bullet;
    for (let pass = 0; flying && pass < Weapon.MAX_PASSES; pass++) {
      const flight = this.fly(flying);
      flying = flight ? this.onBulletHit(flight.hit, { ...flying, direction: flight.direction }) : undefined;
    }
  }

  // The first thing the bullet meets, and the way it was going there: along a line, or along the curve, cast a piece at a time (each piece a ray from one point of the curve to the next).
  private fly(bullet: IBullet): { hit: IRaycastHit; direction: Vector3 } | undefined {
    const options = { ignore: this.entity, mask: this.bulletMask };
    const velocity = this.current?.muzzleVelocity ?? 0;
    if (velocity <= 0) {
      const hit = PhysicsSystem.raycast(bullet.origin, bullet.direction, bullet.range, options);
      return hit ? { hit, direction: bullet.direction } : undefined;
    }

    let from = bullet.origin;
    for (let start = 0; start < bullet.range; start += Weapon.PIECE) {
      const to = this.pointOnCurve(bullet, velocity, Math.min(start + Weapon.PIECE, bullet.range));
      const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
      const direction = new Vector3(to.x - from.x, to.y - from.y, to.z - from.z).normalized;
      const hit = length > 0 ? PhysicsSystem.raycast(from, direction, length, options) : undefined;
      if (hit) return { hit: { ...hit, distance: start + hit.distance }, direction };
      from = to;
    }
    return undefined;
  }

  // Where the bullet is after `distance` metres of its line: on the line, and under it by the fall of the time it took (gravity is the world's).
  private pointOnCurve(bullet: IBullet, velocity: number, distance: number): Vector3 {
    const time = distance / velocity, fall = 0.5 * time * time;
    const { origin, direction } = bullet, gravity = PhysicsSystem.gravity;
    return new Vector3(origin.x + direction.x * distance + gravity.x * fall, origin.y + direction.y * distance + gravity.y * fall, origin.z + direction.z * distance + gravity.z * fall);
  }

  /** What a bullet does to what it hit. Returns the bullet that goes on from there (where it comes out, its way, what is left of its damage and of its reach), or nothing when it stops. */
  protected onBulletHit(hit: IRaycastHit, bullet: IBullet): IBullet | undefined {
    const penetration = Math.max(this.current?.penetration ?? 1, 0);
    const health = Health.find(hit.entity);
    if (health) {
      const hurts = !this.struck.has(health);
      if (hurts) {
        this.struck.add(health);
        this.hurt(health, hit, bullet);
      }
      const out = this.exitOf(hit, bullet, Weapon.BODY_REACH);
      // Another collider of a body it hurt already costs it nothing.
      return out ? this.goOn(bullet, out.point, hit.distance + Weapon.MARGIN + out.distance, hurts ? bullet.damage * BODY_KEEPS * penetration : bullet.damage) : undefined;
    }

    this.markScenery(hit);
    const reach = stopThickness(hit.collider) * penetration;
    if (reach <= 0) return undefined;

    const out = this.exitOf(hit, bullet, reach);
    if (!out) return undefined;

    if (out.collider === hit.collider) this.markScenery(out);
    const thickness = Weapon.MARGIN + out.distance;
    return this.goOn(bullet, out.point, hit.distance + thickness, bullet.damage * (1 - thickness / reach));
  }

  // The far side of what the bullet went into: a ray from just inside the collider it hit, which meets that collider's other face (`solid: false`, or a ray that starts inside would hit it again at once, and a
  // bullet would never get out of a body). None within `reach`: too thick to go through.
  private exitOf(hit: IRaycastHit, bullet: IBullet, reach: number): IRaycastHit | undefined {
    const { point } = hit;
    const inside = new Vector3(point.x + bullet.direction.x * Weapon.MARGIN, point.y + bullet.direction.y * Weapon.MARGIN, point.z + bullet.direction.z * Weapon.MARGIN);
    return PhysicsSystem.raycast(inside, bullet.direction, reach, { ignore: this.entity, mask: this.bulletMask, solid: false });
  }

  // The bullet after a hit: from `point`, a hair further along its way, with what is left of its damage and of its reach. Nothing when there is too little of either.
  private goOn(bullet: IBullet, point: Vector3, travelled: number, damage: number): IBullet | undefined {
    const range = bullet.range - travelled;
    if (damage < Weapon.MIN_DAMAGE || range <= 0) return undefined;

    const { direction } = bullet;
    return { origin: new Vector3(point.x + direction.x * Weapon.MARGIN, point.y + direction.y * Weapon.MARGIN, point.z + direction.z * Weapon.MARGIN), direction, damage, range };
  }

  private hurt(health: Health, hit: IRaycastHit, bullet: IBullet): void {
    const hitbox = hit.entity.getComponent(Hitbox);
    const zone = hitbox?.zone ?? 'body';
    const wasDead = health.isDead;
    health.damage(bullet.damage * (hitbox?.multiplier ?? 1), { zone, point: hit.point, direction: bullet.direction, source: this.entity });
    this.hud.notifyHit(zone, !wasDead && health.isDead);
  }

  // A mark on a wall or the floor. Paint stays where it is put, so only what does not move gets one.
  private markScenery(hit: IRaycastHit): void {
    if (hit.rigidBody) return;
    const { point, normal } = hit;
    DecalSystem.stain({ position: [point.x, point.y, point.z], normal: [normal.x, normal.y, normal.z], fluid: 1, size: 0.035, depth: 0.04, opacity: 0.9 });
  }
  //#endregion Shots

  //#region Frame
  private pullTrigger() {
    if (!this.triggerHeld) return;
    if (!this.loadout?.holdsPointer()) this.triggerHeld = false;
    else if (this.current?.automatic) this.fire();
  }

  // An empty magazine with rounds in reserve is reloaded once the shot that emptied it is over (the interval of the weapon: a shotgun's pump is part of it). `reload()` asks the rest: in hand, not already going.
  private reloadWhenEmpty() {
    const gun = this.current;
    if (!this.autoReload || !gun || gun.ammo > 0 || this.clock < this.nextShotAt) return;
    this.reload();
  }

  private updateReload(deltaTime: number) {
    const gun = this.current;
    if (!this.isReloading) return;
    if (!gun || !this.isReady()) {
      this.cancelReload();
      return;
    }
    this.reloadProgress = Math.min(1, this.reloadProgress + deltaTime / Math.max(gun.reloadTime, 0.01));
    while (this.reloadCue < Weapon.RELOAD_CUE_TIMES.length && this.reloadProgress >= Weapon.RELOAD_CUE_TIMES[this.reloadCue]) {
      playSound([gun.magazineOutSound, gun.magazineInSound, gun.boltSound][this.reloadCue]);
      this.reloadCue++;
    }
    if (this.reloadProgress < 1) return;

    const taken = Math.min(gun.magazineSize - gun.ammo, gun.reserve);
    gun.ammo += taken;
    gun.reserve -= taken;
    this.cancelReload();
    this.showAmmo();
    this.onReloadEnd.emit();
  }

  private cancelReload() {
    this.isReloading = false;
    this.reloadProgress = 0;
  }

  // The right mouse button held brings the weapon to the eye over `Aim Time`; it lets go of it for a sprint, a reload, a switch or a weapon put away, and takes it up again when the button is still held and
  // the cause is over. The camera goes from the field of view and the sensitivity it had to the narrower one (the sensitivity by the tangent of half the field, so that the same hand moves the same
  // distance on the screen); what it had is read again at every frame at rest, so that a setting changed outside is not undone.
  private updateAim(deltaTime: number) {
    const gun = this.current, camera = this.eyesCamera;
    if (!gun || !camera) return;
    const wanted = this.aimHeld && this.isReady() && !this.isReloading && !this.isSprinting;
    if (this.aimRaw === 0) {
      this.baseFieldOfView = camera.fieldOfView;
      this.baseSensitivity = this.camera?.sensitivity ?? 0;
      if (!wanted) return;
      this.onAimStart.emit();
    }
    const step = deltaTime / Math.max(gun.aimTime, 0.01);
    this.aimRaw = wanted ? Math.min(1, this.aimRaw + step) : Math.max(0, this.aimRaw - step);

    const aim = this.aim, base = this.baseFieldOfView;
    camera.fieldOfView = base + (gun.aimFieldOfView - base) * aim;
    if (this.camera) {
      const zoom = Math.tan(gun.aimFieldOfView * Math.PI / 360) / Math.tan(base * Math.PI / 360);
      this.camera.sensitivity = this.baseSensitivity * (1 + (zoom - 1) * aim);
    }
    this.hud.setAiming(this.aimRaw > 0);
  }

  // Aiming is over at once (another gear came out): the field of view and the sensitivity go back to what the camera had, whatever the weapon that is now in hand does.
  private endAim() {
    if (this.aimRaw > 0) {
      if (this.eyesCamera) this.eyesCamera.fieldOfView = this.baseFieldOfView;
      if (this.camera) this.camera.sensitivity = this.baseSensitivity;
      this.hud.setAiming(false);
    }
    this.aimRaw = 0;
  }

  // The cone follows what the body does: wider with speed, widest in the air, narrower while aiming.
  private updateSpread(deltaTime: number) {
    const gun = this.current;
    if (!gun) return;
    let target = gun.spreadStill;
    if (this.body && this.movement) {
      const velocity = this.body.actualVelocity;
      const speed = Math.min(1, Math.hypot(velocity.x, velocity.z) / Math.max(this.movement.runSpeed, 0.1));
      target = this.body.isGrounded ? gun.spreadStill + (gun.spreadMoving - gun.spreadStill) * speed : gun.spreadAir;
    }
    target *= 1 + (gun.aimSpreadScale - 1) * this.aim;
    this.spread += (target - this.spread) * (1 - Math.exp(-deltaTime / Math.max(gun.spreadTime, 0.001)));
    this.showSpread();
  }

  // With the hands free (the weapon put away, no other gear on its way: what `WeaponStance` reads to relax) there is no weapon whose cone to show: the crosshair is the plain dot, and the weapon's own is told
  // again when one is in hand. A change of gear is not a put-away: the old crosshair stays until the new gear is out, as it did.
  private updateCrosshair() {
    const loadout = this.loadout;
    const bare = !!loadout && !loadout.isHolding && !loadout.isChanging;
    if (bare === this.bare) return;
    this.bare = bare;
    if (bare) {
      this.hud.setCrosshair('dot');
      this.hud.setSpread(0);
      return;
    }
    const gun = this.current;
    if (gun) this.showHud(gun);
  }

  // The cone on the screen: its tangent over the tangent of half the field of view is the share of half the screen's height it covers, whatever the window is.
  private showSpread() {
    if (this.bare) return;
    const fieldOfView = this.eyesCamera?.fieldOfView ?? 60;
    this.hud.setSpread(Math.tan(this.spread * Math.PI / 180) / Math.tan(fieldOfView * Math.PI / 360));
  }

  private updateRecoil(deltaTime: number) {
    this.rifleSpring.step(deltaTime);
    if (!this.camera || !this.viewSpring.isMoving) return;
    this.viewSpring.step(deltaTime);
    // The camera keeps the player's own pitch; the kick sits on top of it for the frames it lasts.
    this.eyes.transform.rotation.x = this.camera.pitch + this.viewSpring.value;
  }

  // The sparks and the glow are the weapon's `MuzzleFlash` (particles); the muzzle, whose light lights the weapon and the hands, comes on for `Flash Time`.
  private flash(gun: Firearm) {
    this.flashLeft = gun.flashSeconds;
    gun.entity.getComponent(MuzzleFlash)?.fire();
    if (gun.muzzle) gun.muzzle.active = true;
  }

  private updateFlash(deltaTime: number) {
    if (this.flashLeft <= 0) return;
    this.flashLeft -= deltaTime;
    if (this.flashLeft > 0) return;
    this.firearms.forEach(firearm => { if (firearm.muzzle) firearm.muzzle.active = false; });
  }
  //#endregion Frame

  private bind() {
    const loadout = this.loadout = this.entity.getComponent(Loadout);
    this.body = this.entity.getComponent(CharacterController);
    this.movement = this.entity.getComponent(PlayerMovement);
    this.camera = this.eyes?.getComponent(FirstPersonCamera);
    this.eyesCamera = this.eyes?.getComponent(Camera);
    loadout?.onSwitch.on(gear => this.onGearChange(gear), this);
    loadout?.onPrimaryDown.on(() => this.onTriggerDown(), this);
    loadout?.onPrimaryUp.on(() => { this.triggerHeld = false; }, this);
    loadout?.onSecondaryDown.on(() => { this.aimHeld = true; }, this);
    loadout?.onSecondaryUp.on(() => { this.aimHeld = false; }, this);
    loadout?.onReload.on(() => { this.reload(); }, this);
    loadout?.onRefill.on(() => this.onRefilled(), this);
  }

  // The `Loadout` heard the click and found the weapon ready; with a firearm in hand it is a shot, or the click of an empty magazine.
  private onTriggerDown() {
    const gun = this.current;
    if (!gun) return;
    this.triggerHeld = true;
    if (gun.ammo > 0) {
      this.fire();
      return;
    }
    if (this.isReloading) return;
    playSound(gun.dryFireSound);
    this.onDryFire.emit();
  }

  private showAmmo() {
    const gun = this.current;
    if (gun) this.hud.setAmmo(gun.ammo, gun.magazineSize, gun.reserve);
  }
}

/** A damped spring that a push sets going: `value` is where it is (0 at rest), and it settles in about a third of a second. It is worked out in small fixed steps, so that it moves the same at any frame rate. */
class Spring {
  private static readonly STIFFNESS = 400;
  private static readonly DAMPING = 36;
  private static readonly STEP = 1 / 240;
  // The push that sends a spring out to 1 at its farthest.
  private static readonly UNIT_PUSH = 52;

  value = 0;
  velocity = 0;

  get isMoving(): boolean {
    return this.value !== 0 || this.velocity !== 0;
  }

  /** A push that takes the spring `amount` out at the farthest. */
  kick(amount: number): void {
    this.velocity += amount * Spring.UNIT_PUSH;
  }

  step(deltaTime: number): void {
    if (!this.isMoving) return;
    for (let left = deltaTime; left > 0; left -= Spring.STEP) {
      const dt = Math.min(Spring.STEP, left);
      this.velocity += (-Spring.STIFFNESS * this.value - Spring.DAMPING * this.velocity) * dt;
      this.value += this.velocity * dt;
    }
    if (Math.abs(this.value) < 1e-4 && Math.abs(this.velocity) < 1e-3) this.value = this.velocity = 0;
  }
}
