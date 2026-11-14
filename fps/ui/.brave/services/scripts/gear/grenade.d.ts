import { ScriptComponent } from '@brave/core';
/**
 * A grenade in the air: on the root of its own prefab (a dynamic Rigid Body with a small Collider, and the model), thrown by a `Throwable`. It bounces where it lands, and when the fuse runs out it
 * goes off: the engine's Small explosion at its place, and every `Health` inside the radius takes damage that falls off with the distance. A wall between the blast and a body protects it (a ray
 * from the blast, and what has no `Health` in the way stops it); a rigid body in the radius is pushed away.
 *
 * The blast is heard from where it happens (`Blast Sound`): the grenade is gone in the same frame, so the sound is played by an entity of its own at the blast (an Audio Source that is started by hand), which is
 * taken away when the sound has ended.
 *
 * Nothing about the thrower is kept: the damage is dealt in the name of the grenade, so a player in the radius is hurt like anyone else (the hit indicator points at the blast).
 */
export declare class Grenade extends ScriptComponent {
    fuse: number;
    radius: number;
    damage: number;
    push: number;
    size: number;
    blastSound: string;
    /** Seconds left on the fuse: it is set when the grenade starts, and kept in a save. */
    remaining: number;
    private exploded;
    onStart(): void;
    onUpdate(): void;
    /** The blast, now: the explosion on the screen, the damage and the push, and the grenade is gone. */
    explode(): void;
    private show;
    private bang;
    private hurtAround;
    private pushAway;
    private falloff;
    private isBlocked;
}
