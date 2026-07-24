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
// Character flavor metadata. Keep legacy signature names, but generate no numeric spread or class bias.
const kits = {
  drifter: "unwritten",
  "cc-asha-the-ash-walker": "mend-the-broken",
  "cc-bastion-vance": "planted",
  "cc-brother-cassian-the-ashen-crusader": "habit-and-prayer",
  "cc-brother-tendo-of-the-still-bell": "one-perfect-strike",
  "cc-bryda-houndcall": "the-pack-finds-you",
  "cc-buzzard-jeptha-hale": "overstuffed-bandoliers",
  "cc-cinderpyre": "molten-core",
  "cc-cogwarden": "does-not-stop",
  "cc-cordell-coldsnap-vane": "coldsnap",
  "cc-corvane-the-crimson-draught": "the-crimson-draught",
  "cc-crowmantle-sel": "a-better-owner",
  "cc-dame-veyra-of-the-thornwatch": "insufferably-graceful",
  "cc-deepfall-korr": "mag-boots",
  "cc-doctor-phineas-quill-esq": "snake-oil",
  "cc-dunkel-the-coinblade": "hazard-rates",
  "cc-elias-parson-thorne": "graveside-manner",
  "cc-gravewake": "already-dead",
  "cc-grix-boltcaster": "braced",
  "cc-halcyon-7": "half-projection",
  "cc-hollowmaw": "whispered-rites",
  "cc-iridia-of-the-nine-veils": "sees-every-future",
  "cc-kuro-oni-the-demon-mask": "temple-wall",
  "cc-magdalene-the-ledger-crowe": "posted",
  "cc-mawkin-sourgrin-the-hex-witch": "bottled-spite",
  "cc-mei-ling-of-the-jade-ribbon": "ribbon-step",
  "cc-mirelurk-caine": "bog-patience",
  "cc-neon-mirage": "package-deal",
  "cc-pyra-cinderhowl-the-flame-caster": "let-it-out",
  "cc-quickfinger-odette-lacroix": "the-house",
  "cc-raijin-k-the-storm-fist": "thunder-behind",
  "cc-s-jiro-the-wayward-blade": "iai",
  "cc-sable-cipher": "ice-breaker",
  "cc-sir-galloway-the-unbending": "the-unbending",
  "cc-sir-mordrane-the-hollow-oath": "hollow-oath",
  "cc-the-bandida-la-sombra": "a-shape-in-the-dust",
  "cc-the-hollow-mask": "porcelain",
  "cc-thornroot": "regrow",
  "cc-tinker-magnus-brasswick": "pressurized",
  "cc-yuki-the-hollow-smile": "fox-dance",
  ...Object.fromEntries(
    prototypes.map((id) => [id, "unwritten"]),
  ),
};
for (const id of roster) {
  if (!kits[id]) throw new Error(`Missing character kit for ${id}`);
}
for (const id of Object.keys(kits)) {
  if (!roster.includes(id)) throw new Error(`Character kit targets non-playable id ${id}`);
}
const kitRows = Object.entries(kits).map(
  ([id, quirk]) => `  ${JSON.stringify(id)}: { quirk: ${JSON.stringify(quirk)} },`,
);

const scales = {};
for (const id of roster) {
  const s = scaleOf(id);
  if (s >= 1.05) scales[id] = Math.round(s * 1000) / 1000; // skip negligible bumps
}

const body = `// AUTO-GENERATED by tools/artkit/gen-character-roster.mjs — re-run after promoting characters.
// §7 playable character roster. Each id keys an INSTALLED sprite
// manifest (public/sprites/<id>/). Character identity is visual/flavor metadata only; no numeric stats
// or class bias are generated. Legacy ids remain available for compatibility and dev inspection;
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

/** Character identity metadata only; no generated numeric stats or class bias. */
export const CHARACTER_KITS = {
${kitRows.join("\n")}
} as const satisfies Record<PlayableCharacter, {
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
