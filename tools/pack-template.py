#!/usr/bin/env python3
"""Packs one template into the zip the Hub downloads when its catalog entry has an `archive`: the template's tracked files, as they are in the working tree, inside one wrapper folder (the shape of the
archive GitHub makes for a ref, which is what the Hub's extraction expects: one folder that holds the template's own folder).

    python3 tools/pack-template.py fps          # writes dist/fps.zip

Why it exists: GitHub's source archives do not carry the content of Git LFS files, only their pointers, and a project whose models and textures are pointers does not load. The zip made here has the
real files (the working tree has them when Git LFS is installed), and it refuses to be made when a file in it is still a pointer (`git lfs pull` brings them). Only what Git tracks goes in, so what the
project's own `.gitignore` leaves out (the `mixamo/` folder of clips that must not be shared, the editor's caches) does not.
"""
import os
import subprocess
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POINTER = b'version https://git-lfs.github.com/spec/v1'


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    template = sys.argv[1]
    listed = subprocess.run(['git', 'ls-files', '-z', '--', template], cwd=ROOT, check=True, capture_output=True).stdout.split(b'\0')
    files = sorted(name.decode() for name in listed if name)
    if not files:
        print(f'{template}: Git tracks nothing there')
        return 1

    pointers = [name for name in files if open(os.path.join(ROOT, name), 'rb').read(len(POINTER)) == POINTER]
    if pointers:
        print(f'{template}: {len(pointers)} file(s) are still Git LFS pointers (run `git lfs pull`): {pointers[:5]}')
        return 1

    wrapper = f'brave-engine-project-templates-{template}'
    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
    target = os.path.join(ROOT, 'dist', f'{template}.zip')
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in files:
            archive.write(os.path.join(ROOT, name), f'{wrapper}/{name}')
    print(f'{target}: {len(files)} files, {os.path.getsize(target) / 1048576:.1f} MB')
    return 0


if __name__ == '__main__':
    sys.exit(main())
