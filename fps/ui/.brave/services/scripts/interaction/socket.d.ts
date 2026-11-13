import { IEntity, Signal } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Inventory } from '../../services/inventory.service';
import { Journal } from '../../services/journal.service';
import { Objective } from '../journal/objective';
import { Interactable } from './interactable';
import type { Interactor } from './interactor';
/**
 * A place where one item goes: the slot for a power cell, the keyhole of a gate. It accepts the item `Item Id`. While the player does not carry it the prompt says what is missing
 * (`Needs Prompt`) and E gives the dull click; while it does the prompt is `Prompt` ("Place power cell") and E takes the item out of the inventory and fills the socket:
 *
 * - `Placed Object` (a child entity that starts switched off, the item as it looks in place) is switched on,
 * - the sound is played, `Filled Message` goes to the `Hud`, `onFilled` is emitted and `isFilled` is true from then on (a filled socket takes no more),
 * - `Target` (a `Door`, or anything else that is an `Interactable`) is unlocked and / or opened, and
 * - `Switch On` (a lamp, a light, a machine's entity) is switched on.
 *
 * `isFilled` is a `@State()` and `onFilled` a `Signal`, so a Director can wait for it too.
 */
export declare class Socket extends Interactable {
    prompt: string;
    itemId: string;
    itemName: string;
    needsPrompt: string;
    needsMessage: string;
    placed?: IEntity;
    switchOn?: IEntity;
    target?: Interactable;
    objective?: Objective;
    unlocksTarget: boolean;
    opensTarget: boolean;
    filledMessage: string;
    putSound: string;
    inventory: Inventory;
    hud: Hud;
    journal: Journal;
    /** The item is in: the Interactor that put it. */
    onFilled: Signal<Interactor>;
    isFilled: boolean;
    get currentPrompt(): string;
    get usable(): boolean;
    protected onUse(interactor: Interactor): void;
    private get has();
    private get label();
}
