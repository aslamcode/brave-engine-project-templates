import { BraveEngine, BraveEngineModeEnum, IGameSnapshot, Inject, Input, Invoke, ISaveMeta, SaveSystem, Service, Signal, Translate } from '@brave/core';
import { phrase } from '../scripts/shared/phrase';
import { Hud } from './hud.service';
import { PauseMenu } from './pause-menu.service';

/** One place the game can be saved to, as the menu page shows it. */
export interface ISaveSlotView {
  id: string;
  name: string;
  /** Nothing is saved there. */
  empty: boolean;
  /** When it was saved, as the player reads it. */
  when: string;
  /** What the game said of itself when it saved ("Health 80"), or "Empty". */
  info: string;
}

/** What the page shows: the slots, the last thing the saves said, whether one is under way, and whether the game can be restarted. */
export interface ISaveGameState {
  slots: ISaveSlotView[];
  /** What the last save or load said ("Saved to Slot 1", "Nothing is saved in Slot 2"), or empty. */
  message: string;
  /** A save, a load or a restart is under way: the page takes no other. */
  busy: boolean;
  /** The game has its first frame kept (it is taken when the game starts), so it can be restarted. */
  canRestart: boolean;
}

// The places a game is saved to: the quick one (the `quick-save` and `quick-load` actions: F5 and F9 by default) and three the player chooses in the pause menu. The ids are the names the engine keeps them under; the names (and every line this service says)
// are the language files' (`saves.*`), with these English words when there is no entry.
const SLOTS = [
  { id: 'quick', name: 'Quick' },
  { id: 'slot-1', name: 'Slot 1' },
  { id: 'slot-2', name: 'Slot 2' },
  { id: 'slot-3', name: 'Slot 3' },
];

/**
 * Saving the game and loading it back: the `quick-save` action (F5 by default) saves to the quick slot and `quick-load` (F9) loads it, and the pause menu has three slots more, each with the time it was saved and what the game said of itself then. The engine's
 * `SaveSystem` does the work (a print of the whole game: the scenes, the services that keep state, the Director); this is the player's side of it. What this game keeps in a save is whatever its scripts keep in fields
 * (`@Saved()` for what a scene file should not hold) and its services (`Inventory`, `Journal`).
 *
 * A save is taken only while the game runs or is paused by a menu; a load builds the saved game and drops the one that was running, then puts the player's own settings (the sensitivity, the field of view) on the
 * new camera and closes the pause menu. The saves are kept in the Vault of this game, so a game and another never share them.
 *
 * Restart is a load of the game as it was on its first frame: once everything has started, one frame in, the game is printed with `SaveSystem.createSnapshot()` and kept in memory (not in a slot: it is not the
 * player's, and a slot would outlive a new version of the game). The Services come back through the same `onSave()` / `onRestore()` a save uses, so the inventory, the Journal and the Director are at their start
 * with nothing to reset by hand, and the player's settings and the saves are left as they were. The cost is that snapshot in memory: about the size of a save of the level, before it is compressed.
 */
@Service()
export class SaveGame {

  @Inject(Hud) hud!: Hud;
  @Inject(PauseMenu) pauseMenu!: PauseMenu;

  state: ISaveGameState = { slots: SLOTS.map(slot => ({ id: slot.id, name: slot.name, empty: true, when: '', info: 'Empty' })), message: '', busy: false, canRestart: false };

  /** The whole state, a new object each time (the Bridge only sends what is not `===` the last). */
  onChange = new Signal<ISaveGameState>();

  /** The slot `quick-save` saves to and `quick-load` loads from. */
  quickSlot = 'quick';

  private saveKey?: Parameters<typeof Input.removeListner>[0];
  private loadKey?: Parameters<typeof Input.removeListner>[0];
  // The browser's own reload is not an action: the player may move quick save off F5, and F5 must still never reload the game.
  private reloadGuard = (event: KeyboardEvent) => { if (event.code === 'F5') event.preventDefault(); };
  // Set to undefined by hand, not only declared: a hot reload during Play removes the own properties a new instance does not have, and the kept start would go with it.
  private start: IGameSnapshot | undefined = undefined;

  onStart() {
    // F5 is the browser's own key for a reload: the game keeps it, wherever quick save is bound (`preventDefault()` is the callback's to ask, and does nothing for a pad).
    window.addEventListener('keydown', this.reloadGuard);
    this.saveKey = Input.action('quick-save').down(event => {
      event.preventDefault();
      if (BraveEngine.mode === BraveEngineModeEnum.Running) void this.save(this.quickSlot);
    });
    this.loadKey = Input.action('quick-load').down(event => {
      event.preventDefault();
      if (BraveEngine.mode === BraveEngineModeEnum.Running) void this.load(this.quickSlot);
    });
    void this.refresh();
    // The slots' names and what they say of themselves are words: said again when the language changes.
    Translate.onChange.on(() => void this.refresh(), this);
    // The first frame, not now: the Services start after the scenes, in the call that begins it, so the game is whole only once that frame has begun (and a timer of the engine does not run while it is not playing).
    Invoke.setTimeout(() => this.keepStart(), 0);
  }

  onDestroy() {
    window.removeEventListener('keydown', this.reloadGuard);
    if (this.saveKey) Input.removeListner(this.saveKey);
    if (this.loadKey) Input.removeListner(this.loadKey);
    this.saveKey = this.loadKey = undefined;
    this.start = undefined;
  }

  /** Writes the game as it is now to `slot`, replacing what was there. */
  async save(slot: string): Promise<void> {
    if (this.state.busy || !this.running) return;

    this.busy(true);
    try {
      await SaveSystem.save(slot, { health: Math.round(this.hud.state.health) });
      this.say(phrase('saves.saved', 'Saved to {slot}', { slot: this.nameOf(slot) }));
    } catch (error) {
      console.error('[SaveGame] the game could not be saved:', error);
      this.say(phrase('saves.saveFailed', 'The game could not be saved'));
    }
    await this.refresh();
    this.busy(false);
  }

  /** Brings back the game that was saved in `slot`: the one running is dropped. Says so when there is none. */
  async load(slot: string): Promise<void> {
    await this.bringBack(async () => {
      if (!(await SaveSystem.load(slot))) return phrase('saves.nothingIn', 'Nothing is saved in {slot}', { slot: this.nameOf(slot) });

      this.pauseMenu.reapply();
      return phrase('saves.loaded', 'Loaded {slot}', { slot: this.nameOf(slot) });
    }, error => this.whyNotLoaded(error));
  }

  /** Puts the game back as it was on its first frame, the one running dropped: the scenes, the inventory, the Journal, the Director. The player's settings and the saves stay as they are. */
  async restart(): Promise<void> {
    const start = this.start;
    if (!start) return;

    await this.bringBack(async () => {
      await SaveSystem.restoreSnapshot(start);
      this.pauseMenu.reapply();
      return phrase('saves.restarted', 'Game restarted');
    }, () => phrase('saves.restartFailed', 'The game could not be restarted'));
  }

  /** Reads what is saved again (the page shows it when the menu opens, and after every save). */
  async refresh(): Promise<void> {
    const saved = new Map((await SaveSystem.slots()).map(meta => [meta.slot, meta]));
    this.state.slots = SLOTS.map(slot => {
      const meta = saved.get(slot.id);
      return { id: slot.id, name: this.nameOf(slot.id), empty: !meta, when: meta ? this.whenOf(meta) : '', info: meta ? this.infoOf(meta) : phrase('saves.empty', 'Empty') };
    });
    this.changed();
  }

  // Swaps the game that runs for another one (a slot, or the start): `bring` does it and says what to tell the player. The editor restores only a game that is running (a paused one is refused), and a pause menu holds
  // the game still: it is closed first, which gives the game back (and asks for the pointer: the click on the button is the player's). A swap that does not happen leaves the game running, and Esc opens the menu again.
  private async bringBack(bring: () => Promise<string>, failed: (error: unknown) => string): Promise<void> {
    if (this.state.busy || !this.running) return;

    this.busy(true);
    if (this.pauseMenu.state.open) this.pauseMenu.resume();
    try {
      this.say(await bring());
    } catch (error) {
      console.error('[SaveGame] the game could not be brought back:', error);
      this.say(failed(error));
    }
    this.busy(false);
  }

  // A save of an older version of the engine is refused before anything is touched: the game goes on as it was, and the player is told what to do.
  private whyNotLoaded(error: unknown): string {
    return String((error as Error)?.message ?? error).includes('is not one this engine reads') ? phrase('saves.tooOld', 'This save is from an older version: save again') : phrase('saves.loadFailed', 'The save could not be loaded');
  }

  private keepStart(): void {
    try {
      this.start = SaveSystem.createSnapshot();
    } catch (error) {
      console.error('[SaveGame] the start of the game could not be kept: Restart is off.', error);
    }
    this.state.canRestart = this.start !== undefined;
    this.changed();
  }

  // A game that stands still behind a menu is saved too; one that is not playing is not.
  private get running(): boolean {
    return BraveEngine.mode === BraveEngineModeEnum.Running || BraveEngine.mode === BraveEngineModeEnum.Paused;
  }

  private nameOf(slot: string): string {
    const known = SLOTS.find(candidate => candidate.id === slot);
    return known ? phrase(`saves.slots.${known.id}`, known.name) : slot;
  }

  private whenOf(meta: ISaveMeta): string {
    return new Date(meta.savedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  }

  private infoOf(meta: ISaveMeta): string {
    const health = meta.details?.health;
    return typeof health === 'number' ? `${this.whenOf(meta)} · ${phrase('hud.health', 'Health')} ${health}` : this.whenOf(meta);
  }

  private say(message: string): void {
    this.state.message = message;
    this.hud.showMessage(message);
    this.changed();
  }

  private busy(busy: boolean): void {
    this.state.busy = busy;
    this.changed();
  }

  private changed(): void {
    this.onChange.emit({ ...this.state, slots: this.state.slots.map(slot => ({ ...slot })) });
  }
}
