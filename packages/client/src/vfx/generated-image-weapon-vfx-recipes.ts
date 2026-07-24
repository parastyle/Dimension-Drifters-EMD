import {
  bladeAngleAt,
  meleeComboSelectionFor,
  meleeDamageEnvelopeFor,
  projectileDamageEnvelopeFor,
  type SwingDescriptor,
  type WeaponDef,
} from "@dd/shared";
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
export type GeneratedImageWeaponVfxId =
  | B11GeneratedImageWeaponVfxId
  | FanTornadoWeaponVfxId;

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

/** B18 supplements the existing fan ribbons/hybrid projectiles; these rows never suppress them. */
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
  return (
    !!weaponId &&
    Object.hasOwn(
      GENERATED_IMAGE_WEAPON_VFX_RECIPES,
      weaponId as B11GeneratedImageWeaponVfxId,
    )
  );
}

export function generatedImageWeaponAudioCue(weaponId: string | undefined): string | undefined {
  return resolveGeneratedImageWeaponVfxRecipe(weaponId)?.audioCue;
}

export interface FanTornadoReleasePlan {
  readonly damageMode: "presentation-only";
  readonly releaseLane: "center" | "lead" | "off";
  readonly releaseProgress: number;
  readonly delayMs: number;
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
  readonly travelPx: number;
  readonly meleeEnvelopeReach: number;
  readonly maxVisualRadius: number;
  readonly overlapsMeleeAtSpawn: boolean;
}

function sweepArcFor(weapon: WeaponDef, swing: SwingDescriptor): number {
  const sequence = meleeComboSelectionFor(weapon)?.sequence;
  const indexed =
    swing.comboStep === undefined ? undefined : sequence?.[swing.comboStep % sequence.length];
  const step = indexed ?? sequence?.find((candidate) => candidate.motion === swing.motion);
  return step?.path.deltaAngle ?? weapon.swingArc * (step?.path.arcMultiplier ?? 1);
}

/** Pure B18 presentation contract. The vortex overlaps the melee edge at birth but owns no damage source. */
export function fanTornadoReleasePlanFor(
  weapon: WeaponDef,
  recipe: FanTornadoWeaponVfxRecipe,
  actorX: number,
  actorY: number,
  aimAngle: number,
  swing: SwingDescriptor,
): FanTornadoReleasePlan {
  const releaseProgress = Math.max(0.55, Math.min(0.9, recipe.releaseProgress));
  const releaseAngle = bladeAngleAt(
    aimAngle,
    sweepArcFor(weapon, swing),
    releaseProgress,
  );
  const envelopeReach =
    meleeDamageEnvelopeFor(weapon).maxReach *
    Math.max(0, swing.comboPath?.rangeMultiplier ?? 1);
  const startRadius = Math.max(0, envelopeReach - recipe.displayWidth * 0.34);
  const laneParity = (swing.comboStep ?? 0) & 1;
  const laneSign = recipe.alternatesLane ? (laneParity === 0 ? -1 : 1) : 0;
  const laneOffset = laneSign * Math.min(18, recipe.displayWidth * 0.34);
  const radialX = Math.cos(releaseAngle);
  const radialY = Math.sin(releaseAngle);
  const normalX = -radialY;
  const normalY = radialX;
  const startX = actorX + radialX * startRadius + normalX * laneOffset;
  const startY = actorY + radialY * startRadius + normalY * laneOffset;
  const endX = startX + radialX * recipe.travelPx;
  const endY = startY + radialY * recipe.travelPx;
  const timing = swing.comboTiming;
  const releaseSeconds = timing
    ? (timing.activeStart +
        (timing.activeEnd - timing.activeStart) * releaseProgress) *
      swing.poseSeconds
    : swing.activeStartSeconds +
      (swing.activeEndSeconds - swing.activeStartSeconds) * releaseProgress;
  return Object.freeze({
    damageMode: "presentation-only",
    releaseLane: laneSign < 0 ? "lead" : laneSign > 0 ? "off" : "center",
    releaseProgress,
    delayMs: Math.max(0, Math.round(releaseSeconds * 1000)),
    startX,
    startY,
    endX,
    endY,
    travelPx: recipe.travelPx,
    meleeEnvelopeReach: envelopeReach,
    maxVisualRadius:
      Math.hypot(endX - actorX, endY - actorY) +
      Math.max(recipe.displayWidth, recipe.displayHeight) / 2,
    overlapsMeleeAtSpawn: startRadius - recipe.displayWidth / 2 <= envelopeReach,
  });
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
