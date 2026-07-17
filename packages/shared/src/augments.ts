/**
 * §8 Parry augment pool (M0) — the melee class signature. Base parry = i-frames + knockback + a Superman
 * deflect (bullets glance off); ALL offense comes from augments. A flat, mix-and-matchable pool of 10 (NOT
 * branch-gated): you pick ONE per signature level (every 5th, §12), freely combining across the three flavor
 * tags. Pool (10) > picks (6 at cap 30), so every run builds a different custom parry. Augments STACK and
 * synergize rather than gate each other.
 *
 * `[RULED v0.81]` Offer model: each signature pick is a **3-of-9 random draft** (roguelike) — Pool>picks
 * implies a constrained offer, and the draft forces build variety + reuses the level-up pick UI. The owned
 * set is a CSV on `PlayerState.augments` (repeats = stacks); the offer is a CSV on `sigOffer`.
 */

import type { WeaponDef } from "./weapons.js";

export type AugmentTag = "riposte" | "aegis" | "hex";
export type AugmentDelivery = "gun" | "cast" | "beam";
export type AugmentGate = "parry" | "gun" | "cast" | "beam" | "cast+beam";

export interface AugmentDef {
  id: string;
  name: string;
  /** Organizing flavor (NOT an exclusive branch). riposte = STR/DEX offense · aegis = CON defense · hex = INT. */
  tag: AugmentTag;
  /** Short card tooltip (§9 icon-driven cards). */
  desc: string;
  /** `drawIcon` kind for the card chip (reuses the §9 icon vocabulary). */
  icon: string;
  /** Can a player own more than one (each pick adds a stack)? */
  stacks: boolean;
  /** §38 weapon-CLASS signature gate. Unset = a PARRY augment, offered to everyone (parry is the universal
   *  LMB skill). Set = a weapon-delivery augment, ONLY offered while wielding that delivery + only procs there
   *  (a gunslinger draft for guns, a caster draft for casts) — this is how ranged/caster get a signature too. */
  weapon?: AugmentDelivery;
}

/** The M0 pool (§8 `[LOCKED]`). Order groups the three flavor tags. */
export const AUGMENTS: Record<string, AugmentDef> = {
  // Riposte (STR/DEX) — turn the parry into offense.
  counterblade: {
    id: "counterblade",
    name: "Counterblade",
    tag: "riposte",
    desc: "Parry fires a blade projectile toward your aim.",
    icon: "shot",
    stacks: false,
  },
  "twin-fang": {
    id: "twin-fang",
    name: "Twin Fang",
    tag: "riposte",
    desc: "+1 parry projectile. Stacks.",
    icon: "shot",
    stacks: true,
  },
  "hair-trigger": {
    id: "hair-trigger",
    name: "Hair-Trigger",
    tag: "riposte",
    desc: "Consecutive parries each add a projectile.",
    icon: "shot",
    stacks: false,
  },
  deflector: {
    id: "deflector",
    name: "Deflector",
    tag: "riposte",
    desc: "Parried bullets ricochet BACK at the nearest enemy (else they glance off + fade).",
    icon: "shot",
    stacks: false,
  },
  // Aegis (CON) — make the parry tankier.
  "iron-stance": {
    id: "iron-stance",
    name: "Iron Stance",
    tag: "aegis",
    desc: "Wider i-frame window + bigger knockback. Stacks.",
    icon: "con",
    stacks: true,
  },
  "second-wind": {
    id: "second-wind",
    name: "Second Wind",
    tag: "aegis",
    desc: "Parry heals a CON-scaled sliver of HP.",
    icon: "con",
    stacks: true,
  },
  bulwark: {
    id: "bulwark",
    name: "Bulwark",
    tag: "aegis",
    desc: "Parry grants a brief absorb shield.",
    icon: "con",
    stacks: false,
  },
  // Hex (INT, cross-class spice) — elemental on-parry.
  emberguard: {
    id: "emberguard",
    name: "Emberguard",
    tag: "hex",
    desc: "Parry erupts a fire wave (cone, INT-scaled).",
    icon: "magma",
    stacks: false,
  },
  brand: {
    id: "brand",
    name: "Brand",
    tag: "hex",
    desc: "Parried enemies are Marked — they take more damage.",
    icon: "hit",
    stacks: false,
  },
  conflagration: {
    id: "conflagration",
    name: "Conflagration",
    tag: "hex",
    desc: "The fire wave leaves a burning zone. Combos with Brand.",
    icon: "blast",
    stacks: false,
  },
  // §38 GUNSLINGER (ranged signature) — offered + active only while wielding a GUN.
  hollowpoints: {
    id: "hollowpoints",
    name: "Hollow-Points",
    tag: "riposte",
    desc: "Your bullets pierce +1 enemy. Stacks.",
    icon: "shot",
    stacks: true,
    weapon: "gun",
  },
  "ricochet-rounds": {
    id: "ricochet-rounds",
    name: "Ricochet Rounds",
    tag: "riposte",
    desc: "Your bullets ricochet +1 time to another enemy. Stacks.",
    icon: "spark",
    stacks: true,
    weapon: "gun",
  },
  // §38 CASTER signature — offered + active only while wielding a CAST weapon.
  overcharge: {
    id: "overcharge",
    name: "Overcharge",
    tag: "hex",
    desc: "Your arcane bolts deal +25% damage. Stacks.",
    icon: "magma",
    stacks: true,
    weapon: "cast",
  },
  "arc-split": {
    id: "arc-split",
    name: "Arc Split",
    tag: "hex",
    desc: "Your cast fires +1 forked bolt. Stacks (to a cap).",
    icon: "blast",
    stacks: true,
    weapon: "cast",
  },
};

/** G-09 beam-only cards are hidden from the legacy enumerable 14-card compatibility surface but remain
 * ordinary lookup-addressable definitions for the draft/UI. This mirrors the worm-primitive registry's
 * append-only compatibility technique: old enumeration contracts stay stable while the new lane is explicit. */
const BEAM_AUGMENTS = {
  "beam-vent": {
    id: "beam-vent",
    name: "Vented Coils",
    tag: "aegis",
    desc: "Beam heat vents 25% faster. Stacks.",
    icon: "spark",
    stacks: true,
    weapon: "beam",
  },
  "beam-focus": {
    id: "beam-focus",
    name: "Steady Lens",
    tag: "riposte",
    desc: "Beam aim responds 20% faster. Stacks.",
    icon: "shot",
    stacks: true,
    weapon: "beam",
  },
} as const satisfies Record<string, AugmentDef>;

Object.defineProperties(AUGMENTS, {
  "beam-vent": { value: BEAM_AUGMENTS["beam-vent"], enumerable: false },
  "beam-focus": { value: BEAM_AUGMENTS["beam-focus"], enumerable: false },
});

export const AUGMENT_IDS = Object.keys(AUGMENTS);
export const BEAM_AUGMENT_IDS = Object.keys(BEAM_AUGMENTS);

/** Type guard for an untrusted value (a network message field) → a real augment id. */
export function isAugment(value: unknown): value is string {
  return typeof value === "string" && value in AUGMENTS;
}

// ── Tuning (all `[tuning]`) ───────────────────────────────────────────────────────────────────────
/** A signature pick unlocks every Nth level (§12). */
export const SIGNATURE_INTERVAL = 5;
/** Augments offered per signature pick (the 3-of-9 draft). */
export const AUG_DRAFT_SIZE = 3;

/** Counterblade / Twin Fang projectiles. */
export const AUG_PROJECTILE_SPEED = 540;
export const AUG_PROJECTILE_DAMAGE = 16;
export const AUG_PROJECTILE_PIERCE = 2;
export const AUG_PROJECTILE_SPREAD = 0.32; // total cone (rad) across the volley
/** Hair-Trigger: consecutive parries within this window each add a projectile, up to the cap. */
export const HAIRTRIGGER_WINDOW = 2.5;
export const HAIRTRIGGER_MAX = 4;
/** Iron Stance: per-stack multipliers on the parry i-frames + knockback. */
export const IRON_STANCE_IFRAME_PER = 0.5;
export const IRON_STANCE_KNOCKBACK_PER = 0.7;
/** Second Wind: HP healed per parry = base + per-CON × (CON − 1), per stack. */
export const SECOND_WIND_BASE = 4;
export const SECOND_WIND_PER_CON = 2;
/** Bulwark: small absorb shield granted by a successful parry (never extra invulnerability time). */
export const BULWARK_SHIELD = 12;
/** Emberguard: fire-wave cone (in front of aim), damage = base + per-INT × (INT − 1). */
export const EMBERGUARD_RANGE = 190;
export const EMBERGUARD_HALF_ARC = 0.95;
export const EMBERGUARD_BASE_DMG = 12;
export const EMBERGUARD_PER_INT = 6;
/** Brand: a parried enemy is Marked for this long and takes ×mult damage from all sources. */
export const BRAND_DURATION = 5;
export const BRAND_DAMAGE_MULT = 1.3;
/** Conflagration: the fire wave LINGERS — it re-erupts a second time after this delay (sec), so the area
 *  keeps burning. POC of the "burning zone" (a deferred second pulse vs a persistent synced zone). */
export const CONFLAG_DELAY = 0.55;
/** §38 Hollow-Points: +pierce per stack. Ricochet Rounds: +bounce per stack. */
export const AUG_GUN_PIERCE_PER = 1;
export const AUG_GUN_BOUNCE_PER = 1;
/** §38 Overcharge: +cast damage per stack. Arc Split: +forked bolts per stack, capped. */
export const AUG_CAST_DMG_PER = 0.25;
export const AUG_CAST_SPLIT_PER = 1;
export const AUG_CAST_SPLIT_MAX = 3;
/** §38 the extra forked bolts' angular spacing (rad) around aim. */
export const AUG_CAST_SPLIT_SPREAD = 0.14;
/** G-09 beam signature effects. Neither changes damage; they price resource recovery and sweep control. */
export const AUG_BEAM_COOL_PER = 0.25;
export const AUG_BEAM_FOCUS_PER = 0.2;

/** Parse the owned-augment CSV (repeats = stacks). */
export function parseAugments(csv: string): string[] {
  return csv ? csv.split(",").filter(Boolean) : [];
}

/** How many stacks of `id` the player owns. */
export function countAugment(csv: string, id: string): number {
  let n = 0;
  for (const a of parseAugments(csv)) if (a === id) n++;
  return n;
}

/** Does the player own at least one of `id`? */
export function hasAugment(csv: string, id: string): boolean {
  return parseAugments(csv).includes(id);
}

/** Roll a signature draft — `AUG_DRAFT_SIZE` DISTINCT augments from the pool. `roll` is a 0..1 source
 *  (server passes `Math.random`; the offer is server-authoritative + synced, so it need not be seeded).
 *  §38 `weaponKind` gates the WEAPON-specific augments: the universal PARRY augments (no `weapon`) are always
 *  eligible, plus the gun/cast augments matching the wielded delivery — so a gunner can draft gunslinger
 *  perks, a caster caster perks, and a meleer neither (they'd be dead picks). */
export function draftAugments(
  roll: () => number,
  weaponKind?: AugmentDelivery | readonly AugmentDelivery[],
): string[] {
  const lanes: readonly AugmentDelivery[] =
    typeof weaponKind === "string" ? [weaponKind] : weaponKind ?? [];
  const ids = lanes.includes("beam") ? [...AUGMENT_IDS, ...BEAM_AUGMENT_IDS] : AUGMENT_IDS;
  const pool = ids.filter((id) => {
    const w = AUGMENTS[id]?.weapon;
    return !w || lanes.includes(w);
  });
  const out: string[] = [];
  for (let i = 0; i < AUG_DRAFT_SIZE && pool.length > 0; i++) {
    const idx = Math.floor(roll() * pool.length);
    const [picked] = pool.splice(idx, 1);
    if (picked) out.push(picked);
  }
  return out;
}

/** Derive the signature identity from authored class + delivery tags. Optional behavior blocks are not the
 * gate: a caster projectile is cast, a ranged projectile/spread is gun, and every tagged beam gets beam. */
export function augmentGateForWeapon(def: WeaponDef | undefined): AugmentGate {
  if (!def) return "parry";
  if (def.tags.delivery === "beam") {
    return def.tags.classPool === "caster" ? "cast+beam" : "beam";
  }
  if (def.tags.delivery === "thrown") return "parry";
  if (def.tags.classPool === "caster") return "cast";
  if (
    def.tags.classPool === "ranged" &&
    (def.tags.delivery === "projectile" || def.tags.delivery === "spread")
  ) return "gun";
  return "parry";
}

/** Decode one captured gate without allocation-sensitive gameplay work; called only when a draft opens. */
export function augmentDeliveriesForGate(gate: string): readonly AugmentDelivery[] {
  if (gate === "cast+beam") return CAST_BEAM_DELIVERIES;
  if (gate === "gun") return GUN_DELIVERY;
  if (gate === "cast") return CAST_DELIVERY;
  if (gate === "beam") return BEAM_DELIVERY;
  return NO_DELIVERIES;
}

const NO_DELIVERIES = [] as const;
const GUN_DELIVERY = ["gun"] as const;
const CAST_DELIVERY = ["cast"] as const;
const BEAM_DELIVERY = ["beam"] as const;
const CAST_BEAM_DELIVERIES = ["cast", "beam"] as const;
