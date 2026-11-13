import { AudioTrack, Bool, Entity, IEntity, Inject, JsonIgnore, Ref, Saved, Script, Signal, State, String } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Inventory } from '../../services/inventory.service';
import { Journal } from '../../services/journal.service';
import { Objective } from '../journal/objective';
import { Interactable } from './interactable';
import type { Interactor } from './interactor';

/**
 * A place where one item goes: the slot for a power cell, the keyhole of a gate. It accepts the item `Item Id`. While the player does not carry it the prompt says what is missing
 * (`Needs Prompt`) and E gives the dull click; while it does the prompt is `Prompt` ("Place power cell") and E takes the item out of the inventory and fills the socket:
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

  @String({ header: 'Item', label: 'Item Id', tooltip: 'The item it accepts: the Item Id of a Pickup.' }) itemId = '';
  @String({ label: 'Item Name', tooltip: 'What the player reads in the prompts. Empty: the name the inventory has for the Item Id once the player has one, or the id.' }) itemName = '';
  @String({ label: 'Needs Prompt', tooltip: 'Shown while the player does not carry the item. {item} is its name.' }) needsPrompt = 'Needs {item}';
  @String({ label: 'Needs Message', tooltip: 'A line on the screen when the player tries it without the item. Empty: none.' }) needsMessage = '';

  @Ref(Entity, { header: 'When Filled', label: 'Placed Object', tooltip: 'A child entity that starts switched off: the item in place. It is switched on.' }) placed?: IEntity;
  @Ref(Entity, { label: 'Switch On', tooltip: 'An entity that starts switched off (a lamp): it is switched on.' }) switchOn?: IEntity;
  @Ref(Interactable, { label: 'Target', tooltip: 'What it acts on: a Door, or any Interactable that can be unlocked or opened.' }) target?: Interactable;
  @Ref(Objective, { label: 'Completes Objective', tooltip: 'An Objective of the Journal that is done when this is filled.' }) objective?: Objective;
  @Bool({ label: 'Unlock Target' }) unlocksTarget = true;
  @Bool({ label: 'Open Target' }) opensTarget = false;
  @String({ label: 'Filled Message', tooltip: 'A line on the screen when it is filled. {item} is the item. Empty: none.' }) filledMessage = 'Placed {item}';
  @Ref(AudioTrack, { header: 'Sound', label: 'Put Sound' }) putSound = '';

  @Inject(Inventory) inventory!: Inventory;
  @Inject(Hud) hud!: Hud;
  @Inject(Journal) journal!: Journal;

  /** The item is in: the Interactor that put it. */
  @JsonIgnore() onFilled = new Signal<Interactor>();

  @JsonIgnore() @Saved() @State() isFilled = false;

  get currentPrompt(): string {
    return this.fill(this.has ? this.prompt : this.needsPrompt, this.label);
  }

  get usable(): boolean {
    return !this.isFilled;
  }

  protected onUse(interactor: Interactor): void {
    if (!this.has) {
      interactor.deny(this.needsMessage ? this.fill(this.needsMessage, this.label) : '');
      return;
    }

    const label = this.label;
    this.inventory.remove(this.itemId);
    this.journal.markUsed(this.itemId);
    this.isFilled = true;
    if (this.placed) this.placed.active = true;
    if (this.switchOn) this.switchOn.active = true;
    this.play(this.putSound);
    if (this.filledMessage) this.hud.showMessage(this.fill(this.filledMessage, label));

    if (this.unlocksTarget) this.target?.unlock();
    if (this.opensTarget) this.target?.open();
    this.objective?.complete();
    this.onFilled.emit(interactor);
  }

  private get has(): boolean {
    return this.inventory.has(this.itemId);
  }

  private get label(): string {
    return this.itemName || this.inventory.nameOf(this.itemId);
  }
}
