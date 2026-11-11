import { Float, Script, ScriptComponent, String } from '@brave/core';

/**
 * A zone of something that can be hurt: put it on an entity with a solid Collider below the one that has the `Health` (a head slab, an arm, a leg). A shot that hits the collider hurts that `Health` by the
 * damage times the multiplier, and the zone's name goes to everything that listens (the hit marker on the screen says "head"). A ray goes through triggers, so a hitbox is an ordinary collider, which also
 * belongs to the body of the entity it hangs from: it moves with it.
 */
@Script()
export class Hitbox extends ScriptComponent {
  @String({ header: 'Zone', label: 'Zone', tooltip: 'The name the shot reports: head, body, arm, leg...' }) zone = 'body';
  @Float({ label: 'Multiplier', suffix: 'x', tooltip: 'What the damage of a shot is multiplied by when it lands here: 2.5 on a head, 0.7 on a leg.' }) multiplier = 1;
}
