/**
 * §classmerge CHARACTER KITS — classes are dissolved. This hand-maintained module keeps the untrusted-id
 * guard, the former fantasy buckets as non-gating lineages, and the data-only quirk hook table. Starting
 * spreads and per-character quirk ids live beside the generated roster in characters.ts.
 */
import {
  CHARACTER_KITS,
  DEFAULT_CHARACTER,
  PLAYABLE_CHARACTERS,
  type PlayableCharacter,
} from "./characters.js";
import type { Attr } from "./leveling.js";

/** §39 untrusted-id guard → a real playable character id (dev-portal deep-links, network messages). */
export function isPlayableCharacter(id: string): boolean {
  return (PLAYABLE_CHARACTERS as readonly string[]).includes(id);
}

export type CharacterLineage = "bruiser" | "duelist" | "caster" | "warden" | "scoundrel";
export type CharacterSpread = Readonly<Record<Attr, number>>;
export type LegacyQuirkId = (typeof CHARACTER_KITS)[PlayableCharacter]["quirk"];
export type QuirkId = LegacyQuirkId | "none";
export type QuirkAvailability = "active" | "partial" | "inert";

export interface QuirkCtx {
  /** The successful parry's own chain-heal amount, if this is an onParrySuccess event. */
  parryHeal?: number;
  /** Id of the enemy killed by this identity, if this is an onKill event. */
  killedEnemyId?: string;
  /** Ground-plane distance from the killer to that enemy at the kill seam. */
  killDistance?: number;
}

/** Effect descriptors are interpreted only at the three named GameRoom seams. They never mutate a room. */
export type QuirkEffect =
  | { kind: "heal-nearest-ally"; amount: number; radius: number }
  | { kind: "heal-self"; amount: number; capPerSecond: number }
  | { kind: "reload-held-gun" };

export interface QuirkMods {
  /** Unwritten: the ballast point follows the chosen attribute instead of the current lowest. */
  ballastFollowsChoice: boolean;
  rollCooldownMult: number;
  parryIFrameMult: number;
  parryKnockbackMult: number;
  critChanceAdd: number;
  regenMult: number;
  harvestMult: number;
  drawLockMult: number;
  beamVentMult: number;
  beamOverheatLockMult: number;
  incomingDamageCapFrac: number;
  parryChainNeverExpires: boolean;
}

export interface InertQuirkDescriptor {
  /** The smallest missing system that must land before this declared behavior can become active. */
  requires: string;
  note: string;
}

export interface QuirkDef {
  id: QuirkId;
  name: string;
  blurb: string;
  availability: QuirkAvailability;
  mods?: Partial<QuirkMods>;
  hooks?: Partial<{
    onParrySuccess: (ctx: QuirkCtx) => QuirkEffect[];
    onRollEnd: (ctx: QuirkCtx) => QuirkEffect[];
    onKill: (ctx: QuirkCtx) => QuirkEffect[];
  }>;
  inert?: InertQuirkDescriptor;
}

/**
 * Former class buckets retained only as lineage metadata. They never gate allocation, weapons, augments,
 * verbs, or mechanics. The mapping is intentionally verbatim so content grouping survives dissolution.
 */
export const CHARACTER_LINEAGE = {
  drifter: "bruiser",
  "proto-samurai": "bruiser",
  "proto-sheriff": "bruiser",
  "proto-witch": "bruiser",
  "cc-asha-the-ash-walker": "bruiser",
  "cc-bryda-houndcall": "bruiser",
  "cc-deepfall-korr": "bruiser",
  "cc-hollowmaw": "bruiser",
  "cc-mirelurk-caine": "bruiser",
  "cc-raijin-k-the-storm-fist": "bruiser",
  "cc-thornroot": "bruiser",
  "cc-dame-veyra-of-the-thornwatch": "duelist",
  "cc-kuro-oni-the-demon-mask": "duelist",
  "cc-mei-ling-of-the-jade-ribbon": "duelist",
  "cc-s-jiro-the-wayward-blade": "duelist",
  "cc-the-hollow-mask": "duelist",
  "cc-yuki-the-hollow-smile": "duelist",
  "cc-neon-mirage": "duelist",
  "cc-crowmantle-sel": "duelist",
  "cc-cinderpyre": "caster",
  "cc-corvane-the-crimson-draught": "caster",
  "cc-doctor-phineas-quill-esq": "caster",
  "cc-gravewake": "caster",
  "cc-iridia-of-the-nine-veils": "caster",
  "cc-mawkin-sourgrin-the-hex-witch": "caster",
  "cc-pyra-cinderhowl-the-flame-caster": "caster",
  "cc-tinker-magnus-brasswick": "caster",
  "cc-bastion-vance": "warden",
  "cc-brother-cassian-the-ashen-crusader": "warden",
  "cc-brother-tendo-of-the-still-bell": "warden",
  "cc-cogwarden": "warden",
  "cc-sir-galloway-the-unbending": "warden",
  "cc-sir-mordrane-the-hollow-oath": "warden",
  "cc-halcyon-7": "warden",
  "cc-buzzard-jeptha-hale": "scoundrel",
  "cc-cordell-coldsnap-vane": "scoundrel",
  "cc-dunkel-the-coinblade": "scoundrel",
  "cc-elias-parson-thorne": "scoundrel",
  "cc-magdalene-the-ledger-crowe": "scoundrel",
  "cc-quickfinger-odette-lacroix": "scoundrel",
  "cc-the-bandida-la-sombra": "scoundrel",
  "cc-grix-boltcaster": "scoundrel",
  "cc-sable-cipher": "scoundrel",
} as const satisfies Record<PlayableCharacter, CharacterLineage>;

const inert = (requires: string, note: string): InertQuirkDescriptor => ({ requires, note });

/**
 * The full authored roster. `active` rows use shipped 21a seams/primitives. `partial` rows expose the
 * shippable part and name the remaining dependency. `inert` rows are intentionally declarative until their
 * named system exists; keeping them in the table prevents silent placeholder behavior.
 */
export const QUIRKS = {
  none: {
    id: "none",
    name: "No signature",
    blurb: "The blank Drifter has no signature rule.",
    availability: "active",
  },
  unwritten: {
    id: "unwritten",
    name: "Unwritten",
    blurb: "Ballast follows the chosen attribute instead of the current lowest.",
    availability: "active",
    mods: { ballastFollowsChoice: true },
  },
  "mend-the-broken": {
    id: "mend-the-broken",
    name: "Mend the Broken",
    blurb: "Her parry-chain heal also heals the nearest ally within 220px for the same amount.",
    availability: "active",
    hooks: {
      onParrySuccess: (ctx) => [
        { kind: "heal-nearest-ally", amount: ctx.parryHeal ?? 0, radius: 220 },
      ],
    },
  },
  "the-pack-finds-you": {
    id: "the-pack-finds-you",
    name: "The Pack Finds You",
    blurb: "Nearby XP motes and weapon drops crawl toward her.",
    availability: "inert",
    inert: inert("pickup-attraction", "Per-owner pickup magnet steering is not shipped."),
  },
  "mag-boots": {
    id: "mag-boots",
    name: "Mag-Boots",
    blurb: "Immune to knockback and pull effects.",
    availability: "inert",
    inert: inert("impulse-source-policy", "Player impulses do not yet carry quirk-aware source policy."),
  },
  "whispered-rites": {
    id: "whispered-rites",
    name: "Whispered Rites",
    blurb: "Enemies he Brands stay Branded twice as long.",
    availability: "inert",
    inert: inert("brand-source-ownership", "Brand timers do not retain the applying player id."),
  },
  "bog-patience": {
    id: "bog-patience",
    name: "Bog Patience",
    blurb: "Standing still for 1.5s cloaks him until he acts.",
    availability: "inert",
    inert: inert("target-cloak", "Enemy targeting has no per-player cloak channel."),
  },
  "thunder-behind": {
    id: "thunder-behind",
    name: "Thunder Behind",
    blurb: "Melee combo finishers arc a spark to the nearest enemy.",
    availability: "inert",
    inert: inert("melee-finisher-receipt", "The damage seam does not identify authored combo finishers."),
  },
  regrow: {
    id: "regrow",
    name: "Regrow",
    blurb: "Every hit he takes plants a damaging thorn patch at his feet.",
    availability: "inert",
    inert: inert("friendly-damage-zone", "ZoneState currently represents hostile player-damage puddles only."),
  },
  "insufferably-graceful": {
    id: "insufferably-graceful",
    name: "Insufferably Graceful",
    blurb: "A whiffed parry costs no cooldown.",
    availability: "inert",
    inert: inert("parry-window-outcome", "Parry presses do not retain a success/whiff receipt through expiry."),
  },
  "temple-wall": {
    id: "temple-wall",
    name: "Temple Wall",
    blurb: "Parry knockback is doubled; parried melee attackers are briefly stunned.",
    availability: "partial",
    mods: { parryKnockbackMult: 2 },
    inert: inert("enemy-status", "The doubled shove is active; a generic 0.4s enemy stun channel is absent."),
  },
  "ribbon-step": {
    id: "ribbon-step",
    name: "Ribbon Step",
    blurb: "She can fire and parry during the last 40% of her dodge roll.",
    availability: "inert",
    inert: inert("dodge-roll", "Wave 21b owns the committed roll stance and action tail."),
  },
  iai: {
    id: "iai",
    name: "Iai",
    blurb: "The first swing after a weapon draw or dodge roll is a guaranteed crit.",
    availability: "inert",
    inert: inert("qualified-attack-receipt", "No draw/roll-qualified next-attack latch exists."),
  },
  porcelain: {
    id: "porcelain",
    name: "Porcelain",
    blurb: "Once per dimension, a killing blow leaves her at 1 HP.",
    availability: "inert",
    inert: inert("dimension-life-token", "Per-dimension lethal-prevention tokens are not represented."),
  },
  "fox-dance": {
    id: "fox-dance",
    name: "Fox Dance",
    blurb: "Dodge roll holds two charges.",
    availability: "inert",
    mods: { rollCooldownMult: 1 },
    inert: inert("dodge-roll", "Wave 21b owns roll charges and recharge."),
  },
  "package-deal": {
    id: "package-deal",
    name: "Package Deal",
    blurb: "Weapon swaps have no draw-lock.",
    availability: "active",
    mods: { drawLockMult: 0 },
  },
  "a-better-owner": {
    id: "a-better-owner",
    name: "A Better Owner",
    blurb: "Rolling through an enemy pickpockets one scrip on a per-enemy cooldown.",
    availability: "inert",
    inert: inert("dodge-roll", "Wave 21b owns roll overlap events."),
  },
  "molten-core": {
    id: "molten-core",
    name: "Molten Core",
    blurb: "Below 30% HP, weapon hits ignite.",
    availability: "inert",
    inert: inert("enemy-burn-status", "Enemies have no source-owned ignite timer."),
  },
  "the-crimson-draught": {
    id: "the-crimson-draught",
    name: "The Crimson Draught",
    blurb: "May pay 3 HP to reset a cast cooldown.",
    availability: "inert",
    inert: inert("cast-reset-input", "Cooldown presses are buffered without a distinct reset intent."),
  },
  "snake-oil": {
    id: "snake-oil",
    name: "Snake Oil",
    blurb: "The shopkeeper shows one extra offer per visit.",
    availability: "inert",
    inert: inert("shop-offers", "The shop has no authoritative per-player offer draft."),
  },
  "already-dead": {
    id: "already-dead",
    name: "Already Dead",
    blurb: "Once per dimension, death grants a three-second kill-to-live grace.",
    availability: "inert",
    inert: inert("death-grace", "Downed state has no attacking grace phase or revocation ledger."),
  },
  "sees-every-future": {
    id: "sees-every-future",
    name: "Sees Every Future",
    blurb: "Enemy telegraphs render 25% earlier for her.",
    availability: "inert",
    inert: inert("private-telegraph-preview", "Telegraph rows are shared authoritative state."),
  },
  "bottled-spite": {
    id: "bottled-spite",
    name: "Bottled Spite",
    blurb: "Enemies that damage her are automatically Branded.",
    availability: "inert",
    inert: inert("damage-attacker-identity", "The player-damage seam does not retain an attacker id."),
  },
  "let-it-out": {
    id: "let-it-out",
    name: "Let It Out",
    blurb: "Her ignite and burn effects jump when their host dies.",
    availability: "inert",
    inert: inert("enemy-burn-status", "Enemy deaths cannot inspect a source-owned burn host."),
  },
  pressurized: {
    id: "pressurized",
    name: "Pressurized",
    blurb: "Beam weapons vent heat 25% faster and overheat lock is halved.",
    availability: "active",
    mods: { beamVentMult: 1.25, beamOverheatLockMult: 0.5 },
  },
  planted: {
    id: "planted",
    name: "Planted",
    blurb: "After 0.5s stationary, gain 20% damage reduction until moving.",
    availability: "inert",
    inert: inert("stationary-duration", "CombatState does not retain a stationary timer."),
  },
  "habit-and-prayer": {
    id: "habit-and-prayer",
    name: "Habit and Prayer",
    blurb: "His parry chain never times out; taking a hit resets it.",
    availability: "active",
    mods: { parryChainNeverExpires: true },
  },
  "one-perfect-strike": {
    id: "one-perfect-strike",
    name: "One Perfect Strike",
    blurb: "After two seconds without attacking, the next melee hit is doubled and staggers.",
    availability: "inert",
    inert: inert("qualified-attack-receipt", "No idle-attack latch is retained through the damage seam."),
  },
  "does-not-stop": {
    id: "does-not-stop",
    name: "Does Not Stop",
    blurb: "Immune to slows and stuns, with a longer dodge-roll cooldown.",
    availability: "inert",
    mods: { rollCooldownMult: 1.5 },
    inert: inert("dodge-roll", "Wave 21b owns roll cooldown; player slow/stun status is not generalized."),
  },
  "the-unbending": {
    id: "the-unbending",
    name: "The Unbending",
    blurb: "No single hit deals more than 25% of max HP.",
    availability: "active",
    mods: { incomingDamageCapFrac: 0.25 },
  },
  "hollow-oath": {
    id: "hollow-oath",
    name: "Hollow Oath",
    blurb: "At low HP, weapon damage rises but regeneration stops.",
    availability: "inert",
    inert: inert("conditional-damage-mod", "The shared damage/regen paths lack a conditional quirk context."),
  },
  "half-projection": {
    id: "half-projection",
    name: "Half Projection",
    blurb: "Dodge roll leaves a one-second targetable hardlight after-image.",
    availability: "inert",
    inert: inert("dodge-roll", "Wave 21b owns roll-end positioning; decoy entities are not generalized."),
  },
  "overstuffed-bandoliers": {
    id: "overstuffed-bandoliers",
    name: "Overstuffed Bandoliers",
    blurb: "Gun magazines gain 50% capacity.",
    availability: "inert",
    inert: inert("per-holder-magazine", "Magazine capacity is authored on the weapon definition."),
  },
  coldsnap: {
    id: "coldsnap",
    name: "Coldsnap",
    blurb: "His dodge roll reloads the held gun.",
    availability: "inert",
    hooks: { onRollEnd: () => [{ kind: "reload-held-gun" }] },
    inert: inert("dodge-roll", "The descriptor is declared; wave 21b owns the onRollEnd seam."),
  },
  "hazard-rates": {
    id: "hazard-rates",
    name: "Hazard Rates",
    blurb: "Starts with a fourth arsenal slot, but no bag.",
    availability: "inert",
    inert: inert("variable-arsenal-schema", "Arsenal slots are a fixed three-row schema array."),
  },
  "graveside-manner": {
    id: "graveside-manner",
    name: "Graveside Manner",
    blurb: "Kills within 180px heal 1 HP, capped at 5 HP per second.",
    availability: "active",
    hooks: {
      onKill: (ctx) =>
        (ctx.killDistance ?? Number.POSITIVE_INFINITY) <= 180
          ? [{ kind: "heal-self", amount: 1, capPerSecond: 5 }]
          : [],
    },
  },
  posted: {
    id: "posted",
    name: "Posted",
    blurb: "Elites she damaged are guaranteed to drop a weapon.",
    availability: "inert",
    inert: inert("per-enemy-damage-credit", "Enemies do not retain the set of players that damaged them."),
  },
  "the-house": {
    id: "the-house",
    name: "The House",
    blurb: "Loot rarity rolls twice and keeps the better result.",
    availability: "inert",
    inert: inert("loot-trigger-owner", "Squad-shared loot rolls do not identify a triggering character."),
  },
  "a-shape-in-the-dust": {
    id: "a-shape-in-the-dust",
    name: "A Shape in the Dust",
    blurb: "Dodge roll drops a smoke puff that briefly breaks enemy aim.",
    availability: "inert",
    inert: inert("dodge-roll", "Wave 21b owns roll-end effects; enemies have no aim-loss status."),
  },
  braced: {
    id: "braced",
    name: "Braced",
    blurb: "He can fire guns while rolling, ending roll i-frames when he fires.",
    availability: "inert",
    inert: inert("dodge-roll", "Wave 21b owns roll action gates and i-frame cancellation."),
  },
  "ice-breaker": {
    id: "ice-breaker",
    name: "ICE Breaker",
    blurb: "A successful parry jams nearby ranged attackers for two seconds.",
    availability: "inert",
    inert: inert("enemy-fire-lock", "Enemies have no generalized ranged-fire lock status."),
  },
} as const satisfies Record<QuirkId, QuirkDef>;

function characterKit(id: string): (typeof CHARACTER_KITS)[PlayableCharacter] {
  return CHARACTER_KITS[isPlayableCharacter(id) ? (id as PlayableCharacter) : DEFAULT_CHARACTER];
}

/** Non-gating fantasy bucket for card grouping and migration provenance. */
export function lineageForCharacter(id: string): CharacterLineage {
  return CHARACTER_LINEAGE[isPlayableCharacter(id) ? (id as PlayableCharacter) : DEFAULT_CHARACTER];
}

/** Sum-10 starting spread for a character; unknown ids resolve safely to the flat Drifter. */
export function spreadForCharacter(id: string): CharacterSpread {
  return characterKit(id).spread;
}

/** Signature quirk for a character; unknown ids resolve safely to the Drifter's Unwritten rule. */
export function quirkForCharacter(id: string): QuirkDef {
  return QUIRKS[characterKit(id).quirk];
}
