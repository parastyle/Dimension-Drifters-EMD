/**
 * V7-HIT VFX-COLLISION LAW.
 *
 * Every energetic, damage-bearing silhouette is authored or resolved here. The authoritative server and
 * presentation clients must consume this module; neither side may repeat a geometry number in a local
 * recipe or hit test. Decorative smoke, trails, anticipation, and impact punctuation are not damage
 * silhouettes and may remain outside the envelope.
 */

import { BEAM_MAX_RANGE, BEAM_MAX_WIDTH, PROJECTILE_RADIUS } from "./constants.js";
import { bladeAngleAt, MELEE_BLADE_HALFWIDTH, type SwingDescriptor } from "./melee.js";
import { MELEE_TWO_HAND_GRIP_REACH, meleeReach, type WeaponDef } from "./weapons.js";

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
  /** Complete rendered extension thickness divided by physical blade length. */
  readonly thicknessScale: number;
  /** Minimum wind-up growth duration. */
  readonly growMinSeconds: number;
  /** Growth duration as a fraction of the active window, capped by available wind-up. */
  readonly growActiveFraction: number;
}

export interface WeaponHitEnvelopeAuthoring {
  readonly melee?: {
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

export const SANCTIFIED_HEADSMAN_ID = "x2-sanctified-headsman" as const;
export const BRUTALIST_GREATSWORD_IDS = Object.freeze([
  "x2-rimewrit-grave-slab",
  "x2-pyre-gallows-brand",
  "x2-stormrail-colossus",
  "x2-nullwake-ordinance",
  "x2-dawnwall-testament",
  "x2-cairnfall-monolith",
] as const);
export type BrutalistGreatswordId = (typeof BRUTALIST_GREATSWORD_IDS)[number];
export const BLADE_EXTENSION_WEAPON_IDS = Object.freeze([
  SANCTIFIED_HEADSMAN_ID,
  ...BRUTALIST_GREATSWORD_IDS,
] as const);

export const BLADE_EXTENSION_LENGTH_MULTIPLIER = 3;
export const BLADE_EXTENSION_OVERLAP_FRACTION = 0.3;
export const BLADE_EXTENSION_GROW_MIN_SECONDS = 0.08;
export const BLADE_EXTENSION_GROW_ACTIVE_FRACTION = 0.45;

function extensionAuthoring(thicknessScale: number): Readonly<WeaponHitEnvelopeAuthoring> {
  return Object.freeze({
    melee: Object.freeze({
      bladeExtension: Object.freeze({
        lengthMultiplier: BLADE_EXTENSION_LENGTH_MULTIPLIER,
        overlapFraction: BLADE_EXTENSION_OVERLAP_FRACTION,
        thicknessScale,
        growMinSeconds: BLADE_EXTENSION_GROW_MIN_SECONDS,
        growActiveFraction: BLADE_EXTENSION_GROW_ACTIVE_FRACTION,
      }),
    }),
  });
}

/** Migration overrides for the seven visual-only extensions named by the owner. New weapon definitions
 * should author `hitEnvelope` beside their other shared weapon geometry. */
export const LEGACY_WEAPON_HIT_ENVELOPE_OVERRIDES: Readonly<
  Partial<Record<string, Readonly<WeaponHitEnvelopeAuthoring>>>
> = Object.freeze({
  [SANCTIFIED_HEADSMAN_ID]: extensionAuthoring(0.32),
  "x2-rimewrit-grave-slab": extensionAuthoring(0.42),
  "x2-pyre-gallows-brand": extensionAuthoring(0.48),
  "x2-stormrail-colossus": extensionAuthoring(0.38),
  "x2-nullwake-ordinance": extensionAuthoring(0.44),
  "x2-dawnwall-testament": extensionAuthoring(0.4),
  "x2-cairnfall-monolith": extensionAuthoring(0.46),
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
  readonly thickness: number;
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
  const physicalBladeLength = Math.max(1, (1 - weapon.gripFrac) * weapon.displayLength) * scale;
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
    thickness: physicalBladeLength * Math.max(0, extension.thicknessScale),
    fullTipReach: extensionStart + extensionLength,
  });
}

/** One reveal clock for rendering and collision. It grows during late wind-up, holds across the complete
 * active edge, and disappears at the active-window boundary. */
export function bladeExtensionReveal(
  weapon: WeaponDef,
  swing: Pick<SwingDescriptor, "activeStartSeconds" | "activeEndSeconds">,
  elapsedSeconds: number,
): number {
  const extension = weaponHitEnvelopeAuthoringFor(weapon)?.melee?.bladeExtension;
  if (!extension) return 0;
  const activeSeconds = swing.activeEndSeconds - swing.activeStartSeconds;
  if (activeSeconds <= 0 || elapsedSeconds >= swing.activeEndSeconds) return 0;
  const growSeconds = Math.min(
    swing.activeStartSeconds,
    Math.max(extension.growMinSeconds, activeSeconds * extension.growActiveFraction),
  );
  const growStartSeconds = swing.activeStartSeconds - growSeconds;
  if (elapsedSeconds < growStartSeconds) return 0;
  if (elapsedSeconds >= swing.activeStartSeconds || growSeconds <= 0) return 1;
  const progress = (elapsedSeconds - growStartSeconds) / growSeconds;
  return progress * progress * (3 - 2 * progress);
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
  const baseReach = meleeReach(weapon, renderScale);
  const baseHalfWidth =
    Math.max(0, weaponHitEnvelopeAuthoringFor(weapon)?.melee?.halfWidth ?? MELEE_BLADE_HALFWIDTH) *
    Math.max(0, renderScale);
  const bladeExtension = bladeExtensionGeometryFor(weapon, renderScale);
  return Object.freeze({
    baseReach,
    maxReach: Math.max(baseReach, bladeExtension?.fullTipReach ?? 0),
    baseHalfWidth,
    maxHalfWidth: Math.max(baseHalfWidth, (bladeExtension?.thickness ?? 0) / 2),
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
  const envelope = meleeDamageEnvelopeFor(weapon, renderScale);
  const extension = envelope.bladeExtension;
  if (!extension) return envelope.baseReach;
  const reveal = bladeExtensionReveal(weapon, swing, elapsedSeconds);
  const lengthScale = bladeExtensionPoseAt(weapon, swing, elapsedSeconds, 0)?.lengthScale ?? 1;
  const gripReach = extension.fullTipReach - extension.totalBladeLength;
  return Math.max(
    envelope.baseReach,
    gripReach +
      (extension.extensionStart - gripReach + extension.extensionLength * reveal) * lengthScale,
  );
}

/** Timed half-thickness of the rendered/damaging blade. */
export function meleeDamageHalfWidthAt(
  weapon: WeaponDef,
  swing: Pick<
    SwingDescriptor,
    "activeStartSeconds" | "activeEndSeconds" | "poseSeconds" | "motion"
  >,
  elapsedSeconds: number,
  renderScale = 1,
): number {
  const envelope = meleeDamageEnvelopeFor(weapon, renderScale);
  if (!envelope.bladeExtension || bladeExtensionReveal(weapon, swing, elapsedSeconds) <= 0)
    return envelope.baseHalfWidth;
  const lengthScale = bladeExtensionPoseAt(weapon, swing, elapsedSeconds, 0)?.lengthScale ?? 1;
  return Math.max(envelope.baseHalfWidth, (envelope.bladeExtension.thickness / 2) * lengthScale);
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
