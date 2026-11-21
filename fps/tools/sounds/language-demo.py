#!/usr/bin/env python3
"""The voice of the language demo, one file for each language (`assets/audio/voice/<language>/radio-demo.wav`), made by synthesis: twenty-two seconds of quiet with a short beep at the moment each line of that language's
subtitles starts, so that a person can HEAR whether the subtitle comes with it, and which language is playing (the tones differ). Not a voice on purpose: the point is the timing and the swap. The lines are in
`assets/languages/*.lang` under `subtitles["radio-demo"]`, one list for each language with its own times. Both clips last the same twenty-two seconds, the case of a dub made to the length of the original: switching the
language in the middle of the line continues at the same second.

    en     0.0 s A5   4.0 s C#6   7.0 s E5 (the radio)   10.0 s E6   13.0 s G5 (the radio)   20.3 s B5   20.8 s D5 (the radio)
    pt-BR  0.0 s D5   4.2 s F#5   7.3 s A4 (the radio)   10.3 s A5   13.4 s C5 (the radio)   21.1 s E5   21.5 s G5 (the radio)

The last two lines are QUICK on purpose (0.7 and 0.45 s of sound for 50 to 60 characters; the clip ends with them): they are gone from the sound before they could be read, which is what the time a line is
kept for reading is for (`Subtitles.readingSpeed`), and the first of the two says what happens when the clip ends on its own while a line is still being read.

The first five lines are LONG on purpose (36 to 148 characters: the long ones take two lines in the lane, three in a narrow window) and overlap, each with time enough to be read (10 to 18 characters a second): two are on
the screen at once for most of the clip and three for a second or two, which is how the HUD (and the size of its font) is tried with real sentences. Each language has its own timing.

The folder is the language, named like its `.lang` file; the scene references the file of the project's default language (`en`) and the engine plays the sibling of the language in use. Run
`python3 tools/sounds/language-demo.py` from the project folder, then let the editor (or `ensure-sidecars.py`) write the sidecar of a new file.
"""
import math, os, struct, wave

RATE = 22050
HERE = os.path.dirname(os.path.abspath(__file__))
VOICE = os.path.join(HERE, '..', '..', 'assets', 'audio', 'voice')
SECONDS = 22.0
CLIPS = {
    'en': [(0.0, 880.0), (4.0, 1108.7), (7.0, 659.3), (10.0, 1318.5), (13.0, 784.0), (20.3, 987.8), (20.8, 587.3)],
    'pt-BR': [(0.0, 587.3), (4.2, 740.0), (7.3, 440.0), (10.3, 880.0), (13.4, 523.3), (21.1, 659.3), (21.5, 784.0)],
}


def beep(samples, start, freq, length=0.14, level=0.4):
    first = int(start * RATE)
    for i in range(int(length * RATE)):
        t = i / RATE
        fade = min(1.0, t / 0.008, (length - t) / 0.02)   # no click at either end
        samples[first + i] += level * fade * math.sin(2 * math.pi * freq * t)


def main():
    for language, beeps in CLIPS.items():
        samples = [0.0] * int(SECONDS * RATE)
        for start, freq in beeps:
            beep(samples, start, freq)
        folder = os.path.join(VOICE, language)
        os.makedirs(folder, exist_ok=True)
        with wave.open(os.path.join(folder, 'radio-demo.wav'), 'wb') as out:
            out.setnchannels(1)
            out.setsampwidth(2)
            out.setframerate(RATE)
            out.writeframes(b''.join(struct.pack('<h', int(max(-1.0, min(1.0, s)) * 32767)) for s in samples))


if __name__ == '__main__':
    main()
