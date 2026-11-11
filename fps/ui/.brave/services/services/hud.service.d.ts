import { Signal } from '@brave/core';
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
export declare class Hud {
    state: IHudState;
    /** The whole state, a new object each time (the Bridge only sends what is not `===` the last). */
    onChange: Signal<IHudState>;
    /** A shot that hit something that can be hurt: where on it (the zone's name) and whether it was the last blow. The page's hit marker. */
    onHit: Signal<{
        zone: string;
        kill: boolean;
    }>;
    /** The player was hurt: how much. The page's red flash. */
    onDamaged: Signal<number>;
    private messageTimer?;
    setPrompt(text: string): void;
    setAmmo(ammo: number, magazine: number, reserve: number): void;
    setHealth(health: number, maxHealth: number): void;
    setStance(stance: string): void;
    setItems(items: string[]): void;
    /** A line for `seconds` of game time (an engine timer: it stops with Pause). */
    showMessage(text: string, seconds?: number): void;
    notifyHit(zone: string, kill: boolean): void;
    notifyDamaged(amount: number): void;
    private changed;
}
