/**
 * §7 playable character roster — the cosmetic skins a player can swap between (the C key cycles them).
 * Each id keys an INSTALLED sprite manifest (public/sprites/<id>/). Purely visual for M0 (stats live on
 * the §11 attributes, not the skin); per-character class/variant passives are a follow-on (§7/§21).
 * The Drifter is the default + the canonical "pill grunt" anchor (§28.3). The rest are Mike's hand-picked,
 * on-model concept characters promoted to playable rigs.
 */
export const PLAYABLE_CHARACTERS = [
  "drifter",
  "cc-buzzard-jeptha-hale",
  "cc-cogwarden",
  "cc-deepfall-korr",
  "cc-yuki-the-hollow-smile",
  "cc-hollowmaw",
  "cc-brother-cassian-the-ashen-crusader",
  "cc-halcyon-7",
  "cc-pyra-cinderhowl-the-flame-caster",
] as const;

export const DEFAULT_CHARACTER = "drifter";

/** Next character in the roster, wrapping. PURE (server cycles authoritatively; client mirrors). */
export function nextCharacter(current: string): string {
  const i = PLAYABLE_CHARACTERS.indexOf(current as (typeof PLAYABLE_CHARACTERS)[number]);
  return PLAYABLE_CHARACTERS[(i + 1) % PLAYABLE_CHARACTERS.length] ?? DEFAULT_CHARACTER;
}

/** Pretty display name for the HUD (falls back to a title-cased id). */
export function characterName(id: string): string {
  return (
    CHARACTER_NAMES[id] ??
    id
      .replace(/^cc-/, "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

const CHARACTER_NAMES: Record<string, string> = {
  drifter: "The Drifter",
  "cc-buzzard-jeptha-hale": "Buzzard",
  "cc-cogwarden": "Cogwarden",
  "cc-deepfall-korr": "Deepfall Korr",
  "cc-yuki-the-hollow-smile": "Yuki",
  "cc-hollowmaw": "Hollowmaw",
  "cc-brother-cassian-the-ashen-crusader": "Brother Cassian",
  "cc-halcyon-7": "Halcyon-7",
  "cc-pyra-cinderhowl-the-flame-caster": "Pyra Cinderhowl",
};
