/**
 * §38 CHARACTER CLASSES — the mechanical identity behind the 40 cosmetic skins (§7). Previously every
 * character shared one hardcoded growth (auto STR + auto CON each level, `M0_CLASS_ATTR`/`M0_REQ_ATTR`),
 * so the pick was purely aesthetic. Each character now belongs to one of five ARCHETYPES; the archetype
 * sets which attribute AUTO-GROWS every level (`classAttr`) and the secondary requirement attr (`reqAttr`).
 *
 * This is deliberately data-only + reuses the existing §11/§12 scaling: the class just BIASES which attr the
 * Elden-Ring weapon grades read, so a Caster's levels feed INT-scaled weapons, a Duelist's feed DEX, etc.
 * `levelUpPlayer` reads the worn character each level, so swapping character (C key) re-aims future growth.
 *
 * Kept in its OWN file (not the auto-generated characters.ts) so re-running the roster generator can't clobber it.
 */
import type { Attr } from "./leveling.js";

export type CharClassId = "bruiser" | "duelist" | "caster" | "warden" | "scoundrel";

export interface CharClassDef {
  id: CharClassId;
  /** HUD label. */
  name: string;
  /** The attribute that AUTO-GROWS +1 every level (the build direction). */
  classAttr: Attr;
  /** The secondary attribute that also auto-grows +1 every level (the §12 "requirement" point). */
  reqAttr: Attr;
  /** One-line identity for the character card. */
  blurb: string;
}

export const CHAR_CLASSES: Record<CharClassId, CharClassDef> = {
  bruiser: {
    id: "bruiser",
    name: "Bruiser",
    classAttr: "str",
    reqAttr: "con",
    blurb: "Heavy melee. Grows STR + CON — hits hard, takes hits.",
  },
  duelist: {
    id: "duelist",
    name: "Duelist",
    classAttr: "dex",
    reqAttr: "luk",
    blurb: "Finesse blades. Grows DEX + LUK — fast, crit-hungry.",
  },
  caster: {
    id: "caster",
    name: "Caster",
    classAttr: "int",
    reqAttr: "con",
    blurb: "Arcane. Grows INT + CON — powers INT-scaled weapons.",
  },
  warden: {
    id: "warden",
    name: "Warden",
    classAttr: "con",
    reqAttr: "str",
    blurb: "Bulwark. Grows CON + STR — the squad's anchor.",
  },
  scoundrel: {
    id: "scoundrel",
    name: "Scoundrel",
    classAttr: "luk",
    reqAttr: "dex",
    blurb: "Gunslinger's luck. Grows LUK + DEX — crits + better loot.",
  },
};

/** Which archetype each roster character belongs to (bucketed by fantasy). Unknown/`drifter` → Bruiser. */
const CHARACTER_CLASS: Record<string, CharClassId> = {
  drifter: "bruiser",
  // Bruisers (STR) — rugged, monstrous, brawlers
  "cc-asha-the-ash-walker": "bruiser",
  "cc-bryda-houndcall": "bruiser",
  "cc-deepfall-korr": "bruiser",
  "cc-hollowmaw": "bruiser",
  "cc-mirelurk-caine": "bruiser",
  "cc-raijin-k-the-storm-fist": "bruiser",
  "cc-thornroot": "bruiser",
  // Duelists (DEX) — finesse blades, martial artists, assassins
  "cc-dame-veyra-of-the-thornwatch": "duelist",
  "cc-kuro-oni-the-demon-mask": "duelist",
  "cc-mei-ling-of-the-jade-ribbon": "duelist",
  "cc-s-jiro-the-wayward-blade": "duelist",
  "cc-the-hollow-mask": "duelist",
  "cc-yuki-the-hollow-smile": "duelist",
  "cc-neon-mirage": "duelist",
  "cc-crowmantle-sel": "duelist",
  // Casters (INT) — fire, hex, alchemy, arcane
  "cc-cinderpyre": "caster",
  "cc-corvane-the-crimson-draught": "caster",
  "cc-doctor-phineas-quill-esq": "caster",
  "cc-gravewake": "caster",
  "cc-iridia-of-the-nine-veils": "caster",
  "cc-mawkin-sourgrin-the-hex-witch": "caster",
  "cc-pyra-cinderhowl-the-flame-caster": "caster",
  "cc-tinker-magnus-brasswick": "caster",
  // Wardens (CON) — knights, crusaders, mech tanks
  "cc-bastion-vance": "warden",
  "cc-brother-cassian-the-ashen-crusader": "warden",
  "cc-brother-tendo-of-the-still-bell": "warden",
  "cc-cogwarden": "warden",
  "cc-sir-galloway-the-unbending": "warden",
  "cc-sir-mordrane-the-hollow-oath": "warden",
  "cc-halcyon-7": "warden",
  // Scoundrels (LUK) — gunslingers, gamblers, outlaws, thieves
  "cc-buzzard-jeptha-hale": "scoundrel",
  "cc-cordell-coldsnap-vane": "scoundrel",
  "cc-dunkel-the-coinblade": "scoundrel",
  "cc-elias-parson-thorne": "scoundrel",
  "cc-magdalene-the-ledger-crowe": "scoundrel",
  "cc-quickfinger-odette-lacroix": "scoundrel",
  "cc-the-bandida-la-sombra": "scoundrel",
  "cc-grix-boltcaster": "scoundrel",
  "cc-sable-cipher": "scoundrel",
};

/** The class def for a character id (defaults to Bruiser for the Drifter / any unmapped id). Never undefined. */
export function classForCharacter(id: string): CharClassDef {
  return CHAR_CLASSES[CHARACTER_CLASS[id] ?? "bruiser"];
}
