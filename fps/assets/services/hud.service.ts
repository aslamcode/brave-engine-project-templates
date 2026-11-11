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
  /** What the player carries, one name for each item. */
  items: string[];
}

@Service()
export class Hud {
  state: IHudState = { prompt: '', ammo: 0, magazine: 0, reserve: 0, health: 100, maxHealth: 100, stance: 'relaxed', message: '', items: [] };

  /** The whole state, a new object each time (the Bridge only sends what is not `===` the last). */
  onChange = new Signal<IHudState>();
  /** A shot that hit something that can be hurt: where on it (the zone's name) and whether it was the last blow. The page's hit marker. */
  onHit = new Signal<{ zone: string; kill: boolean }>();
  /** The player was hurt: how much. The page's red flash. */
  onDamaged = new Signal<number>();

  private messageTimer?: number;

  setPrompt(text: string): void {
    if (this.state.prompt === text) return;
    this.state.prompt = text;
    this.changed();
  }

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

  setItems(items: string[]): void {
    this.state.items = [...items];
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

  notifyDamaged(amount: number): void {
    this.onDamaged.emit(amount);
  }

  private changed(): void {
    this.onChange.emit({ ...this.state, items: [...this.state.items] });
  }
}
