import { CharacterController, Entity, FirstPersonCamera, Float, Inject, JsonIgnore, PlayerMovement, Ref, Saved, Script, ScriptComponent, Time, Vector3 } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Health, IDamageEvent } from './health';
import { playSound } from './play-sound';
import { Weapon } from './weapon';

/**
 * The player's side of its `Health`: what the screen says (`Hud`), the sound of being hurt, and what happens at zero: a message, a few seconds of nothing, and the player is back where it started with
 * full health and a full weapon. It is the one place that decides what dying costs the player; a game with lives or a checkpoint changes `respawn()` only.
 */
@Script()
export class PlayerHealth extends ScriptComponent {

  @Ref(Entity, { header: 'Parts', label: 'Eyes', tooltip: 'The camera: it is turned back to the start when the player respawns.' }) eyes!: Entity;
  @Ref(Entity, { label: 'Hurt Sound', tooltip: 'An entity with an Audio Source (or several as children) played when the player is hurt.' }) hurtSound?: Entity;
  @Float({ header: 'Death', label: 'Respawn After', suffix: 's' }) respawnSeconds = 4;
  @Float({ label: 'Message Seconds', suffix: 's', tooltip: 'How long "You died" stays on the screen.' }) messageSeconds = 3;

  @Inject(Hud) hud!: Hud;

  /** Seconds until the player is back, while it is dead; 0 when it is not. A count in the frame (not a timer), so that a save made while dead brings it back. */
  @JsonIgnore() @Saved() respawnLeft = 0;

  @JsonIgnore() private health!: Health;
  @JsonIgnore() private body?: CharacterController;
  @JsonIgnore() private movement?: PlayerMovement;
  @JsonIgnore() private weapon?: Weapon;
  @JsonIgnore() private camera?: FirstPersonCamera;
  // Where the player started (x, y, z, yaw): taken when the game starts, and kept in a save.
  @JsonIgnore() @Saved() private start: number[] = [0, 0, 0, 0];

  onStart() {
    this.bind();
    const place = this.entity.transform.globalPosition;
    this.start = [place.x, place.y, place.z, this.entity.transform.rotation.y];
    this.showHealth();
  }

  onUpdate() {
    if (this.respawnLeft <= 0) return;
    this.respawnLeft -= Time.deltaTime;
    if (this.respawnLeft <= 0) this.respawn();
  }

  // A save brings the component back as it was, started: the handles and the listeners `onStart()` made are not there.
  onRestore() {
    this.bind();
    this.showHealth();
  }

  /** The player is put back at the start with full health, a full weapon and control of its body. */
  respawn(): void {
    this.respawnLeft = 0;
    const [x, y, z, yaw] = this.start;
    this.body?.teleport(new Vector3(x, y, z));
    this.entity.transform.rotation.y = yaw;
    if (this.camera) {
      this.camera.yaw = yaw;
      this.camera.pitch = 0;
      this.eyes.transform.rotation.x = 0;
    }
    this.health.revive();
    this.weapon?.refill();
    if (this.movement) this.movement.active = true;
  }

  private bind() {
    this.health = this.entity.getComponent(Health);
    this.body = this.entity.getComponent(CharacterController);
    this.movement = this.entity.getComponent(PlayerMovement);
    this.weapon = this.entity.getComponent(Weapon);
    this.camera = this.eyes?.getComponent(FirstPersonCamera);
    this.health.onChange.on(() => this.showHealth(), this);
    this.health.onDamaged.on(event => this.onHurt(event), this);
    this.health.onDied.on(() => this.onDied(), this);
  }

  private showHealth() {
    this.hud.setHealth(this.health.current, this.health.maximum);
  }

  private onHurt(event: IDamageEvent) {
    this.hud.notifyDamaged(event.amount);
    playSound(this.hurtSound);
  }

  private onDied() {
    this.hud.showMessage('You died', this.messageSeconds);
    if (this.movement) this.movement.active = false;
    // Turning the mind off does not stop the body: it would go on at the speed it had.
    if (this.body) this.body.velocity = new Vector3();
    this.respawnLeft = this.respawnSeconds;
  }
}
