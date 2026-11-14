import { AudioSource, AudioTrack, Entity, Explosion, explosion, ExplosionKindEnum, Float, Invoke, JsonIgnore, PhysicsSystem, Ref, RigidBody, RigidBodyTypeEnum, Saved, Script, ScriptComponent, SpawnSystem, Time, Vector3 } from '@brave/core';
import { Health } from '../health/health';
import { playClip } from '../shared/sound';

/**
 * A grenade in the air: on the root of its own prefab (a dynamic Rigid Body with a small Collider, and the model), thrown by a `Throwable`. It bounces where it lands, and when the fuse runs out it
 * goes off: the engine's Small explosion at its place, and every `Health` inside the radius takes damage that falls off with the distance. A wall between the blast and a body protects it (a ray
 * from the blast, and what has no `Health` in the way stops it); a rigid body in the radius is pushed away.
 *
 * The blast is heard from where it happens (`Blast Sound`): the grenade is gone in the same frame, so the sound is played by an entity of its own at the blast (an Audio Source that is started by hand), which is
 * taken away when the sound has ended.
 *
 * Nothing about the thrower is kept: the damage is dealt in the name of the grenade, so a player in the radius is hurt like anyone else (the hit indicator points at the blast).
 */
@Script()
export class Grenade extends ScriptComponent {

  @Float({ header: 'Fuse', label: 'Fuse', suffix: 's', tooltip: 'Seconds from the throw to the blast.' }) fuse = 2.5;

  @Float({ header: 'Blast', label: 'Radius', suffix: 'm', tooltip: 'How far the damage and the push reach. The explosion on the screen is the Small one, about three metres across: it looks smaller than what it hurts.' }) radius = 6;
  @Float({ label: 'Damage', suffix: 'HP', tooltip: 'What a body touching the blast takes. It falls to nothing at the radius.' }) damage = 120;
  @Float({ label: 'Push', suffix: 'N·s', tooltip: 'The impulse a rigid body at the blast gets, away from it. It falls off like the damage.' }) push = 14;
  @Float({ label: 'Blast Size', tooltip: 'How big the explosion on the screen is, as a multiple of the Small one.' }) size = 1;

  @Ref(AudioTrack, { header: 'Sound', label: 'Blast Sound', tooltip: 'Played at the blast, from where it happens. Empty: the blast is silent.' }) blastSound = '';

  /** Seconds left on the fuse: it is set when the grenade starts, and kept in a save. */
  @JsonIgnore() @Saved() remaining = -1;

  @JsonIgnore() private exploded = false;

  onStart() {
    if (this.remaining < 0) this.remaining = this.fuse;
  }

  onUpdate() {
    this.remaining -= Time.deltaTime;
    if (this.remaining <= 0) this.explode();
  }

  /** The blast, now: the explosion on the screen, the damage and the push, and the grenade is gone. */
  explode(): void {
    if (this.exploded) return;
    this.exploded = true;
    const center = this.entity.transform.globalPosition.clone();
    this.show(center);
    this.bang(center);
    this.hurtAround(center);
    if (!SpawnSystem.despawn(this.entity)) this.entity.destroy();
  }

  private show(center: Vector3) {
    const effect = explosion(ExplosionKindEnum.Small, this.size);
    effect.transform.position = center;
    const body = effect.getComponent(Explosion);
    if (body) body.destroyOnFinish = true;
    this.entity.scene?.add(effect);
  }

  // An Audio Source that starts with its entity, at the blast. It is taken away once the sound has had the time to end (an engine timer: it stops with Pause, so the sound is not cut by one).
  private bang(center: Vector3) {
    const scene = this.entity.scene;
    if (!this.blastSound || !scene) return;

    const holder = new Entity();
    holder.name = 'Blast Sound';
    holder.transform.position = center;
    // A source that is made plays what it has when it is made (nothing yet): the sound is started once it is in the scene, by hand.
    const source = holder.addComponent(AudioSource);
    source.autoPlay = false;
    scene.add(holder);
    playClip(source, this.blastSound);
    Invoke.setTimeout(() => holder.destroy(), BLAST_SOUND_SECONDS * 1000);
  }

  private hurtAround(center: Vector3) {
    // One entry for each `Health`, with the nearest of its colliders: a body with a hit zone on each bone is one body.
    const nearest = new Map<Health, number>();
    PhysicsSystem.overlapSphere(center, this.radius, { ignore: this.entity }).forEach(hit => {
      const health = Health.find(hit.entity);
      if (health && !health.isDead) {
        const seen = nearest.get(health);
        if (seen === undefined || hit.distance < seen) nearest.set(health, hit.distance);
      } else if (!health && hit.rigidBody?.type === RigidBodyTypeEnum.Dynamic) {
        this.pushAway(hit.rigidBody, center, hit.distance);
      }
    });

    nearest.forEach((distance, health) => {
      const target = health.entity.transform.globalPosition;
      const chest = new Vector3(target.x, target.y + 0.9, target.z);
      if (this.isBlocked(center, chest)) return;
      const direction = new Vector3(chest.x - center.x, chest.y - center.y, chest.z - center.z).normalized;
      health.damage(this.damage * this.falloff(distance), { zone: 'body', point: center, direction, source: this.entity });
    });
  }

  private pushAway(body: RigidBody, center: Vector3, distance: number) {
    const place = body.entity.transform.globalPosition;
    const away = new Vector3(place.x - center.x, place.y - center.y + 0.3, place.z - center.z).normalized;
    const strength = this.push * this.falloff(distance);
    body.applyImpulse(new Vector3(away.x * strength, away.y * strength, away.z * strength));
  }

  // The share of the full effect at a distance from the blast: 1 touching it, 0 at the radius.
  private falloff(distance: number): number {
    return Math.max(0, 1 - distance / Math.max(this.radius, 0.01));
  }

  // Scenery between the blast and the body: a ray stops at the first thing that has no `Health` (a body in the way does not shield another: a grenade goes among a crowd).
  private isBlocked(from: Vector3, to: Vector3): boolean {
    const reach = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    if (reach < 0.2) return false;
    const direction = new Vector3(to.x - from.x, to.y - from.y, to.z - from.z).normalized;
    const hit = PhysicsSystem.raycast(from, direction, reach, { ignore: this.entity });
    return !!hit && hit.distance < reach - 0.15 && !Health.find(hit.entity);
  }
}

// How long the entity that plays the blast stays: longer than the sound, which is about two and a half seconds.
const BLAST_SOUND_SECONDS = 6;
