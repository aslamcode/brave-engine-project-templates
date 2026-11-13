import { ScriptComponent } from '@brave/core';
import { Journal } from '../../services/journal.service';
/**
 * A goal the player is given: it is written in the Journal under Objectives when the game starts (`Starts Active`), or when a script or a Director calls `give()`, and it is crossed out when
 * `complete()` is called (a `Socket` has `Completes Objective` for that) or marked failed by `fail()`.
 */
export declare class Objective extends ScriptComponent {
    title: string;
    description: string;
    startsActive: boolean;
    journal: Journal;
    onStart(): void;
    /** Writes it in the Journal (once). */
    give(): void;
    complete(): void;
    fail(): void;
}
