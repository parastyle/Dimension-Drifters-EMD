import {
  type ActiveSpec,
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BOSS_ADD_CAP,
  BOSS_PRIMITIVES,
  BOSS_PROJECTILE_BUDGET,
  type BossDef,
  type BossPhase,
  type CastPlan,
  clamp,
  depthDamageScale,
  ENEMY_KINDS,
  type EnemyState,
  type FireSpec,
  makeRng,
  mixSeeds,
  nearestPoint,
  type Rng,
  stepEnemyChase,
  stepEnemyKite,
  type TgSpec,
  type Vec2,
} from "@dd/shared";

/**
 * §16 v0.109 SERVER BOSS CONTROLLER — runs a data-driven `BossDef` deterministically, replacing the
 * hardcoded `stepBoss`. One instance per live boss. It owns ONLY the boss's mutable runtime (phase index,
 * per-module cooldowns, in-flight casts) and mutates the world through an injected `BossEmitSink`, so the
 * GameRoom keeps all hit/damage plumbing. The per-step machine mirrors OLD RUST's proven telegraph→detonate
 * shape (a windup that fills a danger footprint, then a resolve that applies the payload), generalised to N
 * modules on independent cadences. The `CLASSIC_BOSS` def reproduces OLD RUST through this same machine.
 *
 * Determinism: primitives are pure and take RNG from a per-trigger seeded stream the controller mints
 * (`mixSeeds(spawnSeed, tick, moduleIndex)`), so summon/jitter positions are reproducible — no `Math.random`
 * reaches the primitive layer (purity gate). The golden-tick test never spawns a boss (bosses arrive at
 * 120s; the digest window is 3s), so this cutover cannot shift the golden snapshot.
 */

/** The emit surface the GameRoom injects. Projectile/AoE damage arriving here is ALREADY depth-scaled. */
export interface BossEmitSink {
  fireProjectile(
    x: number,
    y: number,
    aimX: number,
    aimY: number,
    speed: number,
    damage: number,
  ): void;
  /** Create a telegraph row, returns its minted id. */
  addTelegraph(spec: TgSpec): string;
  /** Update a live telegraph's fill progress (0→1). */
  setTelegraphProgress(id: string, t: number): void;
  removeTelegraph(id: string): void;
  dropZone(x: number, y: number, radius: number, ttl: number): void;
  spawnAdds(kind: string, spots: readonly Vec2[]): void;
  applyAoE(x: number, y: number, radius: number, damage: number, knockback: number): void;
  /** §33 FOOTFALL QUAKE resolve: damage grounded players in the radius, but AIRBORNE players (mid-jump) are
   *  immune and PARRYING players negate it — jump over or parry the giant's stomp. */
  applyQuake(x: number, y: number, radius: number, damage: number, knockback: number): void;
  /** Reposition/reshape a LIVE telegraph row (an active beam/ring hazard whose danger geometry moves). */
  updateTelegraphGeom(id: string, x: number, y: number, a: number, b: number, rot: number): void;
  /** Damage every living player inside an oriented rect (a beam / dash lane) + shove them perpendicular out. */
  damageRect(
    x: number,
    y: number,
    len: number,
    halfW: number,
    rot: number,
    damage: number,
    knockback: number,
  ): void;
  /** Damage every living player in an expanding ring's danger band (outside the safe gap wedge). */
  damageAnnulus(
    cx: number,
    cy: number,
    bandR: number,
    bandHalf: number,
    gapCenter: number,
    gapHalf: number,
    damage: number,
  ): void;
  /** §16 Slice 3 — resolve a PARRYABLE boss melee wedge: negate-on-parry (feed the §8 chain) else damage +
   *  shove every living player inside the arc. `damage` is ALREADY depth-scaled. */
  applyMelee(
    x: number,
    y: number,
    aimX: number,
    aimY: number,
    range: number,
    halfArc: number,
    damage: number,
    knockback: number,
  ): void;
  /** §16 Slice 3 — teleport the boss body (a blink). Snaps position; the client hard-snaps past its lerp
   *  threshold so it reads as a poof, not a glide. */
  moveBoss(x: number, y: number): void;
  /** Current live HOSTILE projectile count (boss + horde + spitters) — the budget gate reads this. */
  hostileProjectiles(): number;
  /** Current live non-boss enemy (add) count — the add-cap gate reads this. */
  aliveAdds(): number;
}

/** One in-flight cast: the telegraph rows shown during the windup + the payload to apply at resolve.
 *  `settled` = the windup finished and the payload fired; the rows LINGER one extra tick at full fill (t=1)
 *  so the client observes the completion before the rows vanish — that's how the client tells a real RESOLVE
 *  (fires the impact VFX) from a CANCEL (dispose on phase-change/death; the rows never reach t=1, no VFX). */
interface PendingCast {
  ids: string[];
  plan: CastPlan;
  remaining: number;
  windup: number;
  addKind: string;
  settled: boolean;
}

/** Per-module runtime for the active phase. `fires` is a per-module trigger counter feeding rotation
 *  primitives (spiral) + the RNG stream, so one module's cadence never perturbs another's pattern. */
interface ModuleRuntime {
  cd: number;
  pending: PendingCast | null;
  fires: number;
}

/** A LIVE active hazard (a beam sweeping, a ring expanding, the boss dashing) that deals continuous damage
 *  over its window while its synced telegraph geometry evolves. Owns the telegraph row until it expires. */
interface ActiveHazard {
  spec: ActiveSpec;
  telegraphId: string;
  elapsed: number;
}

export class BossController {
  private phaseIndex = -1;
  private modules: ModuleRuntime[] = [];
  /** §16 v0.109 Slice 2 — the boss's live beam/ring/dash hazards, advanced each tick. */
  private active: ActiveHazard[] = [];

  constructor(
    private readonly def: BossDef,
    private readonly maxHp: number,
    private readonly seed: number,
  ) {}

  /** The boss def's display name (for the boss bar). */
  get name(): string {
    return this.def.name;
  }

  /**
   * One authoritative sub-step. Selects the phase by HP fraction, moves the body, and advances each module's
   * cadence + any in-flight cast. Returns the 1-based phase number so the GameRoom can sync `bossPhase`.
   */
  step(
    dt: number,
    boss: EnemyState,
    targets: Vec2[],
    depth: number,
    tick: number,
    sink: BossEmitSink,
  ): number {
    const frac = this.maxHp > 0 ? boss.hp / this.maxHp : 1;
    const idx = this.selectPhase(frac);
    if (idx !== this.phaseIndex) this.enterPhase(idx, sink);
    const phase = this.def.phases[idx];
    if (!phase) return idx + 1;

    // A boss winding up a PARRYABLE melee arc PLANTS its feet — freeze movement so the drawn wedge and the
    // hit stay co-located (WYSIWYG) and the swing reads as a committed strike, not a moving smear.
    const planting = this.modules.some((rt) => rt.pending && !!rt.pending.plan.emits.melee?.length);
    if (!planting) this.move(boss, targets, dt, phase);
    const dmgScale = depthDamageScale(depth);

    for (let i = 0; i < this.modules.length; i++) {
      const rt = this.modules[i];
      const mod = phase.modules[i];
      if (!rt || !mod) continue;
      if (rt.pending) {
        if (rt.pending.settled) {
          // Lingered one tick at full fill so the client saw the completion — now clear the rows.
          for (const id of rt.pending.ids) sink.removeTelegraph(id);
          rt.pending = null;
          continue;
        }
        // A cast is winding up — fill its telegraphs; resolve at peak.
        rt.pending.remaining -= dt;
        const t =
          rt.pending.windup > 0
            ? Math.max(0, Math.min(1, 1 - rt.pending.remaining / rt.pending.windup))
            : 1;
        for (const id of rt.pending.ids) sink.setTelegraphProgress(id, t);
        if (rt.pending.remaining <= 0) {
          for (const id of rt.pending.ids) sink.setTelegraphProgress(id, 1); // pin full so the client edge-fires
          const act = rt.pending.plan.emits.active;
          if (act && rt.pending.ids[0]) {
            // The cast becomes a LIVE hazard: it takes over the telegraph row (kept until the hazard expires).
            this.active.push({ spec: { ...act }, telegraphId: rt.pending.ids[0], elapsed: 0 });
            rt.pending = null;
          } else {
            this.applyPayload(rt.pending, dmgScale, sink);
            rt.pending.settled = true; // KEEP the rows one more tick (removed above next tick)
          }
        }
        continue;
      }
      rt.cd -= dt;
      if (rt.cd > 0) continue;
      rt.cd += mod.cooldown; // += (not =) so a long frame doesn't lose accumulated overshoot
      if (rt.cd <= 0) rt.cd = mod.cooldown; // guard against a pathological dt ≥ cooldown
      this.trigger(mod, i, boss, targets, tick, dmgScale, sink);
    }
    this.stepActiveHazards(dt, boss, dmgScale, sink);
    return idx + 1;
  }

  /** Advance every live beam/ring/dash: evolve its geometry, sync the telegraph, hit-test players, expire it. */
  private stepActiveHazards(
    dt: number,
    boss: EnemyState,
    dmgScale: number,
    sink: BossEmitSink,
  ): void {
    if (!this.active.length) return;
    const survivors: ActiveHazard[] = [];
    for (const h of this.active) {
      h.elapsed += dt;
      const frac = h.spec.duration > 0 ? Math.min(1, h.elapsed / h.spec.duration) : 1;
      const dmg = h.spec.dps * dt * dmgScale;
      if (h.spec.kind === 0) {
        // BEAM — sweep the lane from rot0→rotEnd, damaging anyone inside.
        const rot = h.spec.rot0 + (h.spec.rotEnd - h.spec.rot0) * frac;
        sink.updateTelegraphGeom(h.telegraphId, h.spec.x, h.spec.y, h.spec.a, h.spec.b, rot);
        sink.damageRect(h.spec.x, h.spec.y, h.spec.a, h.spec.b, rot, dmg, 0);
      } else if (h.spec.kind === 1) {
        // RING — expand the damage band outward, hitting the band outside the safe gap. The telegraph row's
        // `b` carries the safe-gap HALF-WIDTH (rot = gap centre) so the client can draw the gap; the true
        // band thickness (spec.b) is only used for the server hit test.
        const bandR = h.spec.a * frac;
        sink.updateTelegraphGeom(
          h.telegraphId,
          h.spec.x,
          h.spec.y,
          bandR,
          h.spec.gapHalf,
          h.spec.gapCenter,
        );
        sink.damageAnnulus(
          h.spec.x,
          h.spec.y,
          bandR,
          h.spec.b,
          h.spec.gapCenter,
          h.spec.gapHalf,
          dmg,
        );
      } else {
        // DASH — hurtle the boss body along the fixed lane; anyone in the lane takes damage + a shove.
        const along = h.spec.a * frac;
        const r = ENEMY_KINDS[boss.kind]?.radius ?? 24;
        boss.x = clamp(h.spec.x + Math.cos(h.spec.rot0) * along, r, ARENA_WIDTH - r);
        boss.y = clamp(h.spec.y + Math.sin(h.spec.rot0) * along, r, ARENA_HEIGHT - r);
        sink.damageRect(
          h.spec.x,
          h.spec.y,
          h.spec.a,
          h.spec.b,
          h.spec.rot0,
          dmg,
          h.spec.knockback * dt,
        );
      }
      if (h.elapsed >= h.spec.duration) sink.removeTelegraph(h.telegraphId);
      else survivors.push(h);
    }
    this.active = survivors;
  }

  /** Cancel any in-flight telegraphs + live hazards (e.g. on boss death) so no rows are orphaned. */
  dispose(sink: BossEmitSink): void {
    for (const rt of this.modules) {
      if (rt.pending) for (const id of rt.pending.ids) sink.removeTelegraph(id);
      rt.pending = null;
    }
    for (const h of this.active) sink.removeTelegraph(h.telegraphId);
    this.active = [];
  }

  // ── internals ─────────────────────────────────────────────────────────────────────────────────────

  /** Active phase index for `frac`: the first phase whose floor `frac` is still above (generalises
   *  bossPhaseForHp). Phases are ordered high→low; the last (hpAbove 0) always matches. */
  private selectPhase(frac: number): number {
    for (let i = 0; i < this.def.phases.length; i++) {
      if (frac > (this.def.phases[i]?.hpAbove ?? 0)) return i;
    }
    return this.def.phases.length - 1;
  }

  /** Enter a new phase: cancel old telegraphs, rebuild module timers with their first-fire stagger. */
  private enterPhase(idx: number, sink: BossEmitSink): void {
    this.dispose(sink);
    this.phaseIndex = idx;
    const phase = this.def.phases[idx];
    this.modules = (phase?.modules ?? []).map((m) => ({
      cd: m.firstDelay ?? 0,
      pending: null,
      fires: 0,
    }));
  }

  private move(boss: EnemyState, targets: Vec2[], dt: number, phase: BossPhase): void {
    const kind = ENEMY_KINDS[boss.kind];
    const speed = (kind?.speed ?? 0) * (phase.speedMult ?? 1);
    if (speed <= 0 || this.def.move === "stationary") return;
    const target = nearestPoint(boss, targets);
    if (!target) return;
    if (this.def.move === "strafe") {
      // ORBIT the target: a radial term holds the preferred range + a tangential term circles it — so the
      // gunslinger is always sliding sideways, never chargeable head-on.
      const r = kind?.radius ?? 24;
      const pref = kind?.ranged?.preferredRange ?? 340;
      const dx = target.x - boss.x;
      const dy = target.y - boss.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      const radial = dist > pref ? 1 : dist < pref * 0.85 ? -1 : 0;
      let vx = nx * radial + -ny * 0.85; // tangential drift (fixed orbit sense)
      let vy = ny * radial + nx * 0.85;
      const vl = Math.hypot(vx, vy) || 1;
      vx /= vl;
      vy /= vl;
      boss.x = clamp(boss.x + vx * speed * dt, r, ARENA_WIDTH - r);
      boss.y = clamp(boss.y + vy * speed * dt, r, ARENA_HEIGHT - r);
      return;
    }
    const next =
      this.def.move === "kite"
        ? stepEnemyKite(boss, target, speed, kind?.ranged?.preferredRange ?? 360, dt)
        : stepEnemyChase(boss, target, speed, dt);
    boss.x = next.x;
    boss.y = next.y;
  }

  /** Fire a module: compute its cast plan ONCE (fixed coords), then either raise telegraphs + hold for the
   *  windup, or (windup ≤ 0) resolve immediately. */
  private trigger(
    mod: BossPhase["modules"][number],
    moduleIndex: number,
    boss: EnemyState,
    targets: Vec2[],
    tick: number,
    dmgScale: number,
    sink: BossEmitSink,
  ): void {
    const primitive = BOSS_PRIMITIVES[mod.primitive];
    const rt = this.modules[moduleIndex];
    if (!primitive || !rt) return;
    const kind = ENEMY_KINDS[boss.kind];
    const fire = ++rt.fires;
    const rng: Rng = makeRng(mixSeeds(this.seed, tick, moduleIndex, fire));
    const plan = primitive({
      boss: { x: boss.x, y: boss.y, kind: boss.kind, radius: kind?.radius ?? 24 },
      targets,
      rng,
      phaseTick: fire,
      params: mod.params,
    });
    const windup = mod.windup ?? 0;
    if (windup > 0) {
      const ids = plan.telegraphs.map((spec) => sink.addTelegraph(spec));
      rt.pending = {
        ids,
        plan,
        remaining: windup,
        windup,
        addKind: mod.addKind ?? "mote-swarm",
        settled: false,
      };
    } else {
      // No windup → no telegraph to linger; apply the payload immediately.
      this.applyPayload(
        {
          ids: [],
          plan,
          remaining: 0,
          windup: 0,
          addKind: mod.addKind ?? "mote-swarm",
          settled: false,
        },
        dmgScale,
        sink,
      );
    }
  }

  /** Apply a cast's payload through the sink, honouring the projectile + add budgets. Does NOT remove the
   *  telegraph rows — the step loop clears them one tick later (the settle-linger) so the client can edge-fire. */
  private applyPayload(pending: PendingCast, dmgScale: number, sink: BossEmitSink): void {
    const e = pending.plan.emits;
    // Blink FIRST so a co-emitted slam (aoe) lands at the destination the boss just teleported to.
    if (e.teleport) sink.moveBoss(e.teleport.x, e.teleport.y);
    if (e.melee?.length) {
      for (const m of e.melee) {
        sink.applyMelee(
          m.x,
          m.y,
          m.aimX,
          m.aimY,
          m.range,
          m.halfArc,
          m.damage * dmgScale,
          m.knockback,
        );
      }
    }
    if (e.projectiles?.length) {
      const budget = Math.max(0, BOSS_PROJECTILE_BUDGET - sink.hostileProjectiles());
      const shots: FireSpec[] = e.projectiles.slice(0, budget);
      for (const f of shots) {
        sink.fireProjectile(f.fromX, f.fromY, f.aimX, f.aimY, f.speed, f.damage * dmgScale);
      }
    }
    if (e.aoe?.length) {
      for (const a of e.aoe) {
        // §33 quake stomps route to the jump-or-parry path; regular slams to the dodge AoE.
        if (a.quake) sink.applyQuake(a.x, a.y, a.radius, a.damage * dmgScale, a.knockback);
        else sink.applyAoE(a.x, a.y, a.radius, a.damage * dmgScale, a.knockback);
      }
    }
    if (e.zones?.length) {
      for (const z of e.zones) sink.dropZone(z.x, z.y, z.radius, z.ttl);
    }
    if (e.adds?.length) {
      const room = Math.max(0, BOSS_ADD_CAP - sink.aliveAdds());
      const spots = e.adds.slice(0, room).map((a) => ({ x: a.x, y: a.y }));
      if (spots.length) sink.spawnAdds(pending.addKind, spots);
    }
    // `active` (beam/ring/dash) is handled in the step loop (transitioned to a live hazard), not here.
  }
}
