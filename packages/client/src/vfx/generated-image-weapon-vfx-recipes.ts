import { meleeDamageEnvelopeFor, projectileDamageEnvelopeFor, type WeaponDef } from "@dd/shared";
import type { WeaponBladeAttachmentPose } from "../entities/SpriteRig.js";
import {
  WEAPON_VFX,
  type WeaponVfxGeneratedImageFanTornado,
  type WeaponVfxGeneratedImageKind,
  type WeaponVfxGeneratedImageReplacement,
} from "./weapon-vfx.generated.js";

/** B11 replacements remain a closed catalog so their no-procedural-fallback contract cannot broaden. */
export const GENERATED_IMAGE_WEAPON_VFX_IDS = Object.freeze([
  "x2-dustreaper-zweihander",
  "x2-mesa-heart-geodes",
  "x-staff-arcane-lance",
] as const);

export const FAN_TORNADO_WEAPON_VFX_IDS = Object.freeze([
  "x2-iron-war-fan",
  "x2-ember-fan",
  "x2-storm-fan",
] as const);

export type B11GeneratedImageWeaponVfxId = (typeof GENERATED_IMAGE_WEAPON_VFX_IDS)[number];
export type FanTornadoWeaponVfxId = (typeof FAN_TORNADO_WEAPON_VFX_IDS)[number];
export type GeneratedImageWeaponVfxId = B11GeneratedImageWeaponVfxId | FanTornadoWeaponVfxId;

export type B11GeneratedImageWeaponVfxRecipe = Readonly<
  WeaponVfxGeneratedImageReplacement & {
    readonly weaponId: B11GeneratedImageWeaponVfxId;
  }
>;
export type FanTornadoWeaponVfxRecipe = Readonly<
  WeaponVfxGeneratedImageFanTornado & { readonly weaponId: FanTornadoWeaponVfxId }
>;
export type GeneratedImageWeaponVfxRecipe =
  | B11GeneratedImageWeaponVfxRecipe
  | FanTornadoWeaponVfxRecipe;

export interface GeneratedImageMeleeGeometry {
  readonly forwardExtent: number;
  readonly halfWidth: number;
}

export interface GeneratedImageHeldBladeOverlayTransform {
  readonly rootX: number;
  readonly rootY: number;
  readonly tipX: number;
  readonly tipY: number;
  readonly angle: number;
  readonly displayLength: number;
  readonly displayWidth: number;
  readonly normalSign: -1 | 1;
  readonly depth: number;
}

export interface GeneratedImageProjectileGeometry {
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly tipExtent: number;
}

export interface FanTornadoProjectileGeometry {
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly damageWidth: number;
  readonly damageHeight: number;
  readonly orientation: "upright";
}

const EXPECTED_KIND: Readonly<Record<GeneratedImageWeaponVfxId, WeaponVfxGeneratedImageKind>> =
  Object.freeze({
    "x2-dustreaper-zweihander": "fire-dragon-sweep",
    "x2-mesa-heart-geodes": "purple-crystal-burst",
    "x-staff-arcane-lance": "arcane-lance-projectile",
    "x2-iron-war-fan": "fan-tornado",
    "x2-ember-fan": "fan-tornado",
    "x2-storm-fan": "fan-tornado",
  });

function requiredRecipe(weaponId: B11GeneratedImageWeaponVfxId): B11GeneratedImageWeaponVfxRecipe;
function requiredRecipe(weaponId: FanTornadoWeaponVfxId): FanTornadoWeaponVfxRecipe;
function requiredRecipe(weaponId: GeneratedImageWeaponVfxId): GeneratedImageWeaponVfxRecipe {
  const treatment = WEAPON_VFX[weaponId]?.generatedImage;
  const expectedKind = EXPECTED_KIND[weaponId];
  if (!treatment || treatment.kind !== expectedKind)
    throw new Error(
      `Missing B11 generated-image VFX recipe for ${weaponId}; expected ${expectedKind}`,
    );
  return Object.freeze({ weaponId, ...treatment }) as GeneratedImageWeaponVfxRecipe;
}

/** B11's authoritative generated-image catalog. No entry is allowed to resolve a procedural fallback. */
export const GENERATED_IMAGE_WEAPON_VFX_RECIPES: Readonly<
  Record<B11GeneratedImageWeaponVfxId, B11GeneratedImageWeaponVfxRecipe>
> = Object.freeze({
  "x2-dustreaper-zweihander": requiredRecipe("x2-dustreaper-zweihander"),
  "x2-mesa-heart-geodes": requiredRecipe("x2-mesa-heart-geodes"),
  "x-staff-arcane-lance": requiredRecipe("x-staff-arcane-lance"),
});

/** B22 replaces every other fan effect with one generated-image authoritative projectile. */
export const FAN_TORNADO_WEAPON_VFX_RECIPES: Readonly<
  Record<FanTornadoWeaponVfxId, FanTornadoWeaponVfxRecipe>
> = Object.freeze({
  "x2-iron-war-fan": requiredRecipe("x2-iron-war-fan"),
  "x2-ember-fan": requiredRecipe("x2-ember-fan"),
  "x2-storm-fan": requiredRecipe("x2-storm-fan"),
});

const ALL_GENERATED_IMAGE_WEAPON_VFX_RECIPES: Readonly<
  Partial<Record<GeneratedImageWeaponVfxId, GeneratedImageWeaponVfxRecipe>>
> = Object.freeze({
  ...GENERATED_IMAGE_WEAPON_VFX_RECIPES,
  ...FAN_TORNADO_WEAPON_VFX_RECIPES,
});

export function resolveGeneratedImageWeaponVfxRecipe(
  weaponId: string | undefined,
): GeneratedImageWeaponVfxRecipe | undefined {
  if (!weaponId) return undefined;
  return ALL_GENERATED_IMAGE_WEAPON_VFX_RECIPES[weaponId as GeneratedImageWeaponVfxId];
}

export function generatedImageVfxReplacesProceduralRecipe(weaponId: string | undefined): boolean {
  return !!weaponId && Object.hasOwn(ALL_GENERATED_IMAGE_WEAPON_VFX_RECIPES, weaponId);
}

export function generatedImageWeaponAudioCue(weaponId: string | undefined): string | undefined {
  return resolveGeneratedImageWeaponVfxRecipe(weaponId)?.audioCue;
}

/** Shared B22 WYSIWYG geometry. Client size and server damage both consume the hybrid envelope. */
export function fanTornadoProjectileGeometryFor(
  weapon: WeaponDef,
): FanTornadoProjectileGeometry | undefined {
  const recipe = resolveGeneratedImageWeaponVfxRecipe(weapon.id);
  if (recipe?.kind !== "fan-tornado" || weapon.hybridProjectile?.style !== "tornado")
    return undefined;
  const envelope = projectileDamageEnvelopeFor(weapon, "hybrid");
  if (envelope.orientation !== "upright") return undefined;
  const displayWidth = envelope.radius * 2;
  const displayHeight = (envelope.radius + envelope.halfLength) * 2;
  return Object.freeze({
    displayWidth,
    displayHeight,
    damageWidth: displayWidth,
    damageHeight: displayHeight,
    orientation: "upright",
  });
}

export function generatedImageMeleeGeometryFor(
  weapon: WeaponDef,
): GeneratedImageMeleeGeometry | undefined {
  const recipe = resolveGeneratedImageWeaponVfxRecipe(weapon.id);
  if (!recipe || recipe.kind === "arcane-lance-projectile" || recipe.kind === "fan-tornado")
    return undefined;
  const envelope = meleeDamageEnvelopeFor(weapon);
  return Object.freeze({
    forwardExtent: envelope.maxReach,
    halfWidth: envelope.maxHalfWidth,
  });
}

/**
 * Register generated art in the exact final held-blade basis used by blade extensions. A multiplier of
 * one starts at the physical blade root and ends at its tip, so the art cannot imply extra reach.
 */
export function generatedImageHeldBladeOverlayTransform(
  pose: Pick<
    WeaponBladeAttachmentPose,
    | "x"
    | "y"
    | "angle"
    | "axisX"
    | "axisY"
    | "normalX"
    | "normalY"
    | "physicalBladeLength"
    | "bladeWidth"
    | "depth"
  >,
  recipe: Pick<GeneratedImageWeaponVfxRecipe, "bladeOverlay">,
): GeneratedImageHeldBladeOverlayTransform | undefined {
  const overlay = recipe.bladeOverlay;
  if (!overlay) return undefined;
  const displayLength = Math.max(1, pose.physicalBladeLength * overlay.lengthMultiplier);
  const displayWidth = Math.max(1, pose.bladeWidth * overlay.widthMultiplier);
  const determinant = pose.axisX * pose.normalY - pose.axisY * pose.normalX;
  return Object.freeze({
    rootX: pose.x - pose.axisX * displayLength,
    rootY: pose.y - pose.axisY * displayLength,
    tipX: pose.x,
    tipY: pose.y,
    angle: pose.angle,
    displayLength,
    displayWidth,
    normalSign: determinant < 0 ? -1 : 1,
    depth: pose.depth + 1,
  });
}

export function generatedImageProjectileGeometryFor(
  weapon: WeaponDef,
): GeneratedImageProjectileGeometry | undefined {
  const recipe = resolveGeneratedImageWeaponVfxRecipe(weapon.id);
  if (recipe?.kind !== "arcane-lance-projectile" || !weapon.cast) return undefined;
  const envelope = projectileDamageEnvelopeFor(weapon, "cast");
  const tipExtent = envelope.halfLength + envelope.radius;
  return Object.freeze({
    displayWidth: tipExtent * 2,
    displayHeight: envelope.radius * 2,
    tipExtent,
  });
}
