import { BraveEngine, BraveEngineModeEnum, Entity, Input, JsonIgnore, Ref, Script, ScriptComponent } from '@brave/core';
import { Health } from '../health/health';

/**
 * The player's flashlight: the `flashlight` action (F, R3 on a pad; the player changes it in the Controls screen) switches its `Beam` (an entity with a Spot light) on and off, with whatever is in hand. It is
 * not a gear (the carousel is what the hand holds), so no `Loadout` knows about it and it never takes the weapon's place. It lives on the `Player`, next to the `Loadout`.
 *
 * The `Beam` hangs from the `Eyes`, a little ahead of the camera and to its left (the weapon is on the right and would shadow it), so it shines along the camera's own -Z and goes wherever the player looks with no
 * constraint to solve, and ahead of the head so the head's own mesh does not shadow it. Whether it is lit is the Beam's own `active`, so the scene authors it (it starts dark) and a save brings it back with the
 * entity; nothing here has to remember it.
 *
 * The cone shows in the air when the camera's post-process stack has a Volumetric Light effect (the light's own Volumetric > Scattering scales it). The light moves with the camera all the time, so its shadow is not
 * cached (Light > Shadow > Cache Shadows off).
 */
@Script()
export class Flashlight extends ScriptComponent {

  @Ref(Entity, { header: 'Light', label: 'Beam', tooltip: 'The entity with the Spot light. The flashlight action switches it on and off; untick it to start dark. The player\'s hangs from the Eyes, so it shines where the camera looks.' }) beam?: Entity;

  @JsonIgnore() private listener?: ReturnType<ReturnType<typeof Input.action>['down']>;

  onStart() {
    this.listen();
  }

  onDestroy() {
    this.cancelListen();
  }

  // The copy holds the original's handle: it makes its own when it starts, and must never remove the original's.
  onAfterClone() {
    this.listener = undefined;
  }

  // A save brings the component back as it was, started: what `onStart()` registered is not there any more.
  onRestore() {
    this.cancelListen();
    this.listen();
  }

  /** Switches the beam on or off. It does nothing with no beam, with the owner off or dead, or with the game not running (a character that is switched off still hears the controls). */
  toggle(): void {
    if (!this.beam || !this.canUse()) return;
    this.beam.active = !this.beam.active;
  }

  //#region Getters
  /** Whether the beam is switched on. */
  get isLit(): boolean {
    return this.beam?.active === true;
  }
  //#endregion Getters

  private canUse(): boolean {
    return this.entity.activeInHierarchy && !this.entity.getComponent(Health)?.isDead && BraveEngine.mode === BraveEngineModeEnum.Running;
  }

  private listen() {
    this.listener = Input.action('flashlight').down(() => this.toggle());
  }

  private cancelListen() {
    if (this.listener) Input.removeListner(this.listener);
    this.listener = undefined;
  }
}
