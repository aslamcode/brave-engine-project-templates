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
  const source = options.variation !== undefined ? exactly(sources, options.variation) : variationOf(holder, sources, options.order ?? 'random');
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

/**
 * The places a step pattern names, in the order written, from what the Inspector holds: `'1 2 3 4 3 4 2 3'` is `[1, 2, 3, 4, 3, 4, 2, 3]`. A place is the position of a variation among the children of its holder, counted from 1.
 * Anything that is not a digit separates two of them, so spaces, commas and dashes all do, and a 0 names no variation and is left out. Nothing usable gives an empty list.
 */
export function parseStepPattern(text: string | undefined): number[] {
  return (text ?? '').split(/[^0-9]+/).map(Number).filter(place => Number.isInteger(place) && place >= 1);
}

function exactly(sources: AudioSource[], variation: number): AudioSource | undefined {
  if (!sources.length || !Number.isFinite(variation)) return undefined;
  const index = ((Math.trunc(variation) % sources.length) + sources.length) % sources.length;
  return sources[index];
}

function variationOf(holder: Entity, sources: AudioSource[], order: SoundOrder): AudioSource | undefined {
  if (sources.length <= 1) return sources[0];
  const last = lastPlayed.get(holder) ?? -1;
  const next = order === 'random' ? (last + 1 + Math.floor(Math.random() * (sources.length - 1))) % sources.length : (last + 1) % sources.length;
  lastPlayed.set(holder, next);
  return sources[next];
}
