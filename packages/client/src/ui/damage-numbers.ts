import type Phaser from "phaser";
import { type DamageNumberEvent, TokenBucket } from "../combat-feedback.js";
import type { FeedbackSettings } from "../settings.js";

export const DAMAGE_NUMBER_DEPTH = 99995;
export const MAX_DAMAGE_LABELS = 40;
export const DAMAGE_NUMBER_FRAME_BUDGET = 24;

const GLYPHS = "0123456789!+-";
const ATLAS_KEY = "dd:damage-glyphs:v1";
const FONT_PREFIX = "dd:damage-font:v1:";
const FONT_STYLE_COUNT = 6;
const SLOT_FREE = 0;
const SLOT_DISCRETE = 1;
const SLOT_ACCUMULATOR = 2;
const SLOT_RELEASED = 3;

const ATTRIBUTION = {
  self: 1,
  teammate: 2,
  mixed: 3,
  unattributed: 4,
} as const;

export interface DamageNumberTuning {
  tokenCapacity: number;
  tokenRefillPerSec: number;
  accumulatorReleaseMs: number;
  tickTauMs: number;
  critFlashMs: number;
  pulseMs: number;
  maxLabels: number;
  frameSpawnBudget: number;
}

export const DEFAULT_DAMAGE_NUMBER_TUNING: Readonly<DamageNumberTuning> = Object.freeze({
  tokenCapacity: 4,
  tokenRefillPerSec: 4,
  accumulatorReleaseMs: 300,
  tickTauMs: 90,
  critFlashMs: 150,
  pulseMs: 80,
  maxLabels: MAX_DAMAGE_LABELS,
  frameSpawnBudget: DAMAGE_NUMBER_FRAME_BUDGET,
});

export interface DamageSlotView {
  slot: number;
  kind: number;
  targetId: string;
  value: number;
  displayValue: number;
  x: number;
  y: number;
  ageMs: number;
  lifeMs: number;
  pulseMs: number;
  critFlashMs: number;
  crit: boolean;
  finalBlow: boolean;
  selfDamage: boolean;
  attribution: DamageNumberEvent["attribution"];
  anchored: boolean;
}

interface PendingDamage {
  value: number;
  x: number;
  y: number;
  lastAt: number;
  crit: boolean;
  finalBlow: boolean;
  selfDamage: boolean;
  attribution: DamageNumberEvent["attribution"];
  detached: boolean;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function bandFor(value: number): number {
  if (value >= 40) return 3;
  if (value >= 20) return 2;
  if (value >= 8) return 1;
  return 0;
}

function attributionCode(value: DamageNumberEvent["attribution"]): number {
  return ATTRIBUTION[value];
}

function attributionValue(code: number): DamageNumberEvent["attribution"] {
  if (code === ATTRIBUTION.self) return "self";
  if (code === ATTRIBUTION.teammate) return "teammate";
  if (code === ATTRIBUTION.mixed) return "mixed";
  return "unattributed";
}

/**
 * Phaser-free accumulator and pool state. Every value admitted here is a DamageNumberEvent, which the
 * CombatFeedback bus can construct only from an authoritative HP delta.
 */
export class DamageNumberEngine {
  private readonly kind: Uint8Array;
  private readonly attribution: Uint8Array;
  private readonly crit: Uint8Array;
  private readonly finalBlow: Uint8Array;
  private readonly selfDamage: Uint8Array;
  private readonly value: Float64Array;
  private readonly displayValue: Float64Array;
  private readonly x: Float32Array;
  private readonly y: Float32Array;
  private readonly ageMs: Float32Array;
  private readonly lifeMs: Float32Array;
  private readonly lastContributionMs: Float64Array;
  private readonly pulseMs: Float32Array;
  private readonly critFlashMs: Float32Array;
  private readonly targetIds: string[];
  private readonly free: Uint8Array;
  private freeCount: number;
  private activeCountValue = 0;
  private frameSpawns = 0;
  private readonly buckets = new Map<string, TokenBucket>();
  private readonly accumulatorByTarget = new Map<string, number>();
  private readonly pendingByTarget = new Map<string, PendingDamage>();
  private readonly pendingEvent: DamageNumberEvent = {
    targetId: "",
    damage: 0,
    x: 0,
    y: 0,
    visible: true,
    attribution: "unattributed",
    crit: false,
    finalBlow: false,
    selfDamage: false,
  };
  private readonly viewScratch: DamageSlotView = {
    slot: -1,
    kind: SLOT_FREE,
    targetId: "",
    value: 0,
    displayValue: 0,
    x: 0,
    y: 0,
    ageMs: 0,
    lifeMs: 0,
    pulseMs: 0,
    critFlashMs: 0,
    crit: false,
    finalBlow: false,
    selfDamage: false,
    attribution: "unattributed",
    anchored: false,
  };

  constructor(readonly tuning: DamageNumberTuning = { ...DEFAULT_DAMAGE_NUMBER_TUNING }) {
    const count = Math.max(1, Math.min(255, Math.floor(tuning.maxLabels)));
    this.kind = new Uint8Array(count);
    this.attribution = new Uint8Array(count);
    this.crit = new Uint8Array(count);
    this.finalBlow = new Uint8Array(count);
    this.selfDamage = new Uint8Array(count);
    this.value = new Float64Array(count);
    this.displayValue = new Float64Array(count);
    this.x = new Float32Array(count);
    this.y = new Float32Array(count);
    this.ageMs = new Float32Array(count);
    this.lifeMs = new Float32Array(count);
    this.lastContributionMs = new Float64Array(count);
    this.pulseMs = new Float32Array(count);
    this.critFlashMs = new Float32Array(count);
    this.targetIds = new Array<string>(count).fill("");
    this.free = new Uint8Array(count);
    this.freeCount = count;
    for (let i = 0; i < count; i++) this.free[i] = count - 1 - i;
  }

  beginFrame(): void {
    this.frameSpawns = 0;
  }

  ingest(event: DamageNumberEvent, nowMs: number, settings: FeedbackSettings): number {
    if (!(event.damage > 0) || settings.damageNumbers === "off" || !event.visible) return -1;
    if (settings.damageNumbers === "own" && !event.selfDamage && event.attribution !== "self")
      return -1;
    // Banked truth gets first claim on a new frame's slots/budget, so a permanent horde stream cannot
    // starve yesterday's exact sum behind an endless queue of newer requests.
    if (this.frameSpawns === 0 && this.pendingByTarget.size > 0) this.materializePending(nowMs);

    const forceAccumulator = settings.damageNumberStyle === "aggregate";
    const existing = this.accumulatorByTarget.get(event.targetId);
    if (existing !== undefined) {
      this.foldAccumulator(existing, event, nowMs);
      if (event.finalBlow) this.flushAccumulator(existing);
      return existing;
    }

    let discrete = !forceAccumulator && !event.selfDamage;
    if (discrete) {
      let bucket = this.buckets.get(event.targetId);
      if (!bucket) {
        bucket = new TokenBucket(this.tuning.tokenCapacity, this.tuning.tokenRefillPerSec);
        this.buckets.set(event.targetId, bucket);
      }
      discrete = bucket.tryTake(nowMs) && this.frameSpawns < this.tuning.frameSpawnBudget;
    }

    if (discrete || event.selfDamage) {
      const slot = this.acquire(event.selfDamage);
      if (slot >= 0) {
        if (!event.selfDamage) this.frameSpawns++;
        this.openSlot(slot, SLOT_DISCRETE, event, nowMs);
        return slot;
      }
    }
    return this.latchAccumulator(event, nowMs);
  }

  update(nowMs: number, deltaMs: number): void {
    const dt = Math.max(0, Math.min(100, deltaMs));
    for (let slot = 0; slot < this.kind.length; slot++) {
      const kind = this.kind[slot];
      if (kind === SLOT_FREE) continue;
      this.ageMs[slot]! += dt;
      this.pulseMs[slot] = Math.max(0, this.pulseMs[slot]! - dt);
      this.critFlashMs[slot] = Math.max(0, this.critFlashMs[slot]! - dt);
      if (kind === SLOT_ACCUMULATOR) {
        const response = 1 - Math.exp(-dt / this.tuning.tickTauMs);
        this.displayValue[slot]! += (this.value[slot]! - this.displayValue[slot]!) * response;
        if (nowMs - this.lastContributionMs[slot]! >= this.tuning.accumulatorReleaseMs) {
          this.accumulatorByTarget.delete(this.targetIds[slot]!);
          this.kind[slot] = SLOT_RELEASED;
          this.ageMs[slot] = 0;
          this.displayValue[slot] = this.value[slot]!;
          this.lifeMs[slot] = this.releaseLifetime(slot);
        }
      } else if (this.ageMs[slot]! >= this.lifeMs[slot]!) {
        this.release(slot);
      }
    }
    this.materializePending(nowMs);
  }

  clear(): void {
    for (let slot = 0; slot < this.kind.length; slot++)
      if (this.kind[slot] !== SLOT_FREE) this.release(slot);
    this.buckets.clear();
    this.accumulatorByTarget.clear();
    this.pendingByTarget.clear();
    this.frameSpawns = 0;
  }

  targetGone(targetId: string): void {
    this.buckets.delete(targetId);
    const pending = this.pendingByTarget.get(targetId);
    if (pending) pending.detached = true;
    const slot = this.accumulatorByTarget.get(targetId);
    if (slot === undefined) return;
    this.flushAccumulator(slot, 260);
  }

  detach(slot: number): void {
    if (this.kind[slot] !== SLOT_ACCUMULATOR) return;
    this.flushAccumulator(slot, 200);
  }

  isActive(slot: number): boolean {
    return this.kind[slot] !== SLOT_FREE;
  }

  get activeCount(): number {
    return this.activeCountValue;
  }

  get size(): number {
    return this.kind.length;
  }

  view(slot: number): DamageSlotView | null {
    if (this.kind[slot] === SLOT_FREE) return null;
    const view = this.viewScratch;
    view.slot = slot;
    view.kind = this.kind[slot]!;
    view.targetId = this.targetIds[slot]!;
    view.value = this.value[slot]!;
    view.displayValue = this.displayValue[slot]!;
    view.x = this.x[slot]!;
    view.y = this.y[slot]!;
    view.ageMs = this.ageMs[slot]!;
    view.lifeMs = this.lifeMs[slot]!;
    view.pulseMs = this.pulseMs[slot]!;
    view.critFlashMs = this.critFlashMs[slot]!;
    view.crit = this.crit[slot] !== 0;
    view.finalBlow = this.finalBlow[slot] !== 0;
    view.selfDamage = this.selfDamage[slot] !== 0;
    view.attribution = attributionValue(this.attribution[slot]!);
    view.anchored = this.kind[slot] === SLOT_ACCUMULATOR;
    return view;
  }

  setAnchor(slot: number, x: number, y: number): void {
    if (this.kind[slot] !== SLOT_ACCUMULATOR) return;
    this.x[slot]! += (x - this.x[slot]!) * 0.12;
    this.y[slot]! += (y - this.y[slot]!) * 0.12;
  }

  inspectAccumulator(
    targetId: string,
  ): { value: number; displayValue: number; critFlashMs: number; kind: number } | undefined {
    const slot = this.accumulatorByTarget.get(targetId);
    if (slot === undefined) return undefined;
    return {
      value: this.value[slot]!,
      displayValue: this.displayValue[slot]!,
      critFlashMs: this.critFlashMs[slot]!,
      kind: this.kind[slot]!,
    };
  }

  private latchAccumulator(event: DamageNumberEvent, nowMs: number): number {
    const slot = this.acquire(event.selfDamage);
    if (slot < 0 || (!event.selfDamage && this.frameSpawns >= this.tuning.frameSpawnBudget)) {
      if (slot >= 0) this.free[this.freeCount++] = slot;
      this.bank(event, nowMs);
      return -1;
    }
    if (!event.selfDamage) this.frameSpawns++;
    this.openSlot(slot, SLOT_ACCUMULATOR, event, nowMs);
    this.displayValue[slot] = 0;
    this.accumulatorByTarget.set(event.targetId, slot);
    if (event.finalBlow) this.flushAccumulator(slot);
    return slot;
  }

  private foldAccumulator(slot: number, event: DamageNumberEvent, nowMs: number): void {
    this.value[slot]! += event.damage;
    this.x[slot] = event.x;
    this.y[slot] = event.y;
    this.lastContributionMs[slot] = nowMs;
    this.pulseMs[slot] = this.tuning.pulseMs;
    if (event.crit) this.critFlashMs[slot] = this.tuning.critFlashMs;
    this.crit[slot] ||= Number(event.crit);
    this.finalBlow[slot] ||= Number(event.finalBlow);
    if (event.attribution === "self") this.attribution[slot] = ATTRIBUTION.self;
    else if (
      this.attribution[slot] !== ATTRIBUTION.self &&
      this.attribution[slot] !== attributionCode(event.attribution)
    )
      this.attribution[slot] = ATTRIBUTION.mixed;
  }

  private openSlot(
    slot: number,
    kind: typeof SLOT_DISCRETE | typeof SLOT_ACCUMULATOR,
    event: DamageNumberEvent,
    nowMs: number,
  ): void {
    this.kind[slot] = kind;
    this.targetIds[slot] = event.targetId;
    this.value[slot] = event.damage;
    this.displayValue[slot] = event.damage;
    this.x[slot] = event.x;
    this.y[slot] = event.y;
    this.ageMs[slot] = 0;
    this.lifeMs[slot] = this.discreteLifetime(event);
    this.lastContributionMs[slot] = nowMs;
    this.pulseMs[slot] = this.tuning.pulseMs;
    this.critFlashMs[slot] = event.crit ? this.tuning.critFlashMs : 0;
    this.crit[slot] = Number(event.crit);
    this.finalBlow[slot] = Number(event.finalBlow);
    this.selfDamage[slot] = Number(event.selfDamage);
    this.attribution[slot] = attributionCode(event.attribution);
    this.activeCountValue++;
  }

  private discreteLifetime(event: DamageNumberEvent): number {
    if (event.crit) return event.finalBlow ? 980 : 820;
    if (event.finalBlow) return 900;
    return event.damage >= 40 ? 760 : 600;
  }

  private releaseLifetime(slot: number): number {
    if (this.finalBlow[slot] !== 0) return this.crit[slot] !== 0 ? 980 : 900;
    return this.value[slot]! >= 40 ? 760 : 620;
  }

  private acquire(prioritySelfDamage: boolean): number {
    if (this.freeCount > 0) return this.free[--this.freeCount] ?? -1;
    if (!prioritySelfDamage) return -1;
    let victim = -1;
    let oldest = -1;
    for (let slot = 0; slot < this.kind.length; slot++) {
      if (this.selfDamage[slot] !== 0 || this.kind[slot] === SLOT_ACCUMULATOR) continue;
      const ambient = this.attribution[slot] !== ATTRIBUTION.self;
      const score = this.ageMs[slot]! + (ambient ? 10000 : 0);
      if (score > oldest) {
        oldest = score;
        victim = slot;
      }
    }
    if (victim >= 0) {
      this.release(victim, false);
      return victim;
    }
    return -1;
  }

  private release(slot: number, returnToFree = true): void {
    const targetId = this.targetIds[slot]!;
    if (this.accumulatorByTarget.get(targetId) === slot) this.accumulatorByTarget.delete(targetId);
    this.kind[slot] = SLOT_FREE;
    this.targetIds[slot] = "";
    this.activeCountValue = Math.max(0, this.activeCountValue - 1);
    if (returnToFree) this.free[this.freeCount++] = slot;
  }

  private bank(event: DamageNumberEvent, nowMs: number): void {
    let pending = this.pendingByTarget.get(event.targetId);
    if (!pending) {
      pending = {
        value: 0,
        x: event.x,
        y: event.y,
        lastAt: nowMs,
        crit: false,
        finalBlow: false,
        selfDamage: event.selfDamage,
        attribution: event.attribution,
        detached: false,
      };
      this.pendingByTarget.set(event.targetId, pending);
    }
    pending.value += event.damage;
    pending.x = event.x;
    pending.y = event.y;
    pending.lastAt = nowMs;
    pending.crit ||= event.crit;
    pending.finalBlow ||= event.finalBlow;
    if (event.attribution === "self") pending.attribution = "self";
    else if (pending.attribution !== event.attribution) pending.attribution = "mixed";
  }

  private materializePending(nowMs: number): void {
    if (this.pendingByTarget.size === 0 || this.frameSpawns >= this.tuning.frameSpawnBudget) return;
    for (const [targetId, pending] of this.pendingByTarget) {
      const event = this.pendingEvent;
      event.targetId = targetId;
      event.damage = pending.value;
      event.x = pending.x;
      event.y = pending.y;
      event.visible = true;
      event.attribution = pending.attribution;
      event.crit = pending.crit;
      event.finalBlow = pending.finalBlow;
      event.selfDamage = pending.selfDamage;
      const slot = this.acquire(pending.selfDamage);
      if (slot < 0) return;
      if (!pending.selfDamage) this.frameSpawns++;
      this.openSlot(slot, SLOT_ACCUMULATOR, event, nowMs);
      this.displayValue[slot] = 0;
      this.accumulatorByTarget.set(targetId, slot);
      if (pending.detached) this.flushAccumulator(slot, 260);
      else if (pending.finalBlow) this.flushAccumulator(slot);
      this.pendingByTarget.delete(targetId);
      if (this.frameSpawns >= this.tuning.frameSpawnBudget) return;
    }
  }

  private flushAccumulator(slot: number, lifetime?: number): void {
    if (this.kind[slot] !== SLOT_ACCUMULATOR) return;
    this.accumulatorByTarget.delete(this.targetIds[slot]!);
    this.kind[slot] = SLOT_RELEASED;
    this.ageMs[slot] = 0;
    this.displayValue[slot] = this.value[slot]!;
    this.lifeMs[slot] = lifetime ?? this.releaseLifetime(slot);
  }
}

export type DamageNumberTargetResolver = (
  targetId: string,
  out: { x: number; y: number },
) => boolean;

interface AtlasStyle {
  fill: string;
  stroke: string;
  innerStroke?: string;
}

const ATLAS_STYLES: readonly AtlasStyle[] = [
  { fill: "#f2ead6", stroke: "#1a140f" },
  { fill: "#ffe9b0", stroke: "#1a140f" },
  { fill: "#ffb35c", stroke: "#1a140f" },
  { fill: "#fff2c0", stroke: "#1a140f", innerStroke: "#ff5a3c" },
  { fill: "#ffe27a", stroke: "#1a140f", innerStroke: "#ff9e2c" },
  { fill: "#ff6a5e", stroke: "#1a140f" },
];

/** Runtime-atlas BitmapText adapter. No Text canvases or Phaser tweens are created after construction. */
export class DamageNumberRenderer {
  readonly engine: DamageNumberEngine;
  private readonly labels: Phaser.GameObjects.BitmapText[] = [];
  private readonly shownInteger: Int32Array;
  private readonly shownStyle: Int8Array;
  private readonly targetPoint = { x: 0, y: 0 };
  private settings: FeedbackSettings;
  private readonly baseScale: number;

  constructor(
    private readonly scene: Phaser.Scene,
    settings: FeedbackSettings,
    private readonly resolveTarget: DamageNumberTargetResolver,
    private readonly dpr = 1,
    tuning: DamageNumberTuning = { ...DEFAULT_DAMAGE_NUMBER_TUNING },
  ) {
    this.settings = settings;
    this.engine = new DamageNumberEngine(tuning);
    this.baseScale = 1 / Math.max(1, dpr);
    this.ensureAtlas();
    this.shownInteger = new Int32Array(this.engine.size);
    this.shownStyle = new Int8Array(this.engine.size);
    this.shownInteger.fill(-1);
    this.shownStyle.fill(-1);
    for (let slot = 0; slot < this.engine.size; slot++) {
      this.labels.push(
        scene.add
          .bitmapText(0, 0, `${FONT_PREFIX}0`, "0", 14 * dpr)
          .setOrigin(0.5)
          .setDepth(DAMAGE_NUMBER_DEPTH)
          .setScale(this.baseScale)
          .setVisible(false),
      );
    }
  }

  beginFrame(): void {
    this.engine.beginFrame();
  }

  add(event: DamageNumberEvent, nowMs: number): void {
    this.engine.ingest(event, nowMs, this.settings);
  }

  update(deltaMs: number, nowMs: number, reducedMotion: boolean): void {
    this.engine.update(nowMs, deltaMs);
    for (let slot = 0; slot < this.engine.size; slot++) {
      const label = this.labels[slot]!;
      const view = this.engine.view(slot);
      if (!view) {
        label.setVisible(false);
        this.shownInteger[slot] = -1;
        this.shownStyle[slot] = -1;
        continue;
      }
      if (view.anchored) {
        if (this.resolveTarget(view.targetId, this.targetPoint))
          this.engine.setAnchor(slot, this.targetPoint.x, this.targetPoint.y);
        else this.engine.detach(slot);
      }
      const refreshed = this.engine.view(slot);
      if (!refreshed) continue;
      this.renderSlot(label, refreshed, reducedMotion);
    }
  }

  applySettings(settings: FeedbackSettings): void {
    this.settings = settings;
    if (settings.damageNumbers === "off") this.clear();
  }

  targetGone(targetId: string): void {
    this.engine.targetGone(targetId);
  }

  clear(): void {
    this.engine.clear();
    for (const label of this.labels) label.setVisible(false);
    this.shownInteger.fill(-1);
    this.shownStyle.fill(-1);
  }

  destroy(): void {
    this.engine.clear();
    for (const label of this.labels) if (label.active) label.destroy();
    this.labels.length = 0;
  }

  private renderSlot(
    label: Phaser.GameObjects.BitmapText,
    view: DamageSlotView,
    reducedMotion: boolean,
  ): void {
    const slot = view.slot;
    const amount = Math.max(1, Math.round(view.displayValue));
    const critVisual = view.crit && (view.kind !== SLOT_ACCUMULATOR || view.critFlashMs > 0);
    const style = view.selfDamage ? 5 : critVisual ? 4 : bandFor(view.value);
    const fontSize =
      (critVisual ? Math.max(30, this.bandSize(view.value)) : this.bandSize(view.value)) *
      this.settings.damageNumberScale;
    if (this.shownStyle[slot] !== style) {
      label.setFont(`${FONT_PREFIX}${style}`, fontSize * this.dpr);
      this.shownStyle[slot] = style;
      this.shownInteger[slot] = -1;
    } else if (Math.abs(label.fontSize - fontSize * this.dpr) > 0.01) {
      label.setFontSize(fontSize * this.dpr);
    }
    if (this.shownInteger[slot] !== amount) {
      label.setText(`${view.selfDamage ? "-" : ""}${amount}${critVisual ? "!" : ""}`);
      this.shownInteger[slot] = amount;
    }

    const age = view.ageMs;
    const life = Math.max(1, view.lifeMs);
    const released = view.kind === SLOT_RELEASED;
    const anchored = view.kind === SLOT_ACCUMULATOR;
    const popBase = critVisual ? 1.9 : view.value >= 40 ? 1.6 : 1.25;
    const pop = reducedMotion ? 1 : 1 + (popBase - 1) * (1 - clamp01(age / 140)) ** 2;
    const pip = reducedMotion ? 1 : 1 + 0.08 * clamp01(view.pulseMs / this.engine.tuning.pulseMs);
    const killScale = view.finalBlow ? 1.2 : 1;
    const teamScale = view.attribution === "teammate" ? 0.8 : 1;
    const scale = this.baseScale * pop * pip * killScale * teamScale;
    const fadeStart = anchored ? 1 : released ? 0.38 : 0.32;
    const fade = anchored ? 1 : 1 - clamp01((age / life - fadeStart) / (1 - fadeStart));
    const alpha = fade * (view.attribution === "teammate" ? 0.75 : 1);
    const rise = anchored ? 0 : (reducedMotion ? 12 : released ? 40 : 30) * clamp01(age / life);
    const drift = anchored || reducedMotion ? 0 : ((slot & 1) * 2 - 1) * 8 * clamp01(age / life);
    label
      .setPosition(view.x + drift, view.y - rise)
      .setScale(scale)
      .setAlpha(alpha)
      .setVisible(true);
  }

  private bandSize(value: number): number {
    if (value >= 40) return 26;
    if (value >= 20) return 21;
    if (value >= 8) return 17;
    return 14;
  }

  private ensureAtlas(): void {
    if (this.scene.textures.exists(ATLAS_KEY) && this.scene.cache.bitmapFont.has(`${FONT_PREFIX}0`))
      return;
    const pixelRatio = Math.max(1, this.dpr);
    const cellW = Math.ceil(42 * pixelRatio);
    const cellH = Math.ceil(48 * pixelRatio);
    const width = cellW * GLYPHS.length;
    const height = cellH * FONT_STYLE_COUNT;
    const texture = this.scene.textures.createCanvas(ATLAS_KEY, width, height);
    if (!texture) throw new Error("Unable to create the runtime damage-number glyph atlas");
    const context = texture.getContext();
    context.clearRect(0, 0, width, height);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.font = `900 ${Math.round(32 * pixelRatio)}px system-ui, sans-serif`;
    for (let row = 0; row < ATLAS_STYLES.length; row++) {
      const style = ATLAS_STYLES[row]!;
      for (let column = 0; column < GLYPHS.length; column++) {
        const glyph = GLYPHS[column]!;
        const x = column * cellW + cellW / 2;
        const y = row * cellH + cellH / 2 + pixelRatio;
        context.strokeStyle = style.stroke;
        context.lineWidth = 5 * pixelRatio;
        context.strokeText(glyph, x, y);
        if (style.innerStroke) {
          context.strokeStyle = style.innerStroke;
          context.lineWidth = 2.5 * pixelRatio;
          context.strokeText(glyph, x, y);
        }
        context.fillStyle = style.fill;
        context.fillText(glyph, x, y);
      }
    }
    texture.refresh();

    for (let row = 0; row < FONT_STYLE_COUNT; row++) {
      const chars: Phaser.Types.GameObjects.BitmapText.BitmapFontData["chars"] = {};
      for (let column = 0; column < GLYPHS.length; column++) {
        const code = GLYPHS.charCodeAt(column);
        const gx = column * cellW;
        const gy = row * cellH;
        chars[code] = {
          x: gx,
          y: gy,
          width: cellW,
          height: cellH,
          centerX: cellW / 2,
          centerY: cellH / 2,
          xOffset: 0,
          yOffset: 0,
          u0: gx / width,
          v0: gy / height,
          u1: (gx + cellW) / width,
          v1: (gy + cellH) / height,
          data: {},
          kerning: {},
        };
      }
      const data: Phaser.Types.GameObjects.BitmapText.BitmapFontData = {
        font: `${FONT_PREFIX}${row}`,
        size: 32 * pixelRatio,
        lineHeight: cellH,
        retroFont: true,
        chars,
      };
      this.scene.cache.bitmapFont.add(`${FONT_PREFIX}${row}`, {
        data,
        texture: ATLAS_KEY,
        frame: null,
      });
    }
  }
}
