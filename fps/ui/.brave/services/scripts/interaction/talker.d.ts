import { Interactable } from './interactable';
/**
 * Something that speaks when the player uses it: `interact` plays the Audio Source on this entity (or the one in `Audio Source`, a field of the Interactable), whose clip is the voice. It adds nothing else: the subtitles of
 * the clip show by themselves while it plays (the `AudioSource` follows its own sound, see `docs/translate.md`), in the language in use, and the box over the prompt says what it is (`Caption Title`, `Caption Text`).
 * While the voice plays `interact` does nothing and the prompt is gone (`usable`), so a line is never started again over itself: it comes back when the line ends (`Repeat While Playing` turns that off).
 * The language demo's radio is one. Give its Audio Source Pooling OFF: a pooled source starts a voice at every play, and this one has one line.
 */
export declare class Talker extends Interactable {
    prompt: string;
    repeatWhilePlaying: boolean;
    get usable(): boolean;
    protected onUse(): void;
    private get source();
}
