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
    this.escapeListener = Input.keyboard.escape.down(() => { if (this.state.open) this.resume(); });
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

  /** The Resume button: asks for the pointer again (the click that made this call counts as the player's) and closes the menu either way, so that it never traps the player: if the pointer was not given, the next click on the game gives it. */
  resume(): void {
    void Cursor.lock();
    this.close();
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

  // The pointer taken away by the player, after it was held, opens the menu; held again, it closes it.
  private onLockChange(): void {
    if (Cursor.isLocked) {
      this.armed = true;
      this.releaseExpected = false;
      this.close();
      return;
    }
    if (this.releaseExpected) return;
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
