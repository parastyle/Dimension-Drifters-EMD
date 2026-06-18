#!/usr/bin/env node
// artkit/gen-dimension-subjects.mjs — transform the designed dimension content (data/dimensions-design.json
// + data/dimension-shifters.json) into an artkit SUBJECTS manifest for the Codex render pipeline. Emits one
// subject per new enemy / tough / boss / shifter (27 total), each carrying its design artPrompt + palette +
// the universal Drifter style-anchor (out/drifter/identity-ref.png) so construction stays on-model. Run:
//   node tools/artkit/gen-dimension-subjects.mjs
//   SUBJECTS=subjects-dimensions.json node tools/artkit/orchestrate.mjs --promote=1
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const REPO = resolve(ROOT, "..", "..");
const DIMS = JSON.parse(readFileSync(join(REPO, "data", "dimensions-design.json"), "utf8"));
const SHIFTERS = JSON.parse(readFileSync(join(REPO, "data", "dimension-shifters.json"), "utf8"));
const OUT = join(ROOT, "subjects-dimensions.json");
const STYLE_REF = "out/drifter/identity-ref.png"; // the universal limbless-construction style anchor

const subjects = [];

function pushSubject(s, dimId, tier, extraTags, cardartAction) {
  const subj = {
    id: s.id,
    name: s.name,
    tier,
    dimension: dimId,
    styleRef: STYLE_REF,
    prompt: s.artPrompt,
    palette: { primary: s.palettePrimary, accent: s.paletteAccent },
    tags: ["enemy", ...extraTags, dimId],
  };
  if (cardartAction) subj.cardartAction = cardartAction;
  subjects.push(subj);
}

for (const d of DIMS.dimensions) {
  for (const e of d.enemies) pushSubject(e, d.id, "low", [e.archetype]);
  pushSubject(d.tough, d.id, "medium", ["tough", d.tough.archetype]);
  pushSubject(
    d.boss,
    d.id,
    "high",
    ["boss", "unique"],
    d.boss.cardartAction ??
      `mid-rampage — ${d.boss.name} unleashing its signature attack, themed VFX erupting around its planted stance`,
  );
}

// Shifters are global (not bound to a dimension) — tag them by their own id; they're elite, so card art too.
for (const s of SHIFTERS.shifters) {
  pushSubject(
    s,
    "shifter",
    "high",
    ["shifter", s.archetype],
    `mid-incursion — ${s.name} phasing in, rift-light imploding around it as it raises ${s.wieldsWeapon ? "its weapon" : "to strike"}`,
  );
}

writeFileSync(OUT, `${JSON.stringify(subjects, null, 2)}\n`);
const byTier = subjects.reduce((m, s) => ((m[s.tier] = (m[s.tier] || 0) + 1), m), {});
console.log(
  `wrote subjects-dimensions.json — ${subjects.length} subjects (low ${byTier.low || 0} / medium ${byTier.medium || 0} / high ${byTier.high || 0})`,
);
