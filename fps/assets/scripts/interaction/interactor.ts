import { AudioSource, AudioTrack, BraveEngine, BraveEngineModeEnum, Camera, Entity, Float, IEntity, Inject, Input, Int, JsonIgnore, MeshRenderer, PhysicsSystem, Ref, Script, ScriptComponent, Signal, Time, Vector3 } from '@brave/core';
import { Hud, IHudMarker } from '../../services/hud.service';
import { biggestRenderer, centerOf } from '../shared/drawn';
import { playClip } from '../shared/sound';
import { Interactable } from './interactable';

/**
 * The player's side of interaction: put it on the player's eyes (the camera). Every frame a ray goes from the eyes along the look, `Reach` metres, ignoring the player's own body and everything
 * under it, and stops at the nearest thing it meets. From the collider it hit it walks up through the parents to the first entity that has an `Interactable`, and tells the `Hud` what E does
 * on it (`hud.setPrompt`), or an empty line when there is nothing. E (`Input.keyboard.keyE`) uses it.
 *
 * It also tells the `Hud` which things that can be used are near and in sight (`Marker Range`, at most `Max Markers`, the nearest first), where on the screen, so the page can mark them: the one looked at gets a
 * glass box with what E does (tied to the thing by a line, or on it, by the `Marker` of its Interactable), the others a small mark. The point on the screen comes from the camera on this entity (the eyes)
 * and the anchor of each thing (the centre of what it is drawn with, and its `Marker Height`); a thing behind a wall is not marked.
 *
 * It does nothing while the game is paused or when the entity it is on is off (the other one of two players, say).
 *
 * It also has the sound of the player's side of an interaction: what is heard from the player, not from the thing used (the pickup's: the item's entity is switched off when it is taken, and
 * takes its own Audio Source with it), and the dull click of a use that cannot be done (`deny()`). Give it an Audio Source with Spatial off.
 */
@Script()
export class Interactor extends ScriptComponent {

  @Float({ header: 'Reach', label: 'Reach', suffix: 'm', tooltip: 'How far from the eyes the player can use things.' }) reach = 2.5;
  @Ref(Entity, { label: 'Body', tooltip: 'The player\'s own entity: the ray goes through it and everything under it. Empty: the top of the hierarchy this entity is in.' }) body?: IEntity;

  @Ref(AudioSource, { header: 'Sound', label: 'Audio Source', tooltip: 'Plays the sounds of the player\'s side (a pickup, a use that cannot be done). Give it an Audio Source with Auto Play and Spatial off.' }) audio?: AudioSource;
  @Ref(AudioTrack, { label: 'Deny Sound', tooltip: 'Played when the player tries something that cannot be done.' }) denySound = '';
  @Float({ label: 'Pitch Variation', tooltip: 'How much the pitch changes from one time to the next, as a fraction.' }) pitchVariation = 0.05;

  @Float({ header: 'Markers', label: 'Marker Range', suffix: 'm', tooltip: 'How far from the eyes a thing that can be used gets a marker on the screen. 0 draws none.' }) markerRange = 6;
  @Int({ label: 'Max Markers', tooltip: 'How many markers at once: the nearest ones. The one looked at is always among them.' }) maxMarkers = 4;

  @Inject(Hud) hud!: Hud;

  /** What the player is looking at and can use now, or nothing. */
  @JsonIgnore() target?: Interactable;
  /** The target changed: the new one, or undefined when the player looks at nothing that can be used. */
  @JsonIgnore() onTargetChange = new Signal<Interactable | undefined>();

  @JsonIgnore() private key?: ReturnType<typeof Input.keyboard.keyE.down>;
  @JsonIgnore() private readonly origin = new Vector3();
  @JsonIgnore() private readonly direction = new Vector3();
  // The things that can be used, found again every half second (a scan of the scene is not for every frame) and measured every frame.
  @JsonIgnore() private candidates: ICandidate[] = [];
  @JsonIgnore() private sinceScan = Infinity;

  onStart() {
    this.listen();
  }

  // A restored component that had started does not start again, and a load took every Input listener with it: it listens again.
  onRestore() {
    if (this.started) this.listen();
  }

  onUpdate() {
    if (!this.running) return;

    const target = this.look();
    this.watch(target);
    this.mark(target);
  }

  onDisable() {
    this.watch(undefined);
    this.hud?.setMarkers([]);
  }

  onDestroy() {
    if (this.key) Input.removeListner(this.key);
    this.key = undefined;
    this.watch(undefined);
    this.hud?.setMarkers([]);
  }

  // The copy made for Play holds the original's handle, which must not be removed with the copy's own: dropped, never removed (see docs/scripts.md).
  onAfterClone() {
    this.key = undefined;
  }

  /** E: uses what the player looks at. Returns whether anything was used. */
  use(): boolean {
    if (!this.running) return false;

    const interactable = this.look();
    return interactable ? interactable.interact(this) : false;
  }

  /** A use that cannot be done: the dull click, and a line on the screen when there is something to say. */
  deny(message = ''): void {
    playClip(this.audio, this.denySound, this.pitchVariation);
    if (message) this.hud.showMessage(message);
  }

  /** Plays a clip from the player (an Audio Source on this entity, Spatial off). */
  play(clip: string): void {
    playClip(this.audio, clip, this.pitchVariation);
  }

  private listen(): void {
    if (this.key) Input.removeListner(this.key);
    this.key = Input.keyboard.keyE.down(() => { this.use(); });
  }

  // The first Interactable that can be used, from what the ray meets first. Only the nearest thing counts: a wall in front of a door is a wall.
  private look(): Interactable | undefined {
    const matrix = this.entity.transform.worldMatrix;
    const length = Math.hypot(matrix[8], matrix[9], matrix[10]) || 1;
    this.origin.set(matrix[12], matrix[13], matrix[14]);
    this.direction.set(-matrix[8] / length, -matrix[9] / length, -matrix[10] / length);

    const hit = PhysicsSystem.raycast(this.origin, this.direction, this.reach, { ignore: this.body ?? this.root() });
    if (!hit) return undefined;

    for (let entity: Entity | undefined = hit.entity; entity; entity = entity.parent) {
      const interactable = entity.getComponent(Interactable);
      if (interactable?.activeInHierarchy) return interactable.usable ? interactable : undefined;
    }
    return undefined;
  }

  // What is on the screen to be used: near, in front of the camera, within the screen, not behind a wall (the one looked at needs no ray: the look already found it), and not asked to be left out.
  private mark(focused: Interactable | undefined): void {
    const markers: IHudMarker[] = [];
    const camera = this.entity.getComponent(Camera);

    if (camera && this.markerRange > 0 && this.maxMarkers > 0) {
      this.sinceScan += Time.deltaTime;
      if (this.sinceScan >= SCAN_EVERY) {
        this.sinceScan = 0;
        this.scan();
      }

      const matrix = camera.viewProjectionMatrix;
      const found: { thing: Interactable; distance: number; x: number; y: number; point: Vector3 }[] = [];
      this.candidates.forEach(candidate => {
        const thing = candidate.thing;
        if (!thing.activeInHierarchy || !thing.usable || thing.marker === 'none') return;

        const point = this.anchorOf(candidate);
        const distance = Vector3.distance(point, this.origin);
        if (distance > this.markerRange) return;

        const w = matrix[3] * point.x + matrix[7] * point.y + matrix[11] * point.z + matrix[15];
        if (!(w > 0)) return;
        const x = (matrix[0] * point.x + matrix[4] * point.y + matrix[8] * point.z + matrix[12]) / w;
        const y = (matrix[1] * point.x + matrix[5] * point.y + matrix[9] * point.z + matrix[13]) / w;
        if (Math.abs(x) > 1.05 || Math.abs(y) > 1.05) return;

        found.push({ thing, distance, x: x * 0.5 + 0.5, y: 0.5 - y * 0.5, point });
      });

      found.sort((a, b) => (a.thing === focused ? -1 : b.thing === focused ? 1 : a.distance - b.distance));
      for (const item of found) {
        if (markers.length >= this.maxMarkers) break;
        if (item.thing !== focused && this.isBehindSomething(item.thing, item.point, item.distance)) continue;

        markers.push({ id: item.thing.entity.id, x: Math.round(item.x * 1000) / 1000, y: Math.round(item.y * 1000) / 1000, prompt: item.thing === focused ? item.thing.promptFor(this) : '', focused: item.thing === focused, line: item.thing.marker === 'line' });
      }
    }

    this.hud.setMarkers(markers);
  }

  // The first thing a ray from the eyes to the point meets is not the thing itself (or a child of it) and is nearer than the point: a wall, a door, a crate.
  private isBehindSomething(thing: Interactable, point: Vector3, distance: number): boolean {
    this.direction.set((point.x - this.origin.x) / distance, (point.y - this.origin.y) / distance, (point.z - this.origin.z) / distance);
    const hit = PhysicsSystem.raycast(this.origin, this.direction, distance, { ignore: this.body ?? this.root() });
    if (!hit || hit.distance >= distance - 0.25) return false;

    for (let entity: Entity | undefined = hit.entity; entity; entity = entity.parent) if (entity === thing.entity) return false;
    return true;
  }

  // Where a marker is tied: the centre of the biggest thing the entity is drawn with (the leaf of a door, a pickup's model), as it is now, and `Marker Height` above it; the origin when nothing is drawn.
  private anchorOf(candidate: ICandidate): Vector3 {
    const { thing, renderer } = candidate;
    const center = renderer && centerOf(renderer);
    if (!center) {
      const place = thing.entity.transform.globalPosition;
      return new Vector3(place.x, place.y + thing.markerHeight, place.z);
    }

    center.y += thing.markerHeight;
    return center;
  }

  // Every Interactable of the running scenes, each with the biggest renderer in it (by the size it has in the world).
  private scan(): void {
    this.candidates = [];
    const visit = (entity: Entity) => {
      const thing = entity.getComponent(Interactable);
      if (thing) this.candidates.push({ thing, renderer: biggestRenderer(entity) });
      entity.children.forEach(visit);
    };
    BraveEngine.scenes.forEach(scene => scene.children.forEach(visit));
  }

  private watch(target: Interactable | undefined): void {
    this.hud?.setPrompt(target ? target.promptFor(this) : '');
    if (target === this.target) return;

    this.target = target;
    this.onTargetChange.emit(target);
  }

  private root(): IEntity {
    let entity: Entity = this.entity;
    while (entity.parent) entity = entity.parent;
    return entity;
  }

  private get running(): boolean {
    return BraveEngine.mode === BraveEngineModeEnum.Running && this.activeInHierarchy;
  }
}

// How often the scene is looked through for things to mark, seconds.
const SCAN_EVERY = 0.5;

// A thing that can be used, and the renderer its marker is tied to (none: its origin).
interface ICandidate {
  thing: Interactable;
  renderer?: MeshRenderer;
}
