import { ScriptComponent } from '@brave/core';
import { Journal } from '../../services/journal.service';
/**
 * How the game's Journal looks to the player: what the menu is called and whether the game stands still while it is open. The Journal itself is a service every game has (Tab opens it); this is the one
 * place a game says what it calls it (Journal here; Datapad, Notebook or Terminal in another game, with nothing else changing) and how it behaves. One in a scene is enough.
 */
export declare class JournalMenu extends ScriptComponent {
    title: string;
    hintSeconds: number;
    pausesGame: boolean;
    journal: Journal;
    onStart(): void;
}
