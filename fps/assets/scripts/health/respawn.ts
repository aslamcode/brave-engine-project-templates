import { CharacterController, Entity, FirstPersonCamera, Float, Inject, JsonIgnore, PlayerMovement, Ref, Saved, Script, ScriptComponent, Time, Vector3 } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Loadout } from '../gear/loadout';
import { Health } from './health';

/**
 * What happens to the player at zero health: a message, a few seconds of nothing, and the player is back where it started with full health and everything it carries full again. It is the one place that
 * decides what dying costs the player; a game with lives or a checkpoint changes `respawn()` only. What the screen and the ears say of the blows (the health bar, the hit indicator, the hurt cry) is the
 * `DamageFeedback`'s.
 */
@Script()
export class Respawn extends ScriptComponent {

  @Ref(Entity, { header: 'Parts', label: 'Eyes', tooltip: 'The camera: it is turned back to the start when the player respawns.' }) eyes!: Entity;
  @Float({ header: 'Death', label: 'Respawn After', suffix: 's' }) respawnSeconds = 4;
  @Float({ label: 'Message Seconds', suffix: 's', tooltip: 'How long "You died" stays on the screen.' }) messageSeconds = 3;

  @Inject(Hud) hud!: Hud;

  /** Seconds until the player is back, while it is dead; 0 when it is not. A count in the frame (not a timer), so that a save made while dead brings it back. */
  @JsonIgnore() @Saved() respawnLeft = 0;

  @JsonIgnore() private health!: Health;
  @JsonIgnore() private body?: CharacterController;
  @JsonIgnore() private movement?: PlayerMovement;
  @JsonIgnore() private loadout?: Loadout;
  @JsonIgnore() private camera?: FirstPersonCamera;
  // Where the player started (x, y, z, yaw): taken when the game starts, and kept in a save.
  @JsonIgnore() @Saved() private start: number[] = [0, 0, 0, 0];

  onStart() {
    this.bind();
    const place = this.entity.transform.globalPosition;
    this.start = [place.x, place.y, place.z, this.entity.transform.rotation.y];
  }

  onUpdate() {
    if (this.respawnLeft <= 0) return;
    this.respawnLeft -= Time.deltaTime;
    if (this.respawnLeft <= 0) this.respawn();
  }

  // A save brings the component back as it was, started: the handles and the listeners `onStart()` made are not there.
  onRestore() {
    this.bind();
  }

  /** The player is put back at the start with full health, everything it carries full again and control of its body. */
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
    this.loadout?.refill();
    if (this.movement) this.movement.active = true;
  }

  private bind() {
    this.health = this.entity.getComponent(Health);
    this.body = this.entity.getComponent(CharacterController);
    this.movement = this.entity.getComponent(PlayerMovement);
    this.loadout = this.entity.getComponent(Loadout);
    this.camera = this.eyes?.getComponent(FirstPersonCamera);
    this.health.onDied.on(() => this.onDied(), this);
  }

  private onDied() {
    this.hud.showMessage('You died', this.messageSeconds);
    if (this.movement) this.movement.active = false;
    // Turning the mind off does not stop the body: it would go on at the speed it had.
    if (this.body) this.body.velocity = new Vector3();
    this.respawnLeft = this.respawnSeconds;
  }
}
