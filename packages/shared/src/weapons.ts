/**
 * Weapon roster + definitions (§9/§10). A first slice of the proving-ground weapon framework —
 * data-driven stats the server uses for the authoritative swing, and display params the client
 * uses to render + animate the weapon in hand. PURE data (no engine/network types). Replaces
 * the hardcoded "fists" placeholder; fists remain as the empty-handed fallback.
 */
import type { Attr } from "./leveling.js";

export interface WeaponDef {
  /** Matches the installed sprite id (texture key base = `${id}:part-1`). */
  id: string;
  name: string;
  /** Damage per swing (hp). */
  damage: number;
  /** Reach of the swing arc (px). */
  range: number;
  /** Half-angle of the hit cone, each side of aim (radians). */
  halfArc: number;
  /** Seconds between swings. */
  cooldown: number;
  /** On-screen length of the weapon sprite, px (drives scale). */
  displayLength: number;
  /** Visual sweep of the swing animation (radians). */
  swingArc: number;
  /** Where the grip sits along the sprite length (0 = left tip) — the in-hand pivot. */
  gripFrac: number;
  /** Dual-wield: render a piece in EACH hand (uses sprite parts 1 & 2). */
  dual?: boolean;
  /** Two-handed: both hands grip the haft (heavy 2H swords). */
  twoHanded?: boolean;
  /**
   * Thrown weapon (§10 delivery `thrown`, three-layer use-model): RMB hurls a spinning projectile
   * toward the cursor instead of a melee swing. Each throw spends a CHARGE; when charges deplete the
   * weapon goes on `refillSeconds` cooldown, then refills (no durability/break yet — POC).
   */
  thrown?: {
    /** Projectile speed, px/sec. */
    speed: number;
    /** Max travel distance before it expires, px. */
    range: number;
    /** Damage per enemy hit. */
    damage: number;
    /** Uses before the refill cooldown. */
    charges: number;
    /** Seconds to refill all charges once depleted. */
    refillSeconds: number;
    /** Enemies a single throw can cut through before vanishing. */
    pierce: number;
  };
  /**
   * Earthquake on swing: AoE damage to every enemy within `radius` px of the player. `vfx` is the
   * client cosmetic (§14 hero Codex skin + engine overlays) — authored in the Weaponsmith tool and
   * baked here. `image` keys a preloaded client texture; the rest are the quake-erupt mechanic params.
   */
  quake?: {
    radius: number;
    damage: number;
    vfx?: {
      image: string;
      /** Visual scale of the hero sprite relative to the AoE diameter. */
      radius: number;
      flash: number;
      dust: number;
      debris: number;
      shake: number;
    };
  };
  /** §10 structured tag taxonomy (metadata, kept from creation; drives art/VFX reuse + filters). */
  tags: {
    grip: "1H" | "2H" | "dual" | "mounted";
    size: "S" | "M" | "L" | "XL";
    delivery: string;
    fireMode: string;
    element: string;
    classPool: "melee" | "ranged" | "caster";
    family: string;
    rangeBand: "close" | "mid" | "long";
    scaling: string[];
  };
  /**
   * §10 Elden-Ring scaling GRADES (S/A/B/C/D/E) per attribute — drives BOTH the card display and the
   * actual damage in the sim. Final damage = base × (1 + Σ gradeCoeff(grade) × (attr − 1)). Omitted →
   * defaults to `{ str: "B" }` (the legacy flat STR scaling), so ungraded weapons are unchanged.
   */
  scalingGrades?: Partial<Record<Attr, Grade>>;
}

/** Damage-scaling letter grade (§10). */
export type Grade = "S" | "A" | "B" | "C" | "D" | "E";

/** Per-point damage multiplier contributed by each grade (tuning; B = the legacy 0.06/pt). */
export const GRADE_DMG_COEFF: Record<Grade, number> = {
  S: 0.1,
  A: 0.08,
  B: 0.06,
  C: 0.045,
  D: 0.03,
  E: 0.015,
};

const DEFAULT_GRADES: Partial<Record<Attr, Grade>> = { str: "B" };

/** Damage multiplier from a weapon's scaling grades at the given attributes. PURE. (final = base × this) */
export function weaponDamageMult(def: WeaponDef, attrs: Record<Attr, number>): number {
  const grades = def.scalingGrades ?? DEFAULT_GRADES;
  let m = 1;
  for (const k of Object.keys(grades) as Attr[]) {
    const g = grades[k];
    if (g) m += GRADE_DMG_COEFF[g] * ((attrs[k] ?? 1) - 1);
  }
  return m;
}

export const WEAPONS: Record<string, WeaponDef> = {
  "rusty-cleaver": {
    id: "rusty-cleaver",
    name: "Rusty Cleaver",
    scalingGrades: { str: "B" },
    damage: 4,
    range: 118,
    halfArc: 0.85,
    cooldown: 0.26, // inter-throw cadence
    displayLength: 76,
    swingArc: 2.6,
    gripFrac: 0.12,
    // Thrown: hurl a spinning cleaver at the cursor; 3 charges, then a short refill (§10).
    thrown: {
      speed: 660,
      range: 520,
      damage: 7,
      charges: 3,
      refillSeconds: 1.5,
      pierce: 2,
    },
    tags: {
      grip: "1H",
      size: "M",
      delivery: "thrown",
      fireMode: "tap-charge",
      element: "physical",
      classPool: "melee",
      family: "thrown",
      rangeBand: "mid",
      scaling: ["STR"],
    },
  },
  "tombstone-greatsword": {
    id: "tombstone-greatsword",
    name: "Tombstone Greatsword",
    scalingGrades: { str: "A" },
    damage: 11,
    range: 156,
    halfArc: 1.0,
    cooldown: 0.78,
    displayLength: 124,
    swingArc: 3.0,
    gripFrac: 0.1,
    twoHanded: true,
    // Quake AoE (gameplay) + the Codex earthquake VFX authored in the Weaponsmith (candidate-8).
    quake: {
      radius: 185,
      damage: 8,
      vfx: {
        image: "vfx-quake-tombstone",
        radius: 1.46,
        flash: 0.12,
        dust: 1,
        debris: 40,
        shake: 0.13,
      },
    },
    tags: {
      grip: "2H",
      size: "L",
      delivery: "melee-slam",
      fireMode: "tap-charge",
      element: "physical",
      classPool: "melee",
      family: "sword",
      rangeBand: "close",
      scaling: ["STR"],
    },
  },
  // The "really long sword" demonstration (§10): a Masamune-homage nodachi — an absurdly LONG, THIN
  // blade. Length comes from displayLength (320 vs the cleaver's 76), NOT from the art box; the art
  // is drawn long-and-thin so it reads as reach. Held near the base (gripFrac) so the blade extends.
  driftblade: {
    id: "driftblade",
    name: "Driftblade",
    scalingGrades: { dex: "B", str: "C" },
    damage: 9,
    range: 280,
    halfArc: 0.6,
    cooldown: 0.62,
    displayLength: 320,
    swingArc: 2.3,
    gripFrac: 0.05,
    // A nodachi this long is gripped with BOTH hands (back hand up the haft, §28 2H stance).
    twoHanded: true,
    tags: {
      grip: "2H",
      size: "XL",
      delivery: "melee-arc",
      fireMode: "tap-charge",
      element: "physical",
      classPool: "melee",
      family: "sword",
      rangeBand: "mid",
      scaling: ["DEX", "STR"],
    },
  },
  "twin-bowie-fangs": {
    id: "twin-bowie-fangs",
    name: "Twin Bowie Fangs",
    scalingGrades: { dex: "B", str: "D" },
    damage: 2.5,
    range: 92,
    halfArc: 0.7,
    cooldown: 0.18,
    displayLength: 62,
    swingArc: 2.2,
    gripFrac: 0.16,
    dual: true,
    tags: {
      grip: "dual",
      size: "S",
      delivery: "melee-arc",
      fireMode: "auto",
      element: "physical",
      classPool: "melee",
      family: "fist-blade",
      rangeBand: "close",
      scaling: ["DEX", "STR"],
    },
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS);
export const DEFAULT_WEAPON = "rusty-cleaver";

/** Next weapon in the roster (RMB/cycle), wrapping around. */
export function nextWeapon(current: string): string {
  const i = WEAPON_IDS.indexOf(current);
  return WEAPON_IDS[(i + 1) % WEAPON_IDS.length] ?? DEFAULT_WEAPON;
}
