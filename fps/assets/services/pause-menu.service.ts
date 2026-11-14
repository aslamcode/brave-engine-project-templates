import { AudioMixerSystem, BraveEngine, BraveEngineModeEnum, Camera, Cursor, Entity, FirstPersonCamera, Input, PlayerMovement, Service, Signal, Store, UISystem } from '@brave/core';

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

const SENSITIVITY = { min: 0.2, max: 3, start: 1 };
const FIELD_OF_VIEW = { min: 50, max: 110 };
const VOLUME_SILENCE_DECIBELS = -80;
// A pointer let go within this many milliseconds of being taken is not the player pausing: it is the browser dropping a lock it had only just given (the same Esc that closed a menu, taken as the key that lets
// go of the pointer), and the menu must not open for it.
const BLINK_MS = 150;
// An Esc that comes twice at once (the page of the menu forwards it and the window hears it) is one.
const ESCAPE_DEBOUNCE_MS = 200;

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
@Service()
export class PauseMenu {
  state: IPauseMenuState = { open: false, sensitivity: SENSITIVITY.start, fieldOfView: 60, volume: 1 };

  /** The whole state, a new object each time (the Bridge only sends what is not `===` the last). */
  onChange = new Signal<IPauseMenuState>();

  /** On: the game stands still while the menu is open. Off: it goes on behind it. */
  pausesGame = true;

  @Store({ prefix: 'settings', customName: 'mouseSensitivity' }) savedSensitivity?: number;
  @Store({ prefix: 'settings', customName: 'fieldOfView' }) savedFieldOfView?: number;
  @Store({ prefix: 'settings', customName: 'volume' }) savedVolume?: number;

  // The player's camera as the scene made it (what a multiple of sensitivity is a multiple of), the pointer was held once, and the pause is the menu's.
  private baseSensitivity = new WeakMap<FirstPersonCamera, number>();
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
    const view = this.eyes()?.getComponent(Camera);
    this.state.fieldOfView = this.savedFieldOfView ?? view?.fieldOfView ?? this.state.fieldOfView;
    this.apply();
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
    UISystem.interactive = true;
    if (this.pausesGame && BraveEngine.mode === BraveEngineModeEnum.Running) {
      BraveEngine.pause();
      this.pausedByMenu = true;
    }
    this.changed();
  }

  /**
   * Esc closes the menu and gives the game back. In a window the key is the browser's: it let the pointer go to open the menu, and a request for the pointer made at the next Esc is refused (the key is not a gesture) or
   * granted and dropped again at the same Esc, so the menu would open once more at every Esc and never close: it is not asked for, and the next click on the game holds the pointer. In fullscreen the key is the game's
   * (`Cursor.escapeIsOurs`: the browser has handed it over), the pointer was let go by the game itself, and is taken back now, with no click.
   */
  leave(): void {
    this.close();
    if (Cursor.escapeIsOurs) void Cursor.lock();
  }

  /** The Resume button: asks for the pointer again (the click that made this call counts as the player's) and closes the menu either way, so that it never traps the player: if the pointer was not given, the next click on the game gives it. */
  resume(): void {
    void Cursor.lock();
    this.close();
  }

  /** Puts the player's settings on the camera of the player that is on, again: a load builds a new player whose camera has what its scene gave it. */
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
  // opening the menu is the game's to do: it lets go of the pointer itself.
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
    }
  }

  // The pointer taken away by the player, after it was held, opens the menu; held again, it closes it. Not while the editor's own camera shows the view (a Play looked at through it): the pointer is the editor's then (it
  // takes it to fly the camera), and a lock that is not the game's is not the player coming back to it (it closed the menu and set the paused game going).
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
    if (this.releaseExpected || now - this.lockedAt < BLINK_MS) return;
    if (this.armed) this.open();
  }

  // The settings on what they act on. The sensitivity is a multiple of what the camera had when it was first seen.
  private apply(): void {
    const eyes = this.eyes();
    const look = eyes?.getComponent(FirstPersonCamera);
    if (look) {
      if (!this.baseSensitivity.has(look)) this.baseSensitivity.set(look, look.sensitivity);
      look.sensitivity = (this.baseSensitivity.get(look) as number) * this.state.sensitivity;
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
