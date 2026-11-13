import { AudioSource, Float, JsonIgnore, Ref, Script, ScriptComponent, Select, Signal, String } from '@brave/core';
import type { Interactor } from './interactor';
import { playClip } from '../shared/sound';

/** How the player is shown it is there to be used: a box with a line down to it, a simple mark, or nothing (the line under the crosshair still says what E does when it is looked at). */
export type InteractableMarker = 'line' | 'simple' | 'none';

/**
 * Something the player can use with E: what it says when the player looks at it (`currentPrompt`), whether it can be used now (`usable`), and what happens when it is (`onUse`).
 *
 * It is the base the other interactables build on (`Door`, `Pickup`, `Socket`), and it works on its own as a button: put it on an entity with a collider, write the prompt, and listen to
 * `onUsed` from another script, or from a Director (a `Signal` is a trigger there). To make your own kind, extend it and override what changes:
 *
 * ```ts
 * @Script({ inheritProperties: true })
 * export class Lever extends Interactable {
 *   prompt = 'Pull lever';
 *   get usable() { return !this.pulled; }
 *   protected onUse() { this.pulled = true; }
 * }
 * ```
 *
 * The player's side is the `Interactor`: it finds the nearest thing its ray meets, walks up from the collider that was hit to the first entity that has an Interactable, shows its
 * `currentPrompt`, and calls `interact()` on E. The collider can be on this entity or on any child of it (the leaf of a door), so no layer or trigger is needed.
 */
@Script()
export class Interactable extends ScriptComponent {

  @String({ header: 'Prompt', label: 'Prompt', tooltip: 'What E does on this, shown under the crosshair while the player looks at it and it can be used. {item} stands for the name of its item, where it has one.' }) prompt = 'Use';

  @Select({ header: 'Marker', label: 'Marker', optionsKey: 'markerOptions', sort: false, tooltip: 'How the player sees it can be used: Line is a glass box with the prompt, over it and tied to it by a line (for things on the floor, small things); Simple puts the box on it with no line; None draws nothing. Near ones that are not looked at are a small mark either way.' }) marker: InteractableMarker = 'line';
  @Float({ label: 'Marker Height', suffix: 'm', tooltip: 'Where the marker is tied: the centre of the biggest thing this entity is drawn with, and this much above it (negative: below), to put it on the handle of a drawer or the top of a pickup. An entity with nothing drawn takes its origin.' }) markerHeight = 0;

  @Ref(AudioSource, { header: 'Sound', label: 'Audio Source', tooltip: 'Where its sounds come from: an Audio Source with Auto Play off. Empty: the one on this entity, if it has one.' }) audio?: AudioSource;
  @Float({ label: 'Pitch Variation', tooltip: 'How much the pitch of its sounds changes from one time to the next, as a fraction: 0.05 is five percent either way.' }) pitchVariation = 0.05;

  @JsonIgnore() protected markerOptions = [{ value: 'line', description: 'Box and line' }, { value: 'simple', description: 'Simple' }, { value: 'none', description: 'None' }];

  /** The player used it. Emitted after what it does, with the Interactor that used it. */
  @JsonIgnore() onUsed = new Signal<Interactor>();

  /** What the player is told E does now. A kind with states (a door: open, close, locked) answers for the state it is in. */
  get currentPrompt(): string {
    return this.prompt;
  }

  /** Whether the player may use it now: when not, nothing is shown and E does nothing. (A locked door IS usable: E on it is how the player finds out.) */
  get usable(): boolean {
    return true;
  }

  /** What E does. Returns whether it did anything. */
  interact(interactor: Interactor): boolean {
    if (!this.activeInHierarchy || !this.usable) return false;

    this.onUse(interactor);
    this.onUsed.emit(interactor);
    return true;
  }

  /** What another script, or a Director, can ask of anything the player uses: lift its lock. Does nothing unless the kind has a lock (`Door` has). */
  unlock(): void { /* a kind with a lock overrides it */ }

  /** The same for opening it. Does nothing unless the kind opens (`Door` does). */
  open(): void { /* a kind that opens overrides it */ }

  /** What this kind does when it is used. */
  protected onUse(_interactor: Interactor): void { /* a kind overrides it */ }

  /** Plays a clip through `source` (this one's Audio Source when none is given) at a slightly different pitch each time. */
  protected play(clip: string, source?: AudioSource): void {
    playClip(source ?? this.audio ?? this.entity.getComponent(AudioSource), clip, this.pitchVariation);
  }

  /** A text with its `{item}` replaced by the name of the item. */
  protected fill(text: string, item: string): string {
    return text.replace('{item}', item);
  }
}
