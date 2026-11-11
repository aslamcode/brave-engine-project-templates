import { Signal } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Inventory } from '../../services/inventory.service';
import { Interactable } from './interactable';
import type { Interactor } from './interactor';
/**
 * An item the player collects with E: it goes into the `Inventory` under `Item Id` (what a locked `Door` or a `Socket` asks for), the `Hud` says so, a sound is heard, and its entity is switched
 * off, with nothing in between: no animation, it is simply gone. (A script that wants one listens to `onPickedUp`.) The entity needs a collider for the player to look at; the model can be
 * its children.
 *
 * The sound comes from the player (the Interactor's Audio Source), not from the item: the item's own entity is off the moment it is taken, and takes its Audio Source with it.
 */
export declare class Pickup extends Interactable {
    prompt: string;
    itemId: string;
    itemName: string;
    count: number;
    message: string;
    pickupSound: string;
    inventory: Inventory;
    hud: Hud;
    /** It was taken: the Interactor that took it. */
    onPickedUp: Signal<Interactor>;
    onStart(): void;
    get currentPrompt(): string;
    protected onUse(interactor: Interactor): void;
    private get label();
}
