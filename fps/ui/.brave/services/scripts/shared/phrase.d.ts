/** The values a line of text is filled with: `{name}` in it is taken from here. */
export interface IPhraseParams {
    [name: string]: string | number | boolean;
}
/**
 * A line the game says itself (a message, a slot's name) in the player's language: the entry `path` of the language files when there is one, else `fallback`, in English. A project that took the language files out still reads
 * English, and one that has them but not this entry too. `{name}` in either is filled from `params`.
 *
 * ```ts
 * phrase('saves.saved', 'Saved to {slot}', { slot: 'Quick' });
 * ```
 *
 * It is read when it is said, so what stays on the screen (a slot's name) is said again when the language changes (`Translate.onChange`).
 */
export declare function phrase(path: string, fallback: string, params?: IPhraseParams): string;
/**
 * A text a scene or a script wrote, said in the player's language with its values in: the `{{ key }}` of the language files first, then `{item}`, `{amount}`... from `params`. So a Pickup's prompt is written
 * `{{ prompts.take }}` (the entry says "Take {item}", or "Pegar {item}") and the word order is the language's; written by hand as `Take {item}` it works too. A value that is itself an entry (an item's name,
 * `{{ items.medkit.name }}`) is read first, so that `{item}` stands for a word of the language and not for the key.
 */
export declare function fillText(text: string, params: IPhraseParams): string;
