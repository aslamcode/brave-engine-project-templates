import { Entity, Float, JsonIgnore, Ref, Saved, Script, ScriptComponent, State, Time } from '@brave/core';
import { Health } from '../health/health';
import { playSound } from '../shared/sound';

/**
 * A target for practice: it does not move or hit back, it squashes when it is shot, falls over when it dies and stands up again `Stand Up After` seconds later with full health. The hit zones are
 * `Hitbox` components on colliders below it, as on an `EnemyCube`.
 */
@Script()
export class TargetDummy extends ScriptComponent {

  private static readonly FALL_SECONDS = 0.3;

  @Float({ header: 'Dummy', label: 'Stand Up After', suffix: 's' }) standUpAfter = 3;
  @Ref(Entity, { label: 'Visual', tooltip: 'The entity that holds the meshes: it squashes when hurt and falls when the dummy dies.' }) visual?: Entity;
  @Ref(Entity, { label: 'Hit Sound' }) hitSound?: Entity;

  @State() @JsonIgnore() @Saved() isDown = false;

  @JsonIgnore() private health!: Health;
  @JsonIgnore() @Saved() private downTime = 0;
  @JsonIgnore() private squash = 0;
  @JsonIgnore() private angle = 0;

  onStart() {
    this.bind();
  }

  // A save brings the component back as it was, started: the listeners are made again.
  onRestore() {
    this.bind();
  }

  onUpdate() {
    const deltaTime = Time.deltaTime;
    this.squash = Math.max(0, this.squash - deltaTime * 4);
    if (this.isDown) {
      this.downTime += deltaTime;
      if (this.downTime >= this.standUpAfter) {
        this.isDown = false;
        this.health.revive();
      }
    }
    if (!this.visual) return;

    // It falls back over a moment and comes upright over the same.
    const step = 90 / TargetDummy.FALL_SECONDS * deltaTime;
    const wanted = this.isDown ? -90 : 0;
    this.angle += Math.max(-step, Math.min(step, wanted - this.angle));
    this.visual.transform.rotation.x = this.angle;
    const scale = this.visual.transform.scale;
    scale.x = scale.z = 1 + this.squash * 0.1;
    scale.y = 1 - this.squash * 0.15;
  }

  private bind() {
    this.health = this.entity.getComponent(Health);
    this.health.onDamaged.on(() => this.onHurt(), this);
    this.health.onDied.on(() => { this.isDown = true; this.downTime = 0; }, this);
  }

  private onHurt() {
    this.squash = 1;
    playSound(this.hitSound);
  }
}
