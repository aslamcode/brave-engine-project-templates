import { Bool, CharacterController, Entity, Float, JsonIgnore, PhysicsSystem, Ref, Script, ScriptComponent, Select, Vector3 } from '@brave/core';
import { playSound } from '../shared/sound';
import { FootstepSurface } from './footstep-surface';

/**
 * The sound of a character's steps: when a foot comes down one of the step sounds plays, louder the faster the body goes and softer crouched, and `Land Sound` plays when the body lands from a fall.
 * A foot comes down at the point where it gets farthest ahead of the body along the way the body goes (a heel strike): it swings forward, reaches that point, and from there goes back with the ground.
 * That is read from the bones frame by frame, so it is the same for a walk, a run, a crouched walk and a sidestep, and no clip needs a mark in it; it is silent when the body stands (a foot that moves to
 * turn on the spot) or is in the air. It is on the player and on the humanoid enemy: for the player the sounds are not spatial, for the enemy they are, so that its steps come from where it is.
 *
 * (A first version took a foot as down when its ankle fell below a height. The ankle is still 3 cm above its resting height at the heel strike and falls through any such height in the middle of the swing:
 * measured, the sound came about 160 ms before the foot, and the more so the slower the walk.)
 *
 * With `By Surface` on it steps by the ground: one ray down from the character at each step finds the collider under it, and the `Footstep Surface` of the scene that has that collider's physics material gives
 * the sounds (walk or run, by the speed). A ground with no surface of its own is stepped on with `Step Sound`, which stays the default of everything else.
 *
 * `Step Sound` is an entity with an Audio Source for each variation as children, or one Audio Source; they play in the ORDER the children are in (drag them in the Hierarchy to change it) and start again, or at
 * random without ever repeating the one before (`Step Order`): a sound that plays twice in a row, which a plain random choice does now and then, is what makes a walk sound like a machine; each has Pooling on so that two steps may overlap. The script sets the gain of the
 * one it plays: `Volume` is the loudest, the Audio Source's own gain is not used. Read from the entity's origin, so on stairs a foot that lands higher than `Contact Height` is not heard: raise it for a level with steps.
 */
@Script()
export class Footsteps extends ScriptComponent {

  @Ref(Entity, { header: 'Feet', label: 'Left Foot', tooltip: 'The bone of the left foot (the ankle).' }) leftFoot?: Entity;
  @Ref(Entity, { label: 'Right Foot', tooltip: 'The bone of the right foot (the ankle).' }) rightFoot?: Entity;

  @Ref(Entity, { header: 'Sounds', label: 'Step Sound', tooltip: 'An entity with an Audio Source for each variation as children (one plays at each step), or one Audio Source.' }) stepSound?: Entity;
  @Ref(Entity, { label: 'Land Sound', tooltip: 'The same, for the body landing from a fall.' }) landSound?: Entity;
  @Select({ label: 'Step Order', optionsKey: 'orderOptions', sort: false, tooltip: 'Sequence: the variations play in the order of the Hierarchy, one after the other, and start again (put the ones that sound good together next to each other). Random: any but the one that just played. Each surface has its own place in its sequence.' }) order: 'sequence' | 'random' = 'sequence';
  @Bool({ label: 'By Surface', tooltip: 'The step sounds are those of the Footstep Surface that has the physics material of the ground under the foot, found in the scene; a ground with none plays Step Sound. Off for a character that is heard from far away (an enemy keeps its own spatial sounds).' }) bySurface = false;

  @Float({ header: 'Detection', label: 'Contact Height', suffix: 'm', tooltip: 'A foot that gets to its farthest point ahead of the body counts as down only when its bone is this low or lower above the entity\'s origin (the ankle is about 0.17 m up on level ground, and about 0.18 at a heel strike): a foot swung high past the body is not a step. On stairs raise it.' }) contactHeight = 0.24;
  @Float({ label: 'Min Speed', suffix: 'm/s', tooltip: 'The slowest the body goes for a step to be heard: a foot that moves while the body stands (turning on the spot) is silent.' }) minSpeed = 0.4;

  @Float({ header: 'Volume', label: 'Volume', tooltip: 'The gain of the loudest step (at Run Speed).' }) volume = 0.8;
  @Float({ label: 'Run Speed', suffix: 'm/s', tooltip: 'The speed at which a step is at full Volume. Below it a step is softer, down to Walk Share of it.' }) runSpeed = 4;
  @Float({ label: 'Walk Share', tooltip: 'What share of Volume a step has at a crawl (the speed just over Min Speed): from there to Run Speed it rises.' }) walkShare = 0.45;
  @Float({ label: 'Crouch Share', tooltip: 'What share a crouched step keeps.' }) crouchShare = 0.5;
  @Float({ label: 'Land Volume', tooltip: 'The gain of a landing at 6 m/s or more; a gentler one is softer, and one under 1.5 m/s is silent.' }) landVolume = 1;

  @JsonIgnore() protected orderOptions = [{ value: 'sequence', description: 'Sequence' }, { value: 'random', description: 'Random' }];

  @JsonIgnore() private body?: CharacterController;
  // Which variation of a holder played last, by holder: the next step plays the one after it (or another, at random).
  @JsonIgnore() private surfaces?: Map<string, FootstepSurface>;
  @JsonIgnore() private landListener?: { off(): void };
  @JsonIgnore() private leftStride: IFootStride = { known: false, swinging: false, mark: 0 };
  @JsonIgnore() private rightStride: IFootStride = { known: false, swinging: false, mark: 0 };

  onStart() {
    this.body = this.entity.getComponent(CharacterController);
    this.landListener = this.body?.onLand.on(speed => this.land(speed), this);
  }

  onUpdate() {
    if (!this.leftFoot || !this.rightFoot) return;
    const direction = this.travelDirection();
    if (!direction) {
      // Standing, turning on the spot or in the air: no foot is followed, and each starts again from where it is when the body goes on.
      this.leftStride.known = this.rightStride.known = false;
      return;
    }
    this.follow(this.leftFoot, this.leftStride, direction);
    this.follow(this.rightFoot, this.rightStride, direction);
  }

  onDestroy() {
    this.landListener?.off();
    this.landListener = undefined;
  }

  // The copy holds the original's subscription and body: it makes its own when it starts, and must never take the original's off.
  onAfterClone() {
    this.landListener = undefined;
    this.body = undefined;
    this.surfaces = undefined;
    this.leftStride = { known: false, swinging: false, mark: 0 };
    this.rightStride = { known: false, swinging: false, mark: 0 };
  }

  // The way the body goes on the ground, a unit vector; nothing while it stands, turns on the spot or is in the air (its feet move then, and no step is heard).
  private travelDirection(): { x: number; z: number } | undefined {
    const body = this.body;
    if (!body || !body.active || !body.isGrounded) return undefined;
    const velocity = body.actualVelocity;
    const speed = Math.hypot(velocity.x, velocity.z);
    return speed < this.minSpeed ? undefined : { x: velocity.x / speed, z: velocity.z / speed };
  }

  // A foot swings ahead of the body, and the step sounds in the frame after it has got farthest ahead of it (along `direction`) and begun to go back with the ground. The marks keep the swing and the stance
  // apart without noise: a swing begins when the foot is 4 cm ahead of the farthest it went back, and ends when it is 2 mm behind the farthest it went forward (the bones are read before the animation of the frame, so a step is heard two frames, 33 ms, after the foot lands).
  private follow(foot: Entity, stride: IFootStride, direction: { x: number; z: number }): void {
    const origin = this.entity.transform.worldMatrix, bone = foot.transform.worldMatrix;
    const extent = (bone[12] - origin[12]) * direction.x + (bone[14] - origin[14]) * direction.z;
    if (!stride.known) {
      stride.known = true;
      stride.swinging = false;
      stride.mark = extent;
      return;
    }

    if (!stride.swinging) {
      stride.mark = Math.min(stride.mark, extent);
      if (extent > stride.mark + SWING_BEGINS) {
        stride.swinging = true;
        stride.mark = extent;
      }
      return;
    }

    stride.mark = Math.max(stride.mark, extent);
    if (extent >= stride.mark - STEP_LANDS) return;
    stride.swinging = false;
    stride.mark = extent;
    if (bone[13] - origin[13] <= this.contactHeight) this.step();
  }

  private step() {
    const body = this.body;
    // A body that is not driving the character (a ragdoll took it) says nothing: its last speed and its last ground are old, and its feet move because it falls.
    if (!body || !body.active || !body.isGrounded) return;
    const velocity = body.actualVelocity;
    const speed = Math.hypot(velocity.x, velocity.z);
    if (speed < this.minSpeed) return;

    const share = this.walkShare + (1 - this.walkShare) * Math.min(speed / Math.max(this.runSpeed, 0.1), 1);
    this.play(this.soundsOf(speed), this.volume * share * (body.isCrouched ? this.crouchShare : 1));
  }

  // The sounds of this step: the surface of the ground under the foot when it goes by surface and there is one, else the character's own.
  private soundsOf(speed: number): Entity | undefined {
    if (!this.bySurface) return this.stepSound;
    const material = this.groundMaterial();
    const surface = material ? this.surfacesOfScene().get(material) : undefined;
    return surface?.soundsFor(speed >= this.runSpeed * 0.75) ?? this.stepSound;
  }

  // The physics material of the collider one ray finds below the character (not its own: the ray starts a little above the origin and goes through the character's colliders).
  private groundMaterial(): string | null | undefined {
    const origin = this.entity.transform.globalPosition.clone();
    origin.y += 0.3;
    return PhysicsSystem.raycast(origin, new Vector3(0, -1, 0), 1.2, { ignore: this.entity })?.collider.physicsMaterialId;
  }

  // Every surface of the scene by physics material, found once (the first step that asks): the scene's own, the copy's in the editor's Play.
  private surfacesOfScene(): Map<string, FootstepSurface> {
    if (this.surfaces) return this.surfaces;
    const found = new Map<string, FootstepSurface>();
    const walk = (entity: Entity) => {
      const surface = entity.getComponent(FootstepSurface);
      if (surface?.materialId && !found.has(surface.materialId)) found.set(surface.materialId, surface);
      entity.children.forEach(walk);
    };
    this.entity.scene?.children.forEach(walk);
    return this.surfaces = found;
  }

  private land(speed: number) {
    if (speed < 1.5) return;
    this.play(this.landSound, this.landVolume * Math.min(speed / 6, 1));
  }

  // One of the Audio Sources of the entity (or its own), at the gain asked.
  private play(holder: Entity | undefined, gain: number) {
    playSound(holder, { gain, order: this.order });
  }
}

/** Where a foot is in its stride: whether it is being followed, whether it swings ahead (or is in stance), and the farthest it went back (stance) or forward (swing), along the way the body goes. */
interface IFootStride {
  known: boolean;
  swinging: boolean;
  mark: number;
}

const SWING_BEGINS = 0.04;
const STEP_LANDS = 0.002;

