import { AudioMixerSystem, AudioSource, BraveEngine, BraveEngineModeEnum, Camera, Cursor, Entity, FirstPersonCamera, Input, PlayerMovement, Project, Screen, Service, Signal, Store, Subtitles, Translate, UISystem } from '@brave/core';

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

const SENSITIVITY = { min: 0.2, max: 3, start: 1 };
const FIELD_OF_VIEW = { min: 50, max: 110 };
const VOLUME_SILENCE_DECIBELS = -80;
// A pointer let go within this many milliseconds of being taken is not the player pausing: it is the browser dropping a lock it had only just given (the Esc that closed a menu, still being handled as the key that lets
// go of the pointer: `Cursor.lockAfterEscape()` asks again once it is done), and the menu must not open for it.
const BLINK_MS = 400;
// An Esc that comes twice at once (the page of the menu forwards it and the window hears it) is one.
const ESCAPE_DEBOUNCE_MS = 200;

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
@Service()
export class PauseMenu {
  state: IPauseMenuState = { open: false, sensitivity: SENSITIVITY.start, fieldOfView: 60, volume: 1, languageBusy: false, canQuit: false };

  /** The whole state, a new object each time (the Bridge only sends what is not `===` the last). */
  onChange = new Signal<IPauseMenuState>();

  /** On: the game stands still while the menu is open. Off: it goes on behind it. */
  pausesGame = true;

  @Store({ prefix: 'settings', customName: 'mouseSensitivity' }) savedSensitivity?: number;
  @Store({ prefix: 'settings', customName: 'fieldOfView' }) savedFieldOfView?: number;
  @Store({ prefix: 'settings', customName: 'volume' }) savedVolume?: number;
  @Store({ prefix: 'settings', customName: 'language' }) savedLanguage?: string;
  @Store({ prefix: 'settings', customName: 'subtitles' }) savedSubtitles?: boolean;

  // The player's camera as the scene made it (what a multiple of sensitivity is a multiple of), by the id of the component: a load or a restart builds the camera again with the same id and what the menu had made of its
  // sensitivity, so the camera itself cannot say what it was made with. The pointer was held once, and the pause is the menu's.
  private baseSensitivity = new Map<string, number>();
  private armed = false;
  private pausedByMenu = false;
  private releaseExpected = false;
  private lockedAt = -Infinity;
  private lastEscape = -Infinity;
  private listener = () => this.onLockChange();
  private escapeListener?: Parameters<typeof Input.removeListner>[0];

  onStart() {
    this.state.sensitivity = this.savedSensitivity ?? SENSITIVITY.start;
    this.state.volume = this.savedVolume ?? 1;
    this.state.canQuit = canQuitHere();
    const view = this.eyes()?.getComponent(Camera);
    this.state.fieldOfView = this.savedFieldOfView ?? view?.fieldOfView ?? this.state.fieldOfView;
    this.apply();
    // Only a choice of the player is kept: a system that happens to ask for a language is no choice, and the game follows it again next time.
    const language = this.savedLanguage ?? Translate.systemLanguage;
    if (language) Translate.language = language;
    Subtitles.enabled = this.savedSubtitles ?? true;
    document.addEventListener('pointerlockchange', this.listener);
    // Esc while the menu is open closes it. The Esc that opened it was the browser's (it let the pointer go and the key never reached the page), and a key held down repeats without being a new press (`down` skips those).
    this.escapeListener = Input.keyboard.escape.down(() => this.onEscape());
    UISystem.interactive = false;
    this.changed();
  }

  onDestroy() {
    document.removeEventListener('pointerlockchange', this.listener);
    if (this.escapeListener) Input.removeListner(this.escapeListener);
    this.escapeListener = undefined;
    this.pausedByMenu = false;
    UISystem.interactive = true;
  }

  /** Another menu (the journal) has the screen: this one does not open when the pointer is let go (that is the other menu's doing, not the player's Esc) until the pointer is held again. It stays so for as many events as the browser sends, not for one. */
  expectRelease(): void {
    this.releaseExpected = true;
  }

  /** Opens the menu (and pauses the game, when `pausesGame`). */
  open(): void {
    if (this.state.open) return;
    this.state.open = true;
    this.state.canQuit = canQuitHere();
    UISystem.interactive = true;
    if (this.pausesGame && BraveEngine.mode === BraveEngineModeEnum.Running) {
      BraveEngine.pause();
      this.pausedByMenu = true;
    }
    this.changed();
  }

  /**
   * Esc closes the menu, gives the game back and takes the pointer again (the player pressed it to come back to the game). Not inside the key: the browser is still handling that Esc as the one that lets go of the
   * pointer, and gives it and drops it at once, so `Cursor.lockAfterEscape()` asks after the key, watches, asks again, and when the browser will not give a pointer that no click made, the next key that is not Esc
   * or the next click holds it. A pointer let go within a blink of being taken (`BLINK_MS`) is not taken for the player pausing, so the drops do not open the menu again. The keyboard goes back to the game with
   * `UISystem.interactive` off.
   */
  leave(): void {
    if (this.state.languageBusy) return;

    this.close();
    this.holdPointer(true);
  }

  /** The Resume button: asks for the pointer again (the click that made this call counts as the player's) and closes the menu either way, so that it never traps the player: if the pointer was not given, the next click on the game gives it. */
  resume(): void {
    if (this.state.languageBusy) return;

    this.holdPointer();
    this.close();
  }

  /**
   * A menu (this one, the journal) has closed: the pointer goes back to the game, in a build only. In the editor's Play the pointer stays free, so that the developer can take a screenshot, use the editor or look at
   * something with the game running and no menu in front: the next click on the game holds it (`Cursor.autoLockOnClick`) and Esc with it free opens the menu again. `afterEscape` is for a close made by the Esc key,
   * which the browser does not count as a gesture and is still handling: the pointer is asked for after it (`Cursor.lockAfterEscape()`).
   */
  holdPointer(afterEscape = false): void {
    if (!Project.compiled) return;
    void (afterEscape ? Cursor.lockAfterEscape() : Cursor.lock());
  }

  /** Ends the game, by where it runs: the editor's Play is stopped (and fullscreen left), an installed build quits. Nothing happens in a browser tab (`state.canQuit` is false there). The page asks the player to confirm first. */
  quit(): void {
    if (!canQuitHere()) return;

    if (!Project.compiled) {
      // The editor's own Stop also leaves the fullscreen it entered for the Play: a game cannot reach the editor's code, but `Screen` does the same. Never `nw.App.quit()` here: it would close the editor.
      BraveEngine.stop();
      if (Screen.fullscreen) Screen.fullscreen = false;
      return;
    }
    nwApp()?.quit();
  }

  /**
   * The player chose a language (the menu's list, each in its own words): the game uses it at once, the pages hear of it through `Translate`, and the next start begins with it. The voices of the new language
   * are loaded before the game is given back (`AudioSource.whenLanguageReady()`): `state.languageBusy` is on meanwhile, and Continue and Esc do nothing.
   */
  async setLanguage(code: string): Promise<void> {
    Translate.language = code;
    this.savedLanguage = Translate.language;
    this.state.languageBusy = true;
    this.changed();
    try {
      await AudioSource.whenLanguageReady();
    } finally {
      this.state.languageBusy = false;
      this.changed();
    }
  }

  /** The player turned the subtitles on or off: the engine shows or hides them at once and the next start begins the same way. */
  setSubtitles(enabled: boolean): void {
    Subtitles.enabled = enabled;
    this.savedSubtitles = enabled;
  }

  /** Puts the player's settings on the camera of the player that is on, again: a load or a restart builds a new player whose camera has what the scene was saved with. */
  reapply(): void {
    this.apply();
  }

  setSensitivity(value: number): void {
    this.state.sensitivity = clamp(value, SENSITIVITY.min, SENSITIVITY.max);
    this.savedSensitivity = this.state.sensitivity;
    this.apply();
    this.changed();
  }

  setFieldOfView(degrees: number): void {
    this.state.fieldOfView = clamp(degrees, FIELD_OF_VIEW.min, FIELD_OF_VIEW.max);
    this.savedFieldOfView = this.state.fieldOfView;
    this.apply();
    this.changed();
  }

  setVolume(value: number): void {
    this.state.volume = clamp(value, 0, 1);
    this.savedVolume = this.state.volume;
    this.apply();
    this.changed();
  }

  private close(): void {
    if (!this.state.open) return;
    this.state.open = false;
    UISystem.interactive = false;
    if (this.pausedByMenu && BraveEngine.mode === BraveEngineModeEnum.Paused) BraveEngine.play();
    this.pausedByMenu = false;
    this.changed();
  }

  // Esc. With the browser keeping it the menu opens by the pointer being let go (`onLockChange`), and this only closes it. With the game keeping it (fullscreen) the pointer is still held when the key arrives, and
  // opening the menu is the game's to do: it lets go of the pointer itself. And a game that runs with the pointer free (the browser would not give it back after a menu) opens the menu on Esc as well: there is no
  // lock for the browser to let go of, so the key reaches the page. Not while the editor has the mouse (a Shift+Esc in the editor's Play: an Esc typed into a field of the editor is not the player pausing).
  private onEscape(): void {
    const now = performance.now();
    if (now - this.lastEscape < ESCAPE_DEBOUNCE_MS) return;
    this.lastEscape = now;

    if (this.state.open) {
      this.leave();
      return;
    }
    if (Cursor.escapeIsOurs && Cursor.isLocked) {
      this.armed = true;
      Cursor.unlock();
      this.open();
      return;
    }
    if (this.armed && !Cursor.isLocked && !this.releaseExpected && !Cursor.releasedForEditor && !BraveEngine.priorityCamera && BraveEngine.mode === BraveEngineModeEnum.Running) {
      Cursor.unlock();
      this.open();
    }
  }

  // The pointer taken away by the player, after it was held, opens the menu; held again, it closes it. Not while the editor's own camera shows the view (a Play looked at through it): the pointer is the editor's then (it
  // takes it to fly the camera), and a lock that is not the game's is not the player coming back to it (it closed the menu and set the paused game going). Nor when the developer let go of it to use the editor
  // (`Cursor.releasedForEditor`, a Shift+Esc in the editor's Play): the game goes on, with no menu in front, until a click on it holds the pointer again.
  private onLockChange(): void {
    if (BraveEngine.priorityCamera) return;

    const now = performance.now();
    if (Cursor.isLocked) {
      this.lockedAt = now;
      this.armed = true;
      this.releaseExpected = false;
      this.close();
      return;
    }
    if (this.releaseExpected || Cursor.releasedForEditor || now - this.lockedAt < BLINK_MS) return;
    if (this.armed) this.open();
  }

  // The settings on what they act on. The sensitivity is a multiple of what the camera had when it was first seen.
  private apply(): void {
    const eyes = this.eyes();
    const look = eyes?.getComponent(FirstPersonCamera);
    if (look) {
      if (!this.baseSensitivity.has(look.id)) this.baseSensitivity.set(look.id, look.sensitivity);
      look.sensitivity = (this.baseSensitivity.get(look.id) as number) * this.state.sensitivity;
    }
    const view = eyes?.getComponent(Camera);
    if (view) view.fieldOfView = this.state.fieldOfView;

    const { mixer } = AudioMixerSystem;
    mixer.setGain(mixer.root, this.state.volume <= 0.001 ? VOLUME_SILENCE_DECIBELS : 20 * Math.log10(this.state.volume));
    AudioMixerSystem.sync();
  }

  // The camera of the player that is on: the entity under the first root with a `PlayerMovement` that is on, that has a `First Person Camera`.
  private eyes(): Entity | undefined {
    const player = BraveEngine.scenes.flatMap(scene => scene.children).find(root => root.activeInHierarchy && root.getComponent(PlayerMovement));
    return player?.children.find(child => child.getComponent(FirstPersonCamera));
  }

  private changed(): void {
    this.onChange.emit({ ...this.state });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
}

/** The slice of NW.js's `nw.App` that quitting uses. */
interface INwApp {
  quit(): void;
}

// NW.js has a global `nw` (the runtime tells it the same way); a plain browser does not.
function nwApp(): INwApp | undefined {
  return (window as unknown as { nw?: { App?: INwApp } }).nw?.App;
}

// The editor's Play can be stopped from the game and an installed app can quit; a page in a browser tab cannot close itself.
function canQuitHere(): boolean {
  return !Project.compiled || nwApp() !== undefined;
}
