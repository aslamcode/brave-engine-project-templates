import { Translate } from '@brave/core';

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
export function phrase(path: string, fallback: string, params?: Record<string, string | number | boolean>): string {
  return Translate.has(path) ? Translate.get<string>(path, params) : Translate.resolve(fallback, params);
}
