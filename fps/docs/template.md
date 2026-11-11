# The FPS kit

A first-person shooter to start from, in a project that is yours to change: a yard and a house of two rooms (`scenes/main`), Bravo (1.8 m) or Brava (1.7 m) in first person with a rifle and a shotgun, interaction with E (doors, a drawer, pickups, a socket), cube enemies and waves, and a HUD. Everything is plain scripts and prefabs: read them, change them, delete what you do not want. Read `AGENTS.md` and the topic files in `docs/` for how the engine works; this file is about what this template made of it.

## Play it
- **WASD** move, **Shift** run, **Ctrl** crouch, **Space** jump, **mouse** look (click once to lock the pointer), **left mouse** fire, **right mouse** aim (hold), **R** reload, **E** use what the crosshair is on, **1** to **9** take the weapon of that slot in hand (the key of the weapon in hand puts it away, again takes it out), the **mouse wheel** goes through the weapons.
- Walk into the house: the front door opens with E; the inner door is locked, its key is in the drawer of the cabinet in the first room; the power cell on the table goes into the socket in the back room (it switches the lamp on). The amber pad in the yard starts the waves.
- The weapon is carried **relaxed** (low) until you shoot, aim or reload, then **alert** (at the shoulder) and it goes back to relaxed after `Alert Seconds` (30) without a shot; running lowers it too. That is how the character holds it. **Aiming** (right mouse held) is something more: the weapon comes to the eye, the field of view narrows and the spread closes; a sprint, a reload or a change of weapon lets it go.
- Two weapons: the **rifle** (slot 1: automatic, 30 rounds) and the **shotgun** (slot 2: ten pellets a shot, one shot at a time, six shells, a pump sound). Each keeps its own rounds when the other is in hand.

## What is where
```text
assets/
  scenes/main/            the level and its post-process stack
  scenes/interaction-demo/ scenes/combat-demo/   one small room for each feature, to read and try alone
  prefabs/player/         player-bravo.fab, player-brava.fab (the whole first-person rig)
  prefabs/enemies/        enemy-cube.fab (what the waves make)
  characters/             Bravo and Brava: model, skin, materials, our own locomotion clips, the Animator controllers
  scripts/player/         first-person-arms.ts, weapon-retreat.ts (the arms and the weapon out of walls)
  scripts/interaction/    interactable, interactor, door, pickup, socket
  scripts/combat/         weapon, firearm, weapon-stance, health, hitbox, player-health
  scripts/enemies/        enemy-cube, wave-spawner, target-dummy
  services/               hud.service.ts, inventory.service.ts
  audio/                  placeholder sounds, made by tools/sounds/*.py
ui/                       the HUD page (HTML, CSS, JS) and the Bridge it speaks through
tools/sounds/             one function per sound, a table at the end: change or add a sound and run it
```

## How the parts talk
- **The `Hud` service** (`services/hud.service.ts`) is the only way the game puts something on the screen: the prompt line, ammo, health, stance, a message, the items, a hit marker, a crosshair that turns red over a living target (`setTarget`: the `Weapon` asks every frame with the same ray a shot uses, and a weapon with several pellets also along a ring inside its cone, so red means a shot now could hurt it) and markers over the things that can be used (`setMarkers`: the `Interactor` projects them to the screen). Scripts `@Inject(Hud)` and call `setPrompt`, `setAmmo`, `showMessage`...; `ui/hud.js` reads it through `remote('Hud')`. Change the page to change the look; add a field to `IHudState` to show something new.
- **The `Inventory` service** keeps what the player carries by item id (`'key'`, `'power-cell'`). A `Pickup` adds, a `Socket` removes, a locked `Door` asks. It tells the `Hud` and it is saved with the game.
- **`Health` and `Hitbox`**: a shot hurts the `Health` it finds above the collider it hit, by damage times the multiplier of the `Hitbox` on that collider (head 2.5, body 1...). Anything can have a `Health`: the player, an enemy, a crate.
- **The Director** can drive the interactables: `Door`, `Socket` and `Pickup` have `@State()` booleans and `@Callable()` methods (`docs/director.md`).

## Make it yours
- **A weapon** is an entity under `Weapons` in the right hand (a child of the hand bone) with a `Firearm`: its numbers are the fields of that `Firearm`: `Name`, `Slot` (the key that takes it in hand), `Automatic`, `Rounds per Minute`, `Pellets` (bullets in a shot: 1 a rifle, 8 to 12 a shotgun, each in a direction of its own inside the cone), `Damage` (of each), `Range`, the spread `Still / Moving / In the Air`, the `Crosshair` (Dot, or Arcs for a shotgun: both open with the spread, so the ring shows where the pellets may go), `Magazine`, `Reserve`, `Reload Time`, `Camera Kick`, and the `Aim` group (`Aim Field of View`, `Aim Time`, `Aim Spread`, and `Aim Side / Lower / Back / Tilt`: how far the weapon moves and how far its barrel is raised to end on the line of the eye, a little under it). Its parts are children: the model, `Muzzle` (a light and a flash, off) and `Grip Left` (where the left hand goes), and the sounds are references to entities under the player's `Sounds`. The `Weapon` on the player (one for all of them) has `Start Equipped` (off: the first weapon starts put away, loaded, and its key brings it up). The two stances' poses are `WeaponStance` fields (`Lower`, `Back`, `Side`, `Tilt`...). The rifle and the shotgun are placeholders made of cubes: put a model in place of the cubes (keep `Muzzle` at the barrel's tip and `Grip Left` where the left hand goes).
- **A new weapon**: copy the `Shotgun` entity under `Weapons` (or the `Rifle`), give its `Firearm` the next free `Slot`, other numbers and another model; move its `Grip Left` and its `Muzzle`. The key, the wheel, the HUD list and the left hand's reach find it by themselves (it is whatever is under `Weapons` with a `Firearm`). The model sits in the hand where you put the entity: the right hand holds the pistol grip at the entity's origin.
- **A new thing to use with E**: a script that `extends Interactable` (`prompt`, `usable`, `onUse(interactor)`), on an entity with a collider; `Door`, `Pickup` and `Socket` are the examples. Its `Marker` (Line: a glass box with the prompt over it, tied to it by a line; Simple: the box on it; None) and `Marker Height` say how it is shown on the screen, and the `Interactor`'s `Marker Range` and `Max Markers` say how many are drawn: the one looked at is the box, the near ones are a small mark. A door that slides (a drawer, a shutter) is the same `Door` with `Mode` Slide.
- **A new enemy**: copy `prefabs/enemies/enemy-cube.fab`: its `Health`, its `Hitbox` children (a head, a body), `EnemyCube` with `Aggro Range`, `Speed`, `Attack Damage`; give the `WaveSpawner` the prefab.
- **A new hit zone**: a child entity with a solid Collider (not a trigger: a ray goes through triggers) and a `Hitbox` with the zone name and the multiplier.
- **Sounds**: replace a `.wav` under `assets/audio/` (same name keeps every reference) or edit `tools/sounds/*.py` and run it. Credits are in `NOTICE.md`.
- **Brava instead of Bravo**: put `prefabs/player/player-brava.fab` in the scene in place of the Bravo prefab (the same scripts, her proportions: the eyes and the points the arms reach are scaled).

## The first-person rig, and what not to touch
The body is the character's own, animated by its own clips (`characters/*/..-clips`); the arms are driven by Two Bone IK to the weapon, which is a child of the right hand, and the camera rides the head. `FirstPersonArms` moves the arms to the weapon and back (its `Equip Key` is off here: the `Weapon` calls `equip()` and `unequip()` for keys 1 to 9), `WeaponRetreat` pulls the weapon out of a wall, `WeaponStance` moves `Hold Right` (and `Grip Left`) for the two stances. One place writes each target: do not add a second script or constraint that writes `Hold Right`, or the two will fight (`docs/characters-and-animation.md`).

## Traps
- A script that listens to the mouse or a key must check that the game is running (`BraveEngine.mode`): `Input` callbacks fire during Pause. The click that locks the pointer must not shoot: `Weapon` checks `Cursor.isLocked` (`Fire Without Pointer Lock` is for tests).
- After a load, private handles filled in `onStart()` are `undefined`: the kit's scripts bind again in `onRestore()` (read `Interactor`, `PlayerHealth` or `Weapon`), and a countdown that must survive is a saved field, not an `Invoke`.
- The shader of something that appears for the first time compiles in the background: the first frames of a new weapon or light may show nothing yet.

## Not built yet (ideas the kit is ready for)
- Bullets that go through things by material and thickness, and a ballistic arc: `Weapon.fireBullet()` casts one ray (each pellet of a shotgun is one) and `onBulletHit()` returns the damage a bullet still has (0 today): a loop there. The engine's rays do not continue through a collider, a physics material has no surface type, and there is no overlap query yet (an explosion's damage would need one).
- A humanoid enemy with hit zones on its bones (a collider under a bone entity follows the animation: to be measured), and animations for it (Mixamo clips go in `mixamo/`, which is not committed).
- Area damage (grenades), pickups for ammo and health, a real rifle model and a muzzle flash that is not a square.
