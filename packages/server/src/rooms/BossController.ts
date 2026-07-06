import {
  BOSS_ADD_CAP,
  BOSS_PRIMITIVES,
  BOSS_PROJECTILE_BUDGET,
  type BossDef,
  type BossPhase,
  type CastPlan,
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

export class BossController {
  private phaseIndex = -1;
  private modules: ModuleRuntime[] = [];

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

    this.move(boss, targets, dt, phase);
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
          this.applyPayload(rt.pending, dmgScale, sink);
          rt.pending.settled = true; // KEEP the rows one more tick (removed above next tick)
        }
        continue;
      }
      rt.cd -= dt;
      if (rt.cd > 0) continue;
      rt.cd += mod.cooldown; // += (not =) so a long frame doesn't lose accumulated overshoot
      if (rt.cd <= 0) rt.cd = mod.cooldown; // guard against a pathological dt ≥ cooldown
      this.trigger(mod, i, boss, targets, tick, dmgScale, sink);
    }
    return idx + 1;
  }

  /** Cancel any in-flight telegraphs (e.g. on boss death) so no rows are orphaned. */
  dispose(sink: BossEmitSink): void {
    for (const rt of this.modules) {
      if (rt.pending) for (const id of rt.pending.ids) sink.removeTelegraph(id);
      rt.pending = null;
    }
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
    const next =
      this.def.move === "kite"
        ? stepEnemyKite(boss, target, speed, kind?.ranged?.preferredRange ?? 360, dt)
        : // "chase" and (Slice-1) "strafe" both close in via the chase stepper.
          stepEnemyChase(boss, target, speed, dt);
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
    if (e.projectiles?.length) {
      const budget = Math.max(0, BOSS_PROJECTILE_BUDGET - sink.hostileProjectiles());
      const shots: FireSpec[] = e.projectiles.slice(0, budget);
      for (const f of shots) {
        sink.fireProjectile(f.fromX, f.fromY, f.aimX, f.aimY, f.speed, f.damage * dmgScale);
      }
    }
    if (e.aoe?.length) {
      for (const a of e.aoe) sink.applyAoE(a.x, a.y, a.radius, a.damage * dmgScale, a.knockback);
    }
    if (e.zones?.length) {
      for (const z of e.zones) sink.dropZone(z.x, z.y, z.radius, z.ttl);
    }
    if (e.adds?.length) {
      const room = Math.max(0, BOSS_ADD_CAP - sink.aliveAdds());
      const spots = e.adds.slice(0, room).map((a) => ({ x: a.x, y: a.y }));
      if (spots.length) sink.spawnAdds(pending.addKind, spots);
    }
    if (e.moveBoss) {
      // scripted reposition (dash) — Slice 2 primitives; applied directly via the sink there.
    }
  }
}
