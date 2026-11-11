import { Inject, Service, Signal } from '@brave/core';
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
@Service()
export class Inventory {

  @Inject(Hud) hud!: Hud;

  /** Something was added or removed: the whole list as it is now. */
  onChange = new Signal<IInventoryEntry[]>();

  private readonly entries = new Map<string, IInventoryEntry>();

  /** Adds `count` of an item. `name` is what the player reads (the id when none is given); the last name given for an id is kept. Returns how many there are now. */
  add(id: string, name = '', count = 1): number {
    if (!id || count <= 0) return this.count(id);

    const entry = this.entries.get(id) ?? { id, name: name || id, count: 0 };
    if (name) entry.name = name;
    entry.count += count;
    this.entries.set(id, entry);
    this.changed();
    return entry.count;
  }

  /** Takes `count` of an item away. Returns whether there were that many (when there were not, nothing is taken). */
  remove(id: string, count = 1): boolean {
    const entry = this.entries.get(id);
    if (!entry || entry.count < count) return false;

    entry.count -= count;
    if (entry.count <= 0) this.entries.delete(id);
    this.changed();
    return true;
  }

  has(id: string, count = 1): boolean {
    return this.count(id) >= count;
  }

  count(id: string): number {
    return this.entries.get(id)?.count ?? 0;
  }

  /** The name the player reads for an id: the one the last pickup gave, or the id. */
  nameOf(id: string): string {
    return this.entries.get(id)?.name ?? id;
  }

  /** One line for each kind carried, in the order they were first picked up: the name, and `x2` after it when there is more than one. */
  names(): string[] {
    return this.list().map(entry => {
      const name = entry.name.charAt(0).toUpperCase() + entry.name.slice(1);
      return entry.count > 1 ? `${name} x${entry.count}` : name;
    });
  }

  /** A copy of what is carried. */
  list(): IInventoryEntry[] {
    return [...this.entries.values()].map(entry => ({ ...entry }));
  }

  /** Empties it (a new game). */
  clear(): void {
    this.entries.clear();
    this.changed();
  }

  onSave(): { entries: IInventoryEntry[] } {
    return { entries: this.list() };
  }

  onRestore(data: { entries: IInventoryEntry[] }): void {
    this.entries.clear();
    (data?.entries ?? []).forEach(entry => this.entries.set(entry.id, { ...entry }));
    this.changed();
  }

  private changed(): void {
    this.hud.setItems(this.names());
    this.onChange.emit(this.list());
  }
}
