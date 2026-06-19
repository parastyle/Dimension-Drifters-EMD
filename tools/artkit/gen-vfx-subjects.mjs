#!/usr/bin/env node
// artkit/gen-vfx-subjects.mjs — emit a VFX SUBJECTS manifest (kind:"vfx") for the +300 expansion arsenal so
// orchestrate can render 3 candidate hero-VFX per weapon (§14). Each subject:
//   • references the WEAPON'S OWN art as Image 1 (styleRef out/<id>/identity-ref.png) → colour/style match,
//   • carries a SIMPLE prompt that reflects the weapon's SIGNATURE MOVE (derived from behavior.kind +
//     element + family) and explicitly forbids re-drawing the weapon + baking any ground (§14 NO-GROUND),
//   • outputs to out/vfx-<id>/ (where the Weaponsmith's vfxSubjectFor expects the candidates).
//
//   node tools/artkit/gen-vfx-subjects.mjs
//   SUBJECTS=subjects-vfx-300.json CANDIDATES=3 PARALLEL=20 node tools/artkit/orchestrate.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const REPO = resolve(ROOT, "..", "..");
const SRC = join(REPO, "data", "weapon-concepts-300.json");
const OUT = join(ROOT, "subjects-vfx-300.json");

/** Element → a short colour/material descriptor for the effect (defaults to the weapon's own palette). */
function elementColor(el) {
  const e = String(el || "").toLowerCase();
  if (/(fire|flame|ember|magma|burn|pyro|inferno|solar|sun)/.test(e)) return "hot ember-orange + smoke";
  if (/(ice|frost|cryo|cold|glacial|rime)/.test(e)) return "pale cyan frost + ice-shards";
  if (/(lightning|electric|storm|volt|tesla|shock|galvanic)/.test(e)) return "crackling teal-white sparks";
  if (/(poison|toxic|venom|acid|plague|spore|blight)/.test(e)) return "sickly lime-green";
  if (/(arcane|void|null|hex|witch|eldritch|abyss|necro|grave|death|soul)/.test(e)) return "arc-violet energy";
  if (/(holy|light|radiant|saint|sun|blessed|sacred)/.test(e)) return "golden-white light";
  if (/(blood|crimson|gore)/.test(e)) return "dark crimson";
  if (/(sand|dust|earth|stone|rock)/.test(e)) return "tan dust + grit";
  return "to match the weapon's own colours";
}

const GROUND = new Set(["quake"]); // slams hammer straight DOWN — top-down ground effect

const NO_GROUND =
  "Render on a perfectly flat fully-opaque #00ff00 chroma field with NOTHING else behind or beneath it — " +
  "NO ground, NO floor disc, NO dirt, NO background, NO terrain (it composites ON TOP of the live arena " +
  "floor at runtime, so any baked ground would show as a wrong solid blob). SIMPLE flat-cel CHUNKY shapes, " +
  "thick black outlines, MINIMAL interior detail to match the game's bold character art; do NOT draw the " +
  "weapon itself — only the effect.";

/** Build the signature-move VFX prompt for one weapon from its behavior kind. Kept SHORT + bold. */
function vfxPrompt(w) {
  const kind = (w.behavior && w.behavior.kind) || "edge";
  const color = elementColor(w.element);
  const who = `the weapon in Image 1 (a ${w.name}, a ${w.element || "physical"} ${w.family || "weapon"})`;
  const tail = `Frozen at its peak, ${color}. ${NO_GROUND}`;
  switch (kind) {
    case "gun":
      return `The MUZZLE BLAST ${who} makes when it FIRES — a single sharp muzzle flash with a short bright bullet/tracer streak shooting to the RIGHT and a small puff of smoke. ${tail}`;
    case "beam":
      return `The BEAM ${who} makes when it fires — one straight bright energy beam lancing to the RIGHT with a hot white core and a soft outer glow. ${tail}`;
    case "scatter":
      return `The SCATTER BLAST ${who} makes — a wide cone of several pellets/shards spraying out to the RIGHT from a muzzle flash, with a puff of smoke. ${tail}`;
    case "thrown":
      return `The IMPACT ${who} makes when the thrown weapon lands — one sharp impact-splat with a short spin-streak and a few flung flecks. ${tail}`;
    case "chainLightning":
      return `The CHAIN-LIGHTNING ${who} makes — one jagged forking lightning bolt arcing to the RIGHT toward a target, crackling, a couple of small branch-sparks. ${tail}`;
    case "quake":
      return `The ground-slam SHOCKWAVE ${who} makes when hammered straight DOWN — a rough RING of a FEW (6–10) big, bold, chunky angular slabs tilting UP and erupting outward around a central impact point, with a little flung debris and dust. Thin dark radiating crack-lines are fine (cracks in whatever floor is underneath) but do NOT fill them with any colour. ${tail}`;
    default: // edge — a melee cut/slash
      return `The CUT ${who} makes the instant it strikes — one bold, sharp slash-arc sweeping to the RIGHT, violent and clean, with a few sparks/flecks flung off the edge. ${tail}`;
  }
}

const data = JSON.parse(readFileSync(SRC, "utf8"));
const subjects = [];
let missing = 0;
for (const w of data.weapons) {
  if (!w.id) continue;
  const ref = `out/${w.id}/identity-ref.png`;
  if (!existsSync(join(ROOT, ref))) {
    missing++;
    continue; // no reference art → skip (can't anchor the VFX to the weapon)
  }
  const kind = (w.behavior && w.behavior.kind) || "edge";
  const subj = {
    id: `vfx-${w.id}`,
    name: `${w.name} — signature VFX`,
    kind: "vfx",
    styleRef: ref,
    prompt: vfxPrompt(w),
  };
  if (GROUND.has(kind)) subj.vfxOrientation = "ground";
  subjects.push(subj);
}

writeFileSync(OUT, `${JSON.stringify(subjects, null, 2)}\n`);
const byKind = data.weapons.reduce((m, w) => {
  const k = (w.behavior && w.behavior.kind) || "edge";
  m[k] = (m[k] || 0) + 1;
  return m;
}, {});
console.log(
  `wrote subjects-vfx-300.json — ${subjects.length} VFX subjects` +
    `${missing ? ` (${missing} skipped: no reference art)` : ""} · by move ${JSON.stringify(byKind)}`,
);
