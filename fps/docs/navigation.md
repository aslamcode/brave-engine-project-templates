# Navigation (Accio)

Pathfinding for characters you do not control (enemies, animals, followers): they find their way to a target around walls, up stairs and across floors while the game runs. "Accio" is the name of the technique; the classes are `NavSystem` and `NavAgent`.

## What it is
- **Nothing is baked.** Accio reads the `Collider` components of the level while you play and builds the ground in a square window (**Window Radius**, 200 m) round the active camera. Ground outside the window is unknown, and unknown counts as blocked.
- Level geometry is any Collider with no Rigid Body or a Static one. Anything that moves (players, enemies, rolling props) is NOT a wall to the search, unless it carries a **Nav Obstacle**.
- A **flow field** is the answer to "which way is the target?" from every point near it. Everyone after the same target with the same body shares ONE field, so a hundred zombies chasing the player cost about one search. A goal only one agent cares about (a patrol point, a flee point) gets a **path of its own**, which is much cheaper.
- It runs in a Web Worker, so searching never costs a frame. It starts with the first Nav Agent in Play and stops 10 s after the last one; agents walk in Play only.

## Add it
- The level needs **Colliders** (a Box for a floor, a Mesh collider for a whole level, a Terrain collider for a terrain). A mesh with no Collider does not exist for Accio.
- On the entity that walks: Add Component, category **Navigation**, **Nav Agent**. A plain `cube()` with no collider or body is enough: the agent then moves the Transform itself.
- An enemy with a body is the player's body with a Nav Agent as its mind: **Rigid Body** (Kinematic) + **Collider** (Capsule) + **Character Controller** + **Nav Agent**. With **Use Body** on (default) the agent gives the controller its velocity and physics does the rest (see `characters-and-animation.md`).
- Give it a target: tick **Use Target Position** and fill **Target Position**, or use a script (below).
- Other **Navigation** components: **Nav Obstacle** (a door, a barricade or a vehicle on a Kinematic or Dynamic body that must block), **Nav Cost Zone** (mud, fire: a box of ground that costs more or is shut), **Nav Link** (a jump, a drop or a climb across a gap).
- **Project Settings, Navigation** (agent types, grid, limits). The header's navigation toggle (tooltip "Show Navigation") draws what Accio sees: walkable cells, field flow, each agent's way, links, zones. Use it first when an agent stands still.

## Key settings
- **Nav Agent**: **Agent Type** (Default; "+ New" opens Project Settings), Speed 3.5 m/s, Acceleration 16, Turn Speed 540 deg/s, Stopping Distance 0.4 m, Path Lost After 3 s, **Avoidance Mode** ORCA (or Separation, about a third of the cost, agents then pass through each other) with Avoidance Radius 1 m, Height Offset 0 (0.5 for a 1 m cube whose pivot is its centre), Use Body on, Update Position on (off: you move it, following `desiredVelocity`), Update Rotation on, Use Links on, Link Speed 5, Use Zones on, Approach When Blocked on, Use Target Position, Target Position, **Own Path**.
- **Nav Obstacle**: Stationary Seconds 0.5 (it is a wall only once it has stood still that long). **Nav Cost Zone**: Size 4 x 2 x 4 m, Cost 3 (1 to 25: times dearer than outside any zone), Walkable on (off: as if a wall stood there). **Nav Link**: End Offset 0, 0, 4 m (in the entity's space), Both Ways on, Extra Cost 0, Arc Height 0, Speed 0 (0 = the agent's Link Speed).
- **Project Settings, Navigation**, saved in the `navigation` block of `project.json`; edits apply half a second after typing and restart the system:
  - **Agents**: the **Default** agent (Radius 0.4 m, Height 1.8 m, Step Height 0.45 m) and your types (Name, Radius, Height, Step Height). A type with **Flying** on flies between **Min Altitude** (3 m) and **Max Altitude** (7 m) above the ground under it, over trenches and walls lower than that.
  - **Grid**: **Runs On** Worker (default) or Main Thread, **Window Radius** 200 m, **Cell Size** 0.3 m (smaller opens narrower passages and costs about 4x the memory when halved), **Max Floors per Column** 16, **Max Slope** 45 deg (steeper is a wall, not ground), **Non-Walkable Layers** (props that block without being ground: put them on a layer, tick it).
  - **Search**: **Max Search Radius** 100 m (an agent farther than that from its target has no path), **Nearest-Place Search** 6000 nodes, **Ring Radii** 20, 50, **Ring Slack** 4 m, **ORCA Time Horizon** 2 s, **ORCA Max Neighbors** 8, **CPU Limit** 100 %, **Burst** 80 ms, **Slice** 4 ms.

## Scripting
Scripts are in `scripts.md`. A chaser:
```ts
import { Entity, NavAgent, Ref, Script, ScriptComponent } from '@brave/core';

@Script()
export class Zombie extends ScriptComponent {
  @Ref(Entity) player!: Entity;

  onStart() {
    const agent = this.entity.getComponent(NavAgent);
    agent.setTarget(this.player);
    agent.onArrive.on(() => console.log('reached the player'), this);
    agent.onPathLost.on(() => console.log('no way to the player'), this);
  }
}
```
- **Target**: `setTarget(entity | Vector3 | group)` (an entity is followed as it moves; agents sent to the same entity or spot share a field), `setDestination(point)` (a path of its own), `stop()`, `warp(position)` (a Promise), `target`, `agentType`, `avoidance`. A group is `NavSystem.createTargetGroup([a, b])` with `add`, `remove`: each agent heads for the member nearest by the way it has to walk (`targetMember`), and members that stand near one another share one field.
- **State**: `hasPath`, `arrived`, `remainingDistance`, `timeWithoutPath`, `isMoving`, `approaching` (the way is cut and it walks to the nearest reachable place), `currentSpeed`, `desiredVelocity`, `velocity`, `isTraversingLink`, `currentLink`.
- **Signals**: `onArrive` (once per arrival within Stopping Distance), `onPathLost` (target but no way for Path Lost After seconds: what to do is the game's), `onLinkStart` / `onLinkEnd` (the NavLink being crossed: play the jump here), `onStageChange` (the ring of the field it is in, 0 round the target), `NavLink.onTraversed`.
- **Questions to the grid** return Promises, answered a few frames later, about places within the window: `NavSystem.samplePosition(point, maxDistance?, agent?)`, `randomPoint(center, radius, { agent?, random? })` (a place it can walk to), `raycast(from, to, agent?)`, `findPath(start, goal, { agent?, partial? })`, `isReachable(start, goal, agent?)`. `NavSystem.markWalker(entity)` leaves an entity out as a wall even with a Nav Obstacle.
```ts
import { JsonIgnore, NavAgent, Script, ScriptComponent, Vector3 } from '@brave/core';

@Script()
export class Patrol extends ScriptComponent {
  @JsonIgnore() private points = [new Vector3(0, 0, 10), new Vector3(10, 0, 10), new Vector3(10, 0, 0)];
  @JsonIgnore() private next = 0;

  onStart() {
    const agent = this.entity.getComponent(NavAgent);
    agent.setDestination(this.points[this.next]);
    agent.onArrive.on(() => {
      this.next = (this.next + 1) % this.points.length;
      agent.setDestination(this.points[this.next]);
    }, this);
  }
}
```
- A spawn point round the player that can be walked to: `const around = await NavSystem.randomPoint(center, 30); const place = around && await NavSystem.samplePosition(around, 1);` then `isReachable(place, center)`. For a far-off place this is cheaper than a big `randomPoint` radius.
- A different body from a script: `NavSystem.agentTypeOptions.find(option => option.description === 'Crawler')?.value` is the id for `agent.agentType`.

## Cost and how many agents
Measured by the engine team on an Apple M5 (an older desktop CPU is 2.5 to 4 times slower per thread); use them for orders of magnitude.
- The main thread pays little: 200 agents cost about 0.05 to 0.1 ms a frame of Accio itself, plus the agents' own movement. 300 enemies chasing one group cost about 1 ms of the frame. With a body each costs 6 to 9 microseconds a frame more (100: +0.9 ms, 300: +1.8 ms).
- The worker pays for **fields**: one per target per body type, sized by the farthest follower, rebuilt each time the target moves 1.5 m. Cost grows with the square of the radius: on open ground a 30 m field is about 20 ms of worker time, 60 m about 80 ms, 100 m about 250 ms. A hundred enemies after one player are one field; a second agent type after the same player is a second field.
- A path of its own costs by the distance to the goal (about 1 to 9 ms for 10 to 90 m) and is asked again every 3 s (`NavSystem.pathRefreshSeconds`). ORCA avoidance is about 0.8 to 1.3 ms a frame for a hundred agents.
- To spend less: lower **Max Search Radius** (the biggest lever), send a horde after a group instead of a field per player, keep the agent types few, **Avoidance Mode** Separation for a very large crowd, a smaller **Window Radius** or larger **Cell Size** for memory (the window costs about 20 MB at the defaults), **CPU Limit** for a weak device.

## Traps
- No ground near the camera means no navigation: Accio builds round the active camera (`NavSystem.focusProvider` changes the focus). An enemy far outside **Window Radius** stands still.
- An agent whose target is farther than **Max Search Radius** has no path and stands still. Check that against how far your enemies spawn from their target.
- A door that moves must have a Kinematic Rigid Body AND a Nav Obstacle, or the enemies' paths go straight through it. A door moved by a script with no body is level geometry, rescanned once a second.
- Keep **Step Height** of the navigation and of the Character Controller equal (0.45 m each), and raise the controller's Slope Limit with **Max Slope**: a step or slope the grid takes for walkable and the capsule cannot climb holds the enemy against it for good. Stairs: risers of 0.30 m or less.
- Nothing jumps or drops on its own: a gap in the floor is a wall until a **Nav Link** crosses it (only a flyer crosses by itself). A doorway needs to be wider than the agent by a margin (1.5 m opens for the default agent at 0.3 m cells): lower **Cell Size**, not the radius.
- The agent writes the entity's position every frame (or drives its body): do not also move it with physics or another script. Its own colliders are not level geometry.
- A body with a Character Controller treats other bodies as obstacles, so a dense crowd at a ledge can push some of it off: destroy what falls below the level.
- A cliff on a terrain is a wall (steeper than Max Slope); the terrain needs an enabled **Terrain** collider. A flyer sees only the fixed level (colliders with no body or a Static one).
- A clone is a new agent. `agent.target` is not saved with the scene: set it from a script.
- **An enemy that is a Kinematic body with a capsule, a Character Controller and a Nav Agent** chases over the grid with no bake and no change in Project Settings; a closed door or wall makes it go to the nearest place it can and stand there.

## Not available yet
Per-type masks for links and zones, collision groups between bodies (an enemy with a body treats every other body as an obstacle), no-fly zones and a path of its own for flyers, links over several floors in one cell.

Types: `brave/core/component/{nav-agent,nav-obstacle,nav-cost-zone,nav-link}.d.ts`, `brave/core/system/nav-system/`, `brave/core/enum/nav-avoidance.enum.d.ts`
