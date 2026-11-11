# Effects: particles, fire, explosions and decals

Effects the engine draws by itself, with no textures to make: soft particles (dust, sparks, smoke, liquids), a fire, explosions, and paint projected onto the scenery. The wind they react to is in `vegetation-trees-water.md`; the Post-Process Stack some of them need is in `rendering.md`.

## Particles
**What it is.** A **Particle Emitter** is a pool of small procedural motes (no textures, no sprite sheets) that are born, drift, glint and die. The whole simulation runs on the GPU: a script cannot read or move single particles, it starts bursts, restarts the pool or changes the fields. Particles are lit by the scene (the sun with its shadow, lamps, sky), carried by the game's wind and Wind Zones, and parted by moving bodies.

**Add it.** Entity selected, Inspector, **Add Component**, category Rendering, **Particle Emitter** (it makes its own Material with the Particle shader: leave the Shader as it is). A new emitter is the **Dust Motes** preset in a box that is the entity's scale, 1 m on a new entity: scale the entity (about 5 x 3 x 5 m) or the 3000 motes are packed in one cubic metre. The Fire and Explosion entities below are made partly from emitters.

**Key settings.**
- **Preset** writes every number and restarts the pool: Dust Motes, Sparks, Smoke, Embers, Coals, Fire Smoke, Heat Shimmer, Crackle, and the liquids Blood Spurt, Oil Splash, Oil Leak, Thick Pour. Editing any field makes it read **Custom**; choosing a preset again overwrites your edits.
- **Shape**: Box (anywhere in the box), Point, Cone (from the disc the entity's x and z scale make, along the entity's up, within **Cone Angle** degrees: turn the entity to aim). Dust Motes is made for a box of about 5 x 3 x 5 m and Coals for 1.1 x 0.02 x 1.1 m; Sparks and Smoke are cones, so scale x and z to the size of the disc.
- **Max Particles** (1 to 1,000,000, 48 bytes each on the GPU), **Rate** (per s), **Lifetime** (s), **Randomness**. The pool stays full only when Rate x Lifetime is at least Max Particles (twice that when lifetimes vary); a birth that finds its slot still alive is skipped.
- **Motion**: Speed (m/s), Gravity (m/s2: negative falls, positive rises), Drag, Wind (0 to 2: 1 goes with the wind as a sheet of paper does, dust is 0.05), Turbulence (m/s of swirl), **Collide** (bounce off what the camera saw last frame).
- **Look**: Size (m), Size Over Life, Color, Color End, Brightness (HDR: above 1 blooms), **Blend** (Additive adds light: dust, sparks, fire; Premultiplied lays colour over: smoke; Distortion bends what is behind it), Lit (0 all emission, 1 all scene light), Twinkle, Stretch (streak length of a fast particle).
- **Advanced**: Wrap In Box, Prewarm, Body Push (non-Static Rigid Bodies push particles), Billow (a round mote to a smoke puff), Color Mid, Bounce, **Burst Every** / **Burst Count** (the emitter bursts by itself), Near / Far / Edge Fade, Seed, **Bypass Time Scale** (off: Pause holds the particles and slow motion slows them).

**Liquids.** **Fluid** (None, Blood, Oil, Custom) makes the emitter pour a liquid drawn as wet beads joined by threads, lit as a wet surface; Blood and Oil only choose the starting Color and gloss. **Viscosity** (0 thin blood, 1 oil, up to 3 pitch), **Stream Width** (m), **Strands**, **Spray**, **Spurt Length**, **Flow Always** (a leak that never stops; off, it flows only when asked). **Form: Pour** is a thick, wide stream that falls along the entity's up, lands on the first fixed collider under it (free fall if none within 24 m) and piles up (dough, mud, cement).

**Scripting.** `burst(count)` adds births on top of the Rate at the next step (the pool limits it), `spurt(direction?, seconds?)` starts a liquid, `restart()` starts the pool over (refilled at once if Prewarm is on), `preset = ParticlePresetEnum.Sparks` writes a preset, and every field is a property (`rate`, `color`, `bypassTimeScale`, ...).
```ts
import { ParticleEmitter, Script, ScriptComponent } from '@brave/core';

@Script()
export class Impact extends ScriptComponent {
  private sparks?: ParticleEmitter;

  onStart() {
    this.sparks = this.entity.getComponent(ParticleEmitter);
  }

  hit() {
    this.sparks?.burst(120);
  }
}
```

**Traps.**
- **Heat Shimmer** (Blend Distortion) draws nothing without Temporal Anti-Aliasing in the camera's Post-Process Stack (`rendering.md`).
- **Collide** uses the depth of the last frame: what the camera did not see (off screen, behind it, hidden) is not hit, so sparks fall through the world when the camera looks away.
- Smoke costs by the screen pixels the puffs cover, not their number: few big puffs cost more than thousands of motes. A burst into slots still alive loses those births (Smoke and Embers pools stay busy for seconds).
- Only the 32 non-Static bodies nearest the camera push particles. There is no sorting inside one emitter.
- A liquid hits the scenery and dies there; it leaves no stain (see Stains below).

## Fire and Gas Flame
**What it is.** A **Flame** is one luminous body, a temperature field the GPU marches for every pixel it covers: not particles. It burns upward whatever the entity's rotation (the entity's position is the foot, its scale multiplies the size), leans with the wind without moving its foot, and stops at the scene's depth. **Light Flicker** makes the Light on its entity flicker around what the Light is set to (the Light's Intensity and Color stay the average; removing the component puts the Light back).

**Add it.** Scenes panel, right-click, **Effects**, **Fire** (entity Fire with children Flame, Coals, Smoke, Heat, Embers, Crackle and a flickering point Light) or **Gas Flame** (a blue Flame, Heat and a cool Light). Both are ready to play; shadows are off on the Light (a point light's shadows are six extra passes) and the Heat child, the hot air that bends the image behind the flame, needs Temporal Anti-Aliasing (on in a new project's `main.pps`). Or Add Component, Rendering, **Flame** / **Light Flicker** (needs a Light on the same entity). In a script, `fire(size)` and `gasFlame(size)` make the same entities (size 1: a flame 2 m tall; 0.25 a torch; 2 to 3 a bonfire).

**Key settings.** Flame: **Height** 2 m, **Width** 1 m, Turbulence 0.7, Speed 1, **Color** (Natural, Blue (gas), Custom with Hot / Mid / Cool), Blue Base 0.35, Brightness 2, **Wind** 0 (about 0.06 is a campfire in a breeze), Softness 0.15 m; Advanced: Sway 0.5, Breath 0.4, Flicker 0.3, Quality (Low, Medium, High), Resolution, Seed, Bypass Time Scale. Light Flicker: **Amount** 0.25 (share of the Light's brightness), Speed 1, Color Wobble 0.3, Seed.

**Cost.** Flames and explosions are volumes: they cost the screen pixels they cover. At Resolution **Auto** (default) each is drawn into a target of at most 50,000 pixels however much of the screen it fills, then scaled up, so a fire next to the camera costs no more; with more than two big ones of a kind the budgets shrink so the worst case stays bounded. Full, Half and Quarter fix a share of the covered area instead. `VolumeWindows.budgetScale` (1) multiplies every budget; no editor setting changes it.

## Explosions
**What it is.** An **Explosion** is a one-shot, multi-part effect: one marched volume (a fireball that grows fast, rises and cools from white-yellow to soot into the head of a smoke column, a skirt of fire on the ground, a wave of dust), a shock wave that bends the image behind it, and children: Sparks and Embers emitters and a Light that is the flash (the component drives them). The kinds are separate explosions, not one scaled.

**Add it.** Scenes panel, right-click, **Effects**, **Explosion**, then **Small** (grenade: a ball of fire about 3 m, Radius 4 m), **Medium** (barrel or car: about 10 m, Radius 12 m), **Large** (building or bomb: about 30 m, Radius 40 m) or **Atomic** (a nuclear cloud, about 20 kt at Size 1, kilometres tall and 300 s long, Radius 2000 m, seen from far away: no sparks, embers or shock lens). The new entity goes off once so you see it. Or Add Component, Rendering, **Explosion**; `explosion(kind, size)` makes the whole entity. The entity's position is the ground point under the blast.

**Key settings.** **Kind**, **Size** (1 is the kind's own; lengths scale by it, times by its square root: bigger is slower; the entity's scale multiplies too), **Intensity**, **Radius** (m: only the number `onExplode` hands to your damage code), **Auto Play** (on: goes off once when the game starts), **Loop**, **Destroy On Finish**, **Preview** (button: fires it in the editor, where it draws only while playing); Advanced: Dust, Soot, Turbulence (multiples of the kind's), Quality, Resolution (Auto), Seed, Bypass Time Scale.

**Scripting.** `explode()` (again while going off: starts over), `stop()`, `isPlaying`, `elapsed`, `duration`, and the Signals `onExplode` (an `IExplosionEvent`: `position`, `radius`, `kind`, `fireRadius`) and `onFinish`.
```ts
import { explosion, Explosion, ExplosionKindEnum, IExplosionEvent, Script, ScriptComponent } from '@brave/core';

@Script()
export class Grenade extends ScriptComponent {
  onStart() {
    const blast = explosion(ExplosionKindEnum.Small);
    blast.transform.position = this.entity.transform.globalPosition;
    blast.getComponent(Explosion).onExplode.on((event: IExplosionEvent) => {
      console.log(`boom at ${event.position.x}, ${event.position.z}, reach ${event.radius} m`);
    }, this);
    this.entity.scene?.add(blast);
  }
}
```
**Traps.** The explosion deals no damage, plays no sound and leaves no scorch mark: hang those on `onExplode`. A script that makes one places it and adds listeners in the same frame (Auto Play fires it at its first step). The shock lens needs Temporal Anti-Aliasing; without it the volume is drawn into the scene with no lens. The Atomic shock's delayed arrival and sound are not built.

## Decals and stains
**What it is.** Paint, a sign, a number or a stain laid on the scenery by projection: a box paints whatever surface the scene's depth says is inside it (floor, wall, building, terrain), with no mesh or UVs, lit as that surface is. **Authored decals** are the **Decal** component, saved in the scene. **Runtime stains** are a pool a script writes to (blood, oil, bullet marks).

**Add it.** Entity (an Empty), Add Component, Rendering, **Decal**. There is no Effects menu entry; a decal has no mesh, so select it in the Scenes panel (the Scene view draws its box and an arrow). Its local +Z faces the viewer and the box projects along -Z: place it in front of the wall, turned so +Z looks out of the wall.

**Key settings.** **Mode**: Color (soft-edged paint), Texture (an image: its alpha is the shape, Color tints it), Text (words from a `.font`: Font, Text, Text Size, Align). **Size** (m; default 1 x 1 x 0.5: the third is the whole thickness the box reaches, in front of and behind the surface), Color, Opacity, **Blend** (Alpha: lit as the surface; Multiply: dirt, grime; Additive: a glow, with Intensity). **Angle Fade Start / End** (60 / 85 degrees: how far the paint runs over a bend), Edge Fade 0.08, Sort Order (higher draws later); Advanced: Roughness, Erosion (chipped paint), Seed, Match Surface Roughness.

**Stains.** `DecalSystem.stain({ position, normal, size, fluid?, direction?, depth?, opacity?, drip?, seed? })`: `position` a point on the surface and `normal` its up, both `[x, y, z]`; `size` the half width in metres (or `{ width, height }`). A stain is no entity and is not saved in the scene: it takes a slot of a ring of **Max Stains** (Project Settings, Quality, Decals: 1024, 16 to 16384); the newest replaces the oldest, which fades out first. Drawn within 35 m (fading over the last fifth), at least 4 pixels wide, up to 256 at once, nearest first. In the editor Stop empties the pool; a shipped game keeps them. Also `DecalSystem.stainCount` and `clearStains()`.

| `fluid` | Look (a basic one: a dark blob that dries and loses gloss over 90 s) |
|---|---|
| 0 (default) | Blood: dark red. The number a Blood emitter carries |
| 1 | Oil: near black, glossy |
| 2 | A custom fluid: dark amber |
| 3 and up | Drawn like 0, until `DecalSystem.setStainMaterial(wgsl)` gives it a look |
```ts
import { DecalSystem, Script, ScriptComponent } from '@brave/core';

@Script()
export class Wound extends ScriptComponent {
  // The entity's origin is at its feet, on the floor.
  bleed() {
    const feet = this.entity.transform.globalPosition;
    DecalSystem.stain({ position: [feet.x, feet.y, feet.z], normal: [0, 1, 0], fluid: 0, size: 0.3 });
  }
}
```
**Traps.** Paint is in the world: a decal on a door stays put when the door moves, so decals are for static scenery. Only surfaces that face the decal's +Z get paint (put another decal on the other side of a thin wall); a box deeper than the wall reaches its back. A deep box over a Terrain paints the grass tips: keep it a few centimetres deep. Drawn for the main camera only (not in reflection probe captures or an Overlay camera); whatever stands between the box and the camera hides it. Cost is covered pixels times layers, not the number of decals.
- **A bullet mark** has no fluid of its own in `DecalSystem.stain()`: oil (`fluid: 1`) with a half width of 0.035 m and a depth of 0.04 m reads as a dark mark on a greybox. Only static scenery takes a stain.

## Not available yet
A CPU particle mode, particle events (hit, death), textured particles, and light cast by particles; stains written by a liquid's hits or by explosions (place a Decal or a stain from `onExplode` yourself); decals on moving things; an Effects Quality setting for the budgets above; explosion sound and damage.

Types: `brave/core/component/{particle-emitter,flame,light-flicker,explosion,decal}.d.ts`, `brave/core/geometries/{fire/fire,explosion/explosion}.d.ts`, `brave/core/system/particle-system/{particle-layout,particle-preset.enum}.d.ts`, `brave/core/system/{flame-system/flame-layout,explosion-system/explosion-layout,decal-system/decal-system,decal-system/decal-stain-pool,volume-window/volume-window}.d.ts`
