/**
 * SLICE 1 fight simulation — 4v4, beat-resolved, deterministic, and completely free of Phaser.
 *
 * This is the brain of the squad-autobattler direction (`docs/DESIGN_LOG.md`, 2026-07-28). It owns every
 * rule; `BattleFight.ts` only draws what it produces. Keeping the two apart is what makes the fight
 * testable without a browser — the whole 90-second encounter can be stepped in a unit test.
 *
 * THE TIME MODEL (design log, "beats, with parry and movement off-beat"):
 *   - Attacks, heals, AI decisions and stance changes resolve ONLY on beat boundaries.
 *   - Movement, projectile flight and parry are continuous.
 * That split is the point: a parry no longer needs frame-level agreement, only the right beat.
 *
 * WHY EVASION IS EMERGENT: nothing here rolls a dodge. Projectiles carry a real position and hit whatever
 * is actually standing in them on arrival. A unit that walked away is missed because it walked away. That
 * is what makes forward/back stance load-bearing rather than cosmetic — standing forward shortens your own
 * shots' flight time, so the enemy has less time to leave the spot you aimed at, and you pay the same.
 *
 * WHAT DECIDES BEHAVIOUR: abilities and stats, never role. See `battle-stats.ts` for why — the vanguard
 * subclasses coming in the design log all hold the line differently, and they must be data, not branches.
 */

import { WEAPONS, makeRng, parrySlideDistance, type Rng } from "@dd/shared";
import type { AbilityId } from "./battle-stats.js";
import type { BattleRole, BattleTeam, UnitSpec } from "./battle-roster.js";

export type { BattleRole, BattleTeam, UnitSpec };

// ---------------------------------------------------------------------------------------------
// Geometry — all values are in the stage's 3840x2160 virtual canvas space.
// ---------------------------------------------------------------------------------------------

/** The invisible boundary. Crossing it is allowed; staying across it is not (see `applyMidlineSling`). */
export const MIDLINE_X = 1920;

/** Beat length. Design log flags this as unvalidated — the first thing to feel out in playtest. */
export const BEAT_MS = 500;
const BEAT_SECONDS = BEAT_MS / 1000;

/** Home X distance from the midline per stance, before each unit's own rank offset. */
export const STANCE_PUSH_PX = 260;

/**
 * Midline spring. Cross the line and this pulls you back HARD, with enough overshoot that you are thrown
 * into your own half rather than gently parked on the boundary — the owner's "soft sling". Underdamped on
 * purpose: `SLING_DAMPING` below critical is what produces the fling.
 */
export const SLING_STIFFNESS = 34;
export const SLING_DAMPING = 3.4;
/** Hard stop on how deep anyone can wade before the spring simply refuses. Keeps the sides legible. */
export const SLING_MAX_DEPTH_PX = 190;

/** Projectile travel. Slow enough to read, rank, and physically step in front of. */
export const PROJECTILE_SPEED = 900;
/** A bolt connects when it gets this close to a hostile body. */
export const PROJECTILE_HIT_RADIUS = 62;

/** How hard B26's parry slide shoves the guard off the line it just held, per px of authored slide. */
export const PARRY_SLIDE_SHOVE = 2.6;

/** Depth band a dodge roll may use. Matches the ruin's usable stone floor — rolling into the foreground
 *  vines or off the back of the plate looks like a bug even when the sim is right. */
export const DODGE_MIN_Y = 1040;
export const DODGE_MAX_Y = 1820;

/**
 * Weapon reach is authored against the ~1200-wide arena; this stage is 3840 across and its characters are
 * drawn correspondingly larger. Scaling reach by the same factor keeps a greatsword's swing the same
 * fraction of a body here as it is there.
 */
export const WEAPON_REACH_SCALE = 3.2;
/**
 * Weapon cooldowns are authored for a real-time shooter (a third of a second is common), which is faster
 * than one beat. Stretching them onto the beat grid keeps the RELATIVE differences — a greatsword still
 * swings far slower than a nailgun — without every weapon collapsing to "once per beat".
 */
/** Raised from 3 on owner feedback that the fight read as a constant stream. Everything fires less
 *  often; the RELATIVE differences between weapons are untouched. */
export const WEAPON_CADENCE_SCALE = 4.5;
export const MIN_BEATS_PER_ACTION = 1;
export const MAX_BEATS_PER_ACTION = 5;
/**
 * Catalog damage is authored for the arena, where a weapon fires several times a second. Here a unit acts
 * once every beat or two, so the same numbers produced a fight that never resolved — a 120-second live run
 * ended with five units alive on single-digit HP, medics out-healing the chip damage indefinitely.
 *
 * ONE scalar, applied to every weapon equally, so the relative differences the catalog encodes survive
 * intact. If the fight needs to be longer or shorter, this is the dial — not per-weapon edits.
 */
export const WEAPON_DAMAGE_SCALE = 5;

/**
 * Sudden death. From this beat onward every hit lands harder, ramping without limit.
 *
 * Two medics healing a thinned field can out-pace the surviving chip damage forever: a 150-seed sweep had
 * ~9% of fights still running at a five-minute cap. A fight that cannot end is worse than an unfair one —
 * it is the only outcome with no information in it. The ramp is late enough that a normal ~35-second fight
 * never sees it, so this decides stalemates without touching ordinary pacing.
 */
export const SUDDEN_DEATH_BEAT = 90;
export const SUDDEN_DEATH_RAMP_PER_BEAT = 0.03;

export type Stance = "forward" | "hold" | "back";

/** What the player is doing with the unit they took over. Continuous, never beat-quantised. */
export interface PlayerIntent {
  moveX: number;
  moveY: number;
  /** Held guard. A taken-over unit only parries while this is true — see `tryParry`. */
  parry: boolean;
}

/** The numbers a unit's weapon contributes. Derived once at construction. */
export interface WeaponProfile {
  readonly damage: number;
  readonly beatsPerAction: number;
  readonly reach: number;
}

export interface Unit {
  readonly spec: UnitSpec;
  readonly weapon: WeaponProfile;
  hp: number;
  x: number;
  y: number;
  /** Depth row the unit is walking toward. Only `interpose` units ever change it. */
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
  /** True when the player has taken this unit over. */
  controlled: boolean;
  /** Dodge roll: active until this timestamp, rolling in `dodgeDirY`. */
  dodgeUntilMs: number;
  dodgeReadyAtMs: number;
  dodgeDirY: number;
}

export interface Projectile {
  readonly id: number;
  readonly team: BattleTeam;
  readonly ownerId: string;
  /** Who it was aimed at when fired. Drives the "that one's for your healer" telegraph. */
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
  | {
      readonly type: "heal";
      readonly unitId: string;
      readonly targetId: string;
      readonly amount: number;
    }
  | {
      readonly type: "hit";
      readonly unitId: string;
      readonly amount: number;
      readonly fromX: number;
      readonly fromY: number;
    }
  | {
      readonly type: "parry";
      readonly unitId: string;
      readonly fromX: number;
      readonly fromY: number;
      readonly damage: number;
      readonly byPlayer: boolean;
    }
  | { readonly type: "dodge"; readonly unitId: string; readonly dirY: number }
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
  readonly seed: number;
}

function has(unit: Unit, ability: AbilityId): boolean {
  return unit.spec.abilities.includes(ability);
}

/**
 * Turn a catalog weapon into fight numbers. This is what makes the 395-weapon catalog mechanical rather
 * than cosmetic: a Tombstone Greatsword genuinely hits harder and slower than a Nailgun because those are
 * the values the weapon already ships with.
 */
export function weaponProfile(spec: UnitSpec): WeaponProfile {
  const def = WEAPONS[spec.weaponId];
  const stats = spec.stats;
  const cooldownSeconds = (def?.cooldown ?? 0.5) * WEAPON_CADENCE_SCALE * stats.focus;
  const beats = Math.round(cooldownSeconds / BEAT_SECONDS);
  return {
    damage: (def?.damage ?? 5) * WEAPON_DAMAGE_SCALE * stats.might,
    beatsPerAction: Math.min(MAX_BEATS_PER_ACTION, Math.max(MIN_BEATS_PER_ACTION, beats)),
    reach: (def?.range ?? 100) * WEAPON_REACH_SCALE,
  };
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
  readonly seed: number;

  private readonly rng: Rng;
  private readonly events: BattleEvent[] = [];
  private readonly intent: PlayerIntent = { moveX: 0, moveY: 0, parry: false };
  private controlledId: string | undefined;
  private elapsedMs = 0;
  private beatClockMs = 0;
  private beatIndex = 0;
  private nextProjectileId = 1;
  private winner: BattleTeam | undefined;

  constructor(specs: readonly UnitSpec[], seed = 0xd0d0) {
    this.seed = seed;
    this.rng = makeRng(seed);
    specs.forEach((spec, index) => {
      const weapon = weaponProfile(spec);
      this.units.push({
        spec,
        weapon,
        hp: spec.stats.maxHp,
        x: stanceHomeX(spec, "hold"),
        y: spec.laneY,
        targetY: spec.laneY,
        vx: 0,
        stance: "hold",
        alive: true,
        beatPhase: index % weapon.beatsPerAction,
        parryReadyAtMs: 0,
        slung: false,
        controlled: false,
        dodgeUntilMs: 0,
        dodgeReadyAtMs: 0,
        dodgeDirY: 0,
      });
    });
  }

  // -------------------------------------------------------------------------------------------
  // Takeover
  // -------------------------------------------------------------------------------------------

  /** Hand one unit to the player, or pass `undefined` to give everything back to the AI. */
  setControlled(id: string | undefined): void {
    this.controlledId = id;
    for (const unit of this.units) unit.controlled = unit.spec.id === id && unit.alive;
  }

  get controlled(): Unit | undefined {
    return this.units.find((u) => u.controlled);
  }

  setIntent(moveX: number, moveY: number, parry: boolean): void {
    this.intent.moveX = moveX;
    this.intent.moveY = moveY;
    this.intent.parry = parry;
  }

  // -------------------------------------------------------------------------------------------

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
      seed: this.seed,
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
      this.tryDodge(unit);
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

  /**
   * Walk toward the stance position — or, for the unit the player took over, wherever they are steering.
   * Movement is positional, so being slung never fights the walk: the spring velocity is added on top and
   * bleeds away on its own.
   */
  /**
   * Read the incoming fire and roll out of the way.
   *
   * Sideways only, and always back toward the home row afterwards, so a squad keeps its formation over a
   * whole fight instead of scattering — the roll buys one bolt, it does not relocate anybody. The cooldown
   * is what keeps this from deleting ranged damage: a unit under sustained fire dodges the first bolt and
   * eats the next.
   *
   * The reaction window is a stat, so a twitchy sniper genuinely reads shots earlier than a slab of a
   * vanguard. Nothing here rolls dice — the bolt is dodged because the body physically left the line.
   */
  private tryDodge(unit: Unit): void {
    if (unit.controlled) return; // the player dodges by walking; we never steer for them
    if (this.elapsedMs < unit.dodgeReadyAtMs) return;
    if (this.elapsedMs < unit.dodgeUntilMs) return;

    const stats = unit.spec.stats;
    if (stats.dodgeSpeed <= 0) return;

    for (const shot of this.projectiles) {
      if (!shot.alive || shot.team === unit.spec.team) continue;
      const speed = Math.hypot(shot.vx, shot.vy);
      if (speed <= 1) continue;
      const eta = (Math.hypot(unit.x - shot.x, unit.y - shot.y) - PROJECTILE_HIT_RADIUS) / speed;
      if (eta < 0 || eta > stats.dodgeReactionSeconds) continue;
      // Where the bolt will be when it draws level — if that misses us anyway, do not waste the roll.
      const closingY = shot.y + shot.vy * eta;
      const closingX = shot.x + shot.vx * eta;
      if (Math.hypot(closingX - unit.x, closingY - unit.y) > PROJECTILE_HIT_RADIUS * 1.6) continue;

      // Roll AWAY from the bolt's line, and away from the stage edge if we are already near one.
      let dir = unit.y >= closingY ? 1 : -1;
      const projected = unit.y + dir * stats.dodgeSpeed * (stats.dodgeDurationMs / 1000);
      if (projected < DODGE_MIN_Y || projected > DODGE_MAX_Y) dir = -dir;

      unit.dodgeDirY = dir;
      unit.dodgeUntilMs = this.elapsedMs + stats.dodgeDurationMs;
      unit.dodgeReadyAtMs = this.elapsedMs + stats.dodgeCooldownMs;
      this.events.push({ type: "dodge", unitId: unit.spec.id, dirY: dir });
      return;
    }
  }

  /** True while the roll is airborne — the renderer shows the authored roll pose for exactly this window. */
  isDodging(unit: Unit): boolean {
    return this.elapsedMs < unit.dodgeUntilMs;
  }

  private moveUnit(unit: Unit, dt: number): void {
    const stride = unit.spec.stats.speed * dt;
    if (unit.controlled) {
      const { moveX, moveY } = this.intent;
      const length = Math.hypot(moveX, moveY);
      if (length > 0.001) {
        unit.x += (moveX / length) * stride;
        unit.y += (moveY / length) * stride;
      }
      unit.x += unit.vx * dt;
      return;
    }

    const home = stanceHomeX(unit.spec, unit.stance);
    const delta = home - unit.x;
    unit.x += Math.abs(delta) <= stride ? delta : Math.sign(delta) * stride;
    unit.x += unit.vx * dt;

    // A roll owns the depth axis while it lasts, then ordinary lane homing walks the unit back — which is
    // exactly what keeps the formation intact across a long fight.
    if (this.isDodging(unit)) {
      unit.y = Math.min(
        DODGE_MAX_Y,
        Math.max(DODGE_MIN_Y, unit.y + unit.dodgeDirY * unit.spec.stats.dodgeSpeed * dt),
      );
      return;
    }

    // Lateral escort. Only an interposing unit leaves its row, and only to get into a line it means to
    // block.
    const deltaY = unit.targetY - unit.y;
    if (Math.abs(deltaY) > 0.01) {
      unit.y += Math.abs(deltaY) <= stride ? deltaY : Math.sign(deltaY) * stride;
    }
  }

  /**
   * The invisible boundary. You may cross — nothing blocks you — but the moment you do, a spring winds up
   * behind you and throws you back into your own half. Underdamped so you overshoot home rather than
   * settling on the line, which is what makes it read as a sling instead of a wall.
   */
  private applyMidlineSling(unit: Unit, dt: number): void {
    const depth = midlineDepth(unit);
    if (depth <= 0) {
      unit.slung = false;
      // Bleed leftover throw velocity once safely home so it cannot accumulate across crossings.
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
   * Parry by INTERPOSITION (design log, 2026-07-28): you do not click a parry, you stand in the line.
   *
   * The AI catches anything that passes inside its reach. A unit the PLAYER has taken over must also be
   * holding guard — being in the right place is necessary either way, but a human gets the extra demand of
   * committing, which is the only thing that makes taking over a skill rather than a downgrade.
   */
  private tryParry(shot: Projectile): boolean {
    for (const unit of this.units) {
      if (!unit.alive || !has(unit, "interpose")) continue;
      if (unit.spec.team === shot.team) continue; // only defends against the OTHER side
      if (this.elapsedMs < unit.parryReadyAtMs) continue;
      if (unit.controlled && !this.intent.parry) continue;
      if (Math.hypot(unit.x - shot.x, unit.y - shot.y) > unit.spec.stats.parryReach) continue;
      shot.alive = false;
      unit.parryReadyAtMs = this.elapsedMs + unit.spec.stats.parryCooldownMs;
      // B26's knockback slide, as a real cost: catching a bolt shoves you off the line you were holding,
      // so back-to-back parries on the same lane are not free. The shove is damped by the midline spring's
      // ordinary velocity bleed, so it eases out rather than snapping.
      unit.vx += (unit.spec.team === 0 ? -1 : 1) * parrySlideDistance(shot.damage) * PARRY_SLIDE_SHOVE;
      this.events.push({
        type: "parry",
        unitId: unit.spec.id,
        fromX: shot.vx,
        fromY: shot.vy,
        damage: shot.damage,
        byPlayer: unit.controlled,
      });
      return true;
    }
    return false;
  }

  /** 1 until `SUDDEN_DEATH_BEAT`, then climbing — the anti-stalemate ramp. */
  private suddenDeathMultiplier(): number {
    const over = this.beatIndex - SUDDEN_DEATH_BEAT;
    return over <= 0 ? 1 : 1 + over * SUDDEN_DEATH_RAMP_PER_BEAT;
  }

  private damage(unit: Unit, amount: number, fromX: number, fromY: number): void {
    const scaled = amount * this.suddenDeathMultiplier();
    const taken = Math.max(1, Math.round(scaled * unit.spec.stats.guard));
    unit.hp -= taken;
    this.events.push({ type: "hit", unitId: unit.spec.id, amount: taken, fromX, fromY });
    if (unit.hp > 0) return;
    unit.hp = 0;
    unit.alive = false;
    unit.controlled = false;
    this.events.push({ type: "death", unitId: unit.spec.id });
  }

  // -------------------------------------------------------------------------------------------
  // Beat resolution
  // -------------------------------------------------------------------------------------------

  private resolveBeat(): void {
    // Alternate the resolution order every beat.
    //
    // Actions apply immediately, so whoever is iterated first lands damage first and wins any mutual kill.
    // With a fixed order that is a permanent advantage for the team listed first: a 150-seed sweep of two
    // IDENTICAL mirrored squads came out 77-58 for team 0. Flipping each beat cancels it without needing a
    // snapshot-and-commit pass, and keeps the sim deterministic.
    const order =
      this.beatIndex % 2 === 0 ? this.units : [...this.units].reverse();
    for (const unit of order) {
      if (!unit.alive) continue;
      // A taken-over unit still fights on the beat; the player owns its FEET and its guard, not its
      // trigger. Takeover is meant to be a positioning skill, not a second job of clicking attack.
      if (!unit.controlled) {
        unit.stance = this.decideStance(unit);
        if (has(unit, "interpose")) unit.targetY = this.escortLaneY(unit);
      }
      if ((this.beatIndex + unit.beatPhase) % unit.weapon.beatsPerAction !== 0) continue;
      // Healing outranks everything, but a medic with nothing to heal falls through and uses its staff.
      if (has(unit, "mend") && this.actMend(unit)) continue;
      if (has(unit, "volley")) this.actVolley(unit);
      else if (has(unit, "strike")) this.actStrike(unit);
    }
  }

  /**
   * The positional AI. Every role answers the same question — press or protect — with its own bias.
   * Forward buys pressure (shorter flight time on your own shots) and pays for it in exposure.
   */
  private decideStance(unit: Unit): Stance {
    const healthFrac = unit.hp / unit.spec.stats.maxHp;
    if (has(unit, "interpose")) {
      // The nanny. It walks toward whatever is being shot at, because interposition is its whole job.
      const threatened = this.mostThreatenedAlly(unit);
      if (threatened && !has(threatened, "interpose")) return "forward";
      return healthFrac < 0.3 ? "hold" : "forward";
    }
    if (has(unit, "mend")) {
      // Hangs back until someone it must reach has drifted out of range, then commits.
      const patient = this.lowestAlly(unit);
      if (!patient) return "back";
      return Math.abs(patient.x - unit.x) > unit.spec.stats.mendRange ? "forward" : "back";
    }
    // DPS presses while healthy and safe, retreats when hurt or when a bolt is inbound at it.
    if (healthFrac < 0.45) return "back";
    return this.incomingAt(unit) ? "back" : "forward";
  }

  private actVolley(unit: Unit): void {
    const target = this.pickVolleyTarget(unit);
    if (!target) return;
    const dx = target.x - unit.x;
    const dy = target.y - unit.y;
    const length = Math.hypot(dx, dy) || 1;
    // A small authored spread so two DPS on one target do not fire identical lines. Seeded, never
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
      damage: unit.weapon.damage,
      alive: true,
    });
    this.events.push({ type: "attack", unitId: unit.spec.id, targetId: target.spec.id });
  }

  /** Melee only lands on someone inside the WEAPON's reach — which, with the midline in the way, means the
   *  enemy vanguard pressing forward at the same time. Two tanks meeting at the line is the intended
   *  picture, and a longer weapon genuinely reaches further to make it. */
  private actStrike(unit: Unit): void {
    const target = this.pickNearest(unit);
    if (!target) return;
    // The swing ALWAYS happens; only the damage is gated on reach. A melee unit that only animated when it
    // could connect stood frozen for most of the fight, which read as "the fighters do nothing" — and a
    // whiffed swing is honest information: you can see he is trying and falling short.
    this.events.push({ type: "attack", unitId: unit.spec.id, targetId: target.spec.id });
    if (Math.hypot(target.x - unit.x, target.y - unit.y) > unit.weapon.reach) return;
    this.damage(target, unit.weapon.damage, Math.sign(target.x - unit.x), 0);
  }

  /** Returns whether a heal actually happened, so the caller can fall through to attacking. */
  private actMend(unit: Unit): boolean {
    const patient = this.lowestAlly(unit);
    if (!patient || patient.hp >= patient.spec.stats.maxHp) return false;
    if (Math.abs(patient.x - unit.x) > unit.spec.stats.mendRange) return false;
    const amount = Math.min(unit.spec.stats.mend, patient.spec.stats.maxHp - patient.hp);
    if (amount <= 0) return false;
    patient.hp += amount;
    this.events.push({ type: "heal", unitId: unit.spec.id, targetId: patient.spec.id, amount });
    return true;
  }

  // -------------------------------------------------------------------------------------------
  // Target selection
  // -------------------------------------------------------------------------------------------

  /** Nearest living enemy. Melee can only hit what it can reach, so proximity IS the decision. */
  private pickNearest(unit: Unit): Unit | undefined {
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
   * nearest enemy — always the opposing vanguard — so every bolt landed on a tank, the backline was never
   * in danger, and the vanguard had nothing to protect. That deletes the entire premise: the design log
   * calls telegraphing a bolt's TARGET "the single most important piece of UI in the design", and there is
   * nothing to read if every bolt is for the tank standing in front of you.
   */
  private pickVolleyTarget(unit: Unit): Unit | undefined {
    const worth: Record<BattleRole, number> = { medic: 2.6, ranged: 2, vanguard: 1 };
    let best: Unit | undefined;
    let bestScore = -1;
    for (const other of this.units) {
      if (!other.alive || other.spec.team === unit.spec.team) continue;
      const distance = Math.hypot(other.x - unit.x, other.y - unit.y);
      // Bolts already committed to a target make it a WORSE pick. Without this every DPS converges on the
      // single juiciest enemy, both vanguards park in that one row forever, and the other lanes are never
      // threatened — a stable, one-note fight. Spreading fire is what forces the guard to choose a line.
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
    let bestFrac = Number.POSITIVE_INFINITY;
    for (const other of this.units) {
      if (!other.alive || other.spec.team !== unit.spec.team) continue;
      const frac = other.hp / other.spec.stats.maxHp;
      if (frac >= bestFrac) continue;
      bestFrac = frac;
      best = other;
    }
    return best;
  }

  /**
   * The ally about to be hit soonest. This is what pulls the guard out of position, so "soonest" matters
   * rather than "first in the array" — it should commit to the bolt it can still reach.
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
   * Where an interposing unit should stand, in depth.
   *
   * Parry is by interposition, so a guard welded to its own row can only ever block bolts already headed at
   * its row. In the first live build the rows were ~180px apart and the reach 150px, making it
   * geometrically impossible — the mechanic existed and could never fire. Letting only interposing units
   * change rows fixes that without weakening the constraint that matters: one guard still cannot be in two
   * lines at once, so covering the medic means abandoning the sniper.
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
