import { AudioTrack, Inject, Int, JsonIgnore, Ref, Script, Signal, String } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Inventory } from '../../services/inventory.service';
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
  @String({ label: 'Message', tooltip: 'A line on the screen when it is taken. {item} is its name. Empty: none.' }) message = 'Picked up {item}';
  @Ref(AudioTrack, { header: 'Sound', label: 'Pickup Sound' }) pickupSound = '';

  @Inject(Inventory) inventory!: Inventory;
  @Inject(Hud) hud!: Hud;

  /** It was taken: the Interactor that took it. */
  @JsonIgnore() onPickedUp = new Signal<Interactor>();

  onStart() {
    if (!this.itemId) console.warn(`[Pickup] "${this.entity.name}": Item Id is empty, so the inventory cannot tell it from anything else.`);
  }

  get currentPrompt(): string {
    return this.fill(this.prompt, this.label);
  }

  protected onUse(interactor: Interactor): void {
    this.inventory.add(this.itemId, this.label, this.count);
    if (this.message) this.hud.showMessage(this.fill(this.message, this.label));
    interactor.play(this.pickupSound);
    this.entity.active = false;
    this.onPickedUp.emit(interactor);
  }

  private get label(): string {
    return this.itemName || this.itemId;
  }
}
