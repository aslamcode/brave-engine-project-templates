import { AnimationConstraint, IEntity } from '@brave/core';
/**
 * Keeps the weapon out of a wall. A ball goes from the eyes along the look, as far as the weapon reaches; when the level is nearer than that, the point the right hand reaches for (`Hold`) is pulled
 * towards the body, lowered and tilted about the hand, by exactly as much as it takes for the end of the barrel to stop `Margin` short of the wall (up to `Max Tilt`: from there on the weapon is as far
 * back as it goes). So the barrel follows the wall as it comes near, and no more of the weapon moves than has to. It is a constraint, so it works on the frame's pose: after the spine has leaned with the
 * look and the eyes have been put on the head, and before the hands reach for their points (give it an `Order` between the two). The hands follow it, and the weapon, which is the right hand's child, and the
 * left hand, which reaches for the weapon.
 *
 * It does not know how many cameras draw the character. With the arms drawn by their own camera (which clears the depth) the weapon never goes through a wall on the screen, and this is how it looks:
 * a weapon that gives way says "there is no room here". With ONE camera it is what keeps the weapon out of the wall. Untick the component and the weapon stays where the hands put it.
 *
 * The level is the fixed colliders (`PhysicsSystem.probeLevel`): a character, a crate or a sensor does not take the weapon back.
 */
export declare class WeaponRetreat extends AnimationConstraint {
    hold?: IEntity;
    eyes?: IEntity;
    weaponLength: number;
    margin: number;
    radius: number;
    maxTilt: number;
    pullBack: number;
    lower: number;
    inTime: number;
    outTime: number;
    /** 0: the weapon is where the hands put it. 1: all the way back. */
    retreat: number;
    private readonly place;
    private readonly axis;
    private readonly held;
    private readonly turn;
    protected bind(): boolean;
    protected apply(deltaTime: number, weight: number): void;
    onDisable(): void;
    private wanted;
    private limit;
    private follow;
}
