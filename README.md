# Brave Engine — Project Templates

Starter project templates for Brave Engine.
## A template with large files (Git LFS)

The Hub downloads a template from `catalog.json`: by default the repository's source archive at the build's `ref`, and it keeps the template's own folder. GitHub's source archives do not carry
the content of Git LFS files, only their pointers, so a template whose models and textures are in LFS (`fps`) must be a zip of its own:

1. `python3 tools/pack-template.py fps` writes `dist/fps.zip`: the template's tracked files with their real content, inside one wrapper folder (the shape of GitHub's archive). It refuses to run while a
   file is still an LFS pointer (`git lfs pull`), and only what Git tracks goes in (the `mixamo/` folder, which must not be shared, is git-ignored).
2. Publish it as a release asset: `gh release create fps-<n> dist/fps.zip --title "fps <n>" --notes "..."`.
3. Give the build in `catalog.json` the release as its `ref` (`"fps-<n>"`: a new release is a new folder on the machine) and the asset as its `archive`
   (`https://github.com/aslamcode/brave-engine-project-templates/releases/download/fps-<n>/fps.zip`).

A template without `archive` is downloaded from the repository as before.
