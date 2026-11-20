#!/usr/bin/env python3
"""The sound of the language demo (`assets/audio/demo/radio-demo.wav`), made by synthesis: nine seconds of quiet with a short beep at the moment each line of the radio's subtitles starts, so that a person can HEAR
whether the subtitle comes with it. Not a voice on purpose: the point is to see the timing. The lines are in `assets/languages/*.lang` under `subtitles["radio-demo"]`, one list for each language with its own times.

    0.0 s  beep (A5)   the guard's first line
    3.0 s  beep (C#6)  the second
    6.0 s  beep (E6)   the third
    6.6 s  beep (E5)   the radio's line, which shows together with the third (two speakers at once)

Run `python3 tools/sounds/language-demo.py` from the project folder, then let the editor (or `ensure-sidecars.py`) write the sidecar.
"""
import math, os, struct, wave

RATE = 22050
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'assets', 'audio', 'demo')
SECONDS = 9.0
BEEPS = [(0.0, 880.0), (3.0, 1108.7), (6.0, 1318.5), (6.6, 659.3)]


def beep(samples, start, freq, length=0.14, level=0.4):
    first = int(start * RATE)
    for i in range(int(length * RATE)):
        t = i / RATE
        fade = min(1.0, t / 0.008, (length - t) / 0.02)   # no click at either end
        samples[first + i] += level * fade * math.sin(2 * math.pi * freq * t)


def main():
    samples = [0.0] * int(SECONDS * RATE)
    for start, freq in BEEPS:
        beep(samples, start, freq)
    os.makedirs(OUT, exist_ok=True)
    with wave.open(os.path.join(OUT, 'radio-demo.wav'), 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(b''.join(struct.pack('<h', int(max(-1.0, min(1.0, s)) * 32767)) for s in samples))


if __name__ == '__main__':
    main()
