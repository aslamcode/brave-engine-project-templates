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
export declare function parseRequirement(text: string): IRequirementPart[];
/** How far `parts` are met by `held` (how many of an id there are). */
export declare function progressOf(parts: IRequirementPart[], held: (id: string) => number): IRequirementProgress;
/**
 * Fills a prompt or a message: `{item}` is the name of the item, `{have}` and `{need}` the progress. A requirement that asks for more than one thing in all ends with ` (2 of 5)` by itself, unless the text
 * already says `{have}` somewhere (then it is placed where the text wants it).
 */
export declare function fillRequirement(text: string, item: string, progress: Pick<IRequirementProgress, 'have' | 'need'>): string;
