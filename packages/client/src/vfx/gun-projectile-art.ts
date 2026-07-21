export interface GunSpriteProjectileRecipe {
  readonly spriteId: string;
  readonly partRole: string;
  readonly crop: Readonly<{ x: number; y: number; width: number; height: number }>;
  readonly displayLength: number;
}

/** Reference-image orders use bounded crops from the weapon's own installed sprite. */
export const GUN_SPRITE_PROJECTILES: Readonly<Partial<Record<string, GunSpriteProjectileRecipe>>> =
  Object.freeze({
    "x2-grave-anchor-harpoon": Object.freeze({
      spriteId: "x2-grave-anchor-harpoon",
      partRole: "part-1",
      crop: Object.freeze({ x: 183, y: 0, width: 73, height: 125 }),
      displayLength: 76,
    }),
    "x2-widowmaker-arbalest": Object.freeze({
      spriteId: "x2-widowmaker-arbalest",
      partRole: "part-1",
      crop: Object.freeze({ x: 143, y: 43, width: 113, height: 34 }),
      displayLength: 64,
    }),
    "x2-brimstone-rocket-tube": Object.freeze({
      spriteId: "x2-brimstone-rocket-tube",
      partRole: "part-1",
      crop: Object.freeze({ x: 158, y: 13, width: 98, height: 52 }),
      displayLength: 72,
    }),
  });

/** Non-crop projectile identities resolve to existing painted particle packs. */
export const GUN_PROJECTILE_ART_PACKS = Object.freeze({
  arrow: "steel-bolt",
  cannonball: "steel-orb",
  fireball: "fire-orb",
} as const);
