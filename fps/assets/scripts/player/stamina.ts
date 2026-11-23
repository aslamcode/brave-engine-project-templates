import { Bool, Float, Inject, JsonIgnore, PlayerMovement, Saved, SaveIgnore, Script, ScriptComponent, State, Time } from '@brave/core';
import { Hud } from '../../services/hud.service';

/**
 * A limit to the run, on the character that has the `Player Movement`: running spends the stamina, anything else gives it back. It is optional the way every component is: a character
 * without it, or with it unticked, runs for as long as the `run` control is held.
 *
 * It spends `1 / Run Seconds` of the stamina each second the character is sprinting (the run on, the keys moving the body, not crouched) and gives back `1 / Recover Seconds` each second it is not, in game
 * time (slow motion slows it, a pause holds it). When it runs out the character stops running and cannot run again until the stamina has got back to `Resume At`, and then `run` is pressed again:
 * a held key does not start a run by itself, or the character would run and walk by turns for as long as it is held. A character that stops by itself before it runs out can run again at once, with
 * whatever is left. The way the run is taken away is the Player Movement's own `canRun`.
 *
 * Its numbers are `@SaveIgnore()`: a fix to them reaches a game that was saved before it. The value and the out-of-breath state are the game's own, and are saved.
 *
 * The HUD shows a bar only while it matters: from the moment the character starts to run until the stamina is full again (and a moment after). Its mark says where `Resume At` is while the character is
 * out of breath.
 */
@Script()
export class Stamina extends ScriptComponent {

  // How long the bar stays after the stamina is full again, so that it does not blink out in the frame it fills.
  private static readonly HIDE_DELAY = 1;

  @SaveIgnore() @Float({ header: 'Stamina', label: 'Run Seconds', suffix: 's', tooltip: 'How long the character can run, from full to nothing.' }) runSeconds = 10;
  @SaveIgnore() @Float({ label: 'Recover Seconds', suffix: 's', tooltip: 'How long it takes to fill up again from nothing, while the character is not running.' }) recoverSeconds = 7;
  @SaveIgnore() @Float({ label: 'Resume At', suffix: '%', tooltip: 'After the stamina ran out the character can run again only from this share of it, with Run pressed again. A character that stopped before it ran out can run at once.' }) resumeAt = 30;
  @Bool({ label: 'Show Bar', tooltip: 'The HUD shows the stamina bar from the moment the character starts to run until it is full again.' }) showBar = true;

  @Inject(Hud) hud!: Hud;

  /** What is left, 0 to 1. */
  @State() @JsonIgnore() @Saved() value = 1;
  /** It ran out and has not got back to `Resume At`: the character cannot run. */
  @State() @JsonIgnore() @Saved() exhausted = false;

  // Found when it is needed, not in onStart(): a save brings the component back started, and onStart() does not run again.
  @JsonIgnore() private movement?: PlayerMovement;
  @JsonIgnore() private shown = false;
  @JsonIgnore() private quiet = 0;

  onUpdate() {
    const movement = this.movement ?? (this.movement = this.entity.getComponent(PlayerMovement) ?? undefined);
    if (!movement) return;

    const seconds = Time.deltaTime;
    const sprinting = movement.isSprinting;
    this.value = sprinting
      ? Math.max(this.value - seconds / Math.max(this.runSeconds, 0.01), 0)
      : Math.min(this.value + seconds / Math.max(this.recoverSeconds, 0.01), 1);

    if (this.value <= 0) this.exhausted = true;
    else if (this.exhausted && this.value >= this.resume) this.exhausted = false;
    movement.canRun = !this.exhausted;

    this.showOnHud(sprinting, seconds);
  }

  // The run is given back when this is switched off or taken away: a stamina that is not there limits nothing.
  onDisable() {
    if (this.movement) this.movement.canRun = true;
    this.shown = false;
    this.hud.setStamina(false, this.value, false, this.resume);
  }

  onDestroy() {
    this.onDisable();
  }

  private showOnHud(sprinting: boolean, seconds: number) {
    if (sprinting) { this.shown = true; this.quiet = 0; }
    else if (this.value >= 1) { this.quiet += seconds; if (this.quiet >= Stamina.HIDE_DELAY) this.shown = false; }
    else this.quiet = 0;

    this.hud.setStamina(this.showBar && this.shown, this.value, this.exhausted, this.resume);
  }

  //#region Getters

  // The share the stamina has to get back to, 0 to 1.
  private get resume(): number { return Math.min(Math.max(this.resumeAt, 0), 100) / 100; }

  //#endregion Getters
}
