import { AudioSource, Entity } from '@brave/core';

/** The order a holder with several variations plays them in: one after the other as they are in the Hierarchy, or any but the one before. */
export type SoundOrder = 'sequence' | 'random';

export interface ISoundOptions {
  /** The gain the source plays at. Left out: the one it has. */
  gain?: number;
  /** Default `random`. */
  order?: SoundOrder;
}

// The variation each holder played last: a sound that plays twice in a row, which a plain random choice does now and then, is what makes a gunshot, a step or a hurt cry sound like a machine.
const lastPlayed = new WeakMap<Entity, number>();

/**
 * Plays the sound an entity holds: its own Audio Source, or one of its children's (a gunshot with three variations is an entity with three children, each an Audio Source). The variation is never the one
 * that played before it (`random`), or the next in the order of the children (`sequence`). A source that may overlap itself (a rapid fire) has Pooling on. Does nothing for an entity with no sound, so a
 * script can leave a sound field empty.
 */
export function playSound(holder?: Entity, options: ISoundOptions = {}): void {
  if (!holder) return;
  const own = holder.getComponent(AudioSource);
  const sources = own ? [own] : holder.children.map(child => child.getComponent(AudioSource)).filter((source): source is AudioSource => !!source);
  const source = variationOf(holder, sources, options.order ?? 'random');
  if (!source) return;
  if (options.gain !== undefined) source.gain = Math.max(options.gain, 0);
  void source.play();
}

/**
 * Plays `clip` (the id of an audio asset: what an `@Ref(AudioTrack)` field holds) once through `source`, from its start, at a pitch that changes a little each time (`variation` is the fraction: 0.05 is five
 * percent either way), because the same sound twice in a row is never heard as the same sound. Does nothing when the source or the clip is missing.
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

function variationOf(holder: Entity, sources: AudioSource[], order: SoundOrder): AudioSource | undefined {
  if (sources.length <= 1) return sources[0];
  const last = lastPlayed.get(holder) ?? -1;
  const next = order === 'random' ? (last + 1 + Math.floor(Math.random() * (sources.length - 1))) % sources.length : (last + 1) % sources.length;
  lastPlayed.set(holder, next);
  return sources[next];
}
