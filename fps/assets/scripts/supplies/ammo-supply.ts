import { Inject, Int, Script, String } from '@brave/core';
import { Inventory } from '../../services/inventory.service';
import { Supply } from './supply';

/** A box of rounds: it goes to the Inventory under its `Ammo Type`, up to the limit the weapons that fire it set (their `Reserve Limit`). A player that cannot carry more leaves it where it is (E on it says the ammo is full). */
@Script({ inheritProperties: true })
export class AmmoSupply extends Supply {

  prompt = 'Take {amount} rounds';
  message = '+{amount} rounds';
  fullMessage = 'Ammo full';

  @String({ header: 'Ammo', label: 'Ammo Type', tooltip: 'The item of the Inventory the rounds are: the Ammo Type of the weapons that fire them.' }) ammoType = 'ammo-rifle';
  @Int({ label: 'Rounds', tooltip: 'How many rounds it gives.' }) rounds = 30;

  @Inject(Inventory) inventory!: Inventory;

  protected give(): number {
    const before = this.inventory.count(this.ammoType);
    this.inventory.add(this.ammoType, '', this.rounds);
    return this.inventory.count(this.ammoType) - before;
  }

  protected promptAmount(): number {
    return this.rounds;
  }
}
