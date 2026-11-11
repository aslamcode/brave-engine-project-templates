import { Entity, ScriptComponent, Signal } from '@brave/core';
import { Hud } from '../../services/hud.service';
/**
 * Waves of enemies: wave 1 has `First Wave` of them, every wave after it `Growth` more, and the next one comes `Pause Seconds` after the last enemy of the one before is gone. They are made from a prefab
 * with the engine's `SpawnSystem` (a wave is spread over a few frames, so there is no hitch), at the spawn points, which are the CHILDREN of this entity, in turn. After the last wave the HUD says so and the
 * spawner stops.
 *
 * It starts when the player steps into the trigger Collider of this entity (a pad on the ground), or when a script or a Director calls `start()`. The engine also has a `Spawner` component that makes things
 * at an interval with no code; this one waits for a wave to be cleared, which that cannot.
 *
 * What it knows is in numbers (`wave`, `isRunning`, `pauseLeft`) and in the things it spawned (it is their `owner`, and `SpawnSystem.countOf()` counts them), so a save brings it back whole.
 */
export declare class WaveSpawner extends ScriptComponent {
    private static readonly SCATTER;
    prefab: string;
    target?: Entity;
    waves: number;
    firstWave: number;
    growth: number;
    pauseSeconds: number;
    waveSound?: Entity;
    /** The number of the wave that is going on: 0 before the first, `Waves` at the last. */
    wave: number;
    /** The waves are going: from `start()` to the last wave cleared. */
    isRunning: boolean;
    /** Seconds to the next wave, while the last one is cleared and the pause goes on; 0 otherwise. */
    pauseLeft: number;
    /** A wave begins, told with its number. */
    onWaveStart: Signal<number>;
    /** The last enemy of a wave is gone, told with its number. */
    onWaveCleared: Signal<number>;
    /** The last wave was cleared. */
    onFinished: Signal<any>;
    hud: Hud;
    private batch?;
    onStart(): void;
    onUpdate(): void;
    onRestore(): void;
    /** Begins the first wave. Does nothing while the waves are going. */
    start(): void;
    private bind;
    private nextWave;
    private placements;
    private clear;
    private onEntered;
}
