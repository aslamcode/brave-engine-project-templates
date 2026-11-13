#!/usr/bin/env python3
"""The placeholder sounds of a character moving (a footstep on firm ground, a landing), made by synthesis (no recordings, no numpy) with the building blocks of `combat.py`: 16-bit mono 44.1 kHz WAV files
in `assets/audio/locomotion/`.

    python3 tools/sounds/locomotion.py            # writes every sound, then prints duration, peak and RMS of each

The `Footsteps` script plays one of the `step-*` at random for every foot that lands (an entity with an Audio Source child for each variation) and `land` when the body lands from a fall. They are all
scaled to -3 dB: how loud a step is, by the speed, is the script's. To replace one drop a better file over the same name (the scripts hold the asset's id, which a replaced file keeps); to add a variation
write a line in the table and an Audio Source for it under the sound's entity.
"""
import math, os, random, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import combat as c  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'audio', 'locomotion')


def footstep(seed):
    """A heel on firm ground: a thump that falls in pitch, the body of the step (noise whose brightness falls fast) and a little scuff just after it; the seed changes the pitch, the colour and the decay."""
    rng = random.Random(seed)
    jitter = lambda value, amount: value * (1 + rng.uniform(-amount, amount))
    thump = c.decay(c.sine(0.14, jitter(120, 0.15), jitter(52, 0.1)), jitter(0.034, 0.2))
    raw = c.noise(0.24, rng)
    body = c.decay(c.lowpass(raw, c.sweep(jitter(2100, 0.2), jitter(380, 0.2), len(raw))), jitter(0.05, 0.25))
    scuff = c.decay(c.bandpass(c.noise(0.14, rng), jitter(1700, 0.2), jitter(5200, 0.2)), jitter(0.028, 0.25))
    return c.finish(c.mix((thump, 0.8, 0.0), (body, 1.0, 0.0), (scuff, 0.2, jitter(0.014, 0.3))))


def landing(seed):
    """Both feet and the weight of the body: a deeper, longer thump under a wider burst, and the scuff of both soles."""
    rng = random.Random(seed)
    thump = c.decay(c.sine(0.3, 95, 38), 0.07)
    raw = c.noise(0.34, rng)
    body = c.decay(c.lowpass(raw, c.sweep(2600, 300, len(raw))), 0.085)
    scuff = c.decay(c.bandpass(c.noise(0.2, rng), 1500, 5600), 0.05)
    return c.finish(c.mix((thump, 1.0, 0.0), (body, 0.9, 0.0), (scuff, 0.3, 0.02), (scuff, 0.18, 0.045)))


SOUNDS = {
    'step-1': lambda: footstep(11),
    'step-2': lambda: footstep(12),
    'step-3': lambda: footstep(13),
    'step-4': lambda: footstep(14),
    'land': lambda: landing(21),
}


def main():
    c.OUT = OUT  # `combat.write()` writes where `OUT` says
    for name, make in SOUNDS.items():
        samples = make()
        path = c.write(name, samples)
        peak = max(abs(x) for x in samples)
        rms = math.sqrt(sum(x * x for x in samples) / len(samples))
        print(f'{name:8s} {len(samples) / c.RATE:5.2f} s  peak {20 * math.log10(peak):6.1f} dB  rms {20 * math.log10(rms):6.1f} dB  {os.path.relpath(path)}')


if __name__ == '__main__':
    main()
