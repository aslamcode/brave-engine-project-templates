import { AnimationConstraint, Entity, Float, IEntity, JsonIgnore, PhysicsSystem, PoseGuard, Quaternion, Ref, Script, Vector3, setWorldPosition, setWorldRotation, worldRotation } from '@brave/core';

/**
 * Keeps the weapon out of a wall. A ball goes from the eyes along the look, as far as the weapon reaches; when the level is nearer than that, the point the right hand reaches for (`Hold`) is pulled
 * towards the body, lowered and tilted about the hand, by exactly as much as it takes for the end of the barrel to stop `Margin` short of the wall (up to `Max Tilt`: from there on the weapon is as far
 * back as it goes). So the barrel follows the wall as it comes near, and no more of the weapon moves than has to. It is a constraint, so it works on the frame's pose: after the spine has leaned with the
 * look and the eyes have been put on the head, and before the hands reach for their points (give it an `Order` between the two). The hands follow it, and the weapon, which is the right hand's child, and the
 * left hand, which reaches for the weapon.
 *
 * It does not know how many cameras draw the character. With the arms drawn by their own camera (which clears the depth) the weapon never goes through a wall on the screen, and this is how it looks:
 * a weapon that gives way says "there is no room here". With ONE camera it is what keeps the weapon out of the wall. Untick the component and the weapon stays where the hands put it.
 *
 * The level is the fixed colliders (`PhysicsSystem.probeLevel`): a character, a crate or a sensor does not take the weapon back.
 */
@Script({ inheritProperties: true })
export class WeaponRetreat extends AnimationConstraint {

  @Ref(Entity, { header: 'Weapon', label: 'Hold' }) hold?: IEntity;
  @Ref(Entity, { label: 'Eyes' }) eyes?: IEntity;
  @Float({ label: 'Weapon Length', suffix: 'm', tooltip: 'How far the weapon reaches in front of the eyes, to the end of the barrel, when nothing is in the way.' }) weaponLength = 0.9;
  @Float({ label: 'Margin', suffix: 'm', tooltip: 'How much room to leave between the end of the barrel and the wall.' }) margin = 0.05;
  @Float({ label: 'Probe Radius', suffix: 'm', tooltip: 'The width of the ray: a wall that the weapon would touch at its side is seen too.' }) radius = 0.08;

  @Float({ header: 'Retreat', label: 'Max Tilt', suffix: '°', tooltip: 'How far the weapon turns about the hand when it is all the way back: negative lowers the barrel, positive raises it. Up to 90.' }) maxTilt = -75;
  @Float({ label: 'Pull Back', suffix: 'm', tooltip: 'How far towards the body the hand goes, all the way back. The arms can only give so much.' }) pullBack = 0.2;
  @Float({ label: 'Lower', suffix: 'm', tooltip: 'How far down the hand goes, all the way back.' }) lower = 0.05;

  @Float({ header: 'Motion', label: 'In Time', suffix: 's', tooltip: 'How long the weapon takes to go back when a wall comes near. Short: it must not be in the wall for a moment.' }) inTime = 0.06;
  @Float({ label: 'Out Time', suffix: 's', tooltip: 'How long it takes to come forward again when the wall is gone.' }) outTime = 0.3;

  /** 0: the weapon is where the hands put it. 1: all the way back. */
  @JsonIgnore() retreat = 0;

  @JsonIgnore() private readonly place = new Float32Array(3);
  @JsonIgnore() private readonly axis = new Vector3();
  @JsonIgnore() private readonly held = new Quaternion();
  @JsonIgnore() private readonly turn = new Quaternion();

  protected bind(): boolean {
    this.retreat = 0;

    if (!this.hold || !this.eyes) {
      console.warn(`[Weapon Retreat] "${this.entity.name}": Hold and Eyes are needed; it does nothing until they are set.`);
      return false;
    }

    this.guard = new PoseGuard([this.hold.transform], [this.hold.transform]);
    return true;
  }

  protected apply(deltaTime: number, weight: number): void {
    const transform = (this.hold as IEntity).transform;
    const eyes = (this.eyes as IEntity).transform.worldMatrix;
    const matrix = transform.worldMatrix;

    // The look: the eyes' -Z, from the eyes.
    const forwardLength = Math.hypot(eyes[8], eyes[9], eyes[10]) || 1;
    const forwardX = -eyes[8] / forwardLength, forwardY = -eyes[9] / forwardLength, forwardZ = -eyes[10] / forwardLength;

    // How far in front of the eyes the hand is where the animation leaves it, and so how much of the weapon is in front of the hand.
    const handAhead = (matrix[12] - eyes[12]) * forwardX + (matrix[13] - eyes[13]) * forwardY + (matrix[14] - eyes[14]) * forwardZ;
    this.follow(this.wanted(eyes[12], eyes[13], eyes[14], forwardX, forwardY, forwardZ, handAhead), deltaTime);

    const amount = this.retreat * weight;
    if (!(amount > 1e-4)) return;

    // Back along the look and down along the eyes' own vertical; the tilt about the eyes' right, so that a positive angle raises the barrel as it raises the view.
    const upLength = Math.hypot(eyes[4], eyes[5], eyes[6]) || 1;
    this.place[0] = matrix[12] - forwardX * this.pullBack * amount - (eyes[4] / upLength) * this.lower * amount;
    this.place[1] = matrix[13] - forwardY * this.pullBack * amount - (eyes[5] / upLength) * this.lower * amount;
    this.place[2] = matrix[14] - forwardZ * this.pullBack * amount - (eyes[6] / upLength) * this.lower * amount;

    this.axis.x = eyes[0]; this.axis.y = eyes[1]; this.axis.z = eyes[2];
    worldRotation(transform, this.held as any);
    Quaternion.fromAxisAngle(this.turn, this.axis, this.limit() * amount);
    Quaternion.multiply(this.held, this.turn, this.held);

    setWorldPosition(transform, this.place);
    setWorldRotation(transform, this.held as any);
    transform.updateTransform();
  }

  // The weapon gives its place back when the constraint is switched off: the guard puts the point where the animation had it.
  onDisable() {
    this.guard?.release();
    super.onDisable();
  }

  // How far back the weapon should be, 0 to 1 (1 is `Max Tilt` and the whole pull back): the least that brings the end of the barrel `Margin` short of the wall.
  private wanted(originX: number, originY: number, originZ: number, directionX: number, directionY: number, directionZ: number, handAhead: number): number {
    const radius = Math.max(this.radius, 0);
    const hit = PhysicsSystem.probeLevel(originX, originY, originZ, directionX, directionY, directionZ, radius, this.weaponLength + this.margin);
    if (hit === undefined) return 0;

    // The ball stops its radius short of the wall: the wall itself is that much further.
    const room = hit + radius - this.margin;
    if (room >= this.weaponLength) return 0;

    // The weapon turns about the hand, which comes back as it turns: the end of the barrel is at (hand - pull back * u) + (the weapon in front of the hand) * cos(tilt * u), which only gets shorter as u goes to 1.
    const inFront = Math.max(this.weaponLength - handAhead, 0.05);
    const tilt = this.limit() * Math.PI / 180;
    const reach = (u: number) => handAhead - this.pullBack * u + inFront * Math.cos(tilt * u);
    if (reach(1) >= room) return 1;

    let low = 0, high = 1;
    for (let i = 0; i < 12; i++) {
      const middle = (low + high) / 2;
      if (reach(middle) > room) low = middle;
      else high = middle;
    }
    return high;
  }

  // Past a right angle the barrel would swing back out in front of the hand.
  private limit(): number {
    return Math.min(Math.max(this.maxTilt, -90), 90);
  }

  // It goes back fast and comes forward slowly, so that it is never in the wall for long and never twitches when the wall is at the edge of its reach.
  private follow(wanted: number, deltaTime: number) {
    const time = wanted > this.retreat ? this.inTime : this.outTime;
    this.retreat += (wanted - this.retreat) * (time > 0 ? 1 - Math.exp(-deltaTime / time) : 1);
  }
}
