import { AudioTrack, Bool, Callable, Entity, Float, IEntity, Inject, Invoke, JsonIgnore, Quaternion, Ref, Saved, Script, Select, Signal, State, String, Time, Vec3, Vector3 } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Inventory } from '../../services/inventory.service';
import { Journal } from '../../services/journal.service';
import { Interactable } from './interactable';

export type DoorMode = 'rotate' | 'slide';
export type DoorEasing = 'linear' | 'smooth' | 'ease-in' | 'ease-out';

/**
 * A door, or anything that moves out of the way and back: a hinged door TURNS about an axis, a drawer, a shutter or a gate SLIDES along one. One script for both: `Mode` says which, `Axis` the
 * line it turns about or the way it slides, `Amount` how far (degrees or metres), `Duration` how long, `Easing` how it speeds up and slows down. E toggles it, and a door in the middle of a swing
 * goes back from where it is.
 *
 * ```
 * Front Door          <- this script (and the Audio Source of its sounds). Put it where the hinge is, or where the slide starts.
 *   Front Door Leaf   <- the part that MOVES (Leaf). A Rigid Body of type Kinematic (Interpolate off) is what makes the colliders move with it.
 *     Front Door Panel   <- the mesh, and a Collider: a closed door blocks the player because the collider is where the panel is.
 * ```
 *
 * The leaf's origin is the hinge, so the panel hangs off it (a child, a half-width to the side). The pose the leaf has in the scene is its CLOSED pose; `Starts Open` puts it open when the game
 * starts. With no `Leaf` set, the moving part is this entity itself.
 *
 * Locked: a locked door refuses E (the locked sound, `Locked Message`, `onLocked`) unless the player carries `Key Item` (then the bolt slides: the unlock sound, `onUnlocked`, and a moment later
 * the door opens; the key stays in the inventory). With no `Key Item` only a script unlocks it: `unlock()`, which a `Socket` or a Director calls.
 *
 * What a Director or another script can use: `@State()` `isOpen` (it is open, or on its way to be) and `isLocked`; `@Callable()` `open()`, `close()`, `toggle()`, `lock()`, `unlock()` (these do not
 * ask for the key: a script that opens a locked door opens it); `Signal`s `onOpened` and `onClosed` (when the movement is finished), `onLocked` (the player tried it) and `onUnlocked`.
 *
 * Sounds are the four fields of the Sounds group, played through the Audio Source (see `Interactable`). A rotating door's close sound is the latch, so by default it is played when the door
 * SHUTS (`Close Sound When Shut`); a drawer's is a slide, played as it starts to go.
 */
@Script({ inheritProperties: true })
export class Door extends Interactable {

  prompt = 'Open door';

  @Select({ header: 'Movement', label: 'Mode', optionsKey: 'modeOptions', sort: false, tooltip: 'Rotate: a hinged door, turns about the Axis. Slide: a drawer, a shutter or a gate, moves along the Axis.' }) mode: DoorMode = 'rotate';
  @Vec3({ label: 'Axis', tooltip: 'In the space of the Leaf\'s parent. Rotate: the line it turns about (0, 1, 0 is a door on its hinges). Slide: the way it goes.' }) axis = new Vector3(0, 1, 0);
  @Float({ label: 'Amount', tooltip: 'Rotate: degrees. Slide: metres. A negative amount goes the other way, which is how a door is told which way it swings.' }) amount = 90;
  @Float({ label: 'Duration', suffix: 's', tooltip: 'How long it takes to open, or to close.' }) duration = 1;
  @Select({ label: 'Easing', optionsKey: 'easingOptions', sort: false }) easing: DoorEasing = 'smooth';
  @Ref(Entity, { label: 'Leaf', tooltip: 'The part that moves. For a hinged door its origin is the hinge. Empty: this entity.' }) leaf?: IEntity;

  @Bool({ header: 'State', label: 'Starts Open' }) startsOpen = false;
  @Bool({ label: 'Locked', tooltip: 'Starts locked: E is refused, unless the player carries the Key Item.' }) locked = false;
  @String({ label: 'Key Item', tooltip: 'The id of the item in the Inventory that unlocks it. The key is not used up. Empty: no item unlocks it.' }) keyItemId = '';

  @String({ header: 'Prompts', label: 'Close Prompt', tooltip: 'Shown while it is open. (The Prompt above is shown while it is closed.)' }) closePrompt = 'Close door';
  @String({ label: 'Locked Prompt', tooltip: 'Shown while it is locked and the player cannot open it.' }) lockedPrompt = 'Locked';
  @String({ label: 'Unlock Prompt', tooltip: 'Shown while it is locked and the player has the Key Item.' }) unlockPrompt = 'Unlock door';
  @String({ label: 'Locked Message', tooltip: 'A line on the screen when the player tries it locked. Empty: none.' }) lockedMessage = 'The door is locked';

  @Ref(AudioTrack, { header: 'Sounds', label: 'Open Sound' }) openSound = '';
  @Ref(AudioTrack, { label: 'Close Sound' }) closeSound = '';
  @Ref(AudioTrack, { label: 'Locked Sound', tooltip: 'Played when the player tries it locked.' }) lockedSound = '';
  @Ref(AudioTrack, { label: 'Unlock Sound' }) unlockSound = '';
  @Float({ label: 'Unlock Delay', suffix: 's', tooltip: 'How long after the unlock sound a door opened with its key starts to move.' }) unlockDelay = 0.45;
  @Bool({ label: 'Close Sound When Shut', tooltip: 'On: the close sound plays when it has shut (a latch, a thud). Off: when it starts to close (a slide).' }) closeSoundWhenShut = true;

  @Inject(Inventory) inventory!: Inventory;
  @Inject(Journal) journal!: Journal;
  @Inject(Hud) hud!: Hud;

  /** The movement to open is finished. */
  @JsonIgnore() onOpened = new Signal();
  /** The movement to close is finished. */
  @JsonIgnore() onClosed = new Signal();
  /** The player tried it locked, and could not. */
  @JsonIgnore() onLocked = new Signal();
  /** It was unlocked, by its key or by a script. */
  @JsonIgnore() onUnlocked = new Signal();

  /** 0 closed, 1 open, in between while it moves (before the easing). */
  @JsonIgnore() @Saved() progress = 0;

  @JsonIgnore() protected modeOptions = [{ value: 'rotate', description: 'Rotate' }, { value: 'slide', description: 'Slide' }];
  @JsonIgnore() protected easingOptions = [{ value: 'smooth', description: 'Smooth' }, { value: 'linear', description: 'Linear' }, { value: 'ease-in', description: 'Ease In' }, { value: 'ease-out', description: 'Ease Out' }];

  // Where it is going, and the pose of the leaf when closed. They are in a save because onStart() does not run again on a restore.
  @JsonIgnore() @Saved() private wantsOpen = false;
  @JsonIgnore() @Saved() private closedPosition?: number[];
  @JsonIgnore() @Saved() private closedRotation?: number[];
  @JsonIgnore() private unlockTimer?: number;

  onStart() {
    this.capture();
    if (this.startsOpen) {
      this.wantsOpen = true;
      this.progress = 1;
    }
    this.place();
  }

  onUpdate() {
    const goal = this.wantsOpen ? 1 : 0;
    if (this.progress === goal) return;

    const step = this.duration > 0 ? Time.deltaTime / this.duration : 1;
    this.progress = goal > this.progress ? Math.min(goal, this.progress + step) : Math.max(goal, this.progress - step);
    this.place();
    if (this.progress === goal) this.arrived();
  }

  onDestroy() {
    if (this.unlockTimer !== undefined) Invoke.clearTimeout(this.unlockTimer);
  }

  onAfterClone() {
    this.unlockTimer = undefined;
  }

  //#region What a script or a Director can ask

  @Callable({ label: 'Open' }) open(): void {
    if (this.wantsOpen) return;

    this.wantsOpen = true;
    this.play(this.openSound);
  }

  @Callable({ label: 'Close' }) close(): void {
    if (!this.wantsOpen) return;

    this.wantsOpen = false;
    if (!this.closeSoundWhenShut) this.play(this.closeSound);
  }

  @Callable({ label: 'Toggle' }) toggle(): void {
    if (this.wantsOpen) this.close();
    else this.open();
  }

  @Callable({ label: 'Lock' }) lock(): void {
    this.locked = true;
  }

  @Callable({ label: 'Unlock' }) unlock(): void {
    if (!this.locked) return;

    this.locked = false;
    this.play(this.unlockSound);
    this.onUnlocked.emit();
  }

  //#endregion

  //#region Interactable

  get currentPrompt(): string {
    if (this.locked) return this.canUnlock ? this.unlockPrompt : this.lockedPrompt;
    return this.wantsOpen ? this.closePrompt : this.prompt;
  }

  protected onUse(): void {
    if (!this.locked) {
      this.toggle();
      return;
    }

    if (this.canUnlock) {
      this.journal.markUsed(this.keyItemId);
      this.unlock();
      this.unlockTimer = Invoke.setTimeout(() => this.open(), this.unlockDelay * 1000);
      return;
    }

    this.play(this.lockedSound);
    if (this.lockedMessage) this.hud.showMessage(this.lockedMessage);
    this.onLocked.emit();
  }

  //#endregion

  //#region Getters

  /** It is open, or on its way to be: what the prompt and a Director's condition go by. */
  @State() get isOpen(): boolean {
    return this.wantsOpen;
  }

  @State() get isLocked(): boolean {
    return this.locked;
  }

  /** It is between closed and open. */
  get isMoving(): boolean {
    return this.progress !== (this.wantsOpen ? 1 : 0);
  }

  private get canUnlock(): boolean {
    return !!this.keyItemId && this.inventory.has(this.keyItemId);
  }

  private get mover(): IEntity {
    return this.leaf ?? this.entity;
  }

  //#endregion Getters

  private arrived(): void {
    if (this.wantsOpen) {
      this.onOpened.emit();
      return;
    }

    if (this.closeSoundWhenShut) this.play(this.closeSound);
    this.onClosed.emit();
  }

  // The scene's pose of the leaf is the closed one.
  private capture(): void {
    if (this.closedPosition) return;

    const transform = this.mover.transform;
    this.closedPosition = [transform.position.x, transform.position.y, transform.position.z];
    this.closedRotation = [transform.rotationQ.x, transform.rotationQ.y, transform.rotationQ.z, transform.rotationQ.w];
  }

  // The leaf where `progress` puts it. A new Vector3 or Quaternion each time: the Transform takes the object it is given and listens to it.
  private place(): void {
    if (!this.closedPosition || !this.closedRotation) return;

    const transform = this.mover.transform;
    const reached = this.eased(this.progress);
    const length = Math.hypot(this.axis.x, this.axis.y, this.axis.z);

    if (this.mode === 'slide') {
      const scale = length > 0 ? this.amount * reached / length : 0;
      const [x, y, z] = this.closedPosition;
      transform.position = new Vector3(x + this.axis.x * scale, y + this.axis.y * scale, z + this.axis.z * scale);
      return;
    }

    const turn = Quaternion.fromAxisAngle(new Quaternion(), length > 0 ? this.axis : new Vector3(0, 1, 0), this.amount * reached);
    const closed = new Quaternion();
    [closed.x, closed.y, closed.z, closed.w] = this.closedRotation;
    transform.rotationQ = Quaternion.multiply(new Quaternion(), turn, closed);
  }

  private eased(t: number): number {
    switch (this.easing) {
      case 'linear': return t;
      case 'ease-in': return t * t;
      case 'ease-out': return 1 - (1 - t) * (1 - t);
      default: return t * t * (3 - 2 * t);
    }
  }
}
