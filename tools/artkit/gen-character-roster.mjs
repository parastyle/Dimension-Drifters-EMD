#!/usr/bin/env node
// Regenerates packages/shared/src/characters.ts — the §7 playable roster — from the INSTALLED character
// sprites (the manifest) + the concept names. Run after promoting + harvest-installing new characters:
//   node tools/artkit/gen-character-roster.mjs
// Playable = the Drifter + every installed `cc-*` concept character + explicitly installed
// `proto-*` owner prototype; enemies are excluded.
// When untracked out/*/parts/parts.json inputs are absent (fresh checkout), tracked presentation scales
// are preserved while roster/default contracts are still generated and checked.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { emit, isCheck } from "./lib/emit.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const manifestTs = resolve(here, "../../packages/client/src/sprites/manifest.ts");
const conceptsJson = resolve(here, "subjects.concepts.json");
const outFile = resolve(here, "../../packages/shared/src/characters.ts");

const manifest = readFileSync(manifestTs, "utf8");
const ids = [...manifest.matchAll(/^\s{2}"?([a-z0-9][a-z0-9-]*)"?:\s*\{\s*$/gm)].map((m) => m[1]);
const ccs = ids.filter((id) => id.startsWith("cc-")).sort();
const prototypes = ids.filter((id) => id.startsWith("proto-")).sort();
const roster = ["drifter", ...ccs, ...prototypes];
const defaultCharacter = "proto-cowboy-hidden-face";
if (!prototypes.includes(defaultCharacter)) {
  throw new Error(`Default whole-art character ${defaultCharacter} is not installed`);
}
const partsFile = (id) => resolve(here, `out/${id}/parts/parts.json`);
const trackedScales = {};
try {
  const currentOutput = readFileSync(outFile, "utf8");
  const scaleBlock = currentOutput.match(
    /const CHARACTER_SCALE: Record<string, number> = \{([\s\S]*?)\n\};/,
  )?.[1];
  for (const match of scaleBlock?.matchAll(/^\s+"([^"]+)":\s+([0-9.]+),$/gm) ?? []) {
    trackedScales[match[1]] = Number(match[2]);
  }
} catch {}
const missingParts = roster.filter((id) => !existsSync(partsFile(id)));
if (missingParts.length > 0) {
  console.warn(
    `⚠ characters.ts scale measurement unavailable for ${missingParts.length} character(s); ` +
      `preserving ${Object.keys(trackedScales).length} tracked presentation scale(s).`,
  );
}

let names = {};
try {
  for (const s of JSON.parse(readFileSync(conceptsJson, "utf8")))
    if (s.id && s.name) names[s.id] = s.name;
} catch {}
const pretty = {
  drifter: "The Drifter",
  // short, in-HUD-friendly overrides for the long concept names
  "cc-buzzard-jeptha-hale": "Buzzard",
  "cc-cogwarden": "Cogwarden",
  "cc-deepfall-korr": "Deepfall Korr",
  "cc-yuki-the-hollow-smile": "Yuki",
  "cc-hollowmaw": "Hollowmaw",
  "cc-brother-cassian-the-ashen-crusader": "Brother Cassian",
  "cc-halcyon-7": "Halcyon-7",
  "cc-pyra-cinderhowl-the-flame-caster": "Pyra Cinderhowl",
};
const titleCaseId = (id) =>
  id
    .replace(/^proto-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
const nameOf = (id) =>
  pretty[id] ?? names[id] ?? (id.startsWith("proto-") ? `Prototype ${titleCaseId(id)}` : id);

// Per-character render scale: the rig normalises every BODY to the same height, so characters drawn with
// a small/thin silhouette read as "tiny" next to chunky ones. Measure each one's rendered footprint
// (body normalised) and gently scale up the small-footprint ones toward the roster median (capped), so
// nobody looks shrunk. Future-proof: newly-promoted small characters auto-correct on the next gen.
function footprint(id) {
  try {
    const p = JSON.parse(readFileSync(partsFile(id), "utf8"));
    let top = Infinity,
      bot = -Infinity,
      left = Infinity,
      right = -Infinity;
    for (const part of p.parts) {
      top = Math.min(top, part.cy - part.h / 2);
      bot = Math.max(bot, part.cy + part.h / 2);
      left = Math.min(left, part.cx - part.w / 2);
      right = Math.max(right, part.cx + part.w / 2);
    }
    return ((bot - top) * (right - left)) / (p.body.h * p.body.h); // area, body-height-normalised
  } catch {
    return null;
  }
}
const areas = roster.map((id) => ({ id, a: footprint(id) })).filter((x) => x.a != null);
const sorted = areas.map((x) => x.a).sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)] ?? 1;
const scaleOf = (id) => {
  // Owner-authored prototype intake is already normalized to the canonical 76 px body unit.
  // Preserve that exact scale instead of applying the optional thin-silhouette presentation bump.
  if (id.startsWith("proto-")) return 1;
  const a = footprint(id);
  if (a == null) return trackedScales[id] ?? 1;
  if (a >= median) return 1;
  return Math.min(1.25, Math.max(1, Math.sqrt(median / a))); // gentle, capped at +25%
};
// Â§classmerge identity data. This lived in the generated output during the metagame migration, but the
// roster generator did not own it and erased it on `pnpm gen`. Keep the documented legacy migration table
// here and assign every visual-only owner prototype the same neutral kit, so characters.ts remains a pure
// generated file and full generation is safe.
const kits = {
  drifter: [[2, 2, 2, 2, 2], "unwritten"],
  "cc-asha-the-ash-walker": [[2, 2, 2, 3, 1], "mend-the-broken"],
  "cc-bastion-vance": [[3, 1, 1, 4, 1], "planted"],
  "cc-brother-cassian-the-ashen-crusader": [[3, 1, 1, 4, 1], "habit-and-prayer"],
  "cc-brother-tendo-of-the-still-bell": [[3, 2, 1, 3, 1], "one-perfect-strike"],
  "cc-bryda-houndcall": [[3, 3, 1, 2, 1], "the-pack-finds-you"],
  "cc-buzzard-jeptha-hale": [[3, 2, 1, 2, 2], "overstuffed-bandoliers"],
  "cc-cinderpyre": [[2, 1, 4, 2, 1], "molten-core"],
  "cc-cogwarden": [[3, 1, 1, 4, 1], "does-not-stop"],
  "cc-cordell-coldsnap-vane": [[1, 3, 1, 2, 3], "coldsnap"],
  "cc-corvane-the-crimson-draught": [[1, 1, 4, 3, 1], "the-crimson-draught"],
  "cc-crowmantle-sel": [[1, 3, 1, 1, 4], "a-better-owner"],
  "cc-dame-veyra-of-the-thornwatch": [[2, 4, 1, 2, 1], "insufferably-graceful"],
  "cc-deepfall-korr": [[3, 1, 2, 3, 1], "mag-boots"],
  "cc-doctor-phineas-quill-esq": [[1, 2, 3, 1, 3], "snake-oil"],
  "cc-dunkel-the-coinblade": [[2, 2, 1, 2, 3], "hazard-rates"],
  "cc-elias-parson-thorne": [[2, 2, 2, 1, 3], "graveside-manner"],
  "cc-gravewake": [[2, 1, 2, 3, 2], "already-dead"],
  "cc-grix-boltcaster": [[3, 1, 1, 3, 2], "braced"],
  "cc-halcyon-7": [[1, 3, 2, 2, 2], "half-projection"],
  "cc-hollowmaw": [[2, 1, 4, 2, 1], "whispered-rites"],
  "cc-iridia-of-the-nine-veils": [[1, 2, 4, 1, 2], "sees-every-future"],
  "cc-kuro-oni-the-demon-mask": [[3, 2, 1, 3, 1], "temple-wall"],
  "cc-magdalene-the-ledger-crowe": [[2, 3, 1, 2, 2], "posted"],
  "cc-mawkin-sourgrin-the-hex-witch": [[1, 1, 4, 2, 2], "bottled-spite"],
  "cc-mei-ling-of-the-jade-ribbon": [[1, 4, 2, 1, 2], "ribbon-step"],
  "cc-mirelurk-caine": [[3, 2, 1, 3, 1], "bog-patience"],
  "cc-neon-mirage": [[1, 4, 1, 2, 2], "package-deal"],
  "cc-pyra-cinderhowl-the-flame-caster": [[2, 2, 4, 1, 1], "let-it-out"],
  "cc-quickfinger-odette-lacroix": [[1, 2, 1, 2, 4], "the-house"],
  "cc-raijin-k-the-storm-fist": [[4, 2, 1, 2, 1], "thunder-behind"],
  "cc-s-jiro-the-wayward-blade": [[3, 4, 1, 1, 1], "iai"],
  "cc-sable-cipher": [[1, 4, 2, 1, 2], "ice-breaker"],
  "cc-sir-galloway-the-unbending": [[2, 1, 1, 4, 2], "the-unbending"],
  "cc-sir-mordrane-the-hollow-oath": [[3, 1, 2, 3, 1], "hollow-oath"],
  "cc-the-bandida-la-sombra": [[2, 3, 1, 1, 3], "a-shape-in-the-dust"],
  "cc-the-hollow-mask": [[1, 4, 1, 1, 3], "porcelain"],
  "cc-thornroot": [[2, 1, 2, 4, 1], "regrow"],
  "cc-tinker-magnus-brasswick": [[1, 2, 4, 2, 1], "pressurized"],
  "cc-yuki-the-hollow-smile": [[2, 4, 1, 1, 2], "fox-dance"],
  ...Object.fromEntries(
    prototypes.map((id) => [id, [[2, 2, 2, 2, 2], "unwritten"]]),
  ),
};
for (const id of roster) {
  if (!kits[id]) throw new Error(`Missing character kit for ${id}`);
}
for (const id of Object.keys(kits)) {
  if (!roster.includes(id)) throw new Error(`Character kit targets non-playable id ${id}`);
}
const kitRows = Object.entries(kits).map(([id, [spread, quirk]]) => {
  const [str, dex, int, con, luk] = spread;
  return `  ${JSON.stringify(id)}: { spread: { str: ${str}, dex: ${dex}, int: ${int}, con: ${con}, luk: ${luk} }, quirk: ${JSON.stringify(quirk)} },`;
});

const scales = {};
for (const id of roster) {
  const s = scaleOf(id);
  if (s >= 1.05) scales[id] = Math.round(s * 1000) / 1000; // skip negligible bumps
}

const body = `// AUTO-GENERATED by tools/artkit/gen-character-roster.mjs — re-run after promoting characters.
// §7 playable character roster. Each id keys an INSTALLED sprite
// manifest (public/sprites/<id>/). Purely visual for M0 (stats live on §11 attributes); per-character
// class/variant passives are a follow-on. Legacy ids remain available for compatibility and dev inspection;
// ordinary selection and cycling use the whole-art subset.

export const PLAYABLE_CHARACTERS = [
${roster.map((id) => `  ${JSON.stringify(id)},`).join("\n")}
] as const;

export type PlayableCharacter = (typeof PLAYABLE_CHARACTERS)[number];

/** Installed whole-art characters available to ordinary player selection. */
export const WHOLE_ART_CHARACTERS = [
${prototypes.map((id) => `  ${JSON.stringify(id)},`).join("\n")}
] as const satisfies readonly PlayableCharacter[];

export type WholeArtCharacter = (typeof WHOLE_ART_CHARACTERS)[number];

/** Â§classmerge sum-10 starting identity and signature quirk; legacy characters retain their authored
 * kits while visual-only owner prototypes receive the neutral Unwritten kit. */
export const CHARACTER_KITS = {
${kitRows.join("\n")}
} as const satisfies Record<PlayableCharacter, {
  readonly spread: Readonly<Record<"str" | "dex" | "int" | "con" | "luk", number>>;
  readonly quirk: string;
}>;

export const DEFAULT_CHARACTER = ${JSON.stringify(defaultCharacter)} as const satisfies WholeArtCharacter;

/** Next character in the full legacy-compatible roster, wrapping. */
export function nextCharacter(current: string): string {
  const i = PLAYABLE_CHARACTERS.indexOf(current as (typeof PLAYABLE_CHARACTERS)[number]);
  return PLAYABLE_CHARACTERS[(i + 1) % PLAYABLE_CHARACTERS.length] ?? DEFAULT_CHARACTER;
}

/** Untrusted-id guard for the ordinary whole-art selection contract. */
export function isWholeArtCharacter(id: unknown): id is WholeArtCharacter {
  return (
    typeof id === "string" && (WHOLE_ART_CHARACTERS as readonly string[]).includes(id)
  );
}

/** Next ordinary whole-art character, wrapping; legacy/unknown ids reset to the shared default. */
export function nextWholeArtCharacter(current: string): WholeArtCharacter {
  const i = WHOLE_ART_CHARACTERS.indexOf(current as WholeArtCharacter);
  if (i < 0) return DEFAULT_CHARACTER;
  return WHOLE_ART_CHARACTERS[(i + 1) % WHOLE_ART_CHARACTERS.length] ?? DEFAULT_CHARACTER;
}

/** Pretty display name for the HUD (falls back to a title-cased id). */
export function characterName(id: string): string {
  return (
    CHARACTER_NAMES[id] ??
    id
      .replace(/^cc-/, "")
      .replace(/-/g, " ")
      .replace(/\\b\\w/g, (c) => c.toUpperCase())
  );
}

const CHARACTER_NAMES: Record<string, string> = {
${roster.map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(nameOf(id))},`).join("\n")}
};

/** §7 per-character render-scale bump for small-footprint skins (so the thin/compact ones don't read as
 *  tiny next to the chunky ones). 1.0 = no change; the client multiplies the rig by this. */
export function characterScale(id: string): number {
  return CHARACTER_SCALE[id] ?? 1;
}
const CHARACTER_SCALE: Record<string, number> = {
${Object.entries(scales)
  .map(([id, s]) => `  ${JSON.stringify(id)}: ${s},`)
  .join("\n")}
};
`;
emit(outFile, body, "characters.ts");
if (!isCheck) {
  console.log(
    `character roster: ${roster.length} playable (drifter + ${ccs.length} cc-* + ${prototypes.length} proto-*) -> ${outFile}`,
  );
}
