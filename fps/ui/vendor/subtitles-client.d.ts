/** One line to show: what a cue says, in the language in use. */
export interface ISubtitleLine {
    /** Which play of which cue (`3:0`): the same while the line stays, another for the next one, and for the same cue when its clip is played again. */
    id: string;
    /** Who says it; an empty text when nobody is named. */
    speaker: string;
    text: string;
}
/**
 * The subtitles, for a page of the UI: the lines to show now, whether they are on, and a call when they change. The engine draws nothing, the HUD does; a line is there while its cue is showing
 * (`start <= time < end` in the clip being played) and goes by itself. Several at once are possible (two people talk), in the order their clips started.
 *
 * ```ts
 * import { Subtitles } from '@brave/ui-bridge';
 * Subtitles.onChange.on(lines => { box.textContent = lines.map(line => line.speaker ? `${line.speaker}: ${line.text}` : line.text).join('\n'); });
 * Subtitles.enabled = false;                                     // the player turned them off; the game keeps the choice
 * ```
 *
 * The page connects to the subtitles only when it uses them (`onChange.on`, `lines`, `enabled`, `ready`).
 */
export declare class Subtitles {
    /** Tells every time the lines, or whether they show, change, with the lines to show now. It comes a few milliseconds after the engine's change (the Bridge samples), not in the same frame. Listening is using: it connects. */
    static readonly onChange: {
        on(listener: (lines: readonly ISubtitleLine[]) => void): {
            off(): void;
        };
    };
    private static readonly host;
    private static readonly listeners;
    private static current?;
    private static connection?;
    /** The lines to show now, in the order their clips started. Empty until the host has answered, and while the subtitles are off. */
    static get lines(): readonly ISubtitleLine[];
    /** Whether the subtitles are on. `true` until the host has answered. */
    static get enabled(): boolean;
    /** Resolves when the host has answered for the first time. */
    static get ready(): Promise<void>;
    /** Asks the game to turn the subtitles on or off. It is the game that changes it, so `enabled` reads the new value, and `onChange` tells, when the host answers. */
    static set enabled(value: boolean);
    private static connect;
    private static take;
}
