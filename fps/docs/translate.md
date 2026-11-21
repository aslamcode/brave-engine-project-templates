# Languages

What the game says, in the language the player reads it in: texts in the scene, texts a script shows, the menus of the UI. One **`.lang` file per language**, found by itself: add the file and the language exists.

## The files
**New Language** (Assets panel, right-click) makes `en.lang`. **The file's name is the language**: `en.lang`, `pt-BR.lang`, `es.lang`, `zh-Hans.lang` (BCP 47; `pt_br` and `PT-br` are read as `pt-BR`; a name that is not a code is refused and the console says so). The content is JSON; VS Code reads a `.lang` as JSON (`files.associations` in `.vscode/settings.json`). Keep them in one folder, `assets/languages/` by habit: any folder works.

```json
{
  "$language": "Português (Brasil)",
  "menu": { "start": "Iniciar jogo" },
  "prompt": { "open": "Abrir {item}" },
  "items": { "crate": { "name": "Caixote", "description": "Cheira a querosene." } },
  "dialogs": [{ "text": "..." }]
}
```
- `$language` is the name of the language **written in itself**: what a language menu lists. With none, the code.
- An entry is a text, a number, true/false, an object or a list. **`null` means "not translated yet"**: the language it falls back to answers.
- Names are chained by dots and `[n]`: `menu.start`, `dialogs[0].text`. A key cannot contain `.`, `[` or `]`.
- Plurals: an entry whose keys are `zero`, `one`, `two`, `few`, `many`, `other` (and has `other`) is a set of forms, picked by the language's own rule: `"items": { "one": "{count} item", "other": "{count} items" }`, read with `Translate.get('items', { count: 3 })`. `zero` is also used for a count of 0 where the rule has none ("No items").

What a language does not have is answered by the same language without its region (`pt` for `pt-BR`), then by the **base language** (the project's default, else English, else the first by code). An entry nobody has comes back as its own path and the console says so once, so a typo is seen.

## In the scene: `{{ key }}`
Write the key in the **Text** of a Text Renderer: `{{ menu.start }}`, or mixed with words: `Press E to {{ prompt.open }}`. The text follows the language by itself, with no script and no extra component, and changes when the language does. An entry may use another (`"bye": "Leave {{ game.name }}"`). `\{{ key }}` writes the characters `{{ key }}`. What is not an entry stays as written. The field always shows what you wrote; the notice under it shows how it reads in the language in use, the entries no language has, and the characters the font lacks **in any language** (Add Characters bakes them all).

## From a script
```ts
import { Script, ScriptComponent, Translate } from '@brave/core';

@Script()
export class Greeter extends ScriptComponent {
  onStart() {
    const start = Translate.get<string>('menu.start');                  // 'Iniciar jogo'
    const open = Translate.get('prompt.open', { item: 'a porta' });     // 'Abrir a porta': {item} is filled from the parameters
    const items = Translate.get('items', { count: 3 });                 // the plural form for 3
    const first = Translate.get('dialogs[0].text');                     // an object or a list comes back whole
    const menu = Translate.languages.map(language => `${language.code}: ${language.name}`);   // a language menu's list, each in its own words
    Translate.language = 'pt-BR';                                       // changes it; every text of the scene and every page follows
    Translate.onChange.on(version => console.log('language or files changed', version, Translate.language), this);
    console.log(start, open, items, first, menu, Translate.systemLanguage);   // systemLanguage: what the player's system asks for, when the game has it
  }
}
```
`Translate.has(path)`, `Translate.resolve(text)` (a text with `{{ }}` taken in), `Translate.escape(text)` (a player's name put into a text that has entries), `Translate.defaultLanguage`. **The player's choice is the game's to keep** (a `@Store`), the engine only holds the language in use: it goes back to the project's default when a Play ends. **Default Language** (Project Settings > General) is the language a game starts in unless a script asks for another: Automatic (English, else the first) or one of the project's.

## In the UI (the web overlay)
The UI project reads the same language through the bridge package, with the same names:
```js
import { Translate } from '@brave/ui-bridge';
Translate.get('menu.start'); Translate.language = 'pt-BR'; Translate.languages; Translate.onChange.on(render);
```
For plain HTML there is nothing to write: `<h1 data-translate="menu.title">Brave</h1>`, `data-translate-placeholder`, `-title`, `-alt`, `-aria-label` and `-value` for the attributes, `data-translate-params='{"item":"door"}'` for `{name}`. The words already in the element stay until the language arrives and when the entry does not exist. The text is set as text, never as markup; the page's `<html lang>` follows. `{{ }}` in a page is not scanned (Angular and Vue use it).

## Subtitles
In each `.lang`, under `subtitles`, keyed by the **file name of the clip without its extension** (`guard-01.wav` is `subtitles["guard-01"]`): a list of cues, in seconds into the clip.
```json
"subtitles": { "guard-01": [
  { "start": 0.0, "end": 2.4, "speaker": "Guard", "text": "Halt! Who goes there?" },
  { "start": 2.4, "end": 4.1, "text": "{{ dialogs.guard.second }}" }
] }
```
- **Each language holds the whole list with its own timing**: a translation is longer or shorter than the original. The track comes from the first language (the one in use, the same without its region, the base) that has the clip, as a whole; cues of two languages are never mixed. `null` means "not translated yet", `[]` a deliberate empty track. `text` and `speaker` may hold `{{ key }}`. A cue shows while `start <= time < end`; overlapping cues show together. A cue with no text, a negative `start` or `end` not after `start` is left out and said in the console once.
- **An Audio Source shows its own lines, with no component to add**: it follows the sound it really plays, so pause, stop, a skip, a loop and the end of the clip take the lines away or move them. **Show Subtitles** (Audio Source, on by default) turns it off for one source. A clip with no track in any language is silent, as most sounds are. Two clips with the same file name in different folders share a track; a clip named `guard.01.wav` is `guard.01`.
- **The engine draws nothing**: the HUD does. `Subtitles.lines` is what shows now (`{ id, speaker, text }`, in order), `Subtitles.enabled` (on by default; **the player's choice is the game's to keep**, it goes back to on when a Play ends) and `Subtitles.onChange`. In the UI: `Subtitles.onChange.on(lines => ...)`, `Subtitles.lines`, `Subtitles.enabled` from `@brave/ui-bridge`.
```ts
import { Script, ScriptComponent, Subtitles } from '@brave/core';

@Script()
export class SubtitleSwitch extends ScriptComponent {
  onStart() {
    Subtitles.enabled = true;   // the game restores what the player chose here
    Subtitles.onChange.on(() => console.log(Subtitles.lines.map(line => line.text)), this);
  }
}
```
```js
import { Subtitles } from '@brave/ui-bridge';
Subtitles.onChange.on(lines => { box.textContent = lines.map(line => (line.speaker ? line.speaker + ': ' : '') + line.text).join('\n'); });
```

## Voices in each language
Put a voice in a folder per language, named like its language file, with the same file name in each: `assets/audio/voice/en/guard-01.wav` and `assets/audio/voice/pt-BR/guard-01.wav`.
In the scene, point the Audio Source at ONE of them (the default language's). The game plays the file of the language the player is in: the same path with the language folder swapped.
A language with no file of that line plays the base language's (pt-BR, then pt, then the default); a sound outside a language folder plays as it is. The subtitles keep the clip's file name, so one track serves every folder.
If the language changes while a line is being said (the pause menu), the line goes on in the new language at the same time when both takes are as long as each other (within 0.1 s), else at the start of the sentence when both languages' subtitles have the same number of cues, else it finishes in the old one and the new one starts at the next play.
After `Translate.language = ...`, `await AudioSource.whenLanguageReady()` before the game goes on, so the first line after the change does not wait for a file.
Limits: the folder must be named exactly like the language code (`pt-BR`, not `pt_br`) to be found; a language added after the build brings texts but not voices; music and ambience (Audio Player) are not dubbed; Project Settings > Languages > Voices lists what a language lacks.

## Adding a language after the build
A built game has a folder `data/translations/` with an empty `index.json` and a note. A browser cannot list a folder, so a language is there when the list says so: copy the `.lang` into that folder and add its name, `["es.lang"]`. A language the game already has is **laid over**: what the new file says wins, what it leaves out stays, a `null` leaves it. A broken file or a wrong name is said in the console and left out; the rest still loads. The game reads it at the next start.

## Limits
- The Text system is left to right with no shaping; Arabic, Hebrew and Indic scripts do not draw in the scene (the UI is HTML and the browser does them). The baked font atlas holds Latin, Greek and Cyrillic well; CJK does not fit (use the UI for it).
- A text that comes from the player (a name) goes into a text through `{name}` or `Translate.escape()`, never concatenated into one that has `{{ }}`.
- Localized textures are not part of this: a language changes words and voices, not pictures (use a Text of the scene for a sign).

Types: `brave/core/static/translate/{translate,subtitles}.d.ts`, `brave/core/util/translate/`, `brave/core/component/audio-source.d.ts`
