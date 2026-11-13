import { Entity, Float, JsonIgnore, Saved, Script, ScriptComponent, Signal, State, Vector3 } from '@brave/core';

/** What a blow carries. Every field is optional: a fall or a trap has no source, an explosion no zone. */
export interface IDamageInfo {
  /** The name of the part that was hit (`Hitbox.zone`: head, body, ...). */
  zone?: string;
  /** Where it landed, in the world. */
  point?: Vector3;
  /** Which way it was going, a unit vector: what a knock-back or a blood spurt follows. */
  direction?: Vector3;
  /** Who dealt it. */
  source?: Entity;
}

/** What `Health.onDamaged` and `Health.onDied` tell. */
export interface IDamageEvent extends IDamageInfo {
  /** What was really taken: a blow past zero takes only what there was left. */
  amount: number;
  /** What is left. */
  health: number;
}

/**
 * Something that can be hurt and die: the player, an enemy, a dummy. It only keeps the number and tells; what dying looks like is the business of whoever listens (`EnemyCube`, `PlayerHealth`).
 * A `Hitbox` on a collider below this entity says where on it a shot landed, and `Health.find()` is how a shot finds the one to hurt.
 */
@Script()
export class Health extends ScriptComponent {

  /** The health of the thing the entity `hit` belongs to: the nearest `Health` on it or above it. A shot hits a collider on a child (a head, an arm) and the `Health` is on the root. */
  static find(entity?: Entity): Health | undefined {
    for (let current = entity; current; current = current.parent) {
      const health = current.getComponent(Health);
      if (health) return health;
    }
    return undefined;
  }

  @Float({ header: 'Health', label: 'Maximum', suffix: 'HP', tooltip: 'What it starts with and what `heal()` stops at.' }) maximum = 100;

  /** What is left. It starts at the maximum when the game does, and is not in the scene file: a save keeps it. */
  @JsonIgnore() @Saved() current = 0;
  @State() @JsonIgnore() @Saved() isDead = false;

  /** Told after any change of `current`, with the new value. */
  onChange = new Signal<number>();
  onDamaged = new Signal<IDamageEvent>();
  /** Told once, when a blow takes the last of it: after `onDamaged`, with the same event. */
  onDied = new Signal<IDamageEvent>();

  onAwake() {
    this.current = this.maximum;
    this.isDead = false;
  }

  /** Takes `amount` off (what `Hitbox.multiplier` already scaled). Returns what was really taken. Nothing happens to something that is dead. */
  damage(amount: number, info: IDamageInfo = {}): number {
    if (this.isDead || !(amount > 0)) return 0;
    const taken = Math.min(amount, this.current);
    this.current -= taken;
    const event: IDamageEvent = { ...info, amount: taken, health: this.current };
    this.onChange.emit(this.current);
    this.onDamaged.emit(event);
    if (this.current > 0) return taken;
    this.isDead = true;
    this.onDied.emit(event);
    return taken;
  }

  /** Gives health back, up to the maximum. Nothing for the dead: `revive()` is the way back. */
  heal(amount: number): void {
    if (this.isDead || !(amount > 0)) return;
    this.current = Math.min(this.maximum, this.current + amount);
    this.onChange.emit(this.current);
  }

  /** Back from the dead with the maximum. */
  revive(): void {
    this.isDead = false;
    this.current = this.maximum;
    this.onChange.emit(this.current);
  }
}
