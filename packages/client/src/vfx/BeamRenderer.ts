import {
  BeamPhase,
  FRIENDLY_BEAM_ENTITY_CAP,
  shortestAngleDelta,
  TICK_MS,
  WEAPONS,
} from "@dd/shared";
import Phaser from "phaser";
import type { ColorblindAssistMode } from "../settings.js";
import { drawCasterGlyph } from "./caster-vfx.js";
import {
  type BeamVfxRecipe,
  type CasterVfxRecipe,
  resolveCasterVfxRecipe,
} from "./caster-vfx-recipes.js";
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

export interface BeamMuzzlePose {
  x: number;
  y: number;
}

export interface BeamCursorTarget {
  x: number;
  y: number;
}

export interface BeamCursorPose {
  originX: number;
  originY: number;
  angle: number;
  length: number;
}

export function seraphBeamCursorPose(
  origin: Readonly<BeamMuzzlePose>,
  cursor: Readonly<BeamCursorTarget>,
  authoritativeLength: number,
): BeamCursorPose {
  const dx = cursor.x - origin.x;
  const dy = cursor.y - origin.y;
  const distance = Math.hypot(dx, dy);
  return {
    originX: origin.x,
    originY: origin.y,
    angle: distance > 0.001 ? Math.atan2(dy, dx) : 0,
    length: Math.min(Math.max(0, authoritativeLength), distance),
  };
}

export type BeamMuzzlePoseWriter = (
  ownerId: string,
  weaponId: string,
  rowKey: string,
  angle: number,
  out: BeamMuzzlePose,
) => boolean;

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
  poseReady: boolean;
  poseT: number;
  fromAngle: number;
  targetAngle: number;
  renderAngle: number;
  fromLength: number;
  targetLength: number;
  renderLength: number;
  fromOriginX: number;
  fromOriginY: number;
  targetOriginX: number;
  targetOriginY: number;
  renderOriginX: number;
  renderOriginY: number;
  body: Phaser.GameObjects.Rope;
  lip: Phaser.GameObjects.Rope;
}

interface BeamDrawPose {
  originX: number;
  originY: number;
  angle: number;
  length: number;
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

function beamPaletteColor(beam: BeamVfxRecipe | undefined, seed: number): number | undefined {
  const palette = beam?.rainbowPalette;
  if (!palette?.length) return undefined;
  return palette[Math.min(palette.length - 1, Math.floor(seed * palette.length))];
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
  private readonly muzzlePose: BeamMuzzlePose = { x: 0, y: 0 };
  private readonly drawPose: BeamDrawPose = { originX: 0, originY: 0, angle: 0, length: 0 };
  private colorblindShapes = false;

  constructor(private readonly scene: Phaser.Scene) {
    globalThis.VFXRENDER.ensureTextures(scene);
    this.groundLight = scene.add.graphics().setDepth(2);
    this.graphics = scene.add.graphics().setDepth(9990);
    for (let i = 0; i < 18; i++) this.capsulePoints.push(new Phaser.Math.Vector2());
    for (let i = 0; i < FRIENDLY_BEAM_ENTITY_CAP + 1; i++) {
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
        poseReady: false,
        poseT: 1,
        fromAngle: 0,
        targetAngle: 0,
        renderAngle: 0,
        fromLength: 0,
        targetLength: 0,
        renderLength: 0,
        fromOriginX: 0,
        fromOriginY: 0,
        targetOriginX: 0,
        targetOriginY: 0,
        renderOriginX: 0,
        renderOriginY: 0,
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
    writeMuzzlePose?: BeamMuzzlePoseWriter,
    localCursorTarget?: BeamCursorTarget,
  ): void {
    this.groundLight.clear();
    this.graphics.clear();
    for (const entry of this.entries) entry.seen = false;
    let hasAuthoritativeSelf = false;
    rows.forEach((row, rowKey) => {
      const ownerId = row.ownerId || rowKey;
      const primary = rowKey === ownerId;
      const predictedOwnerCharge =
        primary &&
        ownerId === selfId &&
        row.phase === BeamPhase.Charging &&
        predicted?.startSeq === row.seq;
      if (ownerId === selfId && !predictedOwnerCharge) hasAuthoritativeSelf = true;
      if (predictedOwnerCharge) return;
      const entry = this.acquire(`${rowKey}:${row.seq}`, ownerId, row.seq);
      if (!entry) return;
      entry.seen = true;
      this.observePhase(entry, row.phase);
      this.drawRow(
        entry,
        row,
        rowKey,
        ownerId === selfId,
        nowMs,
        dt,
        beltY0,
        beltYScale,
        reducedMotion,
        writeMuzzlePose,
        localCursorTarget,
      );
    });
    if (predicted && !hasAuthoritativeSelf) {
      const entry = this.acquire(`${predicted.ownerId}:predicted`, predicted.ownerId, 0);
      if (entry) {
        entry.seen = true;
        entry.body.setVisible(false);
        entry.lip.setVisible(false);
        let originX = predicted.originX;
        let originY = predicted.originY;
        if (
          writeMuzzlePose?.(
            predicted.ownerId,
            predicted.weaponId,
            predicted.ownerId,
            predicted.angle,
            this.muzzlePose,
          )
        ) {
          originX = this.muzzlePose.x;
          originY = this.muzzlePose.y;
        }
        this.drawCharge(
          originX,
          this.projectY(originY, beltY0, beltYScale),
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
      entry.poseReady = false;
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
      entry.poseReady = false;
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
    rowKey: string,
    local: boolean,
    nowMs: number,
    dt: number,
    beltY0: number,
    beltYScale: number,
    reducedMotion: boolean,
    writeMuzzlePose: BeamMuzzlePoseWriter | undefined,
    localCursorTarget: BeamCursorTarget | undefined,
  ): void {
    entry.ignitionT = Math.max(0, entry.ignitionT - dt);
    entry.releaseT = Math.max(0, entry.releaseT - dt);
    entry.overheatT = Math.max(0, entry.overheatT - dt);
    const recipe = resolveCasterVfxRecipe(WEAPONS[row.weaponId]);
    const color =
      beamPaletteColor(recipe?.beam, entry.seed) ??
      recipe?.beam?.accentColor ??
      COLOR[row.element] ??
      DEFAULT_COLOR;
    const pose = this.resolveDrawPose(
      entry,
      row,
      rowKey,
      local,
      dt,
      writeMuzzlePose,
      localCursorTarget,
    );
    const oy = this.projectY(pose.originY, beltY0, beltYScale);

    if (row.phase === BeamPhase.Charging) {
      entry.body.setVisible(false);
      entry.lip.setVisible(false);
      this.drawCharge(
        pose.originX,
        oy,
        pose.angle,
        row.intensity,
        color,
        row.element,
        nowMs,
        entry.seed,
        1,
        recipe,
        reducedMotion,
      );
      return;
    }

    if (row.phase === BeamPhase.Active && row.effectiveLength > 0 && row.width > 0) {
      const visualWidth = beamVisualWidth(row.width, nowMs, entry.seed, row.heat);
      this.drawSustain(entry, row, pose, color, visualWidth, nowMs, beltY0, beltYScale, recipe);
      this.drawPaint(
        entry,
        row,
        pose,
        color,
        visualWidth,
        local ? 12 : 8,
        nowMs,
        beltY0,
        beltYScale,
        recipe,
      );
      if (entry.ignitionT > 0) {
        const q = entry.ignitionT / 0.07;
        this.groundLight
          .fillStyle(color, q * 0.13)
          .fillEllipse(pose.originX, oy + 5, 58 + 34 * q, 22 + 12 * q);
        this.graphics
          .fillStyle(0xffffff, q * 0.9)
          .fillCircle(pose.originX, oy, Math.min(row.width * 0.5, 8 + 24 * q));
        if (recipe)
          drawCasterGlyph(
            this.graphics,
            pose.originX,
            oy,
            pose.angle,
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
        pose.originX,
        pose.originY,
        pose.angle,
        pose.length * q,
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
        .strokeCircle(pose.originX, oy, 16 + 9 * heatPulse + burst * 8)
        .lineStyle(2, 0xffefad, 0.72 + burst * 0.25)
        .strokeCircle(pose.originX, oy, 9 + 5 * (1 - heatPulse));
      this.graphics
        .fillStyle(0xffd27a, 0.72 + burst * 0.2)
        .fillCircle(pose.originX, oy, 7 + burst * 4);
      for (let i = 0; i < 6; i++) {
        const angle = entry.seed * Math.PI * 2 + (i * Math.PI) / 3 + nowMs * 0.0018;
        const inner = 9 + heatPulse * 3;
        const outer = inner + 7 + burst * 12 * (0.5 + 0.5 * Math.sin(nowMs * 0.02 + i));
        this.graphics
          .lineStyle(2, i % 2 === 0 ? 0xffffff : 0xff5a2e, 0.55 + burst * 0.35)
          .lineBetween(
            pose.originX + Math.cos(angle) * inner,
            oy + Math.sin(angle) * inner,
            pose.originX + Math.cos(angle) * outer,
            oy + Math.sin(angle) * outer,
          );
      }
    } else if (row.heat > 0.02) {
      this.graphics
        .lineStyle(2, color, 0.25 + row.heat * 0.35)
        .strokeCircle(pose.originX, oy, 8 + row.heat * 8);
    }
  }

  /**
   * Patches describe the authoritative previous→current collision sweep. Presentation plays that segment as
   * one moving ray instead of painting its whole union. The ray origin is then rebased to the already-rendered
   * owner root, so local prediction and the delayed remote snapshot timeline keep the emitter welded to the
   * weapon. Remote angle/length advance over one 20 Hz patch; owner rows take the latest authority directly.
   */
  private resolveDrawPose(
    entry: BeamEntry,
    row: BeamRenderState,
    rowKey: string,
    local: boolean,
    dt: number,
    writeMuzzlePose: BeamMuzzlePoseWriter | undefined,
    localCursorTarget: BeamCursorTarget | undefined,
  ): BeamDrawPose {
    if (!entry.poseReady) {
      entry.poseReady = true;
      entry.poseT = local ? 1 : 0;
      entry.fromAngle = row.previousAngle;
      entry.targetAngle = row.angle;
      entry.renderAngle = local ? row.angle : row.previousAngle;
      entry.fromLength = row.previousLength;
      entry.targetLength = row.effectiveLength;
      entry.renderLength = local ? row.effectiveLength : row.previousLength;
      entry.fromOriginX = row.previousOriginX;
      entry.fromOriginY = row.previousOriginY;
      entry.targetOriginX = row.originX;
      entry.targetOriginY = row.originY;
      entry.renderOriginX = local ? row.originX : row.previousOriginX;
      entry.renderOriginY = local ? row.originY : row.previousOriginY;
    } else if (
      row.angle !== entry.targetAngle ||
      row.effectiveLength !== entry.targetLength ||
      row.originX !== entry.targetOriginX ||
      row.originY !== entry.targetOriginY
    ) {
      entry.fromAngle = entry.renderAngle;
      entry.fromLength = entry.renderLength;
      entry.fromOriginX = entry.renderOriginX;
      entry.fromOriginY = entry.renderOriginY;
      entry.targetAngle = row.angle;
      entry.targetLength = row.effectiveLength;
      entry.targetOriginX = row.originX;
      entry.targetOriginY = row.originY;
      entry.poseT = local ? 1 : 0;
    }
    entry.poseT = local ? 1 : Math.min(1, entry.poseT + (dt * 1000) / TICK_MS);
    const t = entry.poseT;
    entry.renderAngle =
      entry.fromAngle + shortestAngleDelta(entry.fromAngle, entry.targetAngle) * t;
    entry.renderLength = entry.fromLength + (entry.targetLength - entry.fromLength) * t;
    entry.renderOriginX = entry.fromOriginX + (entry.targetOriginX - entry.fromOriginX) * t;
    entry.renderOriginY = entry.fromOriginY + (entry.targetOriginY - entry.fromOriginY) * t;

    let originX = entry.renderOriginX;
    let originY = entry.renderOriginY;
    if (
      writeMuzzlePose?.(entry.ownerId, row.weaponId, rowKey, entry.renderAngle, this.muzzlePose)
    ) {
      originX = this.muzzlePose.x;
      originY = this.muzzlePose.y;
    }
    if (local && row.weaponId === "x2-seraph-s-knuckle-reliquary" && localCursorTarget) {
      const cursorPose = seraphBeamCursorPose(
        { x: originX, y: originY },
        localCursorTarget,
        entry.renderLength,
      );
      this.drawPose.originX = cursorPose.originX;
      this.drawPose.originY = cursorPose.originY;
      this.drawPose.angle = cursorPose.angle;
      this.drawPose.length = cursorPose.length;
      const audit = globalThis as unknown as {
        __ddV6GAnchorCapture?: boolean;
        __ddV6GAnchorEvents?: Array<Record<string, unknown>>;
      };
      if (audit.__ddV6GAnchorCapture) {
        audit.__ddV6GAnchorEvents ??= [];
        const events = audit.__ddV6GAnchorEvents;
        events.push({
          kind: "beam-cursor-endpoint",
          weaponId: row.weaponId,
          anchor: "target",
          x: cursorPose.originX + Math.cos(cursorPose.angle) * cursorPose.length,
          y: cursorPose.originY + Math.sin(cursorPose.angle) * cursorPose.length,
          targetX: localCursorTarget.x,
          targetY: localCursorTarget.y,
        });
        if (events.length > 256) events.splice(0, events.length - 256);
      }
      return this.drawPose;
    }
    this.drawPose.originX = originX;
    this.drawPose.originY = originY;
    this.drawPose.angle = entry.renderAngle;
    this.drawPose.length = Math.max(0, entry.renderLength);
    return this.drawPose;
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
    pose: BeamDrawPose,
    color: number,
    visualWidth: number,
    nowMs: number,
    beltY0: number,
    beltYScale: number,
    recipe: CasterVfxRecipe | undefined,
  ): void {
    const beam = recipe?.beam;
    const redline = redlineFor(row.heat);
    const prismatic = !!beam?.rainbowPalette?.length;
    const edgeColor = mixColor(
      prismatic ? mixColor(color, 0x180b38, 0.48) : (beam?.edgeColor ?? color),
      0xff3824,
      redline * 0.9,
    );
    const chromaColor = mixColor(
      prismatic ? color : (beam?.accentColor ?? color),
      0xffd06a,
      redline * 0.48,
    );
    const coreColor = mixColor(
      prismatic ? mixColor(color, 0xffffff, 0.76) : (beam?.coreColor ?? 0xffffff),
      0xfff0a8,
      redline * 0.8,
    );
    const coneStream = WEAPONS[row.weaponId]?.beam?.coneStream;
    if (coneStream) {
      this.drawConeStream(
        entry,
        pose,
        visualWidth,
        coneStream.flavor,
        edgeColor,
        chromaColor,
        coreColor,
        nowMs,
        beltY0,
        beltYScale,
        beam?.conePolish,
      );
      return;
    }
    const edgeWidth = visualWidth * (beam?.edgeWidth ?? 1);
    const chromaWidth = visualWidth * (beam?.chromaWidth ?? 0.68);
    const coreWidth = visualWidth * ((beam?.coreWidth ?? 0.22) + redline * 0.04);
    // One ray at the current playback pose: the previous→current union belongs to server collision, not a
    // persistent visual smear. Every inset remains at or below the authoritative outer width.
    this.drawCapsule(
      pose.originX,
      pose.originY,
      pose.angle,
      pose.length,
      edgeWidth,
      edgeColor,
      0.16 + redline * 0.16,
      beltY0,
      beltYScale,
    );
    this.drawCapsule(
      pose.originX,
      pose.originY,
      pose.angle,
      pose.length,
      Math.min(edgeWidth * 0.88, visualWidth * 0.86),
      0x140912,
      0.88,
      beltY0,
      beltYScale,
    );
    this.drawCapsule(
      pose.originX,
      pose.originY,
      pose.angle,
      pose.length,
      chromaWidth,
      chromaColor,
      0.9 + redline * 0.08,
      beltY0,
      beltYScale,
    );
    this.drawCapsule(
      pose.originX,
      pose.originY,
      pose.angle,
      pose.length,
      coreWidth,
      coreColor,
      0.96,
      beltY0,
      beltYScale,
    );
    if (beam) this.drawRecipeTrace(entry, pose, beam, visualWidth, nowMs, beltY0, beltYScale);
    if (redline > 0) {
      const sourceY = this.projectY(pose.originY, beltY0, beltYScale);
      const dangerPulse = 0.5 + 0.5 * Math.sin(nowMs * 0.034 + entry.seed * Math.PI * 2);
      const radius = visualWidth * (0.22 + dangerPulse * 0.1);
      this.graphics
        .lineStyle(2 + redline * 1.5, 0xff3b24, redline * (0.52 + dangerPulse * 0.38))
        .strokeEllipse(pose.originX, sourceY, radius * 2, radius * 2 * beltYScale);
    }
    this.drawTerminus(entry, row, pose, edgeColor, visualWidth, nowMs, beltY0, beltYScale, beam);
    if (this.colorblindShapes) this.drawElementPattern(row, pose, beltY0, beltYScale);
  }

  /** W4R cone stream: three inset widening sheets plus advancing wave ribs. `visualWidth` is the
   * authoritative end diameter replicated by the server, so the painted cone never exceeds its hit sector. */
  private drawConeStream(
    entry: BeamEntry,
    pose: BeamDrawPose,
    visualWidth: number,
    flavor: "ice" | "magma",
    edgeColor: number,
    chromaColor: number,
    coreColor: number,
    nowMs: number,
    beltY0: number,
    beltYScale: number,
    polish?: BeamVfxRecipe["conePolish"],
  ): void {
    const c = Math.cos(pose.angle);
    const s = Math.sin(pose.angle);
    const halfEnd = Math.max(3, visualWidth * 0.5);
    const startHalf = Math.min(10, halfEnd * 0.08);
    const drawSheet = (fraction: number, color: number, alpha: number) => {
      const endHalf = halfEnd * fraction;
      const baseHalf = startHalf * fraction;
      const x0a = pose.originX - s * baseHalf;
      const y0a = this.projectY(pose.originY + c * baseHalf, beltY0, beltYScale);
      const x0b = pose.originX + s * baseHalf;
      const y0b = this.projectY(pose.originY - c * baseHalf, beltY0, beltYScale);
      const endX = pose.originX + c * pose.length;
      const endY = pose.originY + s * pose.length;
      const x1a = endX - s * endHalf;
      const y1a = this.projectY(endY + c * endHalf, beltY0, beltYScale);
      const x1b = endX + s * endHalf;
      const y1b = this.projectY(endY - c * endHalf, beltY0, beltYScale);
      this.graphics
        .fillStyle(color, alpha)
        .beginPath()
        .moveTo(x0a, y0a)
        .lineTo(x1a, y1a)
        .lineTo(x1b, y1b)
        .lineTo(x0b, y0b)
        .closePath()
        .fillPath();
    };
    const sheets = polish?.sheets ?? 3;
    for (let index = sheets; index >= 1; index--) {
      const fraction = 0.38 + (index / sheets) * 0.62;
      const color = index === 1 ? coreColor : index % 2 === 0 ? chromaColor : edgeColor;
      drawSheet(fraction, color, (flavor === "magma" ? 0.14 : 0.11) + (index / sheets) * 0.08);
    }

    const phase = nowMs * (flavor === "magma" ? 0.0024 : 0.0032) + entry.seed * Math.PI * 2;
    const ribs = polish?.ribs ?? 7;
    for (let index = 1; index <= ribs; index++) {
      const f = (((index / ribs + phase / (Math.PI * 2)) % 1) + 1) % 1;
      const centerX = pose.originX + c * pose.length * f;
      const centerY = pose.originY + s * pose.length * f;
      const half = halfEnd * f * (0.72 + 0.12 * Math.sin(phase + index));
      this.graphics
        .lineStyle(flavor === "magma" ? 3 : 2, index % 2 ? chromaColor : coreColor, 0.5)
        .lineBetween(
          centerX - s * half,
          this.projectY(centerY + c * half, beltY0, beltYScale),
          centerX + s * half,
          this.projectY(centerY - c * half, beltY0, beltYScale),
        );
    }
    if (flavor === "ice" && polish) {
      for (let index = 0; index < polish.meltParticles; index++) {
        const f = (((index / polish.meltParticles + nowMs * 0.00042) % 1) + 1) % 1;
        const lateral = Math.sin(phase * 0.7 + index * 2.31) * halfEnd * f * 0.72;
        const x = pose.originX + c * pose.length * f - s * lateral;
        const y = pose.originY + s * pose.length * f + c * lateral + 3 + 9 * f;
        this.graphics
          .fillStyle(index % 2 ? 0x6fd6ff : 0xe8fbff, 0.36)
          .fillCircle(x, this.projectY(y, beltY0, beltYScale), 1.5 + (index % 3) * 0.55);
      }
      const endX = pose.originX + c * pose.length;
      const endY = pose.originY + s * pose.length;
      for (let index = 0; index < polish.residuePatches; index++) {
        const lateral = (index / Math.max(1, polish.residuePatches - 1) - 0.5) * halfEnd * 1.55;
        const jitter = Math.sin(entry.seed * 9 + index * 3.17) * 7;
        this.graphics
          .fillStyle(index % 2 ? 0x9eeaff : 0xdaf8ff, 0.13)
          .fillEllipse(
            endX - s * lateral + c * jitter,
            this.projectY(endY + c * lateral + s * jitter, beltY0, beltYScale),
            18 + (index % 3) * 7,
            (6 + (index % 2) * 3) * beltYScale,
          );
      }
    }
  }

  private drawRecipeTrace(
    entry: BeamEntry,
    pose: BeamDrawPose,
    beam: BeamVfxRecipe,
    visualWidth: number,
    nowMs: number,
    beltY0: number,
    beltYScale: number,
  ): void {
    const c = Math.cos(pose.angle);
    const s = Math.sin(pose.angle);
    const steps = Math.max(8, Math.min(30, Math.ceil(pose.length / 28)));
    const phase = nowMs * 0.001 * beam.flickerHz + entry.seed * Math.PI * 2;
    const flicker = 0.58 + 0.28 * Math.sin(phase * 1.73);
    const tracks = beam.ripple === "double-helix" ? 2 : 1;
    const profileAmp =
      beam.widthProfile === "needle"
        ? 0.5
        : beam.widthProfile === "ribbon"
          ? 1.2
          : beam.widthProfile === "braided"
            ? 1.35
            : 1;
    for (let track = 0; track < tracks; track++) {
      this.graphics
        .lineStyle(
          Math.max(1, visualWidth * (beam.widthProfile === "ribbon" ? 0.055 : 0.032)),
          track === 0 ? beam.coreColor : beam.accentColor,
          flicker,
        )
        .beginPath();
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const wavePhase =
          f * Math.PI * 2 * beam.rippleFrequency + phase + (beam.ripplePhaseRad ?? 0);
        let wave = 0;
        if (beam.ripple === "sine" || beam.ripple === "double-helix") wave = Math.sin(wavePhase);
        else if (beam.ripple === "cosine") wave = Math.cos(wavePhase);
        else if (beam.ripple === "sawtooth")
          wave = 2 * (wavePhase / (Math.PI * 2) - Math.floor(wavePhase / (Math.PI * 2) + 0.5));
        else if (beam.ripple === "pulse-train") wave = Math.sin(wavePhase) > 0.45 ? 1 : -0.25;
        else if (beam.ripple === "stutter") wave = Math.sin(wavePhase * 2.7) > 0 ? 1 : -1;
        else wave = Math.sin(wavePhase) * 0.22;
        if (track === 1) wave = -wave;
        let envelope = 1;
        if (beam.widthProfile === "tapered") envelope = 1 - f * 0.72;
        else if (beam.widthProfile === "hourglass") envelope = 0.32 + Math.abs(f - 0.5) * 1.36;
        else if (beam.widthProfile === "segmented") envelope = i % 3 === 0 ? 1 : 0.35;
        const offset = wave * visualWidth * beam.rippleAmplitude * profileAmp * envelope;
        const wx = pose.originX + c * (pose.length * f) - s * offset;
        const wy = pose.originY + s * (pose.length * f) + c * offset;
        const py = this.projectY(wy, beltY0, beltYScale);
        if (i === 0) this.graphics.moveTo(wx, py);
        else this.graphics.lineTo(wx, py);
      }
      this.graphics.strokePath();
    }
    if (beam.widthProfile === "segmented" || beam.widthProfile === "hourglass") {
      const bars = beam.widthProfile === "segmented" ? 9 : 5;
      for (let i = 1; i <= bars; i++) {
        const f = i / (bars + 1);
        const half =
          visualWidth * (beam.widthProfile === "hourglass" ? 0.1 + Math.abs(f - 0.5) * 0.42 : 0.28);
        const cx = pose.originX + c * pose.length * f;
        const cy = pose.originY + s * pose.length * f;
        this.graphics
          .lineStyle(Math.max(1, visualWidth * 0.025), beam.coreColor, flicker * 0.74)
          .lineBetween(
            cx - s * half,
            this.projectY(cy + c * half, beltY0, beltYScale),
            cx + s * half,
            this.projectY(cy - c * half, beltY0, beltYScale),
          );
      }
    }
  }

  private drawTerminus(
    entry: BeamEntry,
    row: BeamRenderState,
    pose: BeamDrawPose,
    color: number,
    visualWidth: number,
    nowMs: number,
    beltY0: number,
    beltYScale: number,
    beam: BeamVfxRecipe | undefined,
  ): void {
    const endX = pose.originX + Math.cos(pose.angle) * pose.length;
    const endY = this.projectY(
      pose.originY + Math.sin(pose.angle) * pose.length,
      beltY0,
      beltYScale,
    );
    const capRadius = visualWidth * 0.5 * (beam?.impact.radiusScale ?? 1);
    const redline = redlineFor(row.heat);
    const phase = entry.seed * Math.PI * 2;
    const pulse =
      0.5 +
      0.5 * Math.sin(nowMs * (0.006 + (beam?.flickerHz ?? 8) * 0.001 + redline * 0.014) + phase);
    const ringRadius = capRadius * (0.48 + pulse * 0.27);
    const lineWidth = Math.min(3, Math.max(1.4, visualWidth * 0.045));
    const rings = beam?.impact.rings ?? 1;
    for (let ring = 0; ring < rings; ring++) {
      const radius = ringRadius * (1 + ring * 0.34);
      this.drawOrganicRim(
        endX,
        endY,
        radius,
        radius * beltYScale,
        ring % 2 === 0 ? (beam?.coreColor ?? 0xffffff) : (beam?.accentColor ?? color),
        (0.55 + pulse * 0.4) / (1 + ring * 0.22),
        Math.max(1, lineWidth - ring * 0.35),
        phase + ring * 0.83,
      );
    }
    this.graphics
      .fillStyle(beam?.accentColor ?? color, 0.42 + redline * 0.28)
      .fillEllipse(
        endX,
        endY,
        capRadius * (0.2 + pulse * 0.08),
        capRadius * (0.2 + pulse * 0.08) * beltYScale,
      );
    const points = beam?.impact.points ?? 5;
    for (let i = 0; i < points; i++) {
      const sparkPulse = 0.5 + 0.5 * Math.sin(nowMs * 0.026 + phase + i * 1.73);
      const angle =
        phase +
        (i * Math.PI * 2) / points +
        nowMs * 0.001 * (beam?.impact.spin ?? 0.4) +
        Math.sin(nowMs * 0.004 + i) * 0.16;
      const inner = capRadius * 0.18;
      const outer = capRadius * (0.48 + sparkPulse * (0.22 + redline * 0.1));
      const c = Math.cos(angle);
      const s = Math.sin(angle) * beltYScale;
      this.graphics
        .lineStyle(
          Math.max(1, lineWidth * 0.58),
          i % 2 === 0 ? (beam?.coreColor ?? 0xffffff) : (beam?.accentColor ?? color),
          0.55 + sparkPulse * 0.4,
        )
        .lineBetween(endX + c * inner, endY + s * inner, endX + c * outer, endY + s * outer);
    }
  }

  private drawOrganicRim(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    color: number,
    alpha: number,
    width: number,
    phase: number,
  ): void {
    const steps = 36;
    this.graphics.lineStyle(width, color, alpha);
    let drawing = false;
    for (let index = 0; index <= steps; index++) {
      const gap = index % 8 === 0 || index % 8 === 7;
      const angle = phase + (index / steps) * Math.PI * 2;
      const wobble = 1 + Math.sin(index * 2.31 + phase) * 0.07;
      const px = x + Math.cos(angle) * radiusX * wobble;
      const py = y + Math.sin(angle) * radiusY * wobble;
      if (gap) {
        if (drawing) this.graphics.strokePath();
        drawing = false;
      } else if (!drawing) {
        this.graphics.beginPath().moveTo(px, py);
        drawing = true;
      } else this.graphics.lineTo(px, py);
    }
    if (drawing) this.graphics.strokePath();
  }

  private drawElementPattern(
    row: BeamRenderState,
    pose: BeamDrawPose,
    beltY0: number,
    beltYScale: number,
  ): void {
    const length = Math.max(0, pose.length);
    const count = Math.max(1, Math.min(10, Math.floor(length / 54)));
    const c = Math.cos(pose.angle);
    const s = Math.sin(pose.angle);
    const pattern = elementAssistPattern(row.element);
    const size = Math.max(3.5, Math.min(7, row.width * 0.13));
    for (let i = 1; i <= count; i++) {
      const distance = (length * i) / (count + 1);
      this.drawElementMark(
        pose.originX + c * distance,
        this.projectY(pose.originY + s * distance, beltY0, beltYScale),
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
    pose: BeamDrawPose,
    color: number,
    visualWidth: number,
    quality: 8 | 12,
    nowMs: number,
    beltY0: number,
    beltYScale: number,
    recipe: CasterVfxRecipe | undefined,
  ): void {
    // These are the shipped element wisp/bolt sheets, including dedicated water and nature families. The
    // procedural capsules remain a truth/readability backing, never the beam's sole presentation.
    const paint = beamPaintFor(row.element);
    const beam = recipe?.beam;
    const particleElement = beam?.particleElement ?? paint.id;
    const bodyKey = `ptcl:${particleElement}-${beam?.bodyParticle ?? "wisp"}`;
    const lipKey = `ptcl:${particleElement}-${beam?.coreParticle ?? "bolt"}`;
    if (!this.scene.textures.exists(bodyKey) || !this.scene.textures.exists(lipKey)) {
      entry.body.setVisible(false);
      entry.lip.setVisible(false);
      return;
    }
    const x0 = pose.originX;
    const y0 = this.projectY(pose.originY, beltY0, beltYScale);
    const x1 = pose.originX + Math.cos(pose.angle) * pose.length;
    const y1 = this.projectY(pose.originY + Math.sin(pose.angle) * pose.length, beltY0, beltYScale);
    const projectedWidth = visualWidth * (beltYScale < 1 ? 0.72 : 1);
    const phase = nowMs * (0.00035 + (beam?.flickerHz ?? 6) * 0.000025) + entry.seed;
    const redline = redlineFor(row.heat);
    const paintColor = mixColor(beam?.accentColor ?? color, 0xff3b24, redline * 0.86);
    const coreColor = mixColor(beam?.coreColor ?? 0xffffff, 0xffdf80, redline * 0.72);
    globalThis.VFXRENDER.updateLinearRope(
      entry.body,
      bodyKey,
      beam?.bodyFrame ?? paint.wisp,
      quality,
      x0,
      y0,
      x1,
      y1,
      projectedWidth * ((beam?.chromaWidth ?? 0.48) + redline * 0.04),
      0.42 + redline * 0.16,
      paintColor,
      phase,
      projectedWidth * ((beam?.rippleAmplitude ?? 0.035) * 0.22 + redline * 0.018),
    );
    globalThis.VFXRENDER.updateLinearRope(
      entry.lip,
      lipKey,
      beam?.coreFrame ?? paint.bolt,
      quality,
      x0,
      y0,
      x1,
      y1,
      projectedWidth * ((beam?.coreWidth ?? 0.17) + redline * 0.03),
      0.52 + redline * 0.2,
      coreColor,
      -phase * 1.4,
      projectedWidth * ((beam?.rippleAmplitude ?? 0.018) * 0.1 + redline * 0.008),
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
