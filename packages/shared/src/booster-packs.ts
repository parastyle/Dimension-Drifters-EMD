import { characterName, WHOLE_ART_CHARACTERS, type WholeArtCharacter } from "./characters.js";
import { PET_CATALOG, PET_IDS, type PetId } from "./pets.js";
import { makeRng, mixSeeds } from "./rng.js";
import {
  ACTIVE_WEAPON_CATALOG_IDS,
  WEAPONS,
  type WeaponDef,
  type WeaponTier,
} from "./weapons.js";
import type { MetaAccountV5 } from "./meta.js";

export const PACK_TYPES = ["weapon", "pet", "character"] as const;
export type PackType = (typeof PACK_TYPES)[number];

export const PACK_RARITIES = ["common", "uncommon", "rare", "legendary"] as const;
export type PackRarity = (typeof PACK_RARITIES)[number];

export const PACK_PULLS = 3 as const;
export const PACK_RARITY_WEIGHTS = {
  common: 55,
  uncommon: 28,
  rare: 13,
  legendary: 4,
} as const satisfies Readonly<Record<PackRarity, number>>;
export const PACK_RARITY_COST_MULTIPLIERS = {
  common: 1,
  uncommon: 1.5,
  rare: 2.5,
  legendary: 5,
} as const satisfies Readonly<Record<PackRarity, number>>;
export const PACK_PRICES = {
  weapon: 90,
  pet: 120,
  character: 150,
} as const satisfies Readonly<Record<PackType, number>>;

export const STARTER_UNLOCKED_WEAPON_IDS = [
  "gravediggers-spade",
  "rusty-cleaver",
  "tombstone-greatsword",
  "x-sword-whirlwind",
  "driftblade",
  "twin-bowie-fangs",
  "x-sword-buzzsaw",
  "x-sword-anchor",
  "rattler-sabre",
  "x-sword-coffin",
  "x-sword-railspike",
  "x-sword-neon-katana",
  "x-sword-bone",
  "x-gun-revolver-cannon",
  "x-staff-arcane-lance",
  "x-staff-storm-rod",
  "x-gun-coffin-shotgun",
  "x-gun-hand-mortar",
  "x-gun-gatling",
  "x-gun-nailgun",
  "x-gun-ricochet-pistol",
  "drift-katana-stillwater-edict",
  "drift-katana-stormthread",
  "drift-katana-riftstep",
  "drift-nodachi-pale-horizon",
  "drift-nodachi-gatebreaker",
  "drift-greatkatana-moonwake",
  "drift-greatkatana-tempest-regent",
  "drift-colossal-world-seam",
  "x2-abyssal-apocrypha",
  "x2-anvil-drop",
  "x2-auroral-filament-wand",
  "x2-barrett-50-cal-sniper",
  "x2-blightfork-glaive",
  "x2-blightgrip-spore-mitt",
  "x2-bogwater-twinbits",
  "x2-boneash-scattergun-rifle",
  "x2-bonewhisper-jian",
  "x2-boneyard-ricochet-mortar",
  "x2-boothook-harpoon",
  "x2-bramblecoil",
  "x2-brimstone-falcata",
  "x2-brimstone-gallows-rifle",
  "x2-brinequill-tidescepter",
  "x2-buckhorn-boarspear",
  "x2-buckshot-bramble-bow",
  "x2-buzzard-s-burnout",
  "x2-cairn-of-hollow-names",
  "x2-carrion-cudgel",
  "x2-cinderbrand-cleaver",
  "x2-cinderchoke-blunderbuss",
  "x2-cinderchoke-brazier-orb",
  "x2-cinderquill-almanac",
  "x2-rimebound-folio",
  "x2-coffin-nail-rosary-orb",
  "x2-confetti-cannon",
  "x2-dustdevil-warmaul",
  "x2-dustreaper-zweihander",
  "x2-ember-fan",
  "x2-emberleaf-chapbook",
  "x2-frostquill-compendium",
  "x2-ghostwind-spectre-rail",
  "x2-glyphward-manuscript",
  "x2-gravechill-nodachi",
  "x2-hailshot-hand-maul",
  "x2-hexglyph-partisan",
  "x2-ledger-of-spent-souls",
  "x2-mirage-hardlight-saber",
  "x2-pendulum-of-the-pyre",
  "x2-pyroglyph-spellbook",
  "x2-reliquary-halberd",
  "x2-riftcaller-naginata",
  "x2-storm-fan",
  "x2-witherleaf-bestiary",
] as const satisfies readonly string[];

export const STARTER_UNLOCKED_CHARACTER_IDS = [
  "proto-cowboy-hidden-face",
  "proto-cowboy",
  "proto-hooded-rogue",
  "proto-junkyard-mechanic",
  "proto-templar-knight",
  "proto-wizard",
] as const satisfies readonly WholeArtCharacter[];

const LEGENDARY_CHARACTER_IDS = new Set<WholeArtCharacter>([
  "proto-blue-spectral-demon-hunter",
  "proto-paper-cutout-fighter",
  "proto-red-rebel-demon-hunter",
  "proto-red-rebel-demon-hunter-v2",
]);

const RARE_CHARACTER_IDS = new Set<WholeArtCharacter>([
  "proto-alien-void-scholar",
  "proto-bone-cleric",
  "proto-carnival-harlequin",
  "proto-cyberpunk-hacker",
  "proto-gothic-vampire-hunter",
  "proto-molten-forge-golem",
  "proto-plague-doctor",
  "proto-punk-occult-summoner",
  "proto-royal-executioner",
  "proto-swamp-shaman",
]);

const UNCOMMON_CHARACTER_IDS = new Set<WholeArtCharacter>([
  "proto-armored-bean-heavy",
  "proto-capsule-tactical-unit",
  "proto-clockwork-butler",
  "proto-frost-rune-guardian",
  "proto-geometric-robot-pod",
  "proto-helmeted-enforcer",
  "proto-masked-oval-fighter",
  "proto-mushroom-alchemist",
  "proto-mutant-lump",
  "proto-ninja-purple",
  "proto-soft-mascot-fighter",
  "proto-toxic-wasteland-scavenger",
]);

export interface PackCandidate {
  readonly id: string;
  readonly name: string;
  readonly rarity: PackRarity;
}

export interface PackPull extends PackCandidate {
  readonly duplicate: boolean;
  readonly refund: number;
}

export interface PackOpenReceipt {
  readonly packType: PackType;
  readonly seed: number;
  readonly price: number;
  readonly refundTotal: number;
  readonly pulls: readonly PackPull[];
  readonly balance: number;
}

export type OpenPackResult =
  | {
      readonly ok: true;
      readonly account: MetaAccountV5;
      readonly receipt: PackOpenReceipt;
    }
  | {
      readonly ok: false;
      readonly account: MetaAccountV5;
      readonly reason: "insufficient-funds" | "sold-out";
    };

export const WEAPON_PACK_RARITY_BY_TIER = {
  1: "common",
  2: "common",
  3: "uncommon",
  4: "rare",
  5: "legendary",
} as const satisfies Readonly<Record<WeaponTier, PackRarity>>;

export function weaponPackRarity(weapon: Readonly<WeaponDef>): PackRarity {
  return WEAPON_PACK_RARITY_BY_TIER[weapon.tier];
}

export function petPackRarity(id: PetId): PackRarity {
  switch (PET_CATALOG[id].bonus.kind) {
    case "passive-regen":
    case "healing-received":
      return "common";
    case "money-reach":
    case "earned-pickup-reach":
    case "reload-duration":
      return "uncommon";
    case "earned-sale":
    case "revive-reach":
      return "rare";
    case "ground-hazard-damage":
      return "legendary";
  }
}

export function characterPackRarity(id: WholeArtCharacter): PackRarity {
  if (LEGENDARY_CHARACTER_IDS.has(id)) return "legendary";
  if (RARE_CHARACTER_IDS.has(id)) return "rare";
  if (UNCOMMON_CHARACTER_IDS.has(id)) return "uncommon";
  return "common";
}

export function packDuplicateRefund(packType: PackType, rarity: PackRarity): number {
  return Math.floor(
    (PACK_PRICES[packType] / PACK_PULLS) * PACK_RARITY_COST_MULTIPLIERS[rarity] * 0.5,
  );
}

export function isWeaponUnlocked(
  account: Pick<MetaAccountV5, "unlockedWeapons">,
  weaponId: string,
): boolean {
  return account.unlockedWeapons.includes(weaponId);
}

export function unlockedWeaponDropPool(account: Pick<MetaAccountV5, "unlockedWeapons">): string[] {
  const unlocked = new Set(account.unlockedWeapons);
  return ACTIVE_WEAPON_CATALOG_IDS.filter((id) => unlocked.has(id));
}

export function isCharacterUnlocked(
  account: Pick<MetaAccountV5, "unlockedCharacters">,
  characterId: unknown,
): characterId is WholeArtCharacter {
  return (
    typeof characterId === "string" &&
    account.unlockedCharacters.includes(characterId as WholeArtCharacter)
  );
}

export function lockedPackCandidates(
  account: Pick<MetaAccountV5, "unlockedWeapons" | "unlockedCharacters" | "pets">,
  packType: PackType,
): PackCandidate[] {
  if (packType === "weapon") {
    const unlocked = new Set(account.unlockedWeapons);
    return ACTIVE_WEAPON_CATALOG_IDS.filter((id) => !unlocked.has(id)).flatMap((id) => {
      const weapon = WEAPONS[id];
      return weapon
        ? [{ id, name: weapon.name, rarity: weaponPackRarity(weapon) }]
        : [];
    });
  }
  if (packType === "pet") {
    return PET_IDS.filter((id) => !account.pets[id]).map((id) => ({
      id,
      name: PET_CATALOG[id].name,
      rarity: petPackRarity(id),
    }));
  }
  const unlocked = new Set(account.unlockedCharacters);
  return WHOLE_ART_CHARACTERS.filter((id) => !unlocked.has(id)).map((id) => ({
    id,
    name: characterName(id),
    rarity: characterPackRarity(id),
  }));
}

function pickPackCandidate(
  candidates: readonly PackCandidate[],
  seed: number,
  pullIndex: number,
): PackCandidate {
  const rng = makeRng(mixSeeds(seed, pullIndex, 0xb0057e));
  const availableRarities = PACK_RARITIES.filter((rarity) =>
    candidates.some((candidate) => candidate.rarity === rarity),
  );
  const weightTotal = availableRarities.reduce(
    (total, rarity) => total + PACK_RARITY_WEIGHTS[rarity],
    0,
  );
  let cursor = rng.range(0, weightTotal);
  let rarity = availableRarities[availableRarities.length - 1] ?? "common";
  for (const candidateRarity of availableRarities) {
    cursor -= PACK_RARITY_WEIGHTS[candidateRarity];
    if (cursor < 0) {
      rarity = candidateRarity;
      break;
    }
  }
  return rng.pick(candidates.filter((candidate) => candidate.rarity === rarity));
}

export function openBoosterPack(
  account: MetaAccountV5,
  packType: PackType,
  seed: number,
): OpenPackResult {
  const candidates = lockedPackCandidates(account, packType);
  if (candidates.length === 0) return { ok: false, account, reason: "sold-out" };
  const price = PACK_PRICES[packType];
  if (account.scrip < price) return { ok: false, account, reason: "insufficient-funds" };

  const next: MetaAccountV5 = {
    ...account,
    revision: Math.min(0xffff_ffff, account.revision + 1),
    scrip: account.scrip - price,
    pets: { ...account.pets },
    unlockedWeapons: [...account.unlockedWeapons],
    unlockedCharacters: [...account.unlockedCharacters],
  };
  const unlockedWeapons = new Set(next.unlockedWeapons);
  const unlockedCharacters = new Set(next.unlockedCharacters);
  const pulls: PackPull[] = [];
  let refundTotal = 0;

  for (let pullIndex = 0; pullIndex < PACK_PULLS; pullIndex++) {
    const candidate = pickPackCandidate(candidates, seed >>> 0, pullIndex);
    const duplicate =
      packType === "weapon"
        ? unlockedWeapons.has(candidate.id)
        : packType === "pet"
          ? !!next.pets[candidate.id as PetId]
          : unlockedCharacters.has(candidate.id as WholeArtCharacter);
    const refund = duplicate ? packDuplicateRefund(packType, candidate.rarity) : 0;
    if (!duplicate) {
      if (packType === "weapon") {
        unlockedWeapons.add(candidate.id);
        next.unlockedWeapons.push(candidate.id);
      } else if (packType === "pet") {
        next.pets[candidate.id as PetId] = { bondXp: 0 };
      } else {
        unlockedCharacters.add(candidate.id as WholeArtCharacter);
        next.unlockedCharacters.push(candidate.id as WholeArtCharacter);
      }
    }
    refundTotal += refund;
    pulls.push({ ...candidate, duplicate, refund });
  }
  next.scrip = Math.min(0xffff_ffff, next.scrip + refundTotal);
  return {
    ok: true,
    account: next,
    receipt: {
      packType,
      seed: seed >>> 0,
      price,
      refundTotal,
      pulls,
      balance: next.scrip,
    },
  };
}
