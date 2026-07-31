/**
 * SLICE 1 fight simulation — 4v4, beat-resolved, deterministic, and completely free of Phaser.
 *
 * This is the brain of the squad-autobattler direction (`docs/DESIGN_LOG.md`, 2026-07-28). It owns
 * every rule; `BattleFight.ts` only draws whatever this produces. Keeping the two apart is what makes
 * the fight testable without a browser — the whole 90-second encounter can be stepped in a unit test.
 *
 * THE TIME MODEL (design log, "beats, with parry and movement off-beat"):
 *   - Attacks, heals, AI decisions and stance changes resolve ONLY on beat boundaries.
 *   - Movement, projectile flight and parry are continuous.
 * That split is the whole point: a parry no longer needs frame-level agreement, only the right beat.
 *
 * WHY EVASION IS EMERGENT: nothing here rolls a dodge. Projectiles carry a real position and hit
 * whatever is actually standing in them on arrival. A unit that walked away is missed because it
 * walked away. This is what makes the owner's forward/back stance load-bearing rather than cosmetic —
 * standing forward shortens your own shots' flight time, so the enemy has less time to leave the spot
 * you aimed at. The cost is symmetric: you are also closer to theirs.
 */

import { makeRng, type Rng } from "@dd/shared";

// ---------------------------------------------------------------------------------------------
// Geometry — all values are in the stage's 3840x2160 virtual canvas space.
// ---------------------------------------------------------------------------------------------

/** The invisible boundary. Crossing it is allowed; staying across it is not (see `applyMidlineSling`). */
export const MIDLINE_X = 1920;

/** Beat length. Design log flags this as unvalidated — the first thing to feel out in playtest. */
export const BEAT_MS = 500;

/** Home X distance from the midline per stance, before each unit's own rank offset. */
export const STANCE_PUSH_PX = 260;

/**
 * Midline spring. Cross the line and this pulls you back HARD, with enough overshoot that you are
 * thrown into your own half rather than gently parked on the boundary — the owner's "soft sling".
 * Underdamped on purpose: `SLING_DAMPING` below critical is what produces the fling.
 */
export const SLING_STIFFNESS = 34;
export const SLING_DAMPING = 3.4;
/** Hard stop on how deep anyone can wade before the spring simply refuses. Keeps the sides legible. */
export const SLING_MAX_DEPTH_PX = 190;

/** Projectile travel. Slow enough to read, rank, and physically step in front of. */
export const PROJECTILE_SPEED = 900;
/** A bolt connects when it gets this close to a hostile body. */
export const PROJECTILE_HIT_RADIUS = 62;

/** How near a bolt must pass for a vanguard to interpose. Deliberately tight — see the design log's
 *  locked constraint: the arc must be narrow enough that two lines cannot be covered at once. */
export const PARRY_REACH_PX = 150;
/** Recovery between parries. With several bolts in the air this is what makes parry triage, not a wall. */
export const PARRY_COOLDOWN_MS = 620;

export type BattleTeam = 0 | 1;
export type BattleRole = "vanguard" | "medic" | "ranged";
/** Offensive, neutral, defensive — the only positional decision a unit makes. */
export type Stance = "forward" | "hold" | "back";

export interface UnitSpec {
  readonly id: string;
  readonly name: string;
  readonly team: BattleTeam;
  readonly role: BattleRole;
  /** Whole-art character sprite id, straight from the existing roster. */
  readonly spriteId: string;
  /** Real catalog weapon id — drawn in hand and used for the attack animation. */
  readonly weaponId: string;
  readonly maxHp: number;
  /** px/s the unit walks toward its stance position. */
  readonly moveSpeed: number;
  /** Acts once every N beats. Higher = slower. */
  readonly beatsPerAction: number;
  readonly damage: number;
  /** Distance from the midline this unit stands at in `hold` stance. Its rank in the formation. */
  readonly rankOffsetPx: number;
  /** Fixed depth lane. Units hold their row; the fight is fought on the X axis. */
  readonly laneY: number;
  /** Medic only: how far a heal reaches. Gives support a genuine positioning problem. */
  readonly healRange?: number;
}

export interface Unit {
  readonly spec: UnitSpec;
  hp: number;
  x: number;
  y: number;
  /** Depth row the unit is walking toward. Only the vanguard ever changes it — see `escortLaneY`. */
  targetY: number;
  /** Velocity carried by the sling only; ordinary walking is positional, not physical. */
  vx: number;
  stance: Stance;
  alive: boolean;
  /** Staggers units within a team so a side does not fire as one volley. */
  readonly beatPhase: number;
  parryReadyAtMs: number;
  /** True while the spring is actively rejecting this unit from enemy ground. */
  slung: boolean;
}

export interface Projectile {
  readonly id: number;
  readonly team: BattleTeam;
  readonly ownerId: string;
  /** Who it was aimed at when fired. Used for the "that one's for your healer" telegraph. */
  readonly targetId: string;
  x: number;
  y: number;
  readonly vx: number;
  readonly vy: number;
  readonly damage: number;
  alive: boolean;
}

export type BattleEvent =
  | { readonly type: "attack"; readonly unitId: string; readonly targetId: string }
  | { readonly type: "heal"; readonly unitId: string; readonly targetId: string; readonly amount: number }
  | { readonly type: "hit"; readonly unitId: string; readonly amount: number; readonly fromX: number; readonly fromY: number }
  | { readonly type: "parry"; readonly unitId: string; readonly fromX: number; readonly fromY: number; readonly damage: number }
  | { readonly type: "death"; readonly unitId: string }
  | { readonly type: "beat"; readonly index: number };

export interface BattleSnapshot {
  readonly units: readonly Unit[];
  readonly projectiles: readonly Projectile[];
  readonly beatIndex: number;
  /** 0..1 through the current beat — the renderer uses this for the beat pulse. */
  readonly beatProgress: number;
  readonly winner: BattleTeam | undefined;
  readonly elapsedMs: number;
}

/** Home X for a unit given its stance. Forward is always *toward the midline*, for both teams. */
export function stanceHomeX(spec: UnitSpec, stance: Stance): number {
  const push = stance === "forward" ? -STANCE_PUSH_PX : stance === "back" ? STANCE_PUSH_PX : 0;
  const distance = spec.rankOffsetPx + push;
  return spec.team === 0 ? MIDLINE_X - distance : MIDLINE_X + distance;
}

/** Signed depth past the midline into enemy ground. <= 0 while a unit is legally on its own side. */
export function midlineDepth(unit: Unit): number {
  return unit.spec.team === 0 ? unit.x - MIDLINE_X : MIDLINE_X - unit.x;
}

export class BattleSim {
  readonly units: Unit[] = [];
  readonly projectiles: Projectile[] = [];

  private readonly rng: Rng;
  private readonly events: BattleEvent[] = [];
  private elapsedMs = 0;
  private beatClockMs = 0;
  private beatIndex = 0;
  private nextProjectileId = 1;
  private winner: BattleTeam | undefined;

  constructor(specs: readonly UnitSpec[], seed = 0xd0d0) {
    this.rng = makeRng(seed);
    specs.forEach((spec, index) => {
      this.units.push({
        spec,
        hp: spec.maxHp,
        x: stanceHomeX(spec, "hold"),
        y: spec.laneY,
        targetY: spec.laneY,
        vx: 0,
        stance: "hold",
        alive: true,
        beatPhase: index % spec.beatsPerAction,
        parryReadyAtMs: 0,
        slung: false,
      });
    });
  }

  /** Drain everything that happened since the last call. The renderer turns these into animations. */
  takeEvents(): BattleEvent[] {
    return this.events.splice(0, this.events.length);
  }

  snapshot(): BattleSnapshot {
    return {
      units: this.units,
      projectiles: this.projectiles,
      beatIndex: this.beatIndex,
      beatProgress: this.beatClockMs / BEAT_MS,
      winner: this.winner,
      elapsedMs: this.elapsedMs,
    };
  }

  unit(id: string): Unit | undefined {
    return this.units.find((u) => u.spec.id === id);
  }

  /**
   * Advance the fight. `deltaMs` is clamped by the caller; this steps continuous systems first and then
   * crosses however many beat boundaries the elapsed time covers, so a stalled tab cannot skip a beat.
   */
  step(deltaMs: number): void {
    if (this.winner !== undefined) return;
    const dt = deltaMs / 1000;
    this.elapsedMs += deltaMs;

    for (const unit of this.units) {
      if (!unit.alive) continue;
      this.moveUnit(unit, dt);
      this.applyMidlineSling(unit, dt);
    }
    this.stepProjectiles(dt);

    this.beatClockMs += deltaMs;
    while (this.beatClockMs >= BEAT_MS) {
      this.beatClockMs -= BEAT_MS;
      this.beatIndex += 1;
      this.events.push({ type: "beat", index: this.beatIndex });
      this.resolveBeat();
    }
    this.checkVictory();
  }

  // -------------------------------------------------------------------------------------------
  // Continuous systems
  // -------------------------------------------------------------------------------------------

  /** Walk toward the stance position. Movement is positional, so being slung never fights the walk —
   *  the spring velocity is added on top and bleeds away on its own. */
  private moveUnit(unit: Unit, dt: number): void {
    const home = stanceHomeX(unit.spec, unit.stance);
    const delta = home - unit.x;
    const stride = unit.spec.moveSpeed * dt;
    unit.x += Math.abs(delta) <= stride ? delta : Math.sign(delta) * stride;
    unit.x += unit.vx * dt;

    // Lateral escort. Only the vanguard leaves its row, and only to get into a line it means to block.
    const deltaY = unit.targetY - unit.y;
    if (Math.abs(deltaY) > 0.01) {
      unit.y += Math.abs(deltaY) <= stride ? deltaY : Math.sign(deltaY) * stride;
    }
  }

  /**
   * The invisible boundary. You may cross — nothing blocks you — but the moment you do, a spring winds
   * up behind you and throws you back into your own half. Underdamped so you overshoot home rather than
   * settling on the line, which is what makes it read as a sling instead of a wall.
   */
  private applyMidlineSling(unit: Unit, dt: number): void {
    const depth = midlineDepth(unit);
    if (depth <= 0) {
      unit.slung = false;
      // Bleed the leftover throw velocity once safely home, so it does not accumulate across crossings.
      unit.vx -= unit.vx * Math.min(1, SLING_DAMPING * dt);
      if (Math.abs(unit.vx) < 1) unit.vx = 0;
      return;
    }
    unit.slung = true;
    const clamped = Math.min(depth, SLING_MAX_DEPTH_PX);
    // Push points back toward the unit's OWN side: -x for team 0, +x for team 1.
    const outward = unit.spec.team === 0 ? -1 : 1;
    unit.vx += outward * SLING_STIFFNESS * clamped * dt;
    unit.vx -= unit.vx * Math.min(1, SLING_DAMPING * dt);
    // Nobody wades deeper than the cap, however hard they walk into it.
    if (depth > SLING_MAX_DEPTH_PX) unit.x = MIDLINE_X - outward * SLING_MAX_DEPTH_PX;
  }

  private stepProjectiles(dt: number): void {
    for (const shot of this.projectiles) {
      if (!shot.alive) continue;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;

      if (this.tryParry(shot)) continue;

      for (const unit of this.units) {
        if (!unit.alive || unit.spec.team === shot.team) continue;
        if (Math.hypot(unit.x - shot.x, unit.y - shot.y) > PROJECTILE_HIT_RADIUS) continue;
        shot.alive = false;
        this.damage(unit, shot.damage, shot.vx, shot.vy);
        break;
      }

      if (shot.x < -400 || shot.x > 4240) shot.alive = false;
    }
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      if (!this.projectiles[i]?.alive) this.projectiles.splice(i, 1);
    }
  }

  /**
   * Parry by INTERPOSITION (design log, 2026-07-28): a vanguard does not click a parry, it stands in the
   * line. Any friendly vanguard physically near the bolt's current position catches it. Because the reach
   * is small and the cooldown real, a vanguard covering one line is not covering another.
   */
  private tryParry(shot: Projectile): boolean {
    for (const unit of this.units) {
      if (!unit.alive || unit.spec.role !== "vanguard") continue;
      if (unit.spec.team === shot.team) continue; // only defends against the OTHER side
      if (this.elapsedMs < unit.parryReadyAtMs) continue;
      if (Math.hypot(unit.x - shot.x, unit.y - shot.y) > PARRY_REACH_PX) continue;
      shot.alive = false;
      unit.parryReadyAtMs = this.elapsedMs + PARRY_COOLDOWN_MS;
      this.events.push({
        type: "parry",
        unitId: unit.spec.id,
        fromX: shot.vx,
        fromY: shot.vy,
        damage: shot.damage,
      });
      return true;
    }
    return false;
  }

  private damage(unit: Unit, amount: number, fromX: number, fromY: number): void {
    unit.hp -= amount;
    this.events.push({ type: "hit", unitId: unit.spec.id, amount, fromX, fromY });
    if (unit.hp > 0) return;
    unit.hp = 0;
    unit.alive = false;
    this.events.push({ type: "death", unitId: unit.spec.id });
  }

  // -------------------------------------------------------------------------------------------
  // Beat resolution
  // -------------------------------------------------------------------------------------------

  private resolveBeat(): void {
    for (const unit of this.units) {
      if (!unit.alive) continue;
      unit.stance = this.decideStance(unit);
      if (unit.spec.role === "vanguard") unit.targetY = this.escortLaneY(unit);
      if ((this.beatIndex + unit.beatPhase) % unit.spec.beatsPerAction !== 0) continue;
      if (unit.spec.role === "medic") this.actMedic(unit);
      else if (unit.spec.role === "ranged") this.actRanged(unit);
      else this.actVanguard(unit);
    }
  }

  /**
   * The positional AI. Every role answers the same question — press or protect — with its own bias.
   * Forward buys pressure (shorter flight time on your own shots) and pays for it in exposure.
   */
  private decideStance(unit: Unit): Stance {
    const healthFrac = unit.hp / unit.spec.maxHp;
    switch (unit.spec.role) {
      case "vanguard": {
        // The nanny. It walks toward whatever is being shot at, because interposition is its whole job.
        const threatened = this.mostThreatenedAlly(unit);
        if (threatened && threatened.spec.role !== "vanguard") return "forward";
        return healthFrac < 0.3 ? "hold" : "forward";
      }
      case "medic": {
        // Hangs back until someone it must reach has drifted out of range, then commits.
        const patient = this.lowestAlly(unit);
        if (!patient) return "back";
        const range = unit.spec.healRange ?? 900;
        return Math.abs(patient.x - unit.x) > range ? "forward" : "back";
      }
      default: {
        // DPS presses while healthy and safe, retreats when hurt or when a bolt is inbound at it.
        if (healthFrac < 0.45) return "back";
        return this.incomingAt(unit) ? "back" : "forward";
      }
    }
  }

  private actRanged(unit: Unit): void {
    const target = this.pickRangedTarget(unit);
    if (!target) return;
    const dx = target.x - unit.x;
    const dy = target.y - unit.y;
    const length = Math.hypot(dx, dy) || 1;
    // A small authored spread so two DPS on the same target do not fire identical lines. Seeded, never
    // Math.random — a fight must replay identically from its seed.
    const spread = this.rng.range(-0.05, 0.05);
    const cos = Math.cos(spread);
    const sin = Math.sin(spread);
    const nx = dx / length;
    const ny = dy / length;
    this.projectiles.push({
      id: this.nextProjectileId++,
      team: unit.spec.team,
      ownerId: unit.spec.id,
      targetId: target.spec.id,
      x: unit.x,
      y: unit.y,
      vx: (nx * cos - ny * sin) * PROJECTILE_SPEED,
      vy: (nx * sin + ny * cos) * PROJECTILE_SPEED,
      damage: unit.spec.damage,
      alive: true,
    });
    this.events.push({ type: "attack", unitId: unit.spec.id, targetId: target.spec.id });
  }

  /** Melee only lands on someone within reach — which, with the midline in the way, means the enemy
   *  vanguard pressing forward at the same time. Two tanks meeting at the line is the intended picture. */
  private actVanguard(unit: Unit): void {
    const target = this.pickTarget(unit);
    if (!target) return;
    const reach = 300;
    if (Math.hypot(target.x - unit.x, target.y - unit.y) > reach) return;
    this.events.push({ type: "attack", unitId: unit.spec.id, targetId: target.spec.id });
    this.damage(target, unit.spec.damage, Math.sign(target.x - unit.x), 0);
  }

  private actMedic(unit: Unit): void {
    const patient = this.lowestAlly(unit);
    if (!patient || patient.hp >= patient.spec.maxHp) return;
    if (Math.abs(patient.x - unit.x) > (unit.spec.healRange ?? 900)) return;
    const amount = Math.min(unit.spec.damage, patient.spec.maxHp - patient.hp);
    patient.hp += amount;
    this.events.push({ type: "heal", unitId: unit.spec.id, targetId: patient.spec.id, amount });
  }

  // -------------------------------------------------------------------------------------------
  // Target selection
  // -------------------------------------------------------------------------------------------

  /** Nearest living enemy. Melee can only hit what it can reach, so proximity IS the decision. */
  private pickTarget(unit: Unit): Unit | undefined {
    let best: Unit | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const other of this.units) {
      if (!other.alive || other.spec.team === unit.spec.team) continue;
      const distance = Math.hypot(other.x - unit.x, other.y - unit.y);
      if (distance >= bestDistance) continue;
      bestDistance = distance;
      best = other;
    }
    return best;
  }

  /**
   * Ranged targeting shoots PAST the enemy tank at whatever is worth killing, with distance only as a
   * tiebreak.
   *
   * This is load-bearing, not flavour. A live probe of the first build had all four DPS firing at the
   * nearest enemy — which is always the opposing vanguard — so every bolt landed on a tank, the backline
   * was never in danger, and the vanguard had nothing to protect. That deletes the entire premise: the
   * design log calls telegraphing a bolt's TARGET "the single most important piece of UI in the design",
   * and there is nothing to read if every bolt is for the tank standing in front of you.
   */
  private pickRangedTarget(unit: Unit): Unit | undefined {
    const worth: Record<BattleRole, number> = { medic: 2.6, ranged: 2, vanguard: 1 };
    let best: Unit | undefined;
    let bestScore = -1;
    for (const other of this.units) {
      if (!other.alive || other.spec.team === unit.spec.team) continue;
      const distance = Math.hypot(other.x - unit.x, other.y - unit.y);
      // Bolts already committed to a target make it a WORSE pick. Without this every DPS converges on the
      // single juiciest enemy, both vanguards park in that one row forever, and the other lanes are never
      // threatened — a stable, one-note fight. Spreading fire is what forces the guard to choose a line,
      // which is the tension the whole parry design is built on.
      const inbound = this.projectiles.reduce(
        (n, shot) => (shot.alive && shot.targetId === other.spec.id ? n + 1 : n),
        0,
      );
      const score = worth[other.spec.role] / ((1 + distance / 2200) * (1 + inbound * 1.2));
      if (score <= bestScore) continue;
      bestScore = score;
      best = other;
    }
    return best;
  }

  private lowestAlly(unit: Unit): Unit | undefined {
    let best: Unit | undefined;
    for (const other of this.units) {
      if (!other.alive || other.spec.team !== unit.spec.team) continue;
      const frac = other.hp / other.spec.maxHp;
      if (best && frac >= best.hp / best.spec.maxHp) continue;
      best = other;
    }
    return best;
  }

  /**
   * The ally about to be hit soonest. This is what pulls the vanguard out of position, so "soonest"
   * matters rather than "first in the array" — the guard should commit to the bolt it can still reach,
   * not to whichever one happened to spawn first.
   */
  private mostThreatenedAlly(unit: Unit): Unit | undefined {
    let best: Unit | undefined;
    let soonest = Number.POSITIVE_INFINITY;
    for (const shot of this.projectiles) {
      if (!shot.alive || shot.team === unit.spec.team) continue;
      const target = this.unit(shot.targetId);
      if (!target?.alive || target.spec.team !== unit.spec.team) continue;
      const speed = Math.hypot(shot.vx, shot.vy) || 1;
      const eta = Math.hypot(target.x - shot.x, target.y - shot.y) / speed;
      if (eta >= soonest) continue;
      soonest = eta;
      best = target;
    }
    return best;
  }

  /**
   * Where the vanguard should stand, in depth.
   *
   * Parry is by interposition, so a guard welded to its own row can only ever block bolts already headed
   * at its row. In the first live build the rows were ~170px apart and the parry reach 150px, which made
   * interposing backline shots geometrically impossible — the mechanic existed and could never fire.
   * Letting only the vanguard change rows fixes that without weakening the constraint that matters: it
   * still cannot be in two lines at once, so covering the medic means abandoning the sniper.
   */
  private escortLaneY(unit: Unit): number {
    return this.mostThreatenedAlly(unit)?.y ?? unit.spec.laneY;
  }

  private incomingAt(unit: Unit): boolean {
    return this.projectiles.some(
      (shot) => shot.alive && shot.team !== unit.spec.team && shot.targetId === unit.spec.id,
    );
  }

  private checkVictory(): void {
    const leftAlive = this.units.some((u) => u.alive && u.spec.team === 0);
    const rightAlive = this.units.some((u) => u.alive && u.spec.team === 1);
    if (leftAlive && rightAlive) return;
    if (!leftAlive && !rightAlive) return;
    this.winner = leftAlive ? 0 : 1;
  }
}
