import { AudioSource, AudioTrack, BraveEngine, BraveEngineModeEnum, Entity, Float, IEntity, Inject, Input, JsonIgnore, PhysicsSystem, Ref, Script, ScriptComponent, Signal, Vector3 } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Interactable } from './interactable';
import { playClip } from './play-clip';

/**
 * The player's side of interaction: put it on the player's eyes (the camera). Every frame a ray goes from the eyes along the look, `Reach` metres, ignoring the player's own body and everything
 * under it, and stops at the nearest thing it meets. From the collider it hit it walks up through the parents to the first entity that has an `Interactable`, and tells the `Hud` what E does
 * on it (`hud.setPrompt`), or an empty line when there is nothing. E (`Input.keyboard.keyE`) uses it.
 *
 * It does nothing while the game is paused or when the entity it is on is off (the other one of two players, say).
 *
 * It also has the sound of the player's side of an interaction: what is heard from the player, not from the thing used (the pickup's: the item's entity is switched off when it is taken, and
 * takes its own Audio Source with it), and the dull click of a use that cannot be done (`deny()`). Give it an Audio Source with Spatial off.
 */
@Script()
export class Interactor extends ScriptComponent {

  @Float({ header: 'Reach', label: 'Reach', suffix: 'm', tooltip: 'How far from the eyes the player can use things.' }) reach = 2.5;
  @Ref(Entity, { label: 'Body', tooltip: 'The player\'s own entity: the ray goes through it and everything under it. Empty: the top of the hierarchy this entity is in.' }) body?: IEntity;

  @Ref(AudioSource, { header: 'Sound', label: 'Audio Source', tooltip: 'Plays the sounds of the player\'s side (a pickup, a use that cannot be done). Give it an Audio Source with Auto Play and Spatial off.' }) audio?: AudioSource;
  @Ref(AudioTrack, { label: 'Deny Sound', tooltip: 'Played when the player tries something that cannot be done.' }) denySound = '';
  @Float({ label: 'Pitch Variation', tooltip: 'How much the pitch changes from one time to the next, as a fraction.' }) pitchVariation = 0.05;

  @Inject(Hud) hud!: Hud;

  /** What the player is looking at and can use now, or nothing. */
  @JsonIgnore() target?: Interactable;
  /** The target changed: the new one, or undefined when the player looks at nothing that can be used. */
  @JsonIgnore() onTargetChange = new Signal<Interactable | undefined>();

  @JsonIgnore() private key?: ReturnType<typeof Input.keyboard.keyE.down>;
  @JsonIgnore() private readonly origin = new Vector3();
  @JsonIgnore() private readonly direction = new Vector3();

  onStart() {
    this.listen();
  }

  // A restored component that had started does not start again, and a load took every Input listener with it: it listens again.
  onRestore() {
    if (this.started) this.listen();
  }

  onUpdate() {
    if (!this.running) return;
    this.watch(this.look());
  }

  onDisable() {
    this.watch(undefined);
  }

  onDestroy() {
    if (this.key) Input.removeListner(this.key);
    this.key = undefined;
    this.watch(undefined);
  }

  // The copy made for Play holds the original's handle, which must not be removed with the copy's own: dropped, never removed (see docs/scripts.md).
  onAfterClone() {
    this.key = undefined;
  }

  /** E: uses what the player looks at. Returns whether anything was used. */
  use(): boolean {
    if (!this.running) return false;

    const interactable = this.look();
    return interactable ? interactable.interact(this) : false;
  }

  /** A use that cannot be done: the dull click, and a line on the screen when there is something to say. */
  deny(message = ''): void {
    playClip(this.audio, this.denySound, this.pitchVariation);
    if (message) this.hud.showMessage(message);
  }

  /** Plays a clip from the player (an Audio Source on this entity, Spatial off). */
  play(clip: string): void {
    playClip(this.audio, clip, this.pitchVariation);
  }

  private listen(): void {
    if (this.key) Input.removeListner(this.key);
    this.key = Input.keyboard.keyE.down(() => { this.use(); });
  }

  // The first Interactable that can be used, from what the ray meets first. Only the nearest thing counts: a wall in front of a door is a wall.
  private look(): Interactable | undefined {
    const matrix = this.entity.transform.worldMatrix;
    const length = Math.hypot(matrix[8], matrix[9], matrix[10]) || 1;
    this.origin.set(matrix[12], matrix[13], matrix[14]);
    this.direction.set(-matrix[8] / length, -matrix[9] / length, -matrix[10] / length);

    const hit = PhysicsSystem.raycast(this.origin, this.direction, this.reach, { ignore: this.body ?? this.root() });
    if (!hit) return undefined;

    for (let entity: Entity | undefined = hit.entity; entity; entity = entity.parent) {
      const interactable = entity.getComponent(Interactable);
      if (interactable?.activeInHierarchy) return interactable.usable ? interactable : undefined;
    }
    return undefined;
  }

  private watch(target: Interactable | undefined): void {
    this.hud?.setPrompt(target ? target.currentPrompt : '');
    if (target === this.target) return;

    this.target = target;
    this.onTargetChange.emit(target);
  }

  private root(): IEntity {
    let entity: Entity = this.entity;
    while (entity.parent) entity = entity.parent;
    return entity;
  }

  private get running(): boolean {
    return BraveEngine.mode === BraveEngineModeEnum.Running && this.activeInHierarchy;
  }
}
