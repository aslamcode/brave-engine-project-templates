import { IEntity, Signal } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Inventory } from '../../services/inventory.service';
import { Journal } from '../../services/journal.service';
import { Objective } from '../journal/objective';
import { Interactable } from './interactable';
import type { Interactor } from './interactor';
/**
 * A place where an item goes: the slot for a power cell, the keyhole of a gate. It accepts the item `Item Id`. While the player does not carry it the prompt says what is missing
 * (`Needs Prompt`) and E gives the dull click; while it does the prompt is `Prompt` ("Place power cell") and E takes the item out of the inventory and fills the socket.
 *
 * It can take several things, one console for a puzzle of five pieces: `Item Id` is then the ids separated by commas (`piece-1, piece-2, piece-3, piece-4, piece-5`), and `fuse x3` asks for three of one kind.
 * E puts in what the player carries of what is still missing, so a piece found later goes in later: the prompts say what is next and how far it is (`Needs Piece 3 (2 of 5)`, `Place Piece 3 (2 of 5)`), and
 * the socket is filled, with all of what follows, when the last one is in:
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
    private slotted;
    get currentPrompt(): string;
    get usable(): boolean;
    /** How many of the things it asks for are in. */
    get itemsIn(): number;
    protected onUse(interactor: Interactor): void;
    private get parts();
    private get progress();
    private carriedNeeded;
    private namesOf;
}
