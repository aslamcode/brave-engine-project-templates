import { AudioSource, Entity } from '@brave/core';
/** The order a holder with several variations plays them in: one after the other as they are in the Hierarchy, or any but the one before. */
export type SoundOrder = 'sequence' | 'random';
export interface ISoundOptions {
    /** The gain the source plays at. Left out: the one it has. */
    gain?: number;
    /** Default `random`. */
    order?: SoundOrder;
    /**
     * Plays exactly this variation instead of choosing one (0 is the first, and a number past the last wraps round): for a caller that keeps an order of its own, the steps of a pattern. `order` is then not looked at.
     */
    variation?: number;
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
/**
 * The places a step pattern names, in the order written, from what the Inspector holds: `'1 2 3 4 3 4 2 3'` is `[1, 2, 3, 4, 3, 4, 2, 3]`. A place is the position of a variation among the children of its holder, counted from 1.
 * Anything that is not a digit separates two of them, so spaces, commas and dashes all do, and a 0 names no variation and is left out. Nothing usable gives an empty list.
 */
export declare function parseStepPattern(text: string | undefined): number[];
