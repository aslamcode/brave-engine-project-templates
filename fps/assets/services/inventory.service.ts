import { Inject, Service, Signal } from '@brave/core';
import { Hud } from './hud.service';

/** What the player carries of one kind: the id a script asks for, the name the player reads, how many, the most that can be carried (0: no limit) and whether it is left out of the list the HUD shows. */
export interface IInventoryEntry {
  id: string;
  name: string;
  count: number;
  limit: number;
  hidden: boolean;
}

/** What a kind of item is, as whoever knows it says (a weapon says what its rounds are, a pickup what it is). Every field is optional. */
export interface IItemDefinition {
  /** What the player reads. */
  name?: string;
  /** The most that can be carried: 0 or left out, no limit (credits, keys). */
  limit?: number;
  /** Left out of the list the HUD shows (rounds are in the ammo counter, not in the list). */
  hidden?: boolean;
  /** How many the player starts the game with: given once per game, the first time the kind is defined. */
  start?: number;
}

interface IKind {
  name: string;
  limit: number;
  hidden: boolean;
}

/**
 * What the player carries: a count for each item id (`'key'`, `'power-cell'`, `'ammo-rifle'`), and the name to show for it. A `Pickup` adds, a `Socket` removes, a locked `Door` asks `has('key')`, a
 * `Firearm` draws its reserve from its `ammoType`. A kind may have a LIMIT (the most that can be carried: 0 is none, as credits or keys have) and may be HIDDEN from the list the HUD shows. It keeps
 * the `Hud` up to date (`hud.setItems`: one line for each visible kind, with the count when there is more than one), and a game save keeps it (`onSave` / `onRestore`).
 *
 * Whoever knows a kind says what it is, with `define()`: the first thing that starts is enough (a weapon for its rounds, a pickup for its item). The rest of the game only uses the id.
 *
 * ```ts
 * @Inject(Inventory) inventory!: Inventory;
 * ...
 * this.inventory.define('grenade', { name: 'Grenade', limit: 4 });
 * if (this.inventory.has('key')) this.inventory.remove('key');
 * ```
 */
@Service()
export class Inventory {

  @Inject(Hud) hud!: Hud;

  /** Something was added or removed: the whole list as it is now. */
  onChange = new Signal<IInventoryEntry[]>();

  private readonly entries = new Map<string, { id: string; name: string; count: number }>();
  private readonly kinds = new Map<string, IKind>();
  // The kinds whose starting count was given in this game: a kind defined again (a second weapon, a game that was loaded) is not given it again.
  private readonly started = new Set<string>();

  /** Says what a kind of item is. A kind that has a `start` is given that many, once per game. Defining again changes what is given (the limit), never the count. */
  define(id: string, definition: IItemDefinition = {}): void {
    if (!id) return;

    const kind = this.kinds.get(id) ?? { name: '', limit: 0, hidden: false };
    if (definition.name) kind.name = definition.name;
    if (definition.limit !== undefined) kind.limit = Math.max(Math.floor(definition.limit), 0);
    if (definition.hidden !== undefined) kind.hidden = definition.hidden;
    this.kinds.set(id, kind);

    if ((definition.start ?? 0) > 0 && !this.started.has(id)) {
      this.started.add(id);
      this.add(id, '', definition.start);
    } else {
      this.changed();
    }
  }

  /** Adds `count` of an item, up to its limit. `name` is what the player reads (the id when none is given); the last name given for an id is kept. Returns how many there are now. */
  add(id: string, name = '', count = 1): number {
    if (!id || count <= 0) return this.count(id);

    const added = Math.min(Math.floor(count), this.room(id));
    if (name) this.kind(id).name = name;
    if (added <= 0) return this.count(id);

    const entry = this.entries.get(id) ?? { id, name: this.nameOf(id), count: 0 };
    entry.count += added;
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

  /** Makes the count of an item exactly `count`, up to its limit (a respawn gives the starting rounds back; nothing is added to what there was). */
  set(id: string, count: number): void {
    if (!id) return;

    const wanted = Math.max(Math.floor(Number.isFinite(count) ? count : 0), 0);
    const limit = this.limitOf(id);
    const exactly = limit > 0 ? Math.min(wanted, limit) : wanted;
    if (exactly === this.count(id)) return;

    if (exactly <= 0) this.entries.delete(id);
    else this.entries.set(id, { id, name: this.nameOf(id), count: exactly });
    this.changed();
  }

  has(id: string, count = 1): boolean {
    return this.count(id) >= count;
  }

  count(id: string): number {
    return this.entries.get(id)?.count ?? 0;
  }

  /** The most of an item that can be carried; 0 when there is no limit. */
  limitOf(id: string): number {
    return this.kinds.get(id)?.limit ?? 0;
  }

  /** How many more of an item fit: no end (`Infinity`) when it has no limit. */
  room(id: string): number {
    const limit = this.limitOf(id);
    return limit > 0 ? Math.max(limit - this.count(id), 0) : Number.POSITIVE_INFINITY;
  }

  /** The name the player reads for an id: the one it was defined or last picked up with, or the id. */
  nameOf(id: string): string {
    return this.kinds.get(id)?.name || this.entries.get(id)?.name || id;
  }

  /** One line for each visible kind carried, in the order they were first picked up: the name, and `x2` after it when there is more than one. */
  names(): string[] {
    return this.list().filter(entry => !entry.hidden).map(entry => {
      const name = entry.name.charAt(0).toUpperCase() + entry.name.slice(1);
      return entry.count > 1 ? `${name} x${entry.count}` : name;
    });
  }

  /** A copy of what is carried. */
  list(): IInventoryEntry[] {
    return [...this.entries.values()].map(entry => ({ ...entry, name: this.nameOf(entry.id), limit: this.limitOf(entry.id), hidden: this.kinds.get(entry.id)?.hidden ?? false }));
  }

  /** Empties it (a new game): what the kinds are is kept, and they are given their starting count again. */
  clear(): void {
    this.entries.clear();
    this.started.clear();
    this.changed();
  }

  onSave(): { entries: { id: string; name: string; count: number }[]; started: string[] } {
    return { entries: [...this.entries.values()].map(entry => ({ ...entry })), started: [...this.started] };
  }

  onRestore(data: { entries: { id: string; name: string; count: number }[]; started?: string[] }): void {
    this.entries.clear();
    (data?.entries ?? []).forEach(entry => this.entries.set(entry.id, { id: entry.id, name: entry.name, count: entry.count }));
    this.started.clear();
    (data?.started ?? []).forEach(id => this.started.add(id));
    this.changed();
  }

  private kind(id: string): IKind {
    let kind = this.kinds.get(id);
    if (!kind) this.kinds.set(id, kind = { name: '', limit: 0, hidden: false });
    return kind;
  }

  private changed(): void {
    this.hud.setItems(this.names());
    this.onChange.emit(this.list());
  }
}
