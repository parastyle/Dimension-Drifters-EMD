import type { FxPackName } from "./fx-composer.js";

export interface ProjectileExplosionVfxRecipe {
  readonly weaponId: string;
  readonly element: "fire" | "frost";
  readonly pack: FxPackName;
  readonly silhouette: "organic-eruption" | "ice-bloom";
  readonly paintedHalo: boolean;
  readonly shardCountMultiplier: number;
  readonly wispCountMultiplier: number;
  readonly footprintCount: number;
}

/** Named projectile blasts keep art identity separate from damage geometry and camera-shake strength. */
export const PROJECTILE_EXPLOSION_VFX_RECIPES = Object.freeze({
  "x2-brimstone-rocket-tube": Object.freeze({
    weaponId: "x2-brimstone-rocket-tube",
    element: "fire",
    pack: "ember-eruption",
    silhouette: "organic-eruption",
    paintedHalo: false,
    shardCountMultiplier: 1.6,
    wispCountMultiplier: 2,
    footprintCount: 4,
  }),
  "x2-tidehook-bombarpoon": Object.freeze({
    weaponId: "x2-tidehook-bombarpoon",
    element: "frost",
    pack: "frost-nova",
    silhouette: "ice-bloom",
    paintedHalo: true,
    shardCountMultiplier: 1.8,
    wispCountMultiplier: 1.4,
    footprintCount: 3,
  }),
} as const satisfies Record<string, ProjectileExplosionVfxRecipe>);

export function resolveProjectileExplosionVfxRecipe(
  weaponId: string | undefined,
): ProjectileExplosionVfxRecipe | undefined {
  return weaponId
    ? PROJECTILE_EXPLOSION_VFX_RECIPES[
        weaponId as keyof typeof PROJECTILE_EXPLOSION_VFX_RECIPES
      ]
    : undefined;
}
