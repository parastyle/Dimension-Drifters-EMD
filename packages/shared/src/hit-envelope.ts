/**
 * V7-HIT VFX-COLLISION LAW.
 *
 * Every energetic, damage-bearing silhouette is authored or resolved here. The authoritative server and
 * presentation clients must consume this module; neither side may repeat a geometry number in a local
 * recipe or hit test. Decorative smoke, trails, anticipation, and impact punctuation are not damage
 * silhouettes and may remain outside the envelope.
 */

import { BEAM_MAX_RANGE, BEAM_MAX_WIDTH, PROJECTILE_RADIUS } from "./constants.js";
import {
  bladeAngleAt,
  MELEE_BLADE_HALFWIDTH,
  meleeComboSelectionFor,
  type SwingDescriptor,
} from "./melee.js";
import {
  MELEE_TWO_HAND_GRIP_REACH,
  meleeReach,
  type WeaponDef,
  weaponCollisionLength,
} from "./weapons.js";

/** Standing agreement tolerance for rendered damage bounds versus authoritative hit bounds. */
export const HIT_ENVELOPE_TOLERANCE_PX = 1;

export type ProjectileEnvelopeDelivery = "gun" | "cast" | "thrown" | "scatter";

/** A projectile body is a velocity-aligned capsule. `halfLength=0` is the legacy swept circle. */
export interface ProjectileBodyEnvelopeAuthoring {
  readonly radius: number;
  readonly halfLength?: number;
}

export interface BladeExtensionEnvelopeAuthoring {
  /** Complete magic+physical blade length divided by physical blade length. */
  readonly lengthMultiplier: number;
  /** Fraction of the physical blade hidden beneath the magic blade's root. */
  readonly overlapFraction: number;
}

export interface WeaponHitEnvelopeAuthoring {
  readonly melee?: {
    /** Static image-owned segment reach from the wielder root. Does not mutate WeaponDef.range. */
    readonly reach?: number;
    readonly halfWidth?: number;
    readonly bladeExtension?: BladeExtensionEnvelopeAuthoring;
  };
  readonly projectiles?: Partial<
    Readonly<Record<ProjectileEnvelopeDelivery, ProjectileBodyEnvelopeAuthoring>>
  >;
}

/** Optional per-weapon authoring seam for new melee and projectile silhouettes. Existing canonical beam,
 * zone, aura, quake, warp, and explosion geometry already lives on `WeaponDef` and is resolved below. */
declare module "./weapons.js" {
  interface WeaponDef {
    hitEnvelope?: WeaponHitEnvelopeAuthoring;
  }
}

export const BRUTALIST_GREATSWORD_IDS = Object.freeze([
  "x2-rimewrit-grave-slab",
  "x2-pyre-gallows-brand",
  "x2-stormrail-colossus",
  "x2-nullwake-ordinance",
  "x2-dawnwall-testament",
  "x2-cairnfall-monolith",
] as const);
export type BrutalistGreatswordId = (typeof BRUTALIST_GREATSWORD_IDS)[number];
export const MIRAGE_HARDLIGHT_SABER_ID = "x2-mirage-hardlight-saber" as const;
export const BLADE_EXTENSION_WEAPON_IDS = Object.freeze([
  ...BRUTALIST_GREATSWORD_IDS,
  MIRAGE_HARDLIGHT_SABER_ID,
] as const);
export type BladeExtensionWeaponId = (typeof BLADE_EXTENSION_WEAPON_IDS)[number];

export const BLADE_EXTENSION_LENGTH_MULTIPLIER = 3;
export const BLADE_EXTENSION_OVERLAP_FRACTION = 0.3;
/** Owner-ruled per-combo lightsaber ignition: a short, readable ~100 ms local-axis rise. */
export const BLADE_EXTENSION_IGNITION_SECONDS = 0.1;
/** Presentation-only retraction after the accepted combo lifetime lapses. */
export const BLADE_EXTENSION_RETRACTION_SECONDS = 0.09;

/** B11 generated-image silhouettes. These values size both the client art and server collision contract. */
export const DUSTREAPER_FIRE_DRAGON_REACH = 300;
export const DUSTREAPER_FIRE_DRAGON_HALF_WIDTH = 54;
export const MESA_HEART_CRYSTAL_FRAGMENT_RADIUS = 58;
export const ARCANIST_LANCE_PROJECTILE_RADIUS = 17;
export const ARCANIST_LANCE_PROJECTILE_HALF_LENGTH = 55;

function extensionAuthoring(): Readonly<WeaponHitEnvelopeAuthoring> {
  return Object.freeze({
    melee: Object.freeze({
      bladeExtension: Object.freeze({
        lengthMultiplier: BLADE_EXTENSION_LENGTH_MULTIPLIER,
        overlapFraction: BLADE_EXTENSION_OVERLAP_FRACTION,
      }),
    }),
  });
}

/** Migration overrides for the visual-only extensions named by the owner. New weapon definitions
 * should author `hitEnvelope` beside their other shared weapon geometry. */
export const LEGACY_WEAPON_HIT_ENVELOPE_OVERRIDES: Readonly<
  Partial<Record<string, Readonly<WeaponHitEnvelopeAuthoring>>>
> = Object.freeze({
  "x2-rimewrit-grave-slab": extensionAuthoring(),
  "x2-pyre-gallows-brand": extensionAuthoring(),
  "x2-stormrail-colossus": extensionAuthoring(),
  "x2-nullwake-ordinance": extensionAuthoring(),
  "x2-dawnwall-testament": extensionAuthoring(),
  "x2-cairnfall-monolith": extensionAuthoring(),
  "x2-mirage-hardlight-saber": extensionAuthoring(),
  "x2-dustreaper-zweihander": Object.freeze({
    melee: Object.freeze({
      reach: DUSTREAPER_FIRE_DRAGON_REACH,
      halfWidth: DUSTREAPER_FIRE_DRAGON_HALF_WIDTH,
    }),
  }),
  "x2-mesa-heart-geodes": Object.freeze({
    melee: Object.freeze({
      halfWidth: MESA_HEART_CRYSTAL_FRAGMENT_RADIUS,
    }),
  }),
  "x-staff-arcane-lance": Object.freeze({
    projectiles: Object.freeze({
      cast: Object.freeze({
        radius: ARCANIST_LANCE_PROJECTILE_RADIUS,
        halfLength: ARCANIST_LANCE_PROJECTILE_HALF_LENGTH,
      }),
    }),
  }),
});

export function weaponHitEnvelopeAuthoringFor(
  weapon: WeaponDef,
): Readonly<WeaponHitEnvelopeAuthoring> | undefined {
  return weapon.hitEnvelope ?? LEGACY_WEAPON_HIT_ENVELOPE_OVERRIDES[weapon.id];
}

/**
 * A visual envelope whose reveal is driven by a combo step must use that same step on the server.
 * Legacy extension weapons predate `authoritativeCombo`, so the law promotes them without mutating
 * generated weapon data.
 */
export function weaponUsesAuthoritativeEnvelopeCombo(weapon: WeaponDef): boolean {
  return (
    weapon.authoritativeCombo === true ||
    weaponHitEnvelopeAuthoringFor(weapon)?.melee?.bladeExtension !== undefined
  );
}

export interface BladeExtensionGeometry {
  readonly physicalBladeLength: number;
  readonly totalBladeLength: number;
  readonly extensionLength: number;
  readonly extensionStart: number;
  readonly overlapLength: number;
  readonly fullTipReach: number;
}

export interface BladeExtensionPose {
  readonly angle: number;
  /** Perspective/edge-on shortening applied to the complete blade beyond its grip. */
  readonly lengthScale: number;
}

const smoothstep01 = (value: number): number => {
  const p = Math.max(0, Math.min(1, value));
  return p * p * (3 - 2 * p);
};

/**
 * Shared damaging pose for the flagship extensions. The three momentum motions were originally local
 * SpriteRig presentation; expressing their exact edge angle and foreshortening here lets both the attached
 * extension and the authoritative sweep consume one silhouette clock.
 */
export function bladeExtensionPoseAt(
  weapon: WeaponDef,
  swing: Pick<
    SwingDescriptor,
    "activeStartSeconds" | "activeEndSeconds" | "poseSeconds" | "motion"
  >,
  elapsedSeconds: number,
  aimAngle: number,
): BladeExtensionPose | undefined {
  if (!bladeExtensionGeometryFor(weapon)) return undefined;
  const t = Math.max(0, elapsedSeconds / Math.max(1e-9, swing.poseSeconds));
  if (swing.motion === "falling-gate") {
    const coil = aimAngle - 1.15;
    const contact = aimAngle + 0.8;
    const guard = aimAngle - Math.PI / 15;
    let angle: number;
    if (t < 0.22) {
      const e = Math.max(0, Math.min(1, t / 0.22));
      angle = aimAngle - 0.62 + (coil - (aimAngle - 0.62)) * (e * (2 - e));
    } else if (t < 0.5) {
      const p = Math.max(0, Math.min(1, (t - 0.22) / 0.28));
      angle = coil + (contact - coil) * p * p;
    } else if (t < 0.78) {
      angle = contact + (guard - contact) * smoothstep01((t - 0.5) / 0.28);
    } else angle = guard;
    return Object.freeze({ angle, lengthScale: 1 });
  }
  if (swing.motion === "backswing-wheel") {
    const start = aimAngle + 0.96;
    const finish = aimAngle + 4.45;
    let wheel: number;
    let angle: number;
    if (t < 0.1) {
      wheel = 0;
      angle = start + 0.08 * smoothstep01(t / 0.1);
    } else if (t < 0.44) {
      wheel = smoothstep01((t - 0.1) / 0.34);
      angle = start + (finish - start) * wheel;
    } else if (t < 0.77) {
      wheel = 1;
      angle = finish + 0.18 * Math.sin(Math.PI * smoothstep01((t - 0.44) / 0.33));
    } else {
      wheel = 1;
      angle = finish;
    }
    return Object.freeze({
      angle,
      lengthScale: Math.max(0.24, Math.abs(Math.cos(Math.PI * wheel))),
    });
  }
  if (swing.motion === "runaway-cleave") {
    const start = aimAngle - 1.83;
    let angle: number;
    if (t < 0.26) angle = start - 0.17 * smoothstep01(t / 0.26);
    else if (t < 0.54) {
      const p = Math.max(0, Math.min(1, (t - 0.26) / 0.28));
      angle = start - 0.17 + 3.65 * p * p;
    } else if (t < 0.64) angle = start + 3.48 + 0.45 * smoothstep01((t - 0.54) / 0.1);
    else if (t < 0.86) angle = start + 3.93 + 0.3 * smoothstep01((t - 0.64) / 0.22);
    else angle = start + 4.23;
    const projected = Math.hypot(Math.cos(angle), Math.sin(angle) * 0.34);
    const recoil = t >= 0.54 && t < 0.66 ? Math.sin(((t - 0.54) / 0.12) * Math.PI) : 0;
    return Object.freeze({ angle, lengthScale: projected * (1 + 0.05 * recoil) });
  }
  const activeSeconds = swing.activeEndSeconds - swing.activeStartSeconds;
  const progress =
    activeSeconds <= 0
      ? elapsedSeconds >= swing.activeEndSeconds
        ? 1
        : 0
      : Math.max(0, Math.min(1, (elapsedSeconds - swing.activeStartSeconds) / activeSeconds));
  return Object.freeze({
    angle: bladeAngleAt(aimAngle, weapon.swingArc, progress),
    lengthScale: 1,
  });
}

/** Exact geometry used to size the client image and extend the server swept blade. */
export function bladeExtensionGeometryFor(
  weapon: WeaponDef,
  renderScale = 1,
): BladeExtensionGeometry | undefined {
  const extension = weaponHitEnvelopeAuthoringFor(weapon)?.melee?.bladeExtension;
  if (!extension) return undefined;
  const scale = Math.max(0, Number.isFinite(renderScale) ? renderScale : 1);
  const physicalBladeLength =
    Math.max(1, (1 - weapon.gripFrac) * weaponCollisionLength(weapon)) * scale;
  const totalBladeLength = physicalBladeLength * Math.max(1, extension.lengthMultiplier);
  const overlapLength = physicalBladeLength * Math.max(0, Math.min(1, extension.overlapFraction));
  const extensionLength = totalBladeLength - physicalBladeLength + overlapLength;
  const gripReach = (weapon.twoHanded ? MELEE_TWO_HAND_GRIP_REACH : 0) * scale;
  const extensionStart = gripReach + physicalBladeLength - overlapLength;
  return Object.freeze({
    physicalBladeLength,
    totalBladeLength,
    extensionLength,
    extensionStart,
    overlapLength,
    fullTipReach: extensionStart + extensionLength,
  });
}

/** Pure local-axis ignition curve shared by presentation and authoritative emergence reach. */
export function bladeExtensionIgnitionReveal(elapsedSeconds: number): number {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return 0;
  if (elapsedSeconds >= BLADE_EXTENSION_IGNITION_SECONDS) return 1;
  return smoothstep01(elapsedSeconds / BLADE_EXTENSION_IGNITION_SECONDS);
}

/**
 * Per-combo reveal clock for authoritative reach. Step zero rises once from combo acceptance; later accepted
 * steps are already fully lit. Combo expiry/retraction belongs to the retained wielder identity on the client,
 * because a standalone swing descriptor cannot know whether another accepted beat will continue the chain.
 */
export function bladeExtensionReveal(
  weapon: WeaponDef,
  swing: Pick<SwingDescriptor, "activeStartSeconds" | "activeEndSeconds" | "comboStep" | "motion">,
  elapsedSeconds: number,
): number {
  const extension = weaponHitEnvelopeAuthoringFor(weapon)?.melee?.bladeExtension;
  if (!extension) return 0;
  if (swing.comboStep !== undefined)
    return swing.comboStep === 0 ? bladeExtensionIgnitionReveal(elapsedSeconds) : 1;
  const sequence = meleeComboSelectionFor(weapon)?.sequence;
  const motionIndex = swing.motion
    ? sequence?.findIndex((step) => step.motion === swing.motion)
    : -1;
  return (motionIndex ?? -1) > 0 ? 1 : bladeExtensionIgnitionReveal(elapsedSeconds);
}

export interface MeleeDamageEnvelope {
  readonly baseReach: number;
  readonly maxReach: number;
  readonly baseHalfWidth: number;
  readonly maxHalfWidth: number;
  readonly sweepArc: number;
  readonly bladeExtension?: BladeExtensionGeometry;
}

export function meleeDamageEnvelopeFor(weapon: WeaponDef, renderScale = 1): MeleeDamageEnvelope {
  const authoring = weaponHitEnvelopeAuthoringFor(weapon)?.melee;
  const baseReach = meleeReach(weapon, renderScale);
  const baseHalfWidth =
    Math.max(0, authoring?.halfWidth ?? MELEE_BLADE_HALFWIDTH) * Math.max(0, renderScale);
  const imageReach = Math.max(0, authoring?.reach ?? 0) * Math.max(0, renderScale);
  const bladeExtension = bladeExtensionGeometryFor(weapon, renderScale);
  return Object.freeze({
    baseReach,
    maxReach: Math.max(baseReach, imageReach, bladeExtension?.fullTipReach ?? 0),
    baseHalfWidth,
    // Extension presentation measures the held blade's alpha silhouette at its join. Shared combat has no
    // sprite pixels, so width remains the existing blade edge rather than reintroducing an authored ratio.
    maxHalfWidth: baseHalfWidth,
    sweepArc: weapon.swingArc,
    bladeExtension,
  });
}

/** Timed radial extent of the rendered/damaging blade. */
export function meleeDamageReachAt(
  weapon: WeaponDef,
  swing: Pick<
    SwingDescriptor,
    "activeStartSeconds" | "activeEndSeconds" | "poseSeconds" | "motion"
  >,
  elapsedSeconds: number,
  renderScale = 1,
): number {
  const reveal = bladeExtensionReveal(weapon, swing, elapsedSeconds);
  const lengthScale = bladeExtensionPoseAt(weapon, swing, elapsedSeconds, 0)?.lengthScale ?? 1;
  return bladeExtensionDamageReachForReveal(weapon, reveal, renderScale, lengthScale);
}

/** Resolve the exact authoritative radial reach from an already-sampled extension reveal. Presentation
 * consumers that own a retained combo clock use this seam instead of repeating the server geometry law. */
export function bladeExtensionDamageReachForReveal(
  weapon: WeaponDef,
  reveal: number,
  renderScale = 1,
  lengthScale = 1,
): number {
  const envelope = meleeDamageEnvelopeFor(weapon, renderScale);
  const extension = envelope.bladeExtension;
  const imageReach =
    Math.max(0, weaponHitEnvelopeAuthoringFor(weapon)?.melee?.reach ?? 0) *
    Math.max(0, renderScale);
  const staticReach = Math.max(envelope.baseReach, imageReach);
  if (!extension) return staticReach;
  const gripReach = extension.fullTipReach - extension.totalBladeLength;
  const emergedLength = extension.totalBladeLength - extension.physicalBladeLength;
  return Math.max(
    staticReach,
    gripReach +
      (extension.physicalBladeLength + emergedLength * Math.max(0, Math.min(1, reveal))) *
        Math.max(0, lengthScale),
  );
}

/** Timed half-thickness of the rendered/damaging blade. */
export function meleeDamageHalfWidthAt(
  weapon: WeaponDef,
  _swing: Pick<
    SwingDescriptor,
    "activeStartSeconds" | "activeEndSeconds" | "poseSeconds" | "motion"
  >,
  _elapsedSeconds: number,
  renderScale = 1,
): number {
  const envelope = meleeDamageEnvelopeFor(weapon, renderScale);
  return envelope.maxHalfWidth;
}

export interface ProjectileDamageEnvelope {
  readonly shape: "capsule";
  readonly radius: number;
  readonly halfLength: number;
}

export function projectileDamageEnvelopeFor(
  weapon: WeaponDef,
  delivery: ProjectileEnvelopeDelivery,
): ProjectileDamageEnvelope {
  const authored = weaponHitEnvelopeAuthoringFor(weapon)?.projectiles?.[delivery];
  return Object.freeze({
    shape: "capsule",
    radius: Math.max(0, authored?.radius ?? PROJECTILE_RADIUS),
    halfLength: Math.max(0, authored?.halfLength ?? 0),
  });
}

export interface BeamDamageEnvelope {
  readonly range: number;
  readonly width: number;
  readonly halfWidth: number;
  readonly coneHalfAngle: number;
}

export function beamDamageEnvelopeFor(weapon: WeaponDef): BeamDamageEnvelope | undefined {
  const beam = weapon.beam;
  if (!beam) return undefined;
  const width = Math.min(BEAM_MAX_WIDTH, Math.max(1, beam.width));
  return Object.freeze({
    range: Math.min(BEAM_MAX_RANGE, Math.max(1, beam.range)),
    width,
    halfWidth: width / 2,
    coneHalfAngle: beam.coneStream ? Math.min(0.9, Math.max(0.08, beam.coneStream.halfAngle)) : 0,
  });
}

export interface RadialDamageEnvelope {
  readonly radius: number;
}

export interface GrowingRadialDamageEnvelope {
  readonly initialRadius: number;
  readonly maxRadius: number;
}

export interface WeaponDamageEnvelope {
  readonly weaponId: string;
  readonly melee?: MeleeDamageEnvelope;
  readonly projectiles: Readonly<
    Partial<Record<ProjectileEnvelopeDelivery, ProjectileDamageEnvelope>>
  >;
  readonly beam?: BeamDamageEnvelope;
  readonly groundZone?: GrowingRadialDamageEnvelope;
  readonly aura?: RadialDamageEnvelope;
  readonly quake?: RadialDamageEnvelope;
  readonly warp?: RadialDamageEnvelope;
  readonly gunExplosion?: RadialDamageEnvelope;
  readonly scatterExplosion?: RadialDamageEnvelope;
  readonly katanaFinisherBurst?: RadialDamageEnvelope;
}

/** The complete canonical collision contract for one weapon. Consumers may select a source from this
 * object, but must not substitute recipe-local dimensions. */
export function weaponDamageEnvelopeFor(weapon: WeaponDef): WeaponDamageEnvelope {
  const projectiles: Partial<Record<ProjectileEnvelopeDelivery, ProjectileDamageEnvelope>> = {};
  if (weapon.gun) projectiles.gun = projectileDamageEnvelopeFor(weapon, "gun");
  if (weapon.cast) projectiles.cast = projectileDamageEnvelopeFor(weapon, "cast");
  if (weapon.thrown) projectiles.thrown = projectileDamageEnvelopeFor(weapon, "thrown");
  if (weapon.scatter) projectiles.scatter = projectileDamageEnvelopeFor(weapon, "scatter");
  const hasPrimaryMelee =
    !weapon.gun &&
    !weapon.cast &&
    !weapon.thrown &&
    !weapon.beam &&
    weapon.groundZone?.trigger !== "channel";
  return Object.freeze({
    weaponId: weapon.id,
    melee: hasPrimaryMelee ? meleeDamageEnvelopeFor(weapon) : undefined,
    projectiles: Object.freeze(projectiles),
    beam: beamDamageEnvelopeFor(weapon),
    groundZone: weapon.groundZone
      ? Object.freeze({
          initialRadius: Math.max(0, weapon.groundZone.initialRadius),
          maxRadius: Math.max(0, weapon.groundZone.maxRadius),
        })
      : undefined,
    aura: weapon.performance?.aura
      ? Object.freeze({ radius: Math.max(0, weapon.performance.aura.radius) })
      : undefined,
    quake: weapon.quake ? Object.freeze({ radius: Math.max(0, weapon.quake.radius) }) : undefined,
    warp: weapon.warp ? Object.freeze({ radius: Math.max(0, weapon.warp.burstRadius) }) : undefined,
    gunExplosion: weapon.gun?.explode
      ? Object.freeze({ radius: Math.max(0, weapon.gun.explode.radius) })
      : undefined,
    scatterExplosion: weapon.scatter?.explode
      ? Object.freeze({ radius: Math.max(0, weapon.scatter.explode.radius) })
      : undefined,
    katanaFinisherBurst: weapon.katanaHook?.finisherBurst
      ? Object.freeze({ radius: Math.max(0, weapon.katanaHook.finisherBurst.radius) })
      : undefined,
  });
}

export function hitEnvelopeExtentsAgree(
  visualExtent: number,
  serverExtent: number,
  tolerance = HIT_ENVELOPE_TOLERANCE_PX,
): boolean {
  return (
    Number.isFinite(visualExtent) &&
    Number.isFinite(serverExtent) &&
    Math.abs(visualExtent - serverExtent) <= Math.max(0, tolerance)
  );
}
