import { Entity, Float, Script } from '@brave/core';
import { Health } from '../health/health';
import { Supply } from './supply';

/** A first aid kit: it heals what the player lacks, up to the maximum. A player at full health leaves it where it is. */
@Script({ inheritProperties: true })
export class HealthSupply extends Supply {

  prompt = 'Use first aid kit (+{amount} HP)';
  message = '+{amount} health';
  fullMessage = 'Health full';

  @Float({ header: 'Health', label: 'Amount', suffix: 'HP', tooltip: 'How much it heals.' }) amount = 35;

  protected give(player: Entity): number {
    const health = Health.find(player);
    if (!health || health.isDead || health.current >= health.maximum) return 0;
    const before = health.current;
    health.heal(this.amount);
    return health.current - before;
  }

  protected promptAmount(): number {
    return this.amount;
  }
}
