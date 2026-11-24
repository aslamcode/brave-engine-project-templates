import { AudioTrack, Bool, Callable, Decal, DecalModeEnum, Entity, Float, IEntity, Inject, Invoke, JsonIgnore, Quaternion, Ref, Saved, Script, Select, Signal, State, String, StringCompletionEnum, Time, Translate, Vec3, Vector3 } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Inventory } from '../../services/inventory.service';
import { Journal } from '../../services/journal.service';
import { aimBoxOf, IAimBox, shiftBox } from '../shared/aim-box';
import { biggestRenderer, centerOf, hasSolid } from '../shared/drawn';
import { fillRequirement, IRequirementProgress, parseRequirement, progressOf } from '../shared/requirement';
import { Interactable } from './interactable';
import type { Interactor } from './interactor';

export type DoorMode = 'rotate' | 'slide';
export type DoorEasing = 'linear' | 'smooth' | 'ease-in' | 'ease-out';
/** Which sides a hinged door opens from: either, always swinging the same way; either, swinging away from whoever opens it; only the side it swings away from. */
export type DoorSides = 'fixed' | 'both' | 'front';

/**
 * A door, or anything that moves out of the way and back: a hinged door TURNS about an axis, a drawer, a shutter or a gate SLIDES along one. One script for both: `Mode` says which, `Axis` the
 * line it turns about or the way it slides, `Amount` how far (degrees or metres), `Duration` how long, `Easing` how it speeds up and slows down. `interact` toggles it, and a door in the middle of a swing
 * goes back from where it is.
 *
 * ```
 * Front Door          <- this script (and the Audio Source of its sounds). Put it where the hinge is, or where the slide starts.
 *   Front Door Leaf   <- the part that MOVES (Leaf). It needs no Rigid Body: a Collider with none follows the entity it is on, and the navigation grid sees a door with none (a Kinematic body would
 *                        take it out of the grid). The collider is put where the leaf is each step, a teleport, so the door pushes nothing: a crate in its way is shoved aside slowly, or passed through when the
 *                        door opens fast. A Kinematic body would push it for real, but the character controller then freezes when the player stands on it and slides along it worse than along a plain collider.
 *     Front Door Panel   <- the mesh, and a Collider: a closed door blocks the player because the collider is where the panel is.
 * ```
 *
 * The leaf's origin is the hinge, so the panel hangs off it (a child, a half-width to the side). The pose the leaf has in the scene is its CLOSED pose; `Starts Open` puts it open when the game
 * starts. With no `Leaf` set, the moving part is this entity itself.
 *
 * A sliding door is used through its doorway: the leaf slides out of sight, so the aim counts where it shuts (`aimBox`), and E shuts it from anywhere in the doorway, not only at the edge that is left. While it is
 * open it has no small mark either (nothing is there to find); looking through the doorway at it brings the prompt. The leaf must have a collider that is on, or there is nothing to look at.
 *
 * Sides: a hinged door swings the way `Amount` says (turn its sign to swing it the other way), and `Opens From` says who may open it: `Either side, one swing` (the default: the door always swings
 * the same way, so from the far side it swings TOWARDS the player), `Either side, away from the player` (it swings away from whoever opens it: a door in a corridor) or `Front side only` (only
 * from the side it swings away from; the other side is refused, a door to a room that is entered from one side). Which side the player is on is measured from the hinge and the place of the panel (the
 * biggest thing the leaf is drawn with), so the leaf needs a mesh for the last two. A door that is open is closed from either side, and a script (`open()`, a Socket, a Director) opens it whatever the side.
 *
 * Locked: a locked door refuses `interact` (the locked sound, `Locked Message`, `onLocked`) unless the player carries `Key Item` (then the bolt slides: the unlock sound, `onUnlocked`, and a moment later
 * the door opens; the key is taken out of the inventory unless `Use Up Key` is off: the Journal still lists it, as used). The prompt says what is missing (`Needs Prompt`: "Needs key"), and a lock that
 * asks for several things (`piece-1, piece-2, piece-3`, or `fuse x3`) says how far the player is ("Needs piece 3 (2 of 3)"). With no `Key Item` only a script unlocks it: `unlock()`, which a `Socket` or a Director calls.
 *
 * What a Director or another script can use: `@State()` `isOpen` (it is open, or on its way to be) and `isLocked`; `@Callable()` `open()`, `close()`, `toggle()`, `lock()`, `unlock()` (these do not
 * ask for the key: a script that opens a locked door opens it); `Signal`s `onOpened` and `onClosed` (when the movement is finished), `onLocked` (the player tried it) and `onUnlocked`.
 *
 * Sounds are the four fields of the Sounds group, played through the Audio Source (see `Interactable`). A rotating door's close sound is the latch, so by default it is played when the door
 * SHUTS (`Close Sound When Shut`); a drawer's is a slide, played as it starts to go.
 *
 * A sign: the name or the number of THIS door ("A-03", "Archive"). `Sign` is a Text decal and `Sign Text` what it says; the door writes the text into the decal's Text when the game starts, so one prefab of a
 * door gives each of its instances its own number (the text is a field of the instance, the decal is the prefab's). A `{{ key }}` in it is read in the player's language, and read again when the language
 * changes. A script gives it another text with `setSign()`. The decal goes on the wall or on the frame, never on the Leaf: paint stays where it was laid and a door that moves slides out from under it.
 */
@Script({ inheritProperties: true })
export class Door extends Interactable {

  prompt = '{{ prompts.door.open }}';

  @Select({ header: 'Movement', label: 'Mode', optionsKey: 'modeOptions', sort: false, tooltip: 'Rotate: a hinged door, turns about the Axis. Slide: a drawer, a shutter or a gate, moves along the Axis.' }) mode: DoorMode = 'rotate';
  @Vec3({ label: 'Axis', tooltip: 'In the space of the Leaf\'s parent. Rotate: the line it turns about (0, 1, 0 is a door on its hinges). Slide: the way it goes.' }) axis = new Vector3(0, 1, 0);
  @Float({ label: 'Amount', tooltip: 'Rotate: degrees. Slide: metres. A negative amount goes the other way, which is how a door is told which way it swings.' }) amount = 90;
  @Select({ label: 'Opens From', optionsKey: 'sidesOptions', sort: false, tooltip: 'Rotate only. Either side, one swing: it always swings the way Amount says. Either side, away from the player: it swings away from whoever opens it. Front side only: only from the side it swings away from, the other side is refused. The last two need a mesh on the Leaf (the place of the panel tells the sides).' }) sides: DoorSides = 'fixed';
  @Float({ label: 'Duration', suffix: 's', tooltip: 'How long it takes to open, or to close.' }) duration = 1;
  @Select({ label: 'Easing', optionsKey: 'easingOptions', sort: false }) easing: DoorEasing = 'smooth';
  @Ref(Entity, { label: 'Leaf', tooltip: 'The part that moves. For a hinged door its origin is the hinge. Empty: this entity.' }) leaf?: IEntity;

  @Bool({ header: 'State', label: 'Starts Open' }) startsOpen = false;
  @Bool({ label: 'Locked', tooltip: 'Starts locked: Interact is refused, unless the player carries the Key Item.' }) locked = false;
  @String({ label: 'Key Item', tooltip: 'The id of the item in the Inventory that unlocks it. Empty: no item unlocks it. Several things (the pieces of a puzzle): their ids separated by commas, "piece-1, piece-2"; "fuse x3" asks for three of one kind.' }) keyItemId = '';
  @Bool({ label: 'Use Up Key', tooltip: 'On: the key is taken out of the Inventory when it opens the lock (the Journal still lists it, as used). Off: the player keeps it, for another door that takes the same key.' }) consumesKey = true;

  @String({ header: 'Prompts', label: 'Close Prompt', tooltip: 'Shown while it is open. (The Prompt above is shown while it is closed.)', completion: StringCompletionEnum.TranslationKeys }) closePrompt = '{{ prompts.door.close }}';
  @String({ label: 'Locked Prompt', tooltip: 'Shown while it is locked and nothing the player can carry opens it (a Key Item that is empty: only a script unlocks it).', completion: StringCompletionEnum.TranslationKeys }) lockedPrompt = '{{ prompts.locked }}';
  @String({ label: 'Needs Prompt', tooltip: 'Shown while it is locked and the player lacks the Key Item. {item} is the name of the first thing missing. When the lock asks for more than one thing, " (2 of 5)" follows by itself; {have} and {need} put the numbers where the text wants them.', completion: StringCompletionEnum.TranslationKeys }) needsPrompt = '{{ prompts.needs }}';
  @String({ label: 'Unlock Prompt', tooltip: 'Shown while it is locked and the player has the Key Item.', completion: StringCompletionEnum.TranslationKeys }) unlockPrompt = '{{ prompts.door.unlock }}';
  @String({ label: 'Locked Message', tooltip: 'A line on the screen when the player tries it locked. Empty: none.', completion: StringCompletionEnum.TranslationKeys }) lockedMessage = '{{ messages.door.locked }}';
  @String({ label: 'Wrong Side Prompt', tooltip: 'Opens From, Front side only: shown on the side it does not open from.', completion: StringCompletionEnum.TranslationKeys }) wrongSidePrompt = '{{ prompts.door.wrongSide }}';
  @String({ label: 'Wrong Side Message', tooltip: 'Opens From, Front side only: a line on the screen when the player tries it from the side it does not open from. Empty: none.', completion: StringCompletionEnum.TranslationKeys }) wrongSideMessage = '{{ messages.door.wrongSide }}';

  @Ref(AudioTrack, { header: 'Sounds', label: 'Open Sound' }) openSound = '';
  @Ref(AudioTrack, { label: 'Close Sound' }) closeSound = '';
  @Ref(AudioTrack, { label: 'Locked Sound', tooltip: 'Played when the player tries it locked.' }) lockedSound = '';
  @Ref(AudioTrack, { label: 'Unlock Sound' }) unlockSound = '';
  @Float({ label: 'Unlock Delay', suffix: 's', tooltip: 'How long after the unlock sound a door opened with its key starts to move.' }) unlockDelay = 0.45;
  @Bool({ label: 'Close Sound When Shut', tooltip: 'On: the close sound plays when it has shut (a latch, a thud). Off: when it starts to close (a slide).' }) closeSoundWhenShut = true;

  @Ref(Decal, { header: 'Sign', label: 'Sign', tooltip: 'A Text decal that shows the name or the number of this door, on the wall beside it or on its frame (not on the Leaf: paint stays where it is laid, and a door that moves slides out from under it). Its Text is set from Sign Text when the game starts. Empty: no sign.' }) sign?: Decal;
  @String({ label: 'Sign Text', tooltip: 'What the sign says: "A-03", "Archive". A {{ key }} is read in the player\'s language. Empty: the decal keeps the text it has.', completion: StringCompletionEnum.TranslationKeys }) signText = '';

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
  @JsonIgnore() protected sidesOptions = [{ value: 'fixed', description: 'Either side, one swing' }, { value: 'both', description: 'Either side, away from the player' }, { value: 'front', description: 'Front side only' }];
  @JsonIgnore() protected easingOptions = [{ value: 'smooth', description: 'Smooth' }, { value: 'linear', description: 'Linear' }, { value: 'ease-in', description: 'Ease In' }, { value: 'ease-out', description: 'Ease Out' }];

  // Where it is going, and the pose of the leaf when closed. They are in a save because onStart() does not run again on a restore.
  @JsonIgnore() @Saved() private wantsOpen = false;
  @JsonIgnore() @Saved() private closedPosition?: number[];
  @JsonIgnore() @Saved() private closedRotation?: number[];
  // The hinge and the way the leaf starts to move (the door's normal, towards the side it swings to), in the space of the leaf's parent: from them, which side of the door a place is on.
  @JsonIgnore() @Saved() private hinge?: number[];
  @JsonIgnore() @Saved() private normal?: number[];
  // 1 swings the way `amount` says, -1 the other (a door that swings away from whoever opened it, from the side it was opened from). Chosen when a closed door starts to open, held until it is shut.
  @JsonIgnore() @Saved() private swing = 1;
  @JsonIgnore() private unlockTimer?: number;
  @JsonIgnore() private signListener?: { off(): void };

  onStart() {
    this.capture();
    if (this.startsOpen) {
      this.wantsOpen = true;
      this.progress = 1;
    }
    this.place();
    this.showSign();
  }

  // A load builds the door as it was, started: the sign is written again and the listener of the language is not there.
  onRestore() {
    this.showSign();
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
    this.signListener?.off();
  }

  // The copy was handed the original's handles: they are dropped, never turned off (that would take the original's listener away). The copy starts and listens for itself.
  onAfterClone() {
    this.unlockTimer = undefined;
    this.signListener = undefined;
  }

  //#region What a script or a Director can ask

  @Callable({ label: 'Open' }) open(): void {
    if (this.wantsOpen) return;

    // A script opens it with no player to turn away from: the way `Amount` says, unless it has a way already (a door that swings away from the player, opened by `interact` and then by a script, keeps it until it is shut).
    if (this.sides !== 'both' && this.progress === 0) this.swing = 1;
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

  /** Gives the sign another text (a number a script worked out, a name the player was told): it is written into the decal at once, and kept in the save with the door. */
  setSign(text: string): void {
    this.signText = text ?? '';
    this.showSign();
  }

  //#endregion

  //#region Interactable

  get currentPrompt(): string {
    if (!this.locked) return this.wantsOpen ? this.closePrompt : this.prompt;
    if (this.canUnlock) return this.unlockPrompt;

    const progress = this.keyProgress;
    if (!progress.missing) return this.lockedPrompt;
    return fillRequirement(this.needsPrompt, this.inventory.nameOf(progress.missing.id), progress);
  }

  // The side the player looks from decides the prompt of a door that opens from one side only.
  promptFor(interactor: Interactor): string {
    return this.refusedFrom(interactor) ? this.wrongSidePrompt : this.currentPrompt;
  }

  // A door that slides away leaves nothing in its doorway to look at, and a player who wants to shut it would have to aim at the sliver that is left. So the aim counts where the leaf shuts: the leaf's own box
  // moved back by how far it has gone. A leaf nobody can touch (no collider that is on) is not a door to look at, whatever has this script on it.
  get aimBox(): IAimBox | undefined {
    if (this.mode !== 'slide' || !this.closedPosition || !hasSolid(this.mover)) return undefined;

    const renderer = biggestRenderer(this.mover);
    const box = renderer && aimBoxOf(renderer);
    if (!box) return undefined;

    // How far the leaf is from where it shuts, in the space of its parent; the world's is that turned and stretched as the parent is.
    const length = Math.hypot(this.axis.x, this.axis.y, this.axis.z);
    const scale = length > 0 ? this.amount * this.eased(this.progress) / length : 0;
    const x = this.axis.x * scale, y = this.axis.y * scale, z = this.axis.z * scale;
    const m = this.mover.parent?.transform.worldMatrix;
    if (!m) return shiftBox(box, -x, -y, -z);

    return shiftBox(box, -(m[0] * x + m[4] * y + m[8] * z), -(m[1] * x + m[5] * y + m[9] * z), -(m[2] * x + m[6] * y + m[10] * z));
  }

  // Slid away it has nothing to find: no small mark floating in an empty doorway. It is looked at all the same, through the doorway, and then it has its box.
  get marked(): boolean {
    return this.mode !== 'slide' || !this.wantsOpen;
  }

  protected onUse(interactor: Interactor): void {
    if (this.refusedFrom(interactor)) {
      interactor.deny(this.wrongSideMessage);
      return;
    }

    this.chooseSwing(interactor);
    if (!this.locked) {
      this.toggle();
      return;
    }

    if (this.canUnlock) {
      this.requirement.forEach(part => {
        this.journal.markUsed(part.id);
        if (this.consumesKey) this.inventory.remove(part.id, part.count);
      });
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

  // What the lock asks for (`Key Item`: ids, `x3` for a count) and how much of it the player carries.
  private get requirement() {
    return parseRequirement(this.keyItemId);
  }

  private get keyProgress(): IRequirementProgress {
    return progressOf(this.requirement, id => this.inventory.count(id));
  }

  private get canUnlock(): boolean {
    return this.requirement.length > 0 && this.keyProgress.complete;
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

  // Writes Sign Text into the decal and listens to the language when the text asks for entries. A door with no Sign, or no text, leaves the decal as it is.
  private showSign(): void {
    this.signListener?.off();
    this.signListener = undefined;
    if (!this.sign) {
      if (this.signText) console.warn(`[Door] "${this.entity.name}": Sign Text is set but there is no Sign decal to write it into.`);
      return;
    }

    if (this.signText && this.sign.mode !== DecalModeEnum.Text) console.warn(`[Door] "${this.entity.name}": the Sign decal is not in Text mode, so it will not show "${this.signText}".`);
    this.writeSign();
    if (Translate.reads(this.signText)) this.signListener = Translate.onChange.on(() => this.writeSign(), this);
  }

  private writeSign(): void {
    if (!this.sign || !this.signText) return;

    this.sign.text = Translate.resolve(this.signText);
  }

  // The scene's pose of the leaf is the closed one.
  private capture(): void {
    if (this.closedPosition) return;

    const transform = this.mover.transform;
    this.closedPosition = [transform.position.x, transform.position.y, transform.position.z];
    this.closedRotation = [transform.rotationQ.x, transform.rotationQ.y, transform.rotationQ.z, transform.rotationQ.w];
    this.measureSides();
  }

  // The door's normal and its hinge, from where the panel is: the part of the way from the hinge to the panel that lies across the axis turns, when the leaf is turned by a positive angle about the axis, towards
  // `axis x across` (the right hand), and that is the way the door moves when it starts to open. A leaf with nothing drawn has no panel to measure: it swings one way, whatever `Opens From` says.
  private measureSides(): void {
    this.hinge = this.normal = undefined;
    const renderer = this.mode === 'rotate' ? biggestRenderer(this.mover) : undefined;
    const panel = renderer && centerOf(renderer);
    const length = Math.hypot(this.axis.x, this.axis.y, this.axis.z);
    if (!panel || !this.closedPosition || length === 0) {
      if (this.sides !== 'fixed') console.warn(`[Door] "${this.entity.name}": Opens From needs a mesh on the Leaf (the place of the panel tells the sides), so it swings one way.`);
      return;
    }

    const parent = this.mover.parent?.transform;
    const place = parent ? parent.inverseTransformPoint(panel) : panel;
    const [hx, hy, hz] = this.closedPosition;
    const ax = this.axis.x / length, ay = this.axis.y / length, az = this.axis.z / length;
    const along = (place.x - hx) * ax + (place.y - hy) * ay + (place.z - hz) * az;
    const rx = place.x - hx - along * ax, ry = place.y - hy - along * ay, rz = place.z - hz - along * az;
    const sign = this.amount < 0 ? -1 : 1;
    const nx = (ay * rz - az * ry) * sign, ny = (az * rx - ax * rz) * sign, nz = (ax * ry - ay * rx) * sign;
    const size = Math.hypot(nx, ny, nz);
    if (size < 1e-6) return;

    this.hinge = [hx, hy, hz];
    this.normal = [nx / size, ny / size, nz / size];
  }

  // How far in front of the door a place is: positive on the side it swings TOWARDS (the player there is in its way), negative on the side it swings away from; 0 when the sides are not known.
  private sideOf(interactor: Interactor): number {
    if (!this.hinge || !this.normal) return 0;

    const eyes = interactor.entity.transform.globalPosition;
    const parent = this.mover.parent?.transform;
    const place = parent ? parent.inverseTransformPoint(eyes) : eyes;
    return (place.x - this.hinge[0]) * this.normal[0] + (place.y - this.hinge[1]) * this.normal[1] + (place.z - this.hinge[2]) * this.normal[2];
  }

  // A closed door that opens from one side only is refused from the other (an open one is closed from either).
  private refusedFrom(interactor: Interactor): boolean {
    return this.sides === 'front' && !this.wantsOpen && this.sideOf(interactor) > 0;
  }

  // A closed door that swings away from whoever opens it turns the way that is away from the side the player is on; any other door swings the way `Amount` says.
  private chooseSwing(interactor: Interactor): void {
    if (this.wantsOpen || this.progress !== 0) return;
    this.swing = this.sides === 'both' && this.sideOf(interactor) > 0 ? -1 : 1;
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

    const turn = Quaternion.fromAxisAngle(new Quaternion(), length > 0 ? this.axis : new Vector3(0, 1, 0), this.amount * this.swing * reached);
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
