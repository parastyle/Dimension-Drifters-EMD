import type Phaser from "phaser";
import { PROJECTILE_SPRITES } from "../sprites/projectile-manifest.js";
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
  /** The painted texture owns the complete silhouette; skip synthesized bursts/rings/footprints. */
  readonly suppressProcedural?: boolean;
  readonly paintedTexture?: {
    readonly key: string;
    readonly url: string;
    /** Final painted diameter relative to the exact server-authored blast diameter. */
    readonly diameterMultiplier: number;
    readonly lifeMs: number;
  };
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
    paintedTexture: Object.freeze({
      key: "projectile-explosion:brimstone-rocket-tube",
      url: "vfx/explosions/v7/brimstone-rocket-tube-large-explosion.png",
      diameterMultiplier: 1,
      lifeMs: 520,
    }),
  }),
  "x2-mesa-hand-cannon": Object.freeze({
    weaponId: "x2-mesa-hand-cannon",
    element: "fire",
    pack: "ember-eruption",
    silhouette: "organic-eruption",
    paintedHalo: false,
    shardCountMultiplier: 1.15,
    wispCountMultiplier: 1,
    footprintCount: 2,
    paintedTexture: Object.freeze({
      key: "projectile-explosion:mesa-hand-cannon",
      url: "vfx/explosions/v7/mesa-detonation.png",
      diameterMultiplier: 1,
      lifeMs: 360,
    }),
  }),
  "x2-quicksilver-streetsweeper": Object.freeze({
    weaponId: "x2-quicksilver-streetsweeper",
    element: "fire",
    pack: "ember-eruption",
    silhouette: "organic-eruption",
    paintedHalo: false,
    shardCountMultiplier: 0,
    wispCountMultiplier: 0,
    footprintCount: 0,
    suppressProcedural: true,
    paintedTexture: Object.freeze({
      key: "projectile-explosion:quicksilver-streetsweeper",
      url: PROJECTILE_SPRITES["streetsweeper-grenade-explosion"].url,
      diameterMultiplier: 1,
      lifeMs: 420,
    }),
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
    ? PROJECTILE_EXPLOSION_VFX_RECIPES[weaponId as keyof typeof PROJECTILE_EXPLOSION_VFX_RECIPES]
    : undefined;
}

export function preloadProjectileExplosionArt(scene: Phaser.Scene): void {
  for (const recipe of Object.values(PROJECTILE_EXPLOSION_VFX_RECIPES)) {
    const painted = "paintedTexture" in recipe ? recipe.paintedTexture : undefined;
    if (painted && !scene.textures.exists(painted.key)) scene.load.image(painted.key, painted.url);
  }
}
