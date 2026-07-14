/**
 * Weapon roster + definitions (§9/§10). A first slice of the proving-ground weapon framework —
 * data-driven stats the server uses for the authoritative swing, and display params the client
 * uses to render + animate the weapon in hand. PURE data (no engine/network types). Replaces
 * the hardcoded "fists" placeholder; fists remain as the empty-handed fallback.
 */
import {
  FISTS_COOLDOWN,
  FISTS_DAMAGE,
  FISTS_HALF_ARC,
  FISTS_RANGE,
  REZ_RADIUS,
} from "./constants.js";
import type { Attr } from "./leveling.js";
import { EXPANSION_WEAPONS } from "./weapons-expansion.generated.js";

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
  /**
   * FIXED in-world VFX size — the swing effect's radius (px). Static per weapon, authored in the
   * Weaponsmith; it is the one scalar (`S.R`) the renderer scales every layer from. §14 ruling: attack/
   * VFX size NEVER scales with level, attribute, or augment — only DAMAGE does (§10 `weaponDamageMult`).
   * Omitted → {@link VFX_RADIUS_DEFAULT}. (Quake/AoE *hero* sizing is separate — see `quake.vfx.radius`.)
   */
  vfxRadius?: number;
  /** Visual sweep of the swing animation (radians). */
  swingArc: number;
  /**
   * §40 which SWING ANIMATION STYLE this weapon plays (cosmetic — damage geometry is unchanged). One weapon,
   * one animation; omitted → derived from the weapon's shape: quake→chop (overhead slam), claw/gauntlet/
   * fist→pivot (spins about the hand, the hand doesn't move), rapier/spear→thrust (lunge along aim),
   * two-handed→orbit (fake-3D waist orbit), else→arc (the classic flat sweep).
   */
  swingStyle?: "arc" | "orbit" | "chop" | "pivot" | "thrust";
  /** Where the grip sits along the sprite length (0 = left tip) — the in-hand pivot. */
  gripFrac: number;
  /** Dual-wield: render a piece in EACH hand (uses sprite parts 1 & 2). */
  dual?: boolean;
  /** Two-handed: both hands grip the haft (heavy 2H swords). */
  twoHanded?: boolean;
  /** Held-render sprite override — the manifest id whose sliced parts to draw in-hand, when it differs
   *  from this weapon's `id` (e.g. a not-yet-arted weapon borrowing an existing sprite as placeholder). */
  sprite?: string;
  /** §6 REZ effect — a swing within `radius` of a DOWNED ally REVIVES them (at REVIVE_HP_FRAC of max HP).
   *  Revival is loot: the Gravedigger's Spade is the M0 rez carrier. The weapon still does its edge damage. */
  rez?: { radius: number };
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
    /** Per-source scaling (§14 WYSIWYG) — this projectile's own grades; omitted = the weapon's edge grades. */
    scalingGrades?: Partial<Record<Attr, Grade>>;
  };
  /**
   * Earthquake on swing: AoE damage to every enemy within `radius` px of the player. `vfx` is the
   * client cosmetic (§14 hero Codex skin + engine overlays) — authored in the Weaponsmith tool and
   * baked here. `image` keys a preloaded client texture; the rest are the quake-erupt mechanic params.
   */
  quake?: {
    radius: number;
    damage: number;
    /** Per-source scaling (§14 WYSIWYG) — the quake's own grades; omitted = the weapon's edge grades. */
    scalingGrades?: Partial<Record<Attr, Grade>>;
    vfx?: {
      image: string;
      /** §14 WYSIWYG: the painted hero's on-screen size relative to the damage hitbox. **1.0 = the visual
       *  edge EXACTLY matches the AoE radius (the default — what you see is what hits).** >1 overhangs the
       *  hitbox, <1 sits inside it; only deviate to account for transparent padding baked into the art. */
      radius: number;
      flash: number;
      dust: number;
      debris: number;
      shake: number;
    };
  };
  /**
   * §10 on-hit behavior block — CHAIN LIGHTNING. When the forward arc connects, a bolt leaps from the
   * struck enemy to the nearest not-yet-hit enemies, up to `jumps` times; link n does
   * `damage × falloff^n × power` (power = §10 grades). `range` caps each hop (px, center-to-center),
   * itself clamped by the global {@link CHAIN_MAX_RANGE}. Gameplay params are server-authoritative; the
   * nested `vfx` is the client cosmetic (teal jagged bolt). Per the §14 ruling, DAMAGE scales with power
   * but `jumps`/`range`/the VFX are FIXED — never scaled by level/stat/augment (like quake's radius).
   */
  chainLightning?: {
    /** Extra enemies the bolt leaps to after the struck enemy. */
    jumps: number;
    /** Max distance per hop, px (center-to-center). A hop fails if no unhit enemy is within range. */
    range: number;
    /** Base damage of the first link, before falloff + §10 power. */
    damage: number;
    /** Per-link damage multiplier; link n does `damage × falloff^n`. 1 = no falloff. */
    falloff: number;
    /** Per-source scaling (§14 WYSIWYG) — the bolt's own grades; omitted = the weapon's edge grades. */
    scalingGrades?: Partial<Record<Attr, Grade>>;
    vfx?: {
      /** lerpHue index 0..1 → bolt tint (0.5 ≈ teal/cyan, the sword accent). */
      color: number;
      /** Jag amplitude (perpendicular jitter as a fraction of segment length). */
      jag: number;
      /** Bolt lifetime, ms (flicker + fade). */
      life: number;
    };
  };
  /**
   * §10/§14 on-swing SCATTER SHOT — flings `count` REAL server projectiles in a cone toward aim, each
   * a WYSIWYG damage source (the magma you see is the magma that hits). Each projectile deals `damage`
   * on a direct hit and, on death (impact / `range` / arena edge), detonates an `explode` AoE. Promotes
   * the old cosmetic-only `magma-scatter` VFX into a real mechanic (Wyrmtooth). Per §14 the cone/size/
   * radius are FIXED — only the damage scales (independently, via each source's own `scalingGrades`).
   */
  scatter?: {
    /** Projectiles flung per swing. */
    count: number;
    /** Cone half-angle (radians) the projectiles spread across, centred on aim. */
    spread: number;
    /** Projectile speed, px/sec. */
    speed: number;
    /** Travel distance before a projectile expires (and explodes), px. */
    range: number;
    /** Direct-hit damage per projectile (before this source's scaling). */
    damage: number;
    /** Enemies a single projectile damages before it dies + explodes (default 1 → one direct hit). */
    pierce?: number;
    /** Per-source scaling (§14 WYSIWYG) — the projectile's own grades; omitted = the weapon's edge grades. */
    scalingGrades?: Partial<Record<Attr, Grade>>;
    /** AoE detonation when a projectile dies (the "explosion"). Omitted → projectiles don't blast. */
    explode?: {
      /** Blast radius, px (FIXED — §14; the client renders an explosion of exactly this size). */
      radius: number;
      /** AoE damage (before this source's scaling). */
      damage: number;
      /** Per-source scaling — the blast's own grades; omitted = the SCATTER source's grades. */
      scalingGrades?: Partial<Record<Attr, Grade>>;
    };
  };
  /**
   * §38 CASTER delivery — the caster-class signature mechanic. RMB conjures a piercing ARCANE BOLT down aim
   * on a flat COOLDOWN (no magazine/reload, unlike a gun; ranged, unlike melee). The bolt tears through the
   * whole line of enemies (`pierce`), INT-scaled via its own grades — so a Caster character's auto-grown INT
   * (§38 classes) finally has a weapon that reads it. Per §14 size/speed are FIXED; only damage scales.
   */
  cast?: {
    /** Damage per bolt, before scaling. */
    damage: number;
    /** Bolt speed, px/sec (slower + bigger than a bullet, so it reads "arcane", not "gunfire"). */
    speed: number;
    /** Travel distance before the bolt expires, px. */
    range: number;
    /** Flat cooldown between casts, sec (the pacing lever — there is no ammo). */
    cooldown: number;
    /** Enemies a single bolt tears through before dying (default 99 = pierces the whole line). */
    pierce?: number;
    /** The client bullet-kind for the bolt's look (e.g. "orb"). */
    bulletKind: string;
    /** Per-source scaling (§14) — INT-forward for casters. */
    scalingGrades?: Partial<Record<Attr, Grade>>;
  };
  /**
   * §9/§10/§15 GUN delivery — RMB fires bullets down-barrel on a fire-rate cadence, spending AMMO from a
   * magazine that RELOADS when empty (the charges/maxCharges readout doubles as the ammo counter). Each
   * gun has its own bullet feel + muzzle flash (`bulletKind`/`muzzle`). Server-authoritative projectiles
   * (WYSIWYG): the bullet you see is the bullet that hits. Per §14 size/spread/blast are FIXED; only
   * damage scales (its own `scalingGrades`).
   */
  gun?: {
    /** Damage per bullet (per pellet for spread guns), before scaling. */
    damage: number;
    /** Bullet speed, px/sec. */
    projectileSpeed: number;
    /** Travel distance before a bullet expires, px. */
    range: number;
    /** Seconds between shots (the fire-rate cooldown). */
    fireRate: number;
    /** Bullets per trigger pull — >1 = a shotgun SPREAD volley (one ammo spends all pellets). Default 1. */
    pellets?: number;
    /** Cone half-angle (radians): pellet spread for shotguns, or muzzle inaccuracy for autos. Default 0. */
    spread?: number;
    /** Enemies a single bullet cuts through before dying (default 1). */
    pierce?: number;
    /** Wall RICOCHETS before the bullet expires (reflects off arena edges). Default 0. */
    bounces?: number;
    /** Magazine size — shots (trigger pulls) before a reload. Mirrors `maxCharges`. */
    magazine: number;
    /** Reload time, sec, when the magazine empties. */
    reloadSeconds: number;
    /** Client bullet visual: "slug" | "pellet" | "tracer" | "nail" | "ricochet". */
    bulletKind: string;
    /** Client muzzle-flash style: "heavy" | "boom" | "rapid" | "punch" | "spark". */
    muzzle: string;
    /** Muzzle/bullet tint (hex). Omitted → a default hot orange. */
    muzzleColor?: number;
    /** Recoil camera-kick intensity per shot (heavy slugs punch, the gatling barely buzzes). ~0.0006–0.004. */
    recoil?: number;
    /** Per-source scaling (§14 WYSIWYG) — the bullet's grades; omitted = the weapon's edge grades. */
    scalingGrades?: Partial<Record<Attr, Grade>>;
    /** AoE on bullet death (explosive rounds). Omitted → bullets don't blast. */
    explode?: {
      radius: number;
      damage: number;
      scalingGrades?: Partial<Record<Attr, Grade>>;
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
  /**
   * §11 minimum attribute requirements to wield the weapon (Elden-Ring style). Shown on the §9 card
   * (red when the player hasn't met them). POC ENFORCEMENT (v0.64, pending Mike's ruling): wielding
   * under-requirement is allowed but scales every damage source by {@link requirementPenalty} (−12%/point
   * short, floored at 25%). NOTE: this DIVERGES from the §10 LOCKED "side bag" model (unmet-req weapons
   * sit unusable until stats catch up) — chosen because the current build is a cycle-everything sandbox
   * with no side-bag/inventory yet, and a penalty keeps every weapon testable. Revisit when §13 inventory
   * lands. Omitted → no requirement.
   */
  requirements?: Partial<Record<Attr, number>>;
  /**
   * §10 max DURABILITY — melee weapons wear with use (vs `thrown` weapons, which spend charges). The
   * card shows it; the depletion/break/repair MECHANIC is not built yet (display scaffolding). Omitted
   * → the weapon doesn't track durability (e.g. casters/thrown).
   */
  durability?: number;
  /** §13 EXPANSION weapon — defined + arted but held OUT of the active roster (`WEAPON_IDS`): not in the
   *  Testing-Grounds gallery, the Q/E cycle, or the drop pool, so the +300 batch doesn't flood the game
   *  until it's curated in. Promote one by clearing this flag (or moving it to the base roster). */
  expansion?: boolean;
}

/** Damage-scaling letter grade (§10). */
export type Grade = "S" | "A" | "B" | "C" | "D" | "E";

/** §9 GUN barrel-tip reach: distance (px) from the player CENTRE to a held gun's MUZZLE along the aim,
 *  derived from each gun's OWN held geometry — the gun pivots at `gripFrac` of its `displayLength` and the
 *  barrel extends past the grip, plus the front hand sits a little forward. So bullets + the muzzle flash
 *  always leave the BARREL TIP (not the body), and a longer gun muzzles further out automatically. Server
 *  (bullet spawn) + client (muzzle flash) both call this so the shot + flash coincide.
 *
 *  `renderScale` = the holder's rig scale (`characterScale(player.character)`, §7). The whole rig — hand
 *  offset AND the barrel that extends from it — is drawn at that scale, so the WORLD muzzle distance scales
 *  with it too. Without this the shot spawned ~6–25% SHORT of the rendered barrel (every character sits at
 *  1.06–1.25×) — the "bullets out of the barrel is OK at best" playtest note. Pass the holder's scale to
 *  land the shot exactly on the tip. Defaults to 1 for callers that don't know the holder. */
export const GUN_HAND_FORWARD = 12;
export function gunMuzzleReach(weapon: WeaponDef | undefined, renderScale = 1): number {
  if (!weapon) return GUN_HAND_FORWARD * renderScale;
  return renderScale * (GUN_HAND_FORWARD + (1 - weapon.gripFrac) * weapon.displayLength);
}

/** §20 WYSIWYG melee reach: the effective hit `range` of a swept blade, in world px from the player centre.
 *  The gun bug's melee twin (playtest: "the tips of some melee weapons don't hit"): the blade SPRITE is drawn
 *  at `displayLength` scaled by the holder's rig (`characterScale`, §7), so on every character (all sit at
 *  1.06–1.25×) the visible edge reaches further than the FLAT authored `range` the hit test used — the point
 *  whiffs. Two corrections, mirroring `gunMuzzleReach`:
 *    1. floor the reach at the rendered sprite TIP (`(1−gripFrac)×displayLength` forward of the grip), so a
 *       weapon whose ART overhangs its authored range (driftblade 320>300, coffin 200>166) still hits on the
 *       tip instead of just short of it — never SHRINKS a weapon whose range already exceeds its sprite;
 *    2. scale the whole reach by the holder's `renderScale`, so a big character's longer-drawn blade hits as
 *       far as it looks. Pure + shared so the server hit test and any client preview can't drift. */
export function meleeReach(weapon: WeaponDef, renderScale = 1): number {
  const spriteTip = (1 - weapon.gripFrac) * weapon.displayLength;
  return renderScale * Math.max(weapon.range, spriteTip);
}

/** §30 v0.118 WEAPON CLASS SET-BONUS (Brotato parity #2): carrying multiple weapons of the same class
 *  (melee/ranged/caster) in your loadout escalates that class's damage — turning a 3-slot loadout into a
 *  build. Scaled to DD's small arsenal: 2-of-a-class and 3-of-a-class thresholds (vs Brotato's 2–6). */
export const SET_BONUS_2 = 0.08; // +8% class damage at 2 of a class
export const SET_BONUS_3 = 0.18; // +18% at 3 of a class

/** How many equipped weapons share `cls`. Empty/unknown ids are ignored. PURE. */
export function classCount(loadout: readonly string[], cls: WeaponDef["tags"]["classPool"]): number {
  let n = 0;
  for (const id of loadout) if (id && WEAPONS[id]?.tags.classPool === cls) n++;
  return n;
}

/** The damage MULTIPLIER the held weapon earns from its class set-bonus, given the full equipped `loadout`
 *  (the slot weapon ids). 1 = no bonus. PURE — server folds it into held damage, client shows it. */
export function weaponSetBonus(loadout: readonly string[], heldWeaponId: string): number {
  const held = WEAPONS[heldWeaponId];
  if (!held) return 1;
  const n = classCount(loadout, held.tags.classPool);
  if (n >= 3) return 1 + SET_BONUS_3;
  if (n >= 2) return 1 + SET_BONUS_2;
  return 1;
}

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

/** Damage multiplier from an explicit set of scaling grades at the given attributes. PURE.
 *  (final = base × this). Undefined grades → the legacy flat `{ str: "B" }`. */
export function damageMultFromGrades(
  grades: Partial<Record<Attr, Grade>> | undefined,
  attrs: Record<Attr, number>,
): number {
  const g = grades ?? DEFAULT_GRADES;
  let m = 1;
  for (const k of Object.keys(g) as Attr[]) {
    const gr = g[k];
    if (gr) m += GRADE_DMG_COEFF[gr] * ((attrs[k] ?? 1) - 1);
  }
  return m;
}

/** Damage multiplier from a weapon's PRIMARY (edge) scaling grades. PURE. (final = base × this) */
export function weaponDamageMult(def: WeaponDef, attrs: Record<Attr, number>): number {
  return damageMultFromGrades(def.scalingGrades, attrs);
}

/**
 * Per-SOURCE damage multiplier (§10/§14 WYSIWYG damage). A weapon's edge and each of its VFX/behavior
 * damage sources can scale off DIFFERENT attributes — e.g. Wyrmtooth's blade scales STR/DEX while its
 * magma + explosion scale INT. A source supplies its own `scalingGrades`; when omitted it INHERITS the
 * weapon's edge grades (so existing single-source weapons are unchanged). PURE.
 */
export function sourceDamageMult(
  weapon: WeaponDef,
  sourceGrades: Partial<Record<Attr, Grade>> | undefined,
  attrs: Record<Attr, number>,
): number {
  return damageMultFromGrades(sourceGrades ?? weapon.scalingGrades, attrs);
}

/** §11 damage penalty per attribute POINT below a weapon's requirement (Elden-Ring style). */
export const REQ_PENALTY_PER_POINT = 0.12;
/** §11 floor on the requirement penalty — a badly under-statted weapon still hits this fraction (it's
 *  WIELDABLE, just weak), so a freshly-grabbed drop is never a dead stick. */
export const REQ_PENALTY_FLOOR = 0.25;

/** Total attribute shortfall vs a weapon's §11 requirements — Σ max(0, need − have) across attrs. PURE.
 *  0 = every requirement met (or the weapon has none). */
export function requirementShortfall(def: WeaponDef, attrs: Record<Attr, number>): number {
  let short = 0;
  for (const [k, need] of Object.entries(def.requirements ?? {}) as [Attr, number][]) {
    short += Math.max(0, need - (attrs[k] ?? 1));
  }
  return short;
}

/** §11 DAMAGE multiplier from unmet requirements (POC enforcement v0.64, pending Mike's ruling vs the §10
 *  LOCKED "side bag" model): wielding a weapon below its requirements is allowed but PENALISES damage —
 *  `1 − PER_POINT × shortfall`, floored at REQ_PENALTY_FLOOR. 1.0 when fully met (or no requirements).
 *  Applies to EVERY damage source of the weapon (the whole thing is too heavy/complex for you). PURE. */
export function requirementPenalty(def: WeaponDef, attrs: Record<Attr, number>): number {
  const short = requirementShortfall(def, attrs);
  if (short <= 0) return 1;
  return Math.max(REQ_PENALTY_FLOOR, 1 - REQ_PENALTY_PER_POINT * short);
}

/** §10/§11/§14 EFFECTIVE per-source damage multiplier: the source's attribute scaling × the weapon's
 *  requirement penalty. The single multiplier the server applies to every damage instance AND the card
 *  shows, so the displayed equation is always the real damage dealt (WYSIWYG). PURE. */
export function effectiveDamageMult(
  weapon: WeaponDef,
  sourceGrades: Partial<Record<Attr, Grade>> | undefined,
  attrs: Record<Attr, number>,
): number {
  return sourceDamageMult(weapon, sourceGrades, attrs) * requirementPenalty(weapon, attrs);
}

/** One of a weapon's damage instances (for the §9 card's multi-source equation display). */
export interface DamageSource {
  /** Short label, e.g. "hit" / "throw" / "quake" / "chain" / "magma" / "blast". */
  label: string;
  /** Base damage before scaling. */
  base: number;
  /** This source's scaling grades (already resolved — inherits the weapon's edge grades where blocks omit them). */
  grades: Partial<Record<Attr, Grade>> | undefined;
  /** How many times the source lands per use (e.g. scatter fires `count` projectiles). 1 = single. */
  count: number;
}

/**
 * Enumerate a weapon's distinct damage sources (§14 WYSIWYG) so the card can show each scaling line
 * independently — the blade, the magma, the quake, etc. PURE. The primary line is the throw (thrown
 * weapons) or the melee hit (everyone else); behavior blocks add their own lines.
 */
export function weaponDamageSources(def: WeaponDef): DamageSource[] {
  const out: DamageSource[] = [];
  if (def.gun) {
    out.push({
      label: "shot",
      base: def.gun.damage,
      grades: def.gun.scalingGrades ?? def.scalingGrades,
      count: def.gun.pellets ?? 1,
    });
    if (def.gun.explode) {
      out.push({
        label: "blast",
        base: def.gun.explode.damage,
        grades: def.gun.explode.scalingGrades ?? def.gun.scalingGrades ?? def.scalingGrades,
        count: def.gun.pellets ?? 1,
      });
    }
  } else if (def.thrown) {
    out.push({
      label: "throw",
      base: def.thrown.damage,
      grades: def.thrown.scalingGrades ?? def.scalingGrades,
      count: 1,
    });
  } else {
    out.push({ label: "hit", base: def.damage, grades: def.scalingGrades, count: 1 });
  }
  if (def.quake) {
    out.push({
      label: "quake",
      base: def.quake.damage,
      grades: def.quake.scalingGrades ?? def.scalingGrades,
      count: 1,
    });
  }
  if (def.chainLightning) {
    out.push({
      label: "chain",
      base: def.chainLightning.damage,
      grades: def.chainLightning.scalingGrades ?? def.scalingGrades,
      count: 1,
    });
  }
  if (def.scatter) {
    const sc = def.scatter;
    out.push({
      label: "magma",
      base: sc.damage,
      grades: sc.scalingGrades ?? def.scalingGrades,
      count: sc.count,
    });
    if (sc.explode) {
      out.push({
        label: "blast",
        base: sc.explode.damage,
        grades: sc.explode.scalingGrades ?? sc.scalingGrades ?? def.scalingGrades,
        count: sc.count,
      });
    }
  }
  return out;
}

/**
 * Default fixed VFX radius (px) when a weapon omits `vfxRadius`. Calibrated for WYSIWYG with the
 * Weaponsmith preview: 74 = TARGET_BODY_H(84) × the smith's S.R/charH ratio (0.30/0.34 ≈ 0.882), so an
 * un-authored swing reads the same on-screen size in the smith and in-world. (Holds while the arena
 * camera stays at zoom 1.0 — world px == screen px.)
 */
export const VFX_RADIUS_DEFAULT = 74;

const BASE_WEAPONS: Record<string, WeaponDef> = {
  // §9 unarmed fallback — what you hold after DROPPING/SALVAGING a weapon, or when everything's broken.
  // No sprite (empty hands), no requirements, weak short arc. Excluded from WEAPON_IDS (never in the
  // Q-cycle or the Testing-Grounds gallery).
  fists: {
    id: "fists",
    name: "Fists",
    scalingGrades: { str: "C" },
    damage: FISTS_DAMAGE,
    range: FISTS_RANGE,
    halfArc: FISTS_HALF_ARC,
    cooldown: FISTS_COOLDOWN,
    displayLength: 1,
    swingArc: 1.8,
    gripFrac: 0.5,
    vfxRadius: 40,
    tags: {
      grip: "1H",
      size: "S",
      delivery: "melee-arc",
      fireMode: "auto",
      element: "physical",
      classPool: "melee",
      family: "fist",
      rangeBand: "close",
      scaling: ["STR"],
    },
  },
  // §6/§15 #10 GRAVEDIGGER'S SPADE — the M0 REZ carrier. A heavy 2H digging spade: a real (if modest) STR
  // melee whose swing REVIVES a downed ally within REZ_RADIUS at 30% HP. Bespoke spade art is pending
  // (CODE-21) — for now it borrows the tombstone-greatsword sprite (heavy 2H haft) via `sprite`.
  "gravediggers-spade": {
    id: "gravediggers-spade",
    name: "Gravedigger's Spade",
    sprite: "tombstone-greatsword", // placeholder art until a bespoke spade is generated
    scalingGrades: { str: "B" },
    requirements: { str: 5 },
    damage: 8,
    range: 150,
    halfArc: 0.95,
    cooldown: 0.6, // a heavy, deliberate dig
    displayLength: 124,
    swingArc: 2.7,
    gripFrac: 0.1,
    twoHanded: true,
    durability: 90,
    rez: { radius: REZ_RADIUS }, // §6 the swing revives a downed ally in range
    tags: {
      grip: "2H",
      size: "L",
      delivery: "melee-arc",
      fireMode: "tap-charge",
      element: "physical",
      classPool: "melee",
      family: "spade",
      rangeBand: "close",
      scaling: ["STR"],
    },
  },
  "rusty-cleaver": {
    id: "rusty-cleaver",
    name: "Rusty Cleaver",
    scalingGrades: { str: "B" },
    requirements: { str: 3 },
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
    requirements: { str: 10 },
    durability: 90,
    damage: 11,
    range: 156,
    halfArc: 1.0,
    cooldown: 0.78,
    displayLength: 124,
    swingArc: 3.0,
    gripFrac: 0.1,
    twoHanded: true,
    // Quake AoE (gameplay) + the Codex earthquake VFX authored in the Weaponsmith (candidate-8).
    // §14 WYSIWYG "hits as big as it looks": the damage radius now matches the painted erupt's extent
    // (grown 185→270), and `vfx.radius: 1.0` locks the visual to the hitbox (visual diameter = 2×radius),
    // so the erupt you see IS the area that damages. (Was 1.46 → the visual overhung the hitbox.)
    quake: {
      radius: 270,
      damage: 8,
      vfx: {
        image: "vfx-quake-tombstone",
        radius: 1.0,
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
    requirements: { dex: 8, str: 5 },
    durability: 80,
    damage: 9,
    // §14 WYSIWYG: the long nodachi visually sweeps a WIDE arc, so the hitbox matches the swing — the
    // blade and its slash VFX are ONE damage source (no 2nd part like Wyrmtooth's magma). The cone was a
    // narrow ±0.6 rad / 280px and missed dummies the blade visibly crossed; widened to ±1.0 rad and the
    // blade's reach (~300), and `vfxRadius` grown to 150 so the slash effect spans the hitbox (= what hits).
    range: 300,
    halfArc: 1.0,
    vfxRadius: 150,
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
  // ── Explore swords wired into the Testing Grounds (CODE-9, 2026-06-15). Stats are first-pass by
  // archetype (tunable); displayLength matches the value authored in the Weaponsmith. VFX in-world is
  // the generic slash for now (the bespoke painted/engine VFX live in the forge until CODE-8 unifies). ──
  "x-sword-buzzsaw": {
    id: "x-sword-buzzsaw",
    name: "Buzzcutter",
    scalingGrades: { str: "C", dex: "C" },
    damage: 3.5,
    range: 122,
    halfArc: 1.1, // wide, grinding arc
    cooldown: 0.22, // fast, multi-hit saw
    displayLength: 100,
    swingArc: 2.8,
    gripFrac: 0.14,
    twoHanded: true,
    tags: {
      grip: "2H",
      size: "M",
      delivery: "melee-arc",
      fireMode: "auto",
      element: "physical",
      classPool: "melee",
      family: "sword",
      rangeBand: "close",
      scaling: ["STR", "DEX"],
    },
  },
  "x-sword-anchor": {
    id: "x-sword-anchor",
    name: "Drowned Anchor",
    scalingGrades: { str: "A" },
    damage: 14, // heavy, slow haymaker
    range: 172,
    halfArc: 1.1,
    cooldown: 0.95,
    displayLength: 165,
    swingArc: 3.1,
    gripFrac: 0.1,
    twoHanded: true,
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
  "rattler-sabre": {
    id: "rattler-sabre",
    name: "Rattler Sabre",
    scalingGrades: { dex: "B", str: "D" },
    damage: 5,
    range: 132,
    halfArc: 0.7,
    cooldown: 0.3,
    displayLength: 100,
    swingArc: 2.4,
    gripFrac: 0.12,
    tags: {
      grip: "1H",
      size: "M",
      delivery: "melee-arc",
      fireMode: "tap-charge",
      element: "physical",
      classPool: "melee",
      family: "sword",
      rangeBand: "close",
      scaling: ["DEX", "STR"],
    },
  },
  "x-sword-coffin": {
    id: "x-sword-coffin",
    name: "Reaper's Lid",
    scalingGrades: { str: "A" },
    damage: 13,
    range: 166,
    halfArc: 1.05,
    cooldown: 0.9,
    displayLength: 200,
    swingArc: 3.0,
    gripFrac: 0.1,
    twoHanded: true,
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
  "x-sword-railspike": {
    id: "x-sword-railspike",
    name: "Spike Driver",
    scalingGrades: { str: "B", dex: "C" },
    damage: 6,
    range: 112,
    halfArc: 0.8,
    cooldown: 0.34, // inter-throw cadence
    displayLength: 65,
    swingArc: 2.4,
    gripFrac: 0.12,
    // Thrown (§10): hurl a heavy piercing spike — fewer charges, harder hit than the cleaver.
    thrown: { speed: 720, range: 560, damage: 12, charges: 2, refillSeconds: 2, pierce: 3 },
    tags: {
      grip: "2H",
      size: "M",
      delivery: "thrown",
      fireMode: "tap-charge",
      element: "physical",
      classPool: "melee",
      family: "thrown",
      rangeBand: "mid",
      scaling: ["STR", "DEX"],
    },
  },
  "x-sword-neon-katana": {
    id: "x-sword-neon-katana",
    name: "Voltedge",
    scalingGrades: { dex: "A" },
    requirements: { dex: 12 },
    durability: 70,
    damage: 5.5,
    range: 138,
    halfArc: 0.62, // tight, precise cut
    cooldown: 0.28,
    displayLength: 125,
    swingArc: 2.3,
    gripFrac: 0.12,
    // §10 on-hit proc (forge note): "jagged lightning on target, chain to 3 nearest, teal". The arc hit
    // seeds a bolt that leaps to 3 other nearby enemies for decaying damage. (Damage scales with DEX
    // grades via power; jumps/range/VFX are fixed per §14.)
    chainLightning: {
      jumps: 3,
      range: 240, // ~1.7× the melee range — electric reach, not infinite (clamped by CHAIN_MAX_RANGE)
      damage: 4, // a touch under the 5.5 arc — the chain is bonus spread, not the main hit
      falloff: 0.7, // link dmg 4 / 2.8 / 1.96 — visibly decaying, still meaningful
      vfx: { color: 0.5, jag: 0.3, life: 180 }, // teal (sword accent), moderate jag, quick flicker
    },
    tags: {
      grip: "1H",
      size: "M",
      delivery: "melee-arc",
      fireMode: "tap-charge",
      element: "physical",
      classPool: "melee",
      family: "sword",
      rangeBand: "mid",
      scaling: ["DEX"],
    },
  },
  "x-sword-bone": {
    id: "x-sword-bone",
    name: "Wyrmtooth",
    // §14 WYSIWYG multi-source: the BLADE (edge) is a physical STR/DEX cut; the magma it flings + their
    // explosions are an INT-scaled caster source (so an INT build leans on the meteors, a STR/DEX build
    // on the blade). The blade scales STR C / DEX C.
    scalingGrades: { str: "C", dex: "C" },
    requirements: { str: 6, int: 5 },
    durability: 85,
    damage: 10,
    range: 150,
    halfArc: 1.0,
    cooldown: 0.72,
    displayLength: 120,
    swingArc: 3.0,
    gripFrac: 0.1,
    twoHanded: true,
    // Scatter shot (forge note: "magma balls shot out in a cluster on swing, each its own entity"):
    // 6 real magma projectiles fan out toward aim, each dealing an INT-scaled direct hit and then
    // exploding into an INT-scaled fiery AoE on impact/expiry. Cone/speed/range/blast radius are FIXED
    // (§14) — only the damage scales (off INT, independent of the STR/DEX blade).
    scatter: {
      count: 6,
      spread: 0.5, // ~±29° fan
      speed: 360,
      range: 230,
      damage: 5, // per-ball direct hit (× INT B)
      scalingGrades: { int: "B" },
      explode: {
        radius: 56, // FIXED blast size (§14); the client renders an explosion of exactly this px radius
        damage: 6, // AoE per blast (× INT B); inherits the scatter's INT grades
      },
    },
    tags: {
      grip: "2H",
      size: "L",
      delivery: "melee-arc",
      fireMode: "tap-charge",
      element: "physical",
      classPool: "melee",
      family: "sword",
      rangeBand: "close",
      scaling: ["STR", "DEX", "INT"],
    },
  },

  // ── GUNS (§9/§15 ranged) — RMB fires bullets on a fire-rate cadence, spending ammo from a magazine
  // that reloads when empty. Each has its own bullet feel + muzzle flash. ─────────────────────────────
  "x-gun-revolver-cannon": {
    id: "x-gun-revolver-cannon",
    name: "Revolver Cannon",
    scalingGrades: { dex: "C", str: "C" },
    requirements: { dex: 5 },
    durability: 70,
    damage: 5, // pistol-whip fallback (point-blank); the gun block does the work
    range: 72,
    halfArc: 0.5,
    cooldown: 0.5,
    displayLength: 94,
    swingArc: 1.1,
    gripFrac: 0.16,
    vfxRadius: 64,
    gun: {
      damage: 18, // a heavy slug — the decisive single-target hitter (its whole identity vs the autos)
      projectileSpeed: 900,
      range: 640,
      fireRate: 0.5, // slow, deliberate
      pierce: 1,
      magazine: 6, // six-shooter
      reloadSeconds: 1.4,
      bulletKind: "slug",
      muzzle: "heavy",
      muzzleColor: 0xffb24a,
      recoil: 0.004, // a meaty THUMP
      scalingGrades: { dex: "C", str: "C" },
    },
    tags: {
      grip: "1H",
      size: "M",
      delivery: "projectile",
      fireMode: "tap-charge",
      element: "physical",
      classPool: "ranged",
      family: "pistol",
      rangeBand: "long",
      scaling: ["DEX", "STR"],
    },
  },
  // ── CASTERS (§38) — the caster class's signature weapons. RMB conjures a piercing arcane BOLT on a flat
  // cooldown (no ammo), INT-scaled, so a Caster character's auto-grown INT (§38) finally has a payoff. Art
  // borrows the 2H haft placeholder until bespoke staff/tome sprites land. ────────────────────────────────
  "x-staff-arcane-lance": {
    id: "x-staff-arcane-lance",
    name: "Arcanist's Lance",
    sprite: "tombstone-greatsword", // placeholder 2H haft until a bespoke staff is generated
    scalingGrades: { int: "B" },
    requirements: { int: 6 },
    durability: 80,
    damage: 5, // staff-bonk fallback; the cast block is the identity
    range: 96,
    halfArc: 0.5,
    cooldown: 0.5,
    displayLength: 128,
    swingArc: 1.1,
    gripFrac: 0.12,
    twoHanded: true,
    vfxRadius: 60,
    cast: {
      damage: 16, // a heavy line-clearing bolt
      speed: 620,
      range: 720,
      cooldown: 0.62,
      pierce: 99, // tears through the whole line
      bulletKind: "orb",
      scalingGrades: { int: "A" },
    },
    tags: {
      grip: "2H",
      size: "L",
      delivery: "projectile",
      fireMode: "tap-charge",
      element: "arcane",
      classPool: "caster",
      family: "staff",
      rangeBand: "long",
      scaling: ["INT"],
    },
  },
  "x-staff-storm-rod": {
    id: "x-staff-storm-rod",
    name: "Stormcaller Rod",
    sprite: "tombstone-greatsword", // placeholder 2H haft
    scalingGrades: { int: "C" },
    requirements: { int: 5 },
    durability: 70,
    damage: 4,
    range: 88,
    halfArc: 0.5,
    cooldown: 0.4,
    displayLength: 116,
    swingArc: 1.0,
    gripFrac: 0.14,
    twoHanded: true,
    vfxRadius: 56,
    cast: {
      damage: 10, // faster, lighter bolts than the Lance
      speed: 760,
      range: 640,
      cooldown: 0.32,
      pierce: 3,
      bulletKind: "orb",
      scalingGrades: { int: "B" },
    },
    tags: {
      grip: "2H",
      size: "L",
      delivery: "projectile",
      fireMode: "auto",
      element: "shock",
      classPool: "caster",
      family: "rod",
      rangeBand: "long",
      scaling: ["INT"],
    },
  },
  "x-gun-coffin-shotgun": {
    id: "x-gun-coffin-shotgun",
    name: "Coffin Shotgun",
    scalingGrades: { str: "C", dex: "C" },
    requirements: { str: 6 },
    durability: 60,
    damage: 6,
    range: 80,
    halfArc: 0.6,
    cooldown: 0.7,
    displayLength: 120,
    swingArc: 1.2,
    gripFrac: 0.14,
    vfxRadius: 72,
    gun: {
      damage: 5, // per pellet — devastating up close, falls off with the spread
      projectileSpeed: 720,
      range: 360, // short-ranged
      fireRate: 0.7,
      pellets: 7, // a cone of buckshot
      spread: 0.34, // ~±19°
      pierce: 1,
      magazine: 2, // double-barrel
      reloadSeconds: 1.6,
      bulletKind: "pellet",
      muzzle: "boom",
      muzzleColor: 0xff6a2a,
      recoil: 0.0035, // BOOM
      scalingGrades: { str: "C", dex: "C" },
    },
    tags: {
      grip: "2H",
      size: "L",
      delivery: "spread",
      fireMode: "tap-charge",
      element: "physical",
      classPool: "ranged",
      family: "shotgun",
      rangeBand: "close",
      scaling: ["STR", "DEX"],
    },
  },
  "x-gun-gatling": {
    id: "x-gun-gatling",
    name: "Gatling",
    scalingGrades: { dex: "B" },
    requirements: { dex: 10, str: 6 },
    durability: 90,
    damage: 4,
    range: 76,
    halfArc: 0.5,
    cooldown: 0.4,
    displayLength: 140,
    swingArc: 1.0,
    gripFrac: 0.12,
    vfxRadius: 58,
    gun: {
      damage: 3, // tiny per-shot, but a torrent
      projectileSpeed: 780,
      range: 560,
      fireRate: 0.08, // rapid auto
      spread: 0.11, // sprays a bit — walk it onto the target
      pierce: 1,
      magazine: 50,
      reloadSeconds: 2.4, // long reload is the cost of the torrent
      bulletKind: "tracer",
      muzzle: "rapid",
      muzzleColor: 0xfff0a0,
      recoil: 0.0006, // a faint buzz — held steady so you can walk the stream onto targets
      scalingGrades: { dex: "B" },
    },
    tags: {
      grip: "2H",
      size: "XL",
      delivery: "projectile",
      fireMode: "auto",
      element: "physical",
      classPool: "ranged",
      family: "gun",
      rangeBand: "mid",
      scaling: ["DEX"],
    },
  },
  "x-gun-nailgun": {
    id: "x-gun-nailgun",
    name: "Nailgun",
    scalingGrades: { dex: "C", str: "C" },
    requirements: { str: 4, dex: 4 },
    durability: 80,
    damage: 4,
    range: 74,
    halfArc: 0.5,
    cooldown: 0.3,
    displayLength: 104,
    swingArc: 1.1,
    gripFrac: 0.14,
    vfxRadius: 50,
    gun: {
      damage: 5,
      projectileSpeed: 1000,
      range: 600,
      fireRate: 0.16, // brisk
      pierce: 3, // nails skewer a line of enemies
      magazine: 16,
      reloadSeconds: 1.3,
      bulletKind: "nail",
      muzzle: "punch",
      muzzleColor: 0xd6dde6,
      recoil: 0.0012,
      scalingGrades: { dex: "C", str: "C" },
    },
    tags: {
      grip: "1H",
      size: "M",
      delivery: "projectile",
      fireMode: "auto",
      element: "physical",
      classPool: "ranged",
      family: "nailgun",
      rangeBand: "mid",
      scaling: ["DEX", "STR"],
    },
  },
  "x-gun-ricochet-pistol": {
    id: "x-gun-ricochet-pistol",
    name: "Ricochet Pistol",
    scalingGrades: { dex: "C", luk: "C" },
    requirements: { dex: 7 },
    durability: 75,
    damage: 4,
    range: 70,
    halfArc: 0.5,
    cooldown: 0.34,
    displayLength: 88,
    swingArc: 1.1,
    gripFrac: 0.16,
    vfxRadius: 56,
    gun: {
      damage: 8,
      projectileSpeed: 840,
      range: 1000, // long-lived so it can bounce and keep hunting
      fireRate: 0.34,
      pierce: 2, // tags a couple targets as it caroms
      bounces: 3, // caroms off the arena walls
      magazine: 8,
      reloadSeconds: 1.2,
      bulletKind: "ricochet",
      muzzle: "spark",
      muzzleColor: 0x5dd6ff,
      recoil: 0.002,
      scalingGrades: { dex: "C", luk: "C" },
    },
    tags: {
      grip: "1H",
      size: "S",
      delivery: "projectile",
      fireMode: "tap-charge",
      element: "shock",
      classPool: "ranged",
      family: "pistol",
      rangeBand: "long",
      scaling: ["DEX", "LUK"],
    },
  },
};

/** Every weapon: the hand-authored BASE roster + the codegen'd §13 EXPANSION batch (the +300, art-backed
 *  but held out of the active roster via `expansion`). Both are `WeaponDef`s, so anything keyed by id
 *  (held sprite, card art, VFX) resolves for either. */
export const WEAPONS: Record<string, WeaponDef> = { ...BASE_WEAPONS, ...EXPANSION_WEAPONS };

/** The §9 unarmed-fallback weapon id (empty hands). Not part of the arsenal cycle/gallery. */
export const FISTS_WEAPON = "fists";
/** ACTIVE arsenal (Q/E cycle · Testing-Grounds gallery · drop pool) — every weapon EXCEPT the fists
 *  fallback AND the §13 expansion batch (those are defined+arted but curated-in later, one by one). */
export const WEAPON_IDS = Object.keys(WEAPONS).filter(
  (id) => id !== FISTS_WEAPON && !WEAPONS[id]?.expansion,
);
/** The +300 §13 expansion ids — defined + arted, held out of `WEAPON_IDS`. For curation/preview tooling. */
export const EXPANSION_WEAPON_IDS = Object.keys(WEAPONS).filter((id) => WEAPONS[id]?.expansion);
export const DEFAULT_WEAPON = "rusty-cleaver";

/** Next weapon in the roster (RMB/cycle), wrapping around. */
export function nextWeapon(current: string): string {
  const i = WEAPON_IDS.indexOf(current);
  return WEAPON_IDS[(i + 1) % WEAPON_IDS.length] ?? DEFAULT_WEAPON;
}

/** Previous weapon in the roster (E / back-cycle), wrapping around. */
export function prevWeapon(current: string): string {
  const i = WEAPON_IDS.indexOf(current);
  const n = WEAPON_IDS.length;
  return WEAPON_IDS[(((i < 0 ? 0 : i) - 1 + n) % n) as number] ?? DEFAULT_WEAPON;
}
