import { Entity, Inject, JsonIgnore, Ref, Script, ScriptComponent } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { playSound } from '../shared/sound';
import { Health, IDamageEvent } from './health';

/**
 * What the player sees and hears of its own `Health`: the health bar, the indicator of the side a blow came from, and the cry when it is hurt. It only listens to the `Health`; what happens at zero is the
 * `Respawn`'s.
 */
@Script()
export class DamageFeedback extends ScriptComponent {

  @Ref(Entity, { header: 'Parts', label: 'Eyes', tooltip: 'The camera: the side a blow came from is measured from where it looks.' }) eyes!: Entity;
  @Ref(Entity, { label: 'Hurt Sound', tooltip: 'An entity with an Audio Source (or several as children) played when the player is hurt.' }) hurtSound?: Entity;

  @Inject(Hud) hud!: Hud;

  @JsonIgnore() private health!: Health;

  onStart() {
    this.bind();
    this.showHealth();
  }

  // A save brings the component back as it was, started: the handles and the listeners `onStart()` made are not there. The HUD is told only by a player that is on: one that is put away (the other player of
  // the scene, switched off) is restored too, and must not write its health over the one that plays.
  onRestore() {
    this.bind();
    if (this.started && this.activeInHierarchy) this.showHealth();
  }

  // Switched on again (a body brought back): the HUD is a service every player shares and holds what the last one told it.
  onEnable() {
    if (this.started) this.showHealth();
  }

  private bind() {
    this.health = this.entity.getComponent(Health);
    this.health.onChange.on(() => this.showHealth(), this);
    this.health.onDamaged.on(event => this.onHurt(event), this);
  }

  private showHealth() {
    this.hud.setHealth(this.health.current, this.health.maximum);
  }

  private onHurt(event: IDamageEvent) {
    this.hud.notifyDamaged(event.amount, this.sideOf(event));
    playSound(this.hurtSound);
  }

  // Which side the blow came from, in degrees from where the player looks (positive to the right, 180 behind): towards what dealt it, or back along the way a shot was going. A fall or a trap has neither.
  private sideOf(event: IDamageEvent): number | undefined {
    const here = this.entity.transform.globalPosition;
    let x = 0, z = 0;
    if (event.source) {
      const there = event.source.transform.globalPosition;
      x = there.x - here.x;
      z = there.z - here.z;
    } else if (event.direction) {
      x = -event.direction.x;
      z = -event.direction.z;
    }
    if (Math.hypot(x, z) < 0.01 || !this.eyes) return undefined;
    const look = this.eyes.transform.forward;
    // The right of a body that looks along +Z is -X: the angle from the look to the blow, turned the other way.
    const turn = Math.atan2(look.x, look.z) - Math.atan2(x, z);
    return Math.round(((turn * 180 / Math.PI + 540) % 360) - 180);
  }
}
