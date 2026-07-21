import {
  CombatDelivery,
  type PlayerState,
  TICK_MS,
  ULT_ALPHA_HIT_TICKS,
  ULT_DOOR_DECOY_SECONDS,
  ULT_DOOR_RETURN_SECONDS,
  ULT_NUKE_RADIUS,
  ULT_RECOVERY_TICKS,
  ULT_SEISMARCH_INNER_RADIUS,
  ULT_SEISMARCH_MID_RADIUS,
  ULT_SEISMARCH_OUTER_RADIUS,
  UltimateFamily,
  UltimatePhase,
  ultimateFamilyForCode,
  ultimateVariantForCode,
} from "@dd/shared";
import type Phaser from "phaser";
import { elementPack, paintedParticlePixels, particleBurst } from "./particles.js";

/** Named ultimate bands. Every value is below protected response tells (99997) and HUD (100000). */
export const ULTIMATE_VFX_DEPTH = {
  GroundResidue: 2,
  CometGroundLight: 2,
  AirBody: 99540,
  AirImpact: 99620,
  FriendlyMark: 99700,
  LocalAccent: 99850,
} as const;

const CAST_AFTER_MS = 2_600;
const REMOTE_FULL_LIMIT = 2;
const SPARKLE_CAP = 16;
const COMET_CAP = 12;
const TAU = Math.PI * 2;

const FAMILY_COLOR: Readonly<Record<number, number>> = {
  [UltimateFamily.Seismarch]: 0x9fcf8f,
  [UltimateFamily.AlphaStrike]: 0x78c9df,
  [UltimateFamily.SunspiteComet]: 0xd9a85f,
  [UltimateFamily.EventHorizon]: 0x9b75d6,
  [UltimateFamily.DimensionDoor]: 0x8f82d8,
};

const FAMILY_ELEMENT: Readonly<Record<number, string>> = {
  [UltimateFamily.Seismarch]: "steel",
  [UltimateFamily.AlphaStrike]: "shock",
  [UltimateFamily.SunspiteComet]: "fire",
  [UltimateFamily.EventHorizon]: "void",
  [UltimateFamily.DimensionDoor]: "arcane",
};

export interface UltimatePlayerRows {
  forEach(callback: (player: PlayerState, id: string) => void): void;
}

export interface UltimatePoint {
  x: number;
  y: number;
}

export interface UltimateVfxCallbacks {
  actor(ownerId: string, out: UltimatePoint): boolean;
  target(targetId: string, out: UltimatePoint): boolean;
  projectY(worldY: number): number;
  projectionYScale(): number;
  visible(x: number, y: number): boolean;
  audio(cue: string, x: number, amount: number): void;
  arrival(ownerId: string, clockMs: number): void;
  paperCopy(ownerId: string, x: number, y: number): Phaser.GameObjects.Container | undefined;
  connectAccent(family: number, x: number, y: number, stopMs: number): void;
}

export interface UltimateCastCue {
  ownerId: string;
  seq: number;
  code: number;
  phase: number;
  startTick: number;
  resolveTick: number;
  endTick: number;
  targetX: number;
  targetY: number;
  originX: number;
  originY: number;
  isSelf: boolean;
  nowMs: number;
}

export interface UltimateReceiptCue {
  sourcePlayerId: string;
  targetId: string;
  weaponId: string;
  delivery: number;
  tick: number;
  crit: boolean;
  finalBlow: boolean;
  x: number;
  y: number;
}

interface CastPresentation extends UltimateCastCue {
  family: number;
  variant: string;
  activeEndTick: number;
  acceptedAtMs: number;
  predicted: boolean;
  currentPhase: number;
  executionFired: boolean;
  finishFired: boolean;
  arrivalFired: boolean;
  connectCount: number;
  accentFired: boolean;
  full: boolean;
  lastHop: number;
  trailCount: number;
  trailX: Float32Array;
  trailY: Float32Array;
  isDoorReturn: boolean;
}

interface DoorTicket {
  originX: number;
  originY: number;
  opensTick: number;
  copyEndTick: number;
  expiresTick: number;
}

interface BrandMark {
  targetId: string;
  untilMs: number;
}

interface SparkleRow {
  active: boolean;
  x: number;
  y: number;
  bornMs: number;
  color: number;
}

interface CometRow {
  id: string;
  seen: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function tickSpan(after: number, before: number): number {
  return (after - before) >>> 0;
}

function tickReached(now: number, target: number): boolean {
  return (now - target) >>> 0 < 0x8000_0000;
}

function tickProgress(now: number, start: number, end: number): number {
  if (!tickReached(now, start)) return 0;
  const span = tickSpan(end, start);
  return span === 0 ? 1 : clamp01(tickSpan(now, start) / span);
}

function lineAlpha(ageMs: number, durationMs: number): number {
  return 1 - clamp01(ageMs / durationMs);
}

/**
 * Shared retained renderer for every ultimate owner. It draws exact marks and bounded spectacle from the
 * immutable action epochs; ordinary projectile/explosion renderers remain authoritative for the comet.
 */
export class UltimateVfx {
  private readonly ground: Phaser.GameObjects.Graphics;
  private readonly air: Phaser.GameObjects.Graphics;
  private readonly marks: Phaser.GameObjects.Graphics;
  private readonly accents: Phaser.GameObjects.Graphics;
  private readonly casts = new Map<string, CastPresentation>();
  private readonly doorTickets = new Map<string, DoorTicket>();
  private readonly doorCopies = new Map<string, Phaser.GameObjects.Container>();
  private readonly critRiders = new Map<string, { endTick: number; remaining: number }>();
  private readonly brands = new Map<string, BrandMark>();
  private readonly predictedAt = new Map<string, { family: number; atMs: number }>();
  private readonly point: UltimatePoint = { x: 0, y: 0 };
  private readonly targetPoint: UltimatePoint = { x: 0, y: 0 };
  private readonly sparkles: SparkleRow[] = Array.from({ length: SPARKLE_CAP }, () => ({
    active: false,
    x: 0,
    y: 0,
    bornMs: -1e9,
    color: 0xffd479,
  }));
  private sparkleCursor = 0;
  private readonly comets: CometRow[] = Array.from({ length: COMET_CAP }, () => ({
    id: "",
    seen: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    age: 0,
  }));

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: UltimateVfxCallbacks,
  ) {
    this.ground = scene.add.graphics().setDepth(ULTIMATE_VFX_DEPTH.GroundResidue);
    this.air = scene.add.graphics().setDepth(ULTIMATE_VFX_DEPTH.AirBody);
    this.marks = scene.add.graphics().setDepth(ULTIMATE_VFX_DEPTH.FriendlyMark);
    this.accents = scene.add.graphics().setScrollFactor(0).setDepth(ULTIMATE_VFX_DEPTH.LocalAccent);
  }

  destroy(): void {
    this.casts.clear();
    this.doorTickets.clear();
    for (const copy of this.doorCopies.values()) copy.destroy(true);
    this.doorCopies.clear();
    this.critRiders.clear();
    this.brands.clear();
    this.predictedAt.clear();
    this.ground.destroy();
    this.air.destroy();
    this.marks.destroy();
    this.accents.destroy();
  }

  cuePrediction(
    ownerId: string,
    family: number,
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    nowMs: number,
    reducedMotion: boolean,
    audioAmount = 1,
  ): void {
    this.predictedAt.set(ownerId, { family, atMs: nowMs });
    const element = FAMILY_ELEMENT[family] ?? "arcane";
    const count = reducedMotion ? 3 : family === UltimateFamily.SunspiteComet ? 8 : 6;
    // The painted pack is a bounded punctuation layer. Retained Graphics below carry the always-present read.
    particleBurst(this.scene, elementPack(element, "mote"), x, y - 18, {
      count,
      speed: 52,
      scaleContract: paintedParticlePixels(26.88),
      lifeMs: 260,
      additive: true,
      depth: ULTIMATE_VFX_DEPTH.AirBody,
    });
    if (family === UltimateFamily.DimensionDoor) {
      this.callbacks.audio("ult:blink:charge", x, audioAmount);
    } else if (family === UltimateFamily.EventHorizon) {
      this.callbacks.audio("ult:phase:in", x, audioAmount);
    } else if (family === UltimateFamily.AlphaStrike) {
      this.callbacks.audio("ult:alpha:lock", x, audioAmount);
    } else if (family === UltimateFamily.SunspiteComet) {
      this.callbacks.audio("ult:fire:charge", x, audioAmount);
    } else {
      this.callbacks.audio("ult:seismarch:charge", x, audioAmount);
    }
    // The target is intentionally not stored as truth here. The synced cast replaces this cosmetic inhale.
    void targetX;
    void targetY;
  }

  fizzlePrediction(ownerId: string, x: number, y: number): void {
    this.predictedAt.delete(ownerId);
    particleBurst(this.scene, elementPack("steel", "wisp"), x, y, {
      count: 2,
      speed: 32,
      scaleContract: paintedParticlePixels(26.88),
      lifeMs: 220,
      depth: ULTIMATE_VFX_DEPTH.AirBody,
    });
  }

  cueCast(cue: UltimateCastCue): void {
    const family = ultimateFamilyForCode(cue.code);
    if (family === UltimateFamily.Locked) return;
    const predicted = this.predictedAt.get(cue.ownerId);
    const predictionCovers =
      cue.isSelf && predicted?.family === family && cue.nowMs - predicted.atMs <= 500;
    this.predictedAt.delete(cue.ownerId);
    const existingTicket = this.doorTickets.get(cue.ownerId);
    const isDoorReturn = family === UltimateFamily.DimensionDoor && !!existingTicket;
    if (isDoorReturn) {
      this.doorTickets.delete(cue.ownerId);
      this.doorCopies.get(cue.ownerId)?.destroy(true);
      this.doorCopies.delete(cue.ownerId);
    }
    const activeEndTick = (cue.endTick - ULT_RECOVERY_TICKS) >>> 0;
    const record: CastPresentation = {
      ...cue,
      family,
      variant: ultimateVariantForCode(cue.code),
      activeEndTick,
      acceptedAtMs: cue.nowMs,
      predicted: predictionCovers,
      currentPhase: cue.phase,
      executionFired: false,
      finishFired: false,
      arrivalFired: false,
      connectCount: 0,
      accentFired: false,
      full: cue.isSelf,
      lastHop: -1,
      trailCount: 1,
      trailX: new Float32Array(6),
      trailY: new Float32Array(6),
      isDoorReturn,
    };
    record.trailX[0] = cue.originX;
    record.trailY[0] = cue.originY;
    this.casts.set(cue.ownerId, record);
    if (!predictionCovers) {
      this.cuePrediction(
        cue.ownerId,
        family,
        cue.originX,
        this.callbacks.projectY(cue.originY),
        cue.targetX,
        cue.targetY,
        cue.nowMs,
        false,
        cue.isSelf ? 1 : 0.35,
      );
      this.predictedAt.delete(cue.ownerId);
    }
  }

  hasDoorTicket(ownerId: string, serverTick: number): boolean {
    const ticket = this.doorTickets.get(ownerId);
    if (!ticket) return false;
    if (tickReached(serverTick, ticket.expiresTick)) {
      this.doorTickets.delete(ownerId);
      return false;
    }
    return tickReached(serverTick, ticket.opensTick);
  }

  doorTicketRemaining(ownerId: string, serverTick: number): number {
    const ticket = this.doorTickets.get(ownerId);
    if (!ticket || tickReached(serverTick, ticket.expiresTick)) return 0;
    return Math.max(0, (tickSpan(ticket.expiresTick, serverTick) * TICK_MS) / 1000);
  }

  beginProjectileFrame(): void {
    for (const comet of this.comets) comet.seen = false;
  }

  trackComet(id: string, x: number, y: number, vx: number, vy: number): void {
    let row = this.comets.find((entry) => entry.id === id);
    if (!row) row = this.comets.find((entry) => !entry.id || !entry.seen);
    if (!row)
      row = this.comets.reduce((oldest, entry) => (entry.age > oldest.age ? entry : oldest));
    if (row.id !== id) row.age = 0;
    row.id = id;
    row.seen = true;
    row.x = x;
    row.y = y;
    row.vx = vx;
    row.vy = vy;
  }

  onReceipt(cue: UltimateReceiptCue): void {
    if (cue.delivery === CombatDelivery.Ultimate && cue.weaponId.includes("event-horizon")) {
      this.brands.set(cue.targetId, {
        targetId: cue.targetId,
        untilMs: this.scene.time.now + 4_000,
      });
    }
    const rider = this.critRiders.get(cue.sourcePlayerId);
    if (
      rider &&
      rider.remaining > 0 &&
      !tickReached(cue.tick, rider.endTick) &&
      cue.crit &&
      !cue.weaponId.startsWith("ult:")
    ) {
      rider.remaining--;
      this.spawnSparkle(cue.x, cue.y, 0xffd479);
      this.callbacks.audio("ult:crit-rider", cue.x, 0.75);
    }
    const record = this.casts.get(cue.sourcePlayerId);
    if (cue.delivery !== CombatDelivery.Ultimate || !record || !cue.weaponId.startsWith("ult:"))
      return;
    record.connectCount++;
    const element = FAMILY_ELEMENT[record.family] ?? "steel";
    particleBurst(this.scene, elementPack(element, "spark"), cue.x, cue.y, {
      count: record.full ? 3 : 2,
      dirRad: 0,
      spread: Math.PI,
      speed: 130,
      scaleContract: paintedParticlePixels(28.8),
      lifeMs: 220,
      additive: true,
      depth: ULTIMATE_VFX_DEPTH.AirImpact,
    });
    if (record.family === UltimateFamily.DimensionDoor && cue.weaponId.includes("decoy")) {
      const ticket = this.doorTickets.get(cue.sourcePlayerId);
      if (ticket) ticket.copyEndTick = cue.tick;
      this.doorCopies.get(cue.sourcePlayerId)?.destroy(true);
      this.doorCopies.delete(cue.sourcePlayerId);
      particleBurst(this.scene, elementPack("arcane", "shard"), cue.x, cue.y, {
        count: record.full ? 6 : 3,
        speed: 180,
        scaleContract: paintedParticlePixels(38.4),
        lifeMs: 360,
        depth: ULTIMATE_VFX_DEPTH.AirImpact,
      });
    }
    if (!record.isSelf || record.accentFired) return;
    const alphaFinish =
      record.family === UltimateFamily.AlphaStrike &&
      (cue.finalBlow || tickReached(cue.tick, (record.activeEndTick - 1) >>> 0));
    const phaseFinish = record.family === UltimateFamily.EventHorizon && record.connectCount >= 3;
    const immediate =
      record.family === UltimateFamily.Seismarch ||
      record.family === UltimateFamily.SunspiteComet ||
      record.family === UltimateFamily.DimensionDoor;
    if (!immediate && !alphaFinish && !phaseFinish) return;
    if (alphaFinish) {
      particleBurst(this.scene, elementPack("shock", "shard"), cue.x, cue.y, {
        count: record.full ? 9 : 4,
        speed: 240,
        scaleContract: paintedParticlePixels(42.24),
        lifeMs: 360,
        additive: true,
        depth: ULTIMATE_VFX_DEPTH.AirImpact,
      });
      this.spawnSparkle(cue.x, cue.y, 0xd8fbff);
    }
    record.accentFired = true;
    const stopMs =
      record.family === UltimateFamily.AlphaStrike
        ? 130
        : record.family === UltimateFamily.SunspiteComet
          ? 110
          : record.family === UltimateFamily.EventHorizon
            ? 90
            : 80;
    this.callbacks.connectAccent(record.family, cue.x, cue.y, stopMs);
  }

  update(
    players: UltimatePlayerRows,
    selfId: string,
    serverTick: number,
    renderTick: number,
    nowMs: number,
    clockMs: number,
    reducedMotion: boolean,
    reducedFlash: boolean,
  ): void {
    this.ground.clear();
    this.air.clear();
    this.marks.clear();
    this.accents.clear();
    let remoteFull = 0;
    players.forEach((player, id) => {
      const row = player.ultimate;
      const family = ultimateFamilyForCode(row.archetype);
      if (
        family !== UltimateFamily.Locked &&
        row.charge >= 100 &&
        row.phase === UltimatePhase.Idle
      ) {
        this.drawReadyAura(id, family, id === selfId, nowMs, reducedMotion);
      }
      const record = this.casts.get(id);
      if (!record || record.seq !== row.seq) return;
      if (row.phase === UltimatePhase.Idle && !tickReached(serverTick, record.endTick)) {
        this.casts.delete(id);
        return;
      }
      record.currentPhase = row.phase;
      const actorVisible =
        this.callbacks.actor(id, this.point) && this.callbacks.visible(this.point.x, this.point.y);
      if (record.isSelf) record.full = true;
      else {
        record.full = actorVisible && remoteFull < REMOTE_FULL_LIMIT;
        if (record.full) remoteFull++;
      }
      this.drawCast(
        record,
        id === selfId ? serverTick : renderTick,
        nowMs,
        clockMs,
        reducedMotion,
        reducedFlash,
      );
    });
    this.drawDoorCopies(serverTick, nowMs, reducedMotion);
    this.drawBrands(nowMs, reducedFlash);
    this.drawSparkles(nowMs, reducedFlash);
    this.drawComets(reducedMotion, reducedFlash);
    for (const [ownerId, rider] of this.critRiders) {
      if (rider.remaining <= 0 || tickReached(serverTick, rider.endTick))
        this.critRiders.delete(ownerId);
    }
    for (const comet of this.comets) {
      if (comet.seen) comet.age++;
      else if (comet.id) comet.id = "";
    }
    for (const [ownerId, record] of this.casts) {
      const tick = ownerId === selfId ? serverTick : renderTick;
      if (
        tickReached(tick, record.endTick) &&
        tickSpan(tick, record.endTick) * TICK_MS > CAST_AFTER_MS
      )
        this.casts.delete(ownerId);
    }
  }

  private drawReadyAura(
    ownerId: string,
    family: number,
    isSelf: boolean,
    nowMs: number,
    reducedMotion: boolean,
  ): void {
    if (!this.callbacks.actor(ownerId, this.point)) return;
    const color = FAMILY_COLOR[family] ?? 0x8f82d8;
    const breath = reducedMotion ? 0.23 : 0.23 + Math.sin((nowMs / 1_800) * TAU) * 0.07;
    this.marks.lineStyle(2, color, breath * (isSelf ? 1 : 0.6));
    this.marks.strokeEllipse(
      this.point.x,
      this.point.y + 29,
      62,
      22 * this.callbacks.projectionYScale(),
    );
  }

  private drawCast(
    cast: CastPresentation,
    tick: number,
    nowMs: number,
    clockMs: number,
    reducedMotion: boolean,
    reducedFlash: boolean,
  ): void {
    const color = FAMILY_COLOR[cast.family] ?? 0x8f82d8;
    const anticipation = tickProgress(tick, cast.startTick, cast.resolveTick);
    const active = tickProgress(tick, cast.resolveTick, cast.activeEndTick);
    const actorAvailable = this.callbacks.actor(cast.ownerId, this.point);
    const targetY = this.callbacks.projectY(cast.targetY);
    const projectionY = this.callbacks.projectionYScale();
    if (!tickReached(tick, cast.resolveTick)) {
      const radius = 48 - 24 * anticipation;
      const cx = cast.family === UltimateFamily.DimensionDoor ? cast.targetX : cast.originX;
      const cy =
        cast.family === UltimateFamily.DimensionDoor
          ? targetY
          : this.callbacks.projectY(cast.originY);
      this.ground.lineStyle(2, color, 0.3 + anticipation * 0.22);
      this.ground.strokeEllipse(cx, cy + 28, radius * 2, radius * 0.68 * projectionY);
      if (cast.family === UltimateFamily.SunspiteComet) {
        this.ground.lineStyle(2, 0x7eb7c9, 0.52);
        this.ground.strokeEllipse(
          cast.targetX,
          targetY,
          ULT_NUKE_RADIUS * 2,
          ULT_NUKE_RADIUS * 2 * projectionY,
        );
      }
      if (cast.family === UltimateFamily.Seismarch) {
        this.ground.lineStyle(2, color, 0.48);
        this.ground.strokeEllipse(
          cast.targetX,
          targetY,
          ULT_SEISMARCH_INNER_RADIUS * 2,
          ULT_SEISMARCH_INNER_RADIUS * 2 * projectionY,
        );
      }
      return;
    }

    if (!cast.executionFired) {
      cast.executionFired = true;
      this.fireExecution(
        cast,
        actorAvailable ? this.point.x : cast.targetX,
        actorAvailable ? this.point.y : targetY,
      );
    }
    if (cast.family === UltimateFamily.Seismarch) {
      const peak = Math.sin(Math.PI * active);
      this.air.lineStyle(2.5, color, reducedFlash ? 0.32 : 0.48);
      this.air.beginPath();
      this.air.moveTo(cast.originX, this.callbacks.projectY(cast.originY) - 12);
      this.air.lineTo(cast.targetX, targetY - 12 - peak * 74);
      this.air.strokePath();
      if (tickReached(tick, cast.activeEndTick)) {
        this.drawSeismarchImpact(cast, tick, color, projectionY, reducedFlash);
      }
    } else if (cast.family === UltimateFamily.AlphaStrike) {
      if (actorAvailable && !tickReached(tick, cast.activeEndTick))
        this.drawAlpha(cast, tick, color, reducedMotion, reducedFlash);
      else if (tickReached(tick, cast.activeEndTick))
        this.drawAlphaAftermath(cast, tick, color, reducedFlash);
    } else if (cast.family === UltimateFamily.SunspiteComet) {
      this.ground.lineStyle(2, 0x7eb7c9, 0.42 * (1 - Math.min(1, active)));
      this.ground.strokeEllipse(
        cast.targetX,
        targetY,
        ULT_NUKE_RADIUS * 2,
        ULT_NUKE_RADIUS * 2 * projectionY,
      );
    } else if (cast.family === UltimateFamily.EventHorizon) {
      const ex = actorAvailable
        ? this.point.x
        : cast.originX + (cast.targetX - cast.originX) * active;
      const ey = actorAvailable
        ? this.point.y
        : this.callbacks.projectY(cast.originY + (cast.targetY - cast.originY) * active);
      const executionLive = !tickReached(tick, cast.activeEndTick);
      const trailAlpha = executionLive
        ? 0.34
        : 0.34 * lineAlpha(tickSpan(tick, cast.activeEndTick) * TICK_MS, 900);
      if (trailAlpha > 0) {
        this.ground.lineStyle(2.5, color, trailAlpha);
        this.ground.lineBetween(
          cast.originX,
          this.callbacks.projectY(cast.originY) + 26,
          ex,
          ey + 26,
        );
      }
      if (executionLive && !reducedMotion) {
        for (let index = 1; index <= (cast.full ? 3 : 2); index++) {
          const p = index / 4;
          const x = cast.originX + (ex - cast.originX) * p;
          const y =
            this.callbacks.projectY(cast.originY) +
            (ey - this.callbacks.projectY(cast.originY)) * p;
          this.air.fillStyle(color, (reducedFlash ? 0.12 : 0.2) * (1 - p * 0.4));
          this.air.fillEllipse(x, y - 20, 25, 46);
        }
      }
      if (tickReached(tick, cast.activeEndTick) && !cast.finishFired) {
        cast.finishFired = true;
        this.callbacks.audio("ult:phase:out", ex, cast.isSelf ? 1 : 0.35);
      }
    } else {
      const ageMs = tickSpan(tick, cast.resolveTick) * TICK_MS;
      const foldAlpha = lineAlpha(ageMs, 700);
      if (foldAlpha > 0) {
        this.air.lineStyle(3, color, (reducedFlash ? 0.26 : 0.42) * foldAlpha);
        this.air.lineBetween(
          cast.originX,
          this.callbacks.projectY(cast.originY),
          cast.targetX,
          targetY,
        );
      }
      if (!cast.arrivalFired) {
        cast.arrivalFired = true;
        this.callbacks.arrival(cast.ownerId, clockMs);
        this.callbacks.audio("ult:blink:in", cast.targetX, cast.isSelf ? 1 : 0.35);
        if (!cast.isDoorReturn) {
          const opensTick = cast.resolveTick;
          this.doorTickets.set(cast.ownerId, {
            originX: cast.originX,
            originY: cast.originY,
            opensTick,
            copyEndTick: (opensTick + Math.round((ULT_DOOR_DECOY_SECONDS * 1_000) / TICK_MS)) >>> 0,
            expiresTick:
              (opensTick + Math.round((ULT_DOOR_RETURN_SECONDS * 1_000) / TICK_MS)) >>> 0,
          });
          const copy = this.callbacks.paperCopy(
            cast.ownerId,
            cast.originX,
            this.callbacks.projectY(cast.originY),
          );
          if (copy) this.doorCopies.set(cast.ownerId, copy);
          if (cast.variant !== "con")
            this.critRiders.set(cast.ownerId, {
              endTick: (opensTick + Math.round((ULT_DOOR_RETURN_SECONDS * 1_000) / TICK_MS)) >>> 0,
              remaining: cast.variant === "str" ? 2 : 3,
            });
        }
      }
    }

    if (tickReached(tick, cast.activeEndTick) && !cast.finishFired) {
      cast.finishFired = true;
      if (cast.family === UltimateFamily.AlphaStrike)
        this.callbacks.audio("ult:alpha:finish", this.point.x, cast.isSelf ? 1 : 0.35);
    }
    // A restrained local speed-line corner accent. Remote allies remain world-space weather.
    if (cast.isSelf && !reducedMotion && !reducedFlash && active > 0 && active < 1) {
      const w = this.scene.cameras.main.width;
      const h = this.scene.cameras.main.height;
      this.accents.lineStyle(2, color, 0.12 * Math.sin(Math.PI * active));
      this.accents.lineBetween(18, 42, 68, 18);
      this.accents.lineBetween(w - 18, h - 42, w - 68, h - 18);
    }
    void nowMs;
  }

  private fireExecution(cast: CastPresentation, x: number, y: number): void {
    const amount = cast.isSelf ? 1 : 0.35;
    if (cast.family === UltimateFamily.Seismarch)
      this.callbacks.audio("ult:seismarch:launch", x, amount);
    else if (cast.family === UltimateFamily.AlphaStrike)
      this.callbacks.audio("ult:alpha:hop", x, amount);
    else if (cast.family === UltimateFamily.SunspiteComet) {
      if (!cast.predicted) this.callbacks.audio("ult:fire:launch", x, amount);
    } else if (cast.family === UltimateFamily.EventHorizon) {
      if (!cast.predicted) this.callbacks.audio("ult:phase:in", x, amount);
    } else {
      this.callbacks.audio(cast.isDoorReturn ? "ult:blink:return" : "ult:blink:out", x, amount);
    }
    particleBurst(this.scene, elementPack(FAMILY_ELEMENT[cast.family], "ring"), x, y, {
      count: 1,
      speed: 0,
      scaleContract: paintedParticlePixels(69.12),
      lifeMs: 300,
      additive: true,
      depth: ULTIMATE_VFX_DEPTH.AirImpact,
    });
  }

  private drawSeismarchImpact(
    cast: CastPresentation,
    tick: number,
    color: number,
    projectionY: number,
    reducedFlash: boolean,
  ): void {
    const ageMs = tickSpan(tick, cast.activeEndTick) * TICK_MS;
    const exactAlpha = ageMs < 420 ? 0.82 : 0.34 * lineAlpha(ageMs - 420, 2_180);
    if (exactAlpha <= 0) return;
    const targetY = this.callbacks.projectY(cast.targetY);
    const variantShrink = cast.variant === "dex" ? 0.8 : 1;
    this.ground.lineStyle(2.5, color, exactAlpha);
    for (const radius of [
      ULT_SEISMARCH_INNER_RADIUS,
      ULT_SEISMARCH_MID_RADIUS,
      ULT_SEISMARCH_OUTER_RADIUS,
    ]) {
      this.ground.strokeEllipse(
        cast.targetX,
        targetY,
        radius * variantShrink * 2,
        radius * variantShrink * 2 * projectionY,
      );
    }
    // Inner circle is the literal stun contract and stays the strongest stroke.
    this.ground.lineStyle(3, 0xbfe8d1, Math.min(1, exactAlpha + 0.12));
    this.ground.strokeEllipse(
      cast.targetX,
      targetY,
      ULT_SEISMARCH_INNER_RADIUS * variantShrink * 2,
      ULT_SEISMARCH_INNER_RADIUS * variantShrink * 2 * projectionY,
    );
    if (!cast.finishFired) {
      cast.finishFired = true;
      particleBurst(this.scene, elementPack("steel", "shard"), cast.targetX, targetY, {
        count: cast.full ? 10 : 5,
        speed: 250,
        scaleContract: paintedParticlePixels(43.2),
        lifeMs: 460,
        sink: 18,
        depth: ULTIMATE_VFX_DEPTH.AirImpact,
      });
      this.callbacks.audio("ult:seismarch:impact", cast.targetX, cast.isSelf ? 1 : 0.35);
    }
    // Friendly WYSIWYG geometry stays cool and stroke-only; shard punctuation carries the impact.
    void reducedFlash;
  }

  private drawAlpha(
    cast: CastPresentation,
    tick: number,
    color: number,
    reducedMotion: boolean,
    reducedFlash: boolean,
  ): void {
    const hop = Math.max(0, Math.floor(tickSpan(tick, cast.resolveTick) / ULT_ALPHA_HIT_TICKS));
    if (hop !== cast.lastHop) {
      cast.lastHop = hop;
      const slot = Math.min(5, cast.trailCount);
      cast.trailX[slot] = this.point.x;
      cast.trailY[slot] = this.point.y;
      cast.trailCount = Math.min(6, cast.trailCount + 1);
      this.callbacks.audio("ult:alpha:hop", this.point.x, cast.isSelf ? 0.85 : 0.28);
    }
    const first = Math.max(0, cast.trailCount - (reducedMotion ? 2 : cast.full ? 4 : 2));
    for (let index = first; index < cast.trailCount; index++) {
      const fade = (index - first + 1) / Math.max(1, cast.trailCount - first);
      const currentX = cast.trailX[index] ?? 0;
      const currentY = cast.trailY[index] ?? 0;
      this.air.fillStyle(color, (reducedFlash ? 0.12 : 0.22) * fade);
      this.air.fillEllipse(currentX, currentY - 20, 23, 45);
      if (index > 0) {
        this.air.lineStyle(4, color, (reducedFlash ? 0.2 : 0.38) * fade);
        this.air.lineBetween(
          cast.trailX[index - 1] ?? 0,
          (cast.trailY[index - 1] ?? 0) - 18,
          currentX,
          currentY - 18,
        );
      }
    }
    this.ground.lineStyle(2, color, 0.22);
    for (let index = 1; index < cast.trailCount; index++) {
      this.ground.lineBetween(
        cast.trailX[index - 1] ?? 0,
        (cast.trailY[index - 1] ?? 0) + 26,
        cast.trailX[index] ?? 0,
        (cast.trailY[index] ?? 0) + 26,
      );
    }
  }

  private drawAlphaAftermath(
    cast: CastPresentation,
    tick: number,
    color: number,
    reducedFlash: boolean,
  ): void {
    const ageMs = tickSpan(tick, cast.activeEndTick) * TICK_MS;
    const alpha = lineAlpha(ageMs, 720) * (reducedFlash ? 0.3 : 0.5);
    if (alpha <= 0 || cast.trailCount <= 0) return;
    const slot = Math.max(0, cast.trailCount - 1);
    const x = cast.trailX[slot] ?? cast.targetX;
    const y = cast.trailY[slot] ?? this.callbacks.projectY(cast.targetY);
    const radius = 20 + ageMs * 0.035;
    this.marks.lineStyle(2, color, alpha);
    this.marks.lineBetween(x - radius, y - radius * 0.45, x + radius, y + radius * 0.45);
    this.marks.lineBetween(x - radius, y + radius * 0.45, x + radius, y - radius * 0.45);
  }

  private drawDoorCopies(serverTick: number, nowMs: number, reducedMotion: boolean): void {
    for (const [ownerId, ticket] of this.doorTickets) {
      if (tickReached(serverTick, ticket.expiresTick)) {
        this.doorTickets.delete(ownerId);
        this.doorCopies.get(ownerId)?.destroy(true);
        this.doorCopies.delete(ownerId);
        continue;
      }
      if (tickReached(serverTick, ticket.copyEndTick)) {
        this.doorCopies.get(ownerId)?.destroy(true);
        this.doorCopies.delete(ownerId);
        continue;
      }
      const phase = reducedMotion ? 1 : 0.9 + Math.sin(nowMs / 170) * 0.08;
      const y = this.callbacks.projectY(ticket.originY);
      const copy = this.doorCopies.get(ownerId);
      if (copy) copy.setPosition(ticket.originX, y).setAlpha(0.48 + (phase - 0.9) * 0.4);
      else {
        this.air.fillStyle(0x8f82d8, 0.14);
        this.air.fillEllipse(ticket.originX, y - 19, 25 * phase, 47 * phase);
        this.air.lineStyle(2, 0xb9aef2, 0.42);
        this.air.strokeEllipse(ticket.originX, y - 19, 25 * phase, 47 * phase);
      }
      this.ground.lineStyle(2, 0x8f82d8, 0.3);
      this.ground.strokeEllipse(ticket.originX, y + 28, 64, 22 * this.callbacks.projectionYScale());
    }
  }

  private drawBrands(nowMs: number, reducedFlash: boolean): void {
    for (const [targetId, brand] of this.brands) {
      if (nowMs >= brand.untilMs || !this.callbacks.target(targetId, this.targetPoint)) {
        this.brands.delete(targetId);
        continue;
      }
      const life = clamp01((brand.untilMs - nowMs) / 4_000);
      this.marks.lineStyle(2, 0x9b75d6, (reducedFlash ? 0.42 : 0.62) * Math.min(1, life * 3));
      this.marks.strokeCircle(this.targetPoint.x, this.targetPoint.y - 12, 18);
      this.marks.lineBetween(
        this.targetPoint.x - 8,
        this.targetPoint.y - 12,
        this.targetPoint.x + 8,
        this.targetPoint.y - 12,
      );
    }
  }

  private spawnSparkle(x: number, y: number, color: number): void {
    const row = this.sparkles[this.sparkleCursor++ % SPARKLE_CAP];
    if (!row) return;
    row.active = true;
    row.x = x;
    row.y = y;
    row.bornMs = this.scene.time.now;
    row.color = color;
  }

  private drawSparkles(nowMs: number, reducedFlash: boolean): void {
    for (const sparkle of this.sparkles) {
      if (!sparkle.active) continue;
      const age = nowMs - sparkle.bornMs;
      if (age >= 320) {
        sparkle.active = false;
        continue;
      }
      const q = clamp01(age / 320);
      const r = 7 + 11 * q;
      this.air.lineStyle(2, sparkle.color, (reducedFlash ? 0.45 : 0.8) * (1 - q));
      this.air.lineBetween(sparkle.x - r, sparkle.y, sparkle.x + r, sparkle.y);
      this.air.lineBetween(sparkle.x, sparkle.y - r, sparkle.x, sparkle.y + r);
    }
  }

  private drawComets(reducedMotion: boolean, reducedFlash: boolean): void {
    for (const comet of this.comets) {
      if (!comet.seen) continue;
      const angle = Math.atan2(comet.vy, comet.vx);
      const tail = reducedMotion ? 36 : 64;
      const tx = comet.x - Math.cos(angle) * tail;
      const ty = comet.y - Math.sin(angle) * tail;
      this.ground.fillStyle(0xc98a4c, 0.12);
      this.ground.fillEllipse(comet.x, comet.y + 34, 62, 18 * this.callbacks.projectionYScale());
      this.air.lineStyle(reducedFlash ? 8 : 12, 0xc96e35, reducedFlash ? 0.36 : 0.55);
      this.air.lineBetween(tx, ty, comet.x, comet.y);
      this.air.fillStyle(0xffd0a0, reducedFlash ? 0.55 : 0.86);
      this.air.fillCircle(comet.x, comet.y, reducedMotion ? 17 : 22);
      this.air.lineStyle(2, 0xd9a85f, 0.76);
      this.air.strokeCircle(comet.x, comet.y, reducedMotion ? 20 : 26);
    }
  }
}
