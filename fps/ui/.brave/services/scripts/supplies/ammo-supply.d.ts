import { Inventory } from '../../services/inventory.service';
import { Supply } from './supply';
/** A box of rounds: it goes to the Inventory under its `Ammo Type`, up to the limit the weapons that fire it set (their `Reserve Limit`). A player that cannot carry more leaves it where it is (E on it says the ammo is full). */
export declare class AmmoSupply extends Supply {
    prompt: string;
    message: string;
    fullMessage: string;
    ammoType: string;
    rounds: number;
    inventory: Inventory;
    protected give(): number;
    protected promptAmount(): number;
}
