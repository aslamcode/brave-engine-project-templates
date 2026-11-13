import { AudioTrack, Inject, Int, JsonIgnore, Ref, Script, Signal, String } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Inventory } from '../../services/inventory.service';
import { Journal } from '../../services/journal.service';
import { Interactable } from './interactable';
import type { Interactor } from './interactor';

/**
 * An item the player collects with E: it goes into the `Inventory` under `Item Id` (what a locked `Door` or a `Socket` asks for), the `Hud` says so, a sound is heard, and its entity is switched
 * off, with nothing in between: no animation, it is simply gone. (A script that wants one listens to `onPickedUp`.) The entity needs a collider for the player to look at; the model can be
 * its children.
 *
 * The sound comes from the player (the Interactor's Audio Source), not from the item: the item's own entity is off the moment it is taken, and takes its Audio Source with it.
 */
@Script({ inheritProperties: true })
export class Pickup extends Interactable {

  prompt = 'Take {item}';

  @String({ header: 'Item', label: 'Item Id', tooltip: 'What the inventory counts it as: the id a Door\'s Key Item or a Socket\'s Item Id says. Two pickups with the same id are the same kind of thing.' }) itemId = '';
  @String({ label: 'Item Name', tooltip: 'What the player reads: in the prompt and the messages, and in the list of what is carried. Empty: the Item Id.' }) itemName = '';
  @Int({ label: 'Count', tooltip: 'How many it gives.' }) count = 1;
  @Int({ label: 'Limit', tooltip: 'The most of this item the player can carry (0: no limit, as keys and credits have). It is set by the first pickup of the id that starts; one that finds the player full stays where it is.' }) limit = 0;
  @String({ label: 'Message', tooltip: 'A line on the screen when it is taken. {item} is its name. Empty: none.' }) message = 'Picked up {item}';
  @String({ header: 'Journal', label: 'Journal Category', tooltip: 'Empty: it is not written in the Journal. \'access\' (a key, a card) lists it under Access, and the Journal says whether it was used; anything else is a category of its own.' }) journalCategory = '';
  @String({ label: 'Description', rows: 3, tooltip: 'What the Journal says about it, on the right of the menu.' }) description = '';
  @Ref(AudioTrack, { header: 'Sound', label: 'Pickup Sound' }) pickupSound = '';

  @Inject(Inventory) inventory!: Inventory;
  @Inject(Hud) hud!: Hud;
  @Inject(Journal) journal!: Journal;

  /** It was taken: the Interactor that took it. */
  @JsonIgnore() onPickedUp = new Signal<Interactor>();

  onStart() {
    if (!this.itemId) console.warn(`[Pickup] "${this.entity.name}": Item Id is empty, so the inventory cannot tell it from anything else.`);
    if (this.limit > 0) this.inventory.define(this.itemId, { name: this.label, limit: this.limit });
  }

  get currentPrompt(): string {
    return this.fill(this.prompt, this.label);
  }

  protected onUse(interactor: Interactor): void {
    // Full: it stays where it is. Room for some: what fits is taken and the rest stays.
    if (this.inventory.room(this.itemId) <= 0) {
      this.hud.showMessage(this.fill('{item} full', this.label));
      return;
    }

    const before = this.inventory.count(this.itemId);
    this.inventory.add(this.itemId, this.label, this.count);
    const taken = this.inventory.count(this.itemId) - before;
    if (this.journalCategory) this.journal.add({ id: this.itemId, category: this.journalCategory, title: this.label, body: this.description, status: this.journalCategory === 'access' ? 'unused' : '' });
    if (this.message) this.hud.showMessage(this.fill(this.message, this.label));
    interactor.play(this.pickupSound);
    this.onPickedUp.emit(interactor);
    if (taken < this.count) {
      this.count -= taken;
      return;
    }
    this.entity.active = false;
  }

  private get label(): string {
    return this.itemName || this.itemId;
  }
}
