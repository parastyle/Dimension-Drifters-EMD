import type { LegacyQuirkId, QuirkDef, QuirkMods } from "./character-classes.js";
import { QUIRKS } from "./character-classes.js";
import { ATTRS, type Attr } from "./leveling.js";

export const GEAR_SLOTS = [
  "hat",
  "glasses",
  "facialHair",
  "shirt",
  "gloves",
  "pants",
  "boots",
  "cloak",
] as const;

export type GearSlot = (typeof GEAR_SLOTS)[number];

export const GEAR_CLASSES = ["bruiser", "duelist", "caster", "warden", "scoundrel"] as const;
export type GearClassId = (typeof GEAR_CLASSES)[number];

export const GEAR_RARITIES = ["Common", "Uncommon", "Rare", "Really Rare", "Ultimate"] as const;
export type GearRarity = (typeof GEAR_RARITIES)[number];

export const GEAR_CATALOG_VERSION = 1 as const;

export interface SpreadMove {
  readonly from: Attr;
  readonly to: Attr;
}

/** Source-neutral values cached once at a run boundary. Computation sites clamp/round once. */
export interface GearScalarMods {
  readonly maxHpAdd?: number;
  readonly outgoingWeaponDamageMult?: number;
  readonly weaponCooldownMult?: number;
  readonly gunCooldownMult?: number;
  readonly meleeCooldownMult?: number;
  readonly casterCooldownMult?: number;
  readonly beamCooldownMult?: number;
  readonly heavyCooldownMult?: number;
  readonly parryCooldownMult?: number;
  readonly healingReceivedMult?: number;
  readonly groundHazardDamageMult?: number;
  readonly pickupReachMult?: number;
}

export type RuntimeMods = Readonly<QuirkMods & Required<GearScalarMods>>;

export interface GearDef {
  readonly id: string;
  readonly netCode: number;
  readonly name: string;
  readonly slot: GearSlot;
  readonly gearClass: GearClassId;
  readonly rarity: GearRarity;
  readonly budgetUnits: number;
  readonly budgetException?: "legacy-upgrade-rank-3";
  /** Exactly one review lane. It is metadata, never an executable client payload. */
  readonly powerTag: string;
  readonly stats: Partial<Readonly<Record<Attr, number>>>;
  readonly spreadMoves?: readonly SpreadMove[];
  readonly quirkRef?: LegacyQuirkId;
  readonly mods?: Readonly<Partial<QuirkMods & GearScalarMods>>;
  readonly effectText: string;
  readonly effectAvailability?: "active" | "partial" | "inert";
  readonly artKey: string;
  readonly legacySetId?: string;
  readonly originPool?: string;
}

export const GEAR_SLOT_BUDGETS = {
  hat: 4,
  glasses: 3,
  facialHair: 1,
  shirt: 3,
  gloves: 2,
  pants: 2,
  boots: 2,
  cloak: 3,
} as const satisfies Readonly<Record<GearSlot, number>>;

/**
 * Checked-in gameplay truth. Launch rows are the twelve systems-panel sets (96 items), followed by the
 * nine former META_UPGRADES ranks. The eight blank rows make corrupt/fresh accounts derive to a complete
 * flat-2, no-signature loadout without inventing nullable wire semantics.
 */
export const GEAR_CATALOG = {
  "blank-drifter-hat": { id: "blank-drifter-hat", netCode: 1, name: "No Hat", slot: "hat", gearClass: "bruiser", rarity: "Common", budgetUnits: 0, powerTag: "none", stats: {}, effectText: "No signature", artKey: "blank-drifter-hat", legacySetId: "blank-drifter" },
  "blank-drifter-glasses": { id: "blank-drifter-glasses", netCode: 2, name: "No Glasses", slot: "glasses", gearClass: "bruiser", rarity: "Common", budgetUnits: 0, powerTag: "none", stats: {}, effectText: "No combat effect", artKey: "blank-drifter-glasses", legacySetId: "blank-drifter" },
  "blank-drifter-facial-hair": { id: "blank-drifter-facial-hair", netCode: 3, name: "Clean Shaven", slot: "facialHair", gearClass: "bruiser", rarity: "Common", budgetUnits: 0, powerTag: "none", stats: {}, effectText: "No combat effect", artKey: "blank-drifter-facial-hair", legacySetId: "blank-drifter" },
  "blank-drifter-shirt": { id: "blank-drifter-shirt", netCode: 4, name: "Blank Shirt", slot: "shirt", gearClass: "bruiser", rarity: "Common", budgetUnits: 0, powerTag: "none", stats: {}, effectText: "No combat effect", artKey: "blank-drifter-shirt", legacySetId: "blank-drifter" },
  "blank-drifter-gloves": { id: "blank-drifter-gloves", netCode: 5, name: "Bare Hands", slot: "gloves", gearClass: "bruiser", rarity: "Common", budgetUnits: 0, powerTag: "none", stats: {}, effectText: "No combat effect", artKey: "blank-drifter-gloves", legacySetId: "blank-drifter" },
  "blank-drifter-pants": { id: "blank-drifter-pants", netCode: 6, name: "Blank Pants", slot: "pants", gearClass: "bruiser", rarity: "Common", budgetUnits: 0, powerTag: "none", stats: {}, effectText: "No combat effect", artKey: "blank-drifter-pants", legacySetId: "blank-drifter" },
  "blank-drifter-boots": { id: "blank-drifter-boots", netCode: 7, name: "Bare Feet", slot: "boots", gearClass: "bruiser", rarity: "Common", budgetUnits: 0, powerTag: "none", stats: {}, effectText: "No combat effect", artKey: "blank-drifter-boots", legacySetId: "blank-drifter" },
  "blank-drifter-cloak": { id: "blank-drifter-cloak", netCode: 8, name: "No Cloak", slot: "cloak", gearClass: "bruiser", rarity: "Common", budgetUnits: 0, powerTag: "none", stats: {}, effectText: "No combat effect", artKey: "blank-drifter-cloak", legacySetId: "blank-drifter" },

  "ash-walker-hat": { id: "ash-walker-hat", netCode: 9, name: "Ash-Walker's Cowl", slot: "hat", gearClass: "bruiser", rarity: "Ultimate", budgetUnits: 4, powerTag: "keystone:mend-the-broken", stats: {}, quirkRef: "mend-the-broken", effectText: "A successful parry heal also heals the nearest ally within 220 px for the same amount", artKey: "ash-walker-hat", legacySetId: "ash-walker", originPool: "Ashlands" },
  "ash-walker-glasses": { id: "ash-walker-glasses", netCode: 10, name: "Emberglass Lenses", slot: "glasses", gearClass: "bruiser", rarity: "Rare", budgetUnits: 1, powerTag: "precision:missing-hp-crit", stats: {}, effectText: "+2 crit points while missing HP", effectAvailability: "inert", artKey: "ash-walker-glasses", legacySetId: "ash-walker", originPool: "Ashlands" },
  "ash-walker-facial-hair": { id: "ash-walker-facial-hair", netCode: 11, name: "Mercy Muttonchops", slot: "facialHair", gearClass: "bruiser", rarity: "Common", budgetUnits: 0, powerTag: "none", stats: {}, effectText: "Revive prompts say Mend; no combat effect", artKey: "ash-walker-facial-hair", legacySetId: "ash-walker", originPool: "Ashlands" },
  "ash-walker-shirt": { id: "ash-walker-shirt", netCode: 12, name: "Ash-Stitched Jerkin", slot: "shirt", gearClass: "bruiser", rarity: "Uncommon", budgetUnits: 1, powerTag: "spread:luk-to-con", stats: {}, spreadMoves: [{ from: "luk", to: "con" }], effectText: "LUK to CON", artKey: "ash-walker-shirt", legacySetId: "ash-walker", originPool: "Ashlands" },
  "ash-walker-gloves": { id: "ash-walker-gloves", netCode: 13, name: "Mender's Knuckles", slot: "gloves", gearClass: "bruiser", rarity: "Rare", budgetUnits: 1, powerTag: "handling:parry-recovery", stats: {}, mods: { parryCooldownMult: 0.92 }, effectText: "Parry recovery is 8% faster", artKey: "ash-walker-gloves", legacySetId: "ash-walker", originPool: "Ashlands" },
  "ash-walker-pants": { id: "ash-walker-pants", netCode: 14, name: "Sootroad Trousers", slot: "pants", gearClass: "bruiser", rarity: "Uncommon", budgetUnits: 1, powerTag: "vitals:max-hp", stats: {}, mods: { maxHpAdd: 10 }, effectText: "+10 max HP", artKey: "ash-walker-pants", legacySetId: "ash-walker", originPool: "Ashlands" },
  "ash-walker-boots": { id: "ash-walker-boots", netCode: 15, name: "Cinderstep Wraps", slot: "boots", gearClass: "bruiser", rarity: "Uncommon", budgetUnits: 1, powerTag: "mobility:low-hp", stats: {}, effectText: "+8% move speed at or below 50% HP", effectAvailability: "inert", artKey: "ash-walker-boots", legacySetId: "ash-walker", originPool: "Ashlands" },
  "ash-walker-cloak": { id: "ash-walker-cloak", netCode: 16, name: "Smoke-Bitten Mantle", slot: "cloak", gearClass: "bruiser", rarity: "Really Rare", budgetUnits: 2, powerTag: "recovery:healing-received", stats: {}, mods: { healingReceivedMult: 1.1 }, effectText: "+10% non-regeneration healing received", artKey: "ash-walker-cloak", legacySetId: "ash-walker", originPool: "Ashlands" },

  "ashen-crusader-hat": { id: "ashen-crusader-hat", netCode: 17, name: "Crusader's Cowl", slot: "hat", gearClass: "warden", rarity: "Ultimate", budgetUnits: 4, powerTag: "keystone:habit-and-prayer", stats: {}, quirkRef: "habit-and-prayer", effectText: "The parry chain never expires; taking damage resets it", artKey: "ashen-crusader-hat", legacySetId: "ashen-crusader", originPool: "Ashlands" },
  "ashen-crusader-glasses": { id: "ashen-crusader-glasses", netCode: 18, name: "Prayer-Script Spectacles", slot: "glasses", gearClass: "warden", rarity: "Rare", budgetUnits: 1, powerTag: "precision:recent-parry", stats: {}, effectText: "+2 crit points against an enemy parried in the last 2s", effectAvailability: "inert", artKey: "ashen-crusader-glasses", legacySetId: "ashen-crusader", originPool: "Ashlands" },
  "ashen-crusader-facial-hair": { id: "ashen-crusader-facial-hair", netCode: 19, name: "Censer-Cord Beard", slot: "facialHair", gearClass: "warden", rarity: "Common", budgetUnits: 0, powerTag: "none", stats: {}, effectText: "Chain 5 tolls a soft bell; no combat effect", artKey: "ashen-crusader-facial-hair", legacySetId: "ashen-crusader", originPool: "Ashlands" },
  "ashen-crusader-shirt": { id: "ashen-crusader-shirt", netCode: 20, name: "Ashen Habit", slot: "shirt", gearClass: "warden", rarity: "Uncommon", budgetUnits: 2, powerTag: "spread:dex-int-to-con", stats: {}, spreadMoves: [{ from: "dex", to: "con" }, { from: "int", to: "con" }], effectText: "DEX to CON, then INT to CON", artKey: "ashen-crusader-shirt", legacySetId: "ashen-crusader", originPool: "Ashlands" },
  "ashen-crusader-gloves": { id: "ashen-crusader-gloves", netCode: 21, name: "Votive Gauntlets", slot: "gloves", gearClass: "warden", rarity: "Rare", budgetUnits: 1, powerTag: "handling:parry-recovery", stats: {}, mods: { parryCooldownMult: 0.92 }, effectText: "Parry recovery is 8% faster", artKey: "ashen-crusader-gloves", legacySetId: "ashen-crusader", originPool: "Ashlands" },
  "ashen-crusader-pants": { id: "ashen-crusader-pants", netCode: 22, name: "Censer-Worn Trousers", slot: "pants", gearClass: "warden", rarity: "Uncommon", budgetUnits: 1, powerTag: "spread:luk-to-str", stats: {}, spreadMoves: [{ from: "luk", to: "str" }], effectText: "LUK to STR", artKey: "ashen-crusader-pants", legacySetId: "ashen-crusader", originPool: "Ashlands" },
  "ashen-crusader-boots": { id: "ashen-crusader-boots", netCode: 23, name: "Pilgrim's Sabatons", slot: "boots", gearClass: "warden", rarity: "Uncommon", budgetUnits: 1, powerTag: "mobility:impulse-resistance", stats: {}, effectText: "Knockback and pull distance -10%", effectAvailability: "inert", artKey: "ashen-crusader-boots", legacySetId: "ashen-crusader", originPool: "Ashlands" },
  "ashen-crusader-cloak": { id: "ashen-crusader-cloak", netCode: 24, name: "Unbroken Vestment", slot: "cloak", gearClass: "warden", rarity: "Really Rare", budgetUnits: 1, powerTag: "defense:parry-chain", stats: {}, effectText: "At parry chain 3+, incoming damage -6%", effectAvailability: "inert", artKey: "ashen-crusader-cloak", legacySetId: "ashen-crusader", originPool: "Ashlands" },

  "molten-core-hat": { id: "molten-core-hat", netCode: 25, name: "Cinder Crown", slot: "hat", gearClass: "caster", rarity: "Ultimate", budgetUnits: 4, powerTag: "keystone:molten-core", stats: {}, quirkRef: "molten-core", effectText: "Below 30% HP, weapon hits ignite for 8% hit damage over 2s; refresh, no stack", artKey: "molten-core-hat", legacySetId: "molten-core", originPool: "Ashlands" },
  "molten-core-glasses": { id: "molten-core-glasses", netCode: 26, name: "Clinkerglass Goggles", slot: "glasses", gearClass: "caster", rarity: "Rare", budgetUnits: 1, powerTag: "precision:burning-target", stats: {}, effectText: "+2 crit points against burning enemies", effectAvailability: "inert", artKey: "molten-core-glasses", legacySetId: "molten-core", originPool: "Ashlands" },
  "molten-core-facial-hair": { id: "molten-core-facial-hair", netCode: 27, name: "Furnace Fork", slot: "facialHair", gearClass: "caster", rarity: "Common", budgetUnits: 0, powerTag: "none", stats: {}, effectText: "Glows below 30% HP; no combat effect", artKey: "molten-core-facial-hair", legacySetId: "molten-core", originPool: "Ashlands" },
  "molten-core-shirt": { id: "molten-core-shirt", netCode: 28, name: "Furnace Shirt", slot: "shirt", gearClass: "caster", rarity: "Uncommon", budgetUnits: 1, powerTag: "spread:dex-to-int", stats: {}, spreadMoves: [{ from: "dex", to: "int" }], effectText: "DEX to INT", artKey: "molten-core-shirt", legacySetId: "molten-core", originPool: "Ashlands" },
  "molten-core-gloves": { id: "molten-core-gloves", netCode: 29, name: "Kilnhand Gloves", slot: "gloves", gearClass: "caster", rarity: "Rare", budgetUnits: 1, powerTag: "handling:caster-recovery", stats: {}, mods: { casterCooldownMult: 0.92, beamCooldownMult: 0.92 }, effectText: "Caster and beam attack recovery is 8% faster", artKey: "molten-core-gloves", legacySetId: "molten-core", originPool: "Ashlands" },
  "molten-core-pants": { id: "molten-core-pants", netCode: 30, name: "Coal-Seam Trousers", slot: "pants", gearClass: "caster", rarity: "Uncommon", budgetUnits: 1, powerTag: "spread:luk-to-int", stats: {}, spreadMoves: [{ from: "luk", to: "int" }], effectText: "LUK to INT", artKey: "molten-core-pants", legacySetId: "molten-core", originPool: "Ashlands" },
  "molten-core-boots": { id: "molten-core-boots", netCode: 31, name: "Slagstep Boots", slot: "boots", gearClass: "caster", rarity: "Uncommon", budgetUnits: 1, powerTag: "mobility:fire-terrain", stats: {}, effectText: "Fire-terrain movement penalties -20%", effectAvailability: "inert", artKey: "molten-core-boots", legacySetId: "molten-core", originPool: "Ashlands" },
  "molten-core-cloak": { id: "molten-core-cloak", netCode: 32, name: "Magma-Shed Mantle", slot: "cloak", gearClass: "caster", rarity: "Really Rare", budgetUnits: 2, powerTag: "defense:ground-hazard", stats: {}, mods: { groundHazardDamageMult: 0.9 }, effectText: "Fire and ground-hazard damage -10%", artKey: "molten-core-cloak", legacySetId: "molten-core", originPool: "Ashlands" },

  "coldsnap-hat": { id: "coldsnap-hat", netCode: 33, name: "Rimebrim Stetson", slot: "hat", gearClass: "scoundrel", rarity: "Ultimate", budgetUnits: 4, powerTag: "keystone:coldsnap", stats: {}, quirkRef: "coldsnap", effectText: "Ending a dodge restores 12% weapon resource; 4s cooldown", effectAvailability: "inert", artKey: "coldsnap-hat", legacySetId: "coldsnap", originPool: "Frostfell" },
  "coldsnap-glasses": { id: "coldsnap-glasses", netCode: 34, name: "Deadeye Snowglass", slot: "glasses", gearClass: "scoundrel", rarity: "Rare", budgetUnits: 2, powerTag: "precision:resource-restore", stats: {}, effectText: "+4 crit points for 1.5s after a resource restore", effectAvailability: "inert", artKey: "coldsnap-glasses", legacySetId: "coldsnap", originPool: "Frostfell" },
  "coldsnap-facial-hair": { id: "coldsnap-facial-hair", netCode: 35, name: "Coldsnap Handlebar", slot: "facialHair", gearClass: "scoundrel", rarity: "Common", budgetUnits: 0, powerTag: "none", stats: {}, effectText: "A restore draws frost breath; no combat effect", artKey: "coldsnap-facial-hair", legacySetId: "coldsnap", originPool: "Frostfell" },
  "coldsnap-shirt": { id: "coldsnap-shirt", netCode: 36, name: "Drifter's Duster Shirt", slot: "shirt", gearClass: "scoundrel", rarity: "Uncommon", budgetUnits: 1, powerTag: "spread:str-to-dex", stats: {}, spreadMoves: [{ from: "str", to: "dex" }], effectText: "STR to DEX", artKey: "coldsnap-shirt", legacySetId: "coldsnap", originPool: "Frostfell" },
  "coldsnap-gloves": { id: "coldsnap-gloves", netCode: 37, name: "Quickload Gloves", slot: "gloves", gearClass: "scoundrel", rarity: "Rare", budgetUnits: 1, powerTag: "handling:gun-recovery", stats: {}, mods: { gunCooldownMult: 0.94 }, effectText: "Gun attack recovery is 6% faster", artKey: "coldsnap-gloves", legacySetId: "coldsnap", originPool: "Frostfell" },
  "coldsnap-pants": { id: "coldsnap-pants", netCode: 38, name: "Frostline Trousers", slot: "pants", gearClass: "scoundrel", rarity: "Uncommon", budgetUnits: 1, powerTag: "spread:int-to-luk", stats: {}, spreadMoves: [{ from: "int", to: "luk" }], effectText: "INT to LUK", artKey: "coldsnap-pants", legacySetId: "coldsnap", originPool: "Frostfell" },
  "coldsnap-boots": { id: "coldsnap-boots", netCode: 39, name: "Black-Ice Boots", slot: "boots", gearClass: "scoundrel", rarity: "Uncommon", budgetUnits: 1, powerTag: "mobility:dodge-travel", stats: {}, effectText: "Dodge travel +8%", effectAvailability: "inert", artKey: "coldsnap-boots", legacySetId: "coldsnap", originPool: "Frostfell" },
  "coldsnap-cloak": { id: "coldsnap-cloak", netCode: 40, name: "Coldsnap Duster", slot: "cloak", gearClass: "scoundrel", rarity: "Really Rare", budgetUnits: 2, powerTag: "defense:ground-hazard", stats: {}, mods: { groundHazardDamageMult: 0.9 }, effectText: "Frost and ground-hazard damage -10%", artKey: "coldsnap-cloak", legacySetId: "coldsnap", originPool: "Frostfell" },

  "graveside-hat": { id: "graveside-hat", netCode: 41, name: "Sexton's Hat", slot: "hat", gearClass: "scoundrel", rarity: "Ultimate", budgetUnits: 4, powerTag: "keystone:graveside-manner", stats: {}, quirkRef: "graveside-manner", effectText: "Kills within 180 px heal 1 HP, capped at 5 HP/s", artKey: "graveside-hat", legacySetId: "graveside", originPool: "Wild West" },
  "graveside-glasses": { id: "graveside-glasses", netCode: 42, name: "Near-Death Readers", slot: "glasses", gearClass: "scoundrel", rarity: "Rare", budgetUnits: 1, powerTag: "precision:near-enemy", stats: {}, effectText: "+2 crit points within 180 px", effectAvailability: "inert", artKey: "graveside-glasses", legacySetId: "graveside", originPool: "Wild West" },
  "graveside-facial-hair": { id: "graveside-facial-hair", netCode: 43, name: "Graveside Whiskers", slot: "facialHair", gearClass: "scoundrel", rarity: "Common", budgetUnits: 0, powerTag: "none", stats: {}, effectText: "Qualifying close kills toll once; no combat effect", artKey: "graveside-facial-hair", legacySetId: "graveside", originPool: "Wild West" },
  "graveside-shirt": { id: "graveside-shirt", netCode: 44, name: "Parson's Black Shirt", slot: "shirt", gearClass: "scoundrel", rarity: "Uncommon", budgetUnits: 1, powerTag: "spread:con-to-luk", stats: {}, spreadMoves: [{ from: "con", to: "luk" }], effectText: "CON to LUK", artKey: "graveside-shirt", legacySetId: "graveside", originPool: "Wild West" },
  "graveside-gloves": { id: "graveside-gloves", netCode: 45, name: "Undertaker's Gloves", slot: "gloves", gearClass: "scoundrel", rarity: "Rare", budgetUnits: 1, powerTag: "handling:melee-recovery", stats: {}, mods: { meleeCooldownMult: 0.94 }, effectText: "Melee attack recovery is 6% faster", artKey: "graveside-gloves", legacySetId: "graveside", originPool: "Wild West" },
  "graveside-pants": { id: "graveside-pants", netCode: 46, name: "Wake Trousers", slot: "pants", gearClass: "scoundrel", rarity: "Uncommon", budgetUnits: 1, powerTag: "vitals:max-hp", stats: {}, mods: { maxHpAdd: 10 }, effectText: "+10 max HP", artKey: "graveside-pants", legacySetId: "graveside", originPool: "Wild West" },
  "graveside-boots": { id: "graveside-boots", netCode: 47, name: "Gravelane Boots", slot: "boots", gearClass: "scoundrel", rarity: "Uncommon", budgetUnits: 1, powerTag: "mobility:near-enemy", stats: {}, effectText: "+8% move speed while within 180 px of an enemy", effectAvailability: "inert", artKey: "graveside-boots", legacySetId: "graveside", originPool: "Wild West" },
  "graveside-cloak": { id: "graveside-cloak", netCode: 48, name: "Graveside Coat", slot: "cloak", gearClass: "scoundrel", rarity: "Really Rare", budgetUnits: 1, powerTag: "defense:near-enemy", stats: {}, effectText: "Incoming damage -6% while within 180 px of an enemy", effectAvailability: "inert", artKey: "graveside-cloak", legacySetId: "graveside", originPool: "Wild West" },

  "nine-veils-hat": { id: "nine-veils-hat", netCode: 49, name: "Nine-Veil Circlet", slot: "hat", gearClass: "caster", rarity: "Ultimate", budgetUnits: 4, powerTag: "keystone:sees-every-future", stats: {}, quirkRef: "sees-every-future", effectText: "Private enemy telegraph previews begin 25% earlier; server impact time is unchanged", effectAvailability: "inert", artKey: "nine-veils-hat", legacySetId: "nine-veils", originPool: "Frostfell" },
  "nine-veils-glasses": { id: "nine-veils-glasses", netCode: 50, name: "Tomorrowglass", slot: "glasses", gearClass: "caster", rarity: "Rare", budgetUnits: 1, powerTag: "precision:telegraph", stats: {}, effectText: "+2 crit points against an enemy in an active telegraph", effectAvailability: "inert", artKey: "nine-veils-glasses", legacySetId: "nine-veils", originPool: "Frostfell" },
  "nine-veils-facial-hair": { id: "nine-veils-facial-hair", netCode: 51, name: "Prophecy Wisps", slot: "facialHair", gearClass: "caster", rarity: "Common", budgetUnits: 0, powerTag: "none", stats: {}, effectText: "A clean tell-avoid leaves a paper afterimage; no combat effect", artKey: "nine-veils-facial-hair", legacySetId: "nine-veils", originPool: "Frostfell" },
  "nine-veils-shirt": { id: "nine-veils-shirt", netCode: 52, name: "First Veil Shirt", slot: "shirt", gearClass: "caster", rarity: "Uncommon", budgetUnits: 1, powerTag: "spread:str-to-int", stats: {}, spreadMoves: [{ from: "str", to: "int" }], effectText: "STR to INT", artKey: "nine-veils-shirt", legacySetId: "nine-veils", originPool: "Frostfell" },
  "nine-veils-gloves": { id: "nine-veils-gloves", netCode: 53, name: "Oracle's Gloves", slot: "gloves", gearClass: "caster", rarity: "Rare", budgetUnits: 1, powerTag: "handling:caster-recovery", stats: {}, mods: { casterCooldownMult: 0.92 }, effectText: "Caster attack recovery is 8% faster", artKey: "nine-veils-gloves", legacySetId: "nine-veils", originPool: "Frostfell" },
  "nine-veils-pants": { id: "nine-veils-pants", netCode: 54, name: "Ninth Veil Trousers", slot: "pants", gearClass: "caster", rarity: "Uncommon", budgetUnits: 1, powerTag: "spread:con-to-int", stats: {}, spreadMoves: [{ from: "con", to: "int" }], effectText: "CON to INT", artKey: "nine-veils-pants", legacySetId: "nine-veils", originPool: "Frostfell" },
  "nine-veils-boots": { id: "nine-veils-boots", netCode: 55, name: "Veilstep Slippers", slot: "boots", gearClass: "caster", rarity: "Uncommon", budgetUnits: 1, powerTag: "mobility:dodge-recovery", stats: {}, effectText: "Dodge recovery is 8% faster", effectAvailability: "inert", artKey: "nine-veils-boots", legacySetId: "nine-veils", originPool: "Frostfell" },
  "nine-veils-cloak": { id: "nine-veils-cloak", netCode: 56, name: "Forked-Future Cloak", slot: "cloak", gearClass: "caster", rarity: "Really Rare", budgetUnits: 1, powerTag: "defense:parry-frames", stats: {}, mods: { parryIFrameMult: 1.08 }, effectText: "Parry defensive frames +8%", artKey: "nine-veils-cloak", legacySetId: "nine-veils", originPool: "Frostfell" },

  "demon-mask-hat": { id: "demon-mask-hat", netCode: 57, name: "Demon Mask", slot: "hat", gearClass: "duelist", rarity: "Ultimate", budgetUnits: 4, powerTag: "keystone:temple-wall", stats: {}, quirkRef: "temple-wall", effectText: "Parry knockback x2; parried melee attackers are stunned 0.4s", effectAvailability: "partial", artKey: "demon-mask-hat", legacySetId: "demon-mask", originPool: "Verdant Ruins" },
  "demon-mask-glasses": { id: "demon-mask-glasses", netCode: 58, name: "Oni-Sight Lenses", slot: "glasses", gearClass: "duelist", rarity: "Rare", budgetUnits: 1, powerTag: "precision:melee", stats: {}, effectText: "+2 melee crit points", effectAvailability: "inert", artKey: "demon-mask-glasses", legacySetId: "demon-mask", originPool: "Verdant Ruins" },
  "demon-mask-facial-hair": { id: "demon-mask-facial-hair", netCode: 59, name: "Lacquered Tusks", slot: "facialHair", gearClass: "duelist", rarity: "Common", budgetUnits: 0, powerTag: "none", stats: {}, effectText: "Stunned enemies receive a TEMPLE WALL badge; no combat effect", artKey: "demon-mask-facial-hair", legacySetId: "demon-mask", originPool: "Verdant Ruins" },
  "demon-mask-shirt": { id: "demon-mask-shirt", netCode: 60, name: "Demon-Stitch Shirt", slot: "shirt", gearClass: "duelist", rarity: "Uncommon", budgetUnits: 1, powerTag: "spread:int-to-str", stats: {}, spreadMoves: [{ from: "int", to: "str" }], effectText: "INT to STR", artKey: "demon-mask-shirt", legacySetId: "demon-mask", originPool: "Verdant Ruins" },
  "demon-mask-gloves": { id: "demon-mask-gloves", netCode: 61, name: "Wallmaker Tekko", slot: "gloves", gearClass: "duelist", rarity: "Rare", budgetUnits: 1, powerTag: "handling:parry-recovery", stats: {}, mods: { parryCooldownMult: 0.92 }, effectText: "Parry recovery is 8% faster", artKey: "demon-mask-gloves", legacySetId: "demon-mask", originPool: "Verdant Ruins" },
  "demon-mask-pants": { id: "demon-mask-pants", netCode: 62, name: "Gatekeeper Hakama", slot: "pants", gearClass: "duelist", rarity: "Uncommon", budgetUnits: 1, powerTag: "spread:luk-to-con", stats: {}, spreadMoves: [{ from: "luk", to: "con" }], effectText: "LUK to CON", artKey: "demon-mask-pants", legacySetId: "demon-mask", originPool: "Verdant Ruins" },
  "demon-mask-boots": { id: "demon-mask-boots", netCode: 63, name: "Temple-Grip Sandals", slot: "boots", gearClass: "duelist", rarity: "Uncommon", budgetUnits: 2, powerTag: "mobility:impulse-resistance", stats: {}, effectText: "Knockback and pull distance -20%", effectAvailability: "inert", artKey: "demon-mask-boots", legacySetId: "demon-mask", originPool: "Verdant Ruins" },
  "demon-mask-cloak": { id: "demon-mask-cloak", netCode: 64, name: "Red Temple Cloak", slot: "cloak", gearClass: "duelist", rarity: "Really Rare", budgetUnits: 2, powerTag: "defense:melee", stats: {}, effectText: "Incoming melee damage -8%", effectAvailability: "inert", artKey: "demon-mask-cloak", legacySetId: "demon-mask", originPool: "Verdant Ruins" },

  "thornwatch-hat": { id: "thornwatch-hat", netCode: 65, name: "Thornwatch Plume", slot: "hat", gearClass: "duelist", rarity: "Ultimate", budgetUnits: 4, powerTag: "keystone:insufferably-graceful", stats: {}, quirkRef: "insufferably-graceful", effectText: "A whiffed parry refunds its cooldown under the counter-only safety rule", effectAvailability: "inert", artKey: "thornwatch-hat", legacySetId: "thornwatch", originPool: "Verdant Ruins" },
  "thornwatch-glasses": { id: "thornwatch-glasses", netCode: 66, name: "Gracepoint Glasses", slot: "glasses", gearClass: "duelist", rarity: "Rare", budgetUnits: 1, powerTag: "precision:recent-parry", stats: {}, effectText: "+2 crit points for 2s after a successful parry", effectAvailability: "inert", artKey: "thornwatch-glasses", legacySetId: "thornwatch", originPool: "Verdant Ruins" },
  "thornwatch-facial-hair": { id: "thornwatch-facial-hair", netCode: 67, name: "Thorncurl Moustache", slot: "facialHair", gearClass: "duelist", rarity: "Common", budgetUnits: 0, powerTag: "none", stats: {}, effectText: "A perfect parry prints Obviously.; no combat effect", artKey: "thornwatch-facial-hair", legacySetId: "thornwatch", originPool: "Verdant Ruins" },
  "thornwatch-shirt": { id: "thornwatch-shirt", netCode: 68, name: "Thornwatch Shirt", slot: "shirt", gearClass: "duelist", rarity: "Uncommon", budgetUnits: 1, powerTag: "spread:int-to-dex", stats: {}, spreadMoves: [{ from: "int", to: "dex" }], effectText: "INT to DEX", artKey: "thornwatch-shirt", legacySetId: "thornwatch", originPool: "Verdant Ruins" },
  "thornwatch-gloves": { id: "thornwatch-gloves", netCode: 69, name: "Roseguard Gloves", slot: "gloves", gearClass: "duelist", rarity: "Rare", budgetUnits: 1, powerTag: "handling:melee-recovery", stats: {}, mods: { meleeCooldownMult: 0.94 }, effectText: "Melee attack recovery is 6% faster", artKey: "thornwatch-gloves", legacySetId: "thornwatch", originPool: "Verdant Ruins" },
  "thornwatch-pants": { id: "thornwatch-pants", netCode: 70, name: "Court-Duel Trousers", slot: "pants", gearClass: "duelist", rarity: "Uncommon", budgetUnits: 1, powerTag: "spread:luk-to-dex", stats: {}, spreadMoves: [{ from: "luk", to: "dex" }], effectText: "LUK to DEX", artKey: "thornwatch-pants", legacySetId: "thornwatch", originPool: "Verdant Ruins" },
  "thornwatch-boots": { id: "thornwatch-boots", netCode: 71, name: "Thornstep Boots", slot: "boots", gearClass: "duelist", rarity: "Uncommon", budgetUnits: 1, powerTag: "mobility:recent-parry", stats: {}, effectText: "+8% move speed for 2s after a successful parry", effectAvailability: "inert", artKey: "thornwatch-boots", legacySetId: "thornwatch", originPool: "Verdant Ruins" },
  "thornwatch-cloak": { id: "thornwatch-cloak", netCode: 72, name: "Insufferable Cloak", slot: "cloak", gearClass: "duelist", rarity: "Really Rare", budgetUnits: 2, powerTag: "defense:parry-frames", stats: {}, mods: { parryIFrameMult: 1.1 }, effectText: "Parry defensive frames +10%", artKey: "thornwatch-cloak", legacySetId: "thornwatch", originPool: "Verdant Ruins" },

  "neon-mirage-hat": { id: "neon-mirage-hat", netCode: 73, name: "Zero-Latency Cap", slot: "hat", gearClass: "duelist", rarity: "Ultimate", budgetUnits: 4, powerTag: "keystone:package-deal", stats: {}, quirkRef: "package-deal", effectText: "Weapon swaps have no draw-lock", artKey: "neon-mirage-hat", legacySetId: "neon-mirage", originPool: "Neon-Cyber" },
  "neon-mirage-glasses": { id: "neon-mirage-glasses", netCode: 74, name: "Reticle Glasses", slot: "glasses", gearClass: "duelist", rarity: "Rare", budgetUnits: 2, powerTag: "precision:recent-swap", stats: {}, effectText: "The first hit within 1s of a swap gains +3 crit points", effectAvailability: "inert", artKey: "neon-mirage-glasses", legacySetId: "neon-mirage", originPool: "Neon-Cyber" },
  "neon-mirage-facial-hair": { id: "neon-mirage-facial-hair", netCode: 75, name: "Pixel Five-O'Clock", slot: "facialHair", gearClass: "duelist", rarity: "Common", budgetUnits: 0, powerTag: "none", stats: {}, effectText: "Swaps leave a palette afterimage; no combat effect", artKey: "neon-mirage-facial-hair", legacySetId: "neon-mirage", originPool: "Neon-Cyber" },
  "neon-mirage-shirt": { id: "neon-mirage-shirt", netCode: 76, name: "Signal Shirt", slot: "shirt", gearClass: "duelist", rarity: "Uncommon", budgetUnits: 1, powerTag: "spread:str-to-dex", stats: {}, spreadMoves: [{ from: "str", to: "dex" }], effectText: "STR to DEX", artKey: "neon-mirage-shirt", legacySetId: "neon-mirage", originPool: "Neon-Cyber" },
  "neon-mirage-gloves": { id: "neon-mirage-gloves", netCode: 77, name: "Hot-Swap Gloves", slot: "gloves", gearClass: "duelist", rarity: "Rare", budgetUnits: 1, powerTag: "handling:weapon-recovery", stats: {}, mods: { weaponCooldownMult: 0.94 }, effectText: "Weapon attack recovery is 6% faster", artKey: "neon-mirage-gloves", legacySetId: "neon-mirage", originPool: "Neon-Cyber" },
  "neon-mirage-pants": { id: "neon-mirage-pants", netCode: 78, name: "Chromeline Pants", slot: "pants", gearClass: "duelist", rarity: "Uncommon", budgetUnits: 1, powerTag: "spread:int-to-dex", stats: {}, spreadMoves: [{ from: "int", to: "dex" }], effectText: "INT to DEX", artKey: "neon-mirage-pants", legacySetId: "neon-mirage", originPool: "Neon-Cyber" },
  "neon-mirage-boots": { id: "neon-mirage-boots", netCode: 79, name: "Afterimage Trainers", slot: "boots", gearClass: "duelist", rarity: "Uncommon", budgetUnits: 1, powerTag: "mobility:recent-swap", stats: {}, effectText: "+8% move speed for 1s after a weapon swap", effectAvailability: "inert", artKey: "neon-mirage-boots", legacySetId: "neon-mirage", originPool: "Neon-Cyber" },
  "neon-mirage-cloak": { id: "neon-mirage-cloak", netCode: 80, name: "Packet-Loss Cloak", slot: "cloak", gearClass: "duelist", rarity: "Really Rare", budgetUnits: 1, powerTag: "defense:recent-swap", stats: {}, effectText: "Incoming damage -6% for 1s after a swap", effectAvailability: "inert", artKey: "neon-mirage-cloak", legacySetId: "neon-mirage", originPool: "Neon-Cyber" },

  "house-edge-hat": { id: "house-edge-hat", netCode: 81, name: "Quickfinger's Boater", slot: "hat", gearClass: "scoundrel", rarity: "Ultimate", budgetUnits: 4, powerTag: "keystone:the-house", stats: {}, quirkRef: "the-house", effectText: "Eligible weapon and gear tier rolls twice and keeps the higher tier", effectAvailability: "inert", artKey: "house-edge-hat", legacySetId: "house-edge", originPool: "Wild West" },
  "house-edge-glasses": { id: "house-edge-glasses", netCode: 82, name: "Double-Down Lenses", slot: "glasses", gearClass: "scoundrel", rarity: "Rare", budgetUnits: 1, powerTag: "economy:duplicate-scrip", stats: {}, effectText: "Duplicate gear yields +10% Scrip, rounded down after the run total", effectAvailability: "inert", artKey: "house-edge-glasses", legacySetId: "house-edge", originPool: "Wild West" },
  "house-edge-facial-hair": { id: "house-edge-facial-hair", netCode: 83, name: "House Pencil", slot: "facialHair", gearClass: "scoundrel", rarity: "Common", budgetUnits: 0, powerTag: "none", stats: {}, effectText: "Duplicate receipts flip a paper coin; no combat effect", artKey: "house-edge-facial-hair", legacySetId: "house-edge", originPool: "Wild West" },
  "house-edge-shirt": { id: "house-edge-shirt", netCode: 84, name: "Lacroix Shirt", slot: "shirt", gearClass: "scoundrel", rarity: "Uncommon", budgetUnits: 1, powerTag: "spread:str-to-luk", stats: {}, spreadMoves: [{ from: "str", to: "luk" }], effectText: "STR to LUK", artKey: "house-edge-shirt", legacySetId: "house-edge", originPool: "Wild West" },
  "house-edge-gloves": { id: "house-edge-gloves", netCode: 85, name: "Dealer's Gloves", slot: "gloves", gearClass: "scoundrel", rarity: "Rare", budgetUnits: 1, powerTag: "handling:gun-recovery", stats: {}, mods: { gunCooldownMult: 0.94 }, effectText: "Gun attack recovery is 6% faster", artKey: "house-edge-gloves", legacySetId: "house-edge", originPool: "Wild West" },
  "house-edge-pants": { id: "house-edge-pants", netCode: 86, name: "Loaded-Seam Pants", slot: "pants", gearClass: "scoundrel", rarity: "Uncommon", budgetUnits: 1, powerTag: "spread:int-to-luk", stats: {}, spreadMoves: [{ from: "int", to: "luk" }], effectText: "INT to LUK", artKey: "house-edge-pants", legacySetId: "house-edge", originPool: "Wild West" },
  "house-edge-boots": { id: "house-edge-boots", netCode: 87, name: "House-Edge Boots", slot: "boots", gearClass: "scoundrel", rarity: "Uncommon", budgetUnits: 1, powerTag: "mobility:visible-loot", stats: {}, effectText: "+6% move speed while owned loot is visible within 240 px", effectAvailability: "inert", artKey: "house-edge-boots", legacySetId: "house-edge", originPool: "Wild West" },
  "house-edge-cloak": { id: "house-edge-cloak", netCode: 88, name: "Inside-Pocket Cloak", slot: "cloak", gearClass: "scoundrel", rarity: "Really Rare", budgetUnits: 1, powerTag: "utility:pickup-reach", stats: {}, mods: { pickupReachMult: 1.1 }, effectText: "Owned-pickup reach +10%", artKey: "house-edge-cloak", legacySetId: "house-edge", originPool: "Wild West" },

  "unbending-hat": { id: "unbending-hat", netCode: 89, name: "Unbending Greathelm", slot: "hat", gearClass: "warden", rarity: "Ultimate", budgetUnits: 4, powerTag: "keystone:the-unbending", stats: {}, quirkRef: "the-unbending", effectText: "No single accepted damage event deals more than 25% max HP", artKey: "unbending-hat", legacySetId: "unbending", originPool: "Frostfell" },
  "unbending-glasses": { id: "unbending-glasses", netCode: 90, name: "Impact Readers", slot: "glasses", gearClass: "warden", rarity: "Rare", budgetUnits: 1, powerTag: "precision:capped-hit", stats: {}, effectText: "Taking a capped hit grants +2 crit points for 3s", effectAvailability: "inert", artKey: "unbending-glasses", legacySetId: "unbending", originPool: "Frostfell" },
  "unbending-facial-hair": { id: "unbending-facial-hair", netCode: 91, name: "Ironclad Beard", slot: "facialHair", gearClass: "warden", rarity: "Common", budgetUnits: 0, powerTag: "none", stats: {}, effectText: "Capped hits stamp UNBENT; no combat effect", artKey: "unbending-facial-hair", legacySetId: "unbending", originPool: "Frostfell" },
  "unbending-shirt": { id: "unbending-shirt", netCode: 92, name: "Keepwall Shirt", slot: "shirt", gearClass: "warden", rarity: "Uncommon", budgetUnits: 1, powerTag: "spread:dex-to-con", stats: {}, spreadMoves: [{ from: "dex", to: "con" }], effectText: "DEX to CON", artKey: "unbending-shirt", legacySetId: "unbending", originPool: "Frostfell" },
  "unbending-gloves": { id: "unbending-gloves", netCode: 93, name: "Unbending Gauntlets", slot: "gloves", gearClass: "warden", rarity: "Rare", budgetUnits: 1, powerTag: "handling:heavy-recovery", stats: {}, mods: { heavyCooldownMult: 0.94 }, effectText: "Heavy-weapon attack recovery is 6% faster", artKey: "unbending-gloves", legacySetId: "unbending", originPool: "Frostfell" },
  "unbending-pants": { id: "unbending-pants", netCode: 94, name: "Last-Stand Trousers", slot: "pants", gearClass: "warden", rarity: "Uncommon", budgetUnits: 1, powerTag: "spread:int-to-con", stats: {}, spreadMoves: [{ from: "int", to: "con" }], effectText: "INT to CON", artKey: "unbending-pants", legacySetId: "unbending", originPool: "Frostfell" },
  "unbending-boots": { id: "unbending-boots", netCode: 95, name: "Marchfast Greaves", slot: "boots", gearClass: "warden", rarity: "Uncommon", budgetUnits: 2, powerTag: "mobility:impulse-resistance", stats: {}, effectText: "Knockback and pull distance -20%", effectAvailability: "inert", artKey: "unbending-boots", legacySetId: "unbending", originPool: "Frostfell" },
  "unbending-cloak": { id: "unbending-cloak", netCode: 96, name: "Castleback Cloak", slot: "cloak", gearClass: "warden", rarity: "Really Rare", budgetUnits: 2, powerTag: "defense:low-hp", stats: {}, effectText: "Incoming damage -8% below 50% HP", effectAvailability: "inert", artKey: "unbending-cloak", legacySetId: "unbending", originPool: "Frostfell" },

  "pressurized-hat": { id: "pressurized-hat", netCode: 97, name: "Magnus Pressure Hat", slot: "hat", gearClass: "caster", rarity: "Ultimate", budgetUnits: 4, powerTag: "keystone:pressurized", stats: {}, quirkRef: "pressurized", effectText: "Beam heat vents 25% faster and overheat lock duration x0.5", artKey: "pressurized-hat", legacySetId: "pressurized", originPool: "Neon-Cyber" },
  "pressurized-glasses": { id: "pressurized-glasses", netCode: 98, name: "Gaugeglass", slot: "glasses", gearClass: "caster", rarity: "Rare", budgetUnits: 1, powerTag: "precision:beam", stats: {}, effectText: "+2 beam crit points", effectAvailability: "inert", artKey: "pressurized-glasses", legacySetId: "pressurized", originPool: "Neon-Cyber" },
  "pressurized-facial-hair": { id: "pressurized-facial-hair", netCode: 99, name: "Brasswick Whiskers", slot: "facialHair", gearClass: "caster", rarity: "Common", budgetUnits: 0, powerTag: "none", stats: {}, effectText: "Natural overheat sounds a pressure whistle; no combat effect", artKey: "pressurized-facial-hair", legacySetId: "pressurized", originPool: "Neon-Cyber" },
  "pressurized-shirt": { id: "pressurized-shirt", netCode: 100, name: "Boiler Shirt", slot: "shirt", gearClass: "caster", rarity: "Uncommon", budgetUnits: 1, powerTag: "spread:str-to-int", stats: {}, spreadMoves: [{ from: "str", to: "int" }], effectText: "STR to INT", artKey: "pressurized-shirt", legacySetId: "pressurized", originPool: "Neon-Cyber" },
  "pressurized-gloves": { id: "pressurized-gloves", netCode: 101, name: "Calibration Gloves", slot: "gloves", gearClass: "caster", rarity: "Rare", budgetUnits: 1, powerTag: "handling:beam-steering", stats: {}, effectText: "Beam steering lag -10%", effectAvailability: "inert", artKey: "pressurized-gloves", legacySetId: "pressurized", originPool: "Neon-Cyber" },
  "pressurized-pants": { id: "pressurized-pants", netCode: 102, name: "Vent-Seam Trousers", slot: "pants", gearClass: "caster", rarity: "Uncommon", budgetUnits: 1, powerTag: "spread:luk-to-int", stats: {}, spreadMoves: [{ from: "luk", to: "int" }], effectText: "LUK to INT", artKey: "pressurized-pants", legacySetId: "pressurized", originPool: "Neon-Cyber" },
  "pressurized-boots": { id: "pressurized-boots", netCode: 103, name: "Pressure-Valve Boots", slot: "boots", gearClass: "caster", rarity: "Uncommon", budgetUnits: 1, powerTag: "mobility:beam-cooling", stats: {}, effectText: "+8% move speed while a beam is cooling or locked", effectAvailability: "inert", artKey: "pressurized-boots", legacySetId: "pressurized", originPool: "Neon-Cyber" },
  "pressurized-cloak": { id: "pressurized-cloak", netCode: 104, name: "Blast Apron", slot: "cloak", gearClass: "caster", rarity: "Really Rare", budgetUnits: 2, powerTag: "defense:ground-hazard", stats: {}, mods: { groundHazardDamageMult: 0.9 }, effectText: "Ground-hazard damage -10%", artKey: "pressurized-cloak", legacySetId: "pressurized", originPool: "Neon-Cyber" },

  "mended-workshirt": { id: "mended-workshirt", netCode: 105, name: "Mended Workshirt", slot: "shirt", gearClass: "warden", rarity: "Uncommon", budgetUnits: 1, powerTag: "vitals:max-hp", stats: {}, mods: { maxHpAdd: 20 }, effectText: "+20 max HP", artKey: "mended-workshirt", legacySetId: "shopkeep-vitality" },
  "reinforced-workshirt": { id: "reinforced-workshirt", netCode: 106, name: "Reinforced Workshirt", slot: "shirt", gearClass: "warden", rarity: "Uncommon", budgetUnits: 2, powerTag: "vitals:max-hp", stats: {}, mods: { maxHpAdd: 40 }, effectText: "+40 max HP", artKey: "reinforced-workshirt", legacySetId: "shopkeep-vitality" },
  "shopkeeps-sunday-best": { id: "shopkeeps-sunday-best", netCode: 107, name: "Shopkeep's Sunday Best", slot: "shirt", gearClass: "warden", rarity: "Uncommon", budgetUnits: 3, powerTag: "vitals:max-hp", stats: {}, mods: { maxHpAdd: 60 }, effectText: "+60 max HP", artKey: "shopkeeps-sunday-best", legacySetId: "shopkeep-vitality" },
  "brass-readers": { id: "brass-readers", netCode: 108, name: "Brass Readers", slot: "glasses", gearClass: "scoundrel", rarity: "Rare", budgetUnits: 1, powerTag: "stat:luk", stats: { luk: 1 }, effectText: "+1 flat LUK", artKey: "brass-readers", legacySetId: "shopkeep-fortune" },
  "lucky-readers": { id: "lucky-readers", netCode: 109, name: "Lucky Readers", slot: "glasses", gearClass: "scoundrel", rarity: "Rare", budgetUnits: 2, powerTag: "stat:luk", stats: { luk: 2 }, effectText: "+2 flat LUK", artKey: "lucky-readers", legacySetId: "shopkeep-fortune" },
  "loaded-readers": { id: "loaded-readers", netCode: 110, name: "Loaded Readers", slot: "glasses", gearClass: "scoundrel", rarity: "Rare", budgetUnits: 3, powerTag: "stat:luk", stats: { luk: 3 }, effectText: "+3 flat LUK", artKey: "loaded-readers", legacySetId: "shopkeep-fortune" },
  "work-gloves": { id: "work-gloves", netCode: 111, name: "Work Gloves", slot: "gloves", gearClass: "bruiser", rarity: "Rare", budgetUnits: 1, powerTag: "stat:str", stats: { str: 1 }, effectText: "+1 flat STR", artKey: "work-gloves", legacySetId: "shopkeep-power" },
  "knuckled-gloves": { id: "knuckled-gloves", netCode: 112, name: "Knuckled Gloves", slot: "gloves", gearClass: "bruiser", rarity: "Rare", budgetUnits: 2, powerTag: "stat:str", stats: { str: 2 }, effectText: "+2 flat STR", artKey: "knuckled-gloves", legacySetId: "shopkeep-power" },
  "ironhand-gloves": { id: "ironhand-gloves", netCode: 113, name: "Ironhand Gloves", slot: "gloves", gearClass: "bruiser", rarity: "Rare", budgetUnits: 3, budgetException: "legacy-upgrade-rank-3", powerTag: "stat:str", stats: { str: 3 }, effectText: "+3 flat STR", artKey: "ironhand-gloves", legacySetId: "shopkeep-power" },
} as const satisfies Record<string, GearDef>;

export type GearId = keyof typeof GEAR_CATALOG;

export const GEAR_IDS = [
  "blank-drifter-hat", "blank-drifter-glasses", "blank-drifter-facial-hair", "blank-drifter-shirt", "blank-drifter-gloves", "blank-drifter-pants", "blank-drifter-boots", "blank-drifter-cloak",
  "ash-walker-hat", "ash-walker-glasses", "ash-walker-facial-hair", "ash-walker-shirt", "ash-walker-gloves", "ash-walker-pants", "ash-walker-boots", "ash-walker-cloak",
  "ashen-crusader-hat", "ashen-crusader-glasses", "ashen-crusader-facial-hair", "ashen-crusader-shirt", "ashen-crusader-gloves", "ashen-crusader-pants", "ashen-crusader-boots", "ashen-crusader-cloak",
  "molten-core-hat", "molten-core-glasses", "molten-core-facial-hair", "molten-core-shirt", "molten-core-gloves", "molten-core-pants", "molten-core-boots", "molten-core-cloak",
  "coldsnap-hat", "coldsnap-glasses", "coldsnap-facial-hair", "coldsnap-shirt", "coldsnap-gloves", "coldsnap-pants", "coldsnap-boots", "coldsnap-cloak",
  "graveside-hat", "graveside-glasses", "graveside-facial-hair", "graveside-shirt", "graveside-gloves", "graveside-pants", "graveside-boots", "graveside-cloak",
  "nine-veils-hat", "nine-veils-glasses", "nine-veils-facial-hair", "nine-veils-shirt", "nine-veils-gloves", "nine-veils-pants", "nine-veils-boots", "nine-veils-cloak",
  "demon-mask-hat", "demon-mask-glasses", "demon-mask-facial-hair", "demon-mask-shirt", "demon-mask-gloves", "demon-mask-pants", "demon-mask-boots", "demon-mask-cloak",
  "thornwatch-hat", "thornwatch-glasses", "thornwatch-facial-hair", "thornwatch-shirt", "thornwatch-gloves", "thornwatch-pants", "thornwatch-boots", "thornwatch-cloak",
  "neon-mirage-hat", "neon-mirage-glasses", "neon-mirage-facial-hair", "neon-mirage-shirt", "neon-mirage-gloves", "neon-mirage-pants", "neon-mirage-boots", "neon-mirage-cloak",
  "house-edge-hat", "house-edge-glasses", "house-edge-facial-hair", "house-edge-shirt", "house-edge-gloves", "house-edge-pants", "house-edge-boots", "house-edge-cloak",
  "unbending-hat", "unbending-glasses", "unbending-facial-hair", "unbending-shirt", "unbending-gloves", "unbending-pants", "unbending-boots", "unbending-cloak",
  "pressurized-hat", "pressurized-glasses", "pressurized-facial-hair", "pressurized-shirt", "pressurized-gloves", "pressurized-pants", "pressurized-boots", "pressurized-cloak",
  "mended-workshirt", "reinforced-workshirt", "shopkeeps-sunday-best", "brass-readers", "lucky-readers", "loaded-readers", "work-gloves", "knuckled-gloves", "ironhand-gloves",
] as const satisfies readonly GearId[];

export const LAUNCH_GEAR_IDS = [
  ...GEAR_IDS.slice(8, 104),
] as const satisfies readonly GearId[];

export const STARTER_GEAR_LOADOUT = {
  hat: "blank-drifter-hat",
  glasses: "blank-drifter-glasses",
  facialHair: "blank-drifter-facial-hair",
  shirt: "blank-drifter-shirt",
  gloves: "blank-drifter-gloves",
  pants: "blank-drifter-pants",
  boots: "blank-drifter-boots",
  cloak: "blank-drifter-cloak",
} as const satisfies Readonly<Record<GearSlot, GearId>>;

export const STARTER_GEAR_IDS = [
  STARTER_GEAR_LOADOUT.hat,
  STARTER_GEAR_LOADOUT.glasses,
  STARTER_GEAR_LOADOUT.facialHair,
  STARTER_GEAR_LOADOUT.shirt,
  STARTER_GEAR_LOADOUT.gloves,
  STARTER_GEAR_LOADOUT.pants,
  STARTER_GEAR_LOADOUT.boots,
  STARTER_GEAR_LOADOUT.cloak,
] as const;

/** Class values are provenance/filtering in this wave; no unauthored threshold power is invented. */
export const GEAR_CLASS_BONUSES = {
  bruiser: [],
  duelist: [],
  caster: [],
  warden: [],
  scoundrel: [],
} as const satisfies Readonly<Record<GearClassId, readonly never[]>>;

export interface GearRunRuntime {
  readonly catalogVersion: number;
  readonly idsBySlot: Readonly<Record<GearSlot, GearId>>;
  readonly baseStats: Readonly<Record<Attr, number>>;
  readonly classCounts: Readonly<Record<GearClassId, number>>;
  readonly mods: RuntimeMods;
  readonly quirk: QuirkDef;
}

const DEFAULT_RUNTIME_MODS: RuntimeMods = Object.freeze({
  ballastFollowsChoice: false,
  rollCooldownMult: 1,
  parryIFrameMult: 1,
  parryKnockbackMult: 1,
  critChanceAdd: 0,
  regenMult: 1,
  harvestMult: 1,
  drawLockMult: 1,
  beamVentMult: 1,
  beamOverheatLockMult: 1,
  incomingDamageCapFrac: 1,
  parryChainNeverExpires: false,
  maxHpAdd: 0,
  outgoingWeaponDamageMult: 1,
  weaponCooldownMult: 1,
  gunCooldownMult: 1,
  meleeCooldownMult: 1,
  casterCooldownMult: 1,
  beamCooldownMult: 1,
  heavyCooldownMult: 1,
  parryCooldownMult: 1,
  healingReceivedMult: 1,
  groundHazardDamageMult: 1,
  pickupReachMult: 1,
});

const multiplicativeKeys = [
  "rollCooldownMult", "parryIFrameMult", "parryKnockbackMult", "regenMult", "harvestMult",
  "drawLockMult", "beamVentMult", "beamOverheatLockMult", "outgoingWeaponDamageMult",
  "weaponCooldownMult", "gunCooldownMult", "meleeCooldownMult", "casterCooldownMult",
  "beamCooldownMult", "heavyCooldownMult", "parryCooldownMult", "healingReceivedMult",
  "groundHazardDamageMult", "pickupReachMult",
] as const;

function composeMods(target: Record<string, number | boolean>, source: Readonly<Partial<QuirkMods & GearScalarMods>> | undefined): void {
  if (!source) return;
  for (const key of multiplicativeKeys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) target[key] = Number(target[key]) * value;
  }
  if (typeof source.critChanceAdd === "number" && Number.isFinite(source.critChanceAdd)) target.critChanceAdd = Number(target.critChanceAdd) + source.critChanceAdd;
  if (typeof source.maxHpAdd === "number" && Number.isFinite(source.maxHpAdd)) target.maxHpAdd = Number(target.maxHpAdd) + source.maxHpAdd;
  if (typeof source.incomingDamageCapFrac === "number" && Number.isFinite(source.incomingDamageCapFrac)) target.incomingDamageCapFrac = Math.min(Number(target.incomingDamageCapFrac), source.incomingDamageCapFrac);
  target.ballastFollowsChoice = Boolean(target.ballastFollowsChoice) || source.ballastFollowsChoice === true;
  target.parryChainNeverExpires = Boolean(target.parryChainNeverExpires) || source.parryChainNeverExpires === true;
}

export function runtimeModsForQuirk(quirk: QuirkDef): RuntimeMods {
  const mods = { ...DEFAULT_RUNTIME_MODS } as Record<string, number | boolean>;
  composeMods(mods, quirk.mods);
  return Object.freeze(mods) as unknown as RuntimeMods;
}

export function isGearId(value: unknown): value is GearId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(GEAR_CATALOG, value);
}

export function isGearSlot(value: unknown): value is GearSlot {
  return typeof value === "string" && (GEAR_SLOTS as readonly string[]).includes(value);
}

const GEAR_BY_NET_CODE = new Map<number, GearDef>(GEAR_IDS.map((id) => [GEAR_CATALOG[id].netCode, GEAR_CATALOG[id]]));

export function gearForNetCode(code: number): GearDef | undefined {
  return Number.isInteger(code) && code > 0 ? GEAR_BY_NET_CODE.get(code) : undefined;
}

/** Canonical slot resolver. Invalid/unowned/wrong-slot/duplicate entries independently fall back. */
export function sanitizeEquippedGear(
  input: unknown,
  owned: ReadonlySet<GearId>,
): Record<GearSlot, GearId> {
  const source = typeof input === "object" && input !== null && !Array.isArray(input)
    ? input as Record<string, unknown>
    : undefined;
  const output = { ...STARTER_GEAR_LOADOUT } as Record<GearSlot, GearId>;
  const used = new Set<GearId>();
  for (const slot of GEAR_SLOTS) {
    const candidate = source?.[slot];
    const id = isGearId(candidate) && owned.has(candidate) && GEAR_CATALOG[candidate].slot === slot
      ? candidate
      : STARTER_GEAR_LOADOUT[slot];
    output[slot] = used.has(id) ? STARTER_GEAR_LOADOUT[slot] : id;
    used.add(output[slot]);
  }
  return output;
}

export function resolveGearLoadout(idsBySlot: Readonly<Record<GearSlot, GearId>>): GearRunRuntime {
  const stats: Record<Attr, number> = { str: 2, dex: 2, int: 2, con: 2, luk: 2 };
  for (const slot of ["shirt", "pants"] as const) {
    const item: GearDef = GEAR_CATALOG[idsBySlot[slot]];
    for (const move of item.spreadMoves ?? []) {
      if (stats[move.from] > 1 && stats[move.to] < 4) {
        stats[move.from]--;
        stats[move.to]++;
      }
    }
  }
  const classCounts: Record<GearClassId, number> = { bruiser: 0, duelist: 0, caster: 0, warden: 0, scoundrel: 0 };
  const hat: GearDef = GEAR_CATALOG[idsBySlot.hat];
  const quirk: QuirkDef = hat.quirkRef ? QUIRKS[hat.quirkRef] : QUIRKS.none;
  const mods = { ...DEFAULT_RUNTIME_MODS } as Record<string, number | boolean>;
  composeMods(mods, quirk.mods);
  for (const slot of GEAR_SLOTS) {
    const item: GearDef = GEAR_CATALOG[idsBySlot[slot]];
    classCounts[item.gearClass]++;
    for (const attr of ATTRS) stats[attr] += item.stats[attr] ?? 0;
    composeMods(mods, item.mods);
  }
  return Object.freeze({
    catalogVersion: GEAR_CATALOG_VERSION,
    idsBySlot: Object.freeze({ ...idsBySlot }),
    baseStats: Object.freeze(stats),
    classCounts: Object.freeze(classCounts),
    mods: Object.freeze(mods) as unknown as RuntimeMods,
    quirk,
  });
}

const UPPER_GEAR_SLOTS = ["hat", "glasses", "facialHair", "shirt", "cloak"] as const;
const LOWER_GEAR_SLOTS = ["gloves", "pants", "boots"] as const;

function encodeSlots(loadout: Readonly<Record<GearSlot, GearId>>, slots: readonly GearSlot[]): string {
  return slots.map((slot) => GEAR_CATALOG[loadout[slot]].netCode.toString(36)).join(",");
}

export function encodeGearCosmetics(loadout: Readonly<Record<GearSlot, GearId>>): { gearUpper: string; gearLower: string } {
  return { gearUpper: encodeSlots(loadout, UPPER_GEAR_SLOTS), gearLower: encodeSlots(loadout, LOWER_GEAR_SLOTS) };
}

function decodeSlots(value: unknown, slots: readonly GearSlot[], output: Record<GearSlot, GearId>): void {
  const tokens = typeof value === "string" ? value.split(",") : [];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!;
    const code = /^[0-9a-z]+$/.test(tokens[i] ?? "") ? Number.parseInt(tokens[i]!, 36) : 0;
    const item = gearForNetCode(code);
    output[slot] = item?.slot === slot ? item.id as GearId : STARTER_GEAR_LOADOUT[slot];
  }
}

/** Cosmetic-only decoder. Gameplay always resolves from the canonical account ids, never these strings. */
export function decodeGearCosmetics(gearUpper: unknown, gearLower: unknown): Record<GearSlot, GearId> {
  const output = { ...STARTER_GEAR_LOADOUT } as Record<GearSlot, GearId>;
  decodeSlots(gearUpper, UPPER_GEAR_SLOTS, output);
  decodeSlots(gearLower, LOWER_GEAR_SLOTS, output);
  return output;
}
