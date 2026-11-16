import { ScriptComponent } from '@brave/core';
import { Hud } from '../../services/hud.service';
/**
 * A limit to the run, on the character that has the `Player Movement`: running spends the stamina, anything else gives it back. It is optional the way every component is: a character
 * without it, or with it unticked, runs for as long as Shift is held.
 *
 * It spends `1 / Run Seconds` of the stamina each second the character is sprinting (the run on, the keys moving the body, not crouched) and gives back `1 / Recover Seconds` each second it is not, in game
 * time (slow motion slows it, a pause holds it). When it runs out the character stops running and cannot run again until the stamina has got back to `Resume At`, and then Shift is pressed again:
 * a held key does not start a run by itself, or the character would run and walk by turns for as long as it is held. A character that stops by itself before it runs out can run again at once, with
 * whatever is left. The way the run is taken away is the Player Movement's own `canRun`.
 *
 * Its numbers are `@SaveIgnore()`: a fix to them reaches a game that was saved before it. The value and the out-of-breath state are the game's own, and are saved.
 *
 * The HUD shows a bar only while it matters: from the moment the character starts to run until the stamina is full again (and a moment after). Its mark says where `Resume At` is while the character is
 * out of breath.
 */
export declare class Stamina extends ScriptComponent {
    private static readonly HIDE_DELAY;
    runSeconds: number;
    recoverSeconds: number;
    resumeAt: number;
    showBar: boolean;
    hud: Hud;
    /** What is left, 0 to 1. */
    value: number;
    /** It ran out and has not got back to `Resume At`: the character cannot run. */
    exhausted: boolean;
    private movement?;
    private shown;
    private quiet;
    onUpdate(): void;
    onDisable(): void;
    onDestroy(): void;
    private showOnHud;
    private get resume();
}
