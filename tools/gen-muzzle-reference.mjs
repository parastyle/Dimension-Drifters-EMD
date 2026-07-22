import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const PUBLIC = path.join(ROOT, "packages/client/public");
const TABLE = path.join(PUBLIC, "muzzle-reference/sweep.json");
const OUTPUT = path.join(PUBLIC, "muzzle-reference.html");
const table = JSON.parse(await readFile(TABLE, "utf8"));

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function artPartsFor(weapon) {
  if (weapon.artParts?.length) return weapon.artParts;
  if (!weapon.artPoint) return [];
  return [
    {
      part: weapon.artPoint.part ?? 0,
      partFile: weapon.partFile,
      width: weapon.artPoint.width,
      height: weapon.artPoint.height,
      points: [weapon.artPoint],
    },
  ];
}

const cards = table.weapons
  .map((weapon) => {
    const stationary = weapon.cases.find((entry) => entry.mode === "stationary");
    const live = stationary?.screenshot ? escapeHtml(stationary.screenshot) : "";
    const artParts = artPartsFor(weapon);
    const pointCount = artParts.reduce((count, part) => count + part.points.length, 0);
    const art = artParts
      .map((part) => {
        const sprite = `sprites/${encodeURIComponent(weapon.spriteId)}/${escapeHtml(part.partFile)}`;
        const markers = part.points
          .map((point) => {
            const override = point.overrideReason
              ? `; override: ${escapeHtml(point.overrideReason)}`
              : "";
            return `<i class="muzzle" style="left:${(point.normalizedX * 100).toFixed(4)}%;top:${(point.normalizedY * 100).toFixed(4)}%" title="art (${point.x.toFixed(2)}, ${point.y.toFixed(2)})${override}"></i>`;
          })
          .join("");
        return `<div class="art-part"><small>part ${part.part + 1}</small><div class="asset" style="aspect-ratio:${part.width}/${part.height}"><img loading="lazy" src="${sprite}" alt="${escapeHtml(weapon.name)} sprite part ${part.part + 1}">${markers || '<span class="missing">no art point</span>'}</div></div>`;
      })
      .join("");
    const status = weapon.passed ? "pass" : "fail";
    return `<figure class="${status}" data-kind="${weapon.deliveryKind}" data-status="${status}">
      <figcaption><strong>${escapeHtml(weapon.name)}</strong><code>${escapeHtml(weapon.weaponId)}</code><span>${weapon.deliveryKind} &middot; ${escapeHtml(weapon.family)} &middot; max &Delta; ${weapon.maxDeltaPx.toFixed(2)}px</span></figcaption>
      <div class="pair">
        <div class="panel art"><b>authored sprite muzzle point${pointCount === 1 ? "" : "s"}</b><div class="assets">${art || '<span class="missing">no art point</span>'}</div></div>
        <div class="panel live"><b>first stationary shot</b>${live ? `<img loading="lazy" src="${live}" alt="${escapeHtml(weapon.name)} live first shot">` : '<span class="missing">capture unavailable</span>'}</div>
      </div>
    </figure>`;
  })
  .join("\n");
const excluded = table.summary.excludedNonMuzzleRows ?? [];
const exclusionNote = excluded.length
  ? ` &middot; ${excluded.length} non-muzzle dispatch excluded (${excluded.map((row) => escapeHtml(row.weaponId)).join(", ")})`
  : "";

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dimension Drifters Muzzle Reference</title>
<style>
  :root{color-scheme:dark;--bg:#121019;--card:#1b1823;--line:#393145;--ink:#eee7da;--muted:#a49bab;--cyan:#31d7ff;--green:#6dff90;--red:#ff5570}
  *{box-sizing:border-box}body{margin:0;padding:22px;background:var(--bg);color:var(--ink);font:14px/1.4 system-ui,sans-serif}
  header{position:sticky;top:0;z-index:5;margin:-22px -22px 20px;padding:16px 22px;background:#121019ef;border-bottom:1px solid var(--line);backdrop-filter:blur(8px)}
  h1{margin:0 0 4px;font-size:22px}header p{margin:0;color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(560px,1fr));gap:12px}
  figure{margin:0;padding:10px;background:var(--card);border:1px solid var(--line);border-left:4px solid var(--green);border-radius:8px}figure.fail{border-left-color:var(--red)}
  figcaption{display:grid;grid-template-columns:1fr auto;gap:2px 12px;margin-bottom:8px}figcaption strong{font-size:15px}figcaption code{color:#d8b883}figcaption span{grid-column:1/-1;color:var(--muted);font-size:12px}
  .pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}.panel{min-width:0;height:210px;padding:7px;background:#0f0d14;border:1px solid #302939;border-radius:5px;overflow:hidden;position:relative}.panel>b{display:block;margin-bottom:4px;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em}
  .assets{height:174px;display:flex;align-items:center;justify-content:center;gap:8px}.art-part{flex:1;min-width:0;max-width:100%;text-align:center}.art-part small{display:block;color:var(--muted);font-size:10px}.asset{position:relative;width:100%;max-width:270px;max-height:158px;margin:auto}.asset img{display:block;width:100%;height:100%;object-fit:contain}.muzzle{position:absolute;width:15px;height:15px;border:3px solid var(--cyan);border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 0 0 2px #08151a,0 0 12px var(--cyan)}
  .live img{width:100%;height:174px;object-fit:contain;background:#09080c}.missing{display:grid;place-items:center;height:160px;color:var(--red)}
  @media(max-width:650px){body{padding:12px}.grid{grid-template-columns:1fr}.pair{grid-template-columns:1fr}.panel{height:auto}header{margin:-12px -12px 14px}.live img{height:auto}}
</style></head><body>
<header><h1>Dimension Drifters &middot; Muzzle Reference</h1><p>${table.summary.catalogCount} live gun/beam deliveries &middot; ${table.summary.passedWeapons} passing &middot; tolerance ${table.summary.tolerancePx}px${exclusionNote} &middot; captured ${escapeHtml(table.summary.capturedAt)}</p></header>
<main class="grid">${cards}</main></body></html>`;

await writeFile(OUTPUT, html);
console.log(`muzzle-reference.html written: ${table.weapons.length} weapons`);
