import { Bool, Camera, CharacterController, Entity, Float, IEntity, Input, Int, JsonIgnore, LookAt, ParentConstraint, Ref, Script, ScriptComponent, String, Time, TwoBoneIK, findEntityByPath } from '@brave/core';

/**
 * The arms of a first person character while it holds something. Unarmed (the start) the arms are the body's: drawn by the world camera with the rest of the character, as they always were. Armed
 * (key `1`), the slot of the mesh that has the arms goes to the layer of the arms camera, with the view model (the weapon and the points the arms reach for), and the arms stop being the body's: each
 * shoulder goes to a point of the view model and each hand to a grip of the weapon, so the weapon can be where it looks right on the screen whatever the length of the body's own arms. Unarmed
 * again, the arms go back to the body and only then does the slot return to the world camera, which is why neither swap shows: while the arms are the body's the arms camera has the world's own position, rotation and
 * field of view, and it moves to its own place as the arms reach the weapon (see below).
 *
 * What does the reaching is on the character and not here: a `Parent Constraint` on each upper arm bone (Source: a shoulder point of the view model, Position only), and a `Two Bone IK` on this entity for
 * each hand (Target: a grip of the weapon, Pole: where the elbow points). This script only moves their weights from 0 to 1 and back, and turns the layer and the cameras on and off. Put the Eyes' constraint
 * (the camera that rides the head) at a lower `Order` than the shoulders', and theirs lower than the hands': the points hang from the Eyes.
 *
 * The other way to arm a character, the body's: no shoulder points, the weapon is a child of the right hand (`Weapon`), the right hand reaches a point of the chest and the left hand reaches the weapon (the
 * right arm is solved FIRST: a higher `Order` for the left hand, or it reaches for a weapon that is still where the animation leaves the hand), and a `Look At` on the character leans the spine with the look,
 * so that looking down moves the chest out from under the camera. `Unarmed Lean` and `Armed Lean` say how much of the look that `Look At` follows in each state (its weight), so the body can react to the
 * look differently with and without a weapon. With a second `Look At` on the character (the head's, which must follow the camera armed or not), `Lean Bone` says which one is the lean.
 *
 * With ONE camera (no `Arms Camera`, and no `Mesh`) nothing changes layer and no camera is switched: the arms are drawn by the camera of the eyes with the rest of the body, the weapon too, and the
 * weapon is on the same layer as the body. What keeps the weapon out of a wall then is `Weapon Retreat`.
 *
 * The arms camera hangs from the eyes, but the arms and the weapon ride the chest, and the chest leans back with the look: looking up, the head comes down towards the hands, and a camera that goes
 * with the head ends up under the forearms and inside them. With `Camera On Chest` (on) the POSITION of the arms camera rides the chest instead (the `Lean Bone`): this script gives it a `Parent Constraint`
 * (Position only) when the game starts, which keeps the place it has relative to the chest as it is at rest (the body still and the look level, about a second and a half in; until then it hangs from the eyes
 * as it always did, so nothing jumps), so the arms and the weapon look the same at every pitch. Its rotation stays the eyes': it looks
 * where the player looks, exactly. What goes with it: the weapon sways less on the screen as the body walks (the bob of the head is not in it any more, the chest's still is), and the arms camera is up to 0.3 m
 * from the world camera when the player looks far up or down, so what the world camera draws at the weapon (the muzzle's glow and sparks: the arms camera draws no particles) is seen from a slightly different
 * place than the barrel, which it already was a little at rest.
 *
 * The arms camera is not where the world camera is (it hangs 0.2 to 0.3 m behind it, and with `Camera On Chest` it rides the chest), so the frame the arms change from one camera to the other would show them jump, most of all
 * with the look down, where the body's own arms are in the picture. So a second `Parent Constraint` on the arms camera (Source: the world camera, the one it hangs from, Position only, after the chest's) takes it to the
 * world camera's place with the weight the arms have not yet reached the weapon: 1 when they are the body's (the layer and the camera change there, and nothing moves), 0 at the weapon, and the camera glides
 * between the two over `Equip Time` with the arms, both ways. Only with `Camera On Chest` (the chest's constraint is what puts the camera back where it belongs every frame): without it the camera hangs from the eyes as it did.
 */
@Script()
export class FirstPersonArms extends ScriptComponent {

  // Where the arms camera's constraint is in the line of constraints, given before it is registered (the order is only read then): after the lean (50), the head (60) and the eyes (100), so it follows the chest as it is in the frame.
  private static readonly CAMERA_ORDER = 200;
  // The second one, after it: it takes the camera to the world camera's place while the arms are the body's (see the class).
  private static readonly EYES_ORDER = 210;
  // The moment to take the arms camera's place relative to the chest: at rest. Frames after the start (the lean, the idle and the eyes' own damping of 0.2 s have settled by then: sooner, what is left of it is kept as part of the place), how level the look must be (the sine of 5 degrees), how slow the body, and the frames after which a player who never stops is taken moving.
  private static readonly REST_FRAMES = 90;
  private static readonly REST_LEVEL = 0.09;
  private static readonly REST_SPEED = 0.2;
  private static readonly REST_PATIENCE = 300;

  // How far the arms are along the way, eased: what every weight is made of.
  private static ease(reach: number): number {
    return reach * reach * (3 - 2 * reach);
  }

  @Ref(Entity, { header: 'Arms', label: 'Mesh' }) mesh?: IEntity;
  @Int({ label: 'Arms Slot', tooltip: 'The material slot of the mesh that has the arms: the second, when the model was made with its arms in a slot of their own.' }) armsSlot = 1;
  @Int({ label: 'Arms Layer', tooltip: 'The layer of the arms camera: what the arms slot is on while the arms are armed.' }) armsLayer = 1;
  @Ref(Entity, { label: 'Arms Camera' }) armsCamera?: IEntity;
  @Ref(Entity, { label: 'View Model' }) viewModel?: IEntity;
  @Ref(Entity, { label: 'Weapon' }) weapon?: IEntity;
  @Float({ header: 'Lean', label: 'Unarmed Lean', tooltip: 'How much of the look the spine follows while unarmed, the weight of the Look At of this character: 0 none, 1 all of it.' }) unarmedLean = 0;
  @Float({ label: 'Armed Lean', tooltip: 'The same while armed.' }) armedLean = 1;
  @String({ label: 'Lean Bone', tooltip: 'Which Look At leans: the one whose Bone is this (the chest). Empty: every Look At of the character, which is wrong for one that turns the head and must stay on.' }) leanBone = '';
  @Float({ header: 'Equip', label: 'Equip Time', suffix: 's', tooltip: 'How long the arms take to go to the weapon and to come back.' }) equipTime = 0.3;
  @Bool({ label: 'Equip Key', tooltip: 'On: key 1 takes the weapon in hand and puts it away. Off when a Loadout handles the keys (1 to 9 choose a gear): it calls equip() and unequip() itself.' }) equipKey = true;
  @Bool({ header: 'Arms Camera', label: 'Camera On Chest', tooltip: 'On: the position of the arms camera rides the chest (the Lean Bone) instead of the head, so the arms and the weapon look the same whatever the pitch: looking up, the camera is never inside the arms. The camera still looks where the player looks. Needs Arms Camera and Lean Bone. Off: it hangs from the eyes. Read when the game starts.' }) armsCameraOnChest = true;

  /** Whether the character holds the weapon (or is raising it). */
  @JsonIgnore() equipped = false;
  /** 0: the arms are the body's. 1: they are at the view model. */
  @JsonIgnore() reach = 0;

  @JsonIgnore() private constraints: (ParentConstraint | TwoBoneIK)[] = [];
  @JsonIgnore() private leans: LookAt[] = [];
  @JsonIgnore() private key?: Parameters<typeof Input.removeListner>[0];
  @JsonIgnore() private offsetPending?: ParentConstraint;
  @JsonIgnore() private eyesFollow?: ParentConstraint;
  @JsonIgnore() private updatesSinceStart = 0;

  onStart() {
    this.constraints = [];
    this.leans = [];
    this.collect(this.entity);
    this.followChest();
    this.equipped = false;
    this.reach = 0;
    this.constraints.forEach(constraint => { constraint.weight = 0; });
    this.leans.forEach(lean => { lean.weight = this.unarmedLean; });
    if (this.eyesFollow) this.eyesFollow.weight = 1;
    this.show(false);
    // A character that is off (the other one of two, say) does not hold anything: its key would equip a weapon nobody sees and leave it armed when it comes back.
    this.key = Input.keyboard.digit1.down(() => { if (this.equipKey && this.entity.activeInHierarchy) this.toggle(); });
  }

  // A load builds the component as it was, started: the constraints it moves and the key are not there. What the arms hold is not touched (the `Loadout` brings it back and says it with `equip()`).
  onRestore() {
    if (!this.started) return;
    if (this.key) Input.removeListner(this.key);
    this.constraints = [];
    this.leans = [];
    this.collect(this.entity);
    this.followChest();
    if (this.eyesFollow) this.eyesFollow.weight = 1 - FirstPersonArms.ease(this.reach);
    this.key = Input.keyboard.digit1.down(() => { if (this.equipKey && this.entity.activeInHierarchy) this.toggle(); });
  }

  onUpdate() {
    if (this.offsetPending && this.isAtRest()) this.takeChest(this.offsetPending);
    const goal = this.equipped ? 1 : 0;
    if (this.reach === goal) return;

    const step = this.equipTime > 0 ? Time.deltaTime / this.equipTime : 1;
    this.reach = this.reach < goal ? Math.min(goal, this.reach + step) : Math.max(goal, this.reach - step);
    const eased = FirstPersonArms.ease(this.reach);
    this.constraints.forEach(constraint => { constraint.weight = eased; });
    this.leans.forEach(lean => { lean.weight = this.unarmedLean + (this.armedLean - this.unarmedLean) * eased; });
    if (this.eyesFollow) this.eyesFollow.weight = 1 - eased;

    if (!this.equipped && this.reach === 0) this.show(false);
  }

  // What a script registers it gives back: the key would go on calling a script that is gone.
  onDestroy() {
    if (this.key) Input.removeListner(this.key);
    this.key = undefined;
  }

  // The copy holds the original's handle and its list: it makes its own when it starts, and must never remove the original's key.
  onAfterClone() {
    this.key = undefined;
    this.constraints = [];
    this.leans = [];
    this.offsetPending = undefined;
    this.eyesFollow = undefined;
  }

  equip() {
    if (this.equipped) return;
    this.equipped = true;
    this.show(true);
  }

  unequip() {
    this.equipped = false;
  }

  toggle() {
    if (this.equipped) this.unequip();
    else this.equip();
  }

  // The layer of the arms slot, and the camera and the view model that go with it. -1 is the layer of the entity, what the slot has until it is told otherwise.
  private show(on: boolean) {
    const material = this.mesh?.materials[this.armsSlot];
    if (material) material.layer = on ? this.armsLayer : -1;
    if (this.armsCamera) this.armsCamera.active = on;
    if (this.viewModel) this.viewModel.active = on;
    if (this.weapon) this.weapon.active = on;
  }

  // The arms camera's position rides the chest (the Lean Bone), kept where it is relative to it now, with the look level. One constraint is enough: a load brings it back with its offset, and one made by hand in the scene is respected.
  private followChest() {
    const camera = this.armsCamera;
    const chest = this.leanBone ? findEntityByPath(this.entity, this.leanBone) : undefined;
    if (!this.armsCameraOnChest || !camera || !chest) return;
    const constraints = camera.components.filter((component): component is ParentConstraint => component instanceof ParentConstraint);
    const ours = (constraint: ParentConstraint) => constraint.order === FirstPersonArms.EYES_ORDER && constraint.source === camera.parent;
    this.eyesFollow = constraints.find(ours);
    const existing = constraints.find(constraint => !ours(constraint));
    if (existing) {
      // One made by hand is left as it is. The one this made and a save kept before it had its chest is finished, and a save that has the chest and not the second constraint gets it.
      if (!existing.source && existing.order === FirstPersonArms.CAMERA_ORDER) this.offsetPending = existing;
      else if (existing.source && existing.order === FirstPersonArms.CAMERA_ORDER && !this.eyesFollow) this.followEyes(camera);
      return;
    }

    const follow = camera.addComponent(ParentConstraint);
    follow.rotation = false;
    // The line of constraints is sorted when one is registered, so the order is given with it off and it is registered again.
    follow.active = false;
    follow.order = FirstPersonArms.CAMERA_ORDER;
    follow.active = true;
    // With no source it does nothing, and the camera hangs from the eyes as it always did: the chest is given when the body is at rest (`takeChest()`), so that what is kept is the idle place and the weapon never jumps.
    this.offsetPending = follow;
    this.updatesSinceStart = 0;
  }

  // Whether the body is at rest: the idle pose has settled, the look is level and it is standing. A player who never stops is taken moving, but never looking up or down.
  private isAtRest(): boolean {
    this.updatesSinceStart++;
    if (this.updatesSinceStart < FirstPersonArms.REST_FRAMES) return false;
    if (Math.abs(this.armsCamera?.transform.forward.y ?? 0) > FirstPersonArms.REST_LEVEL) return false;
    if (this.updatesSinceStart > FirstPersonArms.REST_PATIENCE) return true;
    const velocity = this.entity.getComponent(CharacterController)?.actualVelocity;
    return !velocity || Math.hypot(velocity.x, velocity.z) < FirstPersonArms.REST_SPEED;
  }

  // The camera's place relative to the chest is taken now, from where it is, with the constraint's source: from here on it follows the chest.
  private takeChest(follow: ParentConstraint) {
    this.offsetPending = undefined;
    const chest = this.leanBone ? findEntityByPath(this.entity, this.leanBone) : undefined;
    if (!chest) return;
    follow.source = chest;
    follow.rebind();
    if (this.armsCamera) this.followEyes(this.armsCamera);
  }

  // The second constraint of the arms camera: it takes it to the world camera's place (the camera it hangs from) by how little the arms have reached the weapon. Only once the first one has the chest: before that the camera is not
  // put back where it belongs every frame, and this one would pull it to the eyes and leave it there.
  private followEyes(camera: IEntity) {
    const eyes = camera.parent;
    if (!eyes?.getComponent(Camera)) return;

    const follow = camera.addComponent(ParentConstraint);
    follow.source = eyes;
    follow.position = true;
    follow.rotation = false;
    follow.maintainOffset = false;
    follow.weight = 1 - FirstPersonArms.ease(this.reach);
    follow.active = false;
    follow.order = FirstPersonArms.EYES_ORDER;
    follow.active = true;
    this.eyesFollow = follow;
  }

  // The Two Bone IKs of this character and the Parent Constraints that take a bone to a point of the view model (the Eyes' own, that takes the camera to the head, is not one of them).
  private collect(entity: IEntity) {
    entity.components.forEach(component => {
      if (component instanceof TwoBoneIK) this.constraints.push(component);
      else if (component instanceof LookAt) { if (!this.leanBone || component.bone === this.leanBone) this.leans.push(component); }
      else if (component instanceof ParentConstraint && this.isInViewModel(component.source)) this.constraints.push(component);
    });
    entity.children.forEach(child => this.collect(child));
  }

  private isInViewModel(entity?: IEntity): boolean {
    for (let current = entity; current; current = current.parent) if (current === this.viewModel) return true;
    return false;
  }
}
