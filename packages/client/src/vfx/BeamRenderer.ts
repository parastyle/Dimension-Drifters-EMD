import { BeamPhase, MAX_PLAYERS, shortestAngleDelta } from "@dd/shared";
import Phaser from "phaser";
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

const DEFAULT_PAINT = { id: "arcane", wisp: 0, bolt: 2 } as const;
const PAINT: Record<string, { id: string; wisp: number; bolt: number }> = {
  physical: { id: "steel", wisp: 7, bolt: 0 },
  fire: { id: "fire", wisp: 4, bolt: 0 },
  frost: { id: "frost", wisp: 6, bolt: 5 },
  shock: { id: "shock", wisp: 9, bolt: 0 },
  holy: { id: "holy", wisp: 4, bolt: 6 },
  toxic: { id: "toxic", wisp: 6, bolt: 7 },
  void: { id: "void", wisp: 1, bolt: 6 },
  arcane: DEFAULT_PAINT,
};

function paintFor(element: string): { id: string; wisp: number; bolt: number } {
  if (element === "solar") return PAINT.fire ?? DEFAULT_PAINT;
  if (element === "water") return PAINT.frost ?? DEFAULT_PAINT;
  if (element === "nature") return PAINT.toxic ?? DEFAULT_PAINT;
  if (element === "shadow") return PAINT.void ?? DEFAULT_PAINT;
  return PAINT[element] ?? DEFAULT_PAINT;
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
      this.drawRow(entry, row, ownerId === selfId, nowMs, dt, beltY0, beltYScale);
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
          nowMs,
          entry.seed,
          predicted.opacity,
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
  ): void {
    entry.ignitionT = Math.max(0, entry.ignitionT - dt);
    entry.releaseT = Math.max(0, entry.releaseT - dt);
    entry.overheatT = Math.max(0, entry.overheatT - dt);
    const color = COLOR[row.element] ?? DEFAULT_COLOR;
    const oy = this.projectY(row.originY, beltY0, beltYScale);

    if (row.phase === BeamPhase.Charging) {
      entry.body.setVisible(false);
      entry.lip.setVisible(false);
      this.drawCharge(row.originX, oy, row.angle, row.intensity, color, nowMs, entry.seed);
      return;
    }

    if (row.phase === BeamPhase.Active && row.effectiveLength > 0 && row.width > 0) {
      this.drawSustain(row, color, beltY0, beltYScale);
      this.drawPaint(entry, row, color, local ? 12 : 8, nowMs, beltY0, beltYScale);
      if (entry.ignitionT > 0) {
        const q = entry.ignitionT / 0.07;
        this.groundLight
          .fillStyle(color, q * 0.13)
          .fillEllipse(row.originX, oy + 5, 58 + 34 * q, 22 + 12 * q);
        this.graphics.fillStyle(0xffffff, q * 0.9).fillCircle(row.originX, oy, 8 + 24 * q);
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
      this.graphics
        .lineStyle(4, 0xff5a2e, 0.8 * heatPulse)
        .strokeCircle(row.originX, oy, 16 + 7 * heatPulse);
      this.graphics.fillStyle(0xffd27a, 0.65).fillCircle(row.originX, oy, 7);
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
    nowMs: number,
    seed: number,
    opacity = 1,
  ): void {
    const p = Math.max(0, Math.min(0.95, progress));
    const alpha = Math.max(0, Math.min(1, opacity));
    const radius = 5 + p * 15;
    this.graphics.fillStyle(color, (0.12 + p * 0.42) * alpha).fillCircle(x, y, radius);
    this.graphics.fillStyle(0xffffff, (0.25 + p * 0.6) * alpha).fillCircle(x, y, 2 + p * 5);
    this.graphics.lineStyle(1, color, (0.12 + p * 0.18) * alpha);
    this.graphics.lineBetween(x, y, x + Math.cos(angle) * 92, y + Math.sin(angle) * 92);
    for (let i = 0; i < 3; i++) {
      const a = nowMs * (0.003 + i * 0.0007) + seed * 6.28 + (i * Math.PI * 2) / 3;
      const r = radius + 8 - p * 5;
      this.graphics
        .fillStyle(color, 0.45 * alpha)
        .fillCircle(x + Math.cos(a) * r, y + Math.sin(a) * r, 2);
    }
  }

  private drawSustain(
    row: BeamRenderState,
    color: number,
    beltY0: number,
    beltYScale: number,
  ): void {
    const delta = shortestAngleDelta(row.previousAngle, row.angle);
    const samples = Math.max(
      1,
      Math.min(4, Math.ceil((Math.abs(delta) * row.effectiveLength) / Math.max(8, row.width / 2))),
    );
    for (let layerIndex = 0; layerIndex < 4; layerIndex++) {
      const layerWidth =
        layerIndex === 0
          ? row.width + 16
          : layerIndex === 1
            ? row.width
            : layerIndex === 2
              ? row.width * 0.82
              : row.width * 0.3;
      const layerColor = layerIndex === 1 ? 0x140f20 : layerIndex === 3 ? 0xffffff : color;
      const layerAlpha =
        layerIndex === 0 ? 0.1 : layerIndex === 1 ? 0.92 : layerIndex === 2 ? 0.88 : 0.94;
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
    const endX = row.originX + Math.cos(row.angle) * row.effectiveLength;
    const endY = this.projectY(
      row.originY + Math.sin(row.angle) * row.effectiveLength,
      beltY0,
      beltYScale,
    );
    this.graphics
      .lineStyle(2, 0xffffff, 0.7)
      .strokeCircle(endX, endY, Math.max(4, row.width * 0.16));
    this.graphics.fillStyle(color, 0.45).fillCircle(endX, endY, Math.max(3, row.width * 0.1));
  }

  private drawPaint(
    entry: BeamEntry,
    row: BeamRenderState,
    color: number,
    quality: 8 | 12,
    nowMs: number,
    beltY0: number,
    beltYScale: number,
  ): void {
    const paint = paintFor(row.element);
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
    const projectedWidth = row.width * (beltYScale < 1 ? 0.72 : 1);
    const phase = nowMs * 0.0006 + entry.seed;
    globalThis.VFXRENDER.updateLinearRope(
      entry.body,
      bodyKey,
      paint.wisp,
      quality,
      x0,
      y0,
      x1,
      y1,
      projectedWidth * 0.5,
      0.42,
      color,
      phase,
      projectedWidth * 0.035,
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
      projectedWidth * 0.18,
      0.5,
      0xffffff,
      -phase * 1.4,
      projectedWidth * 0.018,
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
