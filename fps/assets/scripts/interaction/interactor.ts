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
 * Aiming at a small thing does not have to be exact. Three rules, in this order, and the first one is what keeps the aim precise:
 * 1. What the crosshair is on wins. A ray that lands on something that can be used is that thing, whatever else is near.
 * 2. Where it is on nothing to use (the floor beside a key, the air above it), a thing that has an `Aim Radius` is looked at when the ray passes within that radius of its centre; the one the aim is deepest
 *    in wins when two are in reach of it. A thing behind a wall is never looked at this way.
 * 3. A thing looked at through its `Aim Radius` stays looked at for `Aim Hold` seconds after the aim left it, so that a shaking hand does not make its box blink. It stays while the aim is within one and a half times
 *    its radius, and only a thing that has an `Aim Radius` is held at all.
 * E uses what is looked at, so the box that is shown is what E does: nothing is used that the box does not say.
 *
 * It also tells the `Hud` which things that can be used are near and in sight (`Marker Range`, at most `Max Markers`, the nearest first), where on the screen, so the page can mark them: the one looked at gets a
 * glass box with what E does (tied to the thing by a line, or on it, by the `Marker` of its Interactable), the others a small mark. The mark nearest to where the player looks, within `Peek Angle`, says its
 * name next to it (what a thing is can be learned without aiming at it exactly; a door has no name to give, a pickup has its item's). The point on the screen comes from the camera on this entity (the eyes)
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

  @Float({ header: 'Aim', label: 'Aim Hold', suffix: 's', tooltip: 'How long a thing that helps the aim (its Aim Radius) stays looked at after the aim left it, so that a shaking hand does not make its box blink. 0: it goes at once.' }) aimHold = 0.2;

  @Ref(AudioSource, { header: 'Sound', label: 'Audio Source', tooltip: 'Plays the sounds of the player\'s side (a pickup, a use that cannot be done). Give it an Audio Source with Auto Play and Spatial off.' }) audio?: AudioSource;
  @Ref(AudioTrack, { label: 'Deny Sound', tooltip: 'Played when the player tries something that cannot be done.' }) denySound = '';
  @Float({ label: 'Pitch Variation', tooltip: 'How much the pitch changes from one time to the next, as a fraction.' }) pitchVariation = 0.05;

  @Float({ header: 'Markers', label: 'Marker Range', suffix: 'm', tooltip: 'How far from the eyes a thing that can be used gets a marker on the screen. 0 draws none.' }) markerRange = 6;
  @Int({ label: 'Max Markers', tooltip: 'How many markers at once: the nearest ones. The one looked at, and the one that says its name, are always among them.' }) maxMarkers = 4;
  @Float({ label: 'Peek Angle', suffix: '°', tooltip: 'The marker nearest to where the player looks, within this many degrees, says the name of its thing next to it (a pickup\'s item), so that a small thing can be told before it is aimed at exactly. The one looked at has its box instead. 0: no names.' }) peekAngle = 12;

  @Inject(Hud) hud!: Hud;

  /** What the player is looking at and can use now, or nothing. */
  @JsonIgnore() target?: Interactable;
  /** The target changed: the new one, or undefined when the player looks at nothing that can be used. */
  @JsonIgnore() onTargetChange = new Signal<Interactable | undefined>();

  @JsonIgnore() private key?: ReturnType<typeof Input.keyboard.keyE.down>;
  @JsonIgnore() private readonly origin = new Vector3();
  @JsonIgnore() private readonly direction = new Vector3();
  @JsonIgnore() private readonly toward = new Vector3();
  // The things that can be used, found again every half second (a scan of the scene is not for every frame) and measured every frame.
  @JsonIgnore() private candidates: ICandidate[] = [];
  @JsonIgnore() private sinceScan = Infinity;
  // The thing the aim holds because it has an Aim Radius, and for how long the aim has been away from it; and the marker that is saying its name (its entity's id).
  @JsonIgnore() private held?: Interactable;
  @JsonIgnore() private lostFor = 0;
  @JsonIgnore() private peeked?: string;

  onStart() {
    this.listen();
  }

  // A restored component that had started does not start again, and a load took every Input listener with it: it listens again.
  onRestore() {
    if (this.started) this.listen();
  }

  onUpdate() {
    if (!this.running) return;

    this.refresh();
    const target = this.aim(Time.deltaTime);
    this.watch(target);
    this.mark(target);
  }

  onDisable() {
    this.forget();
    this.watch(undefined);
    this.hud?.setMarkers([]);
  }

  onDestroy() {
    if (this.key) Input.removeListner(this.key);
    this.key = undefined;
    this.forget();
    this.watch(undefined);
    this.hud?.setMarkers([]);
  }

  // The copy made for Play holds the original's handle, which must not be removed with the copy's own: dropped, never removed (see docs/scripts.md). What it found in the scene is the original's too.
  onAfterClone() {
    this.key = undefined;
    this.target = undefined;
    this.candidates = [];
    this.sinceScan = Infinity;
    this.forget();
  }

  /** E: uses what the player looks at. Returns whether anything was used. */
  use(): boolean {
    if (!this.running) return false;

    const interactable = this.aim(0);
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

  // What the player is looking at: see the rules above. `elapsed` is the time since the last look (0 for the look E makes, which does not run the hold's clock).
  private aim(elapsed: number): Interactable | undefined {
    const matrix = this.entity.transform.worldMatrix;
    const length = Math.hypot(matrix[8], matrix[9], matrix[10]) || 1;
    this.origin.set(matrix[12], matrix[13], matrix[14]);
    this.direction.set(-matrix[8] / length, -matrix[9] / length, -matrix[10] / length);

    const hit = PhysicsSystem.raycast(this.origin, this.direction, this.reach, { ignore: this.body ?? this.root() });
    const under = hit && this.interactableAbove(hit.entity);
    if (under) return this.hold(under);

    const helped = this.helped();
    if (helped) {
      this.held = helped;
      this.lostFor = 0;
      return helped;
    }
    return this.linger(elapsed);
  }

  // The crosshair is on a thing: it is the target if it can be used (one that cannot is looked at all the same, so nothing near it takes its place), and it is the one held if it helps the aim.
  private hold(thing: Interactable): Interactable | undefined {
    this.lostFor = 0;
    if (!thing.usable) {
      this.held = undefined;
      return undefined;
    }

    this.held = thing.aimRadius > 0 ? thing : undefined;
    return thing;
  }

  // The first Interactable from an entity up through its parents.
  private interactableAbove(entity: Entity): Interactable | undefined {
    for (let current: Entity | undefined = entity; current; current = current.parent) {
      const interactable = current.getComponent(Interactable);
      if (interactable?.activeInHierarchy) return interactable;
    }
    return undefined;
  }

  // Where the crosshair is on nothing to use: the thing whose Aim Radius the ray passes through, the one it is deepest in, and not one behind a wall.
  private helped(): Interactable | undefined {
    const inside: { candidate: ICandidate; zone: IZone }[] = [];
    this.candidates.forEach(candidate => {
      const zone = this.zoneOf(candidate);
      if (zone) inside.push({ candidate, zone });
    });

    return inside
      .sort((a, b) => a.zone.depth - b.zone.depth)
      .find(entry => !this.isBehindSomething(entry.candidate.thing, entry.zone.point, entry.zone.distance))?.candidate.thing;
  }

  // The aim has just left the thing it held: it is still looked at for `Aim Hold` seconds, as long as it can still be used and is in reach and in sight.
  private linger(elapsed: number): Interactable | undefined {
    const thing = this.held;
    if (!thing) return undefined;

    this.lostFor += elapsed;
    if (this.lostFor >= this.aimHold || !this.stillThere(thing)) {
      this.held = undefined;
      return undefined;
    }
    return thing;
  }

  private stillThere(thing: Interactable): boolean {
    if (!thing.activeInHierarchy || !thing.usable) return false;

    const point = this.aimPointOf(this.candidateOf(thing));
    const distance = Vector3.distance(point, this.origin);
    return distance - thing.aimRadius <= this.reach && !this.isBehindSomething(thing, point, distance);
  }

  // Where the ray is against the zone of a candidate: a sphere of its `Aim Radius` around its centre (one and a half times as big for the one already held). `depth` is 0 on the centre and 1 at the edge. Nothing when the
  // ray is outside it, when the thing does not help the aim, or when it is out of reach.
  private zoneOf(candidate: ICandidate): IZone | undefined {
    const thing = candidate.thing;
    if (thing.aimRadius <= 0 || !thing.activeInHierarchy || !thing.usable) return undefined;
    if (Vector3.distance(thing.entity.transform.globalPosition, this.origin) > this.reach + thing.aimRadius + MODEL_OFFSET) return undefined;

    const point = this.aimPointOf(candidate);
    const dx = point.x - this.origin.x, dy = point.y - this.origin.y, dz = point.z - this.origin.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance - thing.aimRadius > this.reach) return undefined;

    const along = dx * this.direction.x + dy * this.direction.y + dz * this.direction.z;
    if (along <= 0) return undefined;

    const radius = thing.aimRadius * (thing === this.held ? HELD_RADIUS : 1);
    const across = Math.sqrt(Math.max(distance * distance - along * along, 0));
    return across <= radius ? { depth: across / radius, point, distance } : undefined;
  }

  // What is on the screen to be used: near, in front of the camera, within the screen, not behind a wall (the one looked at needs no ray: the look already found it), and not asked to be left out.
  // The one looked at comes first, then the ones the aim is near enough to for a name (the nearest first), then the rest by distance.
  private mark(focused: Interactable | undefined): void {
    const markers: IHudMarker[] = [];
    const camera = this.entity.getComponent(Camera);
    let peeking: string | undefined;

    if (camera && this.markerRange > 0 && this.maxMarkers > 0) {
      const matrix = camera.viewProjectionMatrix;
      const found: { thing: Interactable; distance: number; x: number; y: number; point: Vector3; near: number }[] = [];
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

        found.push({ thing, distance, x: x * 0.5 + 0.5, y: 0.5 - y * 0.5, point, near: this.nearness(thing, point, distance) });
      });

      const rank = (item: { thing: Interactable; near: number }) => item.thing === focused ? 0 : item.near <= 1 ? 1 : 2;
      found.sort((a, b) => rank(a) - rank(b) || (rank(a) === 1 ? a.near - b.near : a.distance - b.distance));
      for (const item of found) {
        if (markers.length >= this.maxMarkers) break;
        if (item.thing !== focused && this.isBehindSomething(item.thing, item.point, item.distance)) continue;

        const isFocused = item.thing === focused;
        const names = peeking === undefined && !isFocused && item.near <= 1;
        if (names) peeking = item.thing.entity.id;
        const caption = isFocused ? item.thing.caption : undefined;
        markers.push({ id: item.thing.entity.id, x: Math.round(item.x * MARKER_PRECISION) / MARKER_PRECISION, y: Math.round(item.y * MARKER_PRECISION) / MARKER_PRECISION, prompt: isFocused ? item.thing.promptFor(this) : '', title: caption?.title ?? '', body: caption?.body ?? '', peek: names ? item.thing.peekName : '', focused: isFocused, line: item.thing.marker === 'line' });
      }
    }

    this.peeked = peeking;
    this.hud.setMarkers(markers);
  }

  // How near the aim is to the mark of a thing that has a name to give: the angle between where the player looks and the mark, over `Peek Angle` (a third more for the mark that is saying its name now, so that the
  // name does not blink at the edge). Up to 1 is near enough, more is not; a thing with no name, or no `Peek Angle`, is never near.
  private nearness(thing: Interactable, point: Vector3, distance: number): number {
    if (this.peekAngle <= 0 || !thing.peekName || distance < 0.01) return Infinity;

    const cosine = ((point.x - this.origin.x) * this.direction.x + (point.y - this.origin.y) * this.direction.y + (point.z - this.origin.z) * this.direction.z) / distance;
    const angle = Math.acos(Math.min(Math.max(cosine, -1), 1)) * 180 / Math.PI;
    return angle / (this.peekAngle * (thing.entity.id === this.peeked ? PEEK_HELD : 1));
  }

  // The first thing a ray from the eyes to the point meets is not the thing itself (or a child of it) and is nearer than the point: a wall, a door, a crate.
  private isBehindSomething(thing: Interactable, point: Vector3, distance: number): boolean {
    if (distance < 0.01) return false;

    this.toward.set((point.x - this.origin.x) / distance, (point.y - this.origin.y) / distance, (point.z - this.origin.z) / distance);
    const hit = PhysicsSystem.raycast(this.origin, this.toward, distance, { ignore: this.body ?? this.root() });
    if (!hit || hit.distance >= distance - 0.25) return false;

    for (let entity: Entity | undefined = hit.entity; entity; entity = entity.parent) if (entity === thing.entity) return false;
    return true;
  }

  // Where a marker is tied: the centre of the biggest thing the entity is drawn with (the leaf of a door, a pickup's model), as it is now, and `Marker Height` above it; the origin when nothing is drawn.
  private anchorOf(candidate: ICandidate): Vector3 {
    const point = this.aimPointOf(candidate);
    point.y += candidate.thing.markerHeight;
    return point;
  }

  // The centre of the thing as it is now: of what it is drawn with, else its origin. A new point each time.
  private aimPointOf(candidate: ICandidate): Vector3 {
    const { thing, renderer } = candidate;
    const center = renderer && centerOf(renderer);
    if (center) return center;

    const place = thing.entity.transform.globalPosition;
    return new Vector3(place.x, place.y, place.z);
  }

  // The thing's entry in what the scan found; one made on the spot for a thing that is newer than the scan.
  private candidateOf(thing: Interactable): ICandidate {
    return this.candidates.find(candidate => candidate.thing === thing) ?? { thing, renderer: biggestRenderer(thing.entity) };
  }

  // The things that can be used are looked for again every half second (not every frame): a thing that came after the last look is marked and helps the aim a moment later, and the ray finds it at once.
  private refresh(): void {
    this.sinceScan += Time.deltaTime;
    if (this.sinceScan < SCAN_EVERY) return;

    this.sinceScan = 0;
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
    const caption = target?.caption;
    this.hud?.setCaption(caption?.title ?? '', caption?.body ?? '');
    if (target === this.target) return;

    this.target = target;
    this.onTargetChange.emit(target);
  }

  // Nothing is held and no name is shown: a Play that begins, a copy, an Interactor that is switched off.
  private forget(): void {
    this.held = undefined;
    this.lostFor = 0;
    this.peeked = undefined;
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

// The thing the aim holds counts with a radius this many times as big, so that it is let go of later than it was taken.
const HELD_RADIUS = 1.5;

// The same for the marker that is saying its name now.
const PEEK_HELD = 1.3;

// The marker's place on the screen goes to the page in parts of the window (a hundred thousandth: a tenth of a pixel at 4K). It was a thousandth, which is 1.3 px on a 1280 window and 3.8 px on a 4K one: a label that
// moves 3 px a frame moved in steps of 2.6 and 3.8 px and trembled, more on a bigger screen.
const MARKER_PRECISION = 100000;

// How far a thing's model may sit from its entity's origin, metres: a thing whose origin is farther than the reach and its radius by more than this is not measured at all.
const MODEL_OFFSET = 1;

// A thing that can be used, and the renderer its marker is tied to (none: its origin).
interface ICandidate {
  thing: Interactable;
  renderer?: MeshRenderer;
}

// The ray against the zone of a thing that helps the aim: how deep in it is (0 centre, 1 edge), the centre, and its distance from the eyes.
interface IZone {
  depth: number;
  point: Vector3;
  distance: number;
}
