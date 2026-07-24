// VfxPlayer — plays a weapon's authored VFX suite in the LIVE game on a real swing (§14, CODE-8). Runs
// the CANONICAL renderer (vfx-render.js — the exact module the Weaponsmith preview uses), so a suite
// authored in the smith renders identically in-world. Suites are baked by build-weapon-vfx.mjs.
//
// Each play spins up a pooled "surface" (a container + additive graphics + pooled emitters) at the
// strike point, oriented to the aim, and drives the suite over the accepted/predicted swing descriptor's
// 0→1 pose window (swing trail → impact burst → painted hero), then releases the surface.
import {
  BLADE_EXTENSION_RETRACTION_SECONDS,
  type BladeExtensionGeometry,
  bladeAngleAt,
  bladeExtensionDamageReachForReveal,
  bladeExtensionGeometryFor,
  bladeExtensionIgnitionReveal,
  comboRibbonWidthMultiplierAt,
  meleeComboSelectionFor,
  meleeReach,
  type SwingDescriptor,
  swingEdgeProgress,
  WEAPONS,
  type WeaponDef,
} from "@dd/shared";
import type Phaser from "phaser";
import type { WeaponBladeAttachmentPose } from "../entities/SpriteRig.js";
import { RENDER_DPR } from "../render-dpr.js";
import { preloadFxPacks } from "./fx-composer.js";
import { paintedSwingDisplayWidth } from "./painted-particle-scale.js";
import { PARTICLE_PACKS } from "./particle-manifest.js";
import { elementPack, paintedParticlePixels, particleBurst } from "./particles.js";
import "./vfx-render.js"; // sets globalThis.VFXRENDER
import "./vfx-layers.js"; // sets globalThis.VFXLAYERS
import {
  ALL_BLADE_EXTENSION_TEXTURES,
  bladeExtensionTreatmentFor,
  ensureProceduralBladeExtensionTextures,
  weaponSupportsBladeExtension,
} from "./blade-extension-treatments.js";
import { KATANA_SLASH_ASSIGNMENTS } from "./katana-slash.generated.js";
import { MUZZLE_FLASH_SHEET, muzzleFlashAssignmentFor } from "./muzzle-flash-catalog.js";
import { WEAPON_VFX, type WeaponVfx } from "./weapon-vfx.generated.js";
import {
  RIFTCALLER_DELETED_AURA_LAYERS,
  ELEMENT_PAINT as SYSTEMIC_ELEMENT_PAINT,
  splitWeaponVfxSuite,
  weaponVfxSuiteFor,
} from "./weapon-vfx-suite.js";

const DEG = Math.PI / 180;
// Longest canonical emitter life is 900ms (embers top out at 880, scatter at 780). The authored draw
// finishes at the swing pose end, but the surface must stay put + visible until this tail dies naturally.
const PARTICLE_TAIL_MS = 900;

// The fallback suite itself lives in weapon-vfx-suite.ts so runtime and whole-catalog tests share one path.
type Suite = WeaponVfx["suite"];
const PER_PACK_IDS = [
  "steel-wisp",
  "steel-bolt",
  "fire-wisp",
  "fire-bolt",
  "frost-wisp",
  "frost-bolt",
  "shock-wisp",
  "shock-bolt",
  "holy-wisp",
  "holy-bolt",
  "toxic-wisp",
  "toxic-bolt",
  "void-wisp",
  "void-bolt",
  "arcane-wisp",
  "arcane-bolt",
] as const;
const PER_LAYER_IDS = new Set(["blade-trail", "twin-slash", "thrust-streak"]);

interface Surface {
  container: Phaser.GameObjects.Container;
  S: VfxSurface;
  busy: boolean;
  generation: number;
  activeTween?: Phaser.Tweens.Tween;
  releaseEvent?: Phaser.Time.TimerEvent;
  scatterKey?: string;
}

interface BladeExtensionState {
  readonly slotKey: string;
  readonly image: Phaser.GameObjects.Image;
  sourceBladePose: () => WeaponBladeAttachmentPose | undefined;
  weaponId: string;
  comboId: string;
  treatmentKey: string;
  geometry: BladeExtensionGeometry;
  fitAuthoritativeTipReach: boolean;
  reveal: number;
  retractStartedAtMs?: number;
  retractFromReveal: number;
  capturedIgnitionOrigin: boolean;
  capturedRetractionEnd: boolean;
  hiddenSinceWallMs?: number;
}

export interface BladeExtensionDrawTransform {
  readonly rootX: number;
  readonly rootY: number;
  readonly overlapLength: number;
  readonly emergedLength: number;
  readonly drawLength: number;
  readonly bladeWidth: number;
  readonly normalSign: -1 | 1;
}

/** Compose the magic section in the held blade's final local basis. No aim/facing/pose inputs exist here. */
export function bladeExtensionDrawTransform(
  pose: Pick<
    WeaponBladeAttachmentPose,
    "x" | "y" | "axisX" | "axisY" | "normalX" | "normalY" | "physicalBladeLength" | "bladeWidth"
  >,
  geometry: BladeExtensionGeometry,
  reveal: number,
): BladeExtensionDrawTransform {
  const safePhysicalLength = Math.max(1, pose.physicalBladeLength);
  const physicalRatio = safePhysicalLength / Math.max(1, geometry.physicalBladeLength);
  const overlapLength = geometry.overlapLength * physicalRatio;
  const fullEmergedLength =
    (geometry.totalBladeLength - geometry.physicalBladeLength) * physicalRatio;
  const emergedLength = fullEmergedLength * Math.max(0, Math.min(1, reveal));
  const determinant = pose.axisX * pose.normalY - pose.axisY * pose.normalX;
  return Object.freeze({
    rootX: pose.x - pose.axisX * overlapLength,
    rootY: pose.y - pose.axisY * overlapLength,
    overlapLength,
    emergedLength,
    drawLength: overlapLength + emergedLength,
    bladeWidth: Math.max(1, pose.bladeWidth),
    normalSign: determinant < 0 ? -1 : 1,
  });
}

/** A 1H hilt can orbit ahead of or behind the authoritative player root while keeping the same final blade
 * affine. Preserve that affine and solve only the local-axis length so the lit tip ends on the damage radius.
 * Blending the correction by reveal keeps ignition continuous from the hidden overlap at reveal zero. */
export function fitBladeExtensionDrawLengthToReach(
  pose: Pick<WeaponBladeAttachmentPose, "wielderX" | "wielderY" | "axisX" | "axisY">,
  draw: BladeExtensionDrawTransform,
  authoritativeReach: number,
  reveal: number,
): BladeExtensionDrawTransform {
  const dx = draw.rootX - pose.wielderX;
  const dy = draw.rootY - pose.wielderY;
  const along = dx * pose.axisX + dy * pose.axisY;
  const radialSquared = dx * dx + dy * dy;
  const reach = Math.max(0, authoritativeReach);
  const discriminant = along * along + reach * reach - radialSquared;
  if (!Number.isFinite(discriminant) || discriminant < 0) return draw;
  const fittedLength = -along + Math.sqrt(discriminant);
  if (!Number.isFinite(fittedLength) || fittedLength < draw.overlapLength) return draw;
  const blend = Math.max(0, Math.min(1, reveal));
  return Object.freeze({
    ...draw,
    drawLength: draw.drawLength + (fittedLength - draw.drawLength) * blend,
  });
}

interface PerRuntimeSurface {
  perQuality?: 4 | 8 | 12;
  perLongTailFired?: boolean;
  perBody?: Phaser.GameObjects.Rope;
  perLip?: Phaser.GameObjects.Rope;
  muzzleFlashImg?: Phaser.GameObjects.Image;
  per?: {
    swing: SwingDescriptor;
    reach: number;
    swingArc: number;
    style: SwingDescriptor["style"];
    size?: WeaponDef["tags"]["size"];
    paintedWidthPx: number;
    grip?: WeaponDef["tags"]["grip"];
    family?: string;
    weaponId: string;
    paint: number;
    slashArt?: {
      readonly key: string;
      readonly url: string;
      readonly frame: number;
      readonly frames: number;
    };
    muzzleFlashArt?: {
      readonly key: string;
      readonly url: string;
      readonly frame: number;
      readonly originX: number;
    };
    originX: number;
    originY: number;
    edgeProgress(elapsedSeconds: number): number;
    angleAt(progress: number): number;
    ribbonWidthMultiplierAt(progress: number): number;
  };
}

const perRuntime = (S: VfxSurface): PerRuntimeSurface => S as unknown as PerRuntimeSurface;

export class VfxPlayer {
  private readonly scene: Phaser.Scene;
  private readonly pool: Surface[] = [];
  private readonly bladeExtensions = new Map<string, BladeExtensionState>();
  private readonly cap = 12;
  private stealCursor = 0;
  /** All VFX surfaces live under this container so ONE bloom filter glows every effect at once. */
  private readonly root: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    globalThis.VFXRENDER.ensureTextures(scene);
    this.root = scene.add.container(0, 0).setDepth(99000);
    // Per-object BLOOM (Phaser 4 Filters): bright additive sparks/fire glow without hazing the rest of
    // the scene. Degrades gracefully if filters are unavailable in this build/context.
    // §28 hi-DPI: the container FILTER renders through its own framebuffer that doesn't compose under a
    // zoomed/origin-shifted camera — it offsets every VFX. So only enable bloom at RENDER_DPR 1 (no
    // camera zoom); under hi-DPI we drop the glow to keep the VFX aligned to the world. (A camera-level
    // glow that respects the zoom is the proper fix later.)
    if (RENDER_DPR === 1) {
      try {
        const r = this.root as unknown as {
          enableFilters?: () => void;
          filters?: {
            internal?: { addGlow?: (c: number, o: number, i: number, s: number) => void };
          };
        };
        r.enableFilters?.();
        r.filters?.internal?.addGlow?.(0xffe6b0, 4, 0, 1.25);
      } catch {
        /* no bloom — sparks still render, just unbloomed */
      }
    }
    // Tweens advance before Arena's rig animation in Phaser's scene step. Re-attach extended blades after
    // that animation so a long/loaded frame cannot leave damaging art one rendered pose behind its sword.
    scene.events.on("postupdate", this.syncBladeExtensions, this);
    scene.events.once("shutdown", () => {
      scene.events.off("postupdate", this.syncBladeExtensions, this);
      for (const state of this.bladeExtensions.values()) state.image.destroy();
      this.bladeExtensions.clear();
    });
  }

  private syncBladeExtensions(): void {
    const wallNow = this.scene.time.now;
    for (const [slotKey, state] of this.bladeExtensions) {
      const pose = state.sourceBladePose();
      if (pose && pose.weaponId === state.weaponId) {
        if (pose.comboId !== state.comboId) {
          state.comboId = pose.comboId;
          state.reveal = 0;
          state.retractStartedAtMs = undefined;
          state.retractFromReveal = 0;
          state.capturedIgnitionOrigin = false;
          state.capturedRetractionEnd = false;
        }
        if (pose.comboActive) {
          state.reveal = bladeExtensionIgnitionReveal(
            Math.max(0, pose.nowMs - pose.comboStartedAtMs) / 1000,
          );
          state.retractStartedAtMs = undefined;
          state.retractFromReveal = state.reveal;
          state.capturedRetractionEnd = false;
        } else {
          if (state.retractStartedAtMs === undefined) {
            state.retractStartedAtMs = pose.comboExpiresAtMs;
            state.retractFromReveal = Math.max(
              state.reveal,
              bladeExtensionIgnitionReveal(
                Math.max(0, pose.comboExpiresAtMs - pose.comboStartedAtMs) / 1000,
              ),
            );
          }
          const retractProgress =
            (pose.nowMs - state.retractStartedAtMs) / (BLADE_EXTENSION_RETRACTION_SECONDS * 1000);
          state.reveal = state.retractFromReveal * (1 - Math.max(0, Math.min(1, retractProgress)));
        }

        if (state.reveal > 0) {
          const baseDraw = bladeExtensionDrawTransform(pose, state.geometry, state.reveal);
          const draw = state.fitAuthoritativeTipReach
            ? fitBladeExtensionDrawLengthToReach(
                pose,
                baseDraw,
                this.bladeExtensionAuthoritativeReach(state, pose),
                state.reveal,
              )
            : baseDraw;
          state.image
            .setTexture(state.treatmentKey)
            .setPosition(draw.rootX, draw.rootY)
            .setRotation(pose.angle)
            .setDepth(pose.depth - 1)
            .setDisplaySize(draw.drawLength, draw.bladeWidth)
            .setAlpha(Math.min(1, 0.45 + state.reveal * 0.55))
            .setVisible(true);
          state.image.scaleY = Math.abs(state.image.scaleY) * draw.normalSign;
          state.hiddenSinceWallMs = undefined;
          this.captureBladeExtensionFrame(state, pose, draw);
          continue;
        }

        const captureZero = pose.comboActive
          ? !state.capturedIgnitionOrigin
          : !state.capturedRetractionEnd;
        if (captureZero) {
          const draw = bladeExtensionDrawTransform(pose, state.geometry, 0);
          state.image
            .setTexture(state.treatmentKey)
            .setPosition(draw.rootX, draw.rootY)
            .setRotation(pose.angle)
            .setDepth(pose.depth - 1)
            .setDisplaySize(draw.drawLength, draw.bladeWidth)
            .setVisible(false);
          state.image.scaleY = Math.abs(state.image.scaleY) * draw.normalSign;
          this.captureBladeExtensionFrame(state, pose, draw);
          if (pose.comboActive) state.capturedIgnitionOrigin = true;
          else state.capturedRetractionEnd = true;
        }
      }

      state.image.setVisible(false);
      state.hiddenSinceWallMs ??= wallNow;
      if (wallNow - state.hiddenSinceWallMs >= 1_500) {
        state.image.destroy();
        this.bladeExtensions.delete(slotKey);
      }
    }
  }

  private captureBladeExtensionFrame(
    state: BladeExtensionState,
    pose: WeaponBladeAttachmentPose,
    draw: BladeExtensionDrawTransform,
  ): void {
    const audit = globalThis as unknown as {
      __ddV7BladeExtensionCapture?: boolean;
      __ddV7BladeExtensionPhase?: string;
      __ddV7BladeExtensionFrames?: Array<Record<string, number | string | boolean>>;
    };
    if (!audit.__ddV7BladeExtensionCapture) return;
    const imageAxisX = Math.cos(state.image.rotation);
    const imageAxisY = Math.sin(state.image.rotation);
    const joinX = state.image.x + imageAxisX * draw.overlapLength;
    const joinY = state.image.y + imageAxisY * draw.overlapLength;
    const extensionTipX = state.image.x + imageAxisX * draw.drawLength;
    const extensionTipY = state.image.y + imageAxisY * draw.drawLength;
    const errorX = joinX - pose.x;
    const errorY = joinY - pose.y;
    const rangeMultiplier = this.bladeExtensionRangeMultiplier(state.weaponId, pose.comboStep);
    const authoritativeTipReach = this.bladeExtensionAuthoritativeReach(state, pose);
    const visibleTipReach = Math.hypot(
      extensionTipX - pose.wielderX,
      extensionTipY - pose.wielderY,
    );
    audit.__ddV7BladeExtensionFrames ??= [];
    const frames = audit.__ddV7BladeExtensionFrames;
    frames.push({
      wallMs: performance.now(),
      nowMs: pose.nowMs,
      sourceId: pose.sourceId,
      weaponId: state.weaponId,
      hand: pose.hand,
      comboId: state.comboId,
      comboStep: pose.comboStep,
      comboActive: pose.comboActive,
      phase: audit.__ddV7BladeExtensionPhase ?? "unlabeled",
      reveal: state.reveal,
      bladeTipX: pose.x,
      bladeTipY: pose.y,
      wielderX: pose.wielderX,
      wielderY: pose.wielderY,
      bladeAngle: pose.angle,
      bladeAxisX: pose.axisX,
      bladeAxisY: pose.axisY,
      bladeWidth: pose.bladeWidth,
      physicalBladeLength: pose.physicalBladeLength,
      extensionRootX: state.image.x,
      extensionRootY: state.image.y,
      extensionAngle: state.image.rotation,
      extensionWidth: Math.abs(state.image.displayHeight),
      extensionLength: state.image.displayWidth,
      overlapLength: draw.overlapLength,
      emergedLength: draw.emergedLength,
      rangeMultiplier,
      visibleTipReach,
      authoritativeTipReach,
      reachExtentError: visibleTipReach - authoritativeTipReach,
      authoritativeTipFit: state.fitAuthoritativeTipReach,
      axialError: errorX * pose.axisX + errorY * pose.axisY,
      lateralError: errorX * pose.normalX + errorY * pose.normalY,
      angleError: Math.atan2(
        Math.sin(state.image.rotation - pose.angle),
        Math.cos(state.image.rotation - pose.angle),
      ),
    });
    if (frames.length > 12_000) frames.splice(0, frames.length - 12_000);
  }

  private bladeExtensionRangeMultiplier(weaponId: string, comboStep: number): number {
    const weapon = WEAPONS[weaponId];
    return (
      (weapon && meleeComboSelectionFor(weapon)?.sequence[comboStep]?.path.rangeMultiplier) || 1
    );
  }

  private bladeExtensionAuthoritativeReach(
    state: BladeExtensionState,
    pose: WeaponBladeAttachmentPose,
  ): number {
    const weapon = WEAPONS[state.weaponId];
    if (!weapon) return 0;
    const lengthScale = state.fitAuthoritativeTipReach
      ? 1
      : pose.physicalBladeLength / Math.max(1, state.geometry.physicalBladeLength);
    return (
      bladeExtensionDamageReachForReveal(weapon, state.reveal, 1, lengthScale) *
      this.bladeExtensionRangeMultiplier(state.weaponId, pose.comboStep)
    );
  }

  private retainBladeExtension(
    weaponId: string,
    treatmentKey: string,
    geometry: BladeExtensionGeometry,
    sourceBladePose: () => WeaponBladeAttachmentPose | undefined,
    fitAuthoritativeTipReach: boolean,
  ): void {
    const pose = sourceBladePose();
    if (!pose || pose.weaponId !== weaponId) return;
    const slotKey = `${pose.sourceId}:${pose.hand}`;
    let state = this.bladeExtensions.get(slotKey);
    if (!state) {
      state = {
        slotKey,
        image: this.scene.add.image(0, 0, treatmentKey).setOrigin(0, 0.5).setVisible(false),
        sourceBladePose,
        weaponId,
        comboId: pose.comboId,
        treatmentKey,
        geometry,
        fitAuthoritativeTipReach,
        reveal: 0,
        retractFromReveal: 0,
        capturedIgnitionOrigin: false,
        capturedRetractionEnd: false,
      };
      this.bladeExtensions.set(slotKey, state);
    } else {
      state.sourceBladePose = sourceBladePose;
      state.weaponId = weaponId;
      state.treatmentKey = treatmentKey;
      state.geometry = geometry;
      state.fitAuthoritativeTipReach = fitAuthoritativeTipReach;
      if (state.comboId !== pose.comboId) {
        state.comboId = pose.comboId;
        state.reveal = 0;
        state.retractStartedAtMs = undefined;
        state.retractFromReveal = 0;
        state.capturedIgnitionOrigin = false;
        state.capturedRetractionEnd = false;
      }
    }
    this.syncBladeExtensions();
  }

  /** The bloom-filtered container every VFX lives under — exposed so other renderers (e.g. ArenaScene's
   *  chain-lightning bolt) can share the same glow root instead of spinning up a second filter. */
  get bloomRoot(): Phaser.GameObjects.Container {
    return this.root;
  }

  /** §14 whether this weapon's authored VFX spawns at the in-game CURSOR (clamped, greatsword-quake style)
   *  rather than at the weapon anchor. The caller picks the spawn point; the offset/origin still applies. */
  spawnsAtCursor(weaponId: string): boolean {
    return !!WEAPON_VFX[weaponId]?.spawnAtCursor;
  }

  /** Preload every authored hero skin + scatter sheet referenced by the baked VFX (call in scene.preload). */
  static preloadAssets(scene: Phaser.Scene): void {
    // §49 the twelve component packs are deliberately all boot-queued: they are small, observed remote
    // weapons can change without warning, and the optional loader/no-op composer absorbs absent files.
    preloadFxPacks(scene);
    // Live play keeps PER's audited wisp/bolt sheets hot. The canonical JS renderer also has a relative
    // lazy-load path for standalone preview hosts and retains its filled Graphics fallback while loading.
    for (const id of PER_PACK_IDS) {
      const pack = PARTICLE_PACKS[id];
      if (pack)
        scene.load.spritesheet(`ptcl:${id}`, pack.url, {
          frameWidth: pack.frameWidth,
          frameHeight: pack.frameWidth,
        });
    }
    for (const [id, vfx] of Object.entries(WEAPON_VFX)) {
      if (vfx.hero) scene.load.image(`vfxhero:${id}`, vfx.hero);
      if (vfx.scatter) {
        scene.load.spritesheet(`scatter:${vfx.scatter.url}`, vfx.scatter.url, {
          frameWidth: vfx.scatter.frameWidth,
          frameHeight: vfx.scatter.frameHeight,
        });
      }
      for (const painted of [vfx.paintedAura, vfx.paintedSwing, vfx.paintedQuake])
        if (painted && !scene.textures.exists(painted.textureKey))
          scene.load.image(painted.textureKey, painted.url);
      if (vfx.generatedImage && !scene.textures.exists(vfx.generatedImage.textureKey))
        scene.load.image(vfx.generatedImage.textureKey, vfx.generatedImage.url);
    }
    for (const assignment of Object.values(KATANA_SLASH_ASSIGNMENTS)) {
      scene.load.spritesheet(assignment.key, assignment.url, {
        frameWidth: 96,
        frameHeight: 96,
      });
    }
    scene.load.spritesheet(MUZZLE_FLASH_SHEET.key, MUZZLE_FLASH_SHEET.url, {
      frameWidth: MUZZLE_FLASH_SHEET.frameWidth,
      frameHeight: MUZZLE_FLASH_SHEET.frameHeight,
    });
    for (const treatment of ALL_BLADE_EXTENSION_TEXTURES)
      scene.load.image(treatment.textureKey, treatment.url);
    ensureProceduralBladeExtensionTextures(scene);
  }

  /** Stop every owner of a surface before reassigning it. Generation checks are still required: Phaser can
   *  already have queued a completion callback in the same tick that a pressure-steal happens. */
  private prepare(surf: Surface): Surface {
    surf.generation++;
    surf.activeTween?.stop();
    surf.activeTween = undefined;
    surf.releaseEvent?.remove(false);
    surf.releaseEvent = undefined;
    surf.S.gfxAdd?.clear();
    const per = perRuntime(surf.S);
    per.perBody?.setVisible(false);
    per.perLip?.setVisible(false);
    per.muzzleFlashImg?.setVisible(false);
    per.perLongTailFired = false;
    per.per = undefined;
    surf.S.paintedImpact = undefined;
    (surf.S.heroImg as Phaser.GameObjects.Image | undefined)?.setVisible(false);
    const emitters = surf.S as unknown as Record<string, { killAll(): unknown } | undefined>;
    for (const key of ["eSpark", "eEmber", "eSoftAdd", "eSoftNorm", "eStreak", "eScatter"])
      emitters[key]?.killAll();
    surf.container.setVisible(false);
    surf.busy = true;
    return surf;
  }

  private acquire(): Surface {
    let busy = 0;
    for (const candidate of this.pool) if (candidate.busy) busy++;
    let surf = this.pool.find((p) => !p.busy);
    if (!surf) {
      if (this.pool.length >= this.cap) {
        // Pressure steals rotate through the pool; `prepare` fully cancels the old owner so no old counter
        // can clear the new strike and no live ember/scatter can teleport to its reassigned container.
        surf = this.pool[this.stealCursor % this.pool.length] as Surface;
        this.stealCursor = (this.stealCursor + 1) % this.pool.length;
      } else {
        const container = this.scene.add.container(0, 0);
        this.root.add(container); // under the bloom root
        const S = {
          suite: {},
          fired: {},
          R: 80,
          heroEnabled: true,
          scene: this.scene,
          container,
        } as unknown as VfxSurface;
        const heroImg = this.scene.add.image(0, 0, "vfx-blank").setVisible(false);
        container.add(heroImg);
        S.heroImg = heroImg;
        globalThis.VFXRENDER.attachSurface(this.scene, S);
        surf = { container, S, busy: false, generation: 0 };
        this.pool.push(surf);
      }
    }
    const activeAfterAcquire = busy + (surf.busy ? 0 : 1);
    const acquired = this.prepare(surf);
    perRuntime(acquired.S).perQuality =
      activeAfterAcquire <= 6 ? 12 : activeAfterAcquire <= 9 ? 8 : 4;
    return acquired;
  }

  /** Fire a weapon's swing VFX at world (x,y), pointing toward `aimRad`. The VFX SIZE is the weapon's
   *  authored fixed `vfxRadius` (§14 — never stat/level-scaled); `radius` is only a fallback for weapons
   *  with no baked entry at all. */
  playSwing(
    weaponId: string,
    x: number,
    y: number,
    aimRad: number,
    radius: number,
    swing: SwingDescriptor,
    element = "physical",
    targetX = x,
    targetY = y,
    sourceBladePose?: () => WeaponBladeAttachmentPose | undefined,
    partition?: {
      readonly suite: Suite;
      readonly anchor: "source" | "target";
      readonly authored: boolean;
    },
  ): void {
    const VR = globalThis.VFXRENDER;
    if (!VR) return;
    const resolvedSuite = weaponVfxSuiteFor(weaponId, element, swing.style);
    const vfx: WeaponVfx | undefined = resolvedSuite.vfx;
    const weapon = WEAPONS[weaponId];
    const authored = resolvedSuite.authored;
    if (!partition) {
      const rawSuite = resolvedSuite.suite;
      const deleted =
        weaponId === "x2-riftcaller-naginata"
          ? new Set<string>(RIFTCALLER_DELETED_AURA_LAYERS)
          : undefined;
      const suite = Object.fromEntries(
        Object.entries(rawSuite).filter(([layerId, layer]) => layer.on && !deleted?.has(layerId)),
      ) as Suite;
      if (vfx?.spawnAtCursor) {
        this.playSwing(
          weaponId,
          x,
          y,
          aimRad,
          radius,
          swing,
          element,
          targetX,
          targetY,
          sourceBladePose,
          {
            suite,
            anchor: "target",
            authored,
          },
        );
        return;
      }
      const split = splitWeaponVfxSuite(suite);
      // Blade extensions are source-anchored weapon treatments in their own right. Keep
      // a source surface even when the authored suite happens to contain only target-anchored layers.
      if (Object.keys(split.source).length > 0 || weaponSupportsBladeExtension(weaponId))
        this.playSwing(
          weaponId,
          x,
          y,
          aimRad,
          radius,
          swing,
          element,
          targetX,
          targetY,
          sourceBladePose,
          {
            suite: split.source,
            anchor: "source",
            authored,
          },
        );
      if (Object.keys(split.target).length > 0)
        this.playSwing(
          weaponId,
          x,
          y,
          aimRad,
          radius,
          swing,
          element,
          targetX,
          targetY,
          sourceBladePose,
          {
            suite: split.target,
            anchor: "target",
            authored,
          },
        );
      return;
    }
    const surf = this.acquire();
    const generation = surf.generation;
    const S = surf.S;
    const bladeExtensionTreatment =
      partition.anchor === "source" ? bladeExtensionTreatmentFor(weaponId) : undefined;
    const bladeExtensionGeometry =
      bladeExtensionTreatment && weapon ? bladeExtensionGeometryFor(weapon) : undefined;
    if (bladeExtensionTreatment && bladeExtensionGeometry && sourceBladePose)
      this.retainBladeExtension(
        weaponId,
        bladeExtensionTreatment.textureKey,
        bladeExtensionGeometry,
        sourceBladePose,
        bladeExtensionTreatment.kind === "procedural-hardlight",
      );
    // Authored suite wins; else a synthesized ELEMENT + ARCHETYPE fallback (§35/§36) so every un-authored
    // expansion weapon reads unique by both its element AND its physical shape (thrust / cleave / twin / fast).
    S.suite = partition.suite;
    S.fired = {};
    S.R = vfx?.vfxRadius ?? radius; // authored fixed size wins
    const swingArc = weapon?.swingArc ?? Math.PI * 0.7;
    const perRot = authored ? (vfx?.rot ?? 0) * DEG : 0;
    const perOrigin = partition.anchor === "source" && authored && weapon;
    const perAnchorX = perOrigin ? -weapon.range * 0.6 - (vfx?.vfxOrigin?.x ?? 0) : 0;
    const perAnchorY = perOrigin ? -(vfx?.vfxOrigin?.y ?? 0) : 0;
    const katanaSlash = KATANA_SLASH_ASSIGNMENTS[weaponId as keyof typeof KATANA_SLASH_ASSIGNMENTS];
    const muzzleFlash = weapon?.gun
      ? muzzleFlashAssignmentFor(weaponId, weapon.gun.muzzle)
      : undefined;
    const openingRibbon = swing.comboRibbon;
    if (
      openingRibbon?.fanOutStartScale !== undefined &&
      openingRibbon.fanOutEndScale !== undefined
    ) {
      const audit = globalThis as unknown as {
        __ddB18FanOutAudit?: Array<Record<string, number | string>>;
      };
      const frames = audit.__ddB18FanOutAudit;
      if (frames) {
        frames.push({
          weaponId,
          progress: 0,
          widthMultiplier: comboRibbonWidthMultiplierAt(openingRibbon, 0),
          bodyWidth: 0,
          fanOutStartScale: openingRibbon.fanOutStartScale,
          fanOutEndScale: openingRibbon.fanOutEndScale,
        });
      }
    }
    perRuntime(S).per = {
      swing,
      weaponId,
      reach: weapon ? meleeReach(weapon) : radius,
      swingArc,
      style: swing.style,
      size: weapon?.tags.size,
      paintedWidthPx: paintedSwingDisplayWidth(weapon),
      grip: weapon?.tags.grip,
      family: weapon?.tags.family,
      paint: SYSTEMIC_ELEMENT_PAINT[element] ?? 0,
      slashArt: katanaSlash
        ? { key: katanaSlash.key, url: katanaSlash.url, frame: 0, frames: 10 }
        : undefined,
      muzzleFlashArt: muzzleFlash
        ? {
            key: MUZZLE_FLASH_SHEET.key,
            url: MUZZLE_FLASH_SHEET.url,
            frame: muzzleFlash.frame,
            originX: MUZZLE_FLASH_SHEET.originX,
          }
        : undefined,
      originX: perAnchorX * Math.cos(perRot) + perAnchorY * Math.sin(perRot),
      originY: -perAnchorX * Math.sin(perRot) + perAnchorY * Math.cos(perRot),
      edgeProgress: (elapsedSeconds) => swingEdgeProgress(swing, elapsedSeconds),
      angleAt: (progress) => bladeAngleAt(-perRot, swingArc, progress),
      ribbonWidthMultiplierAt: (progress) =>
        swing.comboRibbon
          ? comboRibbonWidthMultiplierAt(swing.comboRibbon, progress)
          : 1,
    };
    S.heroEnabled = true;
    S.wantHeroKey = vfx?.hero ? `vfxhero:${weaponId}` : null;
    if (vfx?.scatter) {
      const key = `scatter:${vfx.scatter.url}`;
      if (surf.scatterKey !== key) {
        VR.loadScatter(
          S,
          vfx.scatter.url,
          vfx.scatter.frameWidth,
          vfx.scatter.frameHeight,
          vfx.scatter.count,
        );
        surf.scatterKey = key;
      }
    } else {
      S.scatterMeta = null;
    }
    // §14 authored VFX ORIGIN: shift the spawn by the placed offset, rotated into the aim frame so the
    // anchor stays consistent whichever way the weapon points (no offset = spawn at the strike point).
    let ox = partition.anchor === "target" ? targetX : x;
    let oy = partition.anchor === "target" ? targetY : y;
    if (partition.anchor === "source" && !authored && weapon) {
      // Arena's existing fallback call supplies its historical 60%-reach strike point. Recover the rendered
      // wielder center here so PER and the descriptor's radial blade segment share one origin.
      const strikeOffset = weapon.range * 0.6;
      ox -= Math.cos(aimRad) * strikeOffset;
      oy -= Math.sin(aimRad) * strikeOffset;
    }
    const o = partition.anchor === "source" && authored ? vfx?.vfxOrigin : undefined;
    if (o && (o.x || o.y)) {
      const c = Math.cos(aimRad);
      const s = Math.sin(aimRad);
      ox = x + o.x * c - o.y * s;
      oy = y + o.x * s + o.y * c;
    }
    surf.container
      .setPosition(ox, oy)
      .setRotation(aimRad + (authored ? (vfx?.rot ?? 0) * DEG : 0))
      .setVisible(true);
    const audit = globalThis as unknown as {
      __ddV6GAnchorCapture?: boolean;
      __ddV6GAnchorEvents?: Array<Record<string, unknown>>;
    };
    if (audit.__ddV6GAnchorCapture) {
      audit.__ddV6GAnchorEvents ??= [];
      const events = audit.__ddV6GAnchorEvents;
      events.push({
        kind: "weapon-vfx-suite",
        weaponId,
        anchor: partition.anchor,
        x: ox,
        y: oy,
        targetX,
        targetY,
        layerIds: Object.keys(partition.suite),
      });
      if (events.length > 256) events.splice(0, events.length - 256);
    }
    S.paintedImpact = (params) => {
      const pack = elementPack(element, "splat");
      const count = Math.max(3, Math.min(12, Math.round(params.count ?? 6)));
      const displayPixels = Math.max(36, Math.min(84, S.R * (params.size ?? 0.72)));
      const spawned = particleBurst(this.scene, pack, ox, oy, {
        count,
        spread: Math.PI * 2,
        speed: Math.max(90, Math.min(190, S.R * 1.4)),
        scaleContract: paintedParticlePixels(displayPixels),
        lifeMs: 440,
        additive: element !== "physical",
      });
      if (audit.__ddV6GAnchorCapture) {
        audit.__ddV6GAnchorEvents ??= [];
        audit.__ddV6GAnchorEvents.push({
          kind: "painted-impact",
          weaponId,
          anchor: partition.anchor,
          x: ox,
          y: oy,
          targetX,
          targetY,
          pack,
          count,
          spawned,
        });
      }
    };
    const activeSeconds = Math.max(0, swing.activeEndSeconds - swing.activeStartSeconds);
    const followSeconds = Math.min(
      Math.max(0, swing.poseSeconds - swing.activeEndSeconds),
      Math.max(0.035, Math.min(0.09, activeSeconds * 0.22)),
    );
    const ribbonOnly = Object.entries(S.suite).every(
      ([id, layer]) => !layer.on || PER_LAYER_IDS.has(id),
    );
    const renderSeconds = ribbonOnly
      ? Math.min(swing.poseSeconds, swing.activeEndSeconds + followSeconds)
      : swing.poseSeconds;
    const endPhase = swing.poseSeconds > 0 ? Math.min(1, renderSeconds / swing.poseSeconds) : 1;
    surf.activeTween = this.scene.tweens.addCounter({
      from: 0,
      to: endPhase,
      // §44 authored + fallback suites share the SAME effective-cooldown window as the rig. Layer phase
      // authoring is unchanged; only the tween time base replaces the former fixed 470ms playback.
      duration: Math.max(1, renderSeconds * 1000),
      onUpdate: (tw) => {
        if (surf.generation !== generation) return;
        const p = tw.getValue() ?? 0;
        S.gfxAdd?.clear();
        VR.renderHero(this.scene, S, p);
        VR.renderLayers(S, p, "all", 1);
      },
      onComplete: () => {
        if (surf.generation !== generation) return;
        surf.activeTween = undefined;
        S.gfxAdd?.clear();
        const per = perRuntime(S);
        per.perBody?.setVisible(false);
        per.perLip?.setVisible(false);
        (S.heroImg as Phaser.GameObjects.Image | undefined)?.setVisible(false);
        const release = (): void => {
          if (surf.generation !== generation) return;
          surf.releaseEvent = undefined;
          const emitters = S as unknown as Record<string, { killAll(): unknown } | undefined>;
          for (const key of ["eSpark", "eEmber", "eSoftAdd", "eSoftNorm", "eStreak", "eScatter"])
            emitters[key]?.killAll();
          surf.container.setVisible(false);
          surf.busy = false;
        };
        // A particle-free PER swing returns to the pool at descriptor follow-through. Only an emitter that
        // actually exploded earns the legacy tail delay; pressure steals still cancel either owner safely.
        if (per.perLongTailFired)
          surf.releaseEvent = this.scene.time.delayedCall(PARTICLE_TAIL_MS, release);
        else release();
      },
    });
  }
}
