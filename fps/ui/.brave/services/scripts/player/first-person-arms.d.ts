import { IEntity, ScriptComponent } from '@brave/core';
/**
 * The arms of a first person character while it holds something. Unarmed (the start) the arms are the body's: drawn by the world camera with the rest of the character, as they always were. Armed
 * (the `slot-1` action: key 1 by default), the slot of the mesh that has the arms goes to the layer of the arms camera, with the view model (the weapon and the points the arms reach for), and the arms stop being the body's: each
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
export declare class FirstPersonArms extends ScriptComponent {
    private static readonly CAMERA_ORDER;
    private static readonly EYES_ORDER;
    private static readonly REST_FRAMES;
    private static readonly REST_LEVEL;
    private static readonly REST_SPEED;
    private static readonly REST_PATIENCE;
    private static ease;
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
    equipKey: boolean;
    armsCameraOnChest: boolean;
    /** Whether the character holds the weapon (or is raising it). */
    equipped: boolean;
    /** 0: the arms are the body's. 1: they are at the view model. */
    reach: number;
    private constraints;
    private leans;
    private key?;
    private offsetPending?;
    private eyesFollow?;
    private updatesSinceStart;
    onStart(): void;
    onRestore(): void;
    onUpdate(): void;
    onDestroy(): void;
    onAfterClone(): void;
    equip(): void;
    unequip(): void;
    toggle(): void;
    private show;
    private followChest;
    private isAtRest;
    private takeChest;
    private followEyes;
    private collect;
    private isInViewModel;
}
