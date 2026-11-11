import { AudioSource } from '@brave/core';
/**
 * Plays `clip` (the id of an audio asset: what an `@Ref(AudioTrack)` field holds) once through `source`, from its start, at a pitch that changes a little each time (`variation` is the
 * fraction: 0.05 is five percent either way), because the same sound twice in a row is never heard as the same sound. Does nothing when the source or the clip is missing.
 *
 * One Audio Source plays one clip at a time, so this swaps the clip it holds. A sound that starts while another still plays through the same source cuts the other.
 */
export declare function playClip(source: AudioSource | undefined, clip: string, variation?: number): void;
