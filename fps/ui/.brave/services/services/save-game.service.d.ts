import { Signal } from '@brave/core';
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
export declare class SaveGame {
    hud: Hud;
    pauseMenu: PauseMenu;
    state: ISaveGameState;
    /** The whole state, a new object each time (the Bridge only sends what is not `===` the last). */
    onChange: Signal<ISaveGameState>;
    /** The slot `quick-save` saves to and `quick-load` loads from. */
    quickSlot: string;
    private saveKey?;
    private loadKey?;
    private reloadGuard;
    private start;
    onStart(): void;
    onDestroy(): void;
    /** Writes the game as it is now to `slot`, replacing what was there. */
    save(slot: string): Promise<void>;
    /** Brings back the game that was saved in `slot`: the one running is dropped. Says so when there is none. */
    load(slot: string): Promise<void>;
    /** Puts the game back as it was on its first frame, the one running dropped: the scenes, the inventory, the Journal, the Director. The player's settings and the saves stay as they are. */
    restart(): Promise<void>;
    /** Reads what is saved again (the page shows it when the menu opens, and after every save). */
    refresh(): Promise<void>;
    private bringBack;
    private whyNotLoaded;
    private keepStart;
    private get running();
    private nameOf;
    private whenOf;
    private infoOf;
    private say;
    private busy;
    private changed;
}
