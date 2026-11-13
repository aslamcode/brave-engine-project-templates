import { AudioSource, Entity } from '@brave/core';
/** The order a holder with several variations plays them in: one after the other as they are in the Hierarchy, or any but the one before. */
export type SoundOrder = 'sequence' | 'random';
export interface ISoundOptions {
    /** The gain the source plays at. Left out: the one it has. */
    gain?: number;
    /** Default `random`. */
    order?: SoundOrder;
}
/**
 * Plays the sound an entity holds: its own Audio Source, or one of its children's (a gunshot with three variations is an entity with three children, each an Audio Source). The variation is never the one
 * that played before it (`random`), or the next in the order of the children (`sequence`). A source that may overlap itself (a rapid fire) has Pooling on. Does nothing for an entity with no sound, so a
 * script can leave a sound field empty.
 */
export declare function playSound(holder?: Entity, options?: ISoundOptions): void;
/**
 * Plays `clip` (the id of an audio asset: what an `@Ref(AudioTrack)` field holds) once through `source`, from its start, at a pitch that changes a little each time (`variation` is the fraction: 0.05 is five
 * percent either way), because the same sound twice in a row is never heard as the same sound. Does nothing when the source or the clip is missing.
 *
 * One Audio Source plays one clip at a time, so this swaps the clip it holds. A sound that starts while another still plays through the same source cuts the other.
 */
export declare function playClip(source: AudioSource | undefined, clip: string, variation?: number): void;
