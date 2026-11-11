# Text and sprites

Words in the 3D scene (the Text Renderer, drawn from a baked font) and 2D pictures cut from a sheet (the Sprite Renderer). Both are ordinary renderers with a Material of their own on the entity, so layers, culling and shadows work as for any mesh. Text on the screen as a HUD is the web UI (`ui.md`); the Sprite Animator that picks sprite clips from a body is in `characters-and-animation.md`.

## Text
**What it is.** A **Text Renderer** draws a line, a few lines or a wrapped box of text from a **font**: a `.font` asset baked from a `.ttf`, `.otf` or `.woff`. The letters are a distance field, so edges stay sharp from a few pixels to a screen-filling size, at any angle and in perspective. The Text Renderer card says what the text is and how it is laid out; how it looks (colour, lit or unlit, outline, glow, shadow) is the Material card on the same entity (Shader **Text**; one is made when there is none).

**Fonts.** Drop a `.ttf`, `.otf` or `.woff` into the Assets panel: the editor bakes a `.font` beside it and the source stays (a build ships the `.font` only; WOFF2, CFF2 and `.ttc` are refused; a variable font uses its default instance). Select the `.font` for its import settings, then **Apply** (Revert undoes) to bake again:
- **Characters**: Basic Latin + Latin-1 (default), Latin Extended-A, Greek, Cyrillic, Punct. + Symbols, and **Extra Characters** (every character typed there is baked too). Only baked characters draw; any other draws the font's missing glyph.
- **Atlas**: Glyph Size (48 px per em, 16 to 256: sharper when big, more memory), Distance Range (8 px: outline, glow, shadow and bold can reach half of it over the glyph size, 0.0833 em by default). **Keep Outlines** (on) is needed for Render As Mesh.
- When a text uses characters its font lacks, the card warns and offers **Add Characters** (adds them to Extra Characters and bakes again). If the font file itself lacks them it says so: use another font.

**Add it.** Scenes panel, right-click, **Text** (one line, size 0.5 m) or **Text Area** (a 4 x 2 m box that wraps a placeholder paragraph, size 0.22 m). Both take the project's first `.font` by path; with none, the card asks for one. Dropping a `.font` (or the `.ttf` it came from) on the Scenes panel or the Scene view makes a Text with it. Or Add Component, category 2D, **Text Renderer**. In Shaper Mode, Create Shape, **Text** makes a text drawn as a Mesh.

**Key settings** (Text Renderer card):
- **Font**, **Text** (the expand button opens a bigger editor with the Rich Text tools), **Size** (m: the em; a capital is about 0.7 of it), **Align** (Left, Center, Right, Justify: Justify needs a Text Area), **Vertical Align**, **Pivot** (nine points of the text's box: where the entity is), **Rich Text** (off).
- **Spacing**: Line Spacing 1 (multiple of the font's line height), Letter Spacing and Word Spacing (em), Tab Size 4.
- **Text Area** (off: a point text exactly as wide as it is). On: **Width** 4 m, **Height** 2 m, Padding (four sides), **Wrap** (Word, Character, None), **Overflow** (Overflow draws all, Clip, Ellipsis, Shrink down to **Min Scale** 0.25). The Scene view shows the box with handles.
- **Rendering**: **Render As** (Distance Field, or Mesh), **Face Camera** (Off, Y Axis: stays upright, Full: parallel to the screen), Sorting Order (Blend texts only).
- Material, Shader Text: **Lighting** (**Unlit**: Color x Intensity whatever the light, above 1 blooms; **Lit (PBR)**: lights, shadows, sky and reflections reach it, with Metallic, Roughness, Reflectance, Emissive), **Render Mode** (**Blend**, the default: smooth edge, drawn after the opaque scene farthest first, no depth write, any size; **Cutout**: real geometry in the depth, shadows and reflections, but dotted below about 16 px an em without MSAA), Color (its alpha is the opacity in Blend), Softness, **Outline** (Color, Width in em), **Glow** (Color, Intensity, Radius in em, Falloff) and **Drop Shadow** (Color, Offset X / Y in em, at most half an em, Softness): glow and shadow draw in Blend only, never lit.
- **Rich Text** reads `<b>`, `<i>`, `<u>`, `<s>`, `<color=#rrggbb>` (also `#rgb`, `#rrggbbaa`) and `<mark=#rrggbb>` (marker-pen background), each closed by `</...>`; `\<b>` writes the tag itself. Highlights only: line height, size and font never change, and bold letters advance 0.02 em more. Anything that is not exactly a tag stays as typed.
- **Render As: Mesh** builds the letters as a solid (front, back, walls; **Depth** 0.1 m, **Curve Quality**, **Smooth Angle**, Front / Back Cap) with an ordinary Pbr Material: it casts and receives shadows like any mesh. Bold and the marker are not built in Mesh. **Edit in Shaper** turns the letters into a mesh the Shaper edits and removes the Text Renderer: the text can no longer be changed as text and the scene file carries every triangle (the dialog says how many; Undo brings it back).

**Scripting.** `text` (set it when the value changes: the mesh is rebuilt only then), `fontId`, `size`, `richText`, `measure()` (`width`, `height`, `lineCount`, `overflowed`, `truncated` in metres, zeros until the font has arrived), `bounds` and `boxBounds` (`IAABB` in the entity's space), `plainText` (the text with the tags taken out), and the static Signal `TextRenderer.onMissingCharacters` (once per font and character). `escapeRichText(s)` makes any string, a player's name, safe between tags.
```ts
import { ITextMissingCharacters, Script, ScriptComponent, TextRenderer } from '@brave/core';

@Script()
export class ScoreLabel extends ScriptComponent {
  private label?: TextRenderer;
  private score = 0;

  onStart() {
    this.label = this.entity.getComponent(TextRenderer);
    TextRenderer.onMissingCharacters.on((missing: ITextMissingCharacters) => {
      console.warn(`${missing.family} has no glyph for U+${missing.codePoints[0].toString(16)}`);
    }, this);
    this.show();
  }

  add(points: number) {
    this.score += points;
    this.show();
  }

  // Width in metres of what is drawn now, for a panel behind the text.
  width(): number {
    return this.label?.measure().width ?? 0;
  }

  private show() {
    if (this.label) this.label.text = `Score ${this.score}`;
  }
}
```

**Traps.**
- A Material holds ONE font's atlas: texts in different fonts need Materials of their own (the default); two fonts on one shared `.mat` read a single atlas, so one of them draws wrong, and the console warns once.
- The characters are fixed when the font is baked: a name in Cyrillic or a euro sign needs the set or Extra Characters, then Apply. Text is stored as strings, so re-baking never breaks a scene.
- A Distance Field text is selected in the Scene view by its box, not its letters.
- Tags in a text with Rich Text off draw as written (the card says so). A Cutout text draws no marker (`<mark>`): use Blend.
- Hundreds of small labels cost CPU: Cast Shadows off on them (MeshRenderer card) is the lever.
- Limits: left to right only, no right-to-left, no complex scripts (Arabic joining, Indic), no ligatures; kerning only between neighbours on a line.

## Sprites
**What it is.** A **Sprite Renderer** shows one cell of a sheet of equal cells (a still image is a 1 x 1 sheet) as a quad whose size comes from the texture. Cells are numbered left to right, top to bottom. It has animation built in: a clip is a range of frames played at some speed. The picture is the texture of the entity's Material (Shader **Sprite**).

**Add it.** Scenes panel, right-click, **Sprite** (an empty one: pick the texture in the Material card, on the Color row's texture slot, or drop one there). Dragging a texture from the Assets panel into the Scenes panel or the Scene view makes a sprite named after it. Or Add Component, category 2D, **Sprite Renderer**.

**Key settings.**
- Sprite Renderer: **Columns** and **Rows** (1 x 1), **Frame** (the cell shown; a playing clip writes it), **Pixels Per Unit** (100: a 32 px cell is 0.32 m), **Pivot** (0 to 1 from the bottom-left: (0.5, 0.5) centre, (0.5, 0) feet), Flip X / Y, **Billboard** (Off, Y Axis: upright like a standing character, Full: parallel to the screen), **Sorting Order**.
- **Animations** (a list): each clip has Name, **From** and **To** (frames; To before From plays backwards), **FPS** 12, **Loop** on, Flip X / Y, and optionally its own **Sheet** with Columns and Rows (a character is often several sheets; a clip without one uses the sprite's). **Play On Awake** (a clip, or None), **Speed** 1, **Unscaled Time** (animates while Time.scale is 0: menus).
- Material, Shader Sprite: Color (tint and texture), **Render Mode** (**Cutout** default: opaque, depth, shadows, no sorting, for pixel art and foliage; **Blend**: soft edges and fades, drawn after the opaque scene by Sorting Order), Alpha Cutoff 0.5 (texels more transparent than this are not drawn in Cutout and cast no shadow), **Lit** (off: the picture as it is whatever the light), **GPU Instancing** (many sprites that share a Material and show the same frame in one draw; Cutout only).

**Scripting.** `play(name?, restart?)` (a clip by name from its first frame; no name resumes; false when there is none), `playClip(clip, restart?, mirrored?)`, `pause()`, `stop()`, `frame`, `speed`, `flipX`, `billboard`, `isPlaying`, `clipName`, `frameCount`, and the Signal `onClipEnd` (the clip's name, only for a clip with Loop off). Clips are authored in the Inspector.
```ts
import { Script, ScriptComponent, SpriteRenderer } from '@brave/core';

@Script()
export class Coin extends ScriptComponent {
  private sprite?: SpriteRenderer;

  onStart() {
    this.sprite = this.entity.getComponent(SpriteRenderer);
    this.sprite.onClipEnd.on((name: string) => {
      if (name === 'pickup') this.entity.destroy();
    }, this);
    this.sprite.play('spin');
  }

  collect() {
    this.sprite?.play('pickup');
  }
}
```

**Traps.**
- Nothing is drawn until the Material has a texture and it has loaded.
- **Sorting Order** only orders Blend sprites (greyed out for Cutout, which is real geometry: the nearer one wins).
- A clip that starts with a sheet of its own puts that texture on the Material: sprites sharing one Material then all show it, so give such sprites Materials of their own.

## Not available yet
A bundled default font (a project needs at least one `.font`), right-to-left and complex scripts, bold and marker in Mesh text, glow or shadow wider than the font's Distance Range allows (raise the Distance Range and bake again), hit-testing or a caret API for text, and sprite sheets of unequal cells.

Types: `brave/core/component/{text-renderer,sprite-renderer,sprite-clip}.d.ts`, `brave/core/shader/{text-shader,sprite}.d.ts`, `brave/core/system/font-system/`, `brave/core/util/text/`, `brave/core/util/sprite/`
