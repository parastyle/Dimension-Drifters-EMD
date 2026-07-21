import {
  clampQuakeEpicenter,
  meleeReach,
  QUAKE_REACH,
  type SwingDescriptor,
  type WeaponDef,
  type WeaponEffectEmitter,
  type WeaponEffectEmitterPoint,
  type WeaponEffectRecipeId,
  weaponEffectEmitterPoint,
} from "@dd/shared";
import { PARTICLE_PACKS } from "./particle-manifest.js";

export interface WeaponEffectRecipe {
  readonly id: WeaponEffectRecipeId;
  readonly weaponId: string;
  readonly reuseWeaponIds?: readonly string[];
  readonly emitter: WeaponEffectEmitter;
  /** V5G2 audit class. Only `impact` cues may use the cursor/target anchor. */
  readonly classification:
    | "impact"
    | "projectile-impact"
    | "weapon-motion"
    | "character-action"
    | "chain-path";
  readonly projectile?: "electric-bolt" | "crystal-shard-orb";
  readonly projectileColor?: number;
  readonly impactPack?: string;
  readonly impactAnchor?: "target";
  readonly swingPack?: string;
  readonly swingCount?: number;
  readonly swingScaleMode?: "blade-length";
  readonly swingScaleMultiplier?: number;
  /** Painted 96-pack display width as a fraction of the weapon's held display length. */
  readonly swingParticleDominance?: number;
  readonly additive?: boolean;
  readonly chain?: "scattered-pages";
  readonly noGore?: boolean;
  readonly suppressQuakeVfx?: boolean;
  readonly quakeExplosionElement?: "void";
  readonly quakeExplosionPaintedOnlyWeaponIds?: readonly string[];
  readonly musicalNotes?: true;
}

export const WEAPON_EFFECT_RECIPES = Object.freeze({
  "galvanic-blue-burst": Object.freeze({
    id: "galvanic-blue-burst",
    weaponId: "x2-galvanic-overcasters",
    emitter: "tip",
    classification: "projectile-impact",
    projectile: "electric-bolt",
    projectileColor: 0x2f8fff,
    impactPack: "shock-bolt",
    additive: true,
  }),
  "riftglass-rainbow-volley": Object.freeze({
    id: "riftglass-rainbow-volley",
    weaponId: "x2-riftglass-prism-lantern",
    emitter: "tip",
    classification: "projectile-impact",
    impactPack: "arcane-shard",
    additive: true,
  }),
  "whispervolume-page-scatter": Object.freeze({
    id: "whispervolume-page-scatter",
    weaponId: "x2-twin-whispervolumes",
    emitter: "tip",
    classification: "chain-path",
    chain: "scattered-pages",
  }),
  "riftcleaver-crystal-shards": Object.freeze({
    id: "riftcleaver-crystal-shards",
    weaponId: "x2-riftcleaver-greatblade",
    emitter: "blade",
    classification: "weapon-motion",
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
    classification: "weapon-motion",
    swingPack: "holy-bolt",
    swingCount: 5,
    additive: true,
  }),
  "tombwarden-dark-slash": Object.freeze({
    id: "tombwarden-dark-slash",
    weaponId: "x2-tombwarden-claymore",
    emitter: "blade",
    classification: "impact",
    impactPack: "void-bolt",
    impactAnchor: "target",
    swingCount: 8,
    swingScaleMode: "blade-length",
    additive: true,
    suppressQuakeVfx: true,
  }),
  "choir-iron-flame-slash": Object.freeze({
    id: "choir-iron-flame-slash",
    weaponId: "x2-choir-iron-greataxe",
    emitter: "blade",
    classification: "weapon-motion",
    swingPack: "fire-bolt",
    swingCount: 9,
    additive: true,
  }),
  "hangman-blood-spatter": Object.freeze({
    id: "hangman-blood-spatter",
    weaponId: "x2-hangman-s-greatcleaver",
    emitter: "blade",
    classification: "impact",
    impactPack: "blood-splat",
    impactAnchor: "target",
    swingCount: 8,
    additive: false,
    noGore: true,
    suppressQuakeVfx: true,
    reuseWeaponIds: Object.freeze([
      "x2-quarry-splitter-bardiche",
      "x2-buckhorn-boarspear",
    ]),
  }),
  "cinderbrand-fire-slash": Object.freeze({
    id: "cinderbrand-fire-slash",
    weaponId: "x2-cinderbrand-cleaver",
    emitter: "blade",
    classification: "weapon-motion",
    swingPack: "fire-bolt",
    swingCount: 8,
    additive: true,
  }),
  "sanctified-holy-slash": Object.freeze({
    id: "sanctified-holy-slash",
    weaponId: "x2-sanctified-headsman",
    emitter: "blade",
    classification: "weapon-motion",
    swingPack: "holy-bolt",
    swingCount: 8,
    additive: true,
  }),
  "dustreaper-continuous-edge": Object.freeze({
    id: "dustreaper-continuous-edge",
    weaponId: "x2-dustreaper-zweihander",
    emitter: "blade",
    classification: "weapon-motion",
    swingPack: "sand-wisp",
    swingCount: 5,
    swingParticleDominance: 0.34,
    additive: false,
  }),
  "gravechain-dominant-spin": Object.freeze({
    id: "gravechain-dominant-spin",
    weaponId: "x2-gravechain-scythe",
    emitter: "blade",
    classification: "weapon-motion",
    swingPack: "void-wisp",
    swingCount: 24,
    swingParticleDominance: 0.52,
    additive: true,
  }),
  "stormfist-blue-lunge": Object.freeze({
    id: "stormfist-blue-lunge",
    weaponId: "x2-thunderhead-stormfists",
    emitter: "body",
    classification: "character-action",
    swingPack: "arcane-bolt",
    swingCount: 8,
    additive: true,
  }),
  "thunderhead-electric-codex": Object.freeze({
    id: "thunderhead-electric-codex",
    weaponId: "x2-thunderhead-voulge",
    emitter: "blade",
    classification: "weapon-motion",
    swingPack: "shock-spark",
    swingCount: 18,
    additive: true,
  }),
  "sermon-musical-notes": Object.freeze({
    id: "sermon-musical-notes",
    weaponId: "x2-sermon-bell",
    emitter: "body",
    classification: "impact",
    impactAnchor: "target",
    musicalNotes: true,
    suppressQuakeVfx: true,
  }),
  "nullspike-impact-circle": Object.freeze({
    id: "nullspike-impact-circle",
    weaponId: "x2-nullspike-pike",
    emitter: "tip",
    classification: "impact",
    impactPack: "void-ring",
    impactAnchor: "target",
    additive: true,
  }),
  "quarry-quad-spatter": Object.freeze({
    id: "quarry-quad-spatter",
    weaponId: "x2-quarry-splitter-bardiche",
    emitter: "blade",
    classification: "weapon-motion",
    swingPack: "blood-splat",
    swingCount: 8,
    swingScaleMultiplier: 4,
    noGore: true,
    suppressQuakeVfx: true,
  }),
  "witherleaf-tip-spores": Object.freeze({
    id: "witherleaf-tip-spores",
    weaponId: "x2-witherleaf-bestiary",
    emitter: "tip",
    classification: "weapon-motion",
    swingPack: "toxic-wisp",
    swingCount: 7,
    swingScaleMultiplier: 0.65,
    additive: false,
  }),
  "snakeoil-tip-sparks": Object.freeze({
    id: "snakeoil-tip-sparks",
    weaponId: "x2-snakeoil-tincture-scepter",
    emitter: "tip",
    classification: "weapon-motion",
    swingPack: "toxic-spark",
    swingCount: 5,
    swingScaleMultiplier: 0.36,
    additive: true,
  }),
  "void-caster-explosion": Object.freeze({
    id: "void-caster-explosion",
    weaponId: "x2-cairn-of-hollow-names",
    reuseWeaponIds: Object.freeze(["x2-vagrant-s-wishing-marble"]),
    emitter: "body",
    classification: "impact",
    impactAnchor: "target",
    suppressQuakeVfx: true,
    quakeExplosionElement: "void",
    quakeExplosionPaintedOnlyWeaponIds: Object.freeze(["x2-cairn-of-hollow-names"]),
  }),
  "hexbloom-toxic-impact": Object.freeze({
    id: "hexbloom-toxic-impact",
    weaponId: "x2-hexbloom-rapier",
    emitter: "tip",
    classification: "impact",
    impactPack: "toxic-splat",
    impactAnchor: "target",
    swingCount: 8,
    additive: false,
  }),
  "cinderbrand-magma-impact": Object.freeze({
    id: "cinderbrand-magma-impact",
    weaponId: "x2-cinderbrand-pike",
    emitter: "tip",
    classification: "impact",
    impactPack: "fire-splat",
    impactAnchor: "target",
    swingCount: 10,
    additive: true,
  }),
} as const satisfies Record<WeaponEffectRecipeId, WeaponEffectRecipe>);

export function resolveWeaponEffectRecipe(
  weapon: WeaponDef | undefined,
): WeaponEffectRecipe | undefined {
  const id = weapon?.effectRecipe;
  if (!id) return undefined;
  const recipe: WeaponEffectRecipe | undefined = WEAPON_EFFECT_RECIPES[id];
  return (recipe?.weaponId === weapon.id || recipe?.reuseWeaponIds?.includes(weapon.id)) &&
    recipe.emitter === weapon.effectEmitter
    ? recipe
    : undefined;
}

export function shouldSpawnLegacyQuakeVfx(weapon: WeaponDef | undefined): boolean {
  return weapon?.suppressVfx !== true && resolveWeaponEffectRecipe(weapon)?.suppressQuakeVfx !== true;
}

/** Impact cues use the authoritative quake placement reach when they detonate a quake; direct melee cues
 * use the rendered/hit-tested edge reach. Both are fixed weapon radii, never an unconstrained cursor. */
export function weaponEffectImpactReach(weapon: WeaponDef): number {
  return weapon.quake ? QUAKE_REACH : meleeReach(weapon);
}

/** V5G2 single anchor resolver for every weapon-effect cue. Motion/channel recipes keep their authored
 * body/tip/blade emitter; hit/impact recipes move to the cursor, clamped inside the weapon's real reach. */
export function weaponEffectCuePoint(
  recipe: WeaponEffectRecipe,
  weapon: WeaponDef,
  actor: Readonly<{ x: number; y: number }>,
  target: Readonly<{ x: number; y: number }> | undefined,
  aimAngle: number,
  swing: SwingDescriptor,
  elapsedSeconds: number,
): WeaponEffectEmitterPoint {
  if (recipe.impactAnchor !== "target")
    return weaponEffectEmitterPoint(weapon, actor, aimAngle, swing, elapsedSeconds);
  const reach = weaponEffectImpactReach(weapon);
  const desired = target ?? {
    x: actor.x + Math.cos(aimAngle) * reach,
    y: actor.y + Math.sin(aimAngle) * reach,
  };
  const point = clampQuakeEpicenter(actor, desired, reach);
  return { ...point, angle: aimAngle };
}

export function weaponSwingIdentityScale(
  recipe: WeaponEffectRecipe | undefined,
  bladeLength = 0,
): number {
  const cuePack = recipe?.impactAnchor === "target" ? recipe.impactPack : recipe?.swingPack;
  if (!cuePack) return 0.46;
  const frameWidth = PARTICLE_PACKS[cuePack]?.frameWidth ?? 96;
  return weaponSwingIdentitySizePx(recipe, bladeLength) / frameWidth;
}

export function weaponSwingIdentitySizePx(
  recipe: WeaponEffectRecipe | undefined,
  bladeLength = 0,
): number {
  const multiplier = recipe?.swingScaleMultiplier ?? 1;
  if (recipe?.swingScaleMode === "blade-length" && bladeLength > 0)
    return bladeLength * multiplier;
  if (bladeLength <= 0) return (recipe?.noGore ? 32.64 : 44.16) * multiplier;
  const dominance = recipe?.swingParticleDominance ?? (recipe?.noGore ? 0.22 : 0.28);
  return Math.max(28, Math.min(84, bladeLength * dominance)) * multiplier;
}

export interface WeaponAuraVfxRecipe {
  readonly weaponId: string;
  readonly packs: readonly string[];
  readonly count: number;
  /** Painted particle width / held weapon display length. */
  readonly particleDominance: number;
  readonly minParticlePx: number;
  readonly maxParticlePx: number;
  /** Optional W4M stage-up while retaining the W4G2 dominance ratio as the scale contract's basis. */
  readonly particleReferenceMultiplier?: number;
  readonly extent: number;
  readonly spinHz: number;
}

/** Retained painted-aura recipes. Gameplay radii stay in shared weapon data; these only place Codex art. */
export const WEAPON_AURA_VFX_RECIPES = Object.freeze({
  "x2-sparkknuckle-hex-mitt": Object.freeze({
    weaponId: "x2-sparkknuckle-hex-mitt",
    packs: Object.freeze(["shock-spark"]),
    count: 4,
    particleDominance: 0.3,
    minParticlePx: 14,
    maxParticlePx: 28,
    extent: 0.58,
    spinHz: 1.7,
  }),
  "x2-fulgurite-storm-sphere": Object.freeze({
    weaponId: "x2-fulgurite-storm-sphere",
    packs: Object.freeze(["shock-spark", "shock-bolt"]),
    count: 8,
    particleDominance: 0.44,
    minParticlePx: 30,
    maxParticlePx: 96,
    particleReferenceMultiplier: 3,
    extent: 0.96,
    spinHz: 1.05,
  }),
  "x2-galvanic-liber-of-storms": Object.freeze({
    weaponId: "x2-galvanic-liber-of-storms",
    packs: Object.freeze(["shock-wisp", "shock-splat", "shock-bolt"]),
    count: 12,
    particleDominance: 0.4,
    minParticlePx: 30,
    maxParticlePx: 48,
    extent: 0.96,
    spinHz: 1.2,
  }),
  "x2-sporebound-witchglobe": Object.freeze({
    weaponId: "x2-sporebound-witchglobe",
    packs: Object.freeze(["toxic-wisp", "toxic-splat", "toxic-mote"]),
    count: 8,
    particleDominance: 0.42,
    minParticlePx: 32,
    maxParticlePx: 52,
    extent: 1,
    spinHz: 0.72,
  }),
  "x2-coyote-trickster-s-sparkmitt": Object.freeze({
    weaponId: "x2-coyote-trickster-s-sparkmitt",
    packs: Object.freeze(["shock-spark"]),
    count: 4,
    particleDominance: 0.3,
    minParticlePx: 14,
    maxParticlePx: 28,
    extent: 0.58,
    spinHz: 1.7,
  }),
} as const satisfies Record<string, WeaponAuraVfxRecipe>);

export function resolveWeaponAuraVfxRecipe(
  weapon: WeaponDef | undefined,
): WeaponAuraVfxRecipe | undefined {
  if (!weapon) return undefined;
  return WEAPON_AURA_VFX_RECIPES[weapon.id as keyof typeof WEAPON_AURA_VFX_RECIPES];
}

export const TESLA_WARP_VFX_RECIPE = Object.freeze({
  weaponId: "x2-cogwright-s-tesla-rod",
  departurePacks: Object.freeze(["shock-bolt", "shock-spark"]),
  arrivalPacks: Object.freeze(["shock-splat", "shock-bolt"]),
});
