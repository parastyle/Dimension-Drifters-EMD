import { BeamPhase, MAX_PLAYERS, shortestAngleDelta, WEAPONS } from "@dd/shared";
import Phaser from "phaser";
import type { ColorblindAssistMode } from "../settings.js";
import { drawCasterGlyph } from "./caster-vfx.js";
import { type CasterVfxRecipe, resolveCasterVfxRecipe } from "./caster-vfx-recipes.js";
import {
  colorblindShapesEnabled,
  type ElementAssistPattern,
  elementAssistPattern,
} from "./colorblind-assist.js";
import "./vfx-render.js";

export interface BeamRenderState {
  ownerId: string;
  weaponId: string;
  seq: number;
  phase: number;
  phaseStartTick: number;
  originX: number;
  originY: number;
  previousOriginX: number;
  previousOriginY: number;
  previousAngle: number;
  angle: number;
  previousLength: number;
  effectiveLength: number;
  width: number;
  heat: number;
  intensity: number;
  element: string;
}

export interface BeamRenderRows {
  forEach(callback: (row: BeamRenderState, ownerId: string) => void): void;
}

export interface PredictedBeamCharge {
  ownerId: string;
  weaponId: string;
  startSeq: number;
  originX: number;
  originY: number;
  angle: number;
  progress: number;
  opacity: number;
  element: string;
}

interface BeamEntry {
  key: string;
  ownerId: string;
  seq: number;
  seen: boolean;
  lastPhase: number;
  ignitionT: number;
  releaseT: number;
  overheatT: number;
  seed: number;
  body: Phaser.GameObjects.Rope;
  lip: Phaser.GameObjects.Rope;
}

const COLOR: Record<string, number> = {
  physical: 0xd6dde6,
  fire: 0xff6a2a,
  solar: 0xff8a2b,
  frost: 0x6fd6ff,
  water: 0x55cfff,
  shock: 0xffe24a,
  holy: 0xffe6a0,
  toxic: 0x9cff3b,
  nature: 0x9cff3b,
  void: 0xb14bff,
  shadow: 0xb14bff,
  arcane: 0x8f6aff,
};
const DEFAULT_COLOR = 0x8f6aff;

export interface BeamPaint {
  readonly id: string;
  readonly wisp: number;
  readonly bolt: number;
}

const DEFAULT_PAINT = { id: "arcane", wisp: 0, bolt: 2 } as const;
const PAINT: Record<string, BeamPaint> = {
  physical: { id: "steel", wisp: 7, bolt: 0 },
  fire: { id: "fire", wisp: 4, bolt: 0 },
  frost: { id: "frost", wisp: 6, bolt: 5 },
  water: { id: "water", wisp: 9, bolt: 1 },
  shock: { id: "shock", wisp: 9, bolt: 0 },
  holy: { id: "holy", wisp: 4, bolt: 6 },
  toxic: { id: "toxic", wisp: 6, bolt: 7 },
  nature: { id: "nature", wisp: 7, bolt: 5 },
  void: { id: "void", wisp: 1, bolt: 6 },
  arcane: DEFAULT_PAINT,
};

export function beamPaintFor(element: string): BeamPaint {
  if (element === "solar") return PAINT.fire ?? DEFAULT_PAINT;
  if (element === "shadow") return PAINT.void ?? DEFAULT_PAINT;
  return PAINT[element] ?? DEFAULT_PAINT;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function mixColor(from: number, to: number, amount: number): number {
  const t = clamp01(amount);
  const r = ((from >>> 16) & 0xff) + (((to >>> 16) & 0xff) - ((from >>> 16) & 0xff)) * t;
  const g = ((from >>> 8) & 0xff) + (((to >>> 8) & 0xff) - ((from >>> 8) & 0xff)) * t;
  const b = (from & 0xff) + ((to & 0xff) - (from & 0xff)) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

function redlineFor(heat: number): number {
  return clamp01((heat - 0.68) / 0.32);
}

/** Breathing is strictly inset: no pulse or heat escalation can overstate the authoritative diameter. */
export function beamVisualWidth(
  authoritativeWidth: number,
  nowMs: number,
  seed: number,
  heat: number,
): number {
  const width = Math.max(0, authoritativeWidth);
  const phase = seed * Math.PI * 2;
  const slowPulse = 0.5 + 0.5 * Math.sin(nowMs * 0.012 + phase);
  const dangerPulse = 0.5 + 0.5 * Math.sin(nowMs * 0.032 + phase * 1.7);
  const fraction = 0.94 + slowPulse * 0.045 + dangerPulse * redlineFor(heat) * 0.015;
  return Math.min(width, width * fraction);
}

function hashKey(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return hash >>> 0;
}

/** Room-ceiling retained beam pool plus one prediction slot. Exact damaging capsules are never culled. */
export class BeamRenderer {
  private readonly groundLight: Phaser.GameObjects.Graphics;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly entries: BeamEntry[] = [];
  private readonly capsulePoints: Phaser.Math.Vector2[] = [];
  private colorblindShapes = false;

  constructor(private readonly scene: Phaser.Scene) {
    globalThis.VFXRENDER.ensureTextures(scene);
    this.groundLight = scene.add.graphics().setDepth(2);
    this.graphics = scene.add.graphics().setDepth(9990);
    for (let i = 0; i < 18; i++) this.capsulePoints.push(new Phaser.Math.Vector2());
    for (let i = 0; i < MAX_PLAYERS + 1; i++) {
      const body = globalThis.VFXRENDER.makePerRope(scene) as Phaser.GameObjects.Rope;
      const lip = globalThis.VFXRENDER.makePerRope(scene) as Phaser.GameObjects.Rope;
      body.setDepth(9991);
      lip.setDepth(9992);
      this.entries.push({
        key: "",
        ownerId: "",
        seq: 0,
        seen: false,
        lastPhase: BeamPhase.Idle,
        ignitionT: 0,
        releaseT: 0,
        overheatT: 0,
        seed: 0,
        body,
        lip,
      });
    }
  }

  setColorblindAssist(mode: ColorblindAssistMode | undefined): void {
    this.colorblindShapes = colorblindShapesEnabled(mode);
  }

  destroy(): void {
    this.groundLight.destroy();
    this.graphics.destroy();
    for (const entry of this.entries) {
      entry.body.destroy();
      entry.lip.destroy();
    }
    this.entries.length = 0;
  }

  update(
    rows: BeamRenderRows,
    selfId: string,
    nowMs: number,
    dt: number,
    beltY0: number,
    beltYScale: number,
    predicted?: PredictedBeamCharge,
    reducedMotion = false,
  ): void {
    this.groundLight.clear();
    this.graphics.clear();
    for (const entry of this.entries) entry.seen = false;
    let hasAuthoritativeSelf = false;
    rows.forEach((row, ownerId) => {
      const predictedOwnerCharge =
        ownerId === selfId && row.phase === BeamPhase.Charging && predicted?.startSeq === row.seq;
      if (ownerId === selfId && !predictedOwnerCharge) hasAuthoritativeSelf = true;
      if (predictedOwnerCharge) return;
      const entry = this.acquire(`${ownerId}:${row.seq}`, ownerId, row.seq);
      if (!entry) return;
      entry.seen = true;
      this.observePhase(entry, row.phase);
      this.drawRow(entry, row, ownerId === selfId, nowMs, dt, beltY0, beltYScale, reducedMotion);
    });
    if (predicted && !hasAuthoritativeSelf) {
      const entry = this.acquire(`${predicted.ownerId}:predicted`, predicted.ownerId, 0);
      if (entry) {
        entry.seen = true;
        entry.body.setVisible(false);
        entry.lip.setVisible(false);
        this.drawCharge(
          predicted.originX,
          this.projectY(predicted.originY, beltY0, beltYScale),
          predicted.angle,
          Math.min(0.95, predicted.progress),
          COLOR[predicted.element] ?? DEFAULT_COLOR,
          predicted.element,
          nowMs,
          entry.seed,
          predicted.opacity,
          resolveCasterVfxRecipe(WEAPONS[predicted.weaponId]),
          reducedMotion,
        );
      }
    }
    for (const entry of this.entries) {
      if (entry.seen) continue;
      entry.key = "";
      entry.body.setVisible(false);
      entry.lip.setVisible(false);
      entry.lastPhase = BeamPhase.Idle;
    }
  }

  private acquire(key: string, ownerId: string, seq: number): BeamEntry | undefined {
    for (const entry of this.entries) if (entry.key === key) return entry;
    for (const entry of this.entries) {
      if (entry.key) continue;
      entry.key = key;
      entry.ownerId = ownerId;
      entry.seq = seq;
      entry.seed = hashKey(key) / 0xffffffff;
      entry.lastPhase = BeamPhase.Idle;
      return entry;
    }
    return undefined;
  }

  private observePhase(entry: BeamEntry, phase: number): void {
    if (phase === entry.lastPhase) return;
    if (phase === BeamPhase.Active) entry.ignitionT = 0.07;
    if (entry.lastPhase === BeamPhase.Active && phase !== BeamPhase.Active) entry.releaseT = 0.08;
    if (phase === BeamPhase.Overheated) entry.overheatT = 0.18;
    entry.lastPhase = phase;
  }

  private drawRow(
    entry: BeamEntry,
    row: BeamRenderState,
    local: boolean,
    nowMs: number,
    dt: number,
    beltY0: number,
    beltYScale: number,
    reducedMotion: boolean,
  ): void {
    entry.ignitionT = Math.max(0, entry.ignitionT - dt);
    entry.releaseT = Math.max(0, entry.releaseT - dt);
    entry.overheatT = Math.max(0, entry.overheatT - dt);
    const color = COLOR[row.element] ?? DEFAULT_COLOR;
    const oy = this.projectY(row.originY, beltY0, beltYScale);

    if (row.phase === BeamPhase.Charging) {
      entry.body.setVisible(false);
      entry.lip.setVisible(false);
      this.drawCharge(
        row.originX,
        oy,
        row.angle,
        row.intensity,
        color,
        row.element,
        nowMs,
        entry.seed,
        1,
        resolveCasterVfxRecipe(WEAPONS[row.weaponId]),
        reducedMotion,
      );
      return;
    }

    if (row.phase === BeamPhase.Active && row.effectiveLength > 0 && row.width > 0) {
      const visualWidth = beamVisualWidth(row.width, nowMs, entry.seed, row.heat);
      this.drawSustain(entry, row, color, visualWidth, nowMs, beltY0, beltYScale);
      this.drawPaint(entry, row, color, visualWidth, local ? 12 : 8, nowMs, beltY0, beltYScale);
      if (entry.ignitionT > 0) {
        const q = entry.ignitionT / 0.07;
        this.groundLight
          .fillStyle(color, q * 0.13)
          .fillEllipse(row.originX, oy + 5, 58 + 34 * q, 22 + 12 * q);
        this.graphics
          .fillStyle(0xffffff, q * 0.9)
          .fillCircle(row.originX, oy, Math.min(row.width * 0.5, 8 + 24 * q));
        const recipe = resolveCasterVfxRecipe(WEAPONS[row.weaponId]);
        if (recipe)
          drawCasterGlyph(
            this.graphics,
            row.originX,
            oy,
            row.angle,
            recipe,
            q,
            1,
            nowMs,
            reducedMotion,
          );
      }
      return;
    }

    entry.body.setVisible(false);
    entry.lip.setVisible(false);
    if (entry.releaseT > 0 && row.effectiveLength > 0 && row.width > 0) {
      const q = entry.releaseT / 0.08;
      this.drawCapsule(
        row.originX,
        row.originY,
        row.angle,
        row.effectiveLength * q,
        row.width * 0.42,
        color,
        0.14 * q,
        beltY0,
        beltYScale,
      );
    }
    const heatPulse = 0.65 + 0.35 * Math.sin(nowMs * 0.028 + entry.seed * Math.PI * 2);
    if (row.phase === BeamPhase.Overheated) {
      const burst = clamp01(entry.overheatT / 0.18);
      this.graphics
        .lineStyle(5, 0xff3b24, 0.82 * heatPulse)
        .strokeCircle(row.originX, oy, 16 + 9 * heatPulse + burst * 8)
        .lineStyle(2, 0xffefad, 0.72 + burst * 0.25)
        .strokeCircle(row.originX, oy, 9 + 5 * (1 - heatPulse));
      this.graphics
        .fillStyle(0xffd27a, 0.72 + burst * 0.2)
        .fillCircle(row.originX, oy, 7 + burst * 4);
      for (let i = 0; i < 6; i++) {
        const angle = entry.seed * Math.PI * 2 + (i * Math.PI) / 3 + nowMs * 0.0018;
        const inner = 9 + heatPulse * 3;
        const outer = inner + 7 + burst * 12 * (0.5 + 0.5 * Math.sin(nowMs * 0.02 + i));
        this.graphics
          .lineStyle(2, i % 2 === 0 ? 0xffffff : 0xff5a2e, 0.55 + burst * 0.35)
          .lineBetween(
            row.originX + Math.cos(angle) * inner,
            oy + Math.sin(angle) * inner,
            row.originX + Math.cos(angle) * outer,
            oy + Math.sin(angle) * outer,
          );
      }
    } else if (row.heat > 0.02) {
      this.graphics
        .lineStyle(2, color, 0.25 + row.heat * 0.35)
        .strokeCircle(row.originX, oy, 8 + row.heat * 8);
    }
  }

  private drawCharge(
    x: number,
    y: number,
    angle: number,
    progress: number,
    color: number,
    element: string,
    nowMs: number,
    seed: number,
    opacity = 1,
    recipe?: CasterVfxRecipe,
    reducedMotion = false,
  ): void {
    const p = Math.max(0, Math.min(0.95, progress));
    const alpha = Math.max(0, Math.min(1, opacity));
    const radius = 5 + p * 15;
    this.graphics.fillStyle(color, (0.12 + p * 0.42) * alpha).fillCircle(x, y, radius);
    this.graphics.fillStyle(0xffffff, (0.25 + p * 0.6) * alpha).fillCircle(x, y, 2 + p * 5);
    this.graphics.lineStyle(1, color, (0.12 + p * 0.18) * alpha);
    this.graphics.lineBetween(x, y, x + Math.cos(angle) * 92, y + Math.sin(angle) * 92);
    for (let i = 0; i < 3; i++) {
      const a =
        (reducedMotion ? seed * 6.28 : nowMs * (0.003 + i * 0.0007) + seed * 6.28) +
        (i * Math.PI * 2) / 3;
      const r = radius + 8 - p * 5;
      this.graphics
        .fillStyle(color, 0.45 * alpha)
        .fillCircle(x + Math.cos(a) * r, y + Math.sin(a) * r, 2);
    }
    if (recipe) drawCasterGlyph(this.graphics, x, y, angle, recipe, alpha, p, nowMs, reducedMotion);
    if (this.colorblindShapes) {
      const markerX = x + Math.cos(angle) * (radius + 7);
      const markerY = y + Math.sin(angle) * (radius + 7);
      this.drawElementMark(
        markerX,
        markerY,
        angle,
        4 + p * 2,
        elementAssistPattern(element),
        alpha,
      );
    }
  }

  private drawSustain(
    entry: BeamEntry,
    row: BeamRenderState,
    color: number,
    visualWidth: number,
    nowMs: number,
    beltY0: number,
    beltYScale: number,
  ): void {
    const delta = shortestAngleDelta(row.previousAngle, row.angle);
    const redline = redlineFor(row.heat);
    const edgeColor = mixColor(color, 0xff3824, redline * 0.9);
    const chromaColor = mixColor(color, 0xffd06a, redline * 0.48);
    const coreColor = mixColor(0xffffff, 0xfff0a8, redline * 0.8);
    const samples = Math.max(
      1,
      Math.min(4, Math.ceil((Math.abs(delta) * row.effectiveLength) / Math.max(8, row.width / 2))),
    );
    for (let layerIndex = 0; layerIndex < 4; layerIndex++) {
      const layerWidth =
        layerIndex === 0
          ? visualWidth
          : layerIndex === 1
            ? visualWidth * 0.87
            : layerIndex === 2
              ? visualWidth * 0.68
              : visualWidth * (0.22 + redline * 0.07);
      const layerColor =
        layerIndex === 0
          ? edgeColor
          : layerIndex === 1
            ? 0x140912
            : layerIndex === 2
              ? chromaColor
              : coreColor;
      const layerAlpha =
        layerIndex === 0
          ? 0.14 + redline * 0.16
          : layerIndex === 1
            ? 0.9
            : layerIndex === 2
              ? 0.9 + redline * 0.08
              : 0.96;
      for (let sample = 0; sample <= samples; sample++) {
        const f = sample / samples;
        const ox = row.previousOriginX + (row.originX - row.previousOriginX) * f;
        const oy = row.previousOriginY + (row.originY - row.previousOriginY) * f;
        const angle = row.previousAngle + delta * f;
        const length = row.previousLength + (row.effectiveLength - row.previousLength) * f;
        this.drawCapsule(
          ox,
          oy,
          angle,
          length,
          layerWidth,
          layerColor,
          layerAlpha,
          beltY0,
          beltYScale,
        );
      }
    }
    if (redline > 0) {
      const sourceY = this.projectY(row.originY, beltY0, beltYScale);
      const dangerPulse = 0.5 + 0.5 * Math.sin(nowMs * 0.034 + entry.seed * Math.PI * 2);
      const radius = visualWidth * (0.22 + dangerPulse * 0.1);
      this.graphics
        .lineStyle(2 + redline * 1.5, 0xff3b24, redline * (0.52 + dangerPulse * 0.38))
        .strokeEllipse(row.originX, sourceY, radius * 2, radius * 2 * beltYScale);
    }
    this.drawTerminus(entry, row, edgeColor, visualWidth, nowMs, beltY0, beltYScale);
    if (this.colorblindShapes) this.drawElementPattern(row, beltY0, beltYScale);
  }

  private drawTerminus(
    entry: BeamEntry,
    row: BeamRenderState,
    color: number,
    visualWidth: number,
    nowMs: number,
    beltY0: number,
    beltYScale: number,
  ): void {
    const endX = row.originX + Math.cos(row.angle) * row.effectiveLength;
    const endY = this.projectY(
      row.originY + Math.sin(row.angle) * row.effectiveLength,
      beltY0,
      beltYScale,
    );
    const capRadius = visualWidth * 0.5;
    const redline = redlineFor(row.heat);
    const phase = entry.seed * Math.PI * 2;
    const pulse = 0.5 + 0.5 * Math.sin(nowMs * (0.018 + redline * 0.014) + phase);
    const ringRadius = capRadius * (0.48 + pulse * 0.27);
    const lineWidth = Math.min(3, Math.max(1.4, visualWidth * 0.045));
    this.graphics
      .lineStyle(lineWidth, mixColor(0xffffff, 0xffb36a, redline), 0.55 + pulse * 0.4)
      .strokeEllipse(endX, endY, ringRadius * 2, ringRadius * 2 * beltYScale);
    this.graphics
      .fillStyle(color, 0.42 + redline * 0.28)
      .fillEllipse(
        endX,
        endY,
        capRadius * (0.2 + pulse * 0.08),
        capRadius * (0.2 + pulse * 0.08) * beltYScale,
      );
    for (let i = 0; i < 5; i++) {
      const sparkPulse = 0.5 + 0.5 * Math.sin(nowMs * 0.026 + phase + i * 1.73);
      const angle = phase + (i * Math.PI * 2) / 5 + Math.sin(nowMs * 0.004 + i) * 0.16;
      const inner = capRadius * 0.18;
      const outer = capRadius * (0.48 + sparkPulse * (0.22 + redline * 0.1));
      const c = Math.cos(angle);
      const s = Math.sin(angle) * beltYScale;
      this.graphics
        .lineStyle(
          Math.max(1, lineWidth * 0.58),
          i % 2 === 0 ? 0xffffff : color,
          0.55 + sparkPulse * 0.4,
        )
        .lineBetween(endX + c * inner, endY + s * inner, endX + c * outer, endY + s * outer);
    }
  }

  private drawElementPattern(row: BeamRenderState, beltY0: number, beltYScale: number): void {
    const length = Math.max(0, row.effectiveLength);
    const count = Math.max(1, Math.min(10, Math.floor(length / 54)));
    const c = Math.cos(row.angle);
    const s = Math.sin(row.angle);
    const pattern = elementAssistPattern(row.element);
    const size = Math.max(3.5, Math.min(7, row.width * 0.13));
    for (let i = 1; i <= count; i++) {
      const distance = (length * i) / (count + 1);
      this.drawElementMark(
        row.originX + c * distance,
        this.projectY(row.originY + s * distance, beltY0, beltYScale),
        Math.atan2(s * beltYScale, c),
        size,
        pattern,
        0.76,
      );
    }
  }

  private drawElementMark(
    x: number,
    y: number,
    angle: number,
    size: number,
    pattern: ElementAssistPattern,
    alpha: number,
  ): void {
    const ux = Math.cos(angle) * size;
    const uy = Math.sin(angle) * size;
    const vx = -Math.sin(angle) * size;
    const vy = Math.cos(angle) * size;
    const trace = (): void => {
      if (pattern === "dots") {
        this.graphics.strokeCircle(x, y, size * 0.62);
        return;
      }
      this.graphics.beginPath();
      if (pattern === "bars") {
        this.graphics.moveTo(x - vx, y - vy);
        this.graphics.lineTo(x + vx, y + vy);
      } else if (pattern === "triangles") {
        this.graphics.moveTo(x + ux, y + uy);
        this.graphics.lineTo(x - ux * 0.72 + vx, y - uy * 0.72 + vy);
        this.graphics.lineTo(x - ux * 0.72 - vx, y - uy * 0.72 - vy);
        this.graphics.closePath();
      } else if (pattern === "diamonds") {
        this.graphics.moveTo(x + ux, y + uy);
        this.graphics.lineTo(x + vx, y + vy);
        this.graphics.lineTo(x - ux, y - uy);
        this.graphics.lineTo(x - vx, y - vy);
        this.graphics.closePath();
      } else if (pattern === "zigzag") {
        this.graphics.moveTo(x - ux - vx * 0.45, y - uy - vy * 0.45);
        this.graphics.lineTo(x - vx * 0.5, y - vy * 0.5);
        this.graphics.lineTo(x + vx * 0.5, y + vy * 0.5);
        this.graphics.lineTo(x + ux + vx * 0.45, y + uy + vy * 0.45);
      } else if (pattern === "crosses") {
        this.graphics.moveTo(x - ux, y - uy);
        this.graphics.lineTo(x + ux, y + uy);
        this.graphics.moveTo(x - vx, y - vy);
        this.graphics.lineTo(x + vx, y + vy);
      } else if (pattern === "squares") {
        this.graphics.moveTo(x + ux + vx, y + uy + vy);
        this.graphics.lineTo(x - ux + vx, y - uy + vy);
        this.graphics.lineTo(x - ux - vx, y - uy - vy);
        this.graphics.lineTo(x + ux - vx, y + uy - vy);
        this.graphics.closePath();
      } else {
        this.graphics.moveTo(x - ux, y - uy);
        this.graphics.lineTo(x + ux, y + uy);
        this.graphics.moveTo(x - vx, y - vy);
        this.graphics.lineTo(x + vx, y + vy);
        this.graphics.moveTo(x - ux * 0.7 - vx * 0.7, y - uy * 0.7 - vy * 0.7);
        this.graphics.lineTo(x + ux * 0.7 + vx * 0.7, y + uy * 0.7 + vy * 0.7);
        this.graphics.moveTo(x - ux * 0.7 + vx * 0.7, y - uy * 0.7 + vy * 0.7);
        this.graphics.lineTo(x + ux * 0.7 - vx * 0.7, y + uy * 0.7 - vy * 0.7);
      }
      this.graphics.strokePath();
    };
    this.graphics.lineStyle(4, 0x140f20, alpha * 0.72);
    trace();
    this.graphics.lineStyle(1.6, 0xffffff, alpha);
    trace();
  }

  private drawPaint(
    entry: BeamEntry,
    row: BeamRenderState,
    color: number,
    visualWidth: number,
    quality: 8 | 12,
    nowMs: number,
    beltY0: number,
    beltYScale: number,
  ): void {
    // These are the shipped element wisp/bolt sheets, including dedicated water and nature families. The
    // procedural capsules remain a truth/readability backing, never the beam's sole presentation.
    const paint = beamPaintFor(row.element);
    const bodyKey = `ptcl:${paint.id}-wisp`;
    const lipKey = `ptcl:${paint.id}-bolt`;
    if (!this.scene.textures.exists(bodyKey) || !this.scene.textures.exists(lipKey)) {
      entry.body.setVisible(false);
      entry.lip.setVisible(false);
      return;
    }
    const x0 = row.originX;
    const y0 = this.projectY(row.originY, beltY0, beltYScale);
    const x1 = row.originX + Math.cos(row.angle) * row.effectiveLength;
    const y1 = this.projectY(
      row.originY + Math.sin(row.angle) * row.effectiveLength,
      beltY0,
      beltYScale,
    );
    const projectedWidth = visualWidth * (beltYScale < 1 ? 0.72 : 1);
    const phase = nowMs * 0.0006 + entry.seed;
    const redline = redlineFor(row.heat);
    const paintColor = mixColor(color, 0xff3b24, redline * 0.86);
    const coreColor = mixColor(0xffffff, 0xffdf80, redline * 0.72);
    globalThis.VFXRENDER.updateLinearRope(
      entry.body,
      bodyKey,
      paint.wisp,
      quality,
      x0,
      y0,
      x1,
      y1,
      projectedWidth * (0.48 + redline * 0.06),
      0.42 + redline * 0.16,
      paintColor,
      phase,
      projectedWidth * (0.035 + redline * 0.018),
    );
    globalThis.VFXRENDER.updateLinearRope(
      entry.lip,
      lipKey,
      paint.bolt,
      quality,
      x0,
      y0,
      x1,
      y1,
      projectedWidth * (0.17 + redline * 0.04),
      0.52 + redline * 0.2,
      coreColor,
      -phase * 1.4,
      projectedWidth * (0.018 + redline * 0.008),
    );
  }

  private drawCapsule(
    ox: number,
    oy: number,
    angle: number,
    length: number,
    width: number,
    color: number,
    alpha: number,
    beltY0: number,
    beltYScale: number,
  ): void {
    if (length <= 0 || width <= 0 || alpha <= 0) return;
    const radius = width / 2;
    const ex = ox + Math.cos(angle) * length;
    const ey = oy + Math.sin(angle) * length;
    for (let i = 0; i < 9; i++) {
      const a = angle - Math.PI / 2 + (Math.PI * i) / 8;
      const p = this.capsulePoints[i];
      if (!p) continue;
      p.x = ex + Math.cos(a) * radius;
      p.y = this.projectY(ey + Math.sin(a) * radius, beltY0, beltYScale);
    }
    for (let i = 0; i < 9; i++) {
      const a = angle + Math.PI / 2 + (Math.PI * i) / 8;
      const p = this.capsulePoints[9 + i];
      if (!p) continue;
      p.x = ox + Math.cos(a) * radius;
      p.y = this.projectY(oy + Math.sin(a) * radius, beltY0, beltYScale);
    }
    this.graphics.fillStyle(color, alpha).fillPoints(this.capsulePoints, true);
  }

  private projectY(y: number, beltY0: number, beltYScale: number): number {
    return beltYScale === 1 ? y : beltY0 + (y - beltY0) * beltYScale;
  }
}
