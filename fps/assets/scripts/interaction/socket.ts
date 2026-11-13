import { AudioTrack, Bool, Entity, IEntity, Inject, JsonIgnore, Ref, Saved, Script, Signal, State, String } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Inventory } from '../../services/inventory.service';
import { Journal } from '../../services/journal.service';
import { Objective } from '../journal/objective';
import { fillRequirement, IRequirementProgress, parseRequirement, progressOf } from '../shared/requirement';
import { Interactable } from './interactable';
import type { Interactor } from './interactor';

/**
 * A place where an item goes: the slot for a power cell, the keyhole of a gate. It accepts the item `Item Id`. While the player does not carry it the prompt says what is missing
 * (`Needs Prompt`) and E gives the dull click; while it does the prompt is `Prompt` ("Place power cell") and E takes the item out of the inventory and fills the socket.
 *
 * It can take several things, one console for a puzzle of five pieces: `Item Id` is then the ids separated by commas (`piece-1, piece-2, piece-3, piece-4, piece-5`), and `fuse x3` asks for three of one kind.
 * E puts in what the player carries of what is still missing, so a piece found later goes in later: the prompts say what is next and how far it is (`Needs Piece 3 (2 of 5)`, `Place Piece 3 (2 of 5)`), and
 * the socket is filled, with all of what follows, when the last one is in:
 *
 * - `Placed Object` (a child entity that starts switched off, the item as it looks in place) is switched on,
 * - the sound is played, `Filled Message` goes to the `Hud`, `onFilled` is emitted and `isFilled` is true from then on (a filled socket takes no more),
 * - `Target` (a `Door`, or anything else that is an `Interactable`) is unlocked and / or opened, and
 * - `Switch On` (a lamp, a light, a machine's entity) is switched on.
 *
 * `isFilled` is a `@State()` and `onFilled` a `Signal`, so a Director can wait for it too.
 */
@Script({ inheritProperties: true })
export class Socket extends Interactable {

  prompt = 'Place {item}';

  @String({ header: 'Item', label: 'Item Id', tooltip: 'The item it accepts: the Item Id of a Pickup. Several things (the pieces of a puzzle): their ids separated by commas, "piece-1, piece-2"; "fuse x3" asks for three of one kind.' }) itemId = '';
  @String({ label: 'Item Name', tooltip: 'What the player reads in the prompts, when it takes one item. Empty: the name the Pickup gave the inventory, or the id. (Several things are named by their own.)' }) itemName = '';
  @String({ label: 'Needs Prompt', tooltip: 'Shown while the player carries nothing it still needs. {item} is the name of the first thing missing. When it takes more than one thing, " (2 of 5)" follows by itself; {have} and {need} put the numbers where the text wants them.' }) needsPrompt = 'Needs {item}';
  @String({ label: 'Needs Message', tooltip: 'A line on the screen when the player tries it without the item. Empty: none.' }) needsMessage = '';

  @Ref(Entity, { header: 'When Filled', label: 'Placed Object', tooltip: 'A child entity that starts switched off: the item in place. It is switched on.' }) placed?: IEntity;
  @Ref(Entity, { label: 'Switch On', tooltip: 'An entity that starts switched off (a lamp): it is switched on.' }) switchOn?: IEntity;
  @Ref(Interactable, { label: 'Target', tooltip: 'What it acts on: a Door, or any Interactable that can be unlocked or opened.' }) target?: Interactable;
  @Ref(Objective, { label: 'Completes Objective', tooltip: 'An Objective of the Journal that is done when this is filled.' }) objective?: Objective;
  @Bool({ label: 'Unlock Target' }) unlocksTarget = true;
  @Bool({ label: 'Open Target' }) opensTarget = false;
  @String({ label: 'Filled Message', tooltip: 'A line on the screen each time something goes in. {item} is what went in; when it takes more than one thing, " (2 of 5)" follows. Empty: none.' }) filledMessage = 'Placed {item}';
  @Ref(AudioTrack, { header: 'Sound', label: 'Put Sound' }) putSound = '';

  @Inject(Inventory) inventory!: Inventory;
  @Inject(Hud) hud!: Hud;
  @Inject(Journal) journal!: Journal;

  /** The item is in: the Interactor that put it. */
  @JsonIgnore() onFilled = new Signal<Interactor>();

  @JsonIgnore() @Saved() @State() isFilled = false;

  // How many of each thing it asks for are in already, in the order of the ids in `Item Id`.
  @JsonIgnore() @Saved() private slotted: number[] = [];

  get currentPrompt(): string {
    const put = this.carriedNeeded();
    if (put.length > 0) return fillRequirement(this.prompt, this.namesOf(put.map(each => each.id)), this.progress);

    return fillRequirement(this.needsPrompt, this.namesOf(this.progress.missing ? [this.progress.missing.id] : []), this.progress);
  }

  get usable(): boolean {
    return !this.isFilled;
  }

  /** How many of the things it asks for are in. */
  @State() get itemsIn(): number {
    return this.progress.have;
  }

  protected onUse(interactor: Interactor): void {
    const put = this.carriedNeeded();
    if (put.length === 0) {
      interactor.deny(this.needsMessage ? fillRequirement(this.needsMessage, this.namesOf(this.progress.missing ? [this.progress.missing.id] : []), this.progress) : '');
      return;
    }

    put.forEach(each => {
      this.inventory.remove(each.id, each.count);
      this.journal.markUsed(each.id);
      this.slotted[each.index] = (this.slotted[each.index] ?? 0) + each.count;
    });
    this.play(this.putSound);
    if (this.filledMessage) this.hud.showMessage(fillRequirement(this.filledMessage, this.namesOf(put.map(each => each.id)), this.progress));
    if (!this.progress.complete) return;

    this.isFilled = true;
    if (this.placed) this.placed.active = true;
    if (this.switchOn) this.switchOn.active = true;
    if (this.unlocksTarget) this.target?.unlock();
    if (this.opensTarget) this.target?.open();
    this.objective?.complete();
    this.onFilled.emit(interactor);
  }

  // What it asks for and how far it is: the things are read from the field each time, so a script that changes it is followed.
  private get parts() {
    return parseRequirement(this.itemId);
  }

  private get progress(): IRequirementProgress {
    const parts = this.parts;
    return progressOf(parts, id => this.slotted[parts.findIndex(part => part.id === id)] ?? 0);
  }

  // What the player carries of what is still missing, and how many of each would go in.
  private carriedNeeded(): { id: string; index: number; count: number }[] {
    return this.parts
      .map((part, index) => ({ id: part.id, index, count: Math.min(this.inventory.count(part.id), part.count - (this.slotted[index] ?? 0)) }))
      .filter(each => each.count > 0);
  }

  // The names the player reads: its own for one thing it takes (`Item Name`), the Inventory's otherwise.
  private namesOf(ids: string[]): string {
    if (this.itemName && this.parts.length === 1) return this.itemName;
    return ids.map(id => this.inventory.nameOf(id)).join(', ');
  }
}
