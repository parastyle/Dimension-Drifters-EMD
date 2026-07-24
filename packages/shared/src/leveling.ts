/**
 * Legacy attribute labels retained only for authored metadata and the shipped ultimate variant matrix.
 * There is no numeric player-stat or level progression state.
 */
export const ATTRS = ["str", "dex", "int", "con", "luk"] as const;
export type Attr = (typeof ATTRS)[number];
export type AttrValues = Readonly<Record<Attr, number>>;

/** Flat crit contract. Relics will contribute additive values through the iterable hook. */
export const CRIT_BASE = 0.05;
export const CRIT_CHANCE_CAP = 0.75;
export const CRIT_MULT = 2;

/**
 * Flat base crit plus additive modifiers. The L1 runtime passes an empty collection; the accumulator is
 * intentionally ready for the relic lane without inventing any relic state here.
 */
export function critChanceFor(additiveModifiers: Iterable<number> = []): number {
  let chance = CRIT_BASE;
  for (const modifier of additiveModifiers) {
    if (Number.isFinite(modifier)) chance += modifier;
  }
  return Math.max(0, Math.min(CRIT_CHANCE_CAP, chance));
}
