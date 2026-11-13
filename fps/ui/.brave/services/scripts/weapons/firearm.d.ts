import { Entity } from '@brave/core';
import { Inventory } from '../../services/inventory.service';
import { Gear } from '../gear/gear';
/** The crosshair a firearm has: a centre and four ticks (`dot`), a ring of four arcs round a dot (`arcs`), or two arcs, one each side of a dot, with a thin arc outside each (`twin-arcs`, the shotgun's): the arcs open with the spread, so they show where the pellets may go. */
export type CrosshairStyle = 'dot' | 'arcs' | 'twin-arcs';
/**
 * One weapon the player can carry: its numbers, its parts and the rounds it holds. It is a `Gear`, on the weapon's own entity, a child of the entity in the right hand that the `Loadout` reads (the model,
 * the `Muzzle` and the `Grip Left` are its children), and does nothing by itself: the `Weapon` on the player reads the one in hand and fires it, reloads it and aims it, and keeps what each of them holds.
 *
 * A new weapon is a copy of one of these entities with other numbers and another model (keep `Muzzle` at the end of the barrel and `Grip Left` where the left hand goes); its `Slot` is the key that
 * takes it in hand.
 */
export declare class Firearm extends Gear {
    label: string;
    muzzle?: Entity;
    shotSound?: Entity;
    dryFireSound?: Entity;
    magazineOutSound?: Entity;
    magazineInSound?: Entity;
    boltSound?: Entity;
    roundsPerMinute: number;
    pellets: number;
    damage: number;
    range: number;
    automatic: boolean;
    spreadStill: number;
    spreadMoving: number;
    spreadAir: number;
    spreadTime: number;
    crosshair: CrosshairStyle;
    ammoType: string;
    magazineSize: number;
    startingReserve: number;
    reserveLimit: number;
    reloadTime: number;
    cameraKick: number;
    flashSeconds: number;
    aimFieldOfView: number;
    aimTime: number;
    aimSpreadScale: number;
    aimSide: number;
    aimLower: number;
    aimBack: number;
    aimTilt: number;
    protected crosshairOptions: {
        value: string;
        description: string;
    }[];
    /** Rounds in the magazine. In a save, not in the scene file. */
    ammo: number;
    inventory: Inventory;
    /** Where the point the left hand reaches was authored, in its parent's space: the `Weapon Stance` poses it from here every frame, so it is read once. In a save, so that it is never read from a posed pose. */
    authoredGrip: number[];
    /** Rounds of the Ammo Type in the Inventory, besides the magazine: weapons of one type draw from the same. */
    get reserve(): number;
    set reserve(value: number);
    /** The game starts (the `Loadout` asks every gear): the Ammo Type is made known to the Inventory (its limit, left out of the list the HUD shows, its starting reserve given once) and the magazine is full. */
    prepare(): void;
    /** A full magazine and the starting reserve: what the weapon has when the player is back from the dead. */
    refill(): void;
}
