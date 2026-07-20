import type { WeaponDef, WeaponEffectEmitter, WeaponEffectRecipeId } from "@dd/shared";

export interface WeaponEffectRecipe {
  readonly id: WeaponEffectRecipeId;
  readonly weaponId: string;
  readonly emitter: WeaponEffectEmitter;
  readonly projectile?: "electric-bolt" | "crystal-shard-orb";
  readonly projectileColor?: number;
  readonly impactPack?: string;
  readonly swingPack?: string;
  readonly swingCount?: number;
  readonly additive?: boolean;
  readonly chain?: "scattered-pages";
  readonly noGore?: boolean;
}

export const WEAPON_EFFECT_RECIPES = Object.freeze({
  "galvanic-blue-burst": Object.freeze({
    id: "galvanic-blue-burst",
    weaponId: "x2-galvanic-overcasters",
    emitter: "tip",
    projectile: "electric-bolt",
    projectileColor: 0x2f8fff,
    impactPack: "shock-bolt",
    additive: true,
  }),
  "riftglass-rainbow-volley": Object.freeze({
    id: "riftglass-rainbow-volley",
    weaponId: "x2-riftglass-prism-lantern",
    emitter: "tip",
    impactPack: "arcane-shard",
    additive: true,
  }),
  "whispervolume-page-scatter": Object.freeze({
    id: "whispervolume-page-scatter",
    weaponId: "x2-twin-whispervolumes",
    emitter: "tip",
    chain: "scattered-pages",
  }),
  "riftcleaver-crystal-shards": Object.freeze({
    id: "riftcleaver-crystal-shards",
    weaponId: "x2-riftcleaver-greatblade",
    emitter: "blade",
    projectile: "crystal-shard-orb",
    impactPack: "arcane-shard",
    swingPack: "arcane-shard",
    swingCount: 7,
    additive: true,
  }),
  "verdict-tip-procession": Object.freeze({
    id: "verdict-tip-procession",
    weaponId: "x2-verdict-longsword",
    emitter: "tip",
    swingPack: "holy-bolt",
    swingCount: 5,
    additive: true,
  }),
  "tombwarden-dark-slash": Object.freeze({
    id: "tombwarden-dark-slash",
    weaponId: "x2-tombwarden-claymore",
    emitter: "blade",
    swingPack: "void-bolt",
    swingCount: 8,
    additive: true,
  }),
  "choir-iron-flame-slash": Object.freeze({
    id: "choir-iron-flame-slash",
    weaponId: "x2-choir-iron-greataxe",
    emitter: "blade",
    swingPack: "fire-bolt",
    swingCount: 9,
    additive: true,
  }),
  "hangman-blood-spatter": Object.freeze({
    id: "hangman-blood-spatter",
    weaponId: "x2-hangman-s-greatcleaver",
    emitter: "blade",
    swingPack: "blood-splat",
    swingCount: 8,
    additive: false,
    noGore: true,
  }),
  "dustreaper-continuous-edge": Object.freeze({
    id: "dustreaper-continuous-edge",
    weaponId: "x2-dustreaper-zweihander",
    emitter: "blade",
    swingPack: "sand-wisp",
    swingCount: 5,
    additive: false,
  }),
} as const satisfies Record<WeaponEffectRecipeId, WeaponEffectRecipe>);

export function resolveWeaponEffectRecipe(
  weapon: WeaponDef | undefined,
): WeaponEffectRecipe | undefined {
  const id = weapon?.effectRecipe;
  if (!id) return undefined;
  const recipe = WEAPON_EFFECT_RECIPES[id];
  return recipe?.weaponId === weapon.id && recipe.emitter === weapon.effectEmitter
    ? recipe
    : undefined;
}
