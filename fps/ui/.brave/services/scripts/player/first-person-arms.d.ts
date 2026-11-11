import { IEntity, ScriptComponent } from '@brave/core';
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
export declare class FirstPersonArms extends ScriptComponent {
    mesh?: IEntity;
    armsSlot: number;
    armsLayer: number;
    armsCamera?: IEntity;
    viewModel?: IEntity;
    weapon?: IEntity;
    unarmedLean: number;
    armedLean: number;
    leanBone: string;
    equipTime: number;
    /** Whether the character holds the weapon (or is raising it). */
    equipped: boolean;
    /** 0: the arms are the body's. 1: they are at the view model. */
    reach: number;
    private constraints;
    private leans;
    private key?;
    onStart(): void;
    onUpdate(): void;
    onDestroy(): void;
    onAfterClone(): void;
    equip(): void;
    unequip(): void;
    toggle(): void;
    private show;
    private collect;
    private isInViewModel;
}
