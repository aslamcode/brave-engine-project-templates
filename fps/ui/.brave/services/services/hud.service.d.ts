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
export declare class Hud {
    state: IHudState;
    /** The whole state, a new object each time (the Bridge only sends what is not `===` the last). */
    onChange: Signal<IHudState>;
    /** A shot that hit something that can be hurt: where on it (the zone's name) and whether it was the last blow. The page's hit marker. */
    onHit: Signal<{
        zone: string;
        kill: boolean;
    }>;
    /** The player was hurt: how much, and from which side (degrees from straight ahead, positive to the right, 180 behind; none when nothing says where it came from). The page's red flash and its mark on that side. */
    onDamaged: Signal<{
        amount: number;
        angle?: number;
    }>;
    /** The things the player can use that are on the screen now, every frame they move. The page's markers. */
    onMarkers: Signal<IHudMarker[]>;
    private messageTimer?;
    private markersKey;
    setPrompt(text: string): void;
    /** The rounds of the weapon in hand (`magazine` 0 for a gear that has none). A `reserve` below zero shows the count alone: a grenade, a medkit. */
    setAmmo(ammo: number, magazine: number, reserve: number): void;
    setHealth(health: number, maxHealth: number): void;
    setStance(stance: string): void;
    setCrosshair(crosshair: string): void;
    /** The spread, rounded to a thousandth of half the screen (a pixel or two): a change smaller than that is not sent. */
    setSpread(spread: number): void;
    setWeapons(weapons: string[], weapon: number): void;
    setAiming(aiming: boolean): void;
    setTarget(target: boolean): void;
    /** The markers on the screen. The page hears only when they changed: the same list (positions to a thousandth of the screen) is not sent again. */
    setMarkers(markers: IHudMarker[]): void;
    setItems(items: string[]): void;
    /** A line for `seconds` of game time (an engine timer: it stops with Pause). */
    showMessage(text: string, seconds?: number): void;
    notifyHit(zone: string, kill: boolean): void;
    notifyDamaged(amount: number, angle?: number): void;
    private changed;
}
