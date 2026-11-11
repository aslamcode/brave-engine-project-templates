import { BraveEngine, BraveEngineModeEnum, Bool, Camera, CharacterController, Cursor, DecalSystem, Entity, FirstPersonCamera, Float, Inject, Input, Int, IRaycastHit, JsonIgnore, PhysicsSystem, PlayerMovement, Ref, Saved, Script, ScriptComponent, Select, Signal, Time, Vector3 } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { FirstPersonArms } from '../player/first-person-arms';
import { Health } from './health';

/** The crosshair a weapon has: a centre and four ticks, or two arcs and a small ring (the shotgun's: the arcs open with the spread, so they show where the pellets may go). */
export type CrosshairStyle = 'dot' | 'arcs';
import { Hitbox } from './hitbox';
import { playSound } from './play-sound';

/** One shot on its way: where it starts, which way it goes, what is left of its damage and of its reach. `Weapon.onBulletHit()` is where a bullet that goes on after a hit would be handled. */
export interface IBullet {
  origin: Vector3;
  direction: Vector3;
  damage: number;
  range: number;
}

/**
 * The rifle of the first person player: the left mouse fires, R reloads, the shot is a ray from the camera. It lives on the `Player` entity, next to the `Health`, the `WeaponStance` that poses the
 * rifle and the `FirstPersonArms` that holds it; it only reads them.
 *
 * A hit finds the `Health` above the collider it hit (`Health.find()`), scales the damage by the `Hitbox` of that collider (`zone`, `multiplier`) and tells the HUD. What a hit on scenery does (a mark on
 * the wall) and what a bullet does after a hit are in `onBulletHit()`: the rest of the script never asks what a shot hit.
 *
 * Reloading is a timeline in game time (`reloadProgress`, 0 to 1) that the sounds are cued on and that `WeaponStance` poses the arms from; the rounds are added at the end. It is cancelled when the weapon
 * is put away (`1`) or the player dies, and a shot cannot be fired while it lasts.
 */
@Script()
export class Weapon extends ScriptComponent {

  // Where in the reload (0 to 1) the three sounds are: the magazine out, the magazine in, the bolt.
  private static readonly RELOAD_CUE_TIMES = [0.18, 0.62, 0.88];

  @Ref(Entity, { header: 'Parts', label: 'Eyes', tooltip: 'The camera: a shot starts here and goes where it looks.' }) eyes!: Entity;
  @Ref(Entity, { label: 'Muzzle', tooltip: 'A point at the barrel tip, off at the start, with a Light on it: it is switched on for a few frames at each shot.' }) muzzle?: Entity;
  @Ref(Entity, { label: 'Shot Sound', tooltip: 'An entity with an Audio Source, or with several as children: one of them plays at each shot.' }) shotSound?: Entity;
  @Ref(Entity, { label: 'Dry Fire Sound', tooltip: 'The click of a trigger pulled on an empty magazine.' }) dryFireSound?: Entity;
  @Ref(Entity, { label: 'Magazine Out Sound' }) magazineOutSound?: Entity;
  @Ref(Entity, { label: 'Magazine In Sound' }) magazineInSound?: Entity;
  @Ref(Entity, { label: 'Bolt Sound' }) boltSound?: Entity;

  @Bool({ header: 'Fire', label: 'Automatic', tooltip: 'On: holding the button keeps firing. Off: one shot for each click.' }) automatic = true;
  @Float({ label: 'Rounds per Minute' }) roundsPerMinute = 600;
  @Int({ label: 'Pellets', tooltip: 'How many bullets one shot sends, each in its own direction inside the cone: 1 is a rifle, 8 to 12 a shotgun (give it a wide Spread and a low Rounds per Minute).' }) pellets = 1;
  @Float({ label: 'Damage', suffix: 'HP', tooltip: 'What a bullet takes from a body zone (multiplier 1; each pellet of a shotgun takes this); a head takes its Hitbox multiplier times this.' }) damage = 25;
  @Float({ label: 'Range', suffix: 'm' }) range = 120;

  @Float({ header: 'Spread', label: 'Still', suffix: '°', tooltip: 'The half angle of the cone a shot goes in, standing still.' }) spreadStill = 0.15;
  @Float({ label: 'Moving', suffix: '°', tooltip: 'The same at the run speed. In between it follows the speed.' }) spreadMoving = 1.2;
  @Float({ label: 'In the Air', suffix: '°', tooltip: 'The same while jumping or falling.' }) spreadAir = 3;
  @Float({ label: 'Settle Time', suffix: 's', tooltip: 'How long the spread takes to follow what the player does.' }) spreadTime = 0.12;

  @Select({ header: 'Crosshair', label: 'Crosshair', optionsKey: 'crosshairOptions', sort: false, tooltip: 'Dot: a centre and four ticks that open with the spread. Arcs: two arcs, one each side, and a small ring in the middle, that open with the spread (the shotgun\'s).' }) crosshair: CrosshairStyle = 'dot';

  @Int({ header: 'Ammo', label: 'Magazine', tooltip: 'Rounds in a full magazine.' }) magazineSize = 30;
  @Int({ label: 'Reserve', tooltip: 'Rounds carried besides the magazine, when the game starts.' }) startingReserve = 120;
  @Float({ label: 'Reload Time', suffix: 's' }) reloadTime = 2.2;

  @Float({ header: 'Feel', label: 'Camera Kick', suffix: '°', tooltip: 'How far the view climbs at each shot before it settles back.' }) cameraKick = 0.8;
  @Float({ label: 'Flash Time', suffix: 's', tooltip: 'How long the muzzle light stays on.' }) flashSeconds = 0.07;

  @Bool({ header: 'Testing', label: 'Fire Without Pointer Lock', tooltip: 'The game fires only while it holds the pointer (the click that locks it does not shoot). A test, where the browser refuses the lock, turns this on.' }) fireWithoutLock = false;

  @JsonIgnore() protected crosshairOptions = [{ value: 'dot', description: 'Dot' }, { value: 'arcs', description: 'Arcs' }];

  @Inject(Hud) hud!: Hud;

  /** Rounds in the magazine and in reserve. In a save, not in the scene file. */
  @JsonIgnore() @Saved() ammo = 0;
  @JsonIgnore() @Saved() reserve = 0;
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

  @JsonIgnore() private arms?: FirstPersonArms;
  @JsonIgnore() private health?: Health;
  @JsonIgnore() private body?: CharacterController;
  @JsonIgnore() private movement?: PlayerMovement;
  @JsonIgnore() private camera?: FirstPersonCamera;
  @JsonIgnore() private clock = 0;
  @JsonIgnore() private nextShotAt = 0;
  @JsonIgnore() private triggerHeld = false;
  @JsonIgnore() private tookInHand = false;
  @JsonIgnore() private flashLeft = 0;
  // The kick of the rifle and the climb of the view: a shot gives each a push (1 for the rifle, as many degrees as `Camera Kick` for the view).
  @JsonIgnore() private readonly rifleSpring = new Spring();
  @JsonIgnore() private readonly viewSpring = new Spring();
  @JsonIgnore() @Saved() private reloadCue = 0;
  @JsonIgnore() private listeners: Parameters<typeof Input.removeListner>[0][] = [];

  onAwake() {
    this.ammo = this.magazineSize;
    this.reserve = this.startingReserve;
    this.isReloading = false;
    this.reloadProgress = 0;
  }

  onStart() {
    this.bind();
    this.listen();
    this.spread = this.spreadStill;
    this.hud.setCrosshair(this.crosshair);
    this.showAmmo();
    if (this.muzzle) this.muzzle.active = false;
  }

  onUpdate() {
    const deltaTime = Time.deltaTime;
    this.clock += deltaTime;
    this.takeInHand();
    this.pullTrigger();
    this.updateReload(deltaTime);
    this.updateSpread(deltaTime);
    this.updateRecoil(deltaTime);
    this.updateFlash(deltaTime);
    this.updateTarget();
  }

  // What a script registers it gives back: the callbacks would go on calling a script that is gone.
  onDestroy() {
    this.cancelListen();
  }

  // The copy holds the original's handles: it makes its own when it starts, and must never remove the original's.
  onAfterClone() {
    this.listeners = [];
  }

  // A save brings the component back as it was, started: what `onStart()` registered is not there any more.
  onRestore() {
    this.cancelListen();
    this.bind();
    this.listen();
    this.showAmmo();
    // The arms do not keep what they hold in a save: the weapon is taken in hand again on the next frame.
    this.tookInHand = false;
  }

  //#region Public
  /** How hard the rifle is kicked: 1 right after a shot, then back to 0. `WeaponStance` poses the rifle from it. */
  get recoil(): number {
    return this.rifleSpring.value;
  }

  /** One shot, if the weapon is ready, is not being reloaded and has a round: the round goes, the bullet flies, the rifle kicks. Returns whether it fired. */
  fire(): boolean {
    if (!this.isReady() || this.isReloading || this.ammo <= 0 || this.clock < this.nextShotAt) return false;
    this.ammo--;
    this.nextShotAt = this.clock + 60 / Math.max(this.roundsPerMinute, 1);

    // Each pellet has a direction of its own inside the cone; what listens to the shot is told of the first.
    const bullet = this.makeBullet();
    this.fireBullet(bullet);
    for (let pellet = 1; pellet < this.pellets; pellet++) this.fireBullet(this.makeBullet());
    this.flash();
    playSound(this.shotSound);
    this.rifleSpring.kick(1);
    this.viewSpring.kick(this.cameraKick);
    this.showAmmo();
    this.onFire.emit(bullet);
    return true;
  }

  /** Starts a reload, if there is something to reload and room for it. Returns whether it began. */
  reload(): boolean {
    if (this.isReloading || !this.isReady() || this.ammo >= this.magazineSize || this.reserve <= 0) return false;
    this.isReloading = true;
    this.reloadProgress = 0;
    this.reloadCue = 0;
    this.onReloadStart.emit();
    return true;
  }

  /** Gives the magazine and the reserve back in full (the player is back from the dead). */
  refill(): void {
    this.cancelReload();
    this.ammo = this.magazineSize;
    this.reserve = this.startingReserve;
    this.showAmmo();
  }

  /** Whether the weapon may be used: in hand, its owner alive, the game running. A game that stuns the player does it here. */
  isReady(): boolean {
    return this.arms?.equipped === true && !this.health?.isDead && BraveEngine.mode === BraveEngineModeEnum.Running;
  }
  //#endregion Public

  //#region Shots
  private makeBullet(): IBullet {
    const eyes = this.eyes.transform;
    const direction = this.scatter(eyes.forward.normalized, eyes.right.normalized, eyes.up.normalized);
    return { origin: eyes.globalPosition.clone(), direction, damage: this.damage, range: this.range };
  }

  // Whether a shot at the middle of the crosshair would hurt something: the same ray as a shot (it ignores the player's own body and the triggers), as far as the weapon reaches, so that anything in the
  // way (a wall in front of an enemy) is what the ray meets. A dead body, a door and the scenery do not count, and nothing does while the weapon is not in hand. The HUD only hears when the answer changes.
  private updateTarget(): void {
    if (!this.isReady()) {
      this.hud.setTarget(false);
      return;
    }

    const eyes = this.eyes.transform;
    const hit = PhysicsSystem.raycast(eyes.globalPosition, eyes.forward.normalized, this.range, { ignore: this.entity });
    const health = hit ? Health.find(hit.entity) : undefined;
    this.hud.setTarget(!!health && !health.isDead);
  }

  // A direction inside a cone of `spread` degrees about `forward`: the radius is the square root of a random number, so the shots lie evenly over the disc and are not bunched at its centre.
  private scatter(forward: Vector3, right: Vector3, up: Vector3): Vector3 {
    if (this.spread <= 0) return forward;
    const radius = Math.tan(this.spread * Math.PI / 180) * Math.sqrt(Math.random());
    const angle = Math.random() * Math.PI * 2;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    return new Vector3(forward.x + right.x * x + up.x * y, forward.y + right.y * x + up.y * y, forward.z + right.z * x + up.z * y).normalized;
  }

  // The ray ignores the player's own body and every trigger (a zone is not a thing in the way). A bullet that goes on after a hit (through a thin wall, by the material and the thickness) is a loop here: cast
  // again from the hit point with what `onBulletHit()` leaves of the bullet, until nothing is left. Today a bullet stops at the first thing.
  private fireBullet(bullet: IBullet): void {
    const hit = PhysicsSystem.raycast(bullet.origin, bullet.direction, bullet.range, { ignore: this.entity });
    if (hit) this.onBulletHit(hit, bullet);
  }

  /** What a bullet does to what it hit. Returns the damage it still has: 0, it stops. */
  protected onBulletHit(hit: IRaycastHit, bullet: IBullet): number {
    const health = Health.find(hit.entity);
    if (health) this.hurt(health, hit, bullet);
    else this.markScenery(hit);
    return 0;
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
    if (!this.fireWithoutLock && !Cursor.isLocked) this.triggerHeld = false;
    else if (this.automatic) this.fire();
  }

  private updateReload(deltaTime: number) {
    if (!this.isReloading) return;
    if (!this.isReady()) {
      this.cancelReload();
      return;
    }
    this.reloadProgress = Math.min(1, this.reloadProgress + deltaTime / Math.max(this.reloadTime, 0.01));
    while (this.reloadCue < Weapon.RELOAD_CUE_TIMES.length && this.reloadProgress >= Weapon.RELOAD_CUE_TIMES[this.reloadCue]) {
      playSound([this.magazineOutSound, this.magazineInSound, this.boltSound][this.reloadCue]);
      this.reloadCue++;
    }
    if (this.reloadProgress < 1) return;

    const taken = Math.min(this.magazineSize - this.ammo, this.reserve);
    this.ammo += taken;
    this.reserve -= taken;
    this.cancelReload();
    this.showAmmo();
    this.onReloadEnd.emit();
  }

  private cancelReload() {
    this.isReloading = false;
    this.reloadProgress = 0;
  }

  // The cone follows what the body does: wider with speed, widest in the air.
  private updateSpread(deltaTime: number) {
    let target = this.spreadStill;
    if (this.body && this.movement) {
      const velocity = this.body.actualVelocity;
      const speed = Math.min(1, Math.hypot(velocity.x, velocity.z) / Math.max(this.movement.runSpeed, 0.1));
      target = this.body.isGrounded ? this.spreadStill + (this.spreadMoving - this.spreadStill) * speed : this.spreadAir;
    }
    this.spread += (target - this.spread) * (1 - Math.exp(-deltaTime / Math.max(this.spreadTime, 0.001)));
    this.showSpread();
  }

  // The cone on the screen: its tangent over the tangent of half the field of view is the share of half the screen's height it covers, whatever the window is.
  private showSpread() {
    const fieldOfView = this.eyes.getComponent(Camera)?.fieldOfView ?? 60;
    this.hud.setSpread(Math.tan(this.spread * Math.PI / 180) / Math.tan(fieldOfView * Math.PI / 360));
  }

  private updateRecoil(deltaTime: number) {
    this.rifleSpring.step(deltaTime);
    if (!this.camera || !this.viewSpring.isMoving) return;
    this.viewSpring.step(deltaTime);
    // The camera keeps the player's own pitch; the kick sits on top of it for the frames it lasts.
    this.eyes.transform.rotation.x = this.camera.pitch + this.viewSpring.value;
  }

  // The muzzle comes on for `Flash Time`, a little different every time (its size and how it is turned), as a flash is.
  private flash() {
    this.flashLeft = this.flashSeconds;
    if (!this.muzzle) return;
    const size = 0.7 + Math.random() * 0.45;
    this.muzzle.transform.scale.set(size, size, size);
    this.muzzle.transform.rotation.z = Math.random() * 90;
    this.muzzle.active = true;
  }

  private updateFlash(deltaTime: number) {
    if (this.flashLeft <= 0) return;
    this.flashLeft -= deltaTime;
    if (this.flashLeft <= 0 && this.muzzle) this.muzzle.active = false;
  }

  // The arms reset themselves in their own `onStart()`, which may run after this one: the weapon is taken in hand on the first frame, once. After that `1` puts it away and brings it back.
  private takeInHand() {
    if (this.tookInHand || !this.arms) return;
    this.tookInHand = true;
    this.arms.equip();
  }
  //#endregion Frame

  private bind() {
    this.arms = this.entity.getComponent(FirstPersonArms);
    this.health = this.entity.getComponent(Health);
    this.body = this.entity.getComponent(CharacterController);
    this.movement = this.entity.getComponent(PlayerMovement);
    this.camera = this.eyes?.getComponent(FirstPersonCamera);
  }

  private listen() {
    this.listeners.push(
      Input.mouse.left.down(() => this.onTriggerDown()),
      Input.mouse.left.up(() => { this.triggerHeld = false; }),
      Input.keyboard.keyR.down(() => { this.reload(); }),
    );
  }

  private cancelListen() {
    this.listeners.forEach(listener => Input.removeListner(listener));
    this.listeners = [];
  }

  // The click that locks the pointer arrives here too, before the lock: with no lock yet it is not a shot.
  private onTriggerDown() {
    if (!this.fireWithoutLock && !Cursor.isLocked) return;
    if (!this.isReady()) return;
    this.triggerHeld = true;
    if (this.ammo > 0) {
      this.fire();
      return;
    }
    if (this.isReloading) return;
    playSound(this.dryFireSound);
    this.onDryFire.emit();
  }

  private showAmmo() {
    this.hud.setAmmo(this.ammo, this.magazineSize, this.reserve);
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
