import { Collider, Entity, Float, Inject, JsonIgnore, PlayerMovement, Ref, Saved, Script, ScriptComponent, Signal, String, Time } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { playSound } from './play-sound';

/**
 * Something the player takes by walking into it: a box on the ground that gives something (`AmmoSupply`, `HealthSupply`) and is gone, or back after a while. The entity has a trigger collider (the
 * space to walk into) and, as children, what it is drawn with; this hides `Visual` while it is used up. Its own sound (an Audio Source on this entity, Auto Play off) is heard when it is taken.
 *
 * It is the base the supplies build on: extend it and write `give()` to make your own kind (a key card, a grenade); what it returns is how much was given, and 0 means nothing was, so the player
 * walks over a supply it has no use for (full health) and it stays.
 *
 * ```ts
 * @Script({ inheritProperties: true })
 * export class Armor extends Supply {
 *   protected give(player: Entity): number { return player.getComponent(Armour)?.add(25) ?? 0; }
 * }
 * ```
 */
@Script()
export class Supply extends ScriptComponent {

  @Ref(Entity, { header: 'Supply', label: 'Visual', tooltip: 'What it is drawn with: hidden while the supply is used up. Empty: nothing is hidden.' }) visual?: Entity;
  @Float({ label: 'Respawn After', suffix: 's', tooltip: 'Seconds until it is there again after it was taken. 0: it is taken for good.' }) respawnSeconds = 30;
  @String({ label: 'Message', tooltip: 'A line on the screen when it is taken. {amount} stands for what it gave. Empty: none.' }) message = '';

  @Inject(Hud) hud!: Hud;

  /** It was taken: the entity that took it. */
  @JsonIgnore() onTaken = new Signal<Entity>();
  /** It is used up, until it respawns. In a save. */
  @JsonIgnore() @Saved() isTaken = false;
  /** Seconds until it respawns. A count in the frame, not a timer, so that a save made while it is gone brings it back. */
  @JsonIgnore() @Saved() private respawnLeft = 0;

  onStart() {
    this.bind();
  }

  onUpdate() {
    if (!this.isTaken || this.respawnLeft <= 0) return;
    this.respawnLeft -= Time.deltaTime;
    if (this.respawnLeft <= 0) this.restock();
  }

  // The listener `onStart()` made is not there after a save: it is made again, and the supply is shown as the save had it.
  onRestore() {
    this.bind();
    this.show(!this.isTaken);
  }

  // The copy holds the original's trigger listener: it makes its own when it starts.
  onAfterClone() {
    this.isTaken = false;
  }

  /** Brings it back at once: drawn again and taken by the next one that walks in. */
  restock(): void {
    this.isTaken = false;
    this.respawnLeft = 0;
    this.show(true);
  }

  /** What it gives to the one that walked in (the player's entity): how much was given. 0 gives nothing and leaves it where it is. A kind of supply overrides this. */
  protected give(player: Entity): number {
    return 0;
  }

  private bind() {
    this.entity.getComponent(Collider)?.onTriggerEnter.on(event => this.onEntered(event.entity), this);
  }

  // Only the player takes it (the one that has a PlayerMovement): an enemy that walks over it leaves it alone.
  private onEntered(entity: Entity) {
    if (this.isTaken) return;
    const player = this.playerOf(entity);
    if (!player) return;
    const amount = this.give(player);
    if (!(amount > 0)) return;

    this.isTaken = true;
    this.respawnLeft = this.respawnSeconds;
    this.show(false);
    if (this.message) this.hud.showMessage(this.message.replace('{amount}', `${Math.round(amount)}`));
    playSound(this.entity);
    this.onTaken.emit(player);
  }

  private playerOf(entity: Entity): Entity | undefined {
    for (let current: Entity | undefined = entity; current; current = current.parent) if (current.getComponent(PlayerMovement)) return current;
    return undefined;
  }

  private show(on: boolean) {
    if (this.visual) this.visual.active = on;
  }
}
