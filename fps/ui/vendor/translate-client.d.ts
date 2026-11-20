/** What `{name}` is told to be, in an entry such as `"Open {item}"`: a text, a number or true / false. */
export type TranslateParams = Readonly<Record<string, string | number | boolean>>;
/** A language of the project, as a menu lists it. */
export interface ITranslateLanguage {
    /** `pt-BR`: the name of the `.lang` file. */
    code: string;
    /** `Português (Brasil)`: the language in its own words. */
    name: string;
}
/**
 * The language, for a page of the UI. `get()` and `resolve()` read the language the game is in (what the engine's `Translate` would answer), `language` says which and changes it, `languages` lists the project's, and
 * `onChange` tells when any of that moves. Before the host has answered (the first moments of the page, or a page opened outside the game) an entry reads as its own path, as it does in the engine.
 *
 * ```ts
 * import { Translate } from '@brave/ui-bridge';
 * start.textContent = Translate.get('menu.start');
 * hint.textContent = Translate.get('prompt.open', { item: 'the door' });
 * Translate.language = 'pt-BR';                                  // the game changes; onChange follows
 * Translate.onChange.on(() => render());
 * ```
 *
 * For plain HTML no code is needed: `<button data-translate="menu.start">Start</button>` (see `translate-dom.ts`). The page connects to the language only when it uses it.
 */
export declare class Translate {
    /** Tells every time the language, or one of the files it is read from, changes: render again. */
    static readonly onChange: {
        on(listener: () => void): {
            off(): void;
        };
    };
    private static readonly host;
    private static readonly listeners;
    private static readonly missing;
    private static book;
    private static current?;
    private static connection?;
    /**
     * The entry `path` names (`menu.start`, `dialogs[0].text`) in the language in use: a text with its `{{ other.entry }}` taken in and its `{name}` filled from `params`; an object, a list or a number as it is. An entry
     * nobody has comes back as its own path (and the console says so, once).
     */
    static get<T = any>(path: string, params?: TranslateParams): T;
    /** Whether the language in use, or one it falls back to, has the entry. */
    static has(path: string): boolean;
    /** A text with its `{{ entries }}` taken in (and `{name}` filled from `params`). An entry nobody has stays as it is written. */
    static resolve(text: string, params?: TranslateParams): string;
    /** Resolves when the language has been read for the first time: wait for it before the first render to draw no entry as its path. */
    static get ready(): Promise<void>;
    /** The language in use (`pt-BR`), or an empty text until the host has answered. */
    static get language(): string;
    /** The languages the project has: what a menu lists. Empty until the host has answered. */
    static get languages(): ITranslateLanguage[];
    /** Asks the game for another language. It is the game that changes it, so `language` reads the new one, and `onChange` tells, when the host answers. */
    static set language(code: string);
    private static connect;
    private static take;
    private static reportMissing;
}
