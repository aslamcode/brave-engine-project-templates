import { AudioSource, Bool, Script } from '@brave/core';
import { Interactable } from './interactable';

/**
 * Something that speaks when the player uses it: `interact` plays the Audio Source on this entity (or the one in `Audio Source`, a field of the Interactable), whose clip is the voice. It adds nothing else: the subtitles of
 * the clip show by themselves while it plays (the `AudioSource` follows its own sound, see `docs/translate.md`), in the language in use, and the box over the prompt says what it is (`Caption Title`, `Caption Text`).
 * While the voice plays `interact` does nothing and the prompt is gone (`usable`), so a line is never started again over itself: it comes back when the line ends (`Repeat While Playing` turns that off).
 * The language demo's radio is one. Give its Audio Source Pooling OFF: a pooled source starts a voice at every play, and this one has one line.
 */
@Script({ inheritProperties: true })
export class Talker extends Interactable {

  prompt = 'Listen';

  @Bool({ label: 'Repeat While Playing', tooltip: 'Off (the default): while its voice plays Interact does nothing and the prompt is gone until the line ends, so it is never started again over itself. On: every use starts it again.' }) repeatWhilePlaying = false;

  get usable(): boolean {
    return this.repeatWhilePlaying || !this.source?.isPlaying;
  }

  protected onUse(): void {
    if (!this.source) {
      console.warn(`[Talker] "${this.entity.name}" has no Audio Source to play.`);
      return;
    }
    void this.source.play();
  }

  private get source(): AudioSource | undefined {
    return this.audio ?? this.entity.getComponent(AudioSource);
  }
}
