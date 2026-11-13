import { Signal } from '@brave/core';
/** What the menu page shows: whether it is open, and the three settings the player can change. */
export interface IPauseMenuState {
    open: boolean;
    /** How much the mouse turns the view, as a multiple of what the camera was made with (1: as it is). */
    sensitivity: number;
    /** The vertical field of view of the camera, in degrees. */
    fieldOfView: number;
    /** The master volume, 0 to 1. */
    volume: number;
}
/**
 * The pause menu and the player's settings. The game holds the pointer while it is played, and the browser takes it back when the player presses Esc: that is when the menu opens (once the pointer has been
 * held at least once, so that it does not open before the first click), the game pauses, and the page in `ui/` shows the three settings and a Resume button. Clicking anywhere outside the panel holds the pointer
 * again, which closes it; so does the button, and so does Esc again (the browser does not count Esc as a gesture, so it may refuse the pointer: the menu closes and the game goes on all the same, and the next click holds it). The page only reads `state` and calls the methods.
 *
 * The settings are what a player chooses, so they are the game's own, kept in the Vault (`@Store`, under `settings.`) and applied when the game starts and at every change: the sensitivity and the field of view
 * go to the camera of the player that is on (the weapon reads them again at rest, so aiming scales from what the player chose), the volume to the master fader of the mixer (for that run only: the mixer file is
 * not written). `pausesGame` off keeps the game running behind the menu.
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
    private baseSensitivity;
    private armed;
    private pausedByMenu;
    private releaseExpected;
    private listener;
    private escapeListener?;
    onStart(): void;
    onDestroy(): void;
    /** Another menu (the journal) has the screen: this one does not open when the pointer is let go (that is the other menu's doing, not the player's Esc) until the pointer is held again. It stays so for as many events as the browser sends, not for one. */
    expectRelease(): void;
    /** Opens the menu (and pauses the game, when `pausesGame`). */
    open(): void;
    /** The Resume button: asks for the pointer again (the click that made this call counts as the player's) and closes the menu either way, so that it never traps the player: if the pointer was not given, the next click on the game gives it. */
    resume(): void;
    setSensitivity(value: number): void;
    setFieldOfView(degrees: number): void;
    setVolume(value: number): void;
    private close;
    private onLockChange;
    private apply;
    private eyes;
    private changed;
}
