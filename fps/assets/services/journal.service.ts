import { AssetSystem, AudioMixerSystem, AudioSystem, BraveEngine, BraveEngineModeEnum, Cursor, Inject, Input, Service, Signal, UISystem } from '@brave/core';
import { Hud } from './hud.service';
import { Inventory } from './inventory.service';
import { PauseMenu } from './pause-menu.service';

/** How an entry stands: an objective is active, done or failed; an access (a key, a card) is unused or used; a note and an item have no status. */
export type JournalStatus = '' | 'active' | 'done' | 'failed' | 'unused' | 'used';

/** One thing the player knows: a note read, an audio log heard, a password found, an access carried, an objective given. */
export interface IJournalEntry {
  id: string;
  category: string;
  title: string;
  body: string;
  /** The asset id of the sound of an audio log; empty for the rest. */
  audio: string;
  status: JournalStatus;
  /** Not looked at yet. */
  isNew: boolean;
  /** An item the player carries: how many, and the most it can carry (0: no limit). Left out of everything else. */
  count?: number;
  limit?: number;
}

export interface IJournalCategory {
  id: string;
  name: string;
  count: number;
  news: number;
}

/** What the page shows: the menu's name, whether it is open, the categories that have something, the one shown with its entries and the one chosen. */
export interface IJournalState {
  open: boolean;
  title: string;
  categories: IJournalCategory[];
  category: string;
  entries: IJournalEntry[];
  selected: string;
  /** The id of the entry whose audio plays, or empty. */
  playing: string;
  /** How many entries have not been looked at, in all the categories. */
  news: number;
  /** How long the chip in the corner stays when something new goes in: 0, it is always there. */
  hintSeconds: number;
}

/** What a script tells `add()`. */
export interface IJournalEntryInput {
  id: string;
  category: string;
  title: string;
  body?: string;
  audio?: string;
  status?: JournalStatus;
}

// The categories the menu knows by name, in the order it lists them; any other category a script uses is listed after them, by its id.
const CATEGORIES = [
  { id: 'objectives', name: 'Objectives' },
  { id: 'items', name: 'Items' },
  { id: 'access', name: 'Access' },
  { id: 'passwords', name: 'Passwords' },
  { id: 'notes', name: 'Notes' },
  { id: 'audio', name: 'Audio Logs' },
];

// The categories listed newest first: the goals pile up, and the latest one is the one on top. The others are listed in the order they were found.
const NEWEST_FIRST = ['objectives'];

/**
 * What the player has found out, to look at again whenever it likes: the notes it read, the audio logs it heard, the passwords it found, the access (keys, cards) it carries and whether it used them yet,
 * the objectives it was given. The things it carries are the `Inventory`'s (a key card is an item there, and here an entry that says whether it was used), and the menu shows them too, in its Items category: the
 * list the HUD shows for a moment when it changes, always there to look at. That category is only a view of the Inventory (an item the Journal has an entry for, such as an access, stays in its own category, and
 * the ones the Inventory hides, the ammo, the grenades, are not listed): nothing is written into it, so it needs nothing from the pickups but the name and the description they gave the Inventory.
 *
 * Tab opens it (and closes it): a menu page of `ui/` with the categories on the left, the entries of one in the middle, and the one chosen on the right, which is the text of a note, or the play button of an
 * audio log. The pointer is let go while it is open and held again when it closes. The game stands still behind it (`pausesGame`; off, it goes on). The menu has a name that only the game cares about
 * (`title`: Journal here, Datapad or Notebook in another game): a `JournalMenu` in the scene sets it.
 *
 * An audio log plays through the mixer's master and not through an Audio Source, so that it goes on playing while the game is paused.
 *
 * ```ts
 * @Inject(Journal) journal!: Journal;
 * this.journal.add({ id: 'note-1', category: 'notes', title: 'A torn page', body: 'Do not go down to the cellar.' });
 * this.journal.objective('power', 'Restore the power', 'The cell is in the cabinet.');
 * this.journal.complete('power');
 * ```
 */
@Service()
export class Journal {

  @Inject(Hud) hud!: Hud;
  @Inject(Inventory) inventory!: Inventory;
  @Inject(PauseMenu) pauseMenu!: PauseMenu;

  /** What the menu is called, on the page and in the messages. */
  title = 'Journal';

  /** How long the chip in the corner stays on the screen when something new goes in (0: it is always there). */
  hintSeconds = 5;

  /** On: the game stands still while it is open. Off: it goes on behind it. */
  pausesGame = true;

  /** The whole state, a new object each time (the Bridge only sends what is not `===` the last). */
  onChange = new Signal<IJournalState>();

  private entries: IJournalEntry[] = [];
  private category = '';
  private selected = '';
  private isOpen = false;
  private pausedByJournal = false;
  private playing = '';
  private source?: AudioBufferSourceNode;
  private readonly buffers = new Map<string, AudioBuffer>();
  private tabListener?: Parameters<typeof Input.removeListner>[0];
  private escapeListener?: Parameters<typeof Input.removeListner>[0];
  // The Inventory is a service that is not registered yet while this one is being made (its first `state` is built then): it is read from the start on.
  private started = false;

  state: IJournalState = this.snapshot();

  onStart() {
    this.started = true;
    this.inventory.onChange.on(() => this.changed(), this);
    this.tabListener = Input.keyboard.tab.down((event: KeyboardEvent) => {
      event.preventDefault();
      this.toggle();
    });
    // Esc closes it too (the pointer is already let go while it is open, so the browser keeps the key for the page).
    this.escapeListener = Input.keyboard.escape.down(() => { if (this.isOpen) this.close(Cursor.escapeIsOurs); });
  }

  onDestroy() {
    this.started = false;
    if (this.tabListener) Input.removeListner(this.tabListener);
    this.tabListener = undefined;
    if (this.escapeListener) Input.removeListner(this.escapeListener);
    this.escapeListener = undefined;
    this.stop();
    this.isOpen = false;
    this.pausedByJournal = false;
  }

  /** What a `JournalMenu` sets: the name of the menu, whether it pauses the game, how long its chip stays and how long the list of what is carried stays on the screen when it changes. */
  configure(settings: { title?: string; pausesGame?: boolean; hintSeconds?: number; itemsSeconds?: number }): void {
    if (settings.title) this.title = settings.title;
    if (settings.itemsSeconds !== undefined) this.hud.setItemsSeconds(settings.itemsSeconds);
    if (settings.hintSeconds !== undefined && Number.isFinite(settings.hintSeconds)) this.hintSeconds = Math.max(settings.hintSeconds, 0);
    if (settings.pausesGame !== undefined) this.pausesGame = settings.pausesGame;
    this.changed();
  }

  //#region Writing
  /** Puts what the player found in the Journal, once: an id that is in it already is left as it was. Says so on the screen. Returns whether it was new. */
  add(entry: IJournalEntryInput, announce = true): boolean {
    if (!entry.id || this.has(entry.id)) return false;

    this.entries.push({ id: entry.id, category: entry.category, title: entry.title, body: entry.body ?? '', audio: entry.audio ?? '', status: entry.status ?? '', isNew: true });
    if (announce) this.hud.showMessage(`${this.title} updated: ${entry.title}`);
    this.changed();
    return true;
  }

  /** An objective the player is given, active: the title it reads and what it says. */
  objective(id: string, title: string, body = ''): boolean {
    return this.add({ id, category: 'objectives', title, body, status: 'active' });
  }

  complete(id: string): void {
    this.setStatus(id, 'done');
  }

  fail(id: string): void {
    this.setStatus(id, 'failed');
  }

  /** An access (a key, a card) that was used. Nothing for an id that is not there. */
  markUsed(id: string): void {
    if (this.entries.find(entry => entry.id === id)?.category === 'access') this.setStatus(id, 'used');
  }

  setStatus(id: string, status: JournalStatus): void {
    const entry = this.entries.find(candidate => candidate.id === id);
    if (!entry || entry.status === status) return;
    entry.status = status;
    if (!this.isOpen) entry.isNew = true;
    this.changed();
  }
  //#endregion Writing

  //#region Reading
  has(id: string): boolean {
    return this.entries.some(entry => entry.id === id);
  }

  statusOf(id: string): JournalStatus {
    return this.entries.find(entry => entry.id === id)?.status ?? '';
  }

  /** A copy of every entry. */
  list(): IJournalEntry[] {
    return this.entries.map(entry => ({ ...entry }));
  }
  //#endregion Reading

  //#region The menu
  /** Opens the menu, on an entry when one is given. Not while the pause menu is open or when the game is not running. */
  open(entryId?: string): void {
    const mode = BraveEngine.mode;
    if (this.isOpen || this.pauseMenu.state.open || (mode !== BraveEngineModeEnum.Running && mode !== BraveEngineModeEnum.Paused)) return;

    const entry = entryId ? this.entries.find(candidate => candidate.id === entryId) : undefined;
    if (entry) {
      this.category = entry.category;
      this.selected = entry.id;
    }

    this.isOpen = true;
    UISystem.interactive = true;
    if (this.pausesGame && mode === BraveEngineModeEnum.Running) {
      BraveEngine.pause();
      this.pausedByJournal = true;
    }
    // The pointer is let go on purpose: the pause menu must not take it for the player's Esc (and must not, whatever the browser sends about the pointer while this is open).
    this.pauseMenu.expectRelease();
    if (Cursor.isLocked) Cursor.unlock();
    this.markSeen();
    this.changed();
  }

  /** Closes it, gives the game back and asks for the pointer again (the key or the click that made this call counts as the player's, so the browser lets it). Esc passes `false`: a browser that grants the pointer at an Esc
   * takes the same Esc as the key that lets it go, and the pause menu would open for that; the next click holds it. In fullscreen Esc is the game's (`Cursor.escapeIsOurs`) and the pointer is taken back at once. */
  close(lockPointer = true): void {
    if (!this.isOpen) return;

    this.isOpen = false;
    // The page lets go of the keyboard: a button of the menu that was clicked would keep it, and the player could not walk.
    UISystem.interactive = false;
    this.stop();
    if (this.pausedByJournal && BraveEngine.mode === BraveEngineModeEnum.Paused) BraveEngine.play();
    this.pausedByJournal = false;
    if (lockPointer) void Cursor.lock();
    this.changed();
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  /** The page chose a category. */
  select(category: string): void {
    this.category = category;
    this.selected = '';
    this.markSeen();
    this.changed();
  }

  /** The page chose an entry. */
  choose(id: string): void {
    this.selected = id;
    this.markSeen();
    this.changed();
  }
  //#endregion The menu

  //#region Audio logs
  /** Plays the sound of an entry (the one that plays stops). It goes on while the game is paused. */
  async play(id: string): Promise<void> {
    const entry = this.entries.find(candidate => candidate.id === id);
    if (!entry?.audio) return;

    this.stop();
    const buffer = await this.decode(entry.audio);
    if (!buffer || !this.isOpen) return;

    const node = AudioSystem.context.createBufferSource();
    node.buffer = buffer;
    node.connect(AudioMixerSystem.masterInput);
    node.onended = () => {
      if (this.source !== node) return;
      this.source = undefined;
      this.playing = '';
      this.changed();
    };
    this.source = node;
    this.playing = id;
    node.start();
    this.changed();
  }

  stop(): void {
    const node = this.source;
    this.source = undefined;
    if (node) {
      node.onended = null;
      try { node.stop(); } catch { /* it had ended */ }
      node.disconnect();
    }
    if (!this.playing) return;
    this.playing = '';
    this.changed();
  }

  private async decode(assetId: string): Promise<AudioBuffer | undefined> {
    const known = this.buffers.get(assetId);
    if (known) return known;

    try {
      const asset = await AssetSystem.load(assetId);
      if (!asset) return undefined;
      // `decodeAudioData` takes the bytes it is given, and the asset's own are shared: it gets a copy.
      const buffer = await AudioSystem.context.decodeAudioData(asset.toArrayBuffer().slice(0));
      this.buffers.set(assetId, buffer);
      return buffer;
    } catch (error) {
      console.warn(`[Journal] could not play "${assetId}":`, error);
      return undefined;
    }
  }
  //#endregion Audio logs

  onSave(): { entries: IJournalEntry[] } {
    return { entries: this.list() };
  }

  onRestore(data: { entries: IJournalEntry[] }): void {
    this.entries = (data?.entries ?? []).map(entry => ({ ...entry }));
    this.changed();
  }

  // What is on the screen counts as looked at: the entry chosen, while the menu is open.
  private markSeen(): void {
    const shown = this.snapshot();
    const entry = this.entries.find(candidate => candidate.id === shown.selected);
    if (this.isOpen && entry) entry.isNew = false;
  }

  // What the player carries, as entries of the Items category: the visible kinds that the Journal has no entry for already. Never new: the HUD told the player when it came.
  private carried(): IJournalEntry[] {
    if (!this.started) return [];

    return this.inventory.list()
      .filter(item => !item.hidden && !this.has(item.id))
      .map(item => ({ id: item.id, category: 'items', title: item.name.charAt(0).toUpperCase() + item.name.slice(1), body: item.description, audio: '', status: '' as JournalStatus, isNew: false, count: item.count, limit: item.limit }));
  }

  private snapshot(): IJournalState {
    const everything = [...this.entries, ...this.carried()];
    const ids = [...CATEGORIES.map(category => category.id), ...everything.map(entry => entry.category)].filter((id, index, all) => all.indexOf(id) === index && everything.some(entry => entry.category === id));
    const categories = ids.map(id => {
      const own = everything.filter(entry => entry.category === id);
      return { id, name: CATEGORIES.find(category => category.id === id)?.name ?? id.charAt(0).toUpperCase() + id.slice(1), count: own.length, news: own.filter(entry => entry.isNew).length };
    });
    const category = categories.some(candidate => candidate.id === this.category) ? this.category : categories[0]?.id ?? '';
    const own = everything.filter(entry => entry.category === category);
    const entries = (NEWEST_FIRST.includes(category) ? own.reverse() : own).map(entry => ({ ...entry }));
    const selected = entries.some(entry => entry.id === this.selected) ? this.selected : entries[0]?.id ?? '';
    return { open: this.isOpen, title: this.title, categories, category, entries, selected, playing: this.playing, news: this.entries.filter(entry => entry.isNew).length, hintSeconds: this.hintSeconds };
  }

  private changed(): void {
    this.state = this.snapshot();
    this.onChange.emit(this.state);
  }
}
