# Brave Engine — Project Templates

Catalog of starter project templates for the [Brave Engine](https://github.com/aslamcode/brave-engine) Hub's **New Project from Template** flow. One shared public repo, read straight off `main` — never a GitHub Release (a Release is the right shape for a versioned, binary-attached artifact like the engine itself, not for a template, which has no version history that matters to an end user).

## `catalog.json`

The Hub reads this one root-level file to populate the Templates grid — never walks per-template subfolders over the GitHub API (unauthenticated REST is capped around 60 requests/hour; one file beats N folder listings). Per-template folder content is only fetched once a template is actually chosen to create a project from.

Each entry:

```jsonc
{
  "id": "fps",                  // matches the subfolder name
  "name": "First Person Shooter",
  "category": "fps",            // fps | third-person | side-scroller | rpg
  "description": "...",
  "thumbnail": "https://...",   // an external URL is fine — never required to be a committed file
  "builds": [
    { "minVersion": "0.5.0", "ref": "main" }
    // maxVersion appears only once a build is frozen — see "Updating a template" below
  ]
}
```

`minVersion`/`maxVersion` are plain, hand-written engine version strings — never derived or computed. `maxVersion`'s presence is the *only* signal for "frozen, no longer current"; its absence means "still open-ended, tracks `main`." In practice almost every template will only ever carry a single `builds` entry, `minVersion` set, `maxVersion` never set.

## Updating a template

**The common case — a plain fix or improvement with no compatibility change:** just commit to `main`. The live `builds` entry (`ref: "main"`) picks it up automatically; nothing in `catalog.json` changes.

**The rare case — something about the template genuinely stops working on older engine versions:** freeze the old build before touching anything.

1. Tag the current commit: `git tag fps-v1 && git push origin fps-v1`
2. Fix/update the template normally on `main`.
3. Hand-edit `catalog.json`: give the OLD entry a `maxVersion` and switch its `ref` from `"main"` to the new tag (now pinned forever); add a NEW entry with the bumped `minVersion`, no `maxVersion`, `ref: "main"`.

```jsonc
// before
"builds": [{ "minVersion": "1.0.0", "ref": "main" }]

// after
"builds": [
  { "minVersion": "1.0.0", "maxVersion": "1.9.9", "ref": "fps-v1" },
  { "minVersion": "2.0.0", "ref": "main" }
]
```

## Per-template folder

```
<id>/
├── template.json   (name, category, minVersion, maxVersion?, description — this build's own metadata)
├── project.json     (a real, openable Brave Engine project.json)
└── assets/
```

## Status

Scaffolding for the Hub's catalog-fetching functionality — see `brave-engine`'s own `.claude/PLANS.md` for the full design history. Template *content* here is a placeholder standing in for real, authored starter projects; it will be reset to a clean history once real content replaces it.
