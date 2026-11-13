import { AudioTrack, Bool, Inject, JsonIgnore, Ref, Script, Select, Signal, String } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Journal } from '../../services/journal.service';
import { Interactable } from '../interaction/interactable';
import type { Interactor } from '../interaction/interactor';

/**
 * Something the player finds that is worth reading or hearing again: a note, an audio log, a password. E takes it: it goes into the Journal (under Notes, Audio Logs or Passwords) with its title and its text
 * (or its sound), the Hud says so, its entity is switched off, and, with `Open On Take`, the Journal opens on it so that it is read at once. It is an `Interactable`, so it is marked like any other
 * thing that can be used; the entity needs a collider for the player to look at, and its model can be its children.
 */
@Script({ inheritProperties: true })
export class Collectible extends Interactable {

  prompt = 'Take {item}';

  @Select({ header: 'Journal', label: 'Category', optionsKey: 'categoryOptions', sort: false, tooltip: 'Where the Journal lists it.' }) category = 'notes';
  @String({ label: 'Title', tooltip: 'What the player reads in the list, in the prompt and in the message.' }) title = 'A note';
  @String({ label: 'Text', rows: 6, tooltip: 'What the player reads on the right of the menu: the note, the password, or the transcript of an audio log.' }) body = '';
  @Ref(AudioTrack, { label: 'Audio Log', tooltip: 'The sound of an audio log: a play button appears in the menu. It plays even while the game is paused.' }) recording = '';
  @Bool({ label: 'Open On Take', tooltip: 'On: the Journal opens on it as soon as it is taken, so it is read at once.' }) openOnTake = true;

  @Ref(AudioTrack, { header: 'Sound', label: 'Take Sound' }) takeSound = '';

  @Inject(Journal) journal!: Journal;
  @Inject(Hud) hud!: Hud;

  @JsonIgnore() protected categoryOptions = [{ value: 'notes', description: 'Notes' }, { value: 'audio', description: 'Audio Logs' }, { value: 'passwords', description: 'Passwords' }];

  /** It was taken: the Interactor that took it. */
  @JsonIgnore() onTaken = new Signal<Interactor>();

  get currentPrompt(): string {
    return this.fill(this.prompt, this.title);
  }

  protected onUse(interactor: Interactor): void {
    const id = this.entity.id;
    this.journal.add({ id, category: this.category, title: this.title, body: this.body, audio: this.recording });
    interactor.play(this.takeSound);
    this.entity.active = false;
    this.onTaken.emit(interactor);
    if (this.openOnTake) this.journal.open(id);
  }
}
