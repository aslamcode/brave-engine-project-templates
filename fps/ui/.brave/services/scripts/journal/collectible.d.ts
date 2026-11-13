import { Signal } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Journal } from '../../services/journal.service';
import { Interactable } from '../interaction/interactable';
import type { Interactor } from '../interaction/interactor';
/**
 * Something the player finds that is worth reading or hearing again: a note, an audio log, a password. E takes it: it goes into the Journal (under Notes, Audio Logs or Passwords) with its title and its text
 * (or its sound), the Hud says so, its entity is switched off, and, with `Open On Take`, the Journal opens on it so that it is read at once. It is an `Interactable`, so it is marked like any other
 * thing that can be used; the entity needs a collider for the player to look at, and its model can be its children.
 */
export declare class Collectible extends Interactable {
    prompt: string;
    category: string;
    title: string;
    body: string;
    recording: string;
    openOnTake: boolean;
    takeSound: string;
    journal: Journal;
    hud: Hud;
    protected categoryOptions: {
        value: string;
        description: string;
    }[];
    /** It was taken: the Interactor that took it. */
    onTaken: Signal<Interactor>;
    get currentPrompt(): string;
    protected onUse(interactor: Interactor): void;
}
