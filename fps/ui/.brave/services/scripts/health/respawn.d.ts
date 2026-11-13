import { Entity, ScriptComponent } from '@brave/core';
import { Hud } from '../../services/hud.service';
/**
 * What happens to the player at zero health: a message, a few seconds of nothing, and the player is back where it started with full health and everything it carries full again. It is the one place that
 * decides what dying costs the player; a game with lives or a checkpoint changes `respawn()` only. What the screen and the ears say of the blows (the health bar, the hit indicator, the hurt cry) is the
 * `DamageFeedback`'s.
 */
export declare class Respawn extends ScriptComponent {
    eyes: Entity;
    respawnSeconds: number;
    messageSeconds: number;
    hud: Hud;
    /** Seconds until the player is back, while it is dead; 0 when it is not. A count in the frame (not a timer), so that a save made while dead brings it back. */
    respawnLeft: number;
    private health;
    private body?;
    private movement?;
    private loadout?;
    private camera?;
    private start;
    onStart(): void;
    onUpdate(): void;
    onRestore(): void;
    /** The player is put back at the start with full health, everything it carries full again and control of its body. */
    respawn(): void;
    private bind;
    private onDied;
}
