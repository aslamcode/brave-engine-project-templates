import { BraveEngine, BraveEngineModeEnum, Inject, Input, ISaveMeta, SaveSystem, Service, Signal } from '@brave/core';
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

/** What the page shows: the slots, the last thing the saves said, and whether one is under way. */
export interface ISaveGameState {
  slots: ISaveSlotView[];
  /** What the last save or load said ("Saved to Slot 1", "Nothing is saved in Slot 2"), or empty. */
  message: string;
  /** A save or a load is under way: the page takes no other. */
  busy: boolean;
}

// The places a game is saved to: the quick one (F5 saves, F9 loads) and three the player chooses in the pause menu. The ids are the names the engine keeps them under.
const SLOTS = [
  { id: 'quick', name: 'Quick' },
  { id: 'slot-1', name: 'Slot 1' },
  { id: 'slot-2', name: 'Slot 2' },
  { id: 'slot-3', name: 'Slot 3' },
];

/**
 * Saving the game and loading it back: F5 saves to the quick slot and F9 loads it, and the pause menu has three slots more, each with the time it was saved and what the game said of itself then. The engine's
 * `SaveSystem` does the work (a print of the whole game: the scenes, the services that keep state, the Director); this is the player's side of it. What this game keeps in a save is whatever its scripts keep in fields
 * (`@Saved()` for what a scene file should not hold) and its services (`Inventory`, `Journal`).
 *
 * A save is taken only while the game runs or is paused by a menu; a load builds the saved game and drops the one that was running, then puts the player's own settings (the sensitivity, the field of view) on the
 * new camera and closes the pause menu. The saves are kept in the Vault of this game, so a game and another never share them.
 */
@Service()
export class SaveGame {

  @Inject(Hud) hud!: Hud;
  @Inject(PauseMenu) pauseMenu!: PauseMenu;

  state: ISaveGameState = { slots: SLOTS.map(slot => ({ id: slot.id, name: slot.name, empty: true, when: '', info: 'Empty' })), message: '', busy: false };

  /** The whole state, a new object each time (the Bridge only sends what is not `===` the last). */
  onChange = new Signal<ISaveGameState>();

  /** The slot F5 saves to and F9 loads from. */
  quickSlot = 'quick';

  private saveKey?: Parameters<typeof Input.removeListner>[0];
  private loadKey?: Parameters<typeof Input.removeListner>[0];

  onStart() {
    // The keys are the browser's own for a reload (F5): the game keeps them.
    this.saveKey = Input.keyboard.f5.down((event: KeyboardEvent) => {
      event.preventDefault();
      if (BraveEngine.mode === BraveEngineModeEnum.Running) void this.save(this.quickSlot);
    });
    this.loadKey = Input.keyboard.f9.down((event: KeyboardEvent) => {
      event.preventDefault();
      if (BraveEngine.mode === BraveEngineModeEnum.Running) void this.load(this.quickSlot);
    });
    void this.refresh();
  }

  onDestroy() {
    if (this.saveKey) Input.removeListner(this.saveKey);
    if (this.loadKey) Input.removeListner(this.loadKey);
    this.saveKey = this.loadKey = undefined;
  }

  /** Writes the game as it is now to `slot`, replacing what was there. */
  async save(slot: string): Promise<void> {
    if (this.state.busy || !this.running) return;

    this.busy(true);
    try {
      await SaveSystem.save(slot, { health: Math.round(this.hud.state.health) });
      this.say(`Saved to ${this.nameOf(slot)}`);
    } catch (error) {
      console.error('[SaveGame] the game could not be saved:', error);
      this.say('The game could not be saved');
    }
    await this.refresh();
    this.busy(false);
  }

  /** Brings back the game that was saved in `slot`: the one running is dropped. Says so when there is none. */
  async load(slot: string): Promise<void> {
    if (this.state.busy || !this.running) return;

    this.busy(true);
    // The editor restores only a game that is running (a paused one is refused), and a pause menu holds the game still: it is closed first, which gives the game back (and asks for the pointer: the click on Load
    // is the player's). A load that does not happen leaves the game running, and Esc opens the menu again.
    if (this.pauseMenu.state.open) this.pauseMenu.resume();
    try {
      if (await SaveSystem.load(slot)) {
        // The new player's camera has what its scene gave it, not what the player chose in the menu.
        this.pauseMenu.reapply();
        this.say(`Loaded ${this.nameOf(slot)}`);
      } else {
        this.say(`Nothing is saved in ${this.nameOf(slot)}`);
      }
    } catch (error) {
      console.error('[SaveGame] the save could not be loaded:', error);
      // A save of an older version of the engine is refused before anything is touched: the game goes on as it was, and the player is told what to do.
      this.say(String((error as Error)?.message ?? error).includes('is not one this engine reads') ? 'This save is from an older version: save again' : 'The save could not be loaded');
    }
    this.busy(false);
  }

  /** Reads what is saved again (the page shows it when the menu opens, and after every save). */
  async refresh(): Promise<void> {
    const saved = new Map((await SaveSystem.slots()).map(meta => [meta.slot, meta]));
    this.state.slots = SLOTS.map(slot => {
      const meta = saved.get(slot.id);
      return { id: slot.id, name: slot.name, empty: !meta, when: meta ? this.whenOf(meta) : '', info: meta ? this.infoOf(meta) : 'Empty' };
    });
    this.changed();
  }

  // A game that stands still behind a menu is saved too; one that is not playing is not.
  private get running(): boolean {
    return BraveEngine.mode === BraveEngineModeEnum.Running || BraveEngine.mode === BraveEngineModeEnum.Paused;
  }

  private nameOf(slot: string): string {
    return SLOTS.find(candidate => candidate.id === slot)?.name ?? slot;
  }

  private whenOf(meta: ISaveMeta): string {
    return new Date(meta.savedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  }

  private infoOf(meta: ISaveMeta): string {
    const health = meta.details?.health;
    return typeof health === 'number' ? `${this.whenOf(meta)} · Health ${health}` : this.whenOf(meta);
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
