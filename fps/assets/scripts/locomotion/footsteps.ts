import { AudioSource, CharacterController, Entity, Float, JsonIgnore, Ref, Script, ScriptComponent } from '@brave/core';

/**
 * The sound of a character's steps: when a foot comes down (its bone gets to `Plant Height` above the entity's origin, after having been above `Lift Height`) one of the step sounds plays, louder the faster the body
 * goes and softer crouched, and `Land Sound` plays when the body lands from a fall. It reads the feet from the animation, so it follows any clip (a walk, a run, a crouched walk, a sidestep) with no marks
 * in them, and it is silent when the body stands (a foot that moves to turn on the spot) or is in the air. It is on the player and on the humanoid enemy: for the player the sounds are not spatial, for the enemy
 * they are, so that its steps come from where it is.
 *
 * `Step Sound` is an entity with an Audio Source for each variation as children (one plays at random), or one Audio Source; each has Pooling on so that two steps may overlap. The script sets the gain of the
 * one it plays: `Volume` is the loudest, the Audio Source's own gain is not used. Read from the entity's origin, so on stairs a foot that lands higher than `Plant Height` is not heard: raise it for a level with steps.
 */
@Script()
export class Footsteps extends ScriptComponent {

  @Ref(Entity, { header: 'Feet', label: 'Left Foot', tooltip: 'The bone of the left foot (the ankle).' }) leftFoot?: Entity;
  @Ref(Entity, { label: 'Right Foot', tooltip: 'The bone of the right foot (the ankle).' }) rightFoot?: Entity;

  @Ref(Entity, { header: 'Sounds', label: 'Step Sound', tooltip: 'An entity with an Audio Source for each variation as children (one plays at each step), or one Audio Source.' }) stepSound?: Entity;
  @Ref(Entity, { label: 'Land Sound', tooltip: 'The same, for the body landing from a fall.' }) landSound?: Entity;

  @Float({ header: 'Detection', label: 'Plant Height', suffix: 'm', tooltip: 'A foot has come down when its bone is this high or lower above the entity\'s origin (the ankle is about 0.17 m up on level ground).' }) plantHeight = 0.2;
  @Float({ label: 'Lift Height', suffix: 'm', tooltip: 'A foot is in the air again when its bone goes above this. The gap above Plant Height keeps a foot that hovers at the limit from sounding twice.' }) liftHeight = 0.235;
  @Float({ label: 'Min Speed', suffix: 'm/s', tooltip: 'The slowest the body goes for a step to be heard: a foot that moves while the body stands (turning on the spot) is silent.' }) minSpeed = 0.4;

  @Float({ header: 'Volume', label: 'Volume', tooltip: 'The gain of the loudest step (at Run Speed).' }) volume = 0.8;
  @Float({ label: 'Run Speed', suffix: 'm/s', tooltip: 'The speed at which a step is at full Volume. Below it a step is softer, down to Walk Share of it.' }) runSpeed = 4;
  @Float({ label: 'Walk Share', tooltip: 'What share of Volume a step has at a crawl (the speed just over Min Speed): from there to Run Speed it rises.' }) walkShare = 0.45;
  @Float({ label: 'Crouch Share', tooltip: 'What share a crouched step keeps.' }) crouchShare = 0.5;
  @Float({ label: 'Land Volume', tooltip: 'The gain of a landing at 6 m/s or more; a gentler one is softer, and one under 1.5 m/s is silent.' }) landVolume = 1;

  @JsonIgnore() private body?: CharacterController;
  @JsonIgnore() private landListener?: { off(): void };
  @JsonIgnore() private leftDown = true;
  @JsonIgnore() private rightDown = true;

  onStart() {
    this.body = this.entity.getComponent(CharacterController);
    this.landListener = this.body?.onLand.on(speed => this.land(speed), this);
  }

  onUpdate() {
    if (!this.leftFoot || !this.rightFoot) return;
    this.leftDown = this.follow(this.leftFoot, this.leftDown);
    this.rightDown = this.follow(this.rightFoot, this.rightDown);
  }

  onDestroy() {
    this.landListener?.off();
    this.landListener = undefined;
  }

  // The copy holds the original's subscription and body: it makes its own when it starts, and must never take the original's off.
  onAfterClone() {
    this.landListener = undefined;
    this.body = undefined;
  }

  // Whether the foot is down now; a step sounds in the frame it comes down. A foot between the two heights keeps what it was.
  private follow(foot: Entity, wasDown: boolean): boolean {
    const height = foot.transform.worldMatrix[13] - this.entity.transform.worldMatrix[13];
    if (wasDown) return height <= this.liftHeight;
    if (height > this.plantHeight) return false;
    this.step();
    return true;
  }

  private step() {
    const body = this.body;
    // A body that is not driving the character (a ragdoll took it) says nothing: its last speed and its last ground are old, and its feet move because it falls.
    if (!body || !body.active || !body.isGrounded) return;
    const velocity = body.actualVelocity;
    const speed = Math.hypot(velocity.x, velocity.z);
    if (speed < this.minSpeed) return;

    const share = this.walkShare + (1 - this.walkShare) * Math.min(speed / Math.max(this.runSpeed, 0.1), 1);
    this.play(this.stepSound, this.volume * share * (body.isCrouched ? this.crouchShare : 1));
  }

  private land(speed: number) {
    if (speed < 1.5) return;
    this.play(this.landSound, this.landVolume * Math.min(speed / 6, 1));
  }

  // One of the Audio Sources of the entity (or its own), at the gain asked.
  private play(holder: Entity | undefined, gain: number) {
    if (!holder) return;
    const own = holder.getComponent(AudioSource);
    const sources = own ? [own] : holder.children.map(child => child.getComponent(AudioSource)).filter((source): source is AudioSource => !!source);
    const source = sources[Math.floor(Math.random() * sources.length)];
    if (!source) return;
    source.gain = Math.max(gain, 0);
    void source.play();
  }
}
