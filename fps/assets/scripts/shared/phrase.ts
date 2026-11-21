import { Translate } from '@brave/core';

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
export function phrase(path: string, fallback: string, params?: IPhraseParams): string {
  const values = readParams(params);
  return Translate.has(path) ? Translate.get<string>(path, values) : Translate.resolve(fallback, values);
}

/**
 * A text a scene or a script wrote, said in the player's language with its values in: the `{{ key }}` of the language files first, then `{item}`, `{amount}`... from `params`. So a Pickup's prompt is written
 * `{{ prompts.take }}` (the entry says "Take {item}", or "Pegar {item}") and the word order is the language's; written by hand as `Take {item}` it works too. A value that is itself an entry (an item's name,
 * `{{ items.medkit.name }}`) is read first, so that `{item}` stands for a word of the language and not for the key.
 */
export function fillText(text: string, params: IPhraseParams): string {
  return Translate.resolve(text, readParams(params));
}

// What a value holds is never read as an entry by `Translate` (a player's name with `{{` in it is safe), so the values the game itself wrote as entries are read here, before they go in.
function readParams(params?: IPhraseParams): IPhraseParams | undefined {
  if (!params) return undefined;

  const values: IPhraseParams = {};
  Object.keys(params).forEach(name => {
    const value = params[name];
    values[name] = typeof value === 'string' ? Translate.resolve(value) : value;
  });
  return values;
}
