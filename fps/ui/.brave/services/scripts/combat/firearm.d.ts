import { Entity, ScriptComponent } from '@brave/core';
/** The crosshair a firearm has: a centre and four ticks, or two arcs and a small ring (the shotgun's: the arcs open with the spread, so they show where the pellets may go). */
export type CrosshairStyle = 'dot' | 'arcs';
/**
 * One weapon the player can carry: its numbers, its parts and the rounds it holds. It sits on the weapon's own entity, a child of the `Weapons` entity in the right hand (the model, the `Muzzle` and the
 * `Grip Left` are its children), and does nothing by itself: the `Weapon` on the player reads the one in hand and fires it, reloads it and aims it, and keeps what each of them holds.
 *
 * A new weapon is a copy of one of these entities with other numbers and another model (keep `Muzzle` at the end of the barrel and `Grip Left` where the left hand goes); its `Slot` is the key that
 * takes it in hand.
 */
export declare class Firearm extends ScriptComponent {
    label: string;
    slot: number;
    muzzle?: Entity;
    gripLeft?: Entity;
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
    magazineSize: number;
    startingReserve: number;
    reloadTime: number;
    cameraKick: number;
    flashSeconds: number;
    aimFieldOfView: number;
    aimTime: number;
    aimSpreadScale: number;
    aimSide: number;
    aimLower: number;
    aimBack: number;
    protected crosshairOptions: {
        value: string;
        description: string;
    }[];
    /** Rounds in the magazine and in reserve. In a save, not in the scene file. */
    ammo: number;
    reserve: number;
    /** Where the point the left hand reaches was authored, in its parent's space: the `Weapon Stance` poses it from here every frame, so it is read once. In a save, so that it is never read from a posed pose. */
    authoredGrip: number[];
    /** A full magazine and the starting reserve: what the weapon has when the game starts, and when the player is back from the dead. */
    refill(): void;
}
