import { Entity, ScriptComponent } from '@brave/core';
import { Hud } from '../../services/hud.service';
/**
 * What the player sees and hears of its own `Health`: the health bar, the indicator of the side a blow came from, and the cry when it is hurt. It only listens to the `Health`; what happens at zero is the
 * `Respawn`'s.
 */
export declare class DamageFeedback extends ScriptComponent {
    eyes: Entity;
    hurtSound?: Entity;
    hud: Hud;
    private health;
    onStart(): void;
    onRestore(): void;
    onEnable(): void;
    private bind;
    private showHealth;
    private onHurt;
    private sideOf;
}
