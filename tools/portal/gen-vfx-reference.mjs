// VFX / projectile reference sheet — every image asset with its exact id, for owner notes.
// Regenerate: node tools/portal/gen-vfx-reference.mjs  ->  tools/portal/vfx-reference.html
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PUB = path.join(ROOT, "packages/client/public");

const SECTIONS = [
  { title: "Projectiles (bespoke, generated)", dir: "projectiles", note: "Say: 'use projectile <name>'" },
  { title: "Composite VFX packs", dir: "vfx/packs", note: "Say: 'use pack <name>'" },
  { title: "Particle images (element-shape)", dir: "particles", note: "Say: 'use particle <name>'" },
  { title: "Impacts", dir: "vfx/impacts", note: "Say: 'use impact <name>'" },
  { title: "Caster art", dir: "vfx/caster", note: "Say: 'use caster art <name>'" },
];

function usedBy(name) {
  try {
    const out = execSync(
      `grep -rl --include=*.ts "${name}" "${path.join(ROOT, "packages/client/src")}"`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return out.split("\n").filter(Boolean).map((f) => path.basename(f, ".ts"));
  } catch {
    return [];
  }
}

let body = "";
let total = 0;
for (const section of SECTIONS) {
  const dir = path.join(PUB, section.dir);
  if (!existsSync(dir)) continue;
  const files = readdirSync(dir).filter((f) => f.endsWith(".png") || f.endsWith(".jpg"));
  if (files.length === 0) continue;
  total += files.length;
  const cards = files
    .map((f) => {
      const name = f.replace(/\.(png|jpg)$/, "");
      const consumers = usedBy(name);
      const badge = consumers.length
        ? `<span class="used" title="${consumers.join(", ")}">in use · ${consumers.length}</span>`
        : `<span class="free">unused</span>`;
      return `<figure><div class="thumb"><img loading="lazy" src="${section.dir}/${f}" alt="${name}"></div><figcaption><code>${name}</code>${badge}</figcaption></figure>`;
    })
    .join("");
  body += `<section><h2>${section.title} <small>${files.length} — ${section.note}</small></h2><div class="grid">${cards}</div></section>`;
}

const html = `<!doctype html><meta charset="utf-8"><title>DD VFX Reference — ${total} assets</title>
<style>
  body{font:14px system-ui;background:#141219;color:#eae3d3;margin:0;padding:24px}
  h1{font-size:22px}h2{font-size:16px;margin:28px 0 10px;border-bottom:1px solid #322c3d;padding-bottom:6px}
  h2 small{color:#98917f;font-weight:400}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
  figure{margin:0;background:#1c1922;border:1px solid #322c3d;border-radius:8px;padding:8px}
  .thumb{height:80px;display:flex;align-items:center;justify-content:center;background:
    repeating-conic-gradient(#26222e 0 25%,#1c1922 0 50%) 0 0/16px 16px;border-radius:4px}
  img{max-width:100%;max-height:76px}
  figcaption{padding-top:6px;font-size:11px;display:flex;flex-direction:column;gap:2px}
  code{color:#d9b98c;word-break:break-all}
  .used{color:#7fb069}.free{color:#c75d5d;font-weight:600}
</style>
<h1>Dimension Drifters — VFX & Projectile Reference (${total} assets)</h1>
<p>Reference these exact names in your G/T notes — e.g. <code>"use particle arcane-shard for the projectile"</code>.
Green = wired into at least one recipe (hover for where). Red = currently unused.</p>
${body}`;

// Served by the game's dev server so image paths resolve: http://localhost:5180/vfx-reference.html
writeFileSync(path.join(PUB, "vfx-reference.html"), html);
console.log(`vfx-reference.html written to client public: ${total} assets`);
