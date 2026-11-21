import { Bool, Float, Inject, Script, ScriptComponent, String, StringCompletionEnum } from '@brave/core';
import { Journal } from '../../services/journal.service';

/**
 * How the game's Journal looks to the player: what the menu is called, whether the game stands still while it is open, and how long the chips on the screen stay (the menu's own, and the list of what
 * the player carries). The Journal itself is a service every game has (Tab opens it); this is the one place a game says what it calls it (Journal here; Datapad, Notebook or Terminal in another game,
 * with nothing else changing) and how it behaves. One in a scene is enough.
 */
@Script()
export class JournalMenu extends ScriptComponent {

  @String({ header: 'Menu', label: 'Title', tooltip: 'What the menu is called on the screen and in the messages ("Journal updated: ..."): Journal, Datapad, Notebook, Terminal.', completion: StringCompletionEnum.TranslationKeys }) title = '{{ journal.title }}';
  @Float({ label: 'Hint Seconds', suffix: 's', tooltip: 'The chip in the corner of the screen (the key and the name of the menu) shows when something new goes into it, fades in, stays this long and fades out. 0: it is always there.' }) hintSeconds = 5;
  @Float({ label: 'Notice Seconds', suffix: 's', tooltip: 'What was picked up or spent (+ Key, -1 Power cell) shows in a notice at the corner of the screen: three at most, each fades in, stays this long and fades out. 0: a notice stays until newer ones push it out. The whole list of what is carried is in the menu, under Items.' }) itemsSeconds = 4;
  @Bool({ label: 'Pauses Game', tooltip: 'On: the game stands still while the menu is open (an audio log still plays). Off: it goes on behind the menu (a game that cannot pause).' }) pausesGame = true;

  @Inject(Journal) journal!: Journal;

  onStart() {
    this.journal.configure({ title: this.title, pausesGame: this.pausesGame, hintSeconds: this.hintSeconds, itemsSeconds: this.itemsSeconds });
  }
}
