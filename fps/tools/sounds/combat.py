#!/usr/bin/env python3
"""The placeholder sounds of the combat scripts, made by synthesis (no recordings, no numpy): shaped noise, filtered clicks and decaying sines, written as 16-bit mono 44.1 kHz WAV files to
`assets/audio/combat/`. Run `python3 tools/sounds/combat.py` from the project folder, then let the editor (or `ensure-sidecars.py`) write the sidecars of the new files.

Each sound is ONE function, and the table SOUNDS at the end says which file it makes: to replace a sound drop a better file over the same name, to add one write a function and a line in the table.
The gunshot has three variations (the same function with another seed): the shot sound of the Weapon is an entity with one Audio Source child for each of them, and one plays at random.
"""
import math, os, random, struct, wave

RATE = 44100
PEAK = 0.708  # -3 dB
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'assets', 'audio', 'combat')


# --- building blocks -------------------------------------------------------------------------------------------------------------------------------------------------------------------
def silence(seconds):
    return [0.0] * int(seconds * RATE)


def noise(seconds, rng):
    return [rng.uniform(-1, 1) for _ in range(int(seconds * RATE))]


def sine(seconds, freq, freq_end=None, phase=0.0):
    """A sine; with `freq_end` its frequency glides there (exponentially)."""
    count = int(seconds * RATE)
    out, angle = [], phase
    for i in range(count):
        f = freq if freq_end is None else freq * (freq_end / freq) ** (i / max(count - 1, 1))
        angle += 2 * math.pi * f / RATE
        out.append(math.sin(angle))
    return out


def decay(samples, tau, attack=0.0005):
    """An exponential decay with time constant `tau` seconds and a very short attack (a click that starts at once would click)."""
    out = []
    for i, x in enumerate(samples):
        t = i / RATE
        out.append(x * math.exp(-t / tau) * min(1.0, t / attack if attack > 0 else 1.0))
    return out


def bell(samples, peak_at=0.5):
    """A smooth rise and fall over the whole length (a whoosh)."""
    count = len(samples)
    return [x * math.sin(math.pi * (i / count) ** (math.log(0.5) / math.log(peak_at))) ** 2 for i, x in enumerate(samples)]


def lowpass(samples, cutoff):
    """One pole low pass; `cutoff` is a number or a function of the sample index (a sweep)."""
    out, y = [], 0.0
    for i, x in enumerate(samples):
        c = cutoff(i) if callable(cutoff) else cutoff
        a = 1 - math.exp(-2 * math.pi * c / RATE)
        y += a * (x - y)
        out.append(y)
    return out


def highpass(samples, cutoff):
    low = lowpass(samples, cutoff)
    return [x - l for x, l in zip(samples, low)]


def bandpass(samples, low, high):
    return highpass(lowpass(samples, high), low)


def sweep(start, end, count):
    """A cutoff that glides from `start` to `end` Hz over `count` samples."""
    return lambda i: start * (end / start) ** min(1.0, i / max(count - 1, 1))


def mix(*tracks):
    """Sums tracks, each given as (samples, gain, start_seconds)."""
    length = max(int(start * RATE) + len(samples) for samples, _, start in tracks)
    out = [0.0] * length
    for samples, gain, start in tracks:
        offset = int(start * RATE)
        for i, x in enumerate(samples):
            out[offset + i] += x * gain
    return out


def finish(samples):
    """Fades the ends (2 ms in, 20 ms out) and scales the peak to -3 dB."""
    n = len(samples)
    fade_in, fade_out = int(0.002 * RATE), min(int(0.02 * RATE), n)
    out = list(samples)
    for i in range(min(fade_in, n)):
        out[i] *= i / fade_in
    for i in range(fade_out):
        out[n - 1 - i] *= i / fade_out
    peak = max(abs(x) for x in out) or 1.0
    return [x * PEAK / peak for x in out]


def write(name, samples):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name + '.wav')
    with wave.open(path, 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(b''.join(struct.pack('<h', int(max(-1.0, min(1.0, x)) * 32767)) for x in samples))
    return path


# --- the sounds: one function each -----------------------------------------------------------------------------------------------------------------------------------------
def gunshot(seed):
    """A noise burst whose brightness falls fast, a low thump under it and a short tail; the seed jitters the pitch and the decay a little."""
    rng = random.Random(seed)
    jitter = lambda value, amount: value * (1 + rng.uniform(-amount, amount))
    n = int(0.12 * RATE)
    burst = decay(lowpass(noise(0.4, rng), sweep(jitter(9000, 0.1), jitter(1400, 0.15), n * 3)), jitter(0.035, 0.2))
    crack = decay(highpass(noise(0.02, rng), 3000), 0.004)
    thump = decay(sine(0.3, jitter(150, 0.12), jitter(42, 0.1)), jitter(0.075, 0.15))
    tail = decay(lowpass(noise(0.6, rng), jitter(900, 0.2)), jitter(0.16, 0.2))
    return finish(mix((burst, 0.9, 0), (crack, 0.5, 0), (thump, 0.9, 0), (tail, 0.22, 0.01)))


def dry_fire():
    """Two light clicks of a hammer falling on nothing, the second softer and 40 ms later."""
    rng = random.Random(11)
    click = mix((decay(highpass(noise(0.03, rng), 1500), 0.004), 1.0, 0), (decay(sine(0.05, 2300), 0.012), 0.5, 0), (decay(sine(0.05, 380), 0.02), 0.4, 0))
    return finish(mix((click, 1.0, 0), (click, 0.55, 0.045)))


def clack(rng, weight=1.0):
    """A short mechanical knock: a burst of high noise, a metallic ring and a low thud under them."""
    hit = decay(highpass(noise(0.05, rng), 900), 0.006)
    ring = decay(sine(0.12, 1900), 0.025)
    thud = decay(sine(0.1, 210, 120), 0.03)
    return mix((hit, 1.0, 0), (ring, 0.3 * weight, 0), (thud, 0.7 * weight, 0))


def scrape(rng, seconds):
    """Metal sliding on metal: band-passed noise that swells and fades."""
    return bell(bandpass(noise(seconds, rng), 1500, 4500), 0.6)


def magazine_out():
    rng = random.Random(21)
    return finish(mix((clack(rng, 0.8), 1.0, 0), (scrape(rng, 0.12), 0.25, 0.06)))


def magazine_in():
    rng = random.Random(22)
    return finish(mix((scrape(rng, 0.14), 0.3, 0), (clack(rng, 1.3), 1.0, 0.13)))


def bolt():
    """The charging handle: it is pulled back (a knock) and let go (a harder one, with a ring)."""
    rng = random.Random(23)
    back = clack(rng, 0.7)
    forward = mix((clack(rng, 1.5), 1.0, 0), (decay(sine(0.2, 2800), 0.05), 0.2, 0))
    return finish(mix((scrape(rng, 0.1), 0.25, 0), (back, 0.8, 0.08), (forward, 1.0, 0.3)))


def enemy_hit():
    """A dull thud: a low sine that falls in pitch and a puff of dark noise."""
    rng = random.Random(31)
    return finish(mix((decay(sine(0.3, 125, 55), 0.07), 1.0, 0), (decay(lowpass(noise(0.2, rng), 500), 0.03), 0.6, 0)))


def enemy_die():
    """A heavy fall: the pitch sinks over a second, with a rumble and a scatter of noise as it hits the ground."""
    rng = random.Random(32)
    groan = decay(sine(1.1, 190, 38), 0.35, attack=0.01)
    wobble = [x * (0.7 + 0.3 * math.sin(2 * math.pi * 9 * i / RATE)) for i, x in enumerate(groan)]
    rumble = decay(lowpass(noise(1.0, rng), 300), 0.3)
    crash = decay(lowpass(noise(0.4, rng), sweep(3000, 400, int(0.4 * RATE))), 0.07)
    return finish(mix((wobble, 0.9, 0), (rumble, 0.5, 0.05), (crash, 0.6, 0.35)))


def player_hurt():
    """A blow and a grunt: a low thump, a band of noise shaped like a short vowel and a high crack at the start."""
    rng = random.Random(41)
    thump = decay(sine(0.25, 95, 55), 0.07)
    grunt = decay(bandpass(noise(0.3, rng), 350, 900), 0.09, attack=0.01)
    voice = decay(sine(0.3, 150, 105), 0.1, attack=0.01)
    crack = decay(highpass(noise(0.03, rng), 2500), 0.006)
    return finish(mix((thump, 1.0, 0), (grunt, 0.8, 0.02), (voice, 0.4, 0.02), (crack, 0.4, 0)))


def enemy_attack():
    """A swipe: noise through a band that rises from 500 to 2500 Hz, loudest in the middle."""
    rng = random.Random(51)
    n = int(0.4 * RATE)
    return finish(bell(lowpass(highpass(noise(0.4, rng), 400), sweep(500, 3500, n)), 0.55))


def wave_start():
    """A low tone that rises: a sine from 65 to 190 Hz with a soft octave over it and a slow swell."""
    count = int(1.2 * RATE)
    tone = sine(1.2, 65, 190)
    octave = sine(1.2, 130, 380)
    body = [(a + 0.35 * b) * math.sin(math.pi * (i / count) ** 0.7) ** 1.5 for i, (a, b) in enumerate(zip(tone, octave))]
    return finish(body)


# --- the table: file name -> how it is made ---------------------------------------------------------------------------------------------------------------------------------------
SOUNDS = {
    'gunshot-1': lambda: gunshot(1),
    'gunshot-2': lambda: gunshot(2),
    'gunshot-3': lambda: gunshot(3),
    'dry-fire': dry_fire,
    'magazine-out': magazine_out,
    'magazine-in': magazine_in,
    'bolt': bolt,
    'enemy-hit': enemy_hit,
    'enemy-die': enemy_die,
    'player-hurt': player_hurt,
    'enemy-attack': enemy_attack,
    'wave-start': wave_start,
}


def main():
    for name, make in SOUNDS.items():
        samples = make()
        path = write(name, samples)
        peak = max(abs(x) for x in samples)
        rms = math.sqrt(sum(x * x for x in samples) / len(samples))
        print(f'{name:14s} {len(samples) / RATE:5.2f} s  peak {20 * math.log10(peak):6.1f} dB  rms {20 * math.log10(rms):6.1f} dB  {os.path.relpath(path)}')


if __name__ == '__main__':
    main()
