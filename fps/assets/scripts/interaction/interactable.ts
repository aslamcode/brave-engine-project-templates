import { AudioSource, Float, JsonIgnore, Ref, Script, ScriptComponent, Select, Signal, String, StringCompletionEnum } from '@brave/core';
import type { Interactor } from './interactor';
import type { IAimBox } from '../shared/aim-box';
import { fillText } from '../shared/phrase';
import { playClip } from '../shared/sound';

/** What a thing says about itself when the player looks at it: a title and a text under it. Both may hold `{{ key }}` (an entry of the language files), so the HUD shows them in the player's language. */
export interface IInteractableCaption {
  title: string;
  body: string;
}

/** How the player is shown it is there to be used: a box with a line down to it, a simple mark, or nothing (the line under the crosshair still says what `interact` does when it is looked at). */
export type InteractableMarker = 'line' | 'simple' | 'none';

/**
 * Something the player can use with `interact`: what it says when the player looks at it (`currentPrompt`), whether it can be used now (`usable`), and what happens when it is (`onUse`).
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
 * `currentPrompt`, and calls `interact()` when the player uses it. The collider can be on this entity or on any child of it (the leaf of a door), so no layer or trigger is needed.
 */
@Script()
export class Interactable extends ScriptComponent {

  @String({ header: 'Prompt', label: 'Prompt', tooltip: 'What Interact does on this, shown under the crosshair while the player looks at it and it can be used. {item} stands for the name of its item, where it has one.', completion: StringCompletionEnum.TranslationKeys }) prompt = 'Use';

  @String({ header: 'Caption', label: 'Caption Title', tooltip: 'The name the player reads over the prompt while looking at it: "Terminal", "Power cell". It may hold {{ key }}, an entry of the language files, so that it follows the language. A Pickup gives its item\'s name when this is empty and it has something to say.', completion: StringCompletionEnum.TranslationKeys }) captionTitle = '';
  @String({ label: 'Caption Text', rows: 3, tooltip: 'A line or two under the title: what it is, what it is for. It may hold {{ key }} too. A Pickup says its Description when this is empty.', completion: StringCompletionEnum.TranslationKeys }) captionText = '';

  @Select({ header: 'Marker', label: 'Marker', optionsKey: 'markerOptions', sort: false, tooltip: 'How the player sees it can be used: Line is a glass box with the prompt, over it and tied to it by a line (for things on the floor, small things); Simple puts the box on it with no line; None draws nothing. Near ones that are not looked at are a small mark either way.' }) marker: InteractableMarker = 'line';
  @Float({ label: 'Marker Height', suffix: 'm', tooltip: 'Where the marker is tied: the centre of the biggest thing this entity is drawn with, and this much above it (negative: below), to put it on the handle of a drawer or the top of a pickup. An entity with nothing drawn takes its origin.' }) markerHeight = 0;

  @Float({ header: 'Aim', label: 'Aim Radius', suffix: 'm', tooltip: 'How far from its centre the aim may be and still count as looking at it, so that a small thing does not have to be hit exactly: a sphere of this radius around its centre. It only counts when nothing else is under the crosshair (what the crosshair is on always wins), and not through a wall. 0: only a look that lands on its collider counts.' }) aimRadius = 0;

  @Ref(AudioSource, { header: 'Sound', label: 'Audio Source', tooltip: 'Where its sounds come from: an Audio Source with Auto Play off. Empty: the one on this entity, if it has one.' }) audio?: AudioSource;
  @Float({ label: 'Pitch Variation', tooltip: 'How much the pitch of its sounds changes from one time to the next, as a fraction: 0.05 is five percent either way.' }) pitchVariation = 0.05;

  @JsonIgnore() protected markerOptions = [{ value: 'line', description: 'Box and line' }, { value: 'simple', description: 'Simple' }, { value: 'none', description: 'None' }];

  /** The player used it. Emitted after what it does, with the Interactor that used it. */
  @JsonIgnore() onUsed = new Signal<Interactor>();

  /** What the player is told `interact` does now. A kind with states (a door: open, close, locked) answers for the state it is in. */
  get currentPrompt(): string {
    return this.prompt;
  }

  /** What `interact` does now as `interactor` sees it, for a kind whose answer depends on who looks (the side of a door the player stands on). It is `currentPrompt` unless a kind says otherwise. */
  promptFor(_interactor: Interactor): string {
    return this.currentPrompt;
  }

  /** What it says about itself when looked at, under the prompt's box on the HUD. Both empty (the default): it says only what `interact` does. A kind answers with what it knows (a pickup: its item). */
  get caption(): IInteractableCaption {
    return { title: this.captionTitle, body: this.captionText };
  }

  /**
   * Whether it only says what it is: no prompt (nothing for `interact` to do) and a caption to read (a painting, a sign: the `Caption` script). The HUD shows its caption alone, with no key and no marker over it, and the
   * `Interactor` reads it from further away than it uses things (`Look Distance`).
   */
  get describesOnly(): boolean {
    const caption = this.caption;
    return this.currentPrompt === '' && !!(caption.title || caption.body);
  }

  /** The name its mark shows when the player's aim is near it without being on it, to tell what a small thing is before aiming at it exactly. Empty: it has none (a door is seen well enough). A small kind answers with its item's name. */
  get peekName(): string {
    return '';
  }

  /**
   * A box in the world where the aim counts as looking at it, besides its collider: for a thing whose collider is not always where the player looks at it (a door that slides away leaves nothing in its place).
   * It works as `Aim Radius` does: only when nothing else is under the crosshair, and not through a wall. None (the default): only its collider and its `Aim Radius` count.
   */
  get aimBox(): IAimBox | undefined {
    return undefined;
  }

  /** Whether it gets the small mark while it is near and not looked at. A thing with nothing to find (a door that is open) says no; when it is looked at it has its box all the same. */
  get marked(): boolean {
    return true;
  }

  /** Whether the player may use it now: when not, nothing is shown and `interact` does nothing. (A locked door IS usable: `interact` on it is how the player finds out.) */
  get usable(): boolean {
    return true;
  }

  /** What `interact` does. Returns whether it did anything. */
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

  /** A text said in the player's language with its `{item}` replaced by the name of the item (the text may be an entry, `{{ prompts.take }}`, and the name too). */
  protected fill(text: string, item: string): string {
    return fillText(text, { item });
  }
}
