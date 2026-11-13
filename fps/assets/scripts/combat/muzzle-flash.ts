import { Entity, Float, Int, JsonIgnore, ParticleEmitter, ParticlePresetEnum, ParticleShapeEnum, Ref, RgbaColor, Script, ScriptComponent, Vector3 } from '@brave/core';

/**
 * The flash of a shot, made of the engine's own particles: a spray of hot sparks thrown along the barrel and a round glow at its tip, a few hundredths of a second each. It is on a weapon (next to its `Firearm`)
 * and `Weapon` calls `fire()` at every shot; the light that flashes on the weapon and the hands is the `Muzzle`'s, which the weapon switches on for `Flash Time`. The two emitters are made when the weapon
 * is first taken in hand, as children of the weapon (not of the `Muzzle`, which is switched off after a shot and would take the sparks with it), where the `Muzzle` is (which has no turn of its own, as in the kit), turned so that the sparks go the way its
 * forward axis points: the barrel. They are on the default layer, drawn by the main camera behind the weapon (the arms camera draws no particles).
 */
@Script()
export class MuzzleFlash extends ScriptComponent {

  @Ref(Entity, { header: 'Flash', label: 'Muzzle', tooltip: 'The point at the tip of the barrel, whose forward axis points the way the barrel does: the sparks are born there and go that way.' }) muzzle?: Entity;
  @Int({ label: 'Sparks', tooltip: 'How many sparks a shot throws. 0: none.' }) sparks = 7;
  @Float({ label: 'Spark Speed', suffix: 'm/s', tooltip: 'How fast the sparks leave the barrel.' }) sparkSpeed = 10;
  @Float({ label: 'Spark Spread', suffix: '°', tooltip: 'The half angle of the cone the sparks go in.' }) sparkSpread = 16;
  @Float({ label: 'Glow Size', suffix: 'm', tooltip: 'The width of the round glow at the muzzle. 0: none.' }) glowSize = 0.17;

  @JsonIgnore() private sparkEmitter?: ParticleEmitter;
  @JsonIgnore() private glowEmitter?: ParticleEmitter;

  onStart() {
    this.build();
  }

  // The copy holds the original's emitters (entities of the original's tree): it makes its own when it starts.
  onAfterClone() {
    this.sparkEmitter = undefined;
    this.glowEmitter = undefined;
  }

  /** One shot's flash: the sparks and the glow, now. */
  fire(): void {
    if (this.sparkEmitter && this.sparks > 0) this.sparkEmitter.burst(this.sparks);
    if (this.glowEmitter && this.glowSize > 0) this.glowEmitter.burst(1);
  }

  private build() {
    if (this.sparkEmitter || !this.muzzle) return;
    const muzzle = this.muzzle;

    // Where the muzzle is and the way it points, kept in the weapon's own space: +Y of an emitter is the axis of its cone, and the barrel is the muzzle's -Z (forward), so it is turned a quarter about X.
    this.sparkEmitter = this.makeEmitter('Muzzle Sparks', muzzle, new Vector3(-90, 0, 0), emitter => {
      emitter.preset = ParticlePresetEnum.Sparks;
      emitter.maxParticles = 200;
      emitter.rate = 0;
      emitter.lifetime = 0.17;
      emitter.randomness = 0.5;
      emitter.shape = ParticleShapeEnum.Cone;
      emitter.coneAngle = this.sparkSpread;
      emitter.speed = this.sparkSpeed;
      emitter.gravity = -2.5;
      emitter.drag = 1.5;
      emitter.turbulence = 0;
      emitter.size = 0.011;
      emitter.sizeEnd = 0.4;
      emitter.stretch = 0.03;
      emitter.brightness = 40;
      emitter.color = new RgbaColor(1, 0.95, 0.72, 1);
      emitter.colorEnd = new RgbaColor(1, 0.42, 0.1, 1);
      emitter.collide = false;
      emitter.bounce = 0;
      emitter.nearFade = 0;
    });

    this.glowEmitter = this.makeEmitter('Muzzle Glow', muzzle, new Vector3(0, 0, 0), emitter => {
      emitter.preset = ParticlePresetEnum.Sparks;
      emitter.maxParticles = 16;
      emitter.rate = 0;
      emitter.lifetime = 0.06;
      emitter.randomness = 0.1;
      emitter.shape = ParticleShapeEnum.Point;
      emitter.speed = 0.15;
      emitter.gravity = 0;
      emitter.drag = 0;
      emitter.turbulence = 0;
      emitter.size = this.glowSize;
      emitter.sizeEnd = 1.5;
      emitter.stretch = 0;
      emitter.softness = 0.8;
      emitter.brightness = 11;
      emitter.twinkle = 0;
      emitter.color = new RgbaColor(1, 0.95, 0.8, 1);
      emitter.colorEnd = new RgbaColor(1, 0.55, 0.2, 1);
      emitter.collide = false;
      emitter.bounce = 0;
      emitter.nearFade = 0;
    });
  }

  // An entity below the weapon, where `at` is, carrying an emitter that `setup` sets.
  private makeEmitter(name: string, at: Entity, turn: Vector3, setup: (emitter: ParticleEmitter) => void): ParticleEmitter {
    const holder = new Entity();
    holder.name = name;
    // On the default layer on purpose: particles are drawn by the main camera, and the arms camera (which draws the weapon, layer 1) does not draw them: they are behind the weapon, at its tip.
    holder.layer = 0;
    holder.transform.position = at.transform.position.clone();
    const rotation = at.transform.rotation;
    holder.transform.rotation = new Vector3(rotation.x + turn.x, rotation.y + turn.y, rotation.z + turn.z);
    const emitter = holder.addComponent(ParticleEmitter);
    setup(emitter);
    // Last: an entity that comes into the scene loads and starts the components it carries then.
    this.entity.addChild(holder);
    return emitter;
  }
}
