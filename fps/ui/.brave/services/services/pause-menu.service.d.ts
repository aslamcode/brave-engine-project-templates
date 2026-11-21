import { Signal } from '@brave/core';
/** What the menu page shows: whether it is open, the three settings the player can change, and whether the game can be closed from here. */
export interface IPauseMenuState {
    open: boolean;
    /** How much the mouse turns the view, as a multiple of what the camera was made with (1: as it is). */
    sensitivity: number;
    /** The vertical field of view of the camera, in degrees. */
    fieldOfView: number;
    /** The master volume, 0 to 1. */
    volume: number;
    /** The player changed the language and the voices of the new one are being loaded: the menu says Loading and keeps Continue off until they are ready, so the game is given back already speaking it. */
    languageBusy: boolean;
    /** The game can be closed from the menu: in the editor's Play (it stops the Play) and in an installed build (the app quits), not in a browser tab, which a page cannot close. */
    canQuit: boolean;
}
/**
 * The pause menu and the player's settings. The game holds the pointer while it is played, and the browser takes it back when the player presses Esc: that is when the menu opens (once the pointer has been
 * held at least once, so that it does not open before the first click), the game pauses, and the page in `ui/` shows the three settings and a Resume button. Clicking anywhere outside the panel holds the pointer
 * again, which closes it; so does the button, and so does Esc again (the browser does not count Esc as a gesture, and is still handling that key when the game asks, so the pointer is asked for after it: see `leave()`). The page only reads `state` and calls the methods.
 * That hand-back is for a build (`holdPointer()`). In the editor's Play closing the menu leaves the pointer free (a screenshot, a look at the editor, with the game running and no menu): the next click on the game holds it.
 * In the editor's Play (a window) Shift+Esc is the developer asking for the mouse, not the player pausing: the menu does not open and the game goes on (`Cursor.releasedForEditor`).
 *
 * The settings are what a player chooses, so they are the game's own, kept in the Vault (`@Store`, under `settings.`) and applied when the game starts and at every change: the language (the engine's `Translate`: what
 * the player chose, else the one their system asks for when the game has it, else the project's default), the subtitles (the engine's `Subtitles`: on unless the player turned them off), the sensitivity and the field of view
 * go to the camera of the player that is on (the weapon reads them again at rest, so aiming scales from what the player chose), the volume to the master fader of the mixer (for that run only: the mixer file is
 * not written). `pausesGame` off keeps the game running behind the menu.
 *
 * Quit ends the game by where it runs, and is offered only where it can (`state.canQuit`): in the editor's Play it stops the Play and leaves fullscreen, as the editor's own Stop does (the editor itself stays open), in an
 * installed build under NW.js the app quits, and in a browser tab there is nothing a page may close, so the page does not show it. The page asks twice before it calls `quit()`, and before the `SaveGame` service's `restart()`.
 *
 * The page takes the mouse and the keyboard only while a menu is open (`UISystem.interactive`): closing one hands the keyboard back to the game, which a button or a slider that was clicked would otherwise keep inside
 * the page (the mouse still reached the game through the page's pointer bridging, the keys did not: the player could aim and shoot but not walk).
 */
export declare class PauseMenu {
    state: IPauseMenuState;
    /** The whole state, a new object each time (the Bridge only sends what is not `===` the last). */
    onChange: Signal<IPauseMenuState>;
    /** On: the game stands still while the menu is open. Off: it goes on behind it. */
    pausesGame: boolean;
    savedSensitivity?: number;
    savedFieldOfView?: number;
    savedVolume?: number;
    savedLanguage?: string;
    savedSubtitles?: boolean;
    private baseSensitivity;
    private armed;
    private pausedByMenu;
    private releaseExpected;
    private lockedAt;
    private lastEscape;
    private listener;
    private escapeListener?;
    onStart(): void;
    onDestroy(): void;
    /** Another menu (the journal) has the screen: this one does not open when the pointer is let go (that is the other menu's doing, not the player's Esc) until the pointer is held again. It stays so for as many events as the browser sends, not for one. */
    expectRelease(): void;
    /** Opens the menu (and pauses the game, when `pausesGame`). */
    open(): void;
    /**
     * Esc closes the menu, gives the game back and takes the pointer again (the player pressed it to come back to the game). Not inside the key: the browser is still handling that Esc as the one that lets go of the
     * pointer, and gives it and drops it at once, so `Cursor.lockAfterEscape()` asks after the key, watches, asks again, and when the browser will not give a pointer that no click made, the next key that is not Esc
     * or the next click holds it. A pointer let go within a blink of being taken (`BLINK_MS`) is not taken for the player pausing, so the drops do not open the menu again. The keyboard goes back to the game with
     * `UISystem.interactive` off.
     */
    leave(): void;
    /** The Resume button: asks for the pointer again (the click that made this call counts as the player's) and closes the menu either way, so that it never traps the player: if the pointer was not given, the next click on the game gives it. */
    resume(): void;
    /**
     * A menu (this one, the journal) has closed: the pointer goes back to the game, in a build only. In the editor's Play the pointer stays free, so that the developer can take a screenshot, use the editor or look at
     * something with the game running and no menu in front: the next click on the game holds it (`Cursor.autoLockOnClick`) and Esc with it free opens the menu again. `afterEscape` is for a close made by the Esc key,
     * which the browser does not count as a gesture and is still handling: the pointer is asked for after it (`Cursor.lockAfterEscape()`).
     */
    holdPointer(afterEscape?: boolean): void;
    /** Ends the game, by where it runs: the editor's Play is stopped (and fullscreen left), an installed build quits. Nothing happens in a browser tab (`state.canQuit` is false there). The page asks the player to confirm first. */
    quit(): void;
    /**
     * The player chose a language (the menu's list, each in its own words): the game uses it at once, the pages hear of it through `Translate`, and the next start begins with it. The voices of the new language
     * are loaded before the game is given back (`AudioSource.whenLanguageReady()`): `state.languageBusy` is on meanwhile, and Continue and Esc do nothing.
     */
    setLanguage(code: string): Promise<void>;
    /** The player turned the subtitles on or off: the engine shows or hides them at once and the next start begins the same way. */
    setSubtitles(enabled: boolean): void;
    /** Puts the player's settings on the camera of the player that is on, again: a load or a restart builds a new player whose camera has what the scene was saved with. */
    reapply(): void;
    setSensitivity(value: number): void;
    setFieldOfView(degrees: number): void;
    setVolume(value: number): void;
    private close;
    private onEscape;
    private onLockChange;
    private apply;
    private eyes;
    private changed;
}
