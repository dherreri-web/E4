import Phaser from "phaser";
import {
  type Actor,
  type Arena,
  Boss,
  Bullet,
  Enemy,
  type EnemyKind,
  Player,
  PowerUp,
  WIDTH,
} from "../actors.ts";
import type { Hud } from "../hud.ts";
import type { LaunchOptions } from "../main.ts";
import { AutoPilot, KeyboardPilot, type Pilot } from "../pilots.ts";
import { Rng } from "../rng.ts";
import { play } from "../sounds.ts";
import { TINTS } from "../textures.ts";
import { Backdrop } from "./backdrop.ts";
import { fadeTo } from "./fade.ts";

const TICK_MS = 1000 / 60;
const START_LIVES = 3;
const BOSS_WARNING_TICKS = 200;
const VICTORY_TICKS = 180;
export interface Run {
  score: number;
  lives: number;
  kills: number;
  hits: number;
  continues: number;
  bossDefeated?: boolean;
}

/** The play scene serves both the player and the self-play demo. */
export type PlayData = { selfPlay?: boolean };

interface Wave {
  kind: EnemyKind;
  count: number;
  at: (index: number) => number;
  position: (index: number) => { x: number; y: number };
}

interface Sector {
  name: string;
  subtitle: string;
  /** Tick at which the sector may advance if its enemies are cleared. */
  length: number;
  waves: Wave[];
  boss?: boolean;
}

const wave = (
  kind: EnemyKind,
  count: number,
  at: (index: number) => number,
  position: (index: number) => { x: number; y: number },
): Wave => ({ kind, count, at, position });

const above = (x: number) => ({ x, y: -30 });
const line =
  (count: number, center: number, spacing: number) => (index: number) =>
    above(center + (index - (count - 1) / 2) * spacing);
const pincer = (index: number) => ({
  x: index % 2 === 0 ? -30 : 510,
  y: 70 + Math.floor(index / 2) * 50,
});

export const SECTORS: Sector[] = [
  {
    name: "Outer Drift",
    subtitle: "Scouts ahead",
    length: 1560,
    waves: [
      wave("drone", 4, () => 60, line(4, 240, 64)),
      wave(
        "drone",
        5,
        (i) => 360 + Math.abs(i - 2) * 10,
        (i) => above(168 + (i - 2) * 44),
      ),
      wave(
        "drone",
        5,
        (i) => 660 + Math.abs(i - 2) * 10,
        (i) => above(312 + (i - 2) * 44),
      ),
      wave("drone", 6, () => 960, line(6, 240, 64)),
      wave("drone", 4, (i) => 1200 + i * 24, () => above(120)),
      wave("drone", 4, (i) => 1260 + i * 24, () => above(360)),
    ],
  },
  {
    name: "Shatter Belt",
    subtitle: "Divers incoming",
    length: 1800,
    waves: [
      wave(
        "drone",
        6,
        (i) => 60 + Math.abs(i - 2.5) * 10,
        line(6, 240, 44),
      ),
      wave("dart", 4, () => 300, line(4, 240, 64)),
      wave("dart", 5, (i) => 600 + i * 24, () => above(144)),
      wave("dart", 5, (i) => 720 + i * 24, () => above(336)),
      wave("drone", 7, () => 1020, line(7, 240, 64)),
      wave(
        "dart",
        5,
        (i) => 1140 + Math.abs(i - 2) * 10,
        line(5, 240, 44),
      ),
      wave("dart", 6, () => 1440, line(6, 240, 64)),
    ],
  },
  {
    name: "Gun Lanes",
    subtitle: "Turrets online",
    length: 1920,
    waves: [
      wave("turret", 1, () => 60, line(1, 240, 64)),
      wave(
        "drone",
        6,
        (i) => 240 + Math.abs(i - 2.5) * 10,
        line(6, 240, 44),
      ),
      wave("turret", 2, () => 540, line(2, 240, 64)),
      wave("dart", 6, (i) => 840 + i * 24, () => above(240)),
      wave("turret", 2, () => 1080, line(2, 240, 64)),
      wave("drone", 6, () => 1140, line(6, 240, 64)),
      wave("turret", 3, () => 1500, line(3, 240, 64)),
    ],
  },
  {
    name: "Lancer Gate",
    subtitle: "Crossfire",
    length: 1920,
    waves: [
      wave(
        "lancer",
        4,
        (i) => 60 + Math.floor(i / 2) * 30,
        pincer,
      ),
      wave(
        "dart",
        6,
        (i) => 360 + Math.abs(i - 2.5) * 10,
        line(6, 240, 44),
      ),
      wave(
        "lancer",
        6,
        (i) => 600 + Math.floor(i / 2) * 30,
        pincer,
      ),
      wave("turret", 2, () => 780, line(2, 240, 64)),
      wave(
        "lancer",
        6,
        (i) => 1140 + Math.floor(i / 2) * 30,
        pincer,
      ),
      wave(
        "drone",
        8,
        (i) => 1260 + Math.abs(i - 3.5) * 10,
        line(8, 240, 44),
      ),
      wave("dart", 8, () => 1560, line(8, 240, 64)),
    ],
  },
  {
    name: "Last Approach",
    subtitle: "Everything they have",
    length: 2040,
    waves: [
      wave("turret", 3, () => 60, line(3, 240, 64)),
      wave(
        "lancer",
        6,
        (i) => 180 + Math.floor(i / 2) * 30,
        pincer,
      ),
      wave("dart", 6, (i) => 540 + i * 24, () => above(120)),
      wave("dart", 6, (i) => 540 + i * 24, () => above(360)),
      wave(
        "drone",
        9,
        (i) => 900 + Math.abs(i - 4) * 10,
        line(9, 240, 44),
      ),
      wave("turret", 2, () => 1020, line(2, 240, 64)),
      wave(
        "lancer",
        8,
        (i) => 1320 + Math.floor(i / 2) * 30,
        pincer,
      ),
      wave(
        "dart",
        8,
        (i) => 1560 + Math.abs(i - 3.5) * 10,
        line(8, 240, 44),
      ),
    ],
  },
  {
    name: "The Warden",
    subtitle: "The Warden approaches",
    length: 0,
    waves: [],
    boss: true,
  },
];

/** The flying half of the game: one run, flown by a person or the autopilot. */
export class PlayScene extends Phaser.Scene implements Arena {
  rng!: Rng;
  player!: Player;
  now = 0;
  leaving = false;
  private selfPlay = false;
  private run!: Run;
  private pilot!: Pilot;
  private backdrop!: Backdrop;
  private enemies: Enemy[] = [];
  private shots: Bullet[] = [];
  private bullets: Bullet[] = [];
  private pickups: PowerUp[] = [];
  private sector = -1;
  private sectorStart = 0;
  private boss: Boss | null = null;
  private bossDueAt = 0;
  private victoryAt = 0;
  private gameOver = false;
  private carry = 0;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(
    private readonly hud: Hud,
    private readonly options: LaunchOptions,
  ) {
    super("play");
  }

  init(data: PlayData = {}): void {
    // Phaser reuses this instance, so every run starts from a clean slate.
    this.selfPlay = data.selfPlay ?? false;
    this.leaving = false;
    this.rng = new Rng(this.options.seed);
    this.now = 0;
    this.carry = 0;
    this.run = {
      score: 0,
      lives: START_LIVES,
      kills: 0,
      hits: 0,
      continues: 0,
    };
    this.enemies = [];
    this.shots = [];
    this.bullets = [];
    this.pickups = [];
    this.sector = -1;
    this.sectorStart = 0;
    this.boss = null;
    this.bossDueAt = 0;
    this.victoryAt = 0;
    this.gameOver = false;
  }

  create(): void {
    this.backdrop = new Backdrop(this);
    this.input.keyboard?.on("keydown-SPACE", () => this.onSpace());

    this.player = new Player(this);
    this.player.enableFilters();
    this.player.filters?.internal.addGlow(TINTS.player, 4, 0, 1);
    this.add.particles(0, 0, "spark", {
      speedY: { min: 80, max: 160 },
      speedX: { min: -20, max: 20 },
      lifespan: 260,
      scale: { start: 0.9, end: 0 },
      tint: TINTS.player,
      blendMode: "ADD",
      frequency: 30,
    }).startFollow(this.player, 0, 18);
    this.sparks = this.add.particles(0, 0, "spark", {
      speed: { min: 60, max: 260 },
      lifespan: { min: 250, max: 600 },
      scale: { start: 1.4, end: 0 },
      blendMode: "ADD",
      emitting: false,
    });

    this.pilot = this.selfPlay
      ? new AutoPilot()
      : new KeyboardPilot(this.input.keyboard!);
    this.hud.setMode(this.selfPlay ? "attract" : "play");
    this.hud.setBoss(null);
    this.cameras.main.fadeIn(400, 4, 2, 12);
    this.startSector(0);
  }

  override update(_time: number, delta: number): void {
    this.backdrop.scroll(delta);
    const speed = this.selfPlay ? this.options.speed : 1;
    // the play branch runs one tick per frame
    this.carry += Math.min(delta, 250) * speed;
    while (this.carry >= TICK_MS && this.scene.isActive()) {
      this.carry -= TICK_MS;
      this.tick();
    }
  }

  private onSpace(): void {
    // During the demo any key returns to the title. A human run fires with
    // SPACE through the keyboard pilot, so it has nothing to do here.
    if (!this.selfPlay) return;
    fadeTo(this, "title");
  }

  // Arena: what actors may ask of the scene.

  fire(
    x: number,
    y: number,
    angle: number,
    speed: number,
    heavy = false,
  ): void {
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    this.bullets.push(
      heavy
        ? new Bullet(this, x, y, "heavy", 8, vx, vy)
        : new Bullet(this, x, y, "bullet", 5, vx, vy),
    );
  }

  summon(_kind: string, x: number, y: number): void {
    this.enemies.push(
      new Enemy(
        this,
        x,
        y,
        "drone",
        x,
        x < WIDTH / 2 ? 1 : -1,
      ),
    );
  }

  // one tick of gameplay

  private tick(): void {
    this.now++;
    this.advanceRoute();
    this.updateProgression();

    if (!this.gameOver) this.flyPlayer();
    for (const enemy of this.enemies) enemy.step(this);
    for (const actor of [...this.shots, ...this.bullets, ...this.pickups]) {
      actor.step();
    }

    this.resolveHits();
    this.cull();
    this.refreshHud();
  }

  private flyPlayer(): void {
    const controls = this.pilot.read({
      player: this.player,
      enemies: this.enemies,
      threats: [...this.bullets, ...this.enemies],
      pickups: this.pickups,
    });
    for (const shot of this.player.step(controls)) {
      this.shots.push(
        new Bullet(this, shot.x, shot.y, "shot", 6, shot.vx, -11),
      );
      if (this.now % 2 === 0) play(this, "shoot", 0.25);
    }
  }

  private advanceRoute(): void {
    if (this.gameOver) return;
    if (this.victoryAt > 0) {
      if (this.now === this.victoryAt) {
        fadeTo(this, "cutscene", {
          run: this.run,
          afterDemo: this.selfPlay,
        });
      }
      return;
    }
    if (this.bossDueAt > 0) {
      if (this.now === this.bossDueAt) this.startBoss();
      return;
    }
    if (this.boss) return;
    const t = this.now - this.sectorStart;
    const sector = SECTORS[this.sector];
    if (
      sector.length > 0 &&
      t >= sector.length &&
      (this.enemies.length === 0 || t >= sector.length + 240)
    ) {
      this.startSector(this.sector + 1);
    }
  }

  private startSector(index: number): void {
    const sector = SECTORS[index];
    this.sector = index;
    this.hud.setSector(index);
    this.sectorStart = this.now;

    if (sector.boss) {
      this.hud.announce("WARNING", sector.subtitle);
      this.hud.shudder(true);
      play(this, "warn", 0.6);
      this.bossDueAt = this.now + BOSS_WARNING_TICKS;
    } else {
      this.hud.announce(`Sector ${index + 1}: ${sector.name}`, sector.subtitle);
    }
  }

  private spawnWave(wave: Wave, tick: number): void {
    for (let i = 0; i < wave.count; i++) {
      if (wave.at(i) !== tick) continue;

      const { x, y } = wave.position(i);
      const enemy = new Enemy(
        this,
        x,
        y,
        wave.kind,
        x,
        i % 2 === 0 ? 1 : -1,
      );
      this.enemies.push(enemy);
    }
  }

  private updateProgression(): void {
    const t = this.now - this.sectorStart;
    const waves = SECTORS[this.sector].waves;

    // Keep this table order: enemies created on the same tick consume RNG in
    // creation order, which is part of the deterministic self-play run.
    for (const wave of waves) {
      this.spawnWave(wave, t);
    }
  }

  private startBoss(): void {
    this.bossDueAt = 0;
    this.boss = new Boss(this);
    this.boss.enableFilters();
    this.boss.filters?.internal.addGlow(TINTS.boss, 4, 0, 1);
    this.enemies.push(this.boss);
    this.hud.setBoss(1);
  }

  private resolveHits(): void {
    for (const shot of this.shots) {
      const enemy = this.enemies.find((e) => e.active && e.touches(shot));
      if (!enemy) continue;
      shot.setActive(false);
      this.burst(shot.x, shot.y, 3, TINTS.spark);
      if (enemy.takeDamage(shot.damage)) this.destroyEnemy(enemy);
      else play(this, "hit", 0.3);
    }

    for (const bullet of this.bullets) {
      if (bullet.active && bullet.touches(this.player)) {
        bullet.setActive(false);
        this.hurtPlayer();
      }
    }
    for (const enemy of this.enemies) {
      if (!enemy.active || !enemy.touches(this.player)) continue;
      this.hurtPlayer();
      if (enemy !== this.boss && enemy.takeDamage(3)) this.destroyEnemy(enemy);
    }
    for (const pickup of this.pickups) {
      if (pickup.active && pickup.touches(this.player)) {
        pickup.setActive(false);
        this.player.collect(pickup.kind);
        play(this, "pickup", 0.6);
        this.burst(pickup.x, pickup.y, 14, TINTS.player);
      }
    }
  }

  private destroyEnemy(enemy: Enemy): void {
    enemy.setActive(false);
    this.run.score += enemy.score;
    this.run.kills++;
    if (enemy === this.boss) {
      this.defeatBoss(this.boss);
      return;
    }
    this.explode(enemy.x, enemy.y, 1);
    if (this.rng.chance(enemy.dropChance)) {
      const kind = this.player.power < 3 && this.rng.chance(0.5)
        ? "spread"
        : "shield";
      this.pickups.push(new PowerUp(this, enemy.x, enemy.y, kind));
    }
  }

  private hurtPlayer(): void {
    // After the Warden falls, nothing can hurt the ship during the victory lap.
    if (this.run.bossDefeated || this.gameOver || !this.player.vulnerable) {
      return;
    }
    this.run.hits++;
    const lostLife = this.player.takeHit();
    this.hud.shudder(lostLife);
    this.cameras.main.shake(lostLife ? 260 : 120, lostLife ? 0.012 : 0.005);
    play(this, "hurt", 0.7);
    this.burst(this.player.x, this.player.y, 24, TINTS.player);
    if (!lostLife) return;
    this.run.lives--;
    this.cameras.main.flash(180, 255, 80, 120);
    if (this.run.lives > 0) return;
    if (this.selfPlay) {
      // The demo never ends early: self-play buys another ship and keeps going.
      this.run.continues++;
      this.run.lives = START_LIVES;
      return;
    }
    this.hud.announce("GAME OVER", "The lanes stay closed");
    this.gameOver = true;
    this.player.setVisible(false);
    this.player.bubble.setVisible(false);
    this.explode(this.player.x, this.player.y, 2);
    this.time.delayedCall(1800, () => fadeTo(this, "title"));
  }

  private defeatBoss(boss: Boss): void {
    this.run.bossDefeated = true;
    this.victoryAt = this.now + VICTORY_TICKS;
    this.hud.setBoss(0);
    this.hud.announce("WARDEN DOWN", "The lanes are open");
    console.log("victory lap: ship protected =", this.run.bossDefeated);
    // The Warden's fall takes its bullets and escorts with it (no score).
    for (const bullet of this.bullets) {
      this.burst(bullet.x, bullet.y, 2, TINTS.spark);
      bullet.setActive(false);
    }
    for (const escort of this.enemies) {
      if (escort === boss || !escort.active) continue;
      this.explode(escort.x, escort.y, 1);
      escort.setActive(false);
    }
    console.info(
      `[self-play] seed=${this.options.seed} ticks=${this.now} score=${this.run.score}` +
        ` kills=${this.run.kills} hits=${this.run.hits} continues=${this.run.continues}`,
    );
    // A chain of blasts across the hull, then the big one.
    for (let i = 0; i < 8; i++) {
      this.time.delayedCall(i * 140, () => {
        this.explode(
          boss.x + Phaser.Math.Between(-80, 80),
          boss.y + Phaser.Math.Between(-40, 40),
          1,
        );
      });
    }
    this.time.delayedCall(1200, () => {
      this.explode(boss.x, boss.y, 3);
      this.cameras.main.flash(400, 255, 230, 160);
      this.hud.shudder(true);
      play(this, "bigboom", 0.9);
      boss.setVisible(false);
      boss.core.setVisible(false);
    });
  }

  private explode(x: number, y: number, size: number): void {
    this.burst(x, y, 18 * size, size > 1 ? TINTS.bossCore : TINTS.spark);
    const ring = this.add.image(x, y, "ring").setBlendMode(
      Phaser.BlendModes.ADD,
    );
    ring.setScale(0.2 * size);
    this.tweens.add({
      targets: ring,
      scale: 1.2 * size,
      alpha: 0,
      duration: 380 + 120 * size,
      ease: "Cubic.out",
      onComplete: () => ring.destroy(),
    });
    this.cameras.main.shake(90 * size, 0.004 * size);
    play(this, size > 1 ? "bigboom" : "boom", 0.5);
  }

  private burst(x: number, y: number, count: number, tint: number): void {
    this.sparks.particleTint = tint;
    this.sparks.explode(count, x, y);
  }

  /** Destroys spent and offscreen actors. */
  private cull(): void {
    const spent = (actor: Actor) => !actor.active || actor.isOffscreen();
    this.shots = sweep(this.shots, spent);
    this.bullets = sweep(this.bullets, spent);
    this.pickups = sweep(this.pickups, spent);
    // The defeated Warden stays on screen for its finale: drop it undestroyed.
    this.enemies = this.enemies.filter((e) => e.active || e !== this.boss);
    this.enemies = sweep(
      this.enemies,
      (e) => !e.active || (e.age > 30 && e.isOffscreen()),
    );
  }

  private refreshHud(): void {
    this.hud.setScore(this.run.score);
    this.hud.setLives(this.run.lives);
    this.hud.setPower(this.player.power);
    if (this.boss && !this.run.bossDefeated) {
      this.hud.setBoss(this.boss.fraction);
    }
  }
}

function sweep<T extends Actor>(
  actors: T[],
  gone: (actor: Actor) => boolean,
): T[] {
  return actors.filter((actor) => {
    if (!gone(actor)) return true;
    actor.destroy();
    return false;
  });
}
