import { Entity } from '@brave/core';
import { Supply } from './supply';
/** A first aid kit: it heals what the player lacks, up to the maximum. A player at full health leaves it where it is. */
export declare class HealthSupply extends Supply {
    message: string;
    amount: number;
    protected give(player: Entity): number;
}
