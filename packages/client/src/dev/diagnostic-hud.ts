import {
  BOSS_PROJECTILE_BUDGET,
  FRIENDLY_PROJECTILE_ENTITY_CAP,
  MAX_ENEMIES,
  MovementCorrectionBand,
  PRED_PENDING_MAX,
  TICK_MS,
} from "@dd/shared";
import type { SelfCorrectionEvent } from "../net/prediction.js";

export const DIAGNOSTIC_HUD_TOGGLE_KEY = "F8";
export const DIAGNOSTIC_HUD_COPY_KEY = "F9";
export const DIAGNOSTIC_HUD_METRIC_COUNT = 12;

const WINDOW_MS = 10_000;
const DISPLAY_INTERVAL_MS = 250;
const STORAGE_KEY = "dd:diagnostic-hud:visible";
const FRAME_RING_CAPACITY = 2_048;
const SAMPLE_RING_CAPACITY = 256;
const EVENT_RING_CAPACITY = 64;
const ENTITY_LOAD_AMBER_FRACTION = 0.6;

/**
 * Player-perception bands use strict `>` comparisons. A 50 ms frame spans three 60 Hz frame
 * budgets and is plainly visible; 4 px of render/commit disagreement is a perceptible twitch at
 * the owner's resolution; and 50 ms of physical-input latency is where a responsive game starts
 * feeling soft. The 250 ms stall threshold remains separate because it is the forceResync trigger.
 * SELF correction severity remains defined by the canonical L10 bands rather than this table.
 */
export const DIAGNOSTIC_THRESHOLDS = Object.freeze({
  frameAmberMs: 20,
  frameRedMs: 50,
  stallRedMs: 250,
  divergenceAmberPx: 1,
  divergenceRedPx: 4,
  inputAmberMs: 20,
  inputRedMs: 50,
  tickDriftAmberMs: 8,
  tickDriftRedMs: 20,
  rttAmberMs: 150,
  rttRedMs: 300,
  pendingAmber: 4,
  pendingRed: 16,
  pendingGrowthAmber: 4,
  pendingGrowthRed: 16,
  enemyAmber: Math.floor(MAX_ENEMIES * ENTITY_LOAD_AMBER_FRACTION) + 1,
  enemyRed: MAX_ENEMIES,
  projectileAmber:
    Math.floor(
      (FRIENDLY_PROJECTILE_ENTITY_CAP + BOSS_PROJECTILE_BUDGET) *
        ENTITY_LOAD_AMBER_FRACTION,
    ) + 1,
  projectileRed: FRIENDLY_PROJECTILE_ENTITY_CAP + BOSS_PROJECTILE_BUDGET,
  vfxSurfaceAmber: Math.floor(12 * ENTITY_LOAD_AMBER_FRACTION) + 1,
  vfxSurfaceRed: 12,
  particleAmber: 192,
  particleRed: 384,
  heapGrowthAmberMbPerSec: 2,
  heapGrowthRedMbPerSec: 8,
  heapUseAmberFraction: 0.7,
  heapUseRedFraction: 0.85,
  hudCostAmberMsPerFrame: 0.1,
  hudCostRedMsPerFrame: 0.5,
});

export type DiagnosticState = "GREEN" | "AMBER" | "RED";

export interface DiagnosticHudContext {
  pendingInputs: number;
  enemies: number;
  projectiles: number;
  vfxSurfaces: number;
  vfxParticles: number;
  heapUsedBytes?: number;
  heapLimitBytes?: number;
}

interface VfxDiagnosticNode {
  readonly list?: readonly unknown[];
  readonly visible?: boolean;
  getAliveParticleCount?: () => number;
}

function countAliveParticles(node: unknown): number {
  const candidate = node as VfxDiagnosticNode | undefined;
  if (!candidate || candidate.visible === false) return 0;
  let alive = candidate.getAliveParticleCount?.() ?? 0;
  const children = candidate.list;
  if (!children) return alive;
  for (let i = 0; i < children.length; i++) alive += countAliveParticles(children[i]);
  return alive;
}

/**
 * Reads Phaser's container/emitter shape without importing Phaser or adding diagnostic methods to the
 * production VFX player. This is called only by the 4 Hz context sample, never on the per-frame hot path.
 */
export function writeVfxDiagnosticStats(bloomRoot: unknown, out: DiagnosticHudContext): void {
  out.vfxSurfaces = 0;
  out.vfxParticles = 0;
  const surfaces = (bloomRoot as VfxDiagnosticNode | undefined)?.list;
  if (!surfaces) return;
  for (let i = 0; i < surfaces.length; i++) {
    const surface = surfaces[i] as VfxDiagnosticNode | undefined;
    if (!surface || surface.visible === false) continue;
    out.vfxSurfaces++;
    out.vfxParticles += countAliveParticles(surface);
  }
}

export interface DiagnosticMetricSnapshot {
  readonly id:
    | "frame"
    | "stalls"
    | "corrections"
    | "divergence"
    | "input"
    | "tick"
    | "rtt"
    | "pending"
    | "load"
    | "heap"
    | "resync"
    | "cost";
  readonly label: string;
  readonly state: DiagnosticState;
  readonly value: string;
}

export interface DiagnosticSnapshot {
  readonly metrics: readonly DiagnosticMetricSnapshot[];
  readonly redCount: number;
  readonly amberCount: number;
  readonly windowSeconds: number;
}

interface PerformanceMemory {
  readonly usedJSHeapSize: number;
  readonly jsHeapSizeLimit: number;
}

class NumericWindow {
  private readonly times: Float64Array;
  private readonly values: Float32Array;
  private cursor = 0;
  private count = 0;

  constructor(capacity: number) {
    this.times = new Float64Array(capacity);
    this.values = new Float32Array(capacity);
  }

  push(timeMs: number, value: number): void {
    this.times[this.cursor] = timeMs;
    this.values[this.cursor] = value;
    this.cursor = (this.cursor + 1) % this.times.length;
    this.count = Math.min(this.count + 1, this.times.length);
  }

  countSince(nowMs: number, windowMs = WINDOW_MS): number {
    const cutoff = nowMs - windowMs;
    let found = 0;
    for (let i = 0; i < this.count; i++) {
      const time = this.times[i] ?? 0;
      if (time >= cutoff && time <= nowMs) found++;
    }
    return found;
  }

  maxSince(nowMs: number, windowMs = WINDOW_MS): number {
    const cutoff = nowMs - windowMs;
    let max = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < this.count; i++) {
      const time = this.times[i] ?? 0;
      if (time < cutoff || time > nowMs) continue;
      max = Math.max(max, this.values[i] ?? 0);
    }
    return max;
  }

  averageSince(nowMs: number, windowMs = WINDOW_MS): number {
    const cutoff = nowMs - windowMs;
    let total = 0;
    let found = 0;
    for (let i = 0; i < this.count; i++) {
      const time = this.times[i] ?? 0;
      if (time < cutoff || time > nowMs) continue;
      total += this.values[i] ?? 0;
      found++;
    }
    return found > 0 ? total / found : Number.NaN;
  }

  oldestValueSince(nowMs: number, windowMs = WINDOW_MS): { timeMs: number; value: number } | null {
    const cutoff = nowMs - windowMs;
    let oldestTime = Number.POSITIVE_INFINITY;
    let oldestValue = 0;
    for (let i = 0; i < this.count; i++) {
      const time = this.times[i] ?? 0;
      if (time < cutoff || time > nowMs || time >= oldestTime) continue;
      oldestTime = time;
      oldestValue = this.values[i] ?? 0;
    }
    return Number.isFinite(oldestTime) ? { timeMs: oldestTime, value: oldestValue } : null;
  }

  quantileSince(
    nowMs: number,
    quantile: number,
    histogram: Uint32Array,
    binSize: number,
    windowMs = WINDOW_MS,
  ): number {
    histogram.fill(0);
    const cutoff = nowMs - windowMs;
    let found = 0;
    for (let i = 0; i < this.count; i++) {
      const time = this.times[i] ?? 0;
      if (time < cutoff || time > nowMs) continue;
      const value = Math.max(0, this.values[i] ?? 0);
      const bin = Math.min(histogram.length - 1, Math.floor(value / binSize));
      histogram[bin] = (histogram[bin] ?? 0) + 1;
      found++;
    }
    if (found === 0) return Number.NaN;
    const target = Math.max(1, Math.ceil(found * quantile));
    let cumulative = 0;
    for (let i = 0; i < histogram.length; i++) {
      cumulative += histogram[i] ?? 0;
      if (cumulative >= target) return i * binSize;
    }
    return histogram.length * binSize;
  }
}

function severity(value: number, amberAbove: number, redAbove: number): DiagnosticState {
  if (value > redAbove) return "RED";
  if (value > amberAbove) return "AMBER";
  return "GREEN";
}

function worstState(a: DiagnosticState, b: DiagnosticState): DiagnosticState {
  if (a === "RED" || b === "RED") return "RED";
  if (a === "AMBER" || b === "AMBER") return "AMBER";
  return "GREEN";
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function formatMs(value: number): string {
  return Number.isFinite(value) ? `${value.toFixed(1)}ms` : "n/a";
}

function formatCostMs(value: number): string {
  return Number.isFinite(value) ? `${value.toFixed(3)}ms` : "n/a";
}

function formatPx(value: number): string {
  return Number.isFinite(value) ? `${value.toFixed(1)}px` : "n/a";
}

function correctionBandName(band: number): "Silent" | "Smooth" | "Snap" | "none" {
  if (band === MovementCorrectionBand.Silent) return "Silent";
  if (band === MovementCorrectionBand.Smooth) return "Smooth";
  if (band === MovementCorrectionBand.Snap) return "Snap";
  return "none";
}

/**
 * Fixed-ring, allocation-free hot-path telemetry. Snapshot/dump formatting allocates only at the
 * throttled 4 Hz display edge or on explicit F9 copy.
 */
export class DiagnosticHudTelemetry {
  private readonly startedAtMs: number;
  private readonly frameWindow = new NumericWindow(FRAME_RING_CAPACITY);
  private readonly stallWindow = new NumericWindow(EVENT_RING_CAPACITY);
  private readonly correctionMagnitudeWindow = new NumericWindow(EVENT_RING_CAPACITY);
  private readonly divergenceWindow = new NumericWindow(SAMPLE_RING_CAPACITY);
  private readonly inputLatencyWindow = new NumericWindow(SAMPLE_RING_CAPACITY);
  private readonly tickDriftWindow = new NumericWindow(SAMPLE_RING_CAPACITY);
  private readonly tickGapWindow = new NumericWindow(SAMPLE_RING_CAPACITY);
  private readonly rttWindow = new NumericWindow(SAMPLE_RING_CAPACITY);
  private readonly pendingWindow = new NumericWindow(SAMPLE_RING_CAPACITY);
  private readonly enemyWindow = new NumericWindow(SAMPLE_RING_CAPACITY);
  private readonly projectileWindow = new NumericWindow(SAMPLE_RING_CAPACITY);
  private readonly vfxSurfaceWindow = new NumericWindow(SAMPLE_RING_CAPACITY);
  private readonly vfxParticleWindow = new NumericWindow(SAMPLE_RING_CAPACITY);
  private readonly heapUsedWindow = new NumericWindow(SAMPLE_RING_CAPACITY);
  private readonly heapGrowthWindow = new NumericWindow(SAMPLE_RING_CAPACITY);
  private readonly resyncWindow = new NumericWindow(EVENT_RING_CAPACITY);
  private readonly visibleCostWindow = new NumericWindow(FRAME_RING_CAPACITY);
  private readonly frameHistogram = new Uint32Array(512);
  private readonly sentSeq = new Uint32Array(256);
  private readonly sentAt = new Float64Array(256);
  private readonly sentValid = new Uint8Array(256);

  private currentFrameMs = Number.NaN;
  private sessionFramePeakMs = 0;
  private stallCount = 0;
  private correctionCount = 0;
  private silentCount = 0;
  private smoothCount = 0;
  private snapCount = 0;
  private maxCorrectionPx = 0;
  private lastCorrectionBand = -1;
  private lastCorrectionCause = "none";
  private currentDivergencePx = Number.NaN;
  private sessionDivergencePeakPx = 0;
  private pendingKeyAtMs = Number.NaN;
  private currentInputLatencyMs = Number.NaN;
  private sessionInputLatencyPeakMs = 0;
  private previousTick = 0;
  private previousTickAtMs = Number.NaN;
  private hasPreviousTick = false;
  private currentTickIntervalMs = Number.NaN;
  private currentTickDriftMs = Number.NaN;
  private currentTickGap = 1;
  private sessionTickDriftPeakMs = 0;
  private currentRttMs = Number.NaN;
  private sessionRttPeakMs = 0;
  private currentPending = 0;
  private pendingGrowth = 0;
  private currentEnemies = 0;
  private currentProjectiles = 0;
  private currentVfxSurfaces = 0;
  private currentVfxParticles = 0;
  private heapAvailable = false;
  private currentHeapUsedMb = Number.NaN;
  private currentHeapLimitMb = Number.NaN;
  private currentHeapGrowthMbPerSec = Number.NaN;
  private sessionHeapPeakMb = 0;
  private resyncCount = 0;
  private visibleFrameCount = 0;
  private visibleCostTotalMs = 0;
  private visibleDisplayCostMs = Number.NaN;
  private visibleDisplayCostPeakMs = 0;

  constructor(startedAtMs = performance.now()) {
    this.startedAtMs = startedAtMs;
  }

  recordFrame(deltaMs: number, nowMs = performance.now()): void {
    const duration = finiteOrZero(deltaMs);
    this.currentFrameMs = duration;
    this.sessionFramePeakMs = Math.max(this.sessionFramePeakMs, duration);
    this.frameWindow.push(nowMs, duration);
    if (duration > DIAGNOSTIC_THRESHOLDS.stallRedMs) {
      this.stallCount++;
      this.stallWindow.push(nowMs, duration);
    }
  }

  recordInputKey(nowMs = performance.now()): void {
    if (!Number.isFinite(this.pendingKeyAtMs)) this.pendingKeyAtMs = nowMs;
  }

  recordCommand(seq: number, nowMs = performance.now()): void {
    if (Number.isFinite(this.pendingKeyAtMs)) {
      const latency = Math.max(0, nowMs - this.pendingKeyAtMs);
      this.currentInputLatencyMs = latency;
      this.sessionInputLatencyPeakMs = Math.max(this.sessionInputLatencyPeakMs, latency);
      this.inputLatencyWindow.push(nowMs, latency);
      this.pendingKeyAtMs = Number.NaN;
    }
    const normalizedSeq = seq >>> 0;
    const slot = normalizedSeq & 255;
    this.sentSeq[slot] = normalizedSeq;
    this.sentAt[slot] = nowMs;
    this.sentValid[slot] = 1;
  }

  recordServerPatch(tick: number, ackSeq: number | undefined, nowMs = performance.now()): void {
    const normalizedTick = tick >>> 0;
    if (!this.hasPreviousTick) {
      this.previousTick = normalizedTick;
      this.previousTickAtMs = nowMs;
      this.hasPreviousTick = true;
    } else if (normalizedTick !== this.previousTick) {
      const tickGap = (normalizedTick - this.previousTick) >>> 0;
      if (tickGap < 0x8000_0000) {
        const elapsed = Math.max(0, nowMs - this.previousTickAtMs);
        const interval = elapsed / Math.max(1, tickGap);
        const drift = interval - TICK_MS;
        this.currentTickIntervalMs = interval;
        this.currentTickDriftMs = drift;
        this.currentTickGap = tickGap;
        this.sessionTickDriftPeakMs = Math.max(this.sessionTickDriftPeakMs, Math.abs(drift));
        this.tickDriftWindow.push(nowMs, Math.abs(drift));
        this.tickGapWindow.push(nowMs, tickGap);
      }
      this.previousTick = normalizedTick;
      this.previousTickAtMs = nowMs;
    }

    if (ackSeq === undefined) return;
    const normalizedAck = ackSeq >>> 0;
    const slot = normalizedAck & 255;
    if (this.sentValid[slot] === 0 || this.sentSeq[slot] !== normalizedAck) return;
    const rtt = Math.max(0, nowMs - (this.sentAt[slot] ?? nowMs));
    this.sentValid[slot] = 0;
    this.currentRttMs = rtt;
    this.sessionRttPeakMs = Math.max(this.sessionRttPeakMs, rtt);
    this.rttWindow.push(nowMs, rtt);
  }

  recordContext(context: Readonly<DiagnosticHudContext>, nowMs = performance.now()): void {
    this.currentPending = Math.max(0, Math.floor(context.pendingInputs));
    this.currentEnemies = Math.max(0, Math.floor(context.enemies));
    this.currentProjectiles = Math.max(0, Math.floor(context.projectiles));
    this.currentVfxSurfaces = Math.max(0, Math.floor(context.vfxSurfaces));
    this.currentVfxParticles = Math.max(0, Math.floor(context.vfxParticles));
    this.pendingWindow.push(nowMs, this.currentPending);
    this.enemyWindow.push(nowMs, this.currentEnemies);
    this.projectileWindow.push(nowMs, this.currentProjectiles);
    this.vfxSurfaceWindow.push(nowMs, this.currentVfxSurfaces);
    this.vfxParticleWindow.push(nowMs, this.currentVfxParticles);
    const oldestPending = this.pendingWindow.oldestValueSince(nowMs);
    this.pendingGrowth = oldestPending ? Math.max(0, this.currentPending - oldestPending.value) : 0;

    const usedBytes = context.heapUsedBytes;
    const limitBytes = context.heapLimitBytes;
    if (
      usedBytes === undefined ||
      limitBytes === undefined ||
      !Number.isFinite(usedBytes) ||
      !Number.isFinite(limitBytes) ||
      usedBytes < 0 ||
      limitBytes <= 0
    ) {
      this.heapAvailable = false;
      return;
    }
    this.heapAvailable = true;
    this.currentHeapUsedMb = usedBytes / (1024 * 1024);
    this.currentHeapLimitMb = limitBytes / (1024 * 1024);
    this.sessionHeapPeakMb = Math.max(this.sessionHeapPeakMb, this.currentHeapUsedMb);
    this.heapUsedWindow.push(nowMs, this.currentHeapUsedMb);
    const oldestHeap = this.heapUsedWindow.oldestValueSince(nowMs);
    const elapsedSeconds = oldestHeap ? (nowMs - oldestHeap.timeMs) / 1_000 : 0;
    this.currentHeapGrowthMbPerSec =
      oldestHeap && elapsedSeconds >= 2
        ? (this.currentHeapUsedMb - oldestHeap.value) / elapsedSeconds
        : 0;
    this.heapGrowthWindow.push(nowMs, this.currentHeapGrowthMbPerSec);
  }

  recordSelfCorrection(event: Readonly<SelfCorrectionEvent>, nowMs = performance.now()): void {
    const magnitude = finiteOrZero(event.magnitudePx);
    this.correctionCount++;
    this.maxCorrectionPx = Math.max(this.maxCorrectionPx, magnitude);
    this.lastCorrectionBand = event.band;
    this.lastCorrectionCause = event.cause;
    if (event.band === MovementCorrectionBand.Silent) this.silentCount++;
    else if (event.band === MovementCorrectionBand.Smooth) this.smoothCount++;
    else this.snapCount++;
    this.correctionMagnitudeWindow.push(nowMs, magnitude);
  }

  recordRenderCommitDivergence(divergencePx: number, nowMs = performance.now()): void {
    const divergence = finiteOrZero(divergencePx);
    this.currentDivergencePx = divergence;
    this.sessionDivergencePeakPx = Math.max(this.sessionDivergencePeakPx, divergence);
    this.divergenceWindow.push(nowMs, divergence);
  }

  recordResync(nowMs = performance.now()): void {
    this.resyncCount++;
    this.resyncWindow.push(nowMs, 1);
  }

  recordHudCost(
    costMs: number,
    visible: boolean,
    displayUpdated: boolean,
    nowMs = performance.now(),
  ): void {
    if (!visible) return;
    const cost = finiteOrZero(costMs);
    this.visibleFrameCount++;
    this.visibleCostTotalMs += cost;
    this.visibleCostWindow.push(nowMs, cost);
    if (displayUpdated) {
      this.visibleDisplayCostMs = cost;
      this.visibleDisplayCostPeakMs = Math.max(this.visibleDisplayCostPeakMs, cost);
    }
  }

  snapshot(nowMs = performance.now()): DiagnosticSnapshot {
    const t = DIAGNOSTIC_THRESHOLDS;
    const frameP99 = this.frameWindow.quantileSince(nowMs, 0.99, this.frameHistogram, 1);
    const recentFramePeak = this.frameWindow.maxSince(nowMs);
    const frameState = severity(
      Math.max(this.currentFrameMs, frameP99),
      t.frameAmberMs,
      t.frameRedMs,
    );

    const correctionState: DiagnosticState =
      this.snapCount > 0 ? "RED" : this.smoothCount > 0 ? "AMBER" : "GREEN";
    const recentDivergencePeak = this.divergenceWindow.maxSince(nowMs);
    const divergenceState = severity(
      Math.max(this.currentDivergencePx, recentDivergencePeak),
      t.divergenceAmberPx,
      t.divergenceRedPx,
    );
    const recentInputPeak = this.inputLatencyWindow.maxSince(nowMs);
    const inputState = severity(
      Math.max(this.currentInputLatencyMs, recentInputPeak),
      t.inputAmberMs,
      t.inputRedMs,
    );
    const recentTickDriftPeak = this.tickDriftWindow.maxSince(nowMs);
    const recentTickGapPeak = this.tickGapWindow.maxSince(nowMs);
    let tickState = severity(recentTickDriftPeak, t.tickDriftAmberMs, t.tickDriftRedMs);
    if (recentTickGapPeak > 3) tickState = "RED";
    else if (recentTickGapPeak > 1) tickState = worstState(tickState, "AMBER");
    const recentRttPeak = this.rttWindow.maxSince(nowMs);
    const rttState = severity(Math.max(this.currentRttMs, recentRttPeak), t.rttAmberMs, t.rttRedMs);

    const recentPendingPeak = this.pendingWindow.maxSince(nowMs);
    let pendingState = severity(recentPendingPeak, t.pendingAmber, t.pendingRed);
    pendingState = worstState(
      pendingState,
      severity(this.pendingGrowth, t.pendingGrowthAmber, t.pendingGrowthRed),
    );

    const recentEnemyPeak = this.enemyWindow.maxSince(nowMs);
    const recentProjectilePeak = this.projectileWindow.maxSince(nowMs);
    const recentVfxSurfacePeak = this.vfxSurfaceWindow.maxSince(nowMs);
    const recentVfxParticlePeak = this.vfxParticleWindow.maxSince(nowMs);
    let loadState = severity(recentEnemyPeak, t.enemyAmber - 1, t.enemyRed);
    loadState = worstState(
      loadState,
      severity(recentProjectilePeak, t.projectileAmber - 1, t.projectileRed),
    );
    loadState = worstState(
      loadState,
      severity(recentVfxSurfacePeak, t.vfxSurfaceAmber - 1, t.vfxSurfaceRed),
    );
    loadState = worstState(
      loadState,
      severity(recentVfxParticlePeak, t.particleAmber, t.particleRed),
    );

    let heapState: DiagnosticState = "GREEN";
    let heapFraction = Number.NaN;
    const recentHeapGrowthPeak = this.heapGrowthWindow.maxSince(nowMs);
    if (this.heapAvailable) {
      heapFraction = this.currentHeapUsedMb / this.currentHeapLimitMb;
      heapState = severity(
        recentHeapGrowthPeak,
        t.heapGrowthAmberMbPerSec,
        t.heapGrowthRedMbPerSec,
      );
      heapState = worstState(
        heapState,
        severity(heapFraction, t.heapUseAmberFraction, t.heapUseRedFraction),
      );
    }

    const visibleCostAverage = this.visibleCostWindow.averageSince(nowMs);
    const visibleCostPeak = this.visibleCostWindow.maxSince(nowMs);
    const visibleSessionCostAverage =
      this.visibleFrameCount > 0 ? this.visibleCostTotalMs / this.visibleFrameCount : Number.NaN;
    const costState = severity(
      visibleCostAverage,
      t.hudCostAmberMsPerFrame,
      t.hudCostRedMsPerFrame,
    );

    const metrics: DiagnosticMetricSnapshot[] = [
      {
        id: "frame",
        label: "Frame time",
        state: frameState,
        value:
          `now ${formatMs(this.currentFrameMs)} | p99 ${formatMs(frameP99)} | ` +
          `10s peak ${formatMs(recentFramePeak)}`,
      },
      {
        id: "stalls",
        label: "Stalls >250ms",
        state: this.stallCount > 0 ? "RED" : "GREEN",
        value: `${this.stallCount} this session | ${this.stallWindow.countSince(nowMs)} in 10s`,
      },
      {
        id: "corrections",
        label: "SELF corrections",
        state: correctionState,
        value:
          `${this.correctionCount} | max ${formatPx(this.maxCorrectionPx)} | ` +
          `band ${correctionBandName(this.lastCorrectionBand)} | ` +
          `S${this.silentCount}/M${this.smoothCount}/N${this.snapCount}`,
      },
      {
        id: "divergence",
        label: "Render<->commit",
        state: divergenceState,
        value:
          `now ${formatPx(this.currentDivergencePx)} | ` +
          `10s peak ${formatPx(recentDivergencePeak)}`,
      },
      {
        id: "input",
        label: "Input latency",
        state: inputState,
        value:
          `now ${formatMs(this.currentInputLatencyMs)} | ` +
          `10s peak ${formatMs(recentInputPeak)}`,
      },
      {
        id: "tick",
        label: "Server tick",
        state: tickState,
        value:
          `now ${formatMs(this.currentTickIntervalMs)} vs ${TICK_MS}ms | ` +
          `drift ${Number.isFinite(this.currentTickDriftMs) ? `${this.currentTickDriftMs >= 0 ? "+" : ""}${this.currentTickDriftMs.toFixed(1)}ms` : "n/a"} | ` +
          `gap ${this.currentTickGap}`,
      },
      {
        id: "rtt",
        label: "Room RTT",
        state: rttState,
        value: `now ${formatMs(this.currentRttMs)} | 10s peak ${formatMs(recentRttPeak)}`,
      },
      {
        id: "pending",
        label: "Prediction pending",
        state: pendingState,
        value:
          `now ${this.currentPending} | 10s peak ${Number.isFinite(recentPendingPeak) ? recentPendingPeak.toFixed(0) : "n/a"} | ` +
          `growth +${this.pendingGrowth} | cap ${PRED_PENDING_MAX}`,
      },
      {
        id: "load",
        label: "Entity load",
        state: loadState,
        value:
          `E ${this.currentEnemies} | P ${this.currentProjectiles} | ` +
          `FX ${this.currentVfxSurfaces}/${this.currentVfxParticles} particles`,
      },
      {
        id: "heap",
        label: "JS heap",
        state: heapState,
        value: this.heapAvailable
          ? `${this.currentHeapUsedMb.toFixed(1)}/${this.currentHeapLimitMb.toFixed(0)}MB | ` +
            `${this.currentHeapGrowthMbPerSec >= 0 ? "+" : ""}${this.currentHeapGrowthMbPerSec.toFixed(2)}MB/s`
          : "performance.memory unavailable",
      },
      {
        id: "resync",
        label: "forceResync",
        state: this.resyncCount > 0 ? "RED" : "GREEN",
        value: `${this.resyncCount} this session | ${this.resyncWindow.countSince(nowMs)} in 10s`,
      },
      {
        id: "cost",
        label: "HUD cost",
        state: costState,
        value:
          `avg ${formatCostMs(visibleCostAverage)}/frame | ` +
          `10s peak ${formatCostMs(visibleCostPeak)} | ` +
          `session ${formatCostMs(visibleSessionCostAverage)}/frame | ` +
          `display ${formatCostMs(this.visibleDisplayCostMs)}`,
      },
    ];
    let redCount = 0;
    let amberCount = 0;
    for (const metric of metrics) {
      if (metric.state === "RED") redCount++;
      else if (metric.state === "AMBER") amberCount++;
    }
    return {
      metrics,
      redCount,
      amberCount,
      windowSeconds: Math.min(WINDOW_MS, Math.max(0, nowMs - this.startedAtMs)) / 1_000,
    };
  }

  dump(nowMs = performance.now(), timestamp = new Date().toISOString()): string {
    const snapshot = this.snapshot(nowMs);
    const lines = [
      `DD DIAG v1 | ${timestamp} | last ${snapshot.windowSeconds.toFixed(1)}s + session peaks`,
      `STATUS ${snapshot.redCount} RED / ${snapshot.amberCount} AMBER / ${DIAGNOSTIC_HUD_METRIC_COUNT - snapshot.redCount - snapshot.amberCount} GREEN`,
    ];
    for (const metric of snapshot.metrics) {
      lines.push(`${metric.state.padEnd(5)} ${metric.label.padEnd(19)} ${metric.value}`);
    }
    lines.push(
      `EVENTS 10s stalls=${this.stallWindow.countSince(nowMs)} corrections=${this.correctionMagnitudeWindow.countSince(nowMs)} resyncs=${this.resyncWindow.countSince(nowMs)}`,
      `PEAKS session frame=${this.sessionFramePeakMs.toFixed(1)}ms renderCommit=${this.sessionDivergencePeakPx.toFixed(1)}px input=${this.sessionInputLatencyPeakMs.toFixed(1)}ms rtt=${this.sessionRttPeakMs.toFixed(1)}ms tickDrift=${this.sessionTickDriftPeakMs.toFixed(1)}ms heap=${this.sessionHeapPeakMb.toFixed(1)}MB hudDisplay=${this.visibleDisplayCostPeakMs.toFixed(3)}ms`,
      `LAST SELF cause=${this.lastCorrectionCause} band=${correctionBandName(this.lastCorrectionBand)}`,
    );
    const redLabels = snapshot.metrics
      .filter((metric) => metric.state === "RED")
      .map((metric) => metric.label);
    const amberLabels = snapshot.metrics
      .filter((metric) => metric.state === "AMBER")
      .map((metric) => metric.label);
    lines.push(
      `FLAGS red=${redLabels.length > 0 ? redLabels.join(",") : "none"} | amber=${amberLabels.length > 0 ? amberLabels.join(",") : "none"}`,
    );
    return lines.join("\n");
  }
}

type ContextWriter = (context: DiagnosticHudContext) => void;

const STATE_COLORS: Record<DiagnosticState, string> = {
  GREEN: "#75ef86",
  AMBER: "#ffd166",
  RED: "#ff5f68",
};

function loadPersistedVisibility(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistVisibility(visible: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, visible ? "1" : "0");
  } catch {
    // Storage can be unavailable in privacy/sandboxed contexts; the in-memory toggle still works.
  }
}

function readPerformanceMemory(): PerformanceMemory | undefined {
  return (performance as Performance & { memory?: PerformanceMemory }).memory;
}

function isLatencyKey(code: string): boolean {
  return (
    code === "KeyW" ||
    code === "KeyA" ||
    code === "KeyS" ||
    code === "KeyD" ||
    code === "Space" ||
    code === "ShiftLeft" ||
    code === "ShiftRight" ||
    code === "ControlLeft" ||
    code === "ControlRight"
  );
}

/**
 * Dev-only, non-interactive overlay. F8/F9 listeners never preventDefault, stop propagation, or focus
 * anything. The scene owns gameplay; this class only samples scalar state and updates text at 4 Hz.
 */
export class DiagnosticHud {
  readonly telemetry: DiagnosticHudTelemetry;
  private readonly writeContext: ContextWriter;
  private readonly context: DiagnosticHudContext = {
    pendingInputs: 0,
    enemies: 0,
    projectiles: 0,
    vfxSurfaces: 0,
    vfxParticles: 0,
  };
  private readonly root: HTMLDivElement;
  private readonly heading: HTMLDivElement;
  private readonly rows: HTMLDivElement[] = [];
  private visible: boolean;
  private nextDisplayAtMs = 0;

  constructor(writeContext: ContextWriter, telemetry = new DiagnosticHudTelemetry()) {
    this.writeContext = writeContext;
    this.telemetry = telemetry;
    this.visible = loadPersistedVisibility();
    this.root = document.createElement("div");
    this.root.dataset.instrument = "b84-diagnostic-hud";
    this.root.setAttribute("aria-hidden", "true");
    Object.assign(this.root.style, {
      position: "fixed",
      right: "10px",
      bottom: "10px",
      zIndex: "999997",
      width: "min(560px, calc(100vw - 20px))",
      boxSizing: "border-box",
      padding: "9px 11px",
      color: "#d8e1e8",
      background: "rgba(5, 9, 13, 0.88)",
      border: "1px solid rgba(145, 173, 189, 0.55)",
      borderRadius: "6px",
      boxShadow: "0 7px 28px rgba(0, 0, 0, 0.48)",
      font: "700 11px/1.35 ui-monospace, SFMono-Regular, Consolas, monospace",
      letterSpacing: "0.01em",
      pointerEvents: "none",
      userSelect: "text",
      whiteSpace: "nowrap",
    });
    this.heading = document.createElement("div");
    this.heading.style.color = "#dce9ef";
    this.heading.style.marginBottom = "4px";
    this.root.append(this.heading);
    for (let i = 0; i < DIAGNOSTIC_HUD_METRIC_COUNT; i++) {
      const row = document.createElement("div");
      this.rows.push(row);
      this.root.append(row);
    }
    this.root.hidden = !this.visible;
    document.body.append(this.root);
    window.addEventListener("keydown", this.onKeyDown, { capture: true, passive: true });
  }

  recordFrame(deltaMs: number): void {
    const startedAtMs = performance.now();
    this.telemetry.recordFrame(deltaMs, startedAtMs);
    let displayUpdated = false;
    if (startedAtMs >= this.nextDisplayAtMs) {
      this.context.heapUsedBytes = undefined;
      this.context.heapLimitBytes = undefined;
      this.writeContext(this.context);
      const memory = readPerformanceMemory();
      if (memory) {
        this.context.heapUsedBytes = memory.usedJSHeapSize;
        this.context.heapLimitBytes = memory.jsHeapSizeLimit;
      }
      this.telemetry.recordContext(this.context, startedAtMs);
      if (this.visible) {
        this.render(startedAtMs);
        displayUpdated = true;
      }
      this.nextDisplayAtMs = startedAtMs + DISPLAY_INTERVAL_MS;
    }
    const finishedAtMs = performance.now();
    this.telemetry.recordHudCost(
      finishedAtMs - startedAtMs,
      this.visible,
      displayUpdated,
      finishedAtMs,
    );
  }

  recordCommand(seq: number): void {
    this.telemetry.recordCommand(seq);
  }

  recordServerPatch(tick: number, ackSeq: number | undefined): void {
    this.telemetry.recordServerPatch(tick, ackSeq);
  }

  recordSelfCorrection(event: Readonly<SelfCorrectionEvent>): void {
    this.telemetry.recordSelfCorrection(event);
  }

  recordRenderCommitDivergence(divergencePx: number): void {
    this.telemetry.recordRenderCommitDivergence(divergencePx);
  }

  recordResync(): void {
    this.telemetry.recordResync();
  }

  dump(): string {
    return this.telemetry.dump();
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKeyDown, true);
    this.root.remove();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === DIAGNOSTIC_HUD_TOGGLE_KEY) {
      this.visible = !this.visible;
      this.root.hidden = !this.visible;
      persistVisibility(this.visible);
      if (this.visible) {
        const nowMs = performance.now();
        this.render(nowMs);
        this.nextDisplayAtMs = nowMs + DISPLAY_INTERVAL_MS;
      }
      return;
    }
    if (event.code === DIAGNOSTIC_HUD_COPY_KEY) {
      const dump = this.dump();
      console.info(`[DD diagnostic dump]\n${dump}`);
      const clipboard = navigator.clipboard;
      if (clipboard) {
        void clipboard
          .writeText(dump)
          .catch((error: unknown) => console.warn("[DD diagnostic dump] clipboard failed", error));
      } else {
        console.warn("[DD diagnostic dump] clipboard API unavailable; dump logged above");
      }
      return;
    }
    if (!event.repeat && isLatencyKey(event.code)) this.telemetry.recordInputKey();
  };

  private render(nowMs: number): void {
    const snapshot = this.telemetry.snapshot(nowMs);
    this.heading.textContent =
      `DD DIAG | ${snapshot.redCount} RED / ${snapshot.amberCount} AMBER | ` +
      `${DIAGNOSTIC_HUD_TOGGLE_KEY} hide | ${DIAGNOSTIC_HUD_COPY_KEY} copy 10s dump`;
    for (let i = 0; i < this.rows.length; i++) {
      const metric = snapshot.metrics[i];
      const row = this.rows[i];
      if (!metric || !row) continue;
      row.style.color = STATE_COLORS[metric.state];
      row.textContent = `${metric.state.padEnd(5)} | ${metric.label.padEnd(19)} | ${metric.value}`;
    }
  }
}
