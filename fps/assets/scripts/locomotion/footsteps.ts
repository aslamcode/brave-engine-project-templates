import { Bool, CharacterController, Entity, Float, IRaycastHit, JsonIgnore, PhysicsSystem, PrefabAssetMarker, Ref, Script, ScriptComponent, Select, SpawnSystem, String, SurfaceRegistry, surfaceOfHit, Time, Vector3 } from '@brave/core';
import { parseStepPattern, playSound } from '../shared/sound';
import { FootstepSurface } from './footstep-surface';

/**
 * The sound of a character's steps: when a foot comes down one of the step sounds plays, louder the faster the body goes and softer crouched, and `Land Sound` plays when the body lands from a fall.
 * A foot comes down at the point where it gets farthest ahead of the body along the way the body goes (a heel strike): it swings forward, reaches that point, and from there goes back with the ground.
 * That is read from the bones frame by frame, so it is the same for a walk, a run, a crouched walk and a sidestep, and no clip needs a mark in it; it is silent when the body stands (a foot that moves to
 * turn on the spot) or is in the air. It is on the player and on the humanoid enemy: for the player the sounds are not spatial, for the enemy they are, so that its steps come from where it is.
 *
 * Walking BACKWARDS the clips play in reverse and a foot lands on its toes, with the heel up, so its ankle is higher when it touches the ground (measured on Bravo, as the detector reads it, the pose of the frame before: 0.24 to 0.29 m walking and 0.33 to 0.38 running, where
 * going forward it is 0.19 to 0.22): the height a foot may be at and still count as down goes from `Contact Height` to `Backward Contact Height` as the body goes from forward (or sideways) to straight back.
 *
 * (A first version took a foot as down when its ankle fell below a height. The ankle is still 3 cm above its resting height at the heel strike and falls through any such height in the middle of the swing:
 * measured, the sound came about 160 ms before the foot, and the more so the slower the walk.)
 *
 * With `By Surface` on it steps by the ground: one ray down from the character at each step finds what is under it, and the `Footstep Surface` of the scene that matches gives the sounds (walk or run, by the
 * speed). What matches, from the most specific: the physics material of the collider (an override somebody put there on purpose: a metal grating over a floor drawn as concrete), then the surface of the MATERIAL
 * that paints the spot the ray hit (a surface of the project; on a mesh with several materials the one of the part the foot is on, so a floor of concrete, metal and wood steps differently on each). A ground
 * with no surface of its own is stepped on as the `Default Surface` (Tile for the kit's players), and `Step Sound` is what is left when there is no bank at all. The surfaces are found in the scene; a scene that
 * has none gets the `Surface Bank` prefab made into it when this character starts, so any scene has the steps by surface with nothing placed in it.
 *
 * `Step Sound` is an entity with an Audio Source for each variation as children, or one Audio Source. `Step Order` says which plays at each step: **Pattern** (the default), the variations in the order of `Step Pattern`
 * (`1 2 3 4 3 4 2 3`: each number is the place of a variation among the children, so four recordings make a walk of eight steps that repeats a sound now and then and never twice in a row, and sounds like a person and not
 * like a machine); the counter is the character's own, one for both feet and for walking and running, and it starts again from the first place when the ground changes; **Sequence**, the order of the children (drag them
 * in the Hierarchy to change it), starting again; or **Random**, which never repeats the one before. A sound that plays twice in a row, which a plain random choice does now and then, is what makes a walk sound like a machine; each has Pooling on so that two steps may overlap. The script sets the gain of the
 * one it plays: `Volume` is the loudest, the Audio Source's own gain is not used. Read from the entity's origin, so on stairs a foot that lands higher than `Contact Height` is not heard: raise it for a level with steps.
 */
@Script()
export class Footsteps extends ScriptComponent {

  @Ref(Entity, { header: 'Feet', label: 'Left Foot', tooltip: 'The bone of the left foot (the ankle).' }) leftFoot?: Entity;
  @Ref(Entity, { label: 'Right Foot', tooltip: 'The bone of the right foot (the ankle).' }) rightFoot?: Entity;

  @Ref(Entity, { header: 'Sounds', label: 'Step Sound', tooltip: 'An entity with an Audio Source for each variation as children (one plays at each step), or one Audio Source.' }) stepSound?: Entity;
  @Ref(Entity, { label: 'Land Sound', tooltip: 'The same, for the body landing from a fall.' }) landSound?: Entity;
  @Select({ label: 'Step Order', optionsKey: 'orderOptions', sort: false, tooltip: 'Pattern: the variations play in the order of Step Pattern, one counter for both feet and for walking and running, starting again from the first when the ground changes. Sequence: the order of the Hierarchy, one after the other, and start again (each surface has its own place in its sequence). Random: any but the one that just played.' }) order: 'pattern' | 'sequence' | 'random' = 'pattern';
  @String({ label: 'Step Pattern', tooltip: 'The places of the variations, in the order they play, counted from 1 along the children of the sounds of a surface: 1 2 3 4 3 4 2 3 makes a walk of eight steps out of four recordings. A number past the last variation goes round to the first. Used when Step Order is Pattern; empty plays the Sequence.' }) pattern = '1 2 3 4 3 4 2 3';
  @Ref(PrefabAssetMarker, { label: 'Surface Bank', picker: true, tooltip: 'The prefab that holds the sounds of every surface (a Footstep Surface for each). When the scene has no Footstep Surface, one is made from this prefab as this character starts, so any scene has the steps by surface with nothing placed in it. Empty: the scene must have its own.' }) surfaceBank = '';
  @Select({ label: 'Default Surface', optionsKey: 'surfaceOptions', tooltip: 'The surface whose sounds a ground with no surface of its own is stepped on with (a collider with no physics material over a material that is no surface). None: Step Sound plays.' }) defaultSurface: string | null = null;
  @Bool({ label: 'By Surface', tooltip: 'The step sounds are those of the Footstep Surface that matches the ground under the foot, found in the scene: the one that has the physics material of the collider, else the one that has the surface of the material the foot is on, else the Default Surface. With none of them, Step Sound plays. Off for a character that is heard from far away (an enemy keeps its own spatial sounds).' }) bySurface = false;

  @Float({ header: 'Detection', label: 'Contact Height', suffix: 'm', tooltip: 'A foot that gets to its farthest point ahead of the body counts as down only when its bone is this low or lower above the entity\'s origin (the ankle is about 0.17 m up on level ground, and about 0.18 at a heel strike): a foot swung high past the body is not a step. On stairs raise it.' }) contactHeight = 0.24;
  @Float({ label: 'Backward Contact Height', suffix: 'm', tooltip: 'The same, walking backwards: the clips play in reverse and a foot lands on its toes, heel up, so the ankle is higher when it touches (0.24 to 0.29 m walking and up to 0.38 running, on Bravo). The limit goes from Contact Height to this one as the body goes from forward or sideways to straight back.' }) backwardContactHeight = 0.4;
  @Float({ label: 'Min Speed', suffix: 'm/s', tooltip: 'The slowest the body goes for a step to be heard: a foot that moves while the body stands (turning on the spot) is silent.' }) minSpeed = 0.4;

  @Float({ header: 'Volume', label: 'Volume', tooltip: 'The gain of the loudest step (at Run Speed).' }) volume = 0.8;
  @Float({ label: 'Run Speed', suffix: 'm/s', tooltip: 'The speed at which a step is at full Volume. Below it a step is softer, down to Walk Share of it.' }) runSpeed = 4;
  @Float({ label: 'Walk Share', tooltip: 'What share of Volume a step has at a crawl (the speed just over Min Speed): from there to Run Speed it rises.' }) walkShare = 0.45;
  @Float({ label: 'Crouch Share', tooltip: 'What share a crouched step keeps.' }) crouchShare = 0.5;
  @Float({ label: 'Land Volume', tooltip: 'The gain of a landing at 6 m/s or more; a gentler one is softer, and one under 1.5 m/s is silent.' }) landVolume = 1;

  @JsonIgnore() protected orderOptions = [{ value: 'pattern', description: 'Pattern' }, { value: 'sequence', description: 'Sequence' }, { value: 'random', description: 'Random' }];

  @JsonIgnore()
  protected get surfaceOptions() {
    return SurfaceRegistry.options;
  }

  @JsonIgnore() private body?: CharacterController;
  // The scene's Footstep Surfaces, found once (the first step that asks), by the physics material and by the surface they are for.
  @JsonIgnore() private bank?: ISurfaceBank;
  @JsonIgnore() private landListener?: { off(): void };
  @JsonIgnore() private leftStride: IFootStride = { known: false, swinging: false, mark: 0 };
  @JsonIgnore() private rightStride: IFootStride = { known: false, swinging: false, mark: 0 };
  // The pattern of steps: where the character is in it, which ground the last step was on (the pattern starts again when it changes) and the places `Step Pattern` names, read again when its text changes.
  @JsonIgnore() private patternPosition = 0;
  @JsonIgnore() private groundOfLastStep?: FootstepSurface;
  @JsonIgnore() private places = { text: '', values: [] as number[] };
  // How far back the body has been going for a moment (0 forward or sideways, 1 straight back), smoothed so that one frame in which the velocity flips does not raise the height a foot may be at.
  @JsonIgnore() private backwardness = 0;

  onStart() {
    this.body = this.entity.getComponent(CharacterController);
    this.landListener = this.body?.onLand.on(speed => this.land(speed), this);
    this.bank = undefined;
    this.ensureBank();
  }

  // A load builds the component as it was, started: the body and the listener of its landings are not there.
  onRestore() {
    if (!this.started) return;
    this.landListener?.off();
    this.onStart();
  }

  onUpdate() {
    if (!this.leftFoot || !this.rightFoot) return;
    const direction = this.travelDirection();
    if (!direction) {
      // Standing, turning on the spot or in the air: no foot is followed, and each starts again from where it is when the body goes on.
      this.leftStride.known = this.rightStride.known = false;
      this.backwardness = 0;
      return;
    }
    const limit = this.contactLimit(direction);
    this.follow(this.leftFoot, this.leftStride, direction, limit);
    this.follow(this.rightFoot, this.rightStride, direction, limit);
  }

  onDestroy() {
    this.landListener?.off();
    this.landListener = undefined;
  }

  // The copy holds the original's subscription and body: it makes its own when it starts, and must never take the original's off.
  onAfterClone() {
    this.landListener = undefined;
    this.body = undefined;
    this.bank = undefined;
    this.leftStride = { known: false, swinging: false, mark: 0 };
    this.rightStride = { known: false, swinging: false, mark: 0 };
    this.patternPosition = 0;
    this.groundOfLastStep = undefined;
    this.backwardness = 0;
  }

  // The way the body goes on the ground, a unit vector; nothing while it stands, turns on the spot or is in the air (its feet move then, and no step is heard).
  private travelDirection(): { x: number; z: number } | undefined {
    const body = this.body;
    if (!body || !body.active || !body.isGrounded) return undefined;
    const velocity = body.actualVelocity;
    const speed = Math.hypot(velocity.x, velocity.z);
    return speed < this.minSpeed ? undefined : { x: velocity.x / speed, z: velocity.z / speed };
  }

  // How high a foot may be and still be down: `Contact Height` going forward or sideways, `Backward Contact Height` going straight back (the way the body goes against the way it faces, the clips playing in reverse), and in between
  // for a diagonal, so there is no edge where the limit jumps. How far back the body goes is smoothed over BACKWARD_SMOOTHING seconds: a frame in which the velocity flips (a push, a corner) is not walking backwards.
  private contactLimit(direction: { x: number; z: number }): number {
    // The front of a character is its local +Z (the way its model faces and its feet point), which this engine calls `back`: `forward` is the local -Z, the way a camera looks.
    const front = this.entity.transform.back;
    const length = Math.hypot(front.x, front.z);
    if (length < 1e-6) return this.contactHeight;

    const backwards = Math.min(Math.max(-(direction.x * front.x + direction.z * front.z) / length, 0), 1);
    this.backwardness += (backwards - this.backwardness) * (1 - Math.exp(-Time.deltaTime / BACKWARD_SMOOTHING));
    return this.contactHeight + (this.backwardContactHeight - this.contactHeight) * this.backwardness;
  }

  // A foot swings ahead of the body, and the step sounds in the frame after it has got farthest ahead of it (along `direction`) and begun to go back with the ground. The marks keep the swing and the stance
  // apart without noise: a swing begins when the foot is 4 cm ahead of the farthest it went back, and ends when it is 2 mm behind the farthest it went forward (the bones are read before the animation of the frame, so a step is heard two frames, 33 ms, after the foot lands).
  private follow(foot: Entity, stride: IFootStride, direction: { x: number; z: number }, limit: number): void {
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
    if (bone[13] - origin[13] <= limit) this.step();
  }

  private step() {
    const body = this.body;
    // A body that is not driving the character (a ragdoll took it) says nothing: its last speed and its last ground are old, and its feet move because it falls.
    if (!body || !body.active || !body.isGrounded) return;
    const velocity = body.actualVelocity;
    const speed = Math.hypot(velocity.x, velocity.z);
    if (speed < this.minSpeed) return;

    const share = this.walkShare + (1 - this.walkShare) * Math.min(speed / Math.max(this.runSpeed, 0.1), 1);
    const { holder, ground } = this.soundsOf(speed);
    this.playStep(holder, ground, this.volume * share * (body.isCrouched ? this.crouchShare : 1));
  }

  // The sounds of this step: the surface of the ground under the foot when it goes by surface and there is one, else the character's own. The surface is told too: the pattern starts again when it changes.
  private soundsOf(speed: number): { holder?: Entity; ground?: FootstepSurface } {
    if (!this.bySurface) return { holder: this.stepSound };

    const ground = this.surfaceUnder(this.groundHit());
    return { holder: ground?.soundsFor(speed >= this.runSpeed * 0.75) ?? this.stepSound, ground };
  }

  // The places `Step Pattern` names, read again only when its text changes.
  private patternPlaces(): number[] {
    if (this.places.text !== this.pattern) this.places = { text: this.pattern, values: parseStepPattern(this.pattern) };
    return this.places.values;
  }

  // One step: by the pattern (one counter for the character, whatever the foot and whether it walks or runs, which starts again from the first place when the ground changes), else as `Step Order` says.
  private playStep(holder: Entity | undefined, ground: FootstepSurface | undefined, gain: number) {
    const places = this.order === 'pattern' ? this.patternPlaces() : [];
    if (!places.length) {
      this.play(holder, gain);
      return;
    }

    if (ground !== this.groundOfLastStep) {
      this.groundOfLastStep = ground;
      this.patternPosition = 0;
    }
    playSound(holder, { gain, variation: places[this.patternPosition % places.length] - 1 });
    this.patternPosition = (this.patternPosition + 1) % places.length;
  }

  // What the ground says it is, from the most specific: the physics material of the collider (an override somebody put there on purpose), then the surface of the material that paints the spot the ray hit, and,
  // when the ground says nothing, the Default Surface.
  private surfaceUnder(hit: IRaycastHit | undefined): FootstepSurface | undefined {
    const bank = this.bankOfScene();
    const physics = hit?.collider.physicsMaterialId;
    const byPhysics = physics ? bank.byPhysics.get(physics) : undefined;
    if (byPhysics) return byPhysics;

    const surface = surfaceOfHit(hit);
    const byMaterial = surface ? bank.bySurface.get(surface) : undefined;
    if (byMaterial) return byMaterial;

    return this.defaultSurface ? bank.bySurface.get(this.defaultSurface) : undefined;
  }

  // What one ray finds below the character (not its own colliders: the ray starts a little above the origin and goes through them).
  private groundHit(): IRaycastHit | undefined {
    const origin = this.entity.transform.globalPosition.clone();
    origin.y += 0.3;
    return PhysicsSystem.raycast(origin, new Vector3(0, -1, 0), 1.2, { ignore: this.entity });
  }

  // Every surface of the scene, found once (the first step that asks): the scene's own, the copy's in the editor's Play. The first surface that names a physics material (or a surface) keeps it.
  private bankOfScene(): ISurfaceBank {
    if (this.bank) return this.bank;

    const found: ISurfaceBank = { byPhysics: new Map(), bySurface: new Map() };
    const walk = (entity: Entity) => {
      const surface = entity.getComponent(FootstepSurface);
      if (surface?.materialId && !found.byPhysics.has(surface.materialId)) found.byPhysics.set(surface.materialId, surface);
      if (surface?.surface && !found.bySurface.has(surface.surface)) found.bySurface.set(surface.surface, surface);
      entity.children.forEach(walk);
    };
    this.entity.scene?.children.forEach(walk);
    return this.bank = found;
  }

  // A scene with no Footstep Surface gets the bank, one prefab for every scene: the sounds are changed in one place, and a scene that never heard of them still has the steps by surface. A scene that has
  // surfaces of its own (a game that wants other sounds for it) keeps them and is not given more.
  private ensureBank(): void {
    const scene = this.entity.scene;
    if (!this.bySurface || !this.surfaceBank || !scene) return;

    const bank = this.bankOfScene();
    if (bank.byPhysics.size > 0 || bank.bySurface.size > 0) return;

    SpawnSystem.spawn(this.surfaceBank, { scene, name: 'Footstep Surfaces' });
    this.bank = undefined;
  }

  private land(speed: number) {
    if (speed < 1.5) return;
    this.play(this.landSound, this.landVolume * Math.min(speed / 6, 1));
  }

  // One of the Audio Sources of the entity (or its own), at the gain asked, in the order of the Hierarchy or at random (a pattern is for the steps: a landing has its own few sounds).
  private play(holder: Entity | undefined, gain: number) {
    playSound(holder, { gain, order: this.order === 'random' ? 'random' : 'sequence' });
  }
}

/** The Footstep Surfaces of a scene, by what each is for: the physics material of a collider, and a surface of the project. */
interface ISurfaceBank {
  byPhysics: Map<string, FootstepSurface>;
  bySurface: Map<string, FootstepSurface>;
}

/** Where a foot is in its stride: whether it is being followed, whether it swings ahead (or is in stance), and the farthest it went back (stance) or forward (swing), along the way the body goes. */
interface IFootStride {
  known: boolean;
  swinging: boolean;
  mark: number;
}

const BACKWARD_SMOOTHING = 0.12;
const SWING_BEGINS = 0.04;
const STEP_LANDS = 0.002;

