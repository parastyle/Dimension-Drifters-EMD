/**
 * Leveling + the five-attribute model (§11/§12). PURE + data-driven. The server applies it; the
 * HUD reads the synced attributes. Per §12: XP is SQUAD-SHARED, each level grants 3 points (1 auto
 * class-attr + 1 auto requirement-attr + 1 FLEX the player chooses), the level-up window is an
 * invincible 5-second pick, signature nodes unlock every 5 levels (§8), and the per-run cap is 30.
 */
import { PLAYER_MAX_HP, PLAYER_REGEN } from "./constants.js";

/** XP needed to go from level 1 → 2. */
export const XP_BASE = 6;
/** Each level needs XP_GROWTH× more than the last. v0.103 (audit H1): 1.45 → 1.15 — the old curve needed
 *  ~638k cumulative XP to cap while kills pay 1-3, so a real run reached ~L8 and the §8 signature loop
 *  (a pick every 5 levels) was unreachable. At 1.15 the cap costs ~2.3k XP: roughly L13-15 by the first
 *  boss (2-3 signature picks — the design intent) and L30 over a deep §6 chain run, since levels PERSIST
 *  across dimension pushes (only a fresh run resets to L1). A test pins the curve's reachability band. */
export const XP_GROWTH = 1.15;
/** Per-run level cap (§12 [LOCKED]). */
export const LEVEL_CAP = 30;
/** Seconds to pick in the level-up window before it auto-resolves (§12 [LOCKED]). */
export const LEVELUP_WINDOW_SECONDS = 5;

/** XP required to advance FROM `level` to `level+1`. Pure. */
export function xpToNextLevel(level: number): number {
  return Math.round(XP_BASE * XP_GROWTH ** (Math.max(1, level) - 1));
}

/** The five attributes (§11): STR melee · DEX finesse/ranged · INT caster+signature · CON survivability · LUK luck. */
export const ATTRS = ["str", "dex", "int", "con", "luk"] as const;
export type Attr = (typeof ATTRS)[number];

/** Type guard for an untrusted value (e.g. a network message field) → a valid `Attr`. */
export function isAttr(value: unknown): value is Attr {
  return typeof value === "string" && (ATTRS as readonly string[]).includes(value);
}

/**
 * M0 melee Drifter auto-allocation (§12 "1 class attr + 1 requirement attr"). One character for M0;
 * per-character class/requirement attrs become data when more characters land. (tuning)
 */
export const M0_CLASS_ATTR: Attr = "str";
export const M0_REQ_ATTR: Attr = "con";

/** Per-point attribute scaling (tuning). All relative to the 1/1/1/1/1 start (§12). */
export const CON_HP_PER = 8; // +8 max HP per CON over 1
export const CON_REGEN_PER = 0.7; // +0.7 HP/sec regen per CON over 1

/** §30 v0.118 CRIT (Brotato parity #1): a chance for a damage source to strike for CRIT_MULT×, rolled
 *  server-side per source. LUK is the primary crit stat (it already reads into loot rarity — now it also
 *  reads into hit variety), DEX a minor contributor. Capped so it never becomes a guaranteed-crit build. */
export const CRIT_BASE = 0.05; // 5% at the 1/1 baseline
export const CRIT_PER_LUK = 0.02; // +2% per LUK over 1
export const CRIT_PER_DEX = 0.008; // +0.8% per DEX over 1
export const CRIT_CHANCE_CAP = 0.75;
export const CRIT_MULT = 2; // a crit deals double — a big, readable spike (gold number + extra juice)

/** A player's live crit CHANCE (0..CRIT_CHANCE_CAP) from LUK/DEX. PURE — server rolls it, client shows it. */
export function critChanceFor(luk: number, dex: number): number {
  const c = CRIT_BASE + CRIT_PER_LUK * (luk - 1) + CRIT_PER_DEX * (dex - 1);
  return Math.max(0, Math.min(CRIT_CHANCE_CAP, c));
}

export interface DerivedStats {
  /** Max HP (CON). */
  maxHp: number;
  /** HP/sec regen (CON). */
  regen: number;
}

/**
 * Derive the live SURVIVABILITY stats from a player's attributes. PURE.
 * DAMAGE is per-weapon §10 grades (`weaponDamageMult` in weapons.ts) — STR/DEX scale damage THERE,
 * not here. Attack-SPEED is flat weapon cooldown (a speed-stat source is OPEN). This derives only the
 * CON survivability stats.
 */
export function deriveStats(a: { con: number }): DerivedStats {
  return {
    maxHp: PLAYER_MAX_HP + CON_HP_PER * (a.con - 1),
    regen: PLAYER_REGEN + CON_REGEN_PER * (a.con - 1),
  };
}
