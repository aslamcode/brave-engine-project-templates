/** One thing a lock asks for: an item id and how many of it. */
export interface IRequirementPart {
  id: string;
  count: number;
}

/** How a requirement stands against what is carried (or what is already in). */
export interface IRequirementProgress {
  /** How many of the whole it has: each part counts up to what it asks for, so a spare of one kind does not stand in for another. */
  have: number;
  /** How many the whole asks for. */
  need: number;
  /** The first part that is not complete yet, and how many of it are still missing; none when it is complete. */
  missing?: IRequirementPart;
  complete: boolean;
}

/**
 * Reads what a lock asks for from the text of one field: ids separated by commas, an id repeated or followed by `x3` asking for that many. `piece-1, piece-2, piece-3` is three different things (a puzzle of
 * three pieces), `fuse x5` is five of one kind. An empty text asks for nothing.
 */
export function parseRequirement(text: string): IRequirementPart[] {
  const parts: IRequirementPart[] = [];
  (text ?? '').split(',').forEach(raw => {
    const part = raw.trim();
    if (!part) return;

    const counted = /^(.+?)\s+[x×]\s*(\d+)$/i.exec(part);
    const id = counted ? counted[1].trim() : part;
    const count = counted ? Math.max(parseInt(counted[2], 10), 1) : 1;
    const known = parts.find(candidate => candidate.id === id);
    if (known) known.count += count;
    else parts.push({ id, count });
  });
  return parts;
}

/** How far `parts` are met by `held` (how many of an id there are). */
export function progressOf(parts: IRequirementPart[], held: (id: string) => number): IRequirementProgress {
  let have = 0, need = 0;
  let missing: IRequirementPart | undefined;
  parts.forEach(part => {
    const own = Math.min(Math.max(held(part.id), 0), part.count);
    have += own;
    need += part.count;
    if (own < part.count && !missing) missing = { id: part.id, count: part.count - own };
  });
  return { have, need, missing, complete: !missing };
}

/**
 * Fills a prompt or a message: `{item}` is the name of the item, `{have}` and `{need}` the progress. A requirement that asks for more than one thing in all ends with ` (2 of 5)` by itself, unless the text
 * already says `{have}` somewhere (then it is placed where the text wants it).
 */
export function fillRequirement(text: string, item: string, progress: Pick<IRequirementProgress, 'have' | 'need'>): string {
  const filled = text.replace('{item}', item).replace('{have}', String(progress.have)).replace('{need}', String(progress.need));
  return progress.need > 1 && !text.includes('{have}') ? `${filled} (${progress.have} of ${progress.need})` : filled;
}
