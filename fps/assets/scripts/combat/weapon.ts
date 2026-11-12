import { BraveEngine, BraveEngineModeEnum, Bool, Camera, CharacterController, Cursor, DecalSystem, Entity, FirstPersonCamera, IEntity, Inject, Input, IRaycastHit, JsonIgnore, PhysicsSystem, PlayerMovement, Ref, Saved, Script, ScriptComponent, Signal, Time, TwoBoneIK, Vector3 } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { FirstPersonArms } from '../player/first-person-arms';
import { Firearm } from './firearm';
import { Health } from './health';
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
 * What the first person player does with a weapon: the left mouse fires, R reloads, the right mouse aims, the keys 1 to 9 and the wheel take a weapon in hand, and the shot is a ray from the camera. It lives
 * on the `Player` entity, next to the `Health`, the `WeaponStance` that poses the weapon and the `FirstPersonArms` that holds it; it only reads them. The weapons themselves are the `Firearm`s under the
 * `Weapons` entity in the right hand: their numbers, their parts and the rounds each one holds are theirs, and this fires whichever is in hand.
 *
 * A key takes a weapon in hand: the arms go back to the body, the model changes, and the arms come out again (`Equip Time` twice); the key of the weapon in hand puts it away. A hit finds the `Health` above the
 * collider it hit (`Health.find()`), scales the damage by the `Hitbox` of that collider (`zone`, `multiplier`) and tells the HUD. What a hit on scenery does (a mark on the wall) and what a bullet does after
 * a hit are in `onBulletHit()`: the rest of the script never asks what a shot hit.
 *
 * Reloading is a timeline in game time (`reloadProgress`, 0 to 1) that the sounds are cued on and that `WeaponStance` poses the arms from; the rounds are added at the end. It is cancelled when the weapon is
 * put away or changed, or the player dies, and a shot cannot be fired while it lasts. Aiming (`aim`, 0 to 1) narrows the field of view, closes the spread and brings the weapon to the eye; it ends with a
 * sprint, a reload, a switch.
 */
@Script()
export class Weapon extends ScriptComponent {

  // Where in the reload (0 to 1) the three sounds are: the magazine out, the magazine in, the bolt.
  private static readonly RELOAD_CUE_TIMES = [0.18, 0.62, 0.88];
  // The rays a weapon with several pellets asks along besides the middle one (to know whether the crosshair turns red): this many, round a ring this share of the way out in the cone.
  private static readonly PROBES = 6;
  private static readonly PROBE_RING = 0.8;

  @Ref(Entity, { header: 'Parts', label: 'Eyes', tooltip: 'The camera: a shot starts here and goes where it looks.' }) eyes!: Entity;
  @Ref(Entity, { label: 'Weapons', tooltip: 'The entity in the right hand that has the weapons as its children: each child has a Firearm.' }) holder!: Entity;

  @Bool({ header: 'Start', label: 'Start Equipped', tooltip: 'On: the first weapon is in hand when the game starts. Off: it starts put away, with the magazine loaded all the same, and its key brings it up.' }) startEquipped = true;

  @Bool({ header: 'Testing', label: 'Fire Without Pointer Lock', tooltip: 'The game fires only while it holds the pointer (the click that locks it does not shoot). A test, where the browser refuses the lock, turns this on.' }) fireWithoutLock = false;

  @Inject(Hud) hud!: Hud;

  /** A reload is going on, and how far (0 to 1) it is. */
  @JsonIgnore() @Saved() isReloading = false;
  @JsonIgnore() @Saved() reloadProgress = 0;
  /** The slot of the weapon in hand, or of the one being raised: 0 until the first is taken. */
  @JsonIgnore() @Saved() slot = 0;
  /** The half angle of the cone the next shot goes in, in degrees. */
  @JsonIgnore() spread = 0;

  /** A shot was fired (and the round taken out). */
  onFire = new Signal<IBullet>();
  /** The trigger was pulled on an empty magazine. */
  onDryFire = new Signal();
  onReloadStart = new Signal();
  /** The rounds are in. Not told for a reload that was cancelled. */
  onReloadEnd = new Signal();
  /** A weapon was brought out: the one the player now holds, or is raising. */
  onSwitch = new Signal<Firearm>();
  /** The player began to aim. */
  onAimStart = new Signal();

  @JsonIgnore() private cache?: Firearm[];
  @JsonIgnore() private arms?: FirstPersonArms;
  @JsonIgnore() private health?: Health;
  @JsonIgnore() private body?: CharacterController;
  @JsonIgnore() private movement?: PlayerMovement;
  @JsonIgnore() private camera?: FirstPersonCamera;
  @JsonIgnore() private eyesCamera?: Camera;
  @JsonIgnore() private leftHand?: TwoBoneIK;
  @JsonIgnore() private clock = 0;
  @JsonIgnore() private nextShotAt = 0;
  @JsonIgnore() private triggerHeld = false;
  @JsonIgnore() private aimHeld = false;
  @JsonIgnore() private tookInHand = false;
  @JsonIgnore() private flashLeft = 0;
  // The weapon the arms are going down to change to: it is brought out when they are at the body.
  @JsonIgnore() private pending?: Firearm;
  // Aiming: how far (0 to 1, linear in time), and the field of view and the look sensitivity the camera had before it began (what it goes back to).
  @JsonIgnore() @Saved() private aimRaw = 0;
  @JsonIgnore() @Saved() private baseFieldOfView = 0;
  @JsonIgnore() @Saved() private baseSensitivity = 0;
  // The kick of the weapon and the climb of the view: a shot gives each a push (1 for the weapon, as many degrees as `Camera Kick` for the view).
  @JsonIgnore() private readonly rifleSpring = new Spring();
  @JsonIgnore() private readonly viewSpring = new Spring();
  @JsonIgnore() @Saved() private reloadCue = 0;
  @JsonIgnore() private listeners: Parameters<typeof Input.removeListner>[0][] = [];

  onAwake() {
    this.firearms.forEach(firearm => firearm.refill());
    this.isReloading = false;
    this.reloadProgress = 0;
  }

  onStart() {
    this.bind();
    this.listen();
    const first = this.current ?? this.firearms[0];
    if (!first) return;
    this.firearms.forEach(firearm => { if (firearm.muzzle) firearm.muzzle.active = false; });
    this.bring(first);
  }

  onUpdate() {
    const deltaTime = Time.deltaTime;
    this.clock += deltaTime;
    this.takeInHand();
    this.changeWeapon();
    this.pullTrigger();
    this.updateReload(deltaTime);
    this.updateAim(deltaTime);
    this.updateSpread(deltaTime);
    this.updateRecoil(deltaTime);
    this.updateFlash(deltaTime);
    this.updateTarget();
  }

  // What a script registers it gives back: the callbacks would go on calling a script that is gone.
  onDestroy() {
    this.cancelListen();
  }

  // The copy holds the original's handles and its list of weapons: it makes its own when it starts, and must never remove the original's.
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
    const gun = this.current;
    if (gun) this.bring(gun, this.aimRaw);
    // The arms do not keep what they hold in a save: the weapon is taken in hand again on the next frame.
    this.tookInHand = false;
  }

  //#region Public
  /** The weapons the player carries, in the order of their slots. */
  get firearms(): readonly Firearm[] {
    return this.cache ??= this.collect();
  }

  /** The weapon in hand, or the one being raised. */
  get current(): Firearm | undefined {
    return this.firearms.find(firearm => firearm.slot === this.slot);
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

  /** Puts `rounds` in the reserve of the weapon of `slot` (0: the one in hand), up to its `Reserve Limit`. Returns how many went in: 0 for a weapon that is not carried or has no room. */
  give(rounds: number, slot = 0): number {
    const gun = slot > 0 ? this.firearms.find(firearm => firearm.slot === slot) : this.current ?? this.firearms[0];
    if (!gun || !(rounds > 0)) return 0;
    const room = gun.reserveLimit > 0 ? Math.max(gun.reserveLimit - gun.reserve, 0) : rounds;
    const added = Math.min(Math.floor(rounds), room);
    gun.reserve += added;
    if (gun === this.current) this.showAmmo();
    return added;
  }

  /** Gives every weapon its magazine and its reserve back in full (the player is back from the dead). */
  refill(): void {
    this.cancelReload();
    this.firearms.forEach(firearm => firearm.refill());
    this.showAmmo();
  }

  /** Takes the weapon of a slot in hand: from the body, the arms come out with it; from another weapon, the arms go back first; the key of the weapon in hand puts it away. Returns whether the slot has a weapon. */
  select(slot: number): boolean {
    const gun = this.firearms.find(firearm => firearm.slot === slot);
    if (!gun || !this.canChange()) return false;
    const arms = this.arms;
    if (!arms) return false;

    if (arms.equipped && gun === this.current && !this.pending) {
      arms.unequip();
      return true;
    }
    this.drawTo(gun);
    return true;
  }

  /** The next weapon (1) or the one before (-1), by slot, never putting one away: with none in hand it takes one out. */
  cycle(step: number): boolean {
    const guns = this.firearms;
    if (guns.length === 0 || !this.canChange()) return false;
    const from = this.pending ?? this.current ?? guns[0];
    const next = guns[(guns.indexOf(from) + step + guns.length) % guns.length];
    if (next === from && this.arms?.equipped) return false;
    this.drawTo(next);
    return true;
  }

  /** Whether the weapon may be used: its owner on (a character that is switched off still hears the mouse, and must not shoot from where it stands), in hand, alive, the game running. A game that stuns the player does it here. */
  isReady(): boolean {
    return this.entity.activeInHierarchy && this.arms?.equipped === true && !this.pending && !this.health?.isDead && BraveEngine.mode === BraveEngineModeEnum.Running;
  }
  //#endregion Public

  //#region Switching
  // The owner is on, alive and the game runs: a key does nothing otherwise (a character that is off still hears the keyboard).
  private canChange(): boolean {
    return this.entity.activeInHierarchy && !this.health?.isDead && BraveEngine.mode === BraveEngineModeEnum.Running;
  }

  // From the body the weapon is brought out at once and the arms come out; in hand, the arms go down first and `changeWeapon()` brings it out when they are there.
  private drawTo(gun: Firearm) {
    const arms = this.arms;
    if (!arms) return;
    if (arms.equipped) {
      if (gun === this.current) return;
      this.pending = gun;
      arms.unequip();
      return;
    }
    // The arms are going down: for the weapon in hand it is a change of mind (they come out again), for another one it is the weapon to bring out when they are down.
    if (this.pending || arms.reach > 0) {
      if (gun === this.current && this.pending) {
        this.pending = undefined;
        arms.equip();
      } else {
        this.pending = gun;
      }
      return;
    }
    this.bring(gun);
    arms.equip();
  }

  private changeWeapon() {
    const gun = this.pending;
    if (!gun || !this.arms || this.arms.equipped || this.arms.reach > 0) return;
    this.pending = undefined;
    this.bring(gun);
    this.arms.equip();
  }

  // Shows the model of a weapon and hides the others, points the left hand at its grip and tells the HUD. What the weapon held stays in the weapon.
  private bring(gun: Firearm, aim = 0) {
    this.slot = gun.slot;
    this.firearms.forEach(firearm => { firearm.entity.active = firearm === gun; });
    if (this.leftHand && gun.gripLeft) this.leftHand.target = gun.gripLeft;
    this.cancelReload();
    this.triggerHeld = false;
    this.aimRaw = aim;
    this.spread = gun.spreadStill;
    this.hud.setCrosshair(gun.crosshair);
    this.hud.setWeapons(this.firearms.map(firearm => firearm.label), this.firearms.indexOf(gun));
    this.showAmmo();
    this.onSwitch.emit(gun);
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
    const hit = PhysicsSystem.raycast(origin, direction, range, { ignore: this.entity });
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
    else if (this.current?.automatic) this.fire();
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

  // The cone on the screen: its tangent over the tangent of half the field of view is the share of half the screen's height it covers, whatever the window is.
  private showSpread() {
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

  // The muzzle comes on for `Flash Time`, a little different every time (its size and how it is turned), as a flash is.
  private flash(gun: Firearm) {
    this.flashLeft = gun.flashSeconds;
    if (!gun.muzzle) return;
    const size = 0.7 + Math.random() * 0.45;
    gun.muzzle.transform.scale.set(size, size, size);
    gun.muzzle.transform.rotation.z = Math.random() * 90;
    gun.muzzle.active = true;
  }

  private updateFlash(deltaTime: number) {
    if (this.flashLeft <= 0) return;
    this.flashLeft -= deltaTime;
    if (this.flashLeft > 0) return;
    this.firearms.forEach(firearm => { if (firearm.muzzle) firearm.muzzle.active = false; });
  }

  // The arms reset themselves in their own `onStart()`, which may run after this one: the weapon is taken in hand on the first frame, once (unless it starts put away). After that its key puts it away and brings it back.
  private takeInHand() {
    if (this.tookInHand || !this.arms) return;
    this.tookInHand = true;
    if (this.startEquipped) this.arms.equip();
  }
  //#endregion Frame

  private collect(): Firearm[] {
    const guns: Firearm[] = [];
    this.holder?.children.forEach(child => {
      const gun = child.getComponent(Firearm);
      if (gun) guns.push(gun);
    });
    return guns.sort((a, b) => a.slot - b.slot);
  }

  private bind() {
    this.arms = this.entity.getComponent(FirstPersonArms);
    this.health = this.entity.getComponent(Health);
    this.body = this.entity.getComponent(CharacterController);
    this.movement = this.entity.getComponent(PlayerMovement);
    this.camera = this.eyes?.getComponent(FirstPersonCamera);
    this.eyesCamera = this.eyes?.getComponent(Camera);
    // The left hand reaches for a grip of the weapon in hand: the one of the two hands whose target is below the weapons.
    this.leftHand = this.entity.components.find((component): component is TwoBoneIK => component instanceof TwoBoneIK && this.isInHolder(component.target));
  }

  private isInHolder(entity?: IEntity): boolean {
    for (let current = entity; current; current = current.parent) if (current === this.holder) return true;
    return false;
  }

  private listen() {
    const digits = [Input.keyboard.digit1, Input.keyboard.digit2, Input.keyboard.digit3, Input.keyboard.digit4, Input.keyboard.digit5, Input.keyboard.digit6, Input.keyboard.digit7, Input.keyboard.digit8, Input.keyboard.digit9];
    this.listeners.push(
      Input.mouse.left.down(() => this.onTriggerDown()),
      Input.mouse.left.up(() => { this.triggerHeld = false; }),
      Input.mouse.right.down(() => { if (this.fireWithoutLock || Cursor.isLocked) this.aimHeld = true; }),
      Input.mouse.right.up(() => { this.aimHeld = false; }),
      Input.mouse.wheel.down(() => { this.cycle(1); }),
      Input.mouse.wheel.up(() => { this.cycle(-1); }),
      Input.keyboard.keyR.down(() => { this.reload(); }),
      ...digits.map((key, index) => key.down(() => { this.select(index + 1); })),
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
    const gun = this.current;
    if (!gun) return;
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
