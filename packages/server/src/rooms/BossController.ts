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
  type SegmentedBossActionModuleDef,
  type SegmentedBossActionPhaseDef,
  stepEnemyChase,
  stepEnemyKite,
  type TgSpec,
  type Vec2,
  WormActionKind,
  WormArmorBand,
  type WormBossState,
  WormBossMode,
  WormChain,
  type WormEncounterDef,
  WORM_ANATOMY_XP_CAP,
  WORM_BASE_SPEED,
  WORM_CONTACT_EPOCH_TICKS,
  WORM_DIVE_TICKS,
  WORM_ERUPTION_CLAIM_TICKS,
  WORM_ERUPTION_RADIUS,
  WORM_MAX_SEGMENTS,
  WORM_MAX_TURN_RADIANS_PER_SECOND,
  WORM_MISSING_SEGMENT_SPEED_BONUS,
  WORM_MISSING_SEGMENT_SPEED_CAP,
  WORM_PATH_HISTORY_CAPACITY,
  WORM_PATH_OVERLAP_FACTOR,
  WORM_POSE_PUBLISH_TICKS,
  WORM_RECONNECT_CATCHUP_PX,
  WORM_RECONNECT_TICKS,
  WORM_REGROW_TICKS,
  WormSegmentCondition,
  WormSegmentMode,
  WormSegmentRole,
  WormSegmentState,
  WORM_SPLIT_PUNISH_TICKS,
  WORM_SPLIT_TICKS,
  WORM_START_SEGMENTS,
  WORM_SURFACE_ARM_GRACE_TICKS,
  WORM_UNDERGROUND_MAX_TICKS,
  WORM_UNDERGROUND_MIN_TICKS,
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
  /** Clamp a committed worm emergence to valid solid ground. Omitted by unit-test sinks. */
  validateWormPoint?(x: number, y: number, radius: number): Vec2;
}

/** One in-flight cast: the telegraph rows shown during the windup + the payload to apply at resolve.
 *  `settledBroadcastGeneration` = the windup finished and the payload fired; the rows LINGER at full fill
 *  (t=1) until that generation has been broadcast so the client observes the completion before they vanish.
 *  That's how the client tells a real RESOLVE (fires the impact VFX) from a CANCEL (dispose on phase-change/
 *  death; the rows never reach t=1, no VFX). */
interface PendingCast {
  ids: string[];
  plan: CastPlan;
  remaining: number;
  windup: number;
  addKind: string;
  settledBroadcastGeneration: number | null;
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

const WORM_INITIAL_ROLES = new Uint8Array([
  WormSegmentRole.Head,
  WormSegmentRole.Neck,
  WormSegmentRole.Body,
  WormSegmentRole.Spinner,
  WormSegmentRole.Body,
  WormSegmentRole.Body,
  WormSegmentRole.Spinner,
  WormSegmentRole.Body,
  WormSegmentRole.Body,
  WormSegmentRole.Tail,
  WormSegmentRole.Body,
  WormSegmentRole.Body,
]);

interface WormDamageLedgerEntry {
  lastTick: number;
  rawMax: number;
  maxCoreMultiplier: number;
  coreBooked: number;
  contactMask: number;
  localContacts: number;
}

export interface WormDamageResult {
  accepted: boolean;
  coreDamage: number;
  destroyedMask: number;
  rewardValue: number;
  terminal: boolean;
}

/** Circular, cumulative-distance polyline. Every follower samples the current-tick head history. */
class WormPathHistory {
  private readonly xs = new Float64Array(WORM_PATH_HISTORY_CAPACITY);
  private readonly ys = new Float64Array(WORM_PATH_HISTORY_CAPACITY);
  private readonly distances = new Float64Array(WORM_PATH_HISTORY_CAPACITY);
  private write = -1;
  private count = 0;

  clear(): void {
    this.write = -1;
    this.count = 0;
  }

  append(x: number, y: number): void {
    const previous = this.write;
    this.write = (this.write + 1) % WORM_PATH_HISTORY_CAPACITY;
    const cumulative =
      previous >= 0
        ? this.distances[previous]! + Math.hypot(x - this.xs[previous]!, y - this.ys[previous]!)
        : 0;
    this.xs[this.write] = x;
    this.ys[this.write] = y;
    this.distances[this.write] = cumulative;
    this.count = Math.min(WORM_PATH_HISTORY_CAPACITY, this.count + 1);
  }

  seedStraight(x: number, y: number, heading: number, retainedDistance: number): void {
    this.clear();
    const step = 6;
    const points = Math.min(
      WORM_PATH_HISTORY_CAPACITY,
      Math.max(2, Math.ceil(retainedDistance / step) + 1),
    );
    for (let i = points - 1; i >= 0; i--) {
      const d = (i / (points - 1)) * retainedDistance;
      this.append(x - Math.cos(heading) * d, y - Math.sin(heading) * d);
    }
  }

  sampleBehind(distance: number, out: Float64Array): void {
    if (this.write < 0 || this.count === 0) {
      out[0] = 0;
      out[1] = 0;
      return;
    }
    const newest = this.write;
    const target = this.distances[newest]! - Math.max(0, distance);
    let newer = newest;
    for (let age = 1; age < this.count; age++) {
      const older = (newest - age + WORM_PATH_HISTORY_CAPACITY) % WORM_PATH_HISTORY_CAPACITY;
      const olderD = this.distances[older]!;
      if (olderD <= target) {
        const newerD = this.distances[newer]!;
        const span = Math.max(1e-9, newerD - olderD);
        const f = clamp((target - olderD) / span, 0, 1);
        out[0] = this.xs[older]! + (this.xs[newer]! - this.xs[older]!) * f;
        out[1] = this.ys[older]! + (this.ys[newer]! - this.ys[older]!) * f;
        return;
      }
      newer = older;
    }
    out[0] = this.xs[newer]!;
    out[1] = this.ys[newer]!;
  }
}

/** Server-private fixed arrays and deterministic topology/motion operations for Serraketh. */
export class WormBossRuntime {
  readonly active = new Uint8Array(WORM_MAX_SEGMENTS);
  readonly targetable = new Uint8Array(WORM_MAX_SEGMENTS);
  readonly collidable = new Uint8Array(WORM_MAX_SEGMENTS);
  readonly underground = new Uint8Array(WORM_MAX_SEGMENTS);
  readonly rewardPaid = new Uint8Array(WORM_MAX_SEGMENTS);
  readonly role = new Uint8Array(WORM_MAX_SEGMENTS);
  readonly condition = new Uint8Array(WORM_MAX_SEGMENTS);
  readonly armorBand = new Uint8Array(WORM_MAX_SEGMENTS);
  readonly generation = new Uint16Array(WORM_MAX_SEGMENTS);
  readonly chain = new Uint8Array(WORM_MAX_SEGMENTS);
  readonly ordinal = new Uint8Array(WORM_MAX_SEGMENTS);
  readonly localHp = new Float64Array(WORM_MAX_SEGMENTS);
  readonly localMaxHp = new Float64Array(WORM_MAX_SEGMENTS);
  readonly armorHp = new Float64Array(WORM_MAX_SEGMENTS);
  readonly armorMaxHp = new Float64Array(WORM_MAX_SEGMENTS);
  readonly x = new Float64Array(WORM_MAX_SEGMENTS);
  readonly y = new Float64Array(WORM_MAX_SEGMENTS);
  readonly previousX = new Float64Array(WORM_MAX_SEGMENTS);
  readonly previousY = new Float64Array(WORM_MAX_SEGMENTS);
  readonly radius = new Float64Array(WORM_MAX_SEGMENTS);

  private readonly mainOrder = new Int8Array(WORM_MAX_SEGMENTS);
  private readonly stubOrder = new Int8Array(WORM_MAX_SEGMENTS);
  private mainCountValue = 0;
  private stubCountValue = 0;
  private readonly reconnectUntil = new Uint32Array(WORM_MAX_SEGMENTS);
  /** Temporary parry payoffs by stable slot; no per-tick allocation. */
  private readonly actionExposureUntil = new Uint32Array(WORM_MAX_SEGMENTS);
  private readonly sample = new Float64Array(2);
  private readonly mainPath = new WormPathHistory();
  private readonly stubPath = new WormPathHistory();
  private readonly damageLedger = new Map<string, WormDamageLedgerEntry>();
  private heading = 0;
  private stubHeading = 0;
  private splitEverValue = false;
  private regrowEverValue = false;
  private budMask = 0;
  private regrowResolveTick = 0;
  private diveStartTick = 0;
  private undergroundStartTick = 0;
  private undergroundEndTick = 0;
  private emergeStartTick = 0;
  private emergeEndTick = 0;
  private armGraceEndTick = 0;
  private entryX = 0;
  private entryY = 0;
  private exitX = 0;
  private exitY = 0;
  private headExposedUntilTick = 0;
  private pendingRewardValue = 0;
  private pendingRewardX = 0;
  private pendingRewardY = 0;
  private anatomyXpPaid = 0;
  private topologyCommitTick = -1;

  constructor(
    readonly state: WormBossState,
    private readonly def: WormEncounterDef,
    readonly maxHp: number,
    private readonly seed: number,
    ownerId: string,
    spawnX: number,
    spawnY: number,
    heading: number,
    tick: number,
  ) {
    this.heading = Number.isFinite(heading) ? heading : 0;
    state.active = true;
    state.ownerId = ownerId;
    state.mode = WormBossMode.Surface;
    state.splitActive = false;
    state.splitExpireTick = 0;
    while (state.segments.length < WORM_MAX_SEGMENTS) {
      const row = new WormSegmentState();
      row.slot = state.segments.length;
      state.segments.push(row);
    }
    for (let slot = 0; slot < WORM_MAX_SEGMENTS; slot++) {
      const role = (WORM_INITIAL_ROLES[slot] ?? WormSegmentRole.Body) as WormSegmentRole;
      const anatomy = def.anatomy[role];
      this.role[slot] = role;
      this.radius[slot] = anatomy.radius;
      this.localMaxHp[slot] = Math.max(1, maxHp * anatomy.localHpFraction);
      this.localHp[slot] = this.localMaxHp[slot]!;
      this.armorMaxHp[slot] = Math.max(0, maxHp * anatomy.armorHpFraction);
      this.armorHp[slot] = this.armorMaxHp[slot]!;
      this.condition[slot] = WormSegmentCondition.Intact;
      this.armorBand[slot] =
        this.armorMaxHp[slot]! > 0 ? WormArmorBand.Plated : WormArmorBand.None;
      if (slot < WORM_START_SEGMENTS) {
        this.active[slot] = 1;
        this.targetable[slot] = 1;
        this.generation[slot] = 1;
        this.mainOrder[this.mainCountValue++] = slot;
        this.setSlotMode(slot, WormSegmentMode.Surface, tick);
      } else {
        // Dormant regrowth-only slots never mint first-break XP.
        this.rewardPaid[slot] = 1;
        this.setSlotMode(slot, WormSegmentMode.Dormant, tick);
      }
    }
    this.mainPath.seedStraight(spawnX, spawnY, this.heading, 1400);
    this.x[0] = spawnX;
    this.y[0] = spawnY;
    this.solveChain(this.mainOrder, this.mainCountValue, this.mainPath, tick, false);
    this.previousX.set(this.x);
    this.previousY.set(this.y);
    this.commitTopology((1 << WORM_START_SEGMENTS) - 1, tick);
  }

  get mode(): WormBossMode {
    return this.state.mode as WormBossMode;
  }

  get activeCount(): number {
    return this.mainCountValue + this.stubCountValue;
  }

  get mainCount(): number {
    return this.mainCountValue;
  }

  get stubCount(): number {
    return this.stubCountValue;
  }

  get activeBudCount(): number {
    let n = 0;
    for (let slot = 0; slot < WORM_MAX_SEGMENTS; slot++) if ((this.budMask & (1 << slot)) !== 0) n++;
    return n;
  }

  get effectiveBodyCount(): number {
    return this.activeCount + this.activeBudCount;
  }

  get splitEver(): boolean {
    return this.splitEverValue;
  }

  get regrowEver(): boolean {
    return this.regrowEverValue;
  }

  orderSlot(chain: WormChain, index: number): number {
    if (index < 0) return -1;
    return chain === WormChain.Main
      ? index < this.mainCountValue
        ? this.mainOrder[index]!
        : -1
      : index < this.stubCountValue
        ? this.stubOrder[index]!
        : -1;
  }

  isBud(slot: number): boolean {
    return slot >= 0 && slot < WORM_MAX_SEGMENTS && (this.budMask & (1 << slot)) !== 0;
  }

  isTargetable(slot: number): boolean {
    return slot >= 0 && slot < WORM_MAX_SEGMENTS && this.targetable[slot] === 1;
  }

  segmentGeneration(slot: number): number {
    return this.generation[slot] ?? 0;
  }

  segmentRadius(slot: number): number {
    return this.radius[slot] ?? 0;
  }

  /** Round-robin lookup of a live surface anatomy emitter. Destroyed/replaced generations never qualify. */
  findActionEmitter(role: WormSegmentRole, afterSlot: number): number {
    for (let offset = 1; offset <= WORM_MAX_SEGMENTS; offset++) {
      const slot = (afterSlot + offset + WORM_MAX_SEGMENTS) % WORM_MAX_SEGMENTS;
      if (
        this.active[slot] === 1 &&
        this.targetable[slot] === 1 &&
        this.underground[slot] === 0 &&
        this.role[slot] === role
      ) return slot;
    }
    return -1;
  }

  beginAuthoredAction(
    kind: WormActionKind,
    startTick: number,
    resolveTick: number,
    endTick: number,
    emitterSlot: number,
    targetX: number,
    targetY: number,
  ): boolean {
    if (
      this.mode !== WormBossMode.Surface ||
      this.state.actionKind !== WormActionKind.None ||
      !this.isActionEmitterValid(emitterSlot, this.generation[emitterSlot] ?? 0)
    ) return false;
    this.setAction(kind, startTick, resolveTick, endTick, emitterSlot, targetX, targetY);
    this.publish(true, startTick);
    return true;
  }

  isActionEmitterValid(slot: number, generation: number): boolean {
    return (
      slot >= 0 &&
      slot < WORM_MAX_SEGMENTS &&
      this.active[slot] === 1 &&
      this.targetable[slot] === 1 &&
      this.underground[slot] === 0 &&
      this.generation[slot] === generation
    );
  }

  endAuthoredAction(kind: WormActionKind, tick: number): void {
    if (this.state.actionKind === kind) this.clearAction(tick);
  }

  exposeActionEmitter(tick: number, durationTicks: number): boolean {
    const slot = this.state.actionEmitterSlot;
    if (!this.isActionEmitterValid(slot, this.state.actionEmitterGeneration)) return false;
    this.exposeSegment(slot, tick + durationTicks, tick);
    return true;
  }

  exposeHead(tick: number, durationTicks: number): void {
    if (this.active[0]) this.exposeSegment(0, tick + durationTicks, tick);
  }

  segmentIntersectsSweptCircle(slot: number, px: number, py: number, extraRadius: number): boolean {
    return this.segmentIntersectsSweptCapsule(slot, px, py, px, py, extraRadius);
  }

  /** Continuous 20 Hz contact between a moving segment and a moving projectile/capsule centre. */
  segmentIntersectsSweptCapsule(
    slot: number,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    extraRadius: number,
  ): boolean {
    if (!this.isTargetable(slot)) return false;
    // In relative coordinates the segment is stationary at the origin and the projectile travels from
    // (projectilePrev - segmentPrev) to (projectileNow - segmentNow). The closest point is the exact
    // same-tick continuous collision test, so neither fast shots nor lateral segment motion can tunnel.
    const ax = fromX - this.previousX[slot]!;
    const ay = fromY - this.previousY[slot]!;
    const bx = toX - this.x[slot]!;
    const by = toY - this.y[slot]!;
    const vx = bx - ax;
    const vy = by - ay;
    const vv = vx * vx + vy * vy;
    const t = vv > 1e-9 ? clamp(-(ax * vx + ay * vy) / vv, 0, 1) : 0;
    const dx = ax + vx * t;
    const dy = ay + vy * t;
    const reach = this.radius[slot]! + Math.max(0, extraRadius);
    return dx * dx + dy * dy <= reach * reach;
  }

  /** Advances motion/topology once. Returns true when EruptionClaim began this tick. */
  advance(dt: number, boss: EnemyState, targets: Vec2[], tick: number): boolean {
    this.previousX.set(this.x);
    this.previousY.set(this.y);
    this.expireReconnects(tick);
    this.expireHeadExposure(tick);
    this.expireActionExposures(tick);
    const before = this.mode;
    switch (before) {
      case WormBossMode.Surface:
      case WormBossMode.SurfaceArmGrace:
        this.stepSurface(dt, boss, targets, tick);
        if (before === WormBossMode.SurfaceArmGrace && tick >= this.armGraceEndTick) {
          this.setSurface(tick);
        }
        break;
      case WormBossMode.Split:
        this.stepSurface(dt, boss, targets, tick);
        this.stepStub(dt, tick);
        if (this.state.splitActive && tick >= this.state.splitExpireTick) this.rejoinStub(tick);
        break;
      case WormBossMode.Regrow:
        if (tick >= this.regrowResolveTick) this.resolveRegrow(tick);
        break;
      case WormBossMode.DiveWindup:
      case WormBossMode.Submerging:
        this.stepSurface(dt * 0.65, boss, targets, tick);
        this.stepSubmerging(tick);
        break;
      case WormBossMode.Underground:
        this.stepUnderground(boss, tick);
        break;
      case WormBossMode.Emerging:
        this.stepEmerging(boss, tick);
        break;
      case WormBossMode.EruptionClaim:
      case WormBossMode.Dead:
      case WormBossMode.Inactive:
        break;
    }
    this.publish(false, tick);
    return before !== WormBossMode.EruptionClaim && this.mode === WormBossMode.EruptionClaim;
  }

  startDive(target: Vec2, tick: number, undergroundTicks: number): boolean {
    if (this.mode !== WormBossMode.Surface || this.state.splitActive) return false;
    this.entryX = this.x[this.mainOrder[0]!]!;
    this.entryY = this.y[this.mainOrder[0]!]!;
    this.exitX = clamp(target.x, this.radius[0]!, ARENA_WIDTH - this.radius[0]!);
    this.exitY = clamp(target.y, this.radius[0]!, ARENA_HEIGHT - this.radius[0]!);
    this.diveStartTick = tick;
    const travel = clamp(
      Math.floor(undergroundTicks),
      WORM_UNDERGROUND_MIN_TICKS,
      WORM_UNDERGROUND_MAX_TICKS,
    );
    this.undergroundStartTick = tick + WORM_DIVE_TICKS;
    this.undergroundEndTick = this.undergroundStartTick + travel;
    this.state.mode = WormBossMode.DiveWindup;
    this.setAction(
      WormActionKind.SeamDive,
      tick,
      this.undergroundStartTick,
      this.undergroundEndTick,
      this.mainOrder[0]!,
      this.exitX,
      this.exitY,
    );
    this.publish(true, tick);
    return true;
  }

  resolveEruption(tick: number): void {
    this.heading = Math.atan2(this.exitY - this.entryY, this.exitX - this.entryX);
    if (!Number.isFinite(this.heading)) this.heading = 0;
    this.mainPath.seedStraight(this.exitX, this.exitY, this.heading, 1400);
    this.x[this.mainOrder[0]!] = this.exitX;
    this.y[this.mainOrder[0]!] = this.exitY;
    this.solveChain(this.mainOrder, this.mainCountValue, this.mainPath, tick, false);
    for (let i = 0; i < this.mainCountValue; i++) {
      const slot = this.mainOrder[i]!;
      this.targetable[slot] = i === 0 ? 1 : 0;
      this.underground[slot] = i === 0 ? 0 : 1;
      this.condition[slot] = this.condition[slot] ?? WormSegmentCondition.Intact;
      this.setSlotMode(slot, i === 0 ? WormSegmentMode.Emerging : WormSegmentMode.Underground, tick);
    }
    this.armorBand[0] = WormArmorBand.Exposed;
    this.headExposedUntilTick = tick + 27;
    this.emergeStartTick = tick;
    this.emergeEndTick = tick + Math.max(2, (this.mainCountValue - 1) * 2);
    this.state.mode = WormBossMode.Emerging;
    this.forceTopologyCut(this.currentActiveMask(), tick);
  }

  triggerSplit(preferredSeamSlot: number, tick: number): boolean {
    if (this.splitEverValue || this.state.splitActive || this.mainCountValue < 4) return false;
    let seamIndex = -1;
    for (let i = 1; i < this.mainCountValue - 1; i++) {
      const slot = this.mainOrder[i]!;
      if (slot === preferredSeamSlot && this.role[slot] === WormSegmentRole.Body) seamIndex = i;
    }
    if (seamIndex < 0) {
      const middle = Math.floor(this.mainCountValue / 2);
      let best = Number.POSITIVE_INFINITY;
      for (let i = 1; i < this.mainCountValue - 1; i++) {
        const slot = this.mainOrder[i]!;
        if (this.role[slot] !== WormSegmentRole.Body) continue;
        const d = Math.abs(i - middle);
        if (d < best) {
          best = d;
          seamIndex = i;
        }
      }
    }
    if (seamIndex < 0) return false;
    const seam = this.mainOrder[seamIndex]!;
    let changed = 1 << seam;
    this.payFirstBreak(seam, tick);
    this.active[seam] = 0;
    this.targetable[seam] = 0;
    this.condition[seam] = WormSegmentCondition.Destroyed;
    this.setSlotMode(seam, WormSegmentMode.Destroyed, tick);
    this.stubCountValue = 0;
    for (let i = seamIndex + 1; i < this.mainCountValue; i++) {
      const slot = this.mainOrder[i]!;
      this.stubOrder[this.stubCountValue++] = slot;
      changed |= 1 << slot;
    }
    this.mainCountValue = seamIndex;
    this.splitEverValue = true;
    this.state.splitActive = this.stubCountValue > 0;
    this.state.splitExpireTick = tick + WORM_SPLIT_TICKS;
    this.state.mode = WormBossMode.Split;
    this.seedPathFromOrder(this.stubPath, this.stubOrder, this.stubCountValue);
    if (this.stubCountValue > 1) {
      const a = this.stubOrder[0]!;
      const b = this.stubOrder[1]!;
      this.stubHeading = Math.atan2(this.y[a]! - this.y[b]!, this.x[a]! - this.x[b]!);
    } else {
      this.stubHeading = this.heading;
    }
    this.setAction(
      WormActionKind.Split,
      tick,
      tick,
      this.state.splitExpireTick,
      seam,
      this.x[seam]!,
      this.y[seam]!,
    );
    this.commitTopology(changed, tick);
    return true;
  }

  destroyStub(tick: number): boolean {
    if (!this.state.splitActive || this.stubCountValue === 0) return false;
    let changed = 0;
    while (this.stubCountValue > 0) {
      const slot = this.stubOrder[--this.stubCountValue]!;
      changed |= 1 << slot;
      this.active[slot] = 0;
      this.targetable[slot] = 0;
      this.condition[slot] = WormSegmentCondition.Destroyed;
      this.setSlotMode(slot, WormSegmentMode.Destroyed, tick);
      this.payFirstBreak(slot, tick);
    }
    this.completeStubDefeat(tick);
    this.commitTopology(changed, tick);
    return true;
  }

  beginRegrow(tick: number, playerCount: number): number {
    if (this.regrowEverValue || this.state.splitActive || this.mode !== WormBossMode.Surface) return 0;
    const wanted = playerCount <= 1 ? 2 : 3;
    let made = 0;
    for (let slot = 0; slot < WORM_MAX_SEGMENTS && made < wanted; slot++) {
      if (this.active[slot] || this.role[slot] !== WormSegmentRole.Body) continue;
      this.budMask |= 1 << slot;
      this.targetable[slot] = 1;
      this.underground[slot] = 0;
      this.localMaxHp[slot] = Math.max(1, this.maxHp * 0.025);
      this.localHp[slot] = this.localMaxHp[slot]!;
      this.armorMaxHp[slot] = 0;
      this.armorHp[slot] = 0;
      this.armorBand[slot] = WormArmorBand.None;
      this.condition[slot] = WormSegmentCondition.Regrown;
      const angle = this.heading + Math.PI + (made - (wanted - 1) / 2) * 0.42;
      const reach = 96 + made * 22;
      this.x[slot] = clamp(this.x[0]! + Math.cos(angle) * reach, 24, ARENA_WIDTH - 24);
      this.y[slot] = clamp(this.y[0]! + Math.sin(angle) * reach, 24, ARENA_HEIGHT - 24);
      this.previousX[slot] = this.x[slot]!;
      this.previousY[slot] = this.y[slot]!;
      this.setSlotMode(slot, WormSegmentMode.Bud, tick);
      made++;
    }
    if (made === 0) return 0;
    this.regrowEverValue = true;
    this.regrowResolveTick = tick + WORM_REGROW_TICKS;
    this.state.mode = WormBossMode.Regrow;
    this.setAction(
      WormActionKind.GraftHunger,
      tick,
      this.regrowResolveTick,
      this.regrowResolveTick,
      0,
      this.x[0]!,
      this.y[0]!,
    );
    this.forceTopologyCut(this.budMask, tick);
    return made;
  }

  resolveRegrow(tick: number): number {
    if (this.budMask === 0) {
      this.setSurface(tick);
      return 0;
    }
    let activated = 0;
    let changed = this.budMask;
    for (let slot = 0; slot < WORM_MAX_SEGMENTS; slot++) {
      if ((this.budMask & (1 << slot)) === 0) continue;
      this.targetable[slot] = 0;
      if (this.activeCount < WORM_MAX_SEGMENTS && this.localHp[slot]! > 0) {
        this.active[slot] = 1;
        this.targetable[slot] = 1;
        this.generation[slot] = (this.generation[slot]! + 1) & 0xffff;
        this.rewardPaid[slot] = 1;
        this.condition[slot] = WormSegmentCondition.Regrown;
        this.setSlotMode(slot, WormSegmentMode.ArmGrace, tick);
        this.reconnectUntil[slot] = tick + WORM_SURFACE_ARM_GRACE_TICKS;
        this.insertBeforeTail(slot);
        activated++;
      } else {
        this.condition[slot] = WormSegmentCondition.Destroyed;
        this.setSlotMode(slot, WormSegmentMode.Destroyed, tick);
      }
    }
    this.budMask = 0;
    this.armGraceEndTick = tick + WORM_SURFACE_ARM_GRACE_TICKS;
    this.state.mode = WormBossMode.SurfaceArmGrace;
    this.clearAction(tick);
    this.seedPathFromOrder(this.mainPath, this.mainOrder, this.mainCountValue);
    this.commitTopology(changed, tick);
    return activated;
  }

  damageSegments(
    slots: readonly number[],
    rawDamage: number,
    sourceKey: string,
    tick: number,
    piercing: boolean,
    boss: EnemyState,
  ): WormDamageResult {
    const raw = Math.max(0, rawDamage);
    if (raw <= 0 || slots.length === 0 || !this.state.active) {
      return { accepted: false, coreDamage: 0, destroyedMask: 0, rewardValue: 0, terminal: boss.hp <= 0 };
    }
    this.pruneDamageLedger(tick);
    const key = sourceKey || `tick:${tick}`;
    let ledger = this.damageLedger.get(key);
    if (!ledger) {
      ledger = {
        lastTick: tick,
        rawMax: 0,
        maxCoreMultiplier: 0,
        coreBooked: 0,
        contactMask: 0,
        localContacts: 0,
      };
      this.damageLedger.set(key, ledger);
    }
    ledger.lastTick = tick;
    const beforeReward = this.pendingRewardValue;
    let destroyedMask = 0;
    let accepted = false;
    let maxMultiplier = ledger.maxCoreMultiplier;
    const unique = new Int8Array(WORM_MAX_SEGMENTS);
    let uniqueCount = 0;
    for (const candidate of slots) {
      const slot = Math.floor(candidate);
      if (slot < 0 || slot >= WORM_MAX_SEGMENTS || !this.isTargetable(slot)) continue;
      let duplicate = false;
      for (let i = 0; i < uniqueCount; i++) if (unique[i] === slot) duplicate = true;
      if (!duplicate) unique[uniqueCount++] = slot;
    }
    for (let i = 1; i < uniqueCount; i++) {
      const value = unique[i]!;
      let j = i - 1;
      while (j >= 0 && unique[j]! > value) {
        unique[j + 1] = unique[j]!;
        j--;
      }
      unique[j + 1] = value;
    }
    for (let i = 0; i < uniqueCount; i++) {
      const slot = unique[i]!;
      maxMultiplier = Math.max(maxMultiplier, this.coreMultiplier(slot));
      const bit = 1 << slot;
      if ((ledger.contactMask & bit) !== 0) continue;
      if (piercing && ledger.localContacts >= 2) continue;
      const scale = piercing && ledger.localContacts > 0 ? 0.5 : 1;
      ledger.contactMask |= bit;
      ledger.localContacts++;
      accepted = true;
      if (this.applyLocalDamage(slot, raw * scale, tick, boss)) destroyedMask |= bit;
    }
    ledger.rawMax = Math.max(ledger.rawMax, raw);
    ledger.maxCoreMultiplier = maxMultiplier;
    const desiredCore = Math.min(ledger.rawMax, ledger.rawMax * ledger.maxCoreMultiplier);
    const coreDamage = Math.max(0, desiredCore - ledger.coreBooked);
    if (coreDamage > 0) {
      boss.hp -= coreDamage;
      ledger.coreBooked += coreDamage;
      accepted = true;
    }
    if (destroyedMask !== 0) {
      if (this.state.splitActive && this.stubCountValue === 0) this.completeStubDefeat(tick);
      this.commitTopology(destroyedMask, tick);
    } else if (accepted) {
      this.publish(true, tick);
    }
    return {
      accepted,
      coreDamage,
      destroyedMask,
      rewardValue: this.pendingRewardValue - beforeReward,
      terminal: boss.hp <= 0,
    };
  }

  drainReward(): { value: number; x: number; y: number } | null {
    if (this.pendingRewardValue <= 0) return null;
    const result = {
      value: this.pendingRewardValue,
      x: this.pendingRewardX,
      y: this.pendingRewardY,
    };
    this.pendingRewardValue = 0;
    return result;
  }

  dispose(tick: number): void {
    this.active.fill(0);
    this.targetable.fill(0);
    this.collidable.fill(0);
    this.underground.fill(0);
    this.actionExposureUntil.fill(0);
    this.budMask = 0;
    this.state.active = false;
    this.state.ownerId = "";
    this.state.mode = WormBossMode.Inactive;
    this.state.activeMask = 0;
    this.state.targetableMask = 0;
    this.state.collidableMask = 0;
    this.state.undergroundMask = 0;
    this.state.changedMask = 0;
    this.state.splitActive = false;
    this.state.splitExpireTick = 0;
    this.clearAction(tick);
  }

  private stepSurface(dt: number, boss: EnemyState, targets: Vec2[], tick: number): void {
    if (this.mainCountValue === 0) return;
    const head = this.mainOrder[0]!;
    const target = nearestPoint({ x: this.x[head]!, y: this.y[head]! }, targets);
    if (target) {
      const wanted = Math.atan2(target.y - this.y[head]!, target.x - this.x[head]!);
      let delta = wanted - this.heading;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      const maxTurn = WORM_MAX_TURN_RADIANS_PER_SECOND * dt;
      this.heading += clamp(delta, -maxTurn, maxTurn);
    }
    const lost = Math.max(0, WORM_START_SEGMENTS - this.activeCount);
    const speedBonus = Math.min(
      WORM_MISSING_SEGMENT_SPEED_CAP,
      lost * WORM_MISSING_SEGMENT_SPEED_BONUS,
    );
    const speed = WORM_BASE_SPEED * (1 + speedBonus);
    const r = this.radius[head]!;
    let nx = this.x[head]! + Math.cos(this.heading) * speed * dt;
    let ny = this.y[head]! + Math.sin(this.heading) * speed * dt;
    if (nx < r || nx > ARENA_WIDTH - r) {
      this.heading = Math.PI - this.heading;
      nx = clamp(nx, r, ARENA_WIDTH - r);
    }
    if (ny < r || ny > ARENA_HEIGHT - r) {
      this.heading = -this.heading;
      ny = clamp(ny, r, ARENA_HEIGHT - r);
    }
    this.x[head] = nx;
    this.y[head] = ny;
    this.mainPath.append(nx, ny);
    this.solveChain(this.mainOrder, this.mainCountValue, this.mainPath, tick, true);
    boss.x = nx;
    boss.y = ny;
  }

  private stepStub(dt: number, tick: number): void {
    if (this.stubCountValue === 0) return;
    const leader = this.stubOrder[0]!;
    this.stubHeading += 0.34 * dt;
    const speed = WORM_BASE_SPEED * 0.78;
    const r = this.radius[leader]!;
    let nx = this.x[leader]! + Math.cos(this.stubHeading) * speed * dt;
    let ny = this.y[leader]! + Math.sin(this.stubHeading) * speed * dt;
    if (nx < r || nx > ARENA_WIDTH - r) this.stubHeading = Math.PI - this.stubHeading;
    if (ny < r || ny > ARENA_HEIGHT - r) this.stubHeading = -this.stubHeading;
    nx = clamp(nx, r, ARENA_WIDTH - r);
    ny = clamp(ny, r, ARENA_HEIGHT - r);
    this.x[leader] = nx;
    this.y[leader] = ny;
    this.stubPath.append(nx, ny);
    this.solveChain(this.stubOrder, this.stubCountValue, this.stubPath, tick, true);
  }

  private stepSubmerging(tick: number): void {
    const elapsed = Math.max(1, tick - this.diveStartTick + 1);
    const hideCount = Math.min(
      this.mainCountValue,
      Math.floor((elapsed * this.mainCountValue) / WORM_DIVE_TICKS),
    );
    this.state.mode = hideCount > 0 ? WormBossMode.Submerging : WormBossMode.DiveWindup;
    for (let i = 0; i < hideCount; i++) {
      const slot = this.mainOrder[i]!;
      this.targetable[slot] = 0;
      this.collidable[slot] = 0;
      this.underground[slot] = 1;
      this.setSlotMode(slot, WormSegmentMode.Submerging, tick);
    }
    if (elapsed < WORM_DIVE_TICKS) return;
    for (let i = 0; i < this.mainCountValue; i++) {
      const slot = this.mainOrder[i]!;
      this.targetable[slot] = 0;
      this.underground[slot] = 1;
      this.setSlotMode(slot, WormSegmentMode.Underground, tick);
    }
    this.state.mode = WormBossMode.Underground;
    this.forceTopologyCut(this.currentActiveMask(), tick);
  }

  private stepUnderground(boss: EnemyState, tick: number): void {
    const span = Math.max(1, this.undergroundEndTick - this.undergroundStartTick);
    const f = clamp((tick - this.undergroundStartTick + 1) / span, 0, 1);
    const head = this.mainOrder[0]!;
    this.x[head] = this.entryX + (this.exitX - this.entryX) * f;
    this.y[head] = this.entryY + (this.exitY - this.entryY) * f;
    boss.x = this.x[head]!;
    boss.y = this.y[head]!;
    if (tick < this.undergroundEndTick) return;
    this.x[head] = this.exitX;
    this.y[head] = this.exitY;
    boss.x = this.exitX;
    boss.y = this.exitY;
    this.state.mode = WormBossMode.EruptionClaim;
    this.setAction(
      WormActionKind.Eruption,
      tick,
      tick + WORM_ERUPTION_CLAIM_TICKS,
      tick + WORM_ERUPTION_CLAIM_TICKS,
      head,
      this.exitX,
      this.exitY,
    );
    this.publish(true, tick);
  }

  private stepEmerging(boss: EnemyState, tick: number): void {
    const revealed = Math.min(
      this.mainCountValue,
      1 + Math.floor(Math.max(0, tick - this.emergeStartTick) / 2),
    );
    for (let i = 0; i < this.mainCountValue; i++) {
      const slot = this.mainOrder[i]!;
      const visible = i < revealed;
      this.targetable[slot] = visible ? 1 : 0;
      this.underground[slot] = visible ? 0 : 1;
      this.setSlotMode(slot, visible ? WormSegmentMode.Emerging : WormSegmentMode.Underground, tick);
    }
    this.stepSurface(0, boss, [], tick);
    if (tick < this.emergeEndTick) return;
    this.armGraceEndTick = tick + WORM_SURFACE_ARM_GRACE_TICKS;
    this.state.mode = WormBossMode.SurfaceArmGrace;
    for (let i = 0; i < this.mainCountValue; i++) {
      const slot = this.mainOrder[i]!;
      this.targetable[slot] = 1;
      this.underground[slot] = 0;
      this.setSlotMode(slot, WormSegmentMode.ArmGrace, tick);
    }
    this.forceTopologyCut(this.currentActiveMask(), tick);
  }

  private setSurface(tick: number): void {
    this.state.mode = WormBossMode.Surface;
    for (let i = 0; i < this.mainCountValue; i++) {
      const slot = this.mainOrder[i]!;
      this.targetable[slot] = 1;
      this.underground[slot] = 0;
      if (this.reconnectUntil[slot]! <= tick) this.setSlotMode(slot, WormSegmentMode.Surface, tick);
    }
    this.clearAction(tick);
    this.publish(true, tick);
  }

  private solveChain(
    order: Int8Array,
    count: number,
    path: WormPathHistory,
    tick: number,
    boundedReconnect: boolean,
  ): void {
    if (count <= 1) return;
    let arc = 0;
    for (let i = 1; i < count; i++) {
      const previous = order[i - 1]!;
      const slot = order[i]!;
      arc += WORM_PATH_OVERLAP_FACTOR * (this.radius[previous]! + this.radius[slot]!);
      path.sampleBehind(arc, this.sample);
      const tx = this.sample[0]!;
      const ty = this.sample[1]!;
      const dx = tx - this.x[slot]!;
      const dy = ty - this.y[slot]!;
      const d = Math.hypot(dx, dy);
      if (
        boundedReconnect &&
        (this.reconnectUntil[slot]! > tick || d > WORM_RECONNECT_CATCHUP_PX)
      ) {
        const f = d > WORM_RECONNECT_CATCHUP_PX ? WORM_RECONNECT_CATCHUP_PX / d : 1;
        this.x[slot] = this.x[slot]! + dx * f;
        this.y[slot] = this.y[slot]! + dy * f;
        if (d > WORM_RECONNECT_CATCHUP_PX) {
          // The authored grace is a minimum, not a snap deadline. A remote stub/reconnected follower stays
          // harmless and advances by the bounded catch-up until it is genuinely back on the sampled path.
          this.reconnectUntil[slot] = Math.max(this.reconnectUntil[slot]!, tick + 1);
          if (this.mode === WormBossMode.Surface) {
            this.setSlotMode(slot, WormSegmentMode.Reconnecting, tick);
          }
        }
      } else {
        this.x[slot] = tx;
        this.y[slot] = ty;
      }
    }
  }

  private seedPathFromOrder(path: WormPathHistory, order: Int8Array, count: number): void {
    path.clear();
    if (count === 0) return;
    for (let i = count - 1; i >= 0; i--) {
      const slot = order[i]!;
      path.append(this.x[slot]!, this.y[slot]!);
    }
  }

  private rejoinStub(tick: number): void {
    if (!this.state.splitActive) return;
    let changed = 0;
    for (let i = 0; i < this.stubCountValue; i++) {
      const slot = this.stubOrder[i]!;
      this.mainOrder[this.mainCountValue++] = slot;
      this.reconnectUntil[slot] = tick + WORM_SURFACE_ARM_GRACE_TICKS;
      this.setSlotMode(slot, WormSegmentMode.ArmGrace, tick);
      changed |= 1 << slot;
    }
    this.stubCountValue = 0;
    this.state.splitActive = false;
    this.state.splitExpireTick = 0;
    this.state.mode = WormBossMode.SurfaceArmGrace;
    this.armGraceEndTick = tick + WORM_SURFACE_ARM_GRACE_TICKS;
    this.seedPathFromOrder(this.mainPath, this.mainOrder, this.mainCountValue);
    this.clearAction(tick);
    this.commitTopology(changed, tick);
  }

  private completeStubDefeat(tick: number): void {
    this.state.splitActive = false;
    this.state.splitExpireTick = 0;
    this.state.mode = WormBossMode.SurfaceArmGrace;
    this.armGraceEndTick = tick + WORM_SPLIT_PUNISH_TICKS;
    this.armorBand[0] = WormArmorBand.Exposed;
    this.headExposedUntilTick = this.armGraceEndTick;
    const remaining = Math.max(0, WORM_ANATOMY_XP_CAP - this.anatomyXpPaid);
    if (remaining > 0) this.addReward(remaining, this.x[0]!, this.y[0]!);
    this.clearAction(tick);
  }

  private insertBeforeTail(slot: number): void {
    let index = this.mainCountValue;
    for (let i = 0; i < this.mainCountValue; i++) {
      if (this.role[this.mainOrder[i]!] === WormSegmentRole.Tail) {
        index = i;
        break;
      }
    }
    for (let i = this.mainCountValue; i > index; i--) this.mainOrder[i] = this.mainOrder[i - 1]!;
    this.mainOrder[index] = slot;
    this.mainCountValue++;
  }

  private applyLocalDamage(slot: number, raw: number, tick: number, boss: EnemyState): boolean {
    if (raw <= 0) return false;
    if (this.isBud(slot)) {
      this.localHp[slot] = Math.max(0, this.localHp[slot]! - raw);
      if (this.localHp[slot]! <= 0) {
        this.budMask &= ~(1 << slot);
        this.targetable[slot] = 0;
        this.condition[slot] = WormSegmentCondition.Destroyed;
        this.setSlotMode(slot, WormSegmentMode.Destroyed, tick);
        return true;
      }
      this.updateCondition(slot);
      return false;
    }
    let damage = raw;
    if (this.armorHp[slot]! > 0) {
      const used = Math.min(this.armorHp[slot]!, damage);
      this.armorHp[slot] = this.armorHp[slot]! - used;
      damage -= used;
      if (this.armorHp[slot]! <= 0) this.armorBand[slot] = WormArmorBand.Exposed;
    }
    if (damage > 0) this.localHp[slot] = Math.max(0, this.localHp[slot]! - damage);
    this.updateCondition(slot);
    if (this.localHp[slot]! > 0) return false;
    const role = this.role[slot]!;
    if (role === WormSegmentRole.Head) {
      this.localHp[slot] = 1;
      this.armorBand[slot] = WormArmorBand.Exposed;
      this.condition[slot] = WormSegmentCondition.ArmorOpen;
      return false;
    }
    if (role === WormSegmentRole.Neck) {
      let downstreamGone = 0;
      for (let i = 2; i < WORM_START_SEGMENTS; i++) if (!this.active[i]) downstreamGone++;
      if (boss.hp / this.maxHp > 0.35 && downstreamGone < 4) {
        this.localHp[slot] = 1;
        this.armorBand[slot] = WormArmorBand.Exposed;
        this.condition[slot] = WormSegmentCondition.ArmorOpen;
        return false;
      }
    }
    this.removeActiveSlot(slot, tick);
    this.payFirstBreak(slot, tick);
    return true;
  }

  private removeActiveSlot(slot: number, tick: number): void {
    let chainOrder = this.mainOrder;
    let count = this.mainCountValue;
    let found = -1;
    for (let i = 0; i < count; i++) if (chainOrder[i] === slot) found = i;
    if (found < 0) {
      chainOrder = this.stubOrder;
      count = this.stubCountValue;
      for (let i = 0; i < count; i++) if (chainOrder[i] === slot) found = i;
    }
    if (found < 0) return;
    const main = chainOrder === this.mainOrder;
    for (let i = found; i < count - 1; i++) chainOrder[i] = chainOrder[i + 1]!;
    if (main) {
      this.mainCountValue--;
      for (let i = found; i < this.mainCountValue; i++) {
        const follower = this.mainOrder[i]!;
        this.reconnectUntil[follower] = tick + WORM_RECONNECT_TICKS;
        this.setSlotMode(follower, WormSegmentMode.Reconnecting, tick);
      }
    } else {
      this.stubCountValue--;
    }
    this.active[slot] = 0;
    this.targetable[slot] = 0;
    this.collidable[slot] = 0;
    this.underground[slot] = 0;
    this.condition[slot] = WormSegmentCondition.Destroyed;
    this.setSlotMode(slot, WormSegmentMode.Destroyed, tick);
  }

  private payFirstBreak(slot: number, tick: number): void {
    if (this.rewardPaid[slot]) return;
    this.rewardPaid[slot] = 1;
    const role = this.role[slot]!;
    const value = role === WormSegmentRole.Body ? 3 : role === WormSegmentRole.Spinner || role === WormSegmentRole.Tail ? 5 : 0;
    if (value > 0) this.addReward(Math.min(value, WORM_ANATOMY_XP_CAP - this.anatomyXpPaid), this.x[slot]!, this.y[slot]!);
    const row = this.state.segments[slot];
    if (row) row.changeTick = tick;
  }

  private addReward(value: number, x: number, y: number): void {
    const amount = Math.max(0, Math.min(value, WORM_ANATOMY_XP_CAP - this.anatomyXpPaid));
    if (amount <= 0) return;
    this.anatomyXpPaid += amount;
    this.pendingRewardValue += amount;
    this.pendingRewardX = x;
    this.pendingRewardY = y;
  }

  private coreMultiplier(slot: number): number {
    const anatomy = this.def.anatomy[this.role[slot]! as WormSegmentRole];
    return this.armorBand[slot] === WormArmorBand.Exposed
      ? anatomy.exposedCoreMultiplier
      : anatomy.platedCoreMultiplier;
  }

  private updateCondition(slot: number): void {
    if (!this.active[slot] && !this.isBud(slot)) return;
    if (this.armorMaxHp[slot]! > 0 && this.armorHp[slot]! <= 0) {
      this.condition[slot] = WormSegmentCondition.ArmorOpen;
      return;
    }
    const frac = this.localMaxHp[slot]! > 0 ? this.localHp[slot]! / this.localMaxHp[slot]! : 0;
    this.condition[slot] =
      frac <= 0.2
        ? WormSegmentCondition.BreakReady
        : frac <= 0.55
          ? WormSegmentCondition.Wounded
          : this.generation[slot]! > 1
            ? WormSegmentCondition.Regrown
            : WormSegmentCondition.Intact;
  }

  private expireReconnects(tick: number): void {
    for (let slot = 0; slot < WORM_MAX_SEGMENTS; slot++) {
      if (!this.active[slot] || this.reconnectUntil[slot]! === 0 || tick < this.reconnectUntil[slot]!) continue;
      this.reconnectUntil[slot] = 0;
      if (this.mode === WormBossMode.Surface) this.setSlotMode(slot, WormSegmentMode.Surface, tick);
    }
  }

  private expireHeadExposure(tick: number): void {
    if (this.headExposedUntilTick === 0 || tick < this.headExposedUntilTick) return;
    this.headExposedUntilTick = 0;
    if (this.armorMaxHp[0]! > 0) this.armorBand[0] = WormArmorBand.Plated;
    this.updateCondition(0);
  }

  private exposeSegment(slot: number, untilTick: number, tick: number): void {
    if (slot === 0) {
      this.headExposedUntilTick = Math.max(this.headExposedUntilTick, untilTick);
    } else {
      this.actionExposureUntil[slot] = Math.max(this.actionExposureUntil[slot]!, untilTick);
    }
    this.armorBand[slot] = WormArmorBand.Exposed;
    this.condition[slot] = WormSegmentCondition.ArmorOpen;
    this.publish(true, tick);
  }

  private expireActionExposures(tick: number): void {
    let changed = false;
    for (let slot = 1; slot < WORM_MAX_SEGMENTS; slot++) {
      const until = this.actionExposureUntil[slot]!;
      if (until === 0 || tick < until) continue;
      this.actionExposureUntil[slot] = 0;
      if (this.active[slot] && this.armorHp[slot]! > 0) {
        this.armorBand[slot] = WormArmorBand.Plated;
      }
      this.updateCondition(slot);
      changed = true;
    }
    if (changed) this.publish(true, tick);
  }

  private pruneDamageLedger(tick: number): void {
    if (this.damageLedger.size < 256) return;
    for (const [key, entry] of this.damageLedger) {
      if (((tick - entry.lastTick) >>> 0) > 200) this.damageLedger.delete(key);
    }
    if (this.damageLedger.size > 512) this.damageLedger.clear();
  }

  private currentActiveMask(): number {
    let mask = 0;
    for (let slot = 0; slot < WORM_MAX_SEGMENTS; slot++) if (this.active[slot]) mask |= 1 << slot;
    return mask;
  }

  private forceTopologyCut(mask: number, tick: number): void {
    const changed = mask & 0x0fff;
    if (this.topologyCommitTick === tick) {
      // Colyseus broadcasts after the fixed-tick transaction. Multiple same-tick sources therefore fold
      // into one durable topology sequence and one complete changed mask instead of exposing half states.
      this.state.changedMask |= changed;
    } else {
      this.topologyCommitTick = tick;
      this.state.topologySeq = (this.state.topologySeq + 1) >>> 0;
      this.state.changedMask = changed;
    }
    this.publish(true, tick);
  }

  private commitTopology(changedMask: number, tick: number): void {
    this.recomputeOrdinals();
    this.forceTopologyCut(changedMask, tick);
  }

  private recomputeOrdinals(): void {
    this.chain.fill(WormChain.None);
    this.ordinal.fill(0);
    for (let i = 0; i < this.mainCountValue; i++) {
      const slot = this.mainOrder[i]!;
      this.chain[slot] = WormChain.Main;
      this.ordinal[slot] = i;
    }
    for (let i = 0; i < this.stubCountValue; i++) {
      const slot = this.stubOrder[i]!;
      this.chain[slot] = WormChain.Stub;
      this.ordinal[slot] = i;
    }
  }

  private setSlotMode(slot: number, mode: WormSegmentMode, tick: number): void {
    const row = this.state.segments[slot];
    if (row && row.mode !== mode) row.changeTick = tick;
    if (row) row.mode = mode;
  }

  private setAction(
    kind: WormActionKind,
    startTick: number,
    resolveTick: number,
    endTick: number,
    emitterSlot: number,
    targetX: number,
    targetY: number,
  ): void {
    this.state.actionKind = kind;
    this.state.actionSeq = (this.state.actionSeq + 1) & 0xffff;
    this.state.actionStartTick = startTick >>> 0;
    this.state.actionResolveTick = resolveTick >>> 0;
    this.state.actionEndTick = endTick >>> 0;
    this.state.actionEmitterSlot = emitterSlot & 0xff;
    this.state.actionEmitterGeneration = this.generation[emitterSlot] ?? 0;
    this.state.actionTopologySeq = this.state.topologySeq;
    this.state.actionTargetX = targetX;
    this.state.actionTargetY = targetY;
  }

  private clearAction(tick: number): void {
    this.state.actionKind = WormActionKind.None;
    this.state.actionStartTick = tick >>> 0;
    this.state.actionResolveTick = tick >>> 0;
    this.state.actionEndTick = tick >>> 0;
    this.state.actionEmitterSlot = 0;
    this.state.actionEmitterGeneration = 0;
    this.state.actionTopologySeq = this.state.topologySeq;
  }

  private publish(force: boolean, tick: number): void {
    let activeMask = 0;
    let targetableMask = 0;
    let collidableMask = 0;
    let undergroundMask = 0;
    for (let slot = 0; slot < WORM_MAX_SEGMENTS; slot++) {
      if (this.active[slot]) activeMask |= 1 << slot;
      if (this.targetable[slot]) targetableMask |= 1 << slot;
      if (this.collidable[slot]) collidableMask |= 1 << slot;
      if (this.underground[slot]) undergroundMask |= 1 << slot;
    }
    this.state.activeMask = activeMask;
    this.state.targetableMask = targetableMask;
    this.state.collidableMask = collidableMask;
    this.state.undergroundMask = undergroundMask;
    if (!force && tick % WORM_POSE_PUBLISH_TICKS !== 0) return;
    this.state.poseTick = tick >>> 0;
    for (let slot = 0; slot < WORM_MAX_SEGMENTS; slot++) {
      const row = this.state.segments[slot];
      if (!row) continue;
      row.slot = slot;
      row.generation = this.generation[slot]!;
      row.role = this.role[slot]!;
      row.condition = this.condition[slot]!;
      row.armorBand = this.armorBand[slot]!;
      row.chain = this.chain[slot]!;
      row.ordinal = this.ordinal[slot]!;
      row.x = Number.isFinite(this.x[slot]) ? this.x[slot]! : 0;
      row.y = Number.isFinite(this.y[slot]) ? this.y[slot]! : 0;
      row.integrityQ = Math.round(
        clamp(this.localMaxHp[slot]! > 0 ? this.localHp[slot]! / this.localMaxHp[slot]! : 0, 0, 1) * 255,
      );
      row.armorQ = Math.round(
        clamp(this.armorMaxHp[slot]! > 0 ? this.armorHp[slot]! / this.armorMaxHp[slot]! : 0, 0, 1) * 255,
      );
      if (!this.active[slot] && !this.isBud(slot) && row.mode !== WormSegmentMode.Destroyed) {
        row.mode = WormSegmentMode.Dormant;
      }
    }
  }
}

interface PendingSegmentedAction {
  module: SegmentedBossActionModuleDef;
  plan: CastPlan;
  ids: string[];
  emitterSlot: number;
  emitterGeneration: number;
  resolveTick: number;
  endTick: number;
  settledBroadcastGeneration: number | null;
  telegraphsRemoved: boolean;
}

/** Reusable one-major-action scheduler for segmented bosses. It consumes authored primitives once at the
 * trigger edge, then only mutates retained state while the fixed telegraph resolves. */
export class SegmentedBossActionScheduler {
  private pending: PendingSegmentedAction | null = null;
  private nextActionTick: number;
  private sequenceCursor = 0;
  private targetCursor = 0;
  private pairRemaining = 0;
  private pairInProgress = false;
  private readonly lastEmitterByRole = new Int8Array(5);
  private readonly targetView: Vec2[] = [{ x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 }];
  private readonly bossProxy = { x: 0, y: 0, kind: "seam-eater", radius: 40 };

  constructor(
    private readonly def: WormEncounterDef,
    spawnTick: number,
  ) {
    this.nextActionTick = spawnTick + 30;
    this.lastEmitterByRole.fill(-1);
  }

  get busy(): boolean {
    return this.pending !== null;
  }

  /** Advance or start one action. Returns true while the major-action lane is occupied. */
  step(
    runtime: WormBossRuntime,
    boss: EnemyState,
    targets: Vec2[],
    depth: number,
    tick: number,
    sink: BossEmitSink,
    broadcastGeneration: number,
  ): boolean {
    const current = this.pending;
    if (current) {
      if (!runtime.isActionEmitterValid(current.emitterSlot, current.emitterGeneration)) {
        this.cancel(runtime, sink, tick);
        return false;
      }
      if (current.settledBroadcastGeneration === null) {
        const start = runtime.state.actionStartTick;
        const t = clamp((tick - start) / Math.max(1, current.resolveTick - start), 0, 1);
        for (const id of current.ids) sink.setTelegraphProgress(id, t);
        if (tick >= current.resolveTick) {
          for (const id of current.ids) sink.setTelegraphProgress(id, 1);
          this.applyPlan(current.plan, depth, sink);
          current.settledBroadcastGeneration = broadcastGeneration;
        }
      } else if (
        !current.telegraphsRemoved &&
        broadcastGeneration > current.settledBroadcastGeneration
      ) {
        for (const id of current.ids) sink.removeTelegraph(id);
        current.telegraphsRemoved = true;
      }
      if (tick >= current.endTick && current.telegraphsRemoved) {
        runtime.endAuthoredAction(current.module.kind, tick);
        this.pending = null;
        const phase = this.phaseFor(this.fraction(boss, runtime));
        if (this.pairRemaining > 0) {
          this.pairRemaining--;
          this.pairInProgress = true;
          this.nextActionTick = tick + (phase?.pairGapTicks ?? 5);
        } else {
          this.pairInProgress = false;
          this.nextActionTick = tick + (phase?.cadenceTicks ?? 60);
        }
        return false;
      }
      return true;
    }

    if (
      tick < this.nextActionTick ||
      runtime.mode !== WormBossMode.Surface ||
      runtime.state.actionKind !== WormActionKind.None
    ) return false;
    const phase = this.phaseFor(this.fraction(boss, runtime));
    if (!phase || phase.sequence.length === 0) return false;
    const kind = phase.sequence[this.sequenceCursor % phase.sequence.length]!;
    this.sequenceCursor++;
    const module = this.moduleFor(kind);
    if (!module) {
      this.nextActionTick = tick + phase.cadenceTicks;
      return false;
    }
    const roleIndex = module.emitterRole as number;
    const emitterSlot = runtime.findActionEmitter(
      module.emitterRole,
      this.lastEmitterByRole[roleIndex] ?? -1,
    );
    if (emitterSlot < 0) {
      // Dead Tail / destroyed Spinner never fires a replacement body action.
      this.nextActionTick = tick + phase.cadenceTicks;
      this.pairRemaining = 0;
      this.pairInProgress = false;
      return false;
    }
    this.lastEmitterByRole[roleIndex] = emitterSlot;
    const target = targets.length > 0
      ? targets[this.targetCursor++ % targets.length]!
      : this.targetView[0]!;
    this.targetView[0]!.x = target.x;
    this.targetView[0]!.y = target.y;
    this.bossProxy.x = runtime.x[emitterSlot]!;
    this.bossProxy.y = runtime.y[emitterSlot]!;
    this.bossProxy.radius = runtime.segmentRadius(emitterSlot);
    const primitive = BOSS_PRIMITIVES[module.primitive];
    if (!primitive) {
      this.nextActionTick = tick + phase.cadenceTicks;
      return false;
    }
    const plan = primitive({
      boss: this.bossProxy,
      targets: this.targetView,
      rng: makeRng(mixSeeds(runtime.state.topologySeq, tick, this.sequenceCursor)),
      phaseTick: this.sequenceCursor,
      params: module.params as Record<string, number>,
    });
    const resolveTick = tick + module.windupTicks;
    const endTick = resolveTick + module.recoveryTicks;
    if (!runtime.beginAuthoredAction(
      module.kind,
      tick,
      resolveTick,
      endTick,
      emitterSlot,
      target.x,
      target.y,
    )) return false;
    const ids: string[] = [];
    for (const telegraph of plan.telegraphs) ids.push(sink.addTelegraph(telegraph));
    this.pending = {
      module,
      plan,
      ids,
      emitterSlot,
      emitterGeneration: runtime.segmentGeneration(emitterSlot),
      resolveTick,
      endTick,
      settledBroadcastGeneration: null,
      telegraphsRemoved: false,
    };
    if (!this.pairInProgress) this.pairRemaining = phase.paired ? 1 : 0;
    return true;
  }

  dispose(runtime: WormBossRuntime, sink: BossEmitSink, tick: number): void {
    this.cancel(runtime, sink, tick);
  }

  private cancel(runtime: WormBossRuntime, sink: BossEmitSink, tick: number): void {
    const current = this.pending;
    if (!current) return;
    for (const id of current.ids) sink.removeTelegraph(id);
    runtime.endAuthoredAction(current.module.kind, tick);
    this.pending = null;
    this.pairRemaining = 0;
    this.pairInProgress = false;
    const phase = this.phaseFor(this.fractionFromRuntime(runtime));
    this.nextActionTick = tick + (phase?.cadenceTicks ?? 60);
  }

  private applyPlan(plan: CastPlan, depth: number, sink: BossEmitSink): void {
    const scale = depthDamageScale(depth);
    for (const aoe of plan.emits.aoe ?? []) {
      if (aoe.quake) sink.applyQuake(aoe.x, aoe.y, aoe.radius, aoe.damage * scale, aoe.knockback);
      else sink.applyAoE(aoe.x, aoe.y, aoe.radius, aoe.damage * scale, aoe.knockback);
    }
    for (const melee of plan.emits.melee ?? []) {
      sink.applyMelee(
        melee.x,
        melee.y,
        melee.aimX,
        melee.aimY,
        melee.range,
        melee.halfArc,
        melee.damage * scale,
        melee.knockback,
      );
    }
  }

  private moduleFor(kind: WormActionKind): SegmentedBossActionModuleDef | undefined {
    for (const module of this.def.actions ?? []) if (module.kind === kind) return module;
    return undefined;
  }

  private phaseFor(frac: number): SegmentedBossActionPhaseDef | undefined {
    for (const phase of this.def.actionPhases ?? []) if (frac > phase.hpAbove) return phase;
    return this.def.actionPhases?.[this.def.actionPhases.length - 1];
  }

  private fraction(boss: EnemyState, runtime: WormBossRuntime): number {
    return runtime.maxHp > 0 ? boss.hp / runtime.maxHp : 1;
  }

  private fractionFromRuntime(runtime: WormBossRuntime): number {
    const ownerHp = runtime.state.active ? runtime.maxHp : 0;
    return runtime.maxHp > 0 ? ownerHp / runtime.maxHp : 1;
  }
}

/** Authored phase/action owner. The runtime owns geometry; this director owns warnings and thresholds. */
export class WormEncounterDirector {
  private nextDiveTick: number;
  private eruptionTelegraphId: string | null = null;
  private eruptionSettledGeneration: number | null = null;
  private readonly contactLedger = new Map<string, number>();
  private readonly actions: SegmentedBossActionScheduler;
  private lastRibParrySeq = -1;
  private lastRibParryTick = -9999;
  private ribParryWindows = 0;

  constructor(readonly runtime: WormBossRuntime, def: WormEncounterDef, spawnTick: number) {
    this.nextDiveTick = spawnTick + 72;
    this.actions = new SegmentedBossActionScheduler(def, spawnTick);
  }

  step(
    dt: number,
    boss: EnemyState,
    targets: Vec2[],
    depth: number,
    tick: number,
    sink: BossEmitSink,
    broadcastGeneration: number,
  ): number {
    const frac = this.runtime.maxHp > 0 ? boss.hp / this.runtime.maxHp : 1;
    if (
      !this.actions.busy &&
      frac <= 0.7 &&
      !this.runtime.splitEver &&
      this.runtime.mode === WormBossMode.Surface
    ) {
      this.runtime.triggerSplit(5, tick);
    }
    if (
      !this.actions.busy &&
      frac <= 0.45 &&
      !this.runtime.regrowEver &&
      !this.runtime.state.splitActive &&
      this.runtime.mode === WormBossMode.Surface
    ) {
      this.runtime.beginRegrow(tick, targets.length);
    }
    const actionBusy = this.actions.step(
      this.runtime,
      boss,
      targets,
      depth,
      tick,
      sink,
      broadcastGeneration,
    );
    if (
      tick >= this.nextDiveTick &&
      !actionBusy &&
      this.runtime.mode === WormBossMode.Surface &&
      !this.runtime.state.splitActive
    ) {
      const raw = nearestPoint(
        { x: this.runtime.x[0]!, y: this.runtime.y[0]! },
        targets,
      ) ?? { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 };
      const target = sink.validateWormPoint?.(raw.x, raw.y, WORM_ERUPTION_RADIUS) ?? raw;
      this.startBurrow(target, tick);
    }
    // Authored anatomy actions plant the whole chain: warning geometry and emitter cannot drift apart.
    const claimStarted = this.runtime.advance(actionBusy ? 0 : dt, boss, targets, tick);
    if (claimStarted) {
      this.eruptionTelegraphId = sink.addTelegraph({
        shape: 0,
        x: this.runtime.state.actionTargetX,
        y: this.runtime.state.actionTargetY,
        a: WORM_ERUPTION_RADIUS,
        danger: 1,
        kindTag: 8,
      });
      this.eruptionSettledGeneration = null;
    }
    if (this.runtime.mode === WormBossMode.EruptionClaim && this.eruptionTelegraphId) {
      const start = this.runtime.state.actionStartTick;
      const resolve = this.runtime.state.actionResolveTick;
      const progress = clamp((tick - start) / Math.max(1, resolve - start), 0, 1);
      sink.setTelegraphProgress(this.eruptionTelegraphId, progress);
      if (tick >= resolve && this.eruptionSettledGeneration === null) {
        sink.setTelegraphProgress(this.eruptionTelegraphId, 1);
        sink.applyAoE(
          this.runtime.state.actionTargetX,
          this.runtime.state.actionTargetY,
          WORM_ERUPTION_RADIUS,
          24 * depthDamageScale(depth),
          760,
        );
        this.eruptionSettledGeneration = broadcastGeneration;
        this.runtime.resolveEruption(tick);
        this.nextDiveTick = tick + 150;
      }
    }
    if (
      this.eruptionTelegraphId &&
      this.eruptionSettledGeneration !== null &&
      broadcastGeneration > this.eruptionSettledGeneration
    ) {
      sink.removeTelegraph(this.eruptionTelegraphId);
      this.eruptionTelegraphId = null;
      this.eruptionSettledGeneration = null;
    }
    return frac > 0.7 ? 1 : frac > 0.35 ? 2 : frac > 0.08 ? 3 : 4;
  }

  startBurrow(target: Vec2, tick: number, undergroundTicks?: number): boolean {
    const span = WORM_UNDERGROUND_MAX_TICKS - WORM_UNDERGROUND_MIN_TICKS + 1;
    const deterministic =
      undergroundTicks ?? WORM_UNDERGROUND_MIN_TICKS + (mixSeeds(this.runtime.state.actionSeq, tick) % span);
    return this.runtime.startDive(target, tick, deterministic);
  }

  acceptContact(playerId: string, chain: WormChain, tick: number): boolean {
    const key = `${playerId}:${chain}`;
    const lastHitTick = this.contactLedger.get(key);
    if (lastHitTick !== undefined && tick - lastHitTick < WORM_CONTACT_EPOCH_TICKS) return false;
    this.contactLedger.set(key, tick);
    return true;
  }

  /** Successful white action parries expose the exact anatomy that emitted them. */
  acceptParry(_playerId: string, tick: number): boolean {
    const kind = this.runtime.state.actionKind as WormActionKind;
    if (kind !== WormActionKind.RibQuake && kind !== WormActionKind.StitchReap) return false;
    const duration = kind === WormActionKind.RibQuake ? 44 : 40;
    if (!this.runtime.exposeActionEmitter(tick, duration)) return false;
    if (kind === WormActionKind.RibQuake) {
      const seq = this.runtime.state.actionSeq;
      if (seq !== this.lastRibParrySeq) {
        this.ribParryWindows = tick - this.lastRibParryTick <= 80 ? this.ribParryWindows + 1 : 1;
        this.lastRibParrySeq = seq;
        this.lastRibParryTick = tick;
        if (this.ribParryWindows >= 2) {
          this.runtime.exposeHead(tick, 20);
          this.ribParryWindows = 0;
        }
      }
    }
    return true;
  }

  dispose(sink: BossEmitSink, tick: number): void {
    if (this.eruptionTelegraphId) sink.removeTelegraph(this.eruptionTelegraphId);
    this.eruptionTelegraphId = null;
    this.eruptionSettledGeneration = null;
    this.contactLedger.clear();
    this.actions.dispose(this.runtime, sink, tick);
    this.runtime.dispose(tick);
  }
}

export class BossController {
  private phaseIndex = -1;
  private modules: ModuleRuntime[] = [];
  /** §16 v0.109 Slice 2 — the boss's live beam/ring/dash hazards, advanced each tick. */
  private active: ActiveHazard[] = [];
  private wormDirector: WormEncounterDirector | null = null;

  constructor(
    private readonly def: BossDef,
    private readonly maxHp: number,
    private readonly seed: number,
  ) {}

  /** The boss def's display name (for the boss bar). */
  get name(): string {
    return this.def.name;
  }

  get isWormEncounter(): boolean {
    return this.def.encounter === "worm";
  }

  get wormRuntime(): WormBossRuntime | null {
    return this.wormDirector?.runtime ?? null;
  }

  attachWorm(state: WormBossState, boss: EnemyState, tick: number, heading = 0): void {
    if (this.def.encounter !== "worm" || !this.def.worm) return;
    this.wormDirector = new WormEncounterDirector(
      new WormBossRuntime(
        state,
        this.def.worm,
        this.maxHp,
        this.seed,
        boss.id,
        boss.x,
        boss.y,
        heading,
        tick,
      ),
      this.def.worm,
      tick,
    );
  }

  damageWormSegments(
    slots: readonly number[],
    rawDamage: number,
    sourceKey: string,
    tick: number,
    piercing: boolean,
    boss: EnemyState,
  ): WormDamageResult {
    return (
      this.wormDirector?.runtime.damageSegments(
        slots,
        rawDamage,
        sourceKey,
        tick,
        piercing,
        boss,
      ) ?? {
        accepted: false,
        coreDamage: 0,
        destroyedMask: 0,
        rewardValue: 0,
        terminal: boss.hp <= 0,
      }
    );
  }

  drainWormReward(): { value: number; x: number; y: number } | null {
    return this.wormDirector?.runtime.drainReward() ?? null;
  }

  startWormBurrow(target: Vec2, tick: number, undergroundTicks?: number): boolean {
    return this.wormDirector?.startBurrow(target, tick, undergroundTicks) ?? false;
  }

  acceptWormContact(playerId: string, chain: WormChain, tick: number): boolean {
    return this.wormDirector?.acceptContact(playerId, chain, tick) ?? false;
  }

  acceptWormParry(playerId: string, tick: number): boolean {
    return this.wormDirector?.acceptParry(playerId, tick) ?? false;
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
    broadcastGeneration = tick,
  ): number {
    if (this.def.encounter === "worm") {
      if (!this.wormDirector) {
        const frac = this.maxHp > 0 ? boss.hp / this.maxHp : 1;
        return this.selectPhase(frac) + 1;
      }
      return this.wormDirector.step(
        dt,
        boss,
        targets,
        depth,
        tick,
        sink,
        broadcastGeneration,
      );
    }
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
        if (rt.pending.settledBroadcastGeneration !== null) {
          // A newer generation means the settled t=1 row was included in the previous broadcast. Clear it
          // now. Catch-up substeps share a generation, so they cannot coalesce settle + deletion pre-patch.
          if (broadcastGeneration <= rt.pending.settledBroadcastGeneration) continue;
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
            rt.pending.settledBroadcastGeneration = broadcastGeneration;
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
      const previousElapsed = h.elapsed;
      const stepDt = Math.max(0, Math.min(dt, h.spec.duration - previousElapsed));
      h.elapsed += dt;
      const frac = h.spec.duration > 0 ? Math.min(1, h.elapsed / h.spec.duration) : 1;
      const dmg = h.spec.dps * stepDt * dmgScale;
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
          h.spec.knockback * stepDt,
        );
      }
      if (h.elapsed >= h.spec.duration) sink.removeTelegraph(h.telegraphId);
      else survivors.push(h);
    }
    this.active = survivors;
  }

  /** Cancel any in-flight telegraphs + live hazards (e.g. on boss death) so no rows are orphaned. */
  dispose(sink: BossEmitSink, tick = 0): void {
    this.wormDirector?.dispose(sink, tick);
    this.wormDirector = null;
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
        settledBroadcastGeneration: null,
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
          settledBroadcastGeneration: null,
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

// Append-only flagship wave: Vastaghar is a narrow tick-authored director beside the frozen legacy and
// Serraketh paths above. GameRoom selects it only for top-down `world-titan`; belt keeps the legacy deck.
import {
  BossTelegraphKindTag,
  type BossCounterSummary,
  TELEGRAPH_DODGE,
  TELEGRAPH_PARRYABLE,
  TgShape,
  VastagharActionKind,
  VastagharActionResult,
  VastagharArenaMutationKind,
  VastagharFoot,
  VastagharMode,
  VastagharPhase,
  VastagharVictoryStage,
  type VastagharActionDef,
  type VastagharBossState,
  type VastagharEncounterDef,
} from "@dd/shared";

export interface VastagharTarget extends Vec2 {
  id: string;
  alive: boolean;
  downTick: number;
  recentBossDamage: number;
}

/** GameRoom owns player/combat/map mutations; the director owns their exact authored tick. */
export interface VastagharEmitSink extends BossEmitSink {
  applyVastagharQuake(
    x: number,
    y: number,
    radius: number,
    damage: number,
    knockback: number,
    epoch: number,
    out: BossCounterSummary,
  ): void;
  applyVastagharSweep(
    x: number,
    y: number,
    innerRange: number,
    outerRange: number,
    halfWidth: number,
    fromAngle: number,
    toAngle: number,
    damage: number,
    knockback: number,
    actionSeq: number,
    revolution: number,
    airborneAnswers: boolean,
    out: BossCounterSummary,
  ): void;
  mutateVastagharArena(kind: VastagharArenaMutationKind, poiIndex: number): void;
}

const VASTAGHAR_TAU = Math.PI * 2;
const VASTAGHAR_POI_NONE = 255;
const VASTAGHAR_MERCY_TICKS = 50;
const VASTAGHAR_MERCY_RADIUS = 180;
const VASTAGHAR_ANTI_KITE_DISTANCE = 900;
const VASTAGHAR_ANTI_KITE_TICKS = 40;
const VASTAGHAR_OPTIONAL_ADD_DELAY_TICKS = 400;
const VASTAGHAR_DEATH_TICKS = 18;
const VASTAGHAR_XP_CROWN_TICK = 10;

function vastagharTickReached(now: number, target: number): boolean {
  return ((now - target) | 0) >= 0;
}

function bumpUint16(value: number): number {
  const next = (value + 1) & 0xffff;
  return next === 0 ? 1 : next;
}

/** Exact conservation helper used by the reserved victory core and its deterministic regression. */
export function conserveVastagharVictoryXp(fieldXp: number, bossXp: number): number {
  return Math.min(0xffffffff, Math.max(0, Math.floor(fieldXp)) + Math.max(0, Math.floor(bossXp)));
}

export class VastagharEncounterRuntime {
  private currentAction = VastagharActionKind.None;
  private currentDef: VastagharActionDef | null = null;
  private actionStartTick = 0;
  private actionResolveTick = 0;
  private actionActiveEndTick = 0;
  private actionEndTick = 0;
  private nextActionTick = 0;
  private transitionEndTick = 0;
  private deckIndex = 0;
  private phaseSignatureResolved = false;
  private pendingTransition = false;
  private transitionCourtesyUsed = false;
  private breakCountInPhase = 0;
  private tutorialStarted = false;
  private tutorialFinished = false;
  private actionAllAnswered = true;
  private actionAnswerEpochs = 0;
  private actionSuccessfulEpochs = 0;
  private kiteTicks = 0;
  private forceMarch = false;
  private lastParrierId = "";
  private lastFocusId = "";
  private consecutiveFocus = 0;
  private lastWaveTick = 0;
  private authoredWaveSpawned = false;
  private optionalWaveSpawned = false;
  private finalTreadStarted = false;
  private victoryXpRequested = false;
  private victoryDeathTick = 0;
  private deferredSourcePlayerId = "";
  private deferredSourceWeaponId = "";
  private deferredDelivery = 0;
  private deferredSourceX = 0;
  private deferredSourceY = 0;
  private readonly targetHistory = new Array<string>(8);
  private targetHistoryCursor = 0;
  private targetHistorySize = 0;
  private readonly telegraphIds = new Array<string>(5);
  private readonly telegraphSettledGeneration = new Int32Array(5);
  private readonly telegraphResolved = new Uint8Array(5);
  private telegraphCount = 0;
  private readonly stepX = new Float64Array(5);
  private readonly stepY = new Float64Array(5);
  private readonly stepFoot = new Uint8Array(5);
  private readonly revolutionThreatened = new Uint16Array(2);
  private readonly revolutionAnswered = new Uint16Array(2);
  private readonly revolutionParried = new Uint16Array(2);
  private readonly counter: BossCounterSummary = {
    threatened: 0,
    answered: 0,
    parried: 0,
    airborne: 0,
    hit: 0,
    lastParrierId: "",
  };
  private readonly addSpot0: Vec2 = { x: 0, y: 0 };
  private readonly addSpot1: Vec2 = { x: 0, y: 0 };
  private readonly addSpot2: Vec2 = { x: 0, y: 0 };
  private readonly addSpot3: Vec2 = { x: 0, y: 0 };
  private readonly addView1: readonly Vec2[];
  private readonly addView2: readonly Vec2[];
  private readonly addView3: readonly Vec2[];
  private readonly addView4: readonly Vec2[];
  private readonly poiIndex0: number;
  private readonly poiIndex1: number;
  private readonly poiX0: number;
  private readonly poiY0: number;
  private readonly poiX1: number;
  private readonly poiY1: number;
  private destroyedPoiCount = 0;

  constructor(
    private readonly def: VastagharEncounterDef,
    readonly state: VastagharBossState,
    private readonly maxHp: number,
    private readonly ownerId: string,
    spawnTick: number,
    poiIndex0 = VASTAGHAR_POI_NONE,
    poiX0 = 0,
    poiY0 = 0,
    poiIndex1 = VASTAGHAR_POI_NONE,
    poiX1 = 0,
    poiY1 = 0,
  ) {
    this.poiIndex0 = poiIndex0;
    this.poiIndex1 = poiIndex1;
    this.poiX0 = poiX0;
    this.poiY0 = poiY0;
    this.poiX1 = poiX1;
    this.poiY1 = poiY1;
    this.addView1 = [this.addSpot0];
    this.addView2 = [this.addSpot0, this.addSpot1];
    this.addView3 = [this.addSpot0, this.addSpot1, this.addSpot2];
    this.addView4 = [this.addSpot0, this.addSpot1, this.addSpot2, this.addSpot3];
    for (let i = 0; i < this.telegraphIds.length; i++) this.telegraphIds[i] = "";
    this.telegraphSettledGeneration.fill(-1);
    for (let i = 0; i < this.targetHistory.length; i++) this.targetHistory[i] = "";
    state.active = true;
    state.ownerId = ownerId;
    state.encounterSeq = bumpUint16(state.encounterSeq);
    state.mode = VastagharMode.Entrance;
    state.phase = VastagharPhase.LearnWeight;
    state.phaseStartTick = spawnTick >>> 0;
    state.maxHp = maxHp;
    state.storedDamage = 0;
    state.actionKind = VastagharActionKind.None;
    state.actionResult = VastagharActionResult.Pending;
    state.stridePips = 0;
    state.destroyedPoiMask = 0;
    state.arenaMutationPoiIndex = VASTAGHAR_POI_NONE;
    state.victoryStage = VastagharVictoryStage.None;
    state.victoryXp = 0;
    state.victoryEchoId = "";
    this.nextActionTick = (spawnTick + def.entranceDelayTicks) >>> 0;
    this.emitCue(VastagharActionKind.None, spawnTick);
  }

  get phase(): VastagharPhase {
    return this.state.phase as VastagharPhase;
  }

  get storedDamage(): number {
    return this.state.storedDamage;
  }

  get deferredAttribution(): Readonly<{
    sourcePlayerId: string;
    sourceWeaponId: string;
    delivery: number;
    sourceX: number;
    sourceY: number;
  }> {
    return {
      sourcePlayerId: this.deferredSourcePlayerId,
      sourceWeaponId: this.deferredSourceWeaponId,
      delivery: this.deferredDelivery,
      sourceX: this.deferredSourceX,
      sourceY: this.deferredSourceY,
    };
  }

  damageMultiplier(): number {
    return this.state.mode === VastagharMode.StrideBreak
      ? this.def.strideBreakDamageMultiplier
      : 1;
  }

  contactDamageEnabled(tick: number): boolean {
    if (!this.state.active || this.state.mode === VastagharMode.Victory) return false;
    if (
      this.state.mode === VastagharMode.Entrance ||
      this.state.mode === VastagharMode.Transition ||
      this.state.mode === VastagharMode.StrideBreak
    ) return false;
    return !(
      this.state.mode === VastagharMode.Punish &&
      vastagharTickReached(this.state.punishEndTick, tick + 1)
    );
  }

  /** Accepts every point of damage while admitting at most one authored threshold. Overflow is reapplied
   * after the visible phase beat and the next phase's mandatory signature, never discarded. */
  capIncomingDamage(
    hp: number,
    damage: number,
    sourcePlayerId: string,
    sourceWeaponId: string,
    delivery: number,
    sourceX: number,
    sourceY: number,
  ): number {
    const amount = Math.max(0, damage);
    if (amount <= 0 || this.state.mode === VastagharMode.Victory) return 0;
    if (this.phase >= VastagharPhase.FinalTread) return amount;
    const threshold = this.def.thresholds[this.phase - 1] ?? 0;
    const floorHp = this.maxHp * threshold;
    const admitted = Math.min(amount, Math.max(0, hp - floorHp));
    const overflow = amount - admitted;
    if (overflow > 0) {
      this.state.storedDamage = Math.min(Number.MAX_SAFE_INTEGER, this.state.storedDamage + overflow);
      this.pendingTransition = true;
      this.deferredSourcePlayerId = sourcePlayerId;
      this.deferredSourceWeaponId = sourceWeaponId;
      this.deferredDelivery = delivery;
      this.deferredSourceX = sourceX;
      this.deferredSourceY = sourceY;
    }
    return admitted;
  }

  step(
    dt: number,
    boss: EnemyState,
    targets: VastagharTarget[],
    depth: number,
    tick: number,
    sink: VastagharEmitSink,
    broadcastGeneration = tick,
  ): number {
    this.cleanupSettledTelegraphs(sink, broadcastGeneration);
    if (!this.state.active || this.state.mode === VastagharMode.Victory)
      return Math.max(1, this.state.phase);
    this.detectThreshold(boss);
    this.updateAntiKite(boss, targets);
    if (this.state.mode === VastagharMode.Transition) {
      if (vastagharTickReached(tick, this.transitionEndTick))
        this.finishTransition(boss, targets, tick, sink);
      return this.state.phase;
    }
    if (this.state.mode === VastagharMode.StrideBreak) {
      if (vastagharTickReached(tick, this.state.punishEndTick)) {
        this.state.stridePips = 0;
        this.state.punishEndTick = 0;
        this.state.mode =
          this.phase === VastagharPhase.FinalTread
            ? VastagharMode.Desperation
            : VastagharMode.Combat;
        this.currentAction = VastagharActionKind.None;
        this.currentDef = null;
        this.nextActionTick = (tick + 9) >>> 0;
        if (this.pendingTransition && this.phaseSignatureResolved) this.nextActionTick = tick >>> 0;
      }
      return this.state.phase;
    }
    if (this.currentAction !== VastagharActionKind.None) {
      this.stepAction(boss, targets, depth, tick, sink, broadcastGeneration);
      return this.state.phase;
    }
    if (!vastagharTickReached(tick, this.nextActionTick)) {
      this.moveNeutral(boss, targets, dt);
      this.maybeSpawnOptionalWave(boss, targets, tick, sink);
      return this.state.phase;
    }
    if (this.pendingTransition && this.phaseSignatureResolved) {
      if (
        this.phase === VastagharPhase.LearnWeight &&
        this.breakCountInPhase === 0 &&
        !this.transitionCourtesyUsed
      ) {
        this.transitionCourtesyUsed = true;
        this.startAction(VastagharActionKind.Crownstep, boss, targets, tick, sink, false);
      } else {
        this.startTransition(tick, sink);
      }
      return this.state.phase;
    }
    if (!this.tutorialStarted) {
      this.tutorialStarted = true;
      this.startAction(VastagharActionKind.Crownstep, boss, targets, tick, sink, true);
      return this.state.phase;
    }
    const next = this.selectNextAction(targets);
    this.startAction(next, boss, targets, tick, sink, false);
    return this.state.phase;
  }

  beginVictory(tick: number, sink: VastagharEmitSink): void {
    this.clearTelegraphs(sink);
    this.currentAction = VastagharActionKind.None;
    this.currentDef = null;
    this.state.mode = VastagharMode.Victory;
    this.state.phase = VastagharPhase.Defeated;
    this.state.actionSeq = bumpUint16(this.state.actionSeq);
    this.state.actionKind = VastagharActionKind.Death;
    this.state.actionResult = VastagharActionResult.Resolved;
    this.state.actionStartTick = tick >>> 0;
    this.state.actionResolveTick = tick >>> 0;
    this.state.actionActiveEndTick = (tick + VASTAGHAR_DEATH_TICKS) >>> 0;
    this.state.actionEndTick = (tick + VASTAGHAR_DEATH_TICKS) >>> 0;
    this.state.punishEndTick = 0;
    this.state.victoryStage = VastagharVictoryStage.ThreatEnded;
    this.state.victoryTick = tick >>> 0;
    this.victoryDeathTick = tick >>> 0;
    this.victoryXpRequested = false;
    this.emitCue(VastagharActionKind.Death, tick);
  }

  /** Returns true exactly once when the collapse has committed and the reserved XP crown may be minted. */
  advanceVictory(tick: number): boolean {
    if (this.state.mode !== VastagharMode.Victory) return false;
    const age = (tick - this.victoryDeathTick) >>> 0;
    if (age >= 2 && this.state.victoryStage < VastagharVictoryStage.Collapse)
      this.state.victoryStage = VastagharVictoryStage.Collapse;
    if (age >= VASTAGHAR_XP_CROWN_TICK && !this.victoryXpRequested) {
      this.victoryXpRequested = true;
      this.state.victoryStage = VastagharVictoryStage.XpCrown;
      return true;
    }
    if (age >= VASTAGHAR_DEATH_TICKS && this.state.victoryStage < VastagharVictoryStage.ReceiptHeld)
      this.state.victoryStage = VastagharVictoryStage.ReceiptHeld;
    return false;
  }

  setVictoryEcho(id: string, value: number): void {
    this.state.victoryEchoId = id;
    this.state.victoryXp = Math.max(0, Math.floor(value));
  }

  markRewardsOpen(tick: number): void {
    this.state.victoryStage = VastagharVictoryStage.RewardsOpen;
    this.state.victoryTick = tick >>> 0;
  }

  dispose(sink: VastagharEmitSink, clearState = true): void {
    this.clearTelegraphs(sink);
    this.currentAction = VastagharActionKind.None;
    this.currentDef = null;
    if (!clearState) return;
    this.state.active = false;
    this.state.ownerId = "";
    this.state.mode = VastagharMode.Inactive;
    this.state.phase = VastagharPhase.None;
    this.state.actionKind = VastagharActionKind.None;
    this.state.actionResult = VastagharActionResult.Cancelled;
    this.state.focusPlayerId = "";
    this.state.stridePips = 0;
    this.state.punishEndTick = 0;
    this.state.storedDamage = 0;
  }

  private detectThreshold(boss: EnemyState): void {
    if (this.phase >= VastagharPhase.FinalTread) return;
    const floor = this.maxHp * (this.def.thresholds[this.phase - 1] ?? 0);
    if (boss.hp <= floor + 1e-6) this.pendingTransition = true;
  }

  private selectNextAction(targets: VastagharTarget[]): VastagharActionKind {
    let living = 0;
    for (let i = 0; i < targets.length; i++) if (targets[i]?.alive) living++;
    if (this.phase === VastagharPhase.FinalTread && !this.finalTreadStarted) {
      this.finalTreadStarted = true;
      return VastagharActionKind.FinalTread;
    }
    if (living <= 1) return VastagharActionKind.Crownstep;
    if (this.forceMarch && this.phase >= VastagharPhase.BreakStride) {
      this.forceMarch = false;
      return VastagharActionKind.ThreefoldMarch;
    }
    const deck =
      this.phase === VastagharPhase.LearnWeight
        ? this.def.phaseOneDeck
        : this.phase === VastagharPhase.BreakStride
          ? this.def.phaseTwoDeck
          : this.phase === VastagharPhase.UnderHeel
            ? this.def.phaseThreeDeck
            : this.def.desperationDeck;
    if (deck.length === 0) return VastagharActionKind.Crownstep;
    const action = deck[this.deckIndex % deck.length] ?? VastagharActionKind.Crownstep;
    this.deckIndex = (this.deckIndex + 1) % deck.length;
    return action;
  }

  private startAction(
    kind: VastagharActionKind,
    boss: EnemyState,
    targets: VastagharTarget[],
    tick: number,
    sink: VastagharEmitSink,
    tutorial: boolean,
  ): void {
    const action = this.def.actions[kind];
    if (!action) return;
    this.clearTelegraphs(sink);
    this.currentAction = kind;
    this.currentDef = action;
    this.actionStartTick = tick >>> 0;
    this.actionAllAnswered = true;
    this.actionAnswerEpochs = 0;
    this.actionSuccessfulEpochs = 0;
    this.revolutionThreatened.fill(0);
    this.revolutionAnswered.fill(0);
    this.revolutionParried.fill(0);
    this.state.actionSeq = bumpUint16(this.state.actionSeq);
    this.state.actionKind = kind;
    this.state.actionResult = VastagharActionResult.Pending;
    this.state.actionStartTick = tick >>> 0;
    this.state.focusPlayerId = this.selectFocus(boss, targets, tick);
    const focus = this.targetById(targets, this.state.focusPlayerId);
    this.state.aim = focus ? Math.atan2(focus.y - boss.y, focus.x - boss.x) : 0;
    this.state.sourceFoot = action.stepFeet[0] ?? VastagharFoot.Body;
    this.state.revolutions = kind === VastagharActionKind.Worldwheel ? 2 : 0;
    this.state.stepIndex = 0;
    this.state.stepCount = action.stepOffsets.length;
    this.state.punishEndTick = 0;

    if (kind === VastagharActionKind.ShedMountain) {
      if (!this.startShedMountain(action, boss, targets, tick, sink)) {
        this.currentAction = VastagharActionKind.None;
        this.currentDef = null;
        this.startAction(VastagharActionKind.Crownstep, boss, targets, tick, sink, false);
      }
      return;
    }
    if (kind === VastagharActionKind.LandmarkBreak) {
      this.startLandmarkBreak(action, boss, focus, tick, sink);
      return;
    }
    if (kind === VastagharActionKind.HeelReap || kind === VastagharActionKind.Worldwheel) {
      this.startSweep(action, boss, tick, sink);
      return;
    }
    this.startFootSequence(action, boss, tick, sink, tutorial);
  }

  private startFootSequence(
    action: VastagharActionDef,
    boss: EnemyState,
    tick: number,
    sink: VastagharEmitSink,
    tutorial: boolean,
  ): void {
    const count = Math.min(5, action.stepOffsets.length);
    this.telegraphCount = count;
    this.state.stepCount = count;
    for (let i = 0; i < count; i++) {
      let foot = action.stepFeet[i] ?? VastagharFoot.Body;
      if (action.kind === VastagharActionKind.Crownstep)
        foot = ((this.state.actionSeq + i) & 1) === 0 ? VastagharFoot.InnerLeft : VastagharFoot.InnerRight;
      this.stepFoot[i] = foot;
      const advance = action.kind === VastagharActionKind.ThreefoldMarch ? i * 150 : 0;
      this.setFootPoint(boss, i, foot, advance);
      const radius = action.stepRadii[i] ?? action.stepRadii[0] ?? 360;
      this.telegraphIds[i] = sink.addTelegraph({
        shape: TgShape.Circle,
        x: this.stepX[i]!,
        y: this.stepY[i]!,
        a: radius,
        danger: TELEGRAPH_PARRYABLE,
        kindTag: BossTelegraphKindTag.Quake,
        ownerId: this.ownerId,
        castSeq: (this.state.actionSeq << 3) + i + 1,
      });
      this.telegraphSettledGeneration[i] = -1;
      this.telegraphResolved[i] = 0;
      sink.setTelegraphProgress(this.telegraphIds[i]!, i === 0 ? 0 : 0.04);
    }
    const firstOffset = tutorial ? 24 : (action.stepOffsets[0] ?? action.windupTicks);
    if (tutorial && count > 0) {
      this.actionResolveTick = (tick + firstOffset) >>> 0;
      this.actionActiveEndTick = this.actionResolveTick;
      this.actionEndTick = (this.actionResolveTick + 23) >>> 0;
    } else {
      const lastOffset = action.stepOffsets[count - 1] ?? action.windupTicks;
      this.actionResolveTick = (tick + (action.stepOffsets[0] ?? action.windupTicks)) >>> 0;
      this.actionActiveEndTick = (tick + lastOffset) >>> 0;
      this.actionEndTick = (this.actionActiveEndTick + action.recoveryTicks) >>> 0;
    }
    this.publishActionTicks();
    this.publishStep(0, tick, this.actionResolveTick);
  }

  private startShedMountain(
    action: VastagharActionDef,
    boss: EnemyState,
    targets: VastagharTarget[],
    tick: number,
    sink: VastagharEmitSink,
  ): boolean {
    this.telegraphCount = 0;
    const first = this.targetById(targets, this.state.focusPlayerId);
    if (first?.alive && this.mercySafe(first.x, first.y, targets, tick))
      this.addShedTelegraph(first.x, first.y, action, sink);
    const second = this.leastRecentlyTargeted(targets, first?.id ?? "", tick);
    if (
      this.telegraphCount < action.maxTargets &&
      second &&
      this.mercySafe(second.x, second.y, targets, tick)
    ) this.addShedTelegraph(second.x, second.y, action, sink);
    if (this.telegraphCount === 0) return false;
    this.actionResolveTick = (tick + action.windupTicks) >>> 0;
    this.actionActiveEndTick = this.actionResolveTick;
    this.actionEndTick = (this.actionResolveTick + action.recoveryTicks) >>> 0;
    this.state.stepCount = 1;
    this.publishActionTicks();
    this.publishStep(0, tick, this.actionResolveTick);
    this.state.sourceFoot = VastagharFoot.Body;
    this.state.impactX = this.stepX[0]!;
    this.state.impactY = this.stepY[0]!;
    return true;
  }

  private addShedTelegraph(
    x: number,
    y: number,
    action: VastagharActionDef,
    sink: VastagharEmitSink,
  ): void {
    const i = this.telegraphCount++;
    this.stepX[i] = x;
    this.stepY[i] = y;
    this.telegraphIds[i] = sink.addTelegraph({
      shape: TgShape.Circle,
      x,
      y,
      a: action.stepRadii[0] ?? 155,
      danger: TELEGRAPH_DODGE,
      kindTag: BossTelegraphKindTag.Slam,
      ownerId: this.ownerId,
      castSeq: (this.state.actionSeq << 3) + i + 1,
    });
    this.telegraphSettledGeneration[i] = -1;
    this.telegraphResolved[i] = 0;
  }

  private startLandmarkBreak(
    action: VastagharActionDef,
    boss: EnemyState,
    focus: VastagharTarget | null,
    tick: number,
    sink: VastagharEmitSink,
  ): void {
    let targetX = focus?.x ?? boss.x + Math.cos(this.state.aim) * 480;
    let targetY = focus?.y ?? boss.y + Math.sin(this.state.aim) * 480;
    const candidate = this.nextIntactPoi();
    if (candidate === this.poiIndex0) {
      targetX = this.poiX0;
      targetY = this.poiY0;
    } else if (candidate === this.poiIndex1) {
      targetX = this.poiX1;
      targetY = this.poiY1;
    }
    const dx = targetX - boss.x;
    const dy = targetY - boss.y;
    const rawLength = Math.hypot(dx, dy) || 1;
    const length = clamp(rawLength, 320, action.outerRange);
    const rot = Math.atan2(dy, dx);
    this.stepX[0] = boss.x;
    this.stepY[0] = boss.y;
    this.stepX[1] = boss.x + Math.cos(rot) * length;
    this.stepY[1] = boss.y + Math.sin(rot) * length;
    this.stepFoot[0] = candidate;
    this.state.aim = rot;
    this.state.impactX = this.stepX[1]!;
    this.state.impactY = this.stepY[1]!;
    this.telegraphCount = 1;
    this.telegraphIds[0] = sink.addTelegraph({
      shape: TgShape.Rect,
      x: boss.x,
      y: boss.y,
      a: length,
      b: action.halfWidth,
      rot,
      danger: TELEGRAPH_DODGE,
      kindTag: BossTelegraphKindTag.TitanLandmark,
      ownerId: this.ownerId,
      castSeq: (this.state.actionSeq << 3) + 1,
    });
    this.telegraphSettledGeneration[0] = -1;
    this.telegraphResolved[0] = 0;
    this.actionResolveTick = (tick + action.windupTicks) >>> 0;
    this.actionActiveEndTick = (this.actionResolveTick + action.activeTicks) >>> 0;
    this.actionEndTick = (this.actionActiveEndTick + action.recoveryTicks) >>> 0;
    this.state.stepCount = 1;
    this.publishActionTicks();
    this.publishStep(0, tick, this.actionResolveTick);
  }

  private startSweep(
    action: VastagharActionDef,
    boss: EnemyState,
    tick: number,
    sink: VastagharEmitSink,
  ): void {
    this.telegraphCount = 1;
    this.stepX[0] = boss.x;
    this.stepY[0] = boss.y;
    this.state.impactX = boss.x;
    this.state.impactY = boss.y;
    const startAngle =
      action.kind === VastagharActionKind.Worldwheel
        ? this.state.aim - Math.PI / 2
        : this.state.aim - action.sweepRadians / 2;
    this.stepX[1] = startAngle;
    this.telegraphIds[0] = sink.addTelegraph({
      shape: TgShape.ArcSweep,
      x: boss.x,
      y: boss.y,
      a: action.outerRange,
      b: action.halfWidth,
      rot: startAngle,
      danger: TELEGRAPH_PARRYABLE,
      kindTag: BossTelegraphKindTag.TitanSweep,
      ownerId: this.ownerId,
      castSeq: (this.state.actionSeq << 3) + 1,
    });
    this.telegraphSettledGeneration[0] = -1;
    this.telegraphResolved[0] = 0;
    this.actionResolveTick = (tick + action.windupTicks) >>> 0;
    this.actionActiveEndTick = (this.actionResolveTick + action.activeTicks) >>> 0;
    this.actionEndTick = (this.actionActiveEndTick + action.recoveryTicks) >>> 0;
    this.state.stepCount = 1;
    this.publishActionTicks();
    this.publishStep(0, tick, this.actionResolveTick);
  }

  private stepAction(
    boss: EnemyState,
    targets: VastagharTarget[],
    depth: number,
    tick: number,
    sink: VastagharEmitSink,
    broadcastGeneration: number,
  ): void {
    const action = this.currentDef;
    if (!action) return;
    if (this.currentAction === VastagharActionKind.LandmarkBreak)
      this.stepLandmarkBreak(boss, action, depth, tick, sink, broadcastGeneration);
    else if (
      this.currentAction === VastagharActionKind.HeelReap ||
      this.currentAction === VastagharActionKind.Worldwheel
    ) this.stepSweep(boss, action, depth, tick, sink, broadcastGeneration);
    else if (this.currentAction === VastagharActionKind.ShedMountain)
      this.stepShedMountain(action, depth, tick, sink, broadcastGeneration);
    else this.stepFootSequence(boss, action, depth, tick, sink, broadcastGeneration);
    if (
      this.currentAction !== VastagharActionKind.None &&
      vastagharTickReached(tick, this.actionEndTick)
    ) this.finishAction(boss, targets, tick, sink);
  }

  private stepFootSequence(
    boss: EnemyState,
    action: VastagharActionDef,
    depth: number,
    tick: number,
    sink: VastagharEmitSink,
    broadcastGeneration: number,
  ): void {
    for (let i = 0; i < this.telegraphCount; i++) {
      if (this.telegraphResolved[i] !== 0) continue;
      const authoredOffset = action.stepOffsets[i] ?? action.windupTicks;
      const resolveTick =
        this.tutorialStarted && !this.tutorialFinished && action.kind === VastagharActionKind.Crownstep
          ? this.actionResolveTick
          : (this.actionStartTick + authoredOffset) >>> 0;
      if (!vastagharTickReached(tick, resolveTick)) {
        const start = i === 0 ? this.actionStartTick : (this.actionStartTick + (action.stepOffsets[i - 1] ?? 0)) >>> 0;
        const span = Math.max(1, (resolveTick - start) >>> 0);
        const elapsed = Math.min(span, (tick - start) >>> 0);
        sink.setTelegraphProgress(this.telegraphIds[i]!, 0.04 + 0.96 * (elapsed / span));
        continue;
      }
      this.telegraphResolved[i] = 1;
      sink.setTelegraphProgress(this.telegraphIds[i]!, 1);
      this.telegraphSettledGeneration[i] = broadcastGeneration;
      if (action.kind === VastagharActionKind.ThreefoldMarch) {
        boss.x = clamp(this.stepX[i]! - this.footOffsetX(this.stepFoot[i]!, this.state.aim), 230, ARENA_WIDTH - 230);
        boss.y = clamp(this.stepY[i]! - this.footOffsetY(this.stepFoot[i]!, this.state.aim), 230, ARENA_HEIGHT - 230);
      }
      this.resetCounter();
      sink.applyVastagharQuake(
        this.stepX[i]!,
        this.stepY[i]!,
        action.stepRadii[i] ?? action.stepRadii[0] ?? 360,
        (action.stepDamage[i] ?? action.stepDamage[0] ?? 24) * depthDamageScale(depth),
        action.stepKnockback[i] ?? action.stepKnockback[0] ?? 900,
        (this.state.actionSeq << 3) + i + 1,
        this.counter,
      );
      const success = this.acceptCounter(this.counter);
      this.actionAnswerEpochs++;
      if (success) this.actionSuccessfulEpochs++;
      else this.actionAllAnswered = false;
      this.state.actionResult = VastagharActionResult.Resolved;
      if (i + 1 < this.telegraphCount) {
        const nextResolve = (this.actionStartTick + (action.stepOffsets[i + 1] ?? 0)) >>> 0;
        this.publishStep(i + 1, resolveTick, nextResolve);
      }
      if (this.state.stridePips >= this.def.strideBreakPips) {
        this.beginStrideBreak(tick, sink);
        return;
      }
      if (i + 1 === this.telegraphCount) {
        this.phaseSignatureResolved = true;
        if (this.actionAllAnswered && this.actionSuccessfulEpochs === this.actionAnswerEpochs)
          this.openEarnedPunish(this.actionEndTick);
      }
    }
  }

  private stepShedMountain(
    action: VastagharActionDef,
    depth: number,
    tick: number,
    sink: VastagharEmitSink,
    broadcastGeneration: number,
  ): void {
    if (this.telegraphResolved[0] === 0 && vastagharTickReached(tick, this.actionResolveTick)) {
      for (let i = 0; i < this.telegraphCount; i++) {
        sink.setTelegraphProgress(this.telegraphIds[i]!, 1);
        this.telegraphResolved[i] = 1;
        this.telegraphSettledGeneration[i] = broadcastGeneration;
        sink.applyAoE(
          this.stepX[i]!,
          this.stepY[i]!,
          action.stepRadii[0] ?? 155,
          (action.stepDamage[0] ?? 20) * depthDamageScale(depth),
          action.stepKnockback[0] ?? 650,
        );
      }
      this.state.actionResult = VastagharActionResult.Resolved;
    } else if (this.telegraphResolved[0] === 0) {
      const elapsed = (tick - this.actionStartTick) >>> 0;
      const t = Math.min(1, elapsed / Math.max(1, action.windupTicks));
      for (let i = 0; i < this.telegraphCount; i++) sink.setTelegraphProgress(this.telegraphIds[i]!, t);
    }
  }

  private stepLandmarkBreak(
    boss: EnemyState,
    action: VastagharActionDef,
    depth: number,
    tick: number,
    sink: VastagharEmitSink,
    broadcastGeneration: number,
  ): void {
    if (!vastagharTickReached(tick, this.actionResolveTick)) {
      const elapsed = (tick - this.actionStartTick) >>> 0;
      sink.setTelegraphProgress(this.telegraphIds[0]!, Math.min(1, elapsed / Math.max(1, action.windupTicks)));
      return;
    }
    if (!vastagharTickReached(tick, this.actionActiveEndTick)) {
      const activeElapsed = Math.min(action.activeTicks, ((tick - this.actionResolveTick) >>> 0) + 1);
      const frac = activeElapsed / Math.max(1, action.activeTicks);
      boss.x = clamp(this.stepX[0]! + (this.stepX[1]! - this.stepX[0]!) * frac, 230, ARENA_WIDTH - 230);
      boss.y = clamp(this.stepY[0]! + (this.stepY[1]! - this.stepY[0]!) * frac, 230, ARENA_HEIGHT - 230);
      sink.damageRect(
        this.stepX[0]!,
        this.stepY[0]!,
        Math.hypot(this.stepX[1]! - this.stepX[0]!, this.stepY[1]! - this.stepY[0]!),
        action.halfWidth,
        this.state.aim,
        ((action.stepDamage[0] ?? 24) * depthDamageScale(depth)) / Math.max(1, action.activeTicks),
        (action.stepKnockback[0] ?? 720) / Math.max(1, action.activeTicks),
      );
      return;
    }
    if (this.telegraphResolved[0] === 0) {
      this.telegraphResolved[0] = 1;
      sink.setTelegraphProgress(this.telegraphIds[0]!, 1);
      this.telegraphSettledGeneration[0] = broadcastGeneration;
      const poiIndex = this.stepFoot[0]!;
      if (poiIndex !== VASTAGHAR_POI_NONE)
        this.emitArenaMutation(VastagharArenaMutationKind.LandmarkBreak, poiIndex, tick, sink);
      this.state.actionResult = VastagharActionResult.Resolved;
    }
  }

  private stepSweep(
    boss: EnemyState,
    action: VastagharActionDef,
    depth: number,
    tick: number,
    sink: VastagharEmitSink,
    broadcastGeneration: number,
  ): void {
    if (!vastagharTickReached(tick, this.actionResolveTick)) {
      const elapsed = (tick - this.actionStartTick) >>> 0;
      sink.setTelegraphProgress(this.telegraphIds[0]!, Math.min(1, elapsed / Math.max(1, action.windupTicks)));
      return;
    }
    if (!vastagharTickReached(tick, this.actionActiveEndTick)) {
      const activeElapsed = Math.min(action.activeTicks, ((tick - this.actionResolveTick) >>> 0) + 1);
      const previous = Math.max(0, activeElapsed - 1) / Math.max(1, action.activeTicks);
      const current = activeElapsed / Math.max(1, action.activeTicks);
      const from = this.stepX[1]! + action.sweepRadians * previous;
      const to = this.stepX[1]! + action.sweepRadians * current;
      const midTravel = action.sweepRadians * ((previous + current) * 0.5);
      const revolution = Math.min(1, Math.floor(Math.abs(midTravel) / VASTAGHAR_TAU));
      sink.updateTelegraphGeom(
        this.telegraphIds[0]!,
        boss.x,
        boss.y,
        action.outerRange,
        action.halfWidth,
        to,
      );
      this.resetCounter();
      sink.applyVastagharSweep(
        boss.x,
        boss.y,
        action.innerRange,
        action.outerRange,
        action.halfWidth,
        from,
        to,
        (action.stepDamage[revolution] ?? action.stepDamage[0] ?? 16) * depthDamageScale(depth),
        action.stepKnockback[revolution] ?? action.stepKnockback[0] ?? 380,
        this.state.actionSeq,
        revolution,
        action.kind === VastagharActionKind.Worldwheel,
        this.counter,
      );
      this.revolutionThreatened[revolution] = Math.min(
        0xffff,
        this.revolutionThreatened[revolution]! + this.counter.threatened,
      );
      this.revolutionAnswered[revolution] = Math.min(
        0xffff,
        this.revolutionAnswered[revolution]! + this.counter.answered,
      );
      this.revolutionParried[revolution] = Math.min(
        0xffff,
        this.revolutionParried[revolution]! + this.counter.parried,
      );
      if (this.counter.lastParrierId) this.lastParrierId = this.counter.lastParrierId;
      return;
    }
    if (this.telegraphResolved[0] === 0) {
      this.telegraphResolved[0] = 1;
      sink.setTelegraphProgress(this.telegraphIds[0]!, 1);
      this.telegraphSettledGeneration[0] = broadcastGeneration;
      const revolutions = action.kind === VastagharActionKind.Worldwheel ? 2 : 1;
      for (let revolution = 0; revolution < revolutions; revolution++) {
        const summary = this.counter;
        summary.threatened = this.revolutionThreatened[revolution]!;
        summary.answered = this.revolutionAnswered[revolution]!;
        summary.parried = this.revolutionParried[revolution]!;
        summary.airborne = 0;
        summary.hit = Math.max(0, summary.threatened - summary.answered);
        summary.lastParrierId = this.lastParrierId;
        const success = this.acceptCounter(summary);
        this.actionAnswerEpochs++;
        if (success) this.actionSuccessfulEpochs++;
        else this.actionAllAnswered = false;
        if (this.state.stridePips >= this.def.strideBreakPips) {
          this.beginStrideBreak(tick, sink);
          return;
        }
      }
      this.phaseSignatureResolved = true;
      this.state.actionResult = VastagharActionResult.Resolved;
      if (this.actionAllAnswered && this.actionSuccessfulEpochs === this.actionAnswerEpochs)
        this.openEarnedPunish(this.actionEndTick);
    }
  }

  private finishAction(
    _boss: EnemyState,
    _targets: VastagharTarget[],
    tick: number,
    sink: VastagharEmitSink,
  ): void {
    const finished = this.currentAction;
    if (finished === VastagharActionKind.Crownstep && !this.tutorialFinished) {
      this.tutorialFinished = true;
      this.state.phaseStartTick = tick >>> 0;
    }
    if (this.state.mode === VastagharMode.Punish) {
      this.state.mode =
        this.phase === VastagharPhase.FinalTread
          ? VastagharMode.Desperation
          : VastagharMode.Combat;
      this.state.punishEndTick = 0;
    }
    this.currentAction = VastagharActionKind.None;
    this.currentDef = null;
    const neutral = this.def.neutralTicks[finished] ?? 10;
    this.nextActionTick = (tick + neutral) >>> 0;
    if (this.pendingTransition && this.phaseSignatureResolved) this.nextActionTick = tick >>> 0;
    this.cleanupSettledTelegraphs(sink, tick + 1);
    this.maybeStartFinalTreadAgainGuard(finished);
  }

  private maybeStartFinalTreadAgainGuard(finished: VastagharActionKind): void {
    if (finished !== VastagharActionKind.FinalTread) return;
    this.deckIndex = 0;
  }

  private acceptCounter(summary: BossCounterSummary): boolean {
    if (summary.threatened <= 0) return false;
    const success = summary.answered * 2 >= summary.threatened;
    if (success) this.state.stridePips = Math.min(this.def.strideBreakPips, this.state.stridePips + 1);
    if (summary.parried > 0) {
      this.state.stridePips = Math.min(this.def.strideBreakPips, this.state.stridePips + 1);
      if (summary.lastParrierId) this.lastParrierId = summary.lastParrierId;
    }
    return success;
  }

  private beginStrideBreak(tick: number, sink: VastagharEmitSink): void {
    this.cancelUnresolvedTelegraphs(sink);
    this.state.actionResult = VastagharActionResult.Countered;
    this.state.actionSeq = bumpUint16(this.state.actionSeq);
    this.state.actionKind = VastagharActionKind.StrideBreak;
    this.state.actionStartTick = tick >>> 0;
    this.state.actionResolveTick = tick >>> 0;
    this.state.actionActiveEndTick = (tick + this.def.strideBreakTicks) >>> 0;
    this.state.actionEndTick = (tick + this.def.strideBreakTicks) >>> 0;
    this.state.mode = VastagharMode.StrideBreak;
    this.state.punishEndTick = (tick + this.def.strideBreakTicks) >>> 0;
    this.currentAction = VastagharActionKind.None;
    this.currentDef = null;
    this.breakCountInPhase++;
    this.phaseSignatureResolved = true;
    this.emitCue(VastagharActionKind.StrideBreak, tick);
  }

  private openEarnedPunish(endTick: number): void {
    this.state.mode = VastagharMode.Punish;
    this.state.punishEndTick = endTick >>> 0;
  }

  private startTransition(tick: number, sink: VastagharEmitSink): void {
    this.clearTelegraphs(sink);
    this.state.mode = VastagharMode.Transition;
    this.state.actionSeq = bumpUint16(this.state.actionSeq);
    this.state.actionKind =
      this.phase === VastagharPhase.LearnWeight
        ? VastagharActionKind.PhaseStuckStep
        : VastagharActionKind.PhaseWorldTurn;
    this.state.actionResult = VastagharActionResult.Pending;
    this.state.actionStartTick = tick >>> 0;
    this.state.actionResolveTick = (tick + this.def.transitionTicks) >>> 0;
    this.state.actionActiveEndTick = this.state.actionResolveTick;
    this.state.actionEndTick = this.state.actionResolveTick;
    this.transitionEndTick = this.state.actionEndTick;
    this.emitCue(this.state.actionKind as VastagharActionKind, tick);
  }

  private finishTransition(
    boss: EnemyState,
    targets: VastagharTarget[],
    tick: number,
    sink: VastagharEmitSink,
  ): void {
    const leaving = this.phase;
    if (leaving === VastagharPhase.LearnWeight) {
      this.emitArenaMutation(VastagharArenaMutationKind.StuckStep, this.poiIndex0, tick, sink);
    } else if (leaving === VastagharPhase.BreakStride) {
      this.emitArenaMutation(VastagharArenaMutationKind.WorldTurn, VASTAGHAR_POI_NONE, tick, sink);
    }
    this.state.actionResult = VastagharActionResult.Resolved;
    this.state.phase = Math.min(VastagharPhase.FinalTread, leaving + 1);
    this.state.phaseStartTick = tick >>> 0;
    this.state.mode =
      this.phase === VastagharPhase.FinalTread
        ? VastagharMode.Desperation
        : VastagharMode.Combat;
    this.phaseSignatureResolved = false;
    this.pendingTransition = false;
    this.transitionCourtesyUsed = false;
    this.breakCountInPhase = 0;
    this.deckIndex = 0;
    this.releaseStoredDamage(boss);
    this.nextActionTick = (tick + this.def.transitionClaimDelayTicks) >>> 0;
    if (this.phase === VastagharPhase.UnderHeel)
      this.spawnAddWave(boss, targets, tick, sink, true);
    if (this.phase === VastagharPhase.FinalTread) {
      this.currentAction = VastagharActionKind.None;
      this.currentDef = null;
      this.nextActionTick = (tick + 12) >>> 0;
      this.deckIndex = 0;
    }
  }

  private releaseStoredDamage(boss: EnemyState): void {
    const stored = this.state.storedDamage;
    if (stored <= 0) return;
    let release = stored;
    if (this.phase < VastagharPhase.FinalTread) {
      const nextFloor = this.maxHp * (this.def.thresholds[this.phase - 1] ?? 0);
      release = Math.min(stored, Math.max(0, boss.hp - nextFloor));
    }
    boss.hp -= release;
    this.state.storedDamage = Math.max(0, stored - release);
    if (this.phase < VastagharPhase.FinalTread) {
      const floor = this.maxHp * (this.def.thresholds[this.phase - 1] ?? 0);
      if (boss.hp <= floor + 1e-6 || this.state.storedDamage > 0) this.pendingTransition = true;
    }
  }

  private emitArenaMutation(
    kind: VastagharArenaMutationKind,
    poiIndex: number,
    tick: number,
    sink: VastagharEmitSink,
  ): void {
    let resolvedPoi = poiIndex;
    if (
      resolvedPoi < 0 ||
      resolvedPoi >= 32 ||
      resolvedPoi === VASTAGHAR_POI_NONE ||
      this.destroyedPoiCount >= this.def.maxDestroyedPois ||
      (this.state.destroyedPoiMask & (1 << resolvedPoi)) !== 0
    ) resolvedPoi = VASTAGHAR_POI_NONE;
    if (resolvedPoi !== VASTAGHAR_POI_NONE) {
      this.state.destroyedPoiMask = (this.state.destroyedPoiMask | (1 << resolvedPoi)) >>> 0;
      this.destroyedPoiCount++;
    }
    this.state.arenaMutationSeq = bumpUint16(this.state.arenaMutationSeq);
    this.state.arenaMutationKind = kind;
    this.state.arenaMutationTick = tick >>> 0;
    this.state.arenaMutationPoiIndex = resolvedPoi;
    this.state.arenaPaintStep = Math.min(2, this.state.arenaPaintStep + 1);
    if (kind === VastagharArenaMutationKind.WorldTurn) this.state.arenaPaintRotation = Math.PI / 4;
    sink.mutateVastagharArena(kind, resolvedPoi);
  }

  private nextIntactPoi(): number {
    if (
      this.poiIndex0 !== VASTAGHAR_POI_NONE &&
      (this.state.destroyedPoiMask & (1 << this.poiIndex0)) === 0
    ) return this.poiIndex0;
    if (
      this.poiIndex1 !== VASTAGHAR_POI_NONE &&
      (this.state.destroyedPoiMask & (1 << this.poiIndex1)) === 0
    ) return this.poiIndex1;
    return VASTAGHAR_POI_NONE;
  }

  private spawnAddWave(
    boss: EnemyState,
    targets: VastagharTarget[],
    tick: number,
    sink: VastagharEmitSink,
    authored: boolean,
  ): void {
    let living = 0;
    for (let i = 0; i < targets.length; i++) if (targets[i]?.alive) living++;
    if (living <= 1 || sink.aliveAdds() > 1) return;
    const room = Math.max(0, this.def.addCap - sink.aliveAdds());
    const count = Math.min(room, Math.min(this.def.addCap, living + 1));
    if (count <= 0) return;
    const spots = [this.addSpot0, this.addSpot1, this.addSpot2, this.addSpot3];
    for (let i = 0; i < 4; i++) {
      const angle = this.state.aim + (i / 4) * VASTAGHAR_TAU;
      spots[i]!.x = clamp(boss.x + Math.cos(angle) * 300, 24, ARENA_WIDTH - 24);
      spots[i]!.y = clamp(boss.y + Math.sin(angle) * 300, 24, ARENA_HEIGHT - 24);
    }
    sink.spawnAdds(
      "mote-swarm",
      count === 1 ? this.addView1 : count === 2 ? this.addView2 : count === 3 ? this.addView3 : this.addView4,
    );
    this.lastWaveTick = tick >>> 0;
    if (authored) this.authoredWaveSpawned = true;
    else this.optionalWaveSpawned = true;
  }

  private maybeSpawnOptionalWave(
    boss: EnemyState,
    targets: VastagharTarget[],
    tick: number,
    sink: VastagharEmitSink,
  ): void {
    if (
      this.phase !== VastagharPhase.UnderHeel ||
      !this.authoredWaveSpawned ||
      this.optionalWaveSpawned ||
      boss.hp / this.maxHp > 0.18 ||
      ((tick - this.lastWaveTick) >>> 0) < VASTAGHAR_OPTIONAL_ADD_DELAY_TICKS ||
      sink.aliveAdds() > 0
    ) return;
    this.spawnAddWave(boss, targets, tick, sink, false);
  }

  private updateAntiKite(boss: EnemyState, targets: VastagharTarget[]): void {
    let living = 0;
    let allFar = true;
    const r2 = VASTAGHAR_ANTI_KITE_DISTANCE * VASTAGHAR_ANTI_KITE_DISTANCE;
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      if (!target?.alive) continue;
      living++;
      const dx = target.x - boss.x;
      const dy = target.y - boss.y;
      if (dx * dx + dy * dy <= r2) allFar = false;
    }
    this.kiteTicks = living > 0 && allFar ? this.kiteTicks + 1 : 0;
    if (this.kiteTicks >= VASTAGHAR_ANTI_KITE_TICKS) {
      this.forceMarch = true;
      this.kiteTicks = 0;
    }
  }

  private moveNeutral(boss: EnemyState, targets: VastagharTarget[], dt: number): void {
    const target = this.targetById(targets, this.state.focusPlayerId) ?? this.firstLiving(targets);
    if (!target) return;
    const dx = target.x - boss.x;
    const dy = target.y - boss.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance <= 260) return;
    const travel = Math.min(distance - 260, 40 * dt);
    boss.x = clamp(boss.x + (dx / distance) * travel, 230, ARENA_WIDTH - 230);
    boss.y = clamp(boss.y + (dy / distance) * travel, 230, ARENA_HEIGHT - 230);
  }

  private selectFocus(boss: EnemyState, targets: VastagharTarget[], tick: number): string {
    let totalDamage = 0;
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      if (target?.alive) totalDamage += Math.max(0, target.recentBossDamage);
    }
    let bestId = "";
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      if (!target?.alive) continue;
      if (this.consecutiveFocus >= 2 && target.id === this.lastFocusId && this.livingTargets(targets) > 1)
        continue;
      const distance = Math.hypot(target.x - boss.x, target.y - boss.y);
      let score = target.id === this.state.focusPlayerId ? 40 : 0;
      if (totalDamage > 0) score += 35 * (Math.max(0, target.recentBossDamage) / totalDamage);
      if (target.id === this.lastParrierId) score += 25;
      score += 30 * clamp((720 - distance) / Math.max(1, 720 - 230), 0, 1);
      if (!this.mercySafe(target.x, target.y, targets, tick)) score -= 100;
      if (score > bestScore || (score === bestScore && (bestId === "" || target.id.localeCompare(bestId) < 0))) {
        bestScore = score;
        bestId = target.id;
      }
    }
    if (!bestId) bestId = this.firstLiving(targets)?.id ?? "";
    if (bestId === this.lastFocusId) this.consecutiveFocus++;
    else {
      this.lastFocusId = bestId;
      this.consecutiveFocus = 1;
    }
    if (bestId) {
      this.targetHistory[this.targetHistoryCursor] = bestId;
      this.targetHistoryCursor = (this.targetHistoryCursor + 1) % this.targetHistory.length;
      this.targetHistorySize = Math.min(this.targetHistory.length, this.targetHistorySize + 1);
    }
    return bestId;
  }

  private leastRecentlyTargeted(
    targets: VastagharTarget[],
    excludeId: string,
    tick: number,
  ): VastagharTarget | null {
    let best: VastagharTarget | null = null;
    let bestCount = Number.POSITIVE_INFINITY;
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      if (!target?.alive || target.id === excludeId || !this.mercySafe(target.x, target.y, targets, tick))
        continue;
      let count = 0;
      for (let h = 0; h < this.targetHistorySize; h++) if (this.targetHistory[h] === target.id) count++;
      if (count < bestCount || (count === bestCount && (!best || target.id.localeCompare(best.id) < 0))) {
        best = target;
        bestCount = count;
      }
    }
    return best;
  }

  private mercySafe(x: number, y: number, targets: VastagharTarget[], tick: number): boolean {
    const r2 = VASTAGHAR_MERCY_RADIUS * VASTAGHAR_MERCY_RADIUS;
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      if (!target || target.alive || ((tick - target.downTick) >>> 0) >= VASTAGHAR_MERCY_TICKS) continue;
      const dx = target.x - x;
      const dy = target.y - y;
      if (dx * dx + dy * dy < r2) return false;
    }
    return true;
  }

  private livingTargets(targets: VastagharTarget[]): number {
    let count = 0;
    for (let i = 0; i < targets.length; i++) if (targets[i]?.alive) count++;
    return count;
  }

  private firstLiving(targets: VastagharTarget[]): VastagharTarget | null {
    let best: VastagharTarget | null = null;
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      if (!target?.alive) continue;
      if (!best || target.id.localeCompare(best.id) < 0) best = target;
    }
    return best;
  }

  private targetById(targets: VastagharTarget[], id: string): VastagharTarget | null {
    for (let i = 0; i < targets.length; i++) if (targets[i]?.id === id) return targets[i] ?? null;
    return null;
  }

  private setFootPoint(boss: EnemyState, index: number, foot: number, advance: number): void {
    const fx = Math.cos(this.state.aim);
    const fy = Math.sin(this.state.aim);
    const rx = -fy;
    const ry = fx;
    let forward = 0;
    let side = 0;
    if (foot === VastagharFoot.OuterLeft) {
      forward = 70;
      side = -145;
    } else if (foot === VastagharFoot.OuterRight) {
      forward = 70;
      side = 145;
    } else if (foot === VastagharFoot.InnerLeft) {
      forward = -70;
      side = -80;
    } else if (foot === VastagharFoot.InnerRight) {
      forward = -70;
      side = 80;
    }
    this.stepX[index] = boss.x + fx * (forward + advance) + rx * side;
    this.stepY[index] = boss.y + fy * (forward + advance) + ry * side;
  }

  private footOffsetX(foot: number, aim: number): number {
    const fx = Math.cos(aim);
    const rx = -Math.sin(aim);
    if (foot === VastagharFoot.OuterLeft) return fx * 70 + rx * -145;
    if (foot === VastagharFoot.OuterRight) return fx * 70 + rx * 145;
    if (foot === VastagharFoot.InnerLeft) return fx * -70 + rx * -80;
    if (foot === VastagharFoot.InnerRight) return fx * -70 + rx * 80;
    return 0;
  }

  private footOffsetY(foot: number, aim: number): number {
    const fy = Math.sin(aim);
    const ry = Math.cos(aim);
    if (foot === VastagharFoot.OuterLeft) return fy * 70 + ry * -145;
    if (foot === VastagharFoot.OuterRight) return fy * 70 + ry * 145;
    if (foot === VastagharFoot.InnerLeft) return fy * -70 + ry * -80;
    if (foot === VastagharFoot.InnerRight) return fy * -70 + ry * 80;
    return 0;
  }

  private publishActionTicks(): void {
    this.state.actionResolveTick = this.actionResolveTick;
    this.state.actionActiveEndTick = this.actionActiveEndTick;
    this.state.actionEndTick = this.actionEndTick;
  }

  private publishStep(index: number, startTick: number, resolveTick: number): void {
    this.state.stepSeq = bumpUint16(this.state.stepSeq);
    this.state.stepIndex = index;
    this.state.stepStartTick = startTick >>> 0;
    this.state.stepResolveTick = resolveTick >>> 0;
    this.state.responseOpenTick = (resolveTick - this.def.responseWindowTicks) >>> 0;
    this.state.sourceFoot = this.stepFoot[index] ?? VastagharFoot.Body;
    this.state.impactX = this.stepX[index] ?? 0;
    this.state.impactY = this.stepY[index] ?? 0;
  }

  private emitCue(kind: VastagharActionKind, tick: number): void {
    this.state.cueSeq = bumpUint16(this.state.cueSeq);
    this.state.cueKind = kind;
    this.state.cueTick = tick >>> 0;
  }

  private resetCounter(): void {
    this.counter.threatened = 0;
    this.counter.answered = 0;
    this.counter.parried = 0;
    this.counter.airborne = 0;
    this.counter.hit = 0;
    this.counter.lastParrierId = "";
  }

  private cleanupSettledTelegraphs(sink: VastagharEmitSink, generation: number): void {
    for (let i = 0; i < this.telegraphCount; i++) {
      const id = this.telegraphIds[i];
      const settled = this.telegraphSettledGeneration[i]!;
      if (!id || settled < 0 || generation <= settled) continue;
      sink.removeTelegraph(id);
      this.telegraphIds[i] = "";
      this.telegraphSettledGeneration[i] = -1;
    }
  }

  private cancelUnresolvedTelegraphs(sink: VastagharEmitSink): void {
    for (let i = 0; i < this.telegraphCount; i++) {
      const id = this.telegraphIds[i];
      if (!id || this.telegraphResolved[i] !== 0) continue;
      sink.removeTelegraph(id);
      this.telegraphIds[i] = "";
    }
  }

  private clearTelegraphs(sink: VastagharEmitSink): void {
    for (let i = 0; i < this.telegraphCount; i++) {
      const id = this.telegraphIds[i];
      if (id) sink.removeTelegraph(id);
      this.telegraphIds[i] = "";
      this.telegraphSettledGeneration[i] = -1;
      this.telegraphResolved[i] = 0;
    }
    this.telegraphCount = 0;
  }
}
