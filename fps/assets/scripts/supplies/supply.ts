import { Bool, Collider, Entity, Float, IEntity, Inject, JsonIgnore, PlayerMovement, Ref, Saved, Script, Signal, String, Time } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Interactable } from '../interaction/interactable';
import type { Interactor } from '../interaction/interactor';
import { playSound } from '../shared/sound';

/**
 * Something the player takes: a box on the ground that gives something (`AmmoSupply`, `HealthSupply`) and is gone, or back after a while. It is an `Interactable`, so the player sees it as the rest of what can be used
 * (the glass box with E and what it gives, tied to it by a line, when it is looked at) and takes it with E. The entity has the drawing as children, `Visual` pointing at them (hidden while it is used up), a solid
 * Collider on the `Visual` for the player to look at (a ray goes through triggers), and its own sound (an Audio Source on this entity, Auto Play off) heard when it is taken. `Walk Over` also lets the player take it
 * by walking into the trigger Collider of this entity.
 *
 * It is the base the supplies build on: extend it and write `give()` to make your own kind (a key card, a grenade); what it returns is how much was given, and 0 means nothing was: the player is told it has
 * no use for it (full health), the click, and it stays. `promptAmount()` is what `{amount}` stands for in the prompt.
 *
 * ```ts
 * @Script({ inheritProperties: true })
 * export class Armor extends Supply {
 *   prompt = 'Take armour';
 *   protected give(player: Entity): number { return player.getComponent(Armour)?.add(25) ?? 0; }
 * }
 * ```
 */
@Script({ inheritProperties: true })
export class Supply extends Interactable {

  @Ref(Entity, { header: 'Supply', label: 'Visual', tooltip: 'What it is drawn with: hidden while the supply is used up. Empty: nothing is hidden.' }) visual?: Entity;
  @Float({ label: 'Respawn After', suffix: 's', tooltip: 'Seconds until it is there again after it was taken. 0: it is taken for good.' }) respawnSeconds = 30;
  @String({ label: 'Message', tooltip: 'A line on the screen when it is taken. {amount} stands for what it gave. Empty: none.' }) message = '';
  @String({ label: 'Full Message', tooltip: 'A line on the screen when the player uses it and has no use for it (full health, ammo at the limit). Empty: none, only the click.' }) fullMessage = '';
  @Bool({ label: 'Walk Over', tooltip: 'On: it is also taken by walking into the trigger Collider of this entity, with no need to look at it and press E.' }) walkOver = false;

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

  /** What E does: the prompt, with {amount} for what it gives. */
  get currentPrompt(): string {
    return this.prompt.replace('{amount}', `${Math.round(this.promptAmount())}`);
  }

  /** It can be used until it is taken (a used up supply is not marked, and E does nothing on it). */
  get usable(): boolean {
    return !this.isTaken;
  }

  /** E: the player takes it, or is told it has no use for it. */
  interact(interactor: Interactor): boolean {
    if (!this.activeInHierarchy || !this.usable) return false;

    const player = this.playerOf(interactor.entity);
    if (!player || !this.take(player)) {
      interactor.deny(this.fullMessage);
      return false;
    }
    this.onUsed.emit(interactor);
    return true;
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

  /** What it gives to the player (its entity): how much was given. 0 gives nothing and leaves it where it is. A kind of supply overrides this. */
  protected give(player: Entity): number {
    return 0;
  }

  /** What `{amount}` stands for in the prompt: what it gives, as far as it is known before it is taken. */
  protected promptAmount(): number {
    return 0;
  }

  private bind() {
    this.entity.getComponent(Collider)?.onTriggerEnter.on(event => this.onEntered(event.entity), this);
  }

  // Walking into it: only when `Walk Over` is on, and only the player takes it (the one that has a PlayerMovement): an enemy that walks over it leaves it alone.
  private onEntered(entity: Entity) {
    if (!this.walkOver || this.isTaken) return;
    const player = this.playerOf(entity);
    if (player) this.take(player);
  }

  // Gives what it has to the player: gone for `Respawn After`, the line on the screen, the sound. Returns whether it gave anything.
  private take(player: Entity): boolean {
    const amount = this.give(player);
    if (!(amount > 0)) return false;

    this.isTaken = true;
    this.respawnLeft = this.respawnSeconds;
    this.show(false);
    if (this.message) this.hud.showMessage(this.message.replace('{amount}', `${Math.round(amount)}`));
    playSound(this.entity);
    this.onTaken.emit(player);
    return true;
  }

  private playerOf(entity: IEntity | undefined): Entity | undefined {
    for (let current = entity; current; current = current.parent) if (current.getComponent(PlayerMovement)) return current as Entity;
    return undefined;
  }

  private show(on: boolean) {
    if (this.visual) this.visual.active = on;
  }
}
