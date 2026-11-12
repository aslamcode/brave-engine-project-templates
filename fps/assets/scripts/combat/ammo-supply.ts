import { Entity, Int, Script } from '@brave/core';
import { Supply } from './supply';
import { Weapon } from './weapon';

/** A box of rounds: it goes to the reserve of the weapon of `Slot` (0: the one in hand), up to that weapon's `Reserve Limit`. A player that cannot carry more leaves it where it is. */
@Script({ inheritProperties: true })
export class AmmoSupply extends Supply {

  message = '+{amount} rounds';

  @Int({ header: 'Ammo', label: 'Rounds', tooltip: 'How many rounds it gives.' }) rounds = 30;
  @Int({ label: 'Slot', tooltip: 'Which weapon gets them: its slot (1 to 9), or 0 for the one in hand.' }) slot = 0;

  protected give(player: Entity): number {
    return player.getComponent(Weapon)?.give(this.rounds, this.slot) ?? 0;
  }
}
