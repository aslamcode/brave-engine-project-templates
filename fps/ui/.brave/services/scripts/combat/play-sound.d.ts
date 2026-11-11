import { Entity } from '@brave/core';
/**
 * Plays the sound an entity holds: its own Audio Source, or one of its children's, picked at random (a gunshot with three variations is an entity with three children, each an Audio Source). A source that
 * may overlap itself (a rapid fire) has Pooling on. Does nothing for an entity with no sound, so a script can leave a sound field empty.
 */
export declare function playSound(holder?: Entity): void;
