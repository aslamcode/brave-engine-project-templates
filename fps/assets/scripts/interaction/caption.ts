import { Script } from '@brave/core';
import { Interactable, InteractableMarker } from './interactable';

/**
 * A thing that only says what it is when the player looks at it: a painting, a sign, a monument, a dead terminal. There is nothing to press: the HUD shows its Caption Title and Caption Text over the crosshair (the
 * glass card a pickup or a terminal has, without the line of E), and no marker is drawn over it. The entity needs a collider for the player to look at (the model can be its children); the title and the text may hold
 * `{{ key }}` of the language files, so that they follow the language. It is read from further away than a thing is used: `Look Distance` of the `Interactor`.
 *
 * It is an `Interactable` that has no prompt, so what any `Interactable` does with an empty prompt and a caption (`describesOnly`) is what this one does; this only starts with the right defaults and does
 * nothing when E is pressed.
 */
@Script({ inheritProperties: true })
export class Caption extends Interactable {

  prompt = '';
  marker: InteractableMarker = 'none';

  /** There is nothing to do: E on it does nothing, and says nothing. */
  interact(): boolean {
    return false;
  }
}
