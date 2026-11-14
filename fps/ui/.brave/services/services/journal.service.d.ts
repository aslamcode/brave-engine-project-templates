import { Signal } from '@brave/core';
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
export declare class Journal {
    hud: Hud;
    inventory: Inventory;
    pauseMenu: PauseMenu;
    /** What the menu is called, on the page and in the messages. */
    title: string;
    /** How long the chip in the corner stays on the screen when something new goes in (0: it is always there). */
    hintSeconds: number;
    /** On: the game stands still while it is open. Off: it goes on behind it. */
    pausesGame: boolean;
    /** The whole state, a new object each time (the Bridge only sends what is not `===` the last). */
    onChange: Signal<IJournalState>;
    private entries;
    private category;
    private selected;
    private isOpen;
    private pausedByJournal;
    private playing;
    private source?;
    private readonly buffers;
    private tabListener?;
    private escapeListener?;
    private started;
    state: IJournalState;
    onStart(): void;
    onDestroy(): void;
    /** What a `JournalMenu` sets: the name of the menu, whether it pauses the game, how long its chip stays and how long the list of what is carried stays on the screen when it changes. */
    configure(settings: {
        title?: string;
        pausesGame?: boolean;
        hintSeconds?: number;
        itemsSeconds?: number;
    }): void;
    /** Puts what the player found in the Journal, once: an id that is in it already is left as it was. Says so on the screen. Returns whether it was new. */
    add(entry: IJournalEntryInput, announce?: boolean): boolean;
    /** An objective the player is given, active: the title it reads and what it says. */
    objective(id: string, title: string, body?: string): boolean;
    complete(id: string): void;
    fail(id: string): void;
    /** An access (a key, a card) that was used. Nothing for an id that is not there. */
    markUsed(id: string): void;
    setStatus(id: string, status: JournalStatus): void;
    has(id: string): boolean;
    statusOf(id: string): JournalStatus;
    /** A copy of every entry. */
    list(): IJournalEntry[];
    /** Opens the menu, on an entry when one is given. Not while the pause menu is open or when the game is not running. */
    open(entryId?: string): void;
    /** Closes it, gives the game back and asks for the pointer again (the key or the click that made this call counts as the player's, so the browser lets it). Esc passes `false`: a browser that grants the pointer at an Esc
     * takes the same Esc as the key that lets it go, and the pause menu would open for that; the next click holds it. */
    close(lockPointer?: boolean): void;
    toggle(): void;
    /** The page chose a category. */
    select(category: string): void;
    /** The page chose an entry. */
    choose(id: string): void;
    /** Plays the sound of an entry (the one that plays stops). It goes on while the game is paused. */
    play(id: string): Promise<void>;
    stop(): void;
    private decode;
    onSave(): {
        entries: IJournalEntry[];
    };
    onRestore(data: {
        entries: IJournalEntry[];
    }): void;
    private markSeen;
    private carried;
    private snapshot;
    private changed;
}
