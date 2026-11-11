import { Collider, Entity, Float, Inject, Int, ISpawnBatch, ISpawnPlacement, JsonIgnore, PlayerMovement, Ref, Saved, Script, ScriptComponent, Signal, SpawnSystem, State, String, Time, Vector3 } from '@brave/core';
import { Hud } from '../../services/hud.service';
import { Health } from '../combat/health';
import { playSound } from '../combat/play-sound';
import { EnemyCube } from './enemy-cube';

/**
 * Waves of enemies: wave 1 has `First Wave` of them, every wave after it `Growth` more, and the next one comes `Pause Seconds` after the last enemy of the one before is gone. They are made from a prefab
 * with the engine's `SpawnSystem` (a wave is spread over a few frames, so there is no hitch), at the spawn points, which are the CHILDREN of this entity, in turn. After the last wave the HUD says so and the
 * spawner stops.
 *
 * It starts when the player steps into the trigger Collider of this entity (a pad on the ground), or when a script or a Director calls `start()`. The engine also has a `Spawner` component that makes things
 * at an interval with no code; this one waits for a wave to be cleared, which that cannot.
 *
 * What it knows is in numbers (`wave`, `isRunning`, `pauseLeft`) and in the things it spawned (it is their `owner`, and `SpawnSystem.countOf()` counts them), so a save brings it back whole.
 */
@Script()
export class WaveSpawner extends ScriptComponent {

  // How far from its spawn point an enemy may appear, so that a wave spread over few points does not stand inside itself.
  private static readonly SCATTER = 1.5;

  @String({ header: 'Enemies', label: 'Prefab', tooltip: 'The name of the prefab of one enemy (it must be in the project).' }) prefab = 'enemy-cube.fab';
  @Ref(Entity, { label: 'Target', tooltip: 'Who the enemies hunt, from the moment they appear. Empty: the player.' }) target?: Entity;
  @Int({ header: 'Waves', label: 'Waves', tooltip: 'How many waves there are.' }) waves = 3;
  @Int({ label: 'First Wave', tooltip: 'How many enemies the first wave has.' }) firstWave = 3;
  @Int({ label: 'Growth', tooltip: 'How many more each wave has than the one before.' }) growth = 2;
  @Float({ label: 'Pause Seconds', suffix: 's', tooltip: 'From the last enemy of a wave being gone to the next wave.' }) pauseSeconds = 4;
  @Ref(Entity, { header: 'Sound', label: 'Wave Sound', tooltip: 'Played when a wave begins.' }) waveSound?: Entity;

  /** The number of the wave that is going on: 0 before the first, `Waves` at the last. */
  @JsonIgnore() @Saved() wave = 0;
  /** The waves are going: from `start()` to the last wave cleared. */
  @State() @JsonIgnore() @Saved() isRunning = false;
  /** Seconds to the next wave, while the last one is cleared and the pause goes on; 0 otherwise. */
  @JsonIgnore() @Saved() pauseLeft = 0;

  /** A wave begins, told with its number. */
  onWaveStart = new Signal<number>();
  /** The last enemy of a wave is gone, told with its number. */
  onWaveCleared = new Signal<number>();
  /** The last wave was cleared. */
  onFinished = new Signal();

  @Inject(Hud) hud!: Hud;

  @JsonIgnore() private batch?: ISpawnBatch;

  onStart() {
    this.bind();
  }

  onUpdate() {
    if (!this.isRunning) return;
    if (this.pauseLeft > 0) {
      this.pauseLeft -= Time.deltaTime;
      if (this.pauseLeft <= 0) this.nextWave();
      return;
    }
    // Still being made, or still alive: the dead stay a moment, then they are removed, and then the wave is over.
    if ((this.batch && !this.batch.done) || SpawnSystem.countOf(this.entity) > 0) return;
    this.clear();
  }

  // A save brings the component back as it was, started: the trigger has to be listened to again. (A wave that was still being made when the game was saved is dropped by the load.)
  onRestore() {
    this.bind();
    this.batch = undefined;
  }

  /** Begins the first wave. Does nothing while the waves are going. */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.wave = 0;
    this.nextWave();
  }

  private bind() {
    this.target = this.target ?? this.entity.scene?.children.find(root => root.getComponent(PlayerMovement));
    this.entity.getComponent(Collider)?.onTriggerEnter.on(event => this.onEntered(event.entity), this);
  }

  private nextWave() {
    this.pauseLeft = 0;
    const prefab = SpawnSystem.idOf(this.prefab);
    if (!prefab) {
      this.isRunning = false;
      return;
    }
    this.wave++;
    this.hud.showMessage(`Wave ${this.wave}`, 2.5);
    playSound(this.waveSound);
    this.onWaveStart.emit(this.wave);
    this.batch = SpawnSystem.spawnMany(prefab, this.placements(this.firstWave + this.growth * (this.wave - 1)), { perFrame: 2 });
    this.batch.onDone.on(batch => batch.spawned.forEach(enemy => enemy.getComponent(EnemyCube)?.hunt(this.target)), this);
  }

  // One place for each enemy, the spawn points in turn. The spawner is the owner of what it makes: that is how it counts them.
  private placements(count: number): ISpawnPlacement[] {
    const points = this.entity.children.length ? this.entity.children : [this.entity];
    return Array.from({ length: count }, (_, index) => {
      const point = points[index % points.length].transform.globalPosition;
      const scatter = () => (Math.random() * 2 - 1) * WaveSpawner.SCATTER;
      return { position: new Vector3(point.x + scatter(), point.y, point.z + scatter()), owner: this.entity };
    });
  }

  private clear() {
    this.onWaveCleared.emit(this.wave);
    if (this.wave < this.waves) {
      this.pauseLeft = Math.max(this.pauseSeconds, 0.01);
      return;
    }
    this.isRunning = false;
    this.hud.showMessage('All waves cleared', 4);
    this.onFinished.emit();
  }

  private onEntered(entity: Entity) {
    if (this.isRunning || !this.target) return;
    if (Health.find(entity) === Health.find(this.target)) this.start();
  }
}
