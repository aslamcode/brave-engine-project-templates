import { Entity, ScriptComponent } from '@brave/core';
import { Hud } from '../../services/hud.service';
/**
 * The player's side of its `Health`: what the screen says (`Hud`), the sound of being hurt, and what happens at zero: a message, a few seconds of nothing, and the player is back where it started with
 * full health and a full weapon. It is the one place that decides what dying costs the player; a game with lives or a checkpoint changes `respawn()` only.
 */
export declare class PlayerHealth extends ScriptComponent {
    eyes: Entity;
    hurtSound?: Entity;
    respawnSeconds: number;
    messageSeconds: number;
    hud: Hud;
    /** Seconds until the player is back, while it is dead; 0 when it is not. A count in the frame (not a timer), so that a save made while dead brings it back. */
    respawnLeft: number;
    private health;
    private body?;
    private movement?;
    private weapon?;
    private camera?;
    private start;
    onStart(): void;
    onUpdate(): void;
    onRestore(): void;
    onEnable(): void;
    /** The player is put back at the start with full health, a full weapon and control of its body. */
    respawn(): void;
    private bind;
    private showHealth;
    private onHurt;
    private sideOf;
    private onDied;
}
