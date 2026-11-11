# Audio

Sound in a game: Audio Sources play clips (in 3D or flat), an Audio Listener is the player's ear, Audio Volumes add reverb or echo to the space the listener is in, the Audio Mixer routes everything through channels, and the Audio Player plays music tracks with crossfades.

## What it is
- **Audio Source**: one clip on an entity, heard from the entity's position (3D) or flat. **Audio Listener**: the ear; the active one decides what is heard. **Audio Volume**: a box (or the whole scene) with Reverb / Echo effects. **Audio Mixer**: the project's tree of channels (Master at the root) with volume, mute, solo, effects and presets. **Audio Player**: named music or ambience tracks, crossfaded, never 3D.
- Audio assets: `.wav`, `.mp3`, `.ogg`, `.opus`, `.webm`. Drop them in the Assets panel (the template has `assets/audio/`).

## Add it
- Scenes panel, right-click: **Audio Source** or **Audio Volume** (a new entity carrying it). Any entity: Inspector, **Add Component**: Audio Source, Audio Listener, Audio Volume, Audio Player.
- **Camera** and **Free Camera** entities made from the Scenes panel already carry an Audio Listener; any other entity needs **Add Component**.
- Give a source its clip by dragging an audio file from the Assets panel onto its **Source** field.
- Mixer: footer tab **Audio Mixer**. Left: preset select with a menu (Clone preset, Rename, Delete) and the **Channels** tree (the **+** button, or right-click: Add Channel, Rename, Delete; drag to re-parent; M mute and S solo per row, Master has no S). Right: level meter, Volume fader in dB (double-click = 0 dB), **Add effect** (Reverb, Echo) and one card per effect (checkbox bypasses it, drag the header to reorder).
- The mixer lives in `audio-mixer.json` at the project root; the editor writes it shortly after each edit (undo works). Solo is never saved.

## Key settings
- **Audio Source**: Gain 0 to 10 (1), Output (mixer channel; Master), Loop (off), Auto Play (on: plays when the source starts or is enabled), Muted, Speed (1), Bypass Time Scale (on; off = speed times `Time.scale`), Bypass Audio Volumes (off: ignore Audio Volumes).
- **Spatial** (on; off = flat, for music and UI), Stereo Pan -1 to 1 (0). **Distance**: Rolloff Mode Linear / Inverse / Exponential (Linear), Min Distance 1, Max Distance 30, Rolloff Factor 10, in world units. **Cone**: Inner Angle 60, Outer Angle 90 (degrees), Outer Gain 0.3: a source is quieter when it faces away from the listener (set both angles to 360 to make it equal in every direction).
- **Pooling** (off) with Min Instances (0): `play()` while the clip is playing starts an overlapping copy (footsteps, shots).
- **Audio Listener**: no settings; it follows its entity. The last one started or enabled is the active one.
- **Audio Volume**: Is Global (off), Box Size 10 x 10 x 10, Box Offset 0 (meters), Fade Distance 0, and the **Effects** list (Add: Reverb, Echo; the order is the signal path, drag to change it).
- **Reverb**: Preset (Stone, Cave, Hall, Wood, Carpet; editing Damping makes it Custom), Damping, Room Size (Auto = average of the box's sides, or Manual Override with Size 1 to 500 and Pre-Delay ms), Wet Level. **Echo**: Delay Time 0 to 2 s (0.3), Feedback 0 to 0.95 (0.35), Wet Level (0.5).
- **Audio Player**: Tracks list (Name, Audio, Volume 0 to 1, Loop, Speed), Transition Duration (1 s), Muted, Bypass Time Scale.

## Scripting
- `AudioSource`: `play()`, `pause()`, `stop()` (pause and rewind), `src`, `gain`, `loop`, `speed`, `muted`, `output`, `trackTime`, `await trackDuration`, and `onTrackEnd` (a `Signal`, not emitted while looping).
- `AudioPlayer`: `play(track)` fades out what plays and remembers it, `stop(track)` fades it out and brings the remembered ones back, `switchTo(track)` replaces everything, `pause`, `resume`, `setVolume(track, v)`, `pauseAll`, `resumeAll`, `stopAll`. An unknown track name does nothing.
- `AudioSystem.muted = true` mutes the whole game (ramped).
- Mixer: `AudioMixerSystem.mixer.flatten()` lists channels (`id`, `name`, `gain` dB, `muted`); `AudioMixerSystem.setPreset(name, seconds)` switches every channel at once.

```ts
import { AudioSource, Ref, Script, ScriptComponent } from '@brave/core';

@Script()
export class Door extends ScriptComponent {
  @Ref(AudioSource) creak!: AudioSource;

  onStart() {
    this.creak.onTrackEnd.on(() => console.log('creak finished'), this);
  }

  open() {
    this.creak.stop();
    this.creak.play();
  }
}
```

```ts
import { AudioMixerSystem, AudioSource, Ref, Script, ScriptComponent } from '@brave/core';

@Script()
export class MusicRouting extends ScriptComponent {
  @Ref(AudioSource) music!: AudioSource;

  onStart() {
    const channel = AudioMixerSystem.mixer.flatten().find(candidate => candidate.name === 'Music');
    if (channel) this.music.output = channel.id;
  }

  duck(on: boolean) {
    const channel = AudioMixerSystem.mixer.flatten().find(candidate => candidate.name === 'Music');
    if (!channel) return;
    AudioMixerSystem.mixer.setGain(channel, on ? -12 : 0);
    AudioMixerSystem.sync(0.5);
  }
}
```

## Traps
- `output` is a channel **id**, not a name; an id that is not a channel plays through Master. After editing `mixer` from a script call `AudioMixerSystem.sync()` or nothing changes. Gain is in dB (-80 to +10).
- A script's mixer changes last for that run only. `setPreset()` saves nothing; the preset chosen in the panel is what the game starts in. To remember a player's choice keep its name in the Vault and call `setPreset()` at start (`save-and-services.md`).
- Effects belong to the **channel**, values (volume, mute, effect on/off and parameters) to the **preset**. An effect added in one preset is OFF in the others until turned on there.
- `play()` on a source that is already playing does nothing (no restart): `stop()` then `play()`. For one-shots set Auto Play off and call `play()`.
- Pooled copies never loop, do not fire `onTrackEnd`, and `stop()` does not cut them (`pause()` does).
- Audio Volumes work from the **listener's** position, not the source's, so no active Audio Listener means no volume effects. They add only the effect (the dry sound is untouched), reach Audio Sources only (not Audio Player tracks), and are heard at the level of the source's channel but do not pass through that channel's effects.
- Nested volumes: the smallest box wins. Fade Distance ramps outside the box (full at the edge, none at that distance away). Global volumes fill what local ones leave; with several Global ones the last to become active wins.
- Audio Player tracks always play through Master. A track that ends without Loop stops like `stop(track)` and brings back the tracks it had paused.
- Pause pauses sources and players. After a load, sources and players resume where they were, but listeners a script added (`onTrackEnd.on(...)`) must be added again in `onRestore()` (`save-and-services.md`).
- Your own effect: a class extending `AudioEffect` with `@AudioEffectProgram()`; no constructor arguments.
- **A clip a script holds** is `@Ref(AudioTrack) clip = ''` (the audio asset's id), played by assigning it to an Audio Source's `src` and calling `play()`. One Audio Source plays ONE clip at a time: a new `src` makes the asset be read again and cuts the sound that is playing, and pooling copies only the current `src`. For several sounds use several Audio Sources (an entity for each, and one picked at random for variations of a gunshot).
- **`speed` goes back to 1 when `src` changes** (the new asset loads after the assignment): set `speed` after `await source.play()`. Right after `play()` the element still says it is paused until the clip has loaded, which takes real time, not frames.
- **A switched-off entity's Audio Source is paused**: the sound of something that switches itself off (a pickup that is collected) must come from another entity's source, the player's, say.

## Not available yet
- An Output select on the Audio Player, a low-pass or EQ effect, import/export of the mixer file, blending of effect parameters between presets (levels glide, parameters jump), reverb from impulse responses, a trigger area that starts a track.

Types: `brave/core/component/audio-source.d.ts`, `brave/core/component/audio-listener.d.ts`, `brave/core/component/audio-volume.d.ts`, `brave/core/component/audio-player/`, `brave/core/audio-effect/`, `brave/core/audio-mixer/`, `brave/core/system/audio-system/`, `brave/core/system/audio-mixer-system/`
