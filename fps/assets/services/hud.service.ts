import { Invoke, Service, Signal } from '@brave/core';

/** What the HUD (the web page in `ui/`) shows. Everything in the game that wants something on the screen says it here; the page only reads. */
export interface IHudState {
  /** The line under the crosshair: what E does on what the player looks at, or empty. */
  prompt: string;
  /** Rounds in the magazine, the size of the magazine and the rounds in reserve. */
  ammo: number;
  magazine: number;
  reserve: number;
  health: number;
  maxHealth: number;
  /** 'relaxed' (the weapon low) or 'alert' (the weapon at the shoulder). */
  stance: string;
  /** A line shown for a few seconds ("The door is locked"), or empty. */
  message: string;
  /** What the player carries, one name for each item. The page shows the list when it changes, not all the time. */
  items: string[];
  /** How long the list stays on the screen after it changed: 0, it is always there. */
  itemsSeconds: number;
  /** The crosshair is over something a shot would hurt: alive, with a `Health`, in the weapon's range, nothing in the way. The page turns the crosshair red. */
  target: boolean;
  /** Which crosshair the weapon in hand has: 'dot' (a centre and four ticks) or 'arcs' (a ring of four arcs round a dot) or 'twin-arcs' (two arcs, one each side of a dot, the shotgun's). */
  crosshair: string;
  /** How wide the weapon's cone is on the screen, as a share of half the screen's height: the page turns it into pixels, so the crosshair opens as the shots scatter, at any size of the window. */
  spread: number;
  /** The names of the weapons the player carries, in the order of their slots, and which one is in hand (an index into the list). */
  weapons: string[];
  weapon: number;
  /** The player is aiming (the right mouse button): the page lets the crosshair's ticks go. */
  aiming: boolean;
}

/** A thing the player can use, drawn on the screen over it: where its anchor is on the screen (0 to 1 of the width and of the height, y down), what E does on it, and which way to draw it. */
export interface IHudMarker {
  /** Which thing: the id of its entity, so the page keeps the same element for it from frame to frame. */
  id: string;
  x: number;
  y: number;
  /** What E does, shown in the box of the marker the player looks at. */
  prompt: string;
  /** The one the player looks at and can use now: the others are small marks. */
  focused: boolean;
  /** A focused marker with a line down to the thing, or without (a box on it). */
  line: boolean;
}

@Service()
export class Hud {
  state: IHudState = { prompt: '', ammo: 0, magazine: 0, reserve: 0, health: 100, maxHealth: 100, stance: 'relaxed', message: '', items: [], itemsSeconds: 4, target: false, crosshair: 'dot', spread: 0, weapons: [], weapon: 0, aiming: false };

  /** The whole state, a new object each time (the Bridge only sends what is not `===` the last). */
  onChange = new Signal<IHudState>();
  /** A shot that hit something that can be hurt: where on it (the zone's name) and whether it was the last blow. The page's hit marker. */
  onHit = new Signal<{ zone: string; kill: boolean }>();
  /** The player was hurt: how much, and from which side (degrees from straight ahead, positive to the right, 180 behind; none when nothing says where it came from). The page's red flash and its mark on that side. */
  onDamaged = new Signal<{ amount: number; angle?: number }>();
  /** The things the player can use that are on the screen now, every frame they move. The page's markers. */
  onMarkers = new Signal<IHudMarker[]>();

  private messageTimer?: number;
  private markersKey = '[]';

  setPrompt(text: string): void {
    if (this.state.prompt === text) return;
    this.state.prompt = text;
    this.changed();
  }

  /** The rounds of the weapon in hand (`magazine` 0 for a gear that has none). A `reserve` below zero shows the count alone: a grenade, a medkit. */
  setAmmo(ammo: number, magazine: number, reserve: number): void {
    Object.assign(this.state, { ammo, magazine, reserve });
    this.changed();
  }

  setHealth(health: number, maxHealth: number): void {
    Object.assign(this.state, { health, maxHealth });
    this.changed();
  }

  setStance(stance: string): void {
    if (this.state.stance === stance) return;
    this.state.stance = stance;
    this.changed();
  }

  setCrosshair(crosshair: string): void {
    if (this.state.crosshair === crosshair) return;
    this.state.crosshair = crosshair;
    this.changed();
  }

  /** The spread, rounded to a thousandth of half the screen (a pixel or two): a change smaller than that is not sent. */
  setSpread(spread: number): void {
    const rounded = Math.round(spread * 1000) / 1000;
    if (this.state.spread === rounded) return;
    this.state.spread = rounded;
    this.changed();
  }

  setWeapons(weapons: string[], weapon: number): void {
    if (this.state.weapon === weapon && this.state.weapons.length === weapons.length && this.state.weapons.every((name, index) => name === weapons[index])) return;
    this.state.weapons = [...weapons];
    this.state.weapon = weapon;
    this.changed();
  }

  setAiming(aiming: boolean): void {
    if (this.state.aiming === aiming) return;
    this.state.aiming = aiming;
    this.changed();
  }

  setTarget(target: boolean): void {
    if (this.state.target === target) return;
    this.state.target = target;
    this.changed();
  }

  /** The markers on the screen. The page hears only when they changed: the same list (positions to a thousandth of the screen) is not sent again. */
  setMarkers(markers: IHudMarker[]): void {
    const key = JSON.stringify(markers);
    if (key === this.markersKey) return;
    this.markersKey = key;
    this.onMarkers.emit(markers);
  }

  setItems(items: string[]): void {
    this.state.items = [...items];
    this.changed();
  }

  /** How long the list of what the player carries stays after it changed (0: always). */
  setItemsSeconds(seconds: number): void {
    const wanted = Number.isFinite(seconds) ? Math.max(seconds, 0) : 4;
    if (this.state.itemsSeconds === wanted) return;
    this.state.itemsSeconds = wanted;
    this.changed();
  }

  /** A line for `seconds` of game time (an engine timer: it stops with Pause). */
  showMessage(text: string, seconds = 2.5): void {
    this.state.message = text;
    this.changed();
    if (this.messageTimer !== undefined) Invoke.clearTimeout(this.messageTimer);
    this.messageTimer = Invoke.setTimeout(() => { this.state.message = ''; this.changed(); }, seconds * 1000);
  }

  notifyHit(zone: string, kill: boolean): void {
    this.onHit.emit({ zone, kill });
  }

  notifyDamaged(amount: number, angle?: number): void {
    this.onDamaged.emit({ amount, angle });
  }

  private changed(): void {
    this.onChange.emit({ ...this.state, items: [...this.state.items], weapons: [...this.state.weapons] });
  }
}
