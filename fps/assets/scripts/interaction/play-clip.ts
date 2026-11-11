import { AudioSource } from '@brave/core';

/**
 * Plays `clip` (the id of an audio asset: what an `@Ref(AudioTrack)` field holds) once through `source`, from its start, at a pitch that changes a little each time (`variation` is the
 * fraction: 0.05 is five percent either way), because the same sound twice in a row is never heard as the same sound. Does nothing when the source or the clip is missing.
 *
 * One Audio Source plays one clip at a time, so this swaps the clip it holds. A sound that starts while another still plays through the same source cuts the other.
 */
export function playClip(source: AudioSource | undefined, clip: string, variation = 0.05): void {
  if (!source || !clip) return;

  source.stop();
  if (source.src !== clip) source.src = clip;
  // The pitch is set once play() has waited for the clip to load: a media element goes back to its normal rate whenever a new source is loaded, which happens after this function has returned.
  void source.play().then(() => { source.speed = 1 + (Math.random() * 2 - 1) * variation; });
}
