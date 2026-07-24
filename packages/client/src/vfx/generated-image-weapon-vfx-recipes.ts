import { meleeDamageEnvelopeFor, projectileDamageEnvelopeFor, type WeaponDef } from "@dd/shared";
import {
  WEAPON_VFX,
  type WeaponVfxGeneratedImage,
  type WeaponVfxGeneratedImageKind,
} from "./weapon-vfx.generated.js";

export const GENERATED_IMAGE_WEAPON_VFX_IDS = Object.freeze([
  "x2-dustreaper-zweihander",
  "x2-mesa-heart-geodes",
  "x-staff-arcane-lance",
] as const);

export type GeneratedImageWeaponVfxId = (typeof GENERATED_IMAGE_WEAPON_VFX_IDS)[number];

export interface GeneratedImageWeaponVfxRecipe extends WeaponVfxGeneratedImage {
  readonly weaponId: GeneratedImageWeaponVfxId;
}

export interface GeneratedImageMeleeGeometry {
  readonly forwardExtent: number;
  readonly halfWidth: number;
}

export interface GeneratedImageProjectileGeometry {
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly tipExtent: number;
}

const EXPECTED_KIND: Readonly<Record<GeneratedImageWeaponVfxId, WeaponVfxGeneratedImageKind>> =
  Object.freeze({
    "x2-dustreaper-zweihander": "fire-dragon-sweep",
    "x2-mesa-heart-geodes": "purple-crystal-burst",
    "x-staff-arcane-lance": "arcane-lance-projectile",
  });

function requiredRecipe(weaponId: GeneratedImageWeaponVfxId): GeneratedImageWeaponVfxRecipe {
  const treatment = WEAPON_VFX[weaponId]?.generatedImage;
  const expectedKind = EXPECTED_KIND[weaponId];
  if (!treatment || treatment.kind !== expectedKind)
    throw new Error(
      `Missing B11 generated-image VFX recipe for ${weaponId}; expected ${expectedKind}`,
    );
  return Object.freeze({ weaponId, ...treatment });
}

/** B11's authoritative generated-image catalog. No entry is allowed to resolve a procedural fallback. */
export const GENERATED_IMAGE_WEAPON_VFX_RECIPES: Readonly<
  Record<GeneratedImageWeaponVfxId, GeneratedImageWeaponVfxRecipe>
> = Object.freeze({
  "x2-dustreaper-zweihander": requiredRecipe("x2-dustreaper-zweihander"),
  "x2-mesa-heart-geodes": requiredRecipe("x2-mesa-heart-geodes"),
  "x-staff-arcane-lance": requiredRecipe("x-staff-arcane-lance"),
});

export function resolveGeneratedImageWeaponVfxRecipe(
  weaponId: string | undefined,
): GeneratedImageWeaponVfxRecipe | undefined {
  if (!weaponId) return undefined;
  return GENERATED_IMAGE_WEAPON_VFX_RECIPES[
    weaponId as keyof typeof GENERATED_IMAGE_WEAPON_VFX_RECIPES
  ];
}

export function generatedImageVfxReplacesProceduralRecipe(weaponId: string | undefined): boolean {
  return resolveGeneratedImageWeaponVfxRecipe(weaponId) !== undefined;
}

export function generatedImageWeaponAudioCue(weaponId: string | undefined): string | undefined {
  return resolveGeneratedImageWeaponVfxRecipe(weaponId)?.audioCue;
}

export function generatedImageMeleeGeometryFor(
  weapon: WeaponDef,
): GeneratedImageMeleeGeometry | undefined {
  const recipe = resolveGeneratedImageWeaponVfxRecipe(weapon.id);
  if (!recipe || recipe.kind === "arcane-lance-projectile") return undefined;
  const envelope = meleeDamageEnvelopeFor(weapon);
  return Object.freeze({
    forwardExtent: envelope.maxReach,
    halfWidth: envelope.maxHalfWidth,
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
