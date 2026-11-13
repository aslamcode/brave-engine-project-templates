import { Bool, Inject, Script, ScriptComponent, String } from '@brave/core';
import { Journal } from '../../services/journal.service';

/**
 * A goal the player is given: it is written in the Journal under Objectives when the game starts (`Starts Active`), or when a script or a Director calls `give()`, and it is crossed out when
 * `complete()` is called (a `Socket` has `Completes Objective` for that) or marked failed by `fail()`.
 */
@Script()
export class Objective extends ScriptComponent {

  @String({ header: 'Objective', label: 'Title', tooltip: 'What the player reads in the list.' }) title = 'New objective';
  @String({ label: 'Description', rows: 3, tooltip: 'What the Journal says about it, on the right of the menu.' }) description = '';
  @Bool({ label: 'Starts Active', tooltip: 'On: it is in the Journal from the start of the game. Off: until `give()` is called.' }) startsActive = true;

  @Inject(Journal) journal!: Journal;

  onStart() {
    if (this.startsActive) this.give();
  }

  /** Writes it in the Journal (once). */
  give(): void {
    this.journal.objective(this.entity.id, this.title, this.description);
  }

  complete(): void {
    this.journal.complete(this.entity.id);
  }

  fail(): void {
    this.journal.fail(this.entity.id);
  }
}
