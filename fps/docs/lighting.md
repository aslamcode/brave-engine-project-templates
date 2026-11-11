# Lighting, shadows, sky and reflections

What lights a scene: Light components, their shadows, the Skybox and Reflection Probes. Cameras, post-processing, materials and the Quality settings are in `rendering.md`.

## What it is
- A **Light** component with a type; every light is real-time (there are no baked lightmaps). Direct light comes from the lights; the ambient light that reaches shadows and the sky side of surfaces comes, for the default **PBR** material, from the **Skybox** and from **Reflection Probes**. The flat colour of **Ambient** lights is used only where there is no Skybox, and by Phong.
- A light points along its entity's forward axis: rotate the entity to aim a Directional, Spot, Soft or Area light. A Point light has no direction.

## Add it
- Scenes panel, right-click -> **Light** -> Ambient Light, Directional Light, Point Light, Spot Light, Soft Light, Area Light. The type can be changed afterwards in the Inspector (**Light** card, General, Type). **Skybox** and **Reflection Probe** are in the same menu.
- Add Component -> **Light Flicker** (on a Light's entity): Amount 0.25, Speed 1, Color Wobble 0.3, Seed 1.

## Key settings (Light card)
- **Type**: Ambient (flat fill, no position: the colours of all Ambient lights are averaged and their intensities added; no shadow), Directional (the sun: direction only, never culled, shadows in cascades that follow the camera), Point (omnidirectional), Spot (cone: Outer Angle 35, Inner Angle 20 degrees; Chromatic Aberration 0 to 1 tints the cone's edge), Soft (a soft-edged box of light projected forward: Width and Height are its cross-section, Range its depth), Area (a rectangular panel: Width, Height, Range).
- **Color Mode** RGB (Color) or Temperature (Temperature slider, 1000 to 12000 K, default 6500). **Intensity** 1. **Range** 10 (Falloff header; every type but Ambient). Intensity is not on one scale across types: Point, Spot and Area are boosted internally for their falloff, so the same number looks different on a Directional or Soft light. Tune each by eye.
- **Shadow** (every type but Ambient):
  - **Type**: None, Hard (one lookup, hard edge, cheapest) or Soft (filtered edge, the default).
  - **Strength** 1 (0 to 1): the share of this light's own light that a shadow removes. Under 1, that share leaks through the shadow.
  - **Fill Intensity** 1: ambient light added where this light's shadow falls, so a full-strength shadow does not go black. Spot, Point, Soft and Area lights fill with their own colour. A Directional light fills with a two-tone colour taken from the first active Directional light (slightly cool above, warm below), or from the scene itself when the Lumos effect's Fulgor is on (`rendering.md`).
  - **Depth Bias** 0.1 and **Normal Bias** 1: multipliers of the engine's own bias, applied when the shadow is read (changing them redraws nothing). Stripes on a surface (acne): raise Normal Bias. A thin line of light along the corner of a closed room: lower Depth Bias.
  - **Cache Shadows** (Spot, Point, Soft, Area; on): see static casters below. Turn it off for a light that moves all the time (a flashlight, a headlight).
- **Lumos** (header of the last section; every type but Ambient; default 0.7): wrap lighting, a factor that softens where the light falls off across a surface. 0 is plain Lambert (a surface edge-on to the light gets none); at 0.7 a surface facing the light gets all of it, edge-on 70% and facing directly away 40%; 1 is flat. It fakes bounce light with no extra cost and changes only the diffuse part (PBR highlights are not wrapped). It is NOT the **Lumos** post-process effect (global illumination, reflections, ambient occlusion): same name, different thing.
- **MeshRenderer card, Shadows**: **Cast Shadows** and **Receive Shadows** (both on). Receive Shadows off lights the object as if nothing shaded it; it does not make the object cheaper, and Phong and Sprite materials ignore it.

## Budget
- At most **1024** active lights in the scene; the rest are ignored. A Directional light is never culled, so it costs everywhere on screen.
- Shadow maps are capped per type in Project Settings -> **Quality** (Shadows). Defaults and ceilings: **Max Directional Shadows** 2 (ceiling 2), **Max Spot Shadows** 8, **Max Point Shadows** 4, **Max Soft Shadows** 8, **Max Area Shadows** 8. A value above the ceiling is clamped. A Point shadow costs six depth passes, a Directional one four (cascades), the others one.
- When more lights ask for a shadow than the cap allows, the Directional ones are picked in the scene's order and the local ones **closest to the camera first**. Lights with Shadow Type None do not count.
- **Shadow Map Resolution** (Off, 1024, 2048, 4096; default 4096) is for the Directional cascades, and Off turns them off. **Local Shadow Map Resolution** is for the other four types (a new project starts at 2048; the engine's own default is 1024). **Shadow Distance** (default 100, world units) is how far from the camera the Directional cascades reach: no shadow beyond it, and a larger value spreads the same resolution thinner. **Cascade Split** (default 0.5; 0 packs the cascades near the camera, 1 spaces them evenly).
- **Static casters**: the **Static** toggle in the Inspector header of an entity says it never moves. Spot, Point, Soft and Area shadows keep the shadow of static casters cached and redraw only the moving ones each frame; moving a static entity (a script can) redraws the static layer of the lights that reach it. The Directional cascades are not cached.

## Sky: Skybox
- Scenes panel -> **Skybox**. A **Skybox** shows an equirectangular `.hdr` or `.exr` as the background AND lights and reflects off the PBR materials in the scene. Only the last enabled Skybox counts. The camera's **Background** must be Skybox (the default); without a Skybox it shows the camera's Background Color.
- **HDRI** (Sky): the image (drag it from the Assets panel). **Rotation** 0 to 360 degrees around the world Y axis. **Exposure** 0 to 8, default 1: scales the picture and the light it gives. **Reflection Resolution** 128 to 2048, default 2048: the size of the baked environment map; each step costs about 4 times more to bake and store.
- A new HDRI or Rotation rebakes the environment (a full-screen resample, no scene render); Exposure never does.

## Reflection Probes
- Scenes panel -> **Reflection Probe**. A probe captures the scene around its entity (six renders) into a prefiltered map plus a diffuse irradiance, so reflections show what the screen does not (off-screen, behind objects, a floor under a prop). Inside its box a probe replaces the Skybox's light and reflections for the PBR materials.
- **Capture**: **Resolution** 32 to 2048 (default 128), **Update**, **Bounces** 1 or 2 (default 2; hidden in the Realtime modes), **Near Plane** 0.1, **Far Plane** 100, **Capture Now** (button).
- **Update**: **On Awake** (default) captures when it first becomes active (also in the editor, on load) and again, once the movement settles, when the probe is moved or Resolution, Bounces or the planes change; it is also redone, gradually, when the Skybox changes. **Script** captures only when asked. **Realtime** recaptures every frame (a large spike); **Realtime (Distributed)** one face a frame (smooth, up to six frames apart).
- **Influence**: **Priority** 0, **Intensity** 1, **Fade Distance** 0 (a soft margin outside the box, in metres), **Diffuse Irradiance** on. **Box**: **Box Size** 10 x 10 x 10 m and **Box Offset** are the probe's volume of influence; **Box Projection** (off) treats the box as the room so reflections line up with its walls.
- Each object uses the two probes that rank highest at its own origin (Priority first, then how far inside the box it is), blended by influence. An object outside every box uses the Skybox.

## Scripting
All the Light fields above are properties: `type`, `colorMode`, `color`, `temperature`, `intensity`, `range`, `width`, `height`, `outerAngle`, `innerAngle`, `shadowType`, `shadowStrength`, `shadowFillIntensity`, `shadowDepthBias`, `shadowNormalBias`, `shadowCacheEnabled`, `lumos`. `Skybox` has `hdriId`, `rotation`, `exposure`, `reflectionResolution`. `ReflectionProbe.capture()`, `ReflectionProbeSystem.requestCapture(probe)`, `requestCaptureAll()` and `requestCaptureAllGradually(perFrame?)` recapture probes.
```ts
import { Float, Light, LightColorModeEnum, Ref, Script, ScriptComponent, Time } from '@brave/core';

@Script()
export class SunCycle extends ScriptComponent {
  @Ref(Light) sun!: Light;
  @Float({ label: 'Speed', suffix: 'deg/s' }) speed = 2;

  onStart() {
    this.sun.colorMode = LightColorModeEnum.Temperature;
  }

  onUpdate() {
    const rotation = this.sun.entity.transform.rotation;
    rotation.x = (rotation.x + this.speed * Time.deltaTime) % 360;
    const warmth = 0.5 + 0.5 * Math.sin((rotation.x * Math.PI) / 180);
    this.sun.temperature = 3000 + warmth * 3500;
    this.sun.intensity = 1 + warmth;
  }
}
```

## Traps
- With a Skybox in the scene, an **Ambient** light changes nothing on PBR materials. Inside a Reflection Probe's box the probe's own diffuse light replaces the Skybox's, so an interior's ambient comes from a probe covering it (or from the Skybox Exposure), not from an Ambient light.
- A probe knows only what it saw when it captured: furniture moved or a lamp switched off stays in its map. On Awake captures once; a scene that changes needs **Script** and a `requestCapture...` call.
- Animating `Skybox.rotation` or `exposure` every frame keeps the On Awake probes waiting (and `rotation` rebakes the sky each frame): leave the sky still, or use Realtime or Script probes.
- Assign a new `RgbaColor` to `light.color`; changing `color.r` in place does not tell the lighting.
- Changes a script makes in Play are not kept (`scripts.md`); the Light card's values are what is saved.

## Not available yet
Baked lightmaps, light probe groups and light cookies.

Types: `brave/core/component/{light,skybox,reflection-probe,light-flicker,mesh-renderer}.d.ts`, `brave/core/system/light-system/`, `brave/core/system/reflection-probe-system/`
