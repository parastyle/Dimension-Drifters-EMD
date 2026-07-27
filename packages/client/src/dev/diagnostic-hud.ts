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

export type DiagnosticState = "GREEN" | "AMBER" | "RED" | "N/A";

export interface DiagnosticHudContext {
  pendingInputs?: number;
  enemies?: number;
  projectiles?: number;
  vfxSurfaces?: number;
  vfxParticles?: number;
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
  out.vfxSurfaces = undefined;
  out.vfxParticles = undefined;
  const surfaces = (bloomRoot as VfxDiagnosticNode | undefined)?.list;
  if (!surfaces) return;
  out.vfxSurfaces = 0;
  out.vfxParticles = 0;
  for (let i = 0; i < surfaces.length; i++) {
    const surface = surfaces[i] as VfxDiagnosticNode | undefined;
    if (!surface || surface.visible === false) continue;
    out.vfxSurfaces = (out.vfxSurfaces ?? 0) + 1;
    out.vfxParticles = (out.vfxParticles ?? 0) + countAliveParticles(surface);
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
  readonly unavailableCount: number;
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
  if (!Number.isFinite(value)) return "N/A";
  if (value > redAbove) return "RED";
  if (value > amberAbove) return "AMBER";
  return "GREEN";
}

function worstState(a: DiagnosticState, b: DiagnosticState): DiagnosticState {
  if (a === "RED" || b === "RED") return "RED";
  if (a === "AMBER" || b === "AMBER") return "AMBER";
  if (a === "GREEN" || b === "GREEN") return "GREEN";
  if (a === "N/A" || b === "N/A") return "N/A";
  return "GREEN";
}

function nonNegativeOrNaN(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : Number.NaN;
}

function finiteMax(...values: readonly number[]): number {
  let result = Number.NaN;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    result = Number.isFinite(result) ? Math.max(result, value) : value;
  }
  return result;
}

function formatCount(value: number): string {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)).toFixed(0) : "n/a";
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
/** ~1.3s at 60Hz — long enough to hold a walk, the release edge, and the settle after it. */
const ROOT_STEP_TRACE_FRAMES = 80;

export class DiagnosticHudTelemetry {
  private readonly startedAtMs: number;
  private readonly frameWindow = new NumericWindow(FRAME_RING_CAPACITY);
  private readonly stallWindow = new NumericWindow(EVENT_RING_CAPACITY);
  private readonly correctionMagnitudeWindow = new NumericWindow(EVENT_RING_CAPACITY);
  /** B85's exact tick-boundary value, retained because it catches commit/replay discontinuities. */
  private readonly boundaryDivergenceWindow = new NumericWindow(SAMPLE_RING_CAPACITY);
  /** Actual rendered root versus the sampled commit prefix on every frame; 10s at normal frame rates. */
  private readonly intraTickDivergenceWindow = new NumericWindow(FRAME_RING_CAPACITY);
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
  private sessionFramePeakMs = Number.NaN;
  private stallCount = 0;
  private selfCorrectionSourceAvailable = false;
  private correctionCount = 0;
  private silentCount = 0;
  private smoothCount = 0;
  private snapCount = 0;
  private maxCorrectionPx = Number.NaN;
  private lastCorrectionBand = -1;
  private lastCorrectionCause = "none";
  private currentBoundaryDivergencePx = Number.NaN;
  private sessionBoundaryDivergencePeakPx = Number.NaN;
  private currentIntraTickDivergencePx = Number.NaN;
  private readonly rootStepPx = new Float32Array(ROOT_STEP_TRACE_FRAMES);
  private readonly rootGapPx = new Float32Array(ROOT_STEP_TRACE_FRAMES);
  private readonly rootStepIntent = new Uint8Array(ROOT_STEP_TRACE_FRAMES);
  private rootStepIndex = 0;
  private rootStepCount = 0;
  private sessionIntraTickDivergencePeakPx = Number.NaN;
  private pendingKeyAtMs = Number.NaN;
  private currentInputLatencyMs = Number.NaN;
  private sessionInputLatencyPeakMs = Number.NaN;
  private previousTick = 0;
  private previousTickAtMs = Number.NaN;
  private hasPreviousTick = false;
  private currentTickIntervalMs = Number.NaN;
  private currentTickDriftMs = Number.NaN;
  private currentTickGap = 1;
  private sessionTickDriftPeakMs = Number.NaN;
  private currentRttMs = Number.NaN;
  private sessionRttPeakMs = Number.NaN;
  private currentPending = Number.NaN;
  private pendingGrowth = Number.NaN;
  private currentEnemies = Number.NaN;
  private currentProjectiles = Number.NaN;
  private currentVfxSurfaces = Number.NaN;
  private currentVfxParticles = Number.NaN;
  private heapAvailable = false;
  private currentHeapUsedMb = Number.NaN;
  private currentHeapLimitMb = Number.NaN;
  private currentHeapGrowthMbPerSec = Number.NaN;
  private sessionHeapPeakMb = Number.NaN;
  private resyncCount = 0;
  private visibleFrameCount = 0;
  private visibleCostTotalMs = 0;
  private visibleDisplayCostMs = Number.NaN;
  private visibleDisplayCostPeakMs = Number.NaN;

  constructor(startedAtMs = performance.now()) {
    this.startedAtMs = startedAtMs;
  }

  recordFrame(deltaMs: number, nowMs = performance.now()): void {
    const duration = nonNegativeOrNaN(deltaMs);
    this.currentFrameMs = duration;
    if (!Number.isFinite(duration)) return;
    this.sessionFramePeakMs = finiteMax(this.sessionFramePeakMs, duration);
    this.frameWindow.push(nowMs, duration);
    if (duration > DIAGNOSTIC_THRESHOLDS.stallRedMs) {
      this.stallCount++;
      this.stallWindow.push(nowMs, duration);
    }
  }

  markSelfCorrectionSourceAvailable(): void {
    this.selfCorrectionSourceAvailable = true;
  }

  recordInputKey(nowMs = performance.now()): void {
    if (!Number.isFinite(this.pendingKeyAtMs)) this.pendingKeyAtMs = nowMs;
  }

  recordCommand(seq: number, nowMs = performance.now()): void {
    if (Number.isFinite(this.pendingKeyAtMs)) {
      const latency = Math.max(0, nowMs - this.pendingKeyAtMs);
      this.currentInputLatencyMs = latency;
      this.sessionInputLatencyPeakMs = finiteMax(this.sessionInputLatencyPeakMs, latency);
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
        this.sessionTickDriftPeakMs = finiteMax(this.sessionTickDriftPeakMs, Math.abs(drift));
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
    this.sessionRttPeakMs = finiteMax(this.sessionRttPeakMs, rtt);
    this.rttWindow.push(nowMs, rtt);
  }

  recordContext(context: Readonly<DiagnosticHudContext>, nowMs = performance.now()): void {
    const measuredCount = (value: number | undefined): number =>
      value !== undefined && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : Number.NaN;
    this.currentPending = measuredCount(context.pendingInputs);
    this.currentEnemies = measuredCount(context.enemies);
    this.currentProjectiles = measuredCount(context.projectiles);
    this.currentVfxSurfaces = measuredCount(context.vfxSurfaces);
    this.currentVfxParticles = measuredCount(context.vfxParticles);
    if (Number.isFinite(this.currentPending)) {
      this.pendingWindow.push(nowMs, this.currentPending);
      const oldestPending = this.pendingWindow.oldestValueSince(nowMs);
      this.pendingGrowth = oldestPending
        ? Math.max(0, this.currentPending - oldestPending.value)
        : Number.NaN;
    } else {
      this.pendingGrowth = Number.NaN;
    }
    if (Number.isFinite(this.currentEnemies)) this.enemyWindow.push(nowMs, this.currentEnemies);
    if (Number.isFinite(this.currentProjectiles))
      this.projectileWindow.push(nowMs, this.currentProjectiles);
    if (Number.isFinite(this.currentVfxSurfaces))
      this.vfxSurfaceWindow.push(nowMs, this.currentVfxSurfaces);
    if (Number.isFinite(this.currentVfxParticles))
      this.vfxParticleWindow.push(nowMs, this.currentVfxParticles);

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
    this.sessionHeapPeakMb = finiteMax(this.sessionHeapPeakMb, this.currentHeapUsedMb);
    this.heapUsedWindow.push(nowMs, this.currentHeapUsedMb);
    const oldestHeap = this.heapUsedWindow.oldestValueSince(nowMs);
    const elapsedSeconds = oldestHeap ? (nowMs - oldestHeap.timeMs) / 1_000 : 0;
    this.currentHeapGrowthMbPerSec =
      oldestHeap && elapsedSeconds >= 2
        ? (this.currentHeapUsedMb - oldestHeap.value) / elapsedSeconds
        : Number.NaN;
    if (Number.isFinite(this.currentHeapGrowthMbPerSec))
      this.heapGrowthWindow.push(nowMs, this.currentHeapGrowthMbPerSec);
  }

  recordSelfCorrection(event: Readonly<SelfCorrectionEvent>, nowMs = performance.now()): void {
    this.selfCorrectionSourceAvailable = true;
    const magnitude = nonNegativeOrNaN(event.magnitudePx);
    this.correctionCount++;
    this.maxCorrectionPx = finiteMax(this.maxCorrectionPx, magnitude);
    this.lastCorrectionBand = event.band;
    this.lastCorrectionCause = event.cause;
    if (event.band === MovementCorrectionBand.Silent) this.silentCount++;
    else if (event.band === MovementCorrectionBand.Smooth) this.smoothCount++;
    else this.snapCount++;
    if (Number.isFinite(magnitude)) this.correctionMagnitudeWindow.push(nowMs, magnitude);
  }

  recordRenderCommitDivergence(divergencePx: number, nowMs = performance.now()): void {
    const divergence = nonNegativeOrNaN(divergencePx);
    this.currentBoundaryDivergencePx = divergence;
    if (!Number.isFinite(divergence)) return;
    this.sessionBoundaryDivergencePeakPx = finiteMax(
      this.sessionBoundaryDivergencePeakPx,
      divergence,
    );
    this.boundaryDivergenceWindow.push(nowMs, divergence);
  }

  /** Record the visible root's disagreement with the sampled prefix that the current tick will commit. */
  recordIntraTickRenderCommitDivergence(divergencePx: number, nowMs = performance.now()): void {
    const divergence = nonNegativeOrNaN(divergencePx);
    this.currentIntraTickDivergencePx = divergence;
    if (!Number.isFinite(divergence)) return;
    this.sessionIntraTickDivergencePeakPx = finiteMax(
      this.sessionIntraTickDivergencePeakPx,
      divergence,
    );
    this.intraTickDivergenceWindow.push(nowMs, divergence);
  }

  /**
   * Per-frame ROOT MOTION trace. Every other metric here reports an aggregate; none of them can answer
   * "what did the sprite actually do on the four frames around the moment I let go of the key". That
   * question is the whole of the owner's stop-pop report, so record the raw per-frame step and the
   * move-intent flag in fixed rings (no per-frame allocation) and print them in the dump.
   */
  recordSelfRootStep(stepPx: number, moveIntent: boolean, gapPx = Number.NaN): void {
    const step = Number.isFinite(stepPx) ? Math.max(0, stepPx) : 0;
    this.rootStepPx[this.rootStepIndex] = step;
    this.rootGapPx[this.rootStepIndex] = Number.isFinite(gapPx) ? Math.max(0, gapPx) : 0;
    this.rootStepIntent[this.rootStepIndex] = moveIntent ? 1 : 0;
    this.rootStepIndex = (this.rootStepIndex + 1) % ROOT_STEP_TRACE_FRAMES;
    if (this.rootStepCount < ROOT_STEP_TRACE_FRAMES) this.rootStepCount++;
  }

  /** Oldest-to-newest trace, each entry `step[intent]`, with the release edge marked `<STOP`. */
  private rootStepTrace(): string {
    return this.traceRing(this.rootStepPx);
  }

  /**
   * Per-frame |drawn root - predicted position|. If this GROWS through the walk the presentation is
   * being held behind prediction and the stop edge is repaying it; if it is flat and only the step
   * spikes, the prediction target itself jumped and presentation merely followed.
   */
  private rootGapTrace(): string {
    return this.traceRing(this.rootGapPx);
  }

  private traceRing(ring: Float32Array): string {
    if (this.rootStepCount <= 0) return "n/a (no frames recorded)";
    const out: string[] = [];
    const start =
      (this.rootStepIndex - this.rootStepCount + ROOT_STEP_TRACE_FRAMES) % ROOT_STEP_TRACE_FRAMES;
    let previousIntent = -1;
    for (let i = 0; i < this.rootStepCount; i++) {
      const slot = (start + i) % ROOT_STEP_TRACE_FRAMES;
      const intent = this.rootStepIntent[slot] ?? 0;
      const edge = previousIntent === 1 && intent === 0 ? "<STOP " : "";
      previousIntent = intent;
      out.push(`${edge}${(ring[slot] ?? 0).toFixed(2)}${intent === 1 ? "" : "i"}`);
    }
    return out.join(" ");
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
    const cost = nonNegativeOrNaN(costMs);
    if (!Number.isFinite(cost)) return;
    this.visibleFrameCount++;
    this.visibleCostTotalMs += cost;
    this.visibleCostWindow.push(nowMs, cost);
    if (displayUpdated) {
      this.visibleDisplayCostMs = cost;
      this.visibleDisplayCostPeakMs = finiteMax(this.visibleDisplayCostPeakMs, cost);
    }
  }

  snapshot(nowMs = performance.now()): DiagnosticSnapshot {
    const t = DIAGNOSTIC_THRESHOLDS;
    const frameP99 = this.frameWindow.quantileSince(nowMs, 0.99, this.frameHistogram, 1);
    const recentFramePeak = this.frameWindow.maxSince(nowMs);
    const frameState = severity(
      finiteMax(this.currentFrameMs, frameP99),
      t.frameAmberMs,
      t.frameRedMs,
    );

    const correctionState: DiagnosticState = !this.selfCorrectionSourceAvailable
      ? "N/A"
      : this.snapCount > 0
        ? "RED"
        : this.smoothCount > 0
          ? "AMBER"
          : "GREEN";
    const recentBoundaryDivergencePeak = this.boundaryDivergenceWindow.maxSince(nowMs);
    const recentIntraTickDivergencePeak = this.intraTickDivergenceWindow.maxSince(nowMs);
    const divergenceState = severity(
      finiteMax(
        this.currentBoundaryDivergencePx,
        recentBoundaryDivergencePeak,
        this.currentIntraTickDivergencePx,
        recentIntraTickDivergencePeak,
      ),
      t.divergenceAmberPx,
      t.divergenceRedPx,
    );
    const recentInputPeak = this.inputLatencyWindow.maxSince(nowMs);
    const inputState = severity(
      finiteMax(this.currentInputLatencyMs, recentInputPeak),
      t.inputAmberMs,
      t.inputRedMs,
    );
    const recentTickDriftPeak = this.tickDriftWindow.maxSince(nowMs);
    const recentTickGapPeak = this.tickGapWindow.maxSince(nowMs);
    let tickState = severity(recentTickDriftPeak, t.tickDriftAmberMs, t.tickDriftRedMs);
    if (recentTickGapPeak > 3) tickState = "RED";
    else if (recentTickGapPeak > 1) tickState = worstState(tickState, "AMBER");
    const recentRttPeak = this.rttWindow.maxSince(nowMs);
    const rttState = severity(
      finiteMax(this.currentRttMs, recentRttPeak),
      t.rttAmberMs,
      t.rttRedMs,
    );

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

    let heapState: DiagnosticState = "N/A";
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
        state: Number.isFinite(this.currentFrameMs)
          ? this.stallCount > 0
            ? "RED"
            : "GREEN"
          : "N/A",
        value: Number.isFinite(this.currentFrameMs)
          ? `${this.stallCount} this session | ${this.stallWindow.countSince(nowMs)} in 10s`
          : "n/a",
      },
      {
        id: "corrections",
        label: "SELF corrections",
        state: correctionState,
        value: this.selfCorrectionSourceAvailable
          ? `${this.correctionCount} | max ${this.correctionCount > 0 ? formatPx(this.maxCorrectionPx) : "n/a"} | ` +
            `band ${correctionBandName(this.lastCorrectionBand)} | ` +
            `S${this.silentCount}/M${this.smoothCount}/N${this.snapCount}`
          : "n/a",
      },
      {
        id: "divergence",
        label: "Render<->commit",
        state: divergenceState,
        value:
          `intra now ${formatPx(this.currentIntraTickDivergencePx)} | ` +
          `10s peak ${formatPx(recentIntraTickDivergencePeak)} | ` +
          `boundary now ${formatPx(this.currentBoundaryDivergencePx)} | ` +
          `10s peak ${formatPx(recentBoundaryDivergencePeak)}`,
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
        value: Number.isFinite(this.currentTickIntervalMs)
          ? `now ${formatMs(this.currentTickIntervalMs)} vs ${TICK_MS}ms | ` +
            `drift ${this.currentTickDriftMs >= 0 ? "+" : ""}${this.currentTickDriftMs.toFixed(1)}ms | ` +
            `gap ${this.currentTickGap}`
          : "n/a",
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
          `now ${formatCount(this.currentPending)} | 10s peak ${formatCount(recentPendingPeak)} | ` +
          `growth ${Number.isFinite(this.pendingGrowth) ? `+${this.pendingGrowth.toFixed(0)}` : "n/a"} | cap ${PRED_PENDING_MAX}`,
      },
      {
        id: "load",
        label: "Entity load",
        state: loadState,
        value:
          `E ${formatCount(this.currentEnemies)} | P ${formatCount(this.currentProjectiles)} | ` +
          `FX ${formatCount(this.currentVfxSurfaces)}/${formatCount(this.currentVfxParticles)} particles`,
      },
      {
        id: "heap",
        label: "JS heap",
        state: heapState,
        value: this.heapAvailable
          ? `${this.currentHeapUsedMb.toFixed(1)}/${this.currentHeapLimitMb.toFixed(0)}MB | ` +
            `${
              Number.isFinite(this.currentHeapGrowthMbPerSec)
                ? `${this.currentHeapGrowthMbPerSec >= 0 ? "+" : ""}${this.currentHeapGrowthMbPerSec.toFixed(2)}MB/s`
                : "growth n/a"
            }`
          : "n/a (performance.memory unavailable)",
      },
      {
        id: "resync",
        label: "forceResync",
        state: Number.isFinite(this.currentFrameMs)
          ? this.resyncCount > 0
            ? "RED"
            : "GREEN"
          : "N/A",
        value: Number.isFinite(this.currentFrameMs)
          ? `${this.resyncCount} this session | ${this.resyncWindow.countSince(nowMs)} in 10s`
          : "n/a",
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
    let unavailableCount = 0;
    for (const metric of metrics) {
      if (metric.state === "RED") redCount++;
      else if (metric.state === "AMBER") amberCount++;
      else if (metric.state === "N/A") unavailableCount++;
    }
    return {
      metrics,
      redCount,
      amberCount,
      unavailableCount,
      windowSeconds: Math.min(WINDOW_MS, Math.max(0, nowMs - this.startedAtMs)) / 1_000,
    };
  }

  dump(nowMs = performance.now(), timestamp = new Date().toISOString()): string {
    const snapshot = this.snapshot(nowMs);
    const lines = [
      `DD DIAG v1 | ${timestamp} | last ${snapshot.windowSeconds.toFixed(1)}s + session peaks`,
      `STATUS ${snapshot.redCount} RED / ${snapshot.amberCount} AMBER / ${snapshot.unavailableCount} N/A / ${DIAGNOSTIC_HUD_METRIC_COUNT - snapshot.redCount - snapshot.amberCount - snapshot.unavailableCount} GREEN`,
    ];
    for (const metric of snapshot.metrics) {
      lines.push(`${metric.state.padEnd(5)} ${metric.label.padEnd(19)} ${metric.value}`);
    }
    lines.push(
      `EVENTS 10s stalls=${Number.isFinite(this.currentFrameMs) ? this.stallWindow.countSince(nowMs) : "n/a"} corrections=${this.selfCorrectionSourceAvailable ? this.correctionMagnitudeWindow.countSince(nowMs) : "n/a"} resyncs=${Number.isFinite(this.currentFrameMs) ? this.resyncWindow.countSince(nowMs) : "n/a"}`,
      `PEAKS session frame=${formatMs(this.sessionFramePeakMs)} renderCommitIntra=${formatPx(this.sessionIntraTickDivergencePeakPx)} renderCommitBoundary=${formatPx(this.sessionBoundaryDivergencePeakPx)} input=${formatMs(this.sessionInputLatencyPeakMs)} rtt=${formatMs(this.sessionRttPeakMs)} tickDrift=${formatMs(this.sessionTickDriftPeakMs)} heap=${Number.isFinite(this.sessionHeapPeakMb) ? `${this.sessionHeapPeakMb.toFixed(1)}MB` : "n/a"} hudDisplay=${formatCostMs(this.visibleDisplayCostPeakMs)}`,
      `LAST SELF cause=${this.lastCorrectionCause} band=${correctionBandName(this.lastCorrectionBand)}`,
      // Constant-speed travel at 60Hz is ~5.33px/frame (MOVE_SPEED 320 / 60). Steps BELOW that while
      // intent is held are withheld movement; a step ABOVE it right after `<STOP` is that withheld
      // movement being repaid in one frame -- the stop-pop, in raw numbers. `i` marks an idle frame.
      // Expected constant-speed step is MOVE_SPEED/refresh: ~5.33px at 60Hz, ~2.24px at 143Hz. Compare
      // the two rows: a spike in STEPS with a matching COLLAPSE in GAP means presentation repaid debt it
      // had been holding; a spike in STEPS with a flat GAP means the prediction target itself jumped.
      `ROOT STEPS px/frame (oldest->newest; MOVE_SPEED/refresh while moving, ~0 after <STOP)`,
      this.rootStepTrace(),
      `ROOT GAP px |root-predicted| (same frames; should stay ~0 -- growth = withheld movement)`,
      this.rootGapTrace(),
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
  "N/A": "#9aa7af",
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
    pendingInputs: undefined,
    enemies: undefined,
    projectiles: undefined,
    vfxSurfaces: undefined,
    vfxParticles: undefined,
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
      this.context.pendingInputs = undefined;
      this.context.enemies = undefined;
      this.context.projectiles = undefined;
      this.context.vfxSurfaces = undefined;
      this.context.vfxParticles = undefined;
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

  markSelfCorrectionSourceAvailable(): void {
    this.telemetry.markSelfCorrectionSourceAvailable();
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

  recordSelfRootStep(stepPx: number, moveIntent: boolean, gapPx?: number): void {
    this.telemetry.recordSelfRootStep(stepPx, moveIntent, gapPx);
  }

  recordIntraTickRenderCommitDivergence(divergencePx: number): void {
    this.telemetry.recordIntraTickRenderCommitDivergence(divergencePx);
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
      `DD DIAG | ${snapshot.redCount} RED / ${snapshot.amberCount} AMBER / ${snapshot.unavailableCount} N/A | ` +
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
