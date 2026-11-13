import { Entity } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Inventory } from '../../services/inventory.service';
import { Gear } from './gear';
/**
 * A medical kit the player carries and has a number of: the left mouse button held heals, over `Use Time`, and spends one when it is done. The count is an item of the `Inventory` (`Item Id`: a
 * `Pickup` of that id gives more, up to the `Limit`). Letting go of the button, taking another gear or dying stops it, and nothing is spent. It does nothing
 * for a player at full health (it says so).
 *
 * It is the same medicine as a `HealthSupply` on the ground, carried: the supply heals on the spot with E, this is for later.
 */
export declare class Medkit extends Gear {
    label: string;
    slot: number;
    itemId: string;
    startingCount: number;
    limit: number;
    amount: number;
    useTime: number;
    useSound?: Entity;
    hud: Hud;
    inventory: Inventory;
    /** How far the button has held (0 to 1) while the player heals; 0 when it does not. */
    progress: number;
    private using;
    onStart(): void;
    onUpdate(): void;
    onRestore(): void;
    get caption(): string;
    prepare(): void;
    refill(): void;
    onBrought(): void;
    onPutAway(): void;
    showHud(): void;
    onPrimaryDown(): void;
    onPrimaryUp(): void;
    /** How many are carried. */
    get count(): number;
    private get health();
    private finish;
    private stop;
    private onCountChange;
}
