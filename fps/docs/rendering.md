# Cameras, post-processing, materials and quality

How the picture is made: the Camera component, the `.pps` post-process stacks, materials and shaders, and the project-wide Quality settings that bound the cost. Lights, shadows, the Skybox and Reflection Probes are in `lighting.md`.

## What it is
- Every frame each active **Camera** draws the scene into an HDR image; the **main camera's post-process stack** turns it into the picture. A **material** says how a surface reacts to light. **Quality** (Project Settings) says how much the GPU spends.

## Add it
- Scenes panel -> **Camera** (Main Camera on, plus an Audio Listener) or **Free Camera** (adds the fly script). Add Component -> Camera for any other entity.
- Assets panel, empty area of a folder: **New Post-Process Stack** (`.pps`, starts empty), **New Material** (`.mat`), **New Shader** (`.sdr`), **New Post-Process Effect** (`.ppfx`). A new project already has `scenes/main/main.pps`, which the starter camera uses.
- Select a `.pps`: the Inspector lists its effects (enable checkbox and trash button each); **Add** at the bottom -> Select Effect. Rows cannot be dragged: an effect is inserted where its stage puts it.
- Camera card -> **Post Process**: Default, None, or a `.pps` by name. Project Settings -> **Quality**.

## Key settings
**Camera card.**
- **Main Camera**: the camera the game is seen through (`BraveEngine.camera`). The last one to ask wins; the one it replaced comes back when it is disabled or destroyed.
- **Camera Type**: Base (default: clears the image) or Overlay (clears only depth and draws on top: first-person arms, a weapon). **Merge Depth** (off) on an Overlay camera makes its depth count for Fog and the other depth-based effects (arms); leave it off for an unrelated view such as a security monitor.
- **Order** 0: cameras draw lowest first (give each a distinct value). **Layers** (default: Default only): what it draws (layers: Project Settings -> Layers). The Material card's **Layer** puts one submesh on another layer, so one mesh can be split between cameras.
- **Projection**: Perspective (**Field Of View** 60, vertical, degrees) or Orthographic (**Size** 5: half the view's height in world units). **Z Near** 0.1 and **Z Far** 1000. **Background**: Skybox (default; with no Skybox in the scene it shows **Background Color**) or Solid Color (always Background Color).

**Post-process stack.** An ordered list of effects. Camera **Post Process** Default = tonemap only (ACES) and nothing else; None = the raw image with no tonemap and no effects; a `.pps` = its effects. Only the **main camera's** stack is used for the whole frame; the field on other cameras does nothing.
- Stages: every effect below runs before the tonemap except **Tonemapping** itself, **Dithering** and **Anti-Aliasing**. A stack uses ONE Tonemapping, then at most ONE Anti-Aliasing after it. A second enabled Tonemap-stage or Anti-Aliasing effect is ignored (one warning in the Console). A stack with no enabled Tonemapping uses the Default tonemap, and Fog, Color Grading, Vignette, Chromatic Aberration, Film Grain, Rain and Lens Flare still apply. **Dithering** also runs last and does not count as the Anti-Aliasing slot.
- New projects ship `main.pps` with these on: Temporal Anti-Aliasing, Exposure (Auto), Color Grading, Depth of Field, Lumos, Tonemapping, Dithering; the rest are in it, off.

| Effect | What it does; settings that matter (defaults) |
|---|---|
| Temporal Anti-Aliasing | Jitters the image and accumulates frames: no jagged edges or shimmer; always first. Jitter Samples 8, Filter Size 0.6, Feedback Min 0.6 / Max 0.97, Motion Rejection 4, Sharpness 0.2. Works with MSAA. |
| Exposure | Brightness. Manual (Exposure 1) or Auto (meters the centre of the image: Compensation 0, Min 0.5, Max 2, Speed To Light 0.3, Speed To Dark 1.5). No Exposure effect = 1. |
| Bloom | Glow around bright pixels. Threshold 1, Soft Knee 0.5, Intensity 1, Clamp 0 (off), Iterations 6. |
| Tonemapping | HDR to screen. Algorithm: ACES (Filmic) default, Reinhard, Linear (None). |
| Color Grading | Preset (None, Natural, Cinematic (Teal & Orange), Moody, Golden Hour, Nordic Pine), White Balance, Saturation 1, Contrast 1, Lift / Gamma / Gain. A preset overwrites the values; editing one then reads Custom. |
| Lumos | Screen-space lighting for PBR (GI and AO also for Phong), three independent parts. Global Illumination: Radiance (Resolution Half). Reflections: Screen Space (default), Screen Space (Deterministic) if it flickers, Screen Space (FidelityFX) (Resolution Half). Ambient Occlusion: Screen Space (Resolution Quarter, Radius 0.5, Power 1). Fulgor: Strength 0 (off) to 10, Adaptation Time 2 s; it moves the colour of a Directional light's shadow fill toward the colour of what is lit on screen (sky left out), so a red room gets warm shadows; 1 is the scene's colour, above 1 exaggerates. |
| Fog | Preset (None, Atmospheric, Dawn, Dense, Smog, Swamp), Falloff Mode Exponential, Density 0.02, Start Distance 0, Height Falloff 0 (0 = distance fog only), Color, Sky Amount 1. |
| Depth of Field | Blurs what is out of focus. Mode Auto (default: activates when the camera is near something: Activation Distance 1, Focus Speed 0.5) or Manual (Focus Distance 5); Focus Range 1, Transition Range 1, Blur Amount 0.5, Bokeh Radius 0.015. |
| Motion Blur | Mode Camera + Objects (default) or Camera Only; Shutter Angle 180, Max Blur 1, Sample Count 16, Object Strength 1, Smear (Trailing). Pixels drawn by an Overlay camera (arms) stay sharp. |
| Chromatic Aberration | Colour fringes toward the edges. Intensity 0.3, Start Offset 0.2. |
| Film Grain | Intensity 0.05, Response 1. |
| Vignette | Intensity 0.4, Smoothness 0.5, Roundness 1, Color black. |
| Lens Flare | Starburst on the brightest visible light (Directional, Point, Spot, Area; not Ambient or Soft). Intensity 1; **Intensity Threshold 1.5**: a light whose own Intensity is lower never flares. |
| Rain | Streaks, lens droplets, thinner visibility. **Intensity 0**: nothing shows until you raise it. Wind Lean, Speed 1, Distance Falloff 0.5, Lens Droplets on, Area Radius 60. |
| Distortion, Glitch, Lens Distortion | Screen wobble (presets such as Heat Haze; Intensity 0), glitch (Scanlines, RGB Split, Static Noise, CRT Lines, each On/Off), barrel / pincushion (Intensity -1 to 1). |
| Dithering | Last: noise that hides banding in skies and fog. Intensity 1. |
| Anti-Aliasing | FXAA over the tonemapped image. Quality Low, Medium, High (default), Ultra. |

- Heavy: **Lumos** (three compute effects, each with its own Resolution), **Depth of Field** and **Motion Blur** (several passes; Sample Count / Iterations scale them). Lower Lumos Resolution first.

**Materials and shaders.**
- A material is a **Material** card on the entity (one per submesh slot), or a shared **`.mat`** asset (Assets panel -> New Material; an imported model brings its `.mat` files). Drag a `.mat` onto an entity, onto the Inspector, or onto a row of the MeshRenderer card's **Materials** list (one row per submesh) to assign it. A material of the scene can be made an asset: right-click its card header -> **Save As Material Asset**. Edits to a `.mat` are written at once, without Ctrl+S.
- **Shader** list: **PBR** (default), **Phong** (Base Color and Emissive only, no maps), **Unlit** (flat colour), **Sprite**, **Text**, **Water**, **Plant** (PBR plus wind sway, used by trees). Sprite, Text and Water entities made from the Scenes menu already carry theirs. The list also shows Terrain, Flame, Explosion and Particle, which belong to their components.
- **PBR** fields: **Surface Type** Opaque, Cutout (Alpha Cutoff, starts at 0.5; leaves, fences) or Transparent (refracts: IOR 1.5, Thickness 1, Attenuation Color / Distance, Frost; glass). **Base Color**, **Metallic** 0, **Roughness** 0.5, **Normal** 1 (Normal Format OpenGL (Y+) or DirectX (Y-)), **Reflectance** 0.5, **Emissive** Color and **Intensity** (0: no glow until raised). Each has a colour or number plus a texture slot (7 maps in all: Base Color, Metallic, Roughness, Normal, Reflectance, Frost, Emissive; drag a texture onto the swatch). Packed maps: Advanced Options -> Metallic Channel / Roughness Channel. **Tiling** 1,1 and **Offset** 0,0. **GPU Instancing** (off, Performance): one draw for every object sharing this material and mesh; not for Transparent. There is no ambient-occlusion map: occlusion comes from the Lumos effect.
- **Custom shader (`.sdr`)**: a TypeScript class `extends Shader` with `@ShaderProgram({ label })`, WGSL in `source` (groups: 0 frame, 1 lights, 2 material, 3 transform) and `bindMaterialUniforms()`; it then appears in the **Shader** list under its label. Start from the file New Shader writes, and read `brave/core/shader/shader.d.ts`. **Custom effect (`.ppfx`)**: a class `extends PostProcess` with `@PostProcessProgram({ label })`, a `stage` and WGSL `source`, no constructor (fields by initialiser only); it appears in a stack's Add list. The New Post-Process Effect template is stage PostTonemap, so it shares the single Anti-Aliasing slot.

**Quality (Project Settings -> Quality; a new project's values).** **Render Scale** 100% (also 75%, 50%; a script can set 0.1 to 1); **Upscale Technique** (shown below 100%): Bilinear or FSR 1.0 (new projects: FSR 1.0); **MSAA** Off or 4x (new projects: Off; the engine's own default is 4x); **Anisotropic Filtering** 16x; shadows in `lighting.md`; **Max Stains** 1024 (16 to 16384; decals' runtime stains); **Transmission Steps** 1 to 4, default 2: how many times the scene is re-captured for layers of Transparent PBR (glass behind glass), and each step multiplies that cost.

## Scripting
`Camera` has `mainCamera`, `cameraType`, `order`, `layers`, `projection`, `fieldOfView`, `orthographicSize`, `zNear`, `zFar`, `background`, `backgroundColor`, `mergeDepth`, `postProcessStackId` (`null` Default, `'none'`, or a `.pps` asset id). `entity.materials[i].shader` is the Shader of submesh `i` (a `Pbr` has `baseColor`, `metallic`, `roughness`, `emissiveColor`, `emissiveIntensity`, `surfaceType`). To change an effect, find it in the camera's stack and set its fields or `enabled`:
```ts
import { Camera, Float, MotionBlurPostProcess, PostProcessStackSystem, Ref, Script, ScriptComponent } from '@brave/core';

@Script()
export class SprintBlur extends ScriptComponent {
  @Ref(Camera) view!: Camera;
  @Float({ label: 'Sprint Shutter Angle', suffix: 'deg' }) sprintAngle = 360;

  setSprinting(sprinting: boolean) {
    const id = this.view.postProcessStackId;
    if (!id) return;
    const blur = PostProcessStackSystem.get(id)?.effects.find((effect): effect is MotionBlurPostProcess => effect instanceof MotionBlurPostProcess);
    if (blur) blur.shutterAngle = sprinting ? this.sprintAngle : 180;
  }
}
```
`QualitySystem` has a static property for every Quality setting (`renderScale`, `upscaleTechnique`, `msaaSampleCount`, `textureAnisotropy`, `shadowDistance`, `maxSpotShadows`, `transmissionSteps`, ...); they apply live:
```ts
import { QualitySystem, Script, ScriptComponent, UpscaleTechniqueEnum } from '@brave/core';

@Script()
export class GraphicsMode extends ScriptComponent {
  setPerformanceMode(on: boolean) {
    QualitySystem.renderScale = on ? 0.75 : 1;
    QualitySystem.upscaleTechnique = UpscaleTechniqueEnum.Fsr1;
    QualitySystem.shadowDistance = on ? 50 : 100;
  }
}
```

## Traps
- The stack is shared: an effect changed from a script changes every camera that uses that `.pps`, is not undone on Stop in the editor, and stays until you set it back. Prefer one stack and `enabled` or a value.
- A material from a `.mat` is ONE shader shared by every entity that uses it: a script that sets `baseColor` on it recolours them all. For one entity, give it a material of its own (the Material card, not a `.mat`).
- Two **Base** cameras do not combine: the later one clears the earlier one's image. Use Overlay for a second view drawn on top.
- Changing MSAA (or any setting that recompiles pipelines) flashes the error shader for a moment: set it at startup, not every frame. In the editor, `QualitySystem` is not reset on Stop, and saving Project Settings writes what it holds then.
- The editor's GPU setup allows 16 sampled textures per shader stage (the PBR uses all 16: seven material maps plus the engine's own). A custom `.sdr` counts against the same limit and past it the shader does not compile in the editor; keep to 16 so it also runs wherever the game is played.
- Saving a `.sdr` does not update materials already using it in a running scene: re-pick the shader or reload the scene.

Types: `brave/core/component/{camera,camera-type.enum,camera-projection.enum,camera-background.enum,material,mesh-renderer}.d.ts`, `brave/core/post-process/`, `brave/core/system/{post-process-system,quality-system}/`, `brave/core/shader/{shader,pbr,phong,unlit,sprite,water}.d.ts`, `brave/core/enum/surface-type.enum.d.ts`
