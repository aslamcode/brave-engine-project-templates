import { AssetSystem, AssetTypeEnum, Entity, JsonIgnore, Ref, Script, ScriptComponent, Select } from '@brave/core';

/**
 * The sounds of a step on one kind of ground: the physics material that makes the ground, and, as entities, the sounds of a walking step and of a running one. A `Footsteps` with `By Surface` on looks at the
 * physics material of the collider under its feet and plays the sounds of the `Footstep Surface` that has it; a ground with no surface of its own (a collider with no physics material, or one nobody gave
 * sounds to) is stepped on with the character's own `Step Sound`.
 *
 * A surface is an entity with this script, and its sounds are the entities it points at, the way `Footsteps` already takes its own: an entity with an Audio Source for each variation as children (one plays
 * at each step), or one Audio Source; each with Pooling on, so that two steps may overlap. Put all of a game's surfaces in the scene (the kit keeps them under `Footstep Surfaces`): they cost nothing but
 * their sounds being read, and a new kind of ground is a physics material, a floor that has it and one more of these.
 */
@Script()
export class FootstepSurface extends ScriptComponent {

  @Select({ header: 'Surface', label: 'Physics Material', optionsKey: 'materialOptions', tooltip: 'The physics material of the colliders this surface is the sound of. A character on a floor that has it steps with these sounds.' }) materialId = '';
  @Ref(Entity, { label: 'Walk', tooltip: 'An entity with an Audio Source for each variation as children (one plays at each step), or one Audio Source.' }) walk?: Entity;
  @Ref(Entity, { label: 'Run', tooltip: 'The same, for a run. Empty: the walk sounds play.' }) run?: Entity;

  // The project's physics materials as a menu. Kept until they change: the Inspector reads it on every pass, and a new array each time would keep the menu from being clicked.
  @JsonIgnore() private materials = { signature: '', options: [] as { value: string; description: string }[] };

  @JsonIgnore()
  protected get materialOptions() {
    const definitions = Array.from(AssetSystem.definitions.values()).filter(definition => definition.type === AssetTypeEnum.PhysicsMaterial);
    const signature = definitions.map(definition => `${definition.id}:${definition.name}`).join('|');
    if (signature !== this.materials.signature) {
      this.materials = { signature, options: [{ value: '', description: 'None' }, ...definitions.map(definition => ({ value: definition.id, description: definition.name.replace('.pmat', '') }))] };
    }
    return this.materials.options;
  }

  /** The sounds for a step, run or walk (the walk ones when it has no run ones). */
  soundsFor(running: boolean): Entity | undefined {
    return running && this.run ? this.run : this.walk;
  }
}
