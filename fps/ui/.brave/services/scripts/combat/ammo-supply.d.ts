import { Entity } from '@brave/core';
import { Supply } from './supply';
/** A box of rounds: it goes to the reserve of the weapon of `Slot` (0: the one in hand), up to that weapon's `Reserve Limit`. A player that cannot carry more leaves it where it is (E on it says the ammo is full). */
export declare class AmmoSupply extends Supply {
    prompt: string;
    message: string;
    fullMessage: string;
    rounds: number;
    slot: number;
    protected give(player: Entity): number;
    protected promptAmount(): number;
}
