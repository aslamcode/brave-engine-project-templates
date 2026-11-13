import { Bool, CharacterController, Entity, Float, Inject, JsonIgnore, PlayerMovement, Quaternion, Ref, Saved, Script, ScriptComponent, State, Time, Vector3 } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Loadout } from '../gear/loadout';
import { Firearm } from './firearm';
import { Weapon } from './weapon';

/**
 * How the character carries the weapon, as poses of the point the right hand reaches (`Hold Right`) and of the one the left hand reaches (the `Grip Left` of the weapon in hand): the locomotion animations are
 * the character's own and are not touched, the weapon and the arms go where the IK targets go.
 *
 * Two stances. **Alert** is the pose `Hold Right` was authored in: the weapon at the shoulder (it is how the character stands). **Relaxed** is that pose moved down and back and the
 * barrel tilted down: the weapon at the hip. **Aiming** (the right mouse button, `Weapon.aim`) moves the weapon from the alert pose to the eye by the `Aim` numbers of its `Firearm`. A shot (or a reload) makes the character alert and keeps it so for `Alert Seconds` of game time after the last one, as long as the weapon is in the hands (put away, or with another kind of gear in them, it is relaxed at once); then it goes back to relaxed, slowly. Running
 * lowers the rifle like a sprint does (`Lower When Running`), except in the moment after a shot.
 *
 * On top of the stance come the kick of every shot (`Weapon.recoil`: the rifle back, up and tilted up) and the reload (`Weapon.reloadProgress`: the rifle dips and rolls, the left hand goes down and back
 * for the magazine and returns). All of it is written as an offset from the authored pose in the chest's own axes (so it follows the lean of the spine with the look), every frame from scratch: nothing
 * accumulates, and `Weapon Retreat`, which pulls `Hold Right` back from a wall after this has run, sees the pose it should start from.
 */
@Script()
export class WeaponStance extends ScriptComponent {

  // How long after a shot a running character keeps the rifle up.
  private static readonly SHOT_HOLD_SECONDS = 0.6;
  // How much of the reload the rifle takes to dip, and to come back up.
  private static readonly RELOAD_EASE = 0.12;
  // The left hand's way during a reload, as [time (0 to 1), metres down, metres back] along the weapon's own axes (its -Z is the barrel, its Y up): to the magazine well, down for the new
  // magazine, back up to the well, then home to the handguard.
  private static readonly LEFT_HAND_PATH = [
    [0, 0, 0],
    [0.14, 0.09, 0.1],
    [0.3, 0.2, 0.14],
    [0.5, 0.2, 0.1],
    [0.64, 0.08, 0.1],
    [0.8, 0.02, 0.03],
    [1, 0, 0],
  ];
  private static readonly scratch = new Quaternion();

  @Ref(Entity, { header: 'Parts', label: 'Hold Right', tooltip: 'The point the right hand reaches: a child of the chest. Its authored pose is the alert stance.' }) hold!: Entity;
  @Ref(Entity, { label: 'Eyes', tooltip: 'The camera: its heading says which way is forward.' }) eyes!: Entity;

  @Float({ header: 'Stance', label: 'Alert Seconds', suffix: 's', tooltip: 'How long the character stays alert after the last shot or reload.' }) alertSeconds = 30;
  @Bool({ label: 'Lower When Running', tooltip: 'The rifle goes down while Shift is held and the body moves, like a sprint.' }) lowerWhenRunning = true;
  @Float({ label: 'Raise Time', suffix: 's', tooltip: 'How long the rifle takes to come up to the shoulder.' }) raiseTime = 0.2;
  @Float({ label: 'Lower Time', suffix: 's', tooltip: 'How long it takes to go down to the hip.' }) lowerTime = 0.5;

  @Float({ header: 'Relaxed Pose', label: 'Lower', suffix: 'm', tooltip: 'How far down the right hand is from the alert pose.' }) relaxedLower = 0.05;
  @Float({ label: 'Back', suffix: 'm', tooltip: 'How far back, towards the body.' }) relaxedBack = 0.1;
  @Float({ label: 'Side', suffix: 'm', tooltip: 'How far to the right (negative: left).' }) relaxedSide = 0.14;
  @Float({ label: 'Tilt', suffix: '°', tooltip: 'How far the barrel is turned about the hand: negative points it down.' }) relaxedTilt = -6;
  @Float({ label: 'Turn', suffix: '°', tooltip: 'How far the barrel is turned to the left (negative: right), towards the middle of the view when the rifle is at the side.' }) relaxedTurn = 18;

  @Float({ header: 'Recoil', label: 'Kick Back', suffix: 'm', tooltip: 'How far a shot throws the rifle back, at the strongest.' }) kickBack = 0.045;
  @Float({ label: 'Kick Up', suffix: 'm' }) kickUp = 0.012;
  @Float({ label: 'Kick Tilt', suffix: '°', tooltip: 'How far a shot raises the barrel.' }) kickTilt = 3;

  @Float({ header: 'Reload', label: 'Dip', suffix: 'm', tooltip: 'How far the rifle goes down while the magazine is changed.' }) reloadDip = 0.02;
  @Float({ label: 'Tilt', suffix: '°', tooltip: 'How far the barrel is turned about the hand (negative: down).' }) reloadTilt = 10;
  @Float({ label: 'Roll', suffix: '°', tooltip: 'How far the rifle leans over on its side, so that the magazine well faces the player.' }) reloadRoll = 35;

  @Inject(Hud) hud!: Hud;

  /** The character is alert: it shot or reloaded within `Alert Seconds`. */
  @State() @JsonIgnore() @Saved() isAlert = false;
  /** Seconds of alert left. */
  @JsonIgnore() @Saved() alertLeft = 0;
  /** How far the rifle is from the alert pose (0) to the relaxed one (1). */
  @JsonIgnore() @Saved() relaxed = 1;

  // What is read once, when the game starts, and kept in a save: the authored local pose of the hold point (the grip of each weapon keeps its own, in its `Firearm`), and the look's own axes (forward, up, right: nine numbers) in the frame
  // the hold point hangs from, taken level whatever the camera's pitch.
  @JsonIgnore() @Saved() private authoredHold: number[] = [];
  @JsonIgnore() @Saved() private axes: number[] = [];

  @JsonIgnore() private weapon?: Weapon;
  @JsonIgnore() private loadout?: Loadout;
  @JsonIgnore() private body?: CharacterController;
  @JsonIgnore() private movement?: PlayerMovement;
  @JsonIgnore() private clock = 0;
  @JsonIgnore() private shotHoldUntil = 0;
  @JsonIgnore() private readonly position = new Vector3();
  @JsonIgnore() private readonly rotation = new Quaternion();
  @JsonIgnore() private readonly baseRotation = new Quaternion();
  @JsonIgnore() private readonly axis = new Vector3();

  onStart() {
    this.measure();
    this.bind();
    this.measureGrips();
    this.relaxed = 1;
    this.hud.setStance('relaxed');
  }

  onUpdate() {
    const deltaTime = Time.deltaTime;
    this.clock += deltaTime;
    this.updateAlert(deltaTime);
    this.follow(this.wantedRelaxed(), deltaTime);
    this.pose();
  }

  // A save brings the component back as it was, started: what `onStart()` set up on the weapon has to be set up again.
  onRestore() {
    this.bind();
    if (this.started && this.activeInHierarchy) this.hud.setStance(this.isAlert ? 'alert' : 'relaxed');
  }

  // Switched on again (a body brought back): the HUD holds what the last player told it.
  onEnable() {
    if (this.started) this.hud.setStance(this.isAlert ? 'alert' : 'relaxed');
  }

  //#region Public
  /** The character is alert from now, for `Alert Seconds`. */
  raise(): void {
    this.alertLeft = this.alertSeconds;
    if (this.isAlert) return;
    this.isAlert = true;
    this.hud.setStance('alert');
  }
  //#endregion Public

  //#region Stance
  private updateAlert(deltaTime: number) {
    if (!this.isAlert) return;
    // Alert is how a weapon in the hands is kept: with the hands free, or another kind of gear in them, there is nothing to keep up, and the character is relaxed at once, not after `Alert Seconds`.
    if (!this.loadout?.isHolding || !this.weapon?.current) {
      this.endAlert();
      return;
    }
    // A reload, or aiming, keeps the character alert the whole time it lasts: the clock of `Alert Seconds` starts when it ends.
    if (this.weapon?.isReloading || this.weapon?.isAiming) this.alertLeft = this.alertSeconds;
    this.alertLeft -= deltaTime;
    if (this.alertLeft > 0) return;
    this.endAlert();
  }

  private endAlert() {
    this.alertLeft = 0;
    this.isAlert = false;
    this.hud.setStance('relaxed');
  }

  // 0 for the alert pose, 1 for the relaxed one. Running lowers an alert rifle too, but not in the moment after a shot.
  private wantedRelaxed(): number {
    if (!this.isAlert) return 1;
    return this.isSprinting() && this.clock >= this.shotHoldUntil ? 1 : 0;
  }

  private isSprinting(): boolean {
    return this.lowerWhenRunning && this.weapon?.isSprinting === true;
  }

  private follow(wanted: number, deltaTime: number) {
    const time = wanted > this.relaxed ? this.lowerTime : this.raiseTime;
    this.relaxed += (wanted - this.relaxed) * (time > 0 ? 1 - Math.exp(-deltaTime / time) : 1);
  }
  //#endregion Stance

  //#region Pose
  // The authored pose plus an offset along the look's forward, up and right, and turns about its right and forward: a positive angle about the right raises the barrel, as it raises the view.
  private pose() {
    const weapon = this.weapon;
    const recoil = weapon?.recoil ?? 0;
    const reload = weapon?.isReloading ? this.reloadEnvelope(weapon.reloadProgress) : 0;
    const gun = weapon?.current;
    const aim = weapon?.aim ?? 0;

    const down = this.relaxedLower * this.relaxed + this.reloadDip * reload - this.kickUp * recoil + (gun?.aimLower ?? 0) * aim;
    const back = this.relaxedBack * this.relaxed + this.kickBack * recoil + (gun?.aimBack ?? 0) * aim;
    const side = this.relaxedSide * this.relaxed + (gun?.aimSide ?? 0) * aim;
    const tilt = this.relaxedTilt * this.relaxed + this.reloadTilt * reload + this.kickTilt * recoil + (gun?.aimTilt ?? 0) * aim;
    const turn = this.relaxedTurn * this.relaxed;
    const roll = this.reloadRoll * reload;

    const [px, py, pz] = this.authoredHold;
    const [fx, fy, fz, ux, uy, uz, rx, ry, rz] = this.axes;
    this.position.set(px - fx * back - ux * down + rx * side, py - fy * back - uy * down + ry * side, pz - fz * back - uz * down + rz * side);

    // The turns are made in the frame the point hangs from, after the authored rotation: tilt about the right, turn about the up, roll about the forward.
    const scratch = WeaponStance.scratch;
    Quaternion.fromAxisAngle(scratch, this.axis.set(rx, ry, rz), tilt);
    Quaternion.multiply(this.rotation, scratch, this.baseRotation);
    Quaternion.fromAxisAngle(scratch, this.axis.set(ux, uy, uz), turn);
    Quaternion.multiply(this.rotation, scratch, this.rotation);
    Quaternion.fromAxisAngle(scratch, this.axis.set(fx, fy, fz), roll);
    Quaternion.multiply(this.rotation, scratch, this.rotation);

    const transform = this.hold.transform;
    transform.setLocalSilently(this.position, this.rotation);
    transform.updateTransform();
    this.poseLeftHand(gun, weapon?.isReloading ? weapon.reloadProgress : 0);
  }

  private poseLeftHand(gun: Firearm | undefined, progress: number) {
    if (!gun?.gripLeft || gun.authoredGrip.length === 0) return;
    const [down, back] = WeaponStance.leftHandAt(progress);
    const [x, y, z] = gun.authoredGrip;
    const transform = gun.gripLeft.transform;
    transform.setLocalSilently(this.position.set(x, y - down, z + back));
    transform.updateTransform();
  }

  // 0 to 1 and back: the rifle dips as the reload starts, stays down while the magazine is changed, and comes back up at the end.
  private reloadEnvelope(progress: number): number {
    const ease = WeaponStance.RELOAD_EASE;
    const t = Math.min(progress / ease, (1 - progress) / ease, 1);
    return t * t * (3 - 2 * t);
  }

  private static leftHandAt(progress: number): [number, number] {
    const path = WeaponStance.LEFT_HAND_PATH;
    let index = 1;
    while (index < path.length - 1 && progress > path[index][0]) index++;
    const [t0, down0, back0] = path[index - 1], [t1, down1, back1] = path[index];
    const t = Math.min(1, Math.max(0, (progress - t0) / (t1 - t0)));
    const eased = t * t * (3 - 2 * t);
    return [down0 + (down1 - down0) * eased, back0 + (back1 - back0) * eased];
  }
  //#endregion Pose

  // The authored poses and the axes, taken once: the pose is written from them every frame, so nothing is ever added to what an earlier frame wrote.
  private measure() {
    const position = this.hold.transform.position, rotation = this.hold.transform.rotationQ;
    this.authoredHold = [position.x, position.y, position.z, rotation.x, rotation.y, rotation.z, rotation.w];
    const look = this.eyes.transform.forward;
    const level = new Vector3(look.x, 0, look.z).normalized;
    const worldUp = new Vector3(0, 1, 0);
    const side = new Vector3();
    Vector3.cross(side, level, worldUp);
    const parent = this.hold.parent?.transform;
    const local = (direction: Vector3) => [...(parent ? parent.inverseTransformDirection(direction) : direction).normalized];
    this.axes = [...local(level), ...local(worldUp), ...local(side)];
  }

  // The grip of each weapon, once: what a save brings back is never read again from a pose this wrote.
  private measureGrips() {
    this.weapon?.firearms.forEach(gun => { if (gun.authoredGrip.length === 0 && gun.gripLeft) gun.authoredGrip = [...gun.gripLeft.transform.position]; });
  }

  private loadRotation([x, y, z, w]: number[]) {
    const rotation = this.baseRotation;
    rotation.x = x; rotation.y = y; rotation.z = z; rotation.w = w;
  }

  private bind() {
    this.weapon = this.entity.getComponent(Weapon);
    this.loadout = this.entity.getComponent(Loadout);
    this.body = this.entity.getComponent(CharacterController);
    this.movement = this.entity.getComponent(PlayerMovement);
    this.loadRotation(this.authoredHold.slice(3));
    this.weapon?.onFire.on(() => this.onShot(), this);
    this.weapon?.onReloadStart.on(() => this.raise(), this);
    this.weapon?.onAimStart.on(() => this.raise(), this);
  }

  private onShot() {
    this.shotHoldUntil = this.clock + WeaponStance.SHOT_HOLD_SECONDS;
    this.raise();
  }
}
