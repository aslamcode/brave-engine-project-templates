import { Animator, Collider, Entity, Float, JsonIgnore, NavAgent, PhysicsSystem, PlayerMovement, Ragdoll, Ref, Saved, Script, ScriptComponent, SpawnSystem, State, Time, Vector3 } from '@brave/core';
import { Health, IDamageEvent } from '../combat/health';
import { playSound } from '../combat/play-sound';

/**
 * A cube that hunts the player. It waits until the player is within `Aggro Range` (or is shot, or is told to `hunt()`), then walks to the player over the navigation grid and hits it in reach, every
 * `Attack Interval` seconds. Its `Health` and the `Hitbox`es on its parts are separate components: the hits are the weapon's business, this only reacts to them (a squash, a sound, a fall).
 *
 * It dies one of two ways. A body with a `Ragdoll` (the humanoid) goes limp and falls where the shot that killed it pushed it; one without (the cube) falls over as one piece.
 *
 * Why the navigation and not a plain steering: the level has walls and a doorway, and a cube that steers straight at the player would stand pressed against the house. `NavAgent` finds the way round and
 * through; with a Character Controller on the same entity it walks as the player does, solid against the level and the player, and needs no bake (it reads the colliders as the game runs).
 */
@Script()
export class EnemyCube extends ScriptComponent {

  private static readonly SQUASH_STIFFNESS = 300;
  private static readonly SQUASH_DAMPING = 24;
  private static readonly FALL_SECONDS = 0.35;
  private static readonly VANISH_SECONDS = 0.3;

  @Ref(Entity, { header: 'Target', label: 'Target', tooltip: 'Who it hunts. Empty: the player (the entity with a Player Movement).' }) target?: Entity;
  @Float({ header: 'Behaviour', label: 'Aggro Range', suffix: 'm', tooltip: 'How near the target must come for it to start the hunt. 0: it never does, until it is shot.' }) aggroRange = 14;
  @Float({ label: 'Speed', suffix: 'm/s' }) speed = 3;
  @Float({ label: 'Attack Range', suffix: 'm', tooltip: 'How near the target it must be to hit. It stops a little inside this.' }) attackRange = 1.6;
  @Float({ label: 'Attack Damage', suffix: 'HP' }) attackDamage = 8;
  @Float({ label: 'Attack Interval', suffix: 's' }) attackInterval = 1.5;

  @Float({ header: 'Death', label: 'Corpse Seconds', suffix: 's', tooltip: 'How long it stays after it dies, before it is removed.' }) corpseSeconds = 1.5;
  @Float({ label: 'Death Push', suffix: 'N s', tooltip: 'With a Ragdoll on it: the blow of the shot that killed it, as an impulse along the shot (a bullet does not move a body that heavy by itself, so this is what throws it back). 0 lets it fall where it stands.' }) deathPush = 90;

  @Ref(Entity, { header: 'Parts', label: 'Visual', tooltip: 'What squashes when it is hurt and falls when it dies: the entity that holds the meshes.' }) visual?: Entity;
  @Ref(Entity, { label: 'Hit Sound', tooltip: 'Entities with an Audio Source (or several as children) for each moment.' }) hitSound?: Entity;
  @Ref(Entity, { label: 'Die Sound' }) dieSound?: Entity;
  @Ref(Entity, { label: 'Attack Sound' }) attackSound?: Entity;

  /** It is after its target. */
  @State() @JsonIgnore() @Saved() isChasing = false;
  @State() @JsonIgnore() @Saved() isDead = false;

  @JsonIgnore() private health!: Health;
  @JsonIgnore() private agent?: NavAgent;
  @JsonIgnore() private ragdoll?: Ragdoll;
  @JsonIgnore() private attackLeft = 0;
  @JsonIgnore() @Saved() private deadTime = 0;
  @JsonIgnore() private squash = 0;
  @JsonIgnore() private squashVelocity = 0;

  onStart() {
    this.bind();
    this.target = this.target ?? this.findPlayer();
  }

  // A save brings the component back as it was, started: the listeners and the agent's target (which is not in a save) are made again. A cube that was after its target goes on after it.
  onRestore() {
    this.bind();
    this.target = this.target ?? this.findPlayer();
    if (this.isChasing && this.target) this.agent?.setTarget(this.target);
  }

  onUpdate() {
    const deltaTime = Time.deltaTime;
    this.animateSquash(deltaTime);
    if (this.isDead) {
      this.animateDeath(deltaTime);
      return;
    }
    if (!this.target) return;

    const distance = this.distanceTo(this.target);
    if (!this.isChasing && this.aggroRange > 0 && distance < this.aggroRange) this.hunt(this.target);
    if (!this.isChasing) return;

    this.attackLeft -= deltaTime;
    if (distance < this.attackRange && this.attackLeft <= 0 && this.canReach(this.target)) this.attack(this.target);
  }

  private bind() {
    this.health = this.entity.getComponent(Health);
    this.agent = this.entity.getComponent(NavAgent);
    this.ragdoll = this.entity.getComponent(Ragdoll);
    this.health.onDamaged.on(event => this.onHurt(event), this);
    this.health.onDied.on(event => this.die(event), this);
    if (!this.agent) return;
    this.agent.speed = this.speed;
    this.agent.stoppingDistance = this.attackRange * 0.7;
  }

  /** Starts the hunt now, whatever the distance (a wave of enemies is told to at the spawn). */
  hunt(target?: Entity): void {
    if (this.isDead) return;
    this.target = target ?? this.target;
    if (!this.target || !this.agent) return;
    this.isChasing = true;
    this.agent.setTarget(this.target);
  }

  private attack(target: Entity) {
    this.attackLeft = this.attackInterval;
    playSound(this.attackSound);
    this.squashVelocity += 5;
    Health.find(target)?.damage(this.attackDamage, { zone: 'body', point: target.transform.globalPosition.clone(), source: this.entity });
  }

  // A hit that is shot wakes it, whatever the distance, and squashes it.
  private onHurt(event: IDamageEvent) {
    this.squashVelocity -= Math.min(6, 2 + event.amount / 10);
    playSound(this.hitSound);
    if (!this.isChasing && !this.isDead) this.hunt(event.source ?? this.target);
  }

  private die(event?: IDamageEvent) {
    this.isDead = true;
    this.isChasing = false;
    this.deadTime = 0;
    if (this.agent) {
      this.agent.stop();
      this.agent.active = false;
    }
    // A body with a skeleton and no ragdoll stops where it is (the corpse falls in the pose it died in); a ragdoll holds the animation itself.
    const animator = this.entity.getComponent(Animator);
    if (animator && !this.ragdoll) animator.active = false;
    // Its parts stop being hit and stop being in the way: the dead are not shot again and the player walks through them.
    this.collidersBelow(this.entity).forEach(collider => { collider.active = false; });
    this.goLimp(event);
    playSound(this.dieSound);
  }

  // The ragdoll takes the blow of the shot that killed it, along the shot, at the point it hit. The visual goes back to its own size first: a squash in the middle of its spring would be the scale of the
  // skeleton's root, and the ragdoll writes the bones against the world matrix of their parent.
  private goLimp(event?: IDamageEvent) {
    if (!this.ragdoll) return;

    this.squash = this.squashVelocity = 0;
    this.visual?.transform.scale.set(1, 1, 1);
    const along = event?.direction;
    if (!along || !event?.point || !(this.deathPush > 0)) {
      this.ragdoll.goLimp();
      return;
    }
    this.ragdoll.goLimp({ impulse: new Vector3(along.x * this.deathPush, along.y * this.deathPush, along.z * this.deathPush), point: event.point });
  }

  //#region Animation
  // A spring on the visual's scale: a hit squashes it, a blow of its own (the attack) stretches it.
  private animateSquash(deltaTime: number) {
    if (!this.visual || (this.squash === 0 && this.squashVelocity === 0)) return;
    this.squashVelocity += (-EnemyCube.SQUASH_STIFFNESS * this.squash - EnemyCube.SQUASH_DAMPING * this.squashVelocity) * deltaTime;
    this.squash += this.squashVelocity * deltaTime;
    if (Math.abs(this.squash) < 1e-3 && Math.abs(this.squashVelocity) < 1e-2) this.squash = this.squashVelocity = 0;
    const scale = this.visual.transform.scale;
    scale.x = scale.z = 1 + this.squash * 0.12;
    scale.y = 1 - this.squash * 0.2;
  }

  // It falls over, lies there, shrinks away, and is removed. A ragdoll falls by itself, and is not shrunk (its bones are written against the world matrix of the skeleton's root): it is removed as it lies.
  private animateDeath(deltaTime: number) {
    this.deadTime += deltaTime;
    if (this.visual && !this.ragdoll) {
      const fall = Math.min(1, this.deadTime / EnemyCube.FALL_SECONDS);
      this.visual.transform.rotation.x = -90 * fall * fall;
      const vanish = Math.min(1, Math.max(0, (this.deadTime - (this.corpseSeconds - EnemyCube.VANISH_SECONDS)) / EnemyCube.VANISH_SECONDS));
      this.visual.transform.scale.set(1 - vanish, 1 - vanish, 1 - vanish);
    }
    if (this.deadTime >= this.corpseSeconds) this.remove();
  }

  // Spawned by the game or placed in the scene: the spawner takes what it made, and an entity of the scene is destroyed.
  private remove() {
    if (!SpawnSystem.despawn(this.entity)) this.entity.destroy();
  }
  //#endregion Animation

  //#region Reach
  private distanceTo(target: Entity): number {
    const here = this.entity.transform.globalPosition, there = target.transform.globalPosition;
    return Math.hypot(there.x - here.x, there.z - here.z);
  }

  // The reach is a straight line to the target's chest, and a wall in between stops it: a cube outside the house does not hit the player behind the wall.
  private canReach(target: Entity): boolean {
    const chest = this.entity.transform.globalPosition.clone();
    chest.y += 0.8;
    const aim = target.transform.globalPosition.clone();
    aim.y += 1;
    const toward = new Vector3(aim.x - chest.x, aim.y - chest.y, aim.z - chest.z);
    const length = toward.magnitude;
    if (length < 1e-3) return true;
    const hit = PhysicsSystem.raycast(chest, toward.normalized, length, { ignore: this.entity });
    return !hit || Health.find(hit.entity) === Health.find(target);
  }

  private findPlayer(): Entity | undefined {
    return this.entity.scene?.children.find(root => root.activeInHierarchy && root.getComponent(PlayerMovement));
  }

  private collidersBelow(entity: Entity): Collider[] {
    return [...entity.components.filter(component => component instanceof Collider), ...entity.children.flatMap(child => this.collidersBelow(child))] as Collider[];
  }
  //#endregion Reach
}
