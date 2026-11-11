#!/usr/bin/env python3
"""Synthesizes the sounds of the interaction scripts (doors, drawers, pickups, sockets) as 16-bit mono 44.1 kHz WAV files in `assets/audio/interaction/`.

    python3 tools/sounds/interaction.py            # writes every sound, then prints duration, peak and RMS of each
    python3 tools/sounds/interaction.py door-open  # only the named ones

These are PLACEHOLDERS made with shaped noise, decaying sines and resonant filters, so that the kit is not silent; better sounds replace them by dropping a file of the same name over the
old one in the Assets panel (the scripts hold the asset's id, which a replaced file keeps), or by picking another file in the script's Inspector field.

One function per sound below, each returning a list of samples in [-1, 1]; the table at the end (`SOUNDS`) says which function makes which file and how loud the peak is. To add a sound: write
a function, add a line to the table, run the script, run `tools/fps-kit/ensure-sidecars.py` of the engine repository for the new file's sidecar. Pure Python (no numpy): about a second for all of them.
"""
import math
import os
import random
import struct
import sys
import wave

RATE = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'audio', 'interaction')


# --- building blocks ------------------------------------------------------------------------------------------------------------------------------------------------------------

def silence(seconds):
    return [0.0] * int(seconds * RATE)


def mix(*tracks):
    """The sum of tracks of any length."""
    out = [0.0] * max(len(t) for t in tracks)
    for track in tracks:
        for i, v in enumerate(track):
            out[i] += v
    return out


def at(track, seconds, length=None):
    """`track` put `seconds` in (silence in front), padded to `length` seconds if given."""
    out = silence(seconds) + list(track)
    if length is not None:
        out += [0.0] * max(0, int(length * RATE) - len(out))
    return out


def scaled(track, gain):
    return [v * gain for v in track]


def noise(rng, seconds):
    return [rng.uniform(-1, 1) for _ in range(int(seconds * RATE))]


def decay(track, seconds, attack=0.002):
    """An exponential decay with `seconds` as the time to fall by 60 dB, and a very short attack so that it does not click."""
    out = []
    a = max(1, int(attack * RATE))
    for i, v in enumerate(track):
        t = i / RATE
        env = math.exp(-6.9 * t / seconds) * min(1.0, i / a)
        out.append(v * env)
    return out


def swell(track, peak_at, power=1.0):
    """A triangular envelope that rises to the middle point `peak_at` (0 to 1 of the length) and falls again."""
    n = len(track)
    out = []
    for i, v in enumerate(track):
        x = i / max(1, n - 1)
        env = (x / peak_at) if x < peak_at else ((1 - x) / (1 - peak_at))
        out.append(v * (max(0.0, env) ** power))
    return out


def lowpass(track, cutoff):
    """One pole: soft, a few dB per octave. `cutoff` in Hz (a number, or a function of the time in seconds)."""
    out, y = [], 0.0
    for i, v in enumerate(track):
        fc = cutoff(i / RATE) if callable(cutoff) else cutoff
        a = 1 - math.exp(-2 * math.pi * fc / RATE)
        y += a * (v - y)
        out.append(y)
    return out


def highpass(track, cutoff):
    low = lowpass(track, cutoff)
    return [v - l for v, l in zip(track, low)]


def resonator(track, centre, bandwidth):
    """A two-pole band-pass: rings at `centre` Hz (a number or a function of the time), `bandwidth` Hz wide at -3 dB. What turns a click into a metal tick and a pulse train into a creak."""
    out, y1, y2 = [], 0.0, 0.0
    for i, v in enumerate(track):
        fc = centre(i / RATE) if callable(centre) else centre
        bw = bandwidth(i / RATE) if callable(bandwidth) else bandwidth
        r = math.exp(-math.pi * bw / RATE)
        y = (1 - r) * v + 2 * r * math.cos(2 * math.pi * fc / RATE) * y1 - r * r * y2
        y2, y1 = y1, y
        out.append(y)
    return out


def sine(frequency, seconds, phase=0.0):
    """A sine of `frequency` Hz (a number, or a function of the time for a glide)."""
    out, p = [], phase
    for i in range(int(seconds * RATE)):
        f = frequency(i / RATE) if callable(frequency) else frequency
        p += 2 * math.pi * f / RATE
        out.append(math.sin(p))
    return out


def fade(track, head=0.004, tail=0.02):
    """So that no sound starts or ends on a step."""
    n = len(track)
    h, t = max(1, int(head * RATE)), max(1, int(tail * RATE))
    return [v * min(1.0, i / h, (n - 1 - i) / t) for i, v in enumerate(track)]


def tick(rng, centres, ring=0.012, size=0.003):
    """A metal tick: a few milliseconds of noise that excites resonators at `centres` Hz, each ringing for about `ring` seconds."""
    burst = noise(rng, size)
    parts = [decay(resonator(burst + silence(ring * 4), c, c * 0.08), ring) for c in centres]
    return mix(*parts)


def thud(frequency, seconds, rng, body=0.5):
    """A dull knock: a sine that falls from `frequency` to half of it, and a little low-passed noise for the contact."""
    glide = sine(lambda t: frequency * (1 - 0.5 * min(1.0, t / (seconds * 0.5))), seconds)
    return mix(decay(glide, seconds * 0.7), scaled(decay(lowpass(noise(rng, seconds), 500), seconds * 0.25), body))


def creak(rng, seconds, low, high, quality):
    """A creak: friction that sticks and slips about 60 to 130 times a second (an irregular pulse train), through a resonance that glides from `low` to `high` Hz."""
    pulses = []
    phase, wobble = 0.0, 0.0
    for i in range(int(seconds * RATE)):
        t = i / seconds / RATE
        wobble += (rng.uniform(-1, 1) - wobble) * 0.0004
        rate = 60 + 70 * t + 25 * wobble
        phase += rate / RATE
        if phase >= 1.0:
            phase -= 1.0
            pulses.append(rng.uniform(0.5, 1.0))
        else:
            pulses.append(0.0)
    centre = lambda t: low + (high - low) * (t / seconds) ** 0.8
    return resonator(pulses, centre, lambda t: centre(t) / quality)


# --- the sounds ------------------------------------------------------------------------------------------------------------------------------------------------------------------

def door_open():
    """The latch lets go (a tick), then the hinge: a creak that glides up as the door swings, over a low body that is the door's own weight in the air. About 1.1 s."""
    rng = random.Random(11)
    seconds = 1.05
    hinge = swell(creak(rng, seconds, 650, 1500, 9), 0.42, 0.8)
    body = swell(lowpass(noise(rng, seconds), lambda t: 90 + 140 * t), 0.5, 1.2)
    air = swell(highpass(lowpass(noise(rng, seconds), 2400), 900), 0.45, 1.5)
    latch = at(tick(rng, (1800, 3200)), 0.0, seconds)
    return mix(scaled(hinge, 7.0), scaled(body, 1.8), scaled(air, 0.18), scaled(latch, 1.4))


def door_close():
    """The door meets the frame: a thud, the latch's two clicks, and the frame humming for a moment. Played when the door is shut, so the thud is at the start. About 0.6 s."""
    rng = random.Random(23)
    knock = thud(95, 0.28, rng, 0.9)
    clicks = mix(at(tick(rng, (1500, 2600)), 0.085), at(tick(rng, (2100, 3400), 0.01), 0.125))
    hum = decay(resonator(at(noise(rng, 0.01), 0.0, 0.45), 140, 25), 0.25)
    return mix(scaled(knock, 1.0), scaled(clicks, 0.85), scaled(hum, 6.0))


def door_locked():
    """Somebody tries the handle of a locked door: two dull rattles, the second one weaker. About 0.5 s."""
    rng = random.Random(37)

    def rattle(strength):
        shake = decay(lowpass(noise(rng, 0.16), 1800), 0.07)
        ring = tick(rng, (520, 1100), 0.05)
        thump = decay(sine(150, 0.1), 0.05)
        return mix(scaled(shake, 1.0), scaled(ring, 3.0), scaled(thump, 0.8))
    first = rattle(1.0)
    second = scaled(rattle(0.6), 0.65)
    return mix(first, at(second, 0.17))


def door_unlock():
    """The bolt: a metal click, a beat, then the clunk of it sliding home. About 0.5 s."""
    rng = random.Random(41)
    click = tick(rng, (2300, 3700, 5200), 0.014)
    clunk = mix(thud(170, 0.2, rng, 0.7), scaled(tick(rng, (1100, 1700), 0.05), 1.2))
    return mix(scaled(click, 1.1), at(clunk, 0.14, 0.5))


def drawer_open():
    """A drawer on its runners: a soft slide of low-passed noise, and the small knock of the stop at the end. About 0.55 s."""
    rng = random.Random(53)
    slide = swell(lowpass(noise(rng, 0.4), lambda t: 500 + 600 * t), 0.5, 1.0)
    rumble = swell(lowpass(noise(rng, 0.4), 140), 0.5, 1.0)
    knock = thud(120, 0.14, rng, 0.6)
    return mix(scaled(slide, 0.8), scaled(rumble, 1.2), at(scaled(knock, 0.8), 0.38, 0.55))


def drawer_close():
    """The same slide, going the other way, ending in a soft thud against the cabinet. About 0.5 s."""
    rng = random.Random(59)
    slide = swell(lowpass(noise(rng, 0.38), lambda t: 1100 - 600 * t), 0.45, 1.0)
    rumble = swell(lowpass(noise(rng, 0.38), 140), 0.45, 1.0)
    knock = thud(100, 0.16, rng, 0.8)
    return mix(scaled(slide, 0.8), scaled(rumble, 1.2), at(scaled(knock, 1.0), 0.33, 0.5))


def pickup():
    """A soft rise: two sines a fifth apart gliding up, with a little air on top. About 0.25 s."""
    rng = random.Random(61)
    seconds = 0.24
    low = sine(lambda t: 520 + 360 * (t / seconds), seconds)
    high = sine(lambda t: 780 + 540 * (t / seconds), seconds)
    shimmer = highpass(lowpass(noise(rng, seconds), 7000), 3000)
    body = mix(scaled(low, 0.6), scaled(high, 0.25), scaled(shimmer, 0.04))
    return decay(swell(body, 0.3, 0.7), seconds * 0.8, attack=0.01)


def put():
    """Something set down in a slot: a thud, then the click of it seating. About 0.3 s."""
    rng = random.Random(67)
    knock = thud(130, 0.18, rng, 0.8)
    seat = tick(rng, (1400, 2500), 0.02)
    return mix(knock, at(scaled(seat, 0.9), 0.075, 0.3))


def deny():
    """Not now: one short dull click. About 0.1 s."""
    rng = random.Random(71)
    click = decay(sine(210, 0.1), 0.04)
    air = decay(lowpass(noise(rng, 0.1), 900), 0.02)
    return mix(scaled(click, 0.9), scaled(air, 0.7))


# --- the table: file name, function, peak (0 to 1; 0.708 is -3 dB) ------------------------------------------------------------------------------------------------

SOUNDS = [
    ('door-open', door_open, 0.70),
    ('door-close', door_close, 0.70),
    ('door-locked', door_locked, 0.60),
    ('door-unlock', door_unlock, 0.65),
    ('drawer-open', drawer_open, 0.50),
    ('drawer-close', drawer_close, 0.50),
    ('pickup', pickup, 0.50),
    ('put', put, 0.65),
    ('deny', deny, 0.50),
]


# --- writing and checking -------------------------------------------------------------------------------------------------------------------------------------------------

def write_wav(name, samples, peak):
    faded = fade(samples, head=0.0015)
    top = max(abs(v) for v in faded) or 1.0
    gain = peak / top
    data = [max(-1.0, min(1.0, v * gain)) for v in faded]
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name + '.wav')
    with wave.open(path, 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(b''.join(struct.pack('<h', int(round(v * 32767))) for v in data))
    return data


def report(name, data):
    seconds = len(data) / RATE
    peak = max(abs(v) for v in data)
    rms = math.sqrt(sum(v * v for v in data) / len(data))
    mean = sum(data) / len(data)
    bad = sum(1 for v in data if v != v or abs(v) > 1.0)
    print(f'{name:14s} {seconds:5.2f} s   peak {20 * math.log10(peak):6.1f} dB   rms {20 * math.log10(rms):6.1f} dB   dc {mean:+.5f}   bad samples {bad}   ends at {abs(data[-1]):.5f}')


def main(names):
    for name, function, peak in SOUNDS:
        if names and name not in names:
            continue
        report(name, write_wav(name, function(), peak))


if __name__ == '__main__':
    main(sys.argv[1:])
