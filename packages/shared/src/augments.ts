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

export type AugmentTag = "riposte" | "aegis" | "hex";

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
};

export const AUGMENT_IDS = Object.keys(AUGMENTS);

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
/** Bulwark: absorb-shield duration (sec) granted on parry. */
export const BULWARK_SHIELD = 1.5;
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
 *  (server passes `Math.random`; the offer is server-authoritative + synced, so it need not be seeded). */
export function draftAugments(roll: () => number): string[] {
  const pool = [...AUGMENT_IDS];
  const out: string[] = [];
  for (let i = 0; i < AUG_DRAFT_SIZE && pool.length > 0; i++) {
    const idx = Math.floor(roll() * pool.length);
    const [picked] = pool.splice(idx, 1);
    if (picked) out.push(picked);
  }
  return out;
}
