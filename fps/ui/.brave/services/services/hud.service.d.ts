import { Signal } from '@brave/core';
/** What the HUD (the web page in `ui/`) shows. Everything in the game that wants something on the screen says it here; the page only reads. */
export interface IHudState {
    /** The line under the crosshair: what `interact` does on what the player looks at, or empty. */
    prompt: string;
    /** What the thing looked at says about itself, over that line: a title and a text. Both empty for a thing that says nothing but what `interact` does. */
    captionTitle: string;
    captionBody: string;
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
    /** What the player carries, one name for each item. The page does not draw it any more (the Journal has the list; what changes is `notices`): it is here for a page of a game that wants it. */
    items: string[];
    /** How long a notice of something picked up or spent stays on the screen: 0, it stays until newer ones push it out. */
    itemsSeconds: number;
    /** The last few things picked up or spent, oldest first, each with a number (`seq`) that only grows: a page remembers the last one it drew and draws the ones after it. */
    notices: IHudNotice[];
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
    /** The stamina of the run, 0 to 1, and whether the page shows its bar now (from the first step of a run until it is full again). */
    stamina: number;
    staminaShown: boolean;
    /** It ran out: the player cannot run until `staminaResume` (0 to 1, where the bar's mark is). */
    staminaExhausted: boolean;
    staminaResume: number;
}
/** Something picked up (`delta` above 0) or spent (below 0): what the page says in a notice at the corner of the screen, `+ Key`, `-2 Grenade`. */
export interface IHudNotice {
    /** Counts the notices of the game: the same number is never given twice. */
    seq: number;
    /** Which kind of item, so that two of the same kind close together are one notice (`+2 Key`). */
    id: string;
    /** The name to show: a text, or a `{{ key }}` of the language files that the page reads. */
    name: string;
    /** How many were added (positive) or taken (negative), and how many there are now. */
    delta: number;
    total: number;
}
/** A thing the player can use, drawn on the screen over it: where its anchor is on the screen (0 to 1 of the width and of the height, y down), what `interact` does on it, and which way to draw it. */
export interface IHudMarker {
    /** Which thing: the id of its entity, so the page keeps the same element for it from frame to frame. */
    id: string;
    x: number;
    y: number;
    /** What `interact` does, shown in the box of the marker the player looks at. */
    prompt: string;
    /** The title and the text of the one looked at, over what `interact` does in its box (empty for every other marker, and for a thing that says nothing). */
    title: string;
    body: string;
    /** The name of the thing, shown beside the small mark that is nearest to where the player looks (empty for every other one, and for the one looked at, which has its box). */
    peek: string;
    /** The one the player looks at and can use now: the others are small marks. */
    focused: boolean;
    /** A focused marker with a line down to the thing, or without (a box on it). */
    line: boolean;
    /** When the frame this position was worked out in was, in milliseconds since 1970 (`performance.timeOrigin + performance.now()`, the same clock in the page): with two of them the page places the marker where it is NOW, between readings, so that it moves with the camera on every frame the screen draws and not only on the ones a reading arrives. Filled by `Hud.setMarkers()`. */
    at?: number;
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
    private noticeSeq;
    private markersKey;
    private markersStill;
    setPrompt(text: string): void;
    /** The caption of what the player looks at, over the prompt. */
    setCaption(title: string, body: string): void;
    /** The rounds of the weapon in hand (`magazine` 0 for a gear that has none). A `reserve` below zero shows the count alone: a grenade, a medkit. */
    setAmmo(ammo: number, magazine: number, reserve: number): void;
    setHealth(health: number, maxHealth: number): void;
    setStance(stance: string): void;
    setCrosshair(crosshair: string): void;
    /** The spread, rounded to a thousandth of half the screen (a pixel or two): a change smaller than that is not sent. */
    setSpread(spread: number): void;
    setWeapons(weapons: string[], weapon: number): void;
    setAiming(aiming: boolean): void;
    /** The stamina bar. The value is rounded to half a percent (a pixel of the bar): a change smaller than that is not sent. */
    setStamina(shown: boolean, stamina: number, exhausted: boolean, resume: number): void;
    setTarget(target: boolean): void;
    /**
     * The markers on the screen, every frame they are worked out. The page hears when they changed, and once more when they stop (the same list again: a page that places a marker by its motion has to learn that it
     * is standing still); a list that is still is not sent over and over. Each marker carries the time of the frame (`at`).
     */
    setMarkers(markers: IHudMarker[]): void;
    setItems(items: string[]): void;
    /** Something was picked up (`delta` above 0) or spent (below 0): a notice for the page. Only the last few are kept; the page draws the ones it has not drawn (by `seq`) and keeps at most three on the screen. */
    notify(id: string, name: string, delta: number, total: number): void;
    /** How long a notice of something picked up or spent stays on the screen (0: until newer ones push it out). */
    setItemsSeconds(seconds: number): void;
    /** A line for `seconds` of game time (an engine timer: it stops with Pause). */
    showMessage(text: string, seconds?: number): void;
    notifyHit(zone: string, kill: boolean): void;
    notifyDamaged(amount: number, angle?: number): void;
    private changed;
}
