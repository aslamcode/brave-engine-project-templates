import { Entity, Float, IEntity, Input, Int, JsonIgnore, LookAt, ParentConstraint, Ref, Script, ScriptComponent, String, Time, TwoBoneIK } from '@brave/core';

/**
 * The arms of a first person character while it holds something. Unarmed (the start) the arms are the body's: drawn by the world camera with the rest of the character, as they always were. Armed
 * (key `1`), the slot of the mesh that has the arms goes to the layer of the arms camera, with the view model (the weapon and the points the arms reach for), and the arms stop being the body's: each
 * shoulder goes to a point of the view model and each hand to a grip of the weapon, so the weapon can be where it looks right on the screen whatever the length of the body's own arms. Unarmed
 * again, the arms go back to the body and only then does the slot return to the world camera, which is why neither swap shows: the arms camera has the world's own position and field of view.
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
 */
@Script()
export class FirstPersonArms extends ScriptComponent {

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

  /** Whether the character holds the weapon (or is raising it). */
  @JsonIgnore() equipped = false;
  /** 0: the arms are the body's. 1: they are at the view model. */
  @JsonIgnore() reach = 0;

  @JsonIgnore() private constraints: (ParentConstraint | TwoBoneIK)[] = [];
  @JsonIgnore() private leans: LookAt[] = [];
  @JsonIgnore() private key?: Parameters<typeof Input.removeListner>[0];

  onStart() {
    this.constraints = [];
    this.leans = [];
    this.collect(this.entity);
    this.equipped = false;
    this.reach = 0;
    this.constraints.forEach(constraint => { constraint.weight = 0; });
    this.leans.forEach(lean => { lean.weight = this.unarmedLean; });
    this.show(false);
    // A character that is off (the other one of two, say) does not hold anything: its key would equip a weapon nobody sees and leave it armed when it comes back.
    this.key = Input.keyboard.digit1.down(() => { if (this.entity.activeInHierarchy) this.toggle(); });
  }

  onUpdate() {
    const goal = this.equipped ? 1 : 0;
    if (this.reach === goal) return;

    const step = this.equipTime > 0 ? Time.deltaTime / this.equipTime : 1;
    this.reach = this.reach < goal ? Math.min(goal, this.reach + step) : Math.max(goal, this.reach - step);
    const eased = this.reach * this.reach * (3 - 2 * this.reach);
    this.constraints.forEach(constraint => { constraint.weight = eased; });
    this.leans.forEach(lean => { lean.weight = this.unarmedLean + (this.armedLean - this.unarmedLean) * eased; });

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
