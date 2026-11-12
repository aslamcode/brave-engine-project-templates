# Characters and animation

A character is a few small components that read each other's state: a body (physics), a mind (input or AI), a camera, and an animation layer that only reads.

## What it is
- **Intention goes down, state goes up.** The mind (`PlayerMovement`, `NavAgent`, your own script) tells the body what it wants: `velocity`, `jump(height)`. The body (`CharacterController`) moves with physics and reports state: `isGrounded`, `airTime`, `actualVelocity`, `ground`, `collisions`, `onLand`, `onCollisionEnter`.
- Animation, footsteps and HUD read that state and never write gameplay, so any mind can drive the same body and animation.
- Rules of a game (double jump, wall jump, dash) belong to the mind. The body only has physical limits.
- Skeletal animation: an `Animator` plays a clip, or an `.animator` controller, on bones that are entities. 2D: a `SpriteAnimator` picks clips of a `SpriteRenderer`.

## Add it
**A 3D character.** All on ONE entity whose origin is at the character's feet, with the model (`.mdl`) dragged under it:
- Add Component, category **Physics**: **Rigid Body** (Type **Kinematic**), **Collider** (Shape **Capsule**; a person: Radius 0.3, Height 1.8, Center y 0.9), **Character Controller**, **Player Movement**. The console says once what is missing.
- Category **Animation**: **Animator** (fields **Clip**: one clip, looped; **Controller**: an `.animator`, which takes over from the clip; drop either from the Assets panel) and **Character Animation** (turns the character to face where it goes and feeds the Animator from the body).
- Category **Camera**: **Third Person Camera** on the camera (Target = the character; set the camera as the character's Player Movement **Relative To**), or **First Person Camera** on a camera that is a child of the character at eye height (its Body empty = the entity it hangs from; Relative To = that camera).
- Category **Physics**: **Ragdoll** on the same root: press **Fill From Skeleton**.

**Assets** (Assets panel, right-click): **New Animator Controller**, **New Animation Clip**; on an `.animator`, **Create Override Controller** (same states, some clips replaced: an enemy that walks its own way).
- Importing an `.fbx` / `.glb` writes its clips to `<model>-animations/`. A clip made for one humanoid skeleton is retargeted when it plays on another humanoid; re-import it if it looks wrong.

**Controller editor**: bottom panel tab **Animator** (or its expanded window).
- Right-click the graph: Create State. Right-click a state: Set as Default, Add Transition, Rename, Duplicate, Delete. Drop a clip on a state, or on the empty graph for a new state.
- Parameters (Float, Int, Bool, Trigger) are listed in the pane. A state can play a clip, a **blend tree** (1D or 2D) or hold a sub-state machine. There are layers (Override or Additive, with a bone mask) and an Any State.
- While the game runs, the pane's **Live** block shows the current states and sets parameters.

**Animation panel** (bottom tab **Animation**): makes or edits a clip on a timeline (Dopesheet or Curves).
- **Record** turns what you change in the scene into keys at the playhead. The **Control rig** button shows circles on a humanoid to pose it (Record keys the pose).
- Imported clips are read-only: the panel offers **Edit a copy**.

**IK and constraints** (category **Animation**, on the Animator's entity, bones picked in menus; each has **Weight** and **Order**, lower solved first):
- **Two Bone IK**: hand or foot on a Target, elbow or knee towards a Pole.
- **Chain IK**: a tail, a tentacle, a spine reaching a Target.
- **Look At**: a head (and the bones above it) follows a Target.
- **Foot IK**: feet on stairs and slopes; visual only, the body is the controller's.
- **Parent Constraint**: a weapon follows a hand, a camera rides a head (Damping smooths out the head's bob).
- **Pelvis Turn**: the legs go the way it moves while the look goes elsewhere, up to **Max Offset** (the FPS player has 45: a diagonal, never a step to the side with the legs twisted 90 degrees under the chest; going backwards the legs keep to the look and the walk plays in reverse). **Step Turn**: turns the legs on the spot one foot at a time (needs a Pelvis Turn).

**A 2D character.** Right-click in the Scenes panel, **Sprite**. Pick the texture in its Material; on the Sprite Renderer set the sheet (Columns, Rows) and the **Animations** list (clips = ranges of frames). Add the same body and mind as above (Rigid Body, Collider Capsule, Character Controller, Player Movement), then **Sprite Animator**.

## Key settings
- **Character Controller**: Slope Limit 45 deg, Step Height 0.45 m, Snap To Ground 0.45 m, Gravity Scale 1, Max Fall Speed 50 m/s, Push Bodies on. **Plane** (Free, XY, ZY) holds a side view: the body never moves along the depth and Player Movement walks along the plane with A/D.
- **Player Movement** (speeds shown in km/h, stored in m/s): Speed 9, Run Speed 21, Jump Height 1.5 m, Max Air Jumps 0 (1 is a double jump), Coyote Time 0.1 s, Crouch Height 1 m, Crouch Time 0.2 s, Crouch Speed 4.5. The keys are fixed: W A S D, Shift (run), Space, Ctrl (hold to crouch).
- **Third Person Camera**: Distance 4 m, Height 1.6 m, Shoulder Offset 0, Min / Max Distance 1.5 / 8, Lowest / Highest Angle -20 / 70 deg, Look Sensitivity 0.15 deg/px, Follow Smoothing 0.05 s, Avoid Obstacles on (it never looks through a wall), Look Without Lock off.
- **First Person Camera**: Look Sensitivity 0.15 deg/px, Look Up Limit and Look Down Limit 85 deg, Invert Y off.
- **Animator**: Root Motion Off (default), Apply, or **Script** (the clips travel, the body decides how far: use it with a Character Controller). Play On Awake on, Speed 1, Culling Mode Always.
- **Character Animation**: Turn To Movement on (OFF in first person: the mouse turns the body), Turn Speed 720 deg/s, Model Yaw 0 (180 if the model looks along -Z). It sets the Animator parameters whose names are in its fields: Speed (float, smoothed), Crouched (bool), Crouch Walk (float). Grounded, Vertical Speed and Stride are empty, so not set, until you type a parameter name. Match Stride (on) plays the clips at the rate that keeps the feet on the ground.
- **Sprite Animator**: **Animations** are lines of State (Idle, Walk, Run, Jump, Fall, Crouch, Crouch Walk, or a state of your own), Facing (Front, Back, Left, Right, Any, diagonals) and Clip. Directions Auto, Mirror Missing Side on (a left with no line is the right one mirrored), Run Above 14.4 km/h. **Fill From Clip Names** adds lines from names such as `walk-left`.
- **Sprite Animator Actions**: a Signal of a component of the entity plays a clip: Trigger, Facing, Clip, When It Ends (Follow Body, or Hold Last Frame). The first line has the most priority.

## Scripting
Scripts are in `scripts.md`, input in `input.md`. A script reading the body and driving the Animator:
```ts
import { Animator, CharacterController, Script, ScriptComponent } from '@brave/core';

@Script()
export class LandingAnimation extends ScriptComponent {
  private body?: CharacterController;
  private animator?: Animator;

  onStart() {
    this.body = this.entity.getComponent(CharacterController);
    this.animator = this.entity.getComponent(Animator);
    this.body?.onLand.on((speed: number) => {
      if (speed > 6) this.animator?.setTrigger('HardLand');
    }, this);
  }
}
```
- **Body**: `velocity` (m/s on x and z, stays until set again), `jump(height)` (metres, asks no questions), `teleport(position)`, `setHeight()`, `fits(height)`, `height`, `isCrouched`. **Mind**: `PlayerMovement.isRunning`, `isCrouching`, `airJumpsLeft`, `relativeTo`.
- An enemy is the same body with a **Nav Agent** as its mind: it sets the controller's `velocity` by default (see `navigation.md`).
- **Animator**: `setFloat`, `setInteger`, `setBool`, `setTrigger`, `resetTrigger` and the matching `get*`; `play(stateOrClip)`, `crossFade(state, seconds)`, `inertialize(state, seconds)` (cuts at once and eases out of the old pose), `playState`, `setLayerWeight`, `getCurrentState`, `pause`, `stop`, `speed`.
- **Animator signals**: `onStateEnter`, `onStateExit`, `onEvent` (clip events: name and argument), `onClipEnd` (one clip with Wrap Mode Once), `onRootMotion`. A parameter set before the controller has loaded waits for it.
- **Ragdoll**: `goLimp({ velocity, impulse, point })`, `getUp()`, `isLimp`, `center`, signals `onLimp`, `onGetUp`:
```ts
import { Ragdoll, Script, ScriptComponent, Vector3 } from '@brave/core';

@Script()
export class Knockdown extends ScriptComponent {
  hit(direction: Vector3) {
    const ragdoll = this.entity.getComponent(Ragdoll);
    ragdoll.goLimp({ impulse: new Vector3(direction.x * 300, 80, direction.z * 300) });
    ragdoll.onGetUp.on(() => console.log('up again'), this);
  }
}
```
- **Sprites**: `SpriteRenderer.play(name)`, `playClip()`, `onClipEnd`; `SpriteAnimator.resume()`. A state of your own is a field marked `@State()` on a script of that entity (`@State() isSwimming?: boolean;`): the State menu offers "While Swimmer · isSwimming" (the class name), it lasts while true, the first line in the list is checked first.
- **A death**: set `PlayerMovement.active = false` AND `velocity = new Vector3()` (turning the mind off does not stop the body), later `teleport()`, `active = true`, and `SpriteAnimator.resume()` if the action was Hold Last Frame (forgotten, it holds for ever).

## Traps
- A step taller than the capsule's radius is climbed slowly (risers up to 0.30 m cost nothing; 0.48 m is a wall at radius 0.4), whatever Step Height says: build stairs with risers of 0.30 m or less.
- The body stands while the middle of the capsule is over something. Keep the colliders it walks on to a few hundred metres across (one box 1 km wide fails; several pieces or a mesh do not).
- Collider Shape, Radius and Height edited during Play do nothing until the next Play (crouching resizes the capsule through the controller). A pushed crate went along at about the walking speed whatever Mass was set to, when measured.
- Under a ceiling a crouched body stays down. Anything solid counts as a ceiling, so make hitboxes on child colliders **Trigger**.
- The Animator, IK and constraints run in Play only; in the editor the bones stay as authored (the Animation panel previews a clip). With a controller and a Character Controller set Root Motion to **Script**: with Off the hips walk away from the capsule and snap back.
- A Trigger stays set until a transition that waits for it answers it: setting one that nothing waits for fires later.
- Clips find bones by their path from the Animator's entity. Rename bones in the Scenes panel (it follows the rename in clips you can edit), not outside it. A row marked Missing in the Animation panel has **Fix Path**.
- Ragdoll: `goLimp()` does nothing in the editor and needs a humanoid skeleton. While limp, the entity's own Rigid Body, Colliders and Character Controller are off and the entity follows the pelvis. `getUp()` puts it on the ground under the pelvis and the pose snaps to the animation's: hide that with a get-up clip. A save made while limp comes back limp.
- The cameras turn with the mouse only while the game holds the pointer (a click locks it, Esc gives it back).
- **`FirstPersonCamera.yaw` and `.pitch` look like inputs and are not**: the camera writes the entity's `rotation.y` and the eyes' `rotation.x` only when a mouse event arrives. To aim from a script set those two rotations; to kick the view write `eyes.transform.rotation.x = camera.pitch + kick` every frame and leave `pitch` alone. The eyes sit ahead of the player's origin along the look and move when the body turns, so aim again after turning.
- **Two constraints that write the same transform break each other's pose guard**: the second sees the first's result as the animation's pose and the offsets add up every frame. Move a point such as the right hand's `Hold Right` from ONE place, a script that runs before the animation system.

## Not available yet
Interactor / Interactable (build a sibling component with a `Signal`), remappable keys, a camera that follows a side view's plane, one-way platforms, binding Animator parameters to properties (set them from a script or Character Animation).

Types: `brave/core/component/{character-controller,player-movement,first-person-camera,third-person-camera,character-animation,animator,ragdoll,ragdoll-part,sprite-animator,sprite-renderer,sprite-clip,two-bone-ik,chain-ik,look-at,foot-ik,parent-constraint,pelvis-turn,step-turn}.d.ts`, `brave/core/system/animation-system/`
