import { Signal } from '@brave/core';
import { Hud } from './hud.service';
/** What the player carries, kind by kind: the id a script asks for, the name the player reads, and how many. */
export interface IInventoryEntry {
    id: string;
    name: string;
    count: number;
}
/**
 * What the player carries: a count for each item id (`'key'`, `'power-cell'`), and the name to show for it. A `Pickup` adds, a `Socket` removes, a locked `Door` asks `has('key')`. It keeps the
 * `Hud` up to date (`hud.setItems`: one line for each kind, with the count when there is more than one), and a game save keeps it (`onSave` / `onRestore`).
 *
 * ```ts
 * @Inject(Inventory) inventory!: Inventory;
 * ...
 * if (this.inventory.has('key')) this.inventory.remove('key');
 * ```
 */
export declare class Inventory {
    hud: Hud;
    /** Something was added or removed: the whole list as it is now. */
    onChange: Signal<IInventoryEntry[]>;
    private readonly entries;
    /** Adds `count` of an item. `name` is what the player reads (the id when none is given); the last name given for an id is kept. Returns how many there are now. */
    add(id: string, name?: string, count?: number): number;
    /** Takes `count` of an item away. Returns whether there were that many (when there were not, nothing is taken). */
    remove(id: string, count?: number): boolean;
    has(id: string, count?: number): boolean;
    count(id: string): number;
    /** The name the player reads for an id: the one the last pickup gave, or the id. */
    nameOf(id: string): string;
    /** One line for each kind carried, in the order they were first picked up: the name, and `x2` after it when there is more than one. */
    names(): string[];
    /** A copy of what is carried. */
    list(): IInventoryEntry[];
    /** Empties it (a new game). */
    clear(): void;
    onSave(): {
        entries: IInventoryEntry[];
    };
    onRestore(data: {
        entries: IInventoryEntry[];
    }): void;
    private changed;
}
