#!/usr/bin/env node
// artkit/guards/slice.mjs — harvest-slice tool (INFRA-6, master spec §28.11).
//
// Cuts a KEYED (transparent-background) sprite into its flat-green-gap-separated
// pieces by connected-component labeling on the alpha mask — NO hand-cutting
// (§26 #2). Serves two callers that share the exact same need:
//   • Characters/enemies (§18, §28.3): body + optional detached head + hands + feet, driven by the
//     procedural rig — the pieces the engine animates independently.
//   • Articulated weapons (§28.11): staff + pendulum cage etc., rigged in-engine.
//
// It does NOT classify weapon parts (those are positional, handled by the rig) —
// for characters it labels parts by geometry: body = largest blob; the top-most
// detached blob above the body is the HEAD; a remaining part below the body's
// lower edge is a FOOT, otherwise a HAND; left/right by centroid x.
// Builds with fewer parts just work (hands-only floaters → no feet; pure blobs →
// body only), because we only emit what we actually find.
//
// Output (under out/<id>/parts/ by default):
//   <role>.png            one tightly-cropped PNG per part (body/head/hand-l/hand-r/foot-l/foot-r…)
//   parts.json            geometry manifest the client rig consumes (see SHAPE below)
//
//   node guards/slice.mjs --id=drifter
//   node guards/slice.mjs --id=drifter --kind=character --alpha=128 --minAreaPct=0.05
//   node guards/slice.mjs --in=out/x-staff-lantern/identity-ref.keyed.png --kind=weapon
//
// parts.json SHAPE:
//   { id, kind, canvas:{w,h}, body:{ cx, cy, w, h },   // body geometry in source px
//     parts:[ { role, file, w, h, cx, cy,               // part size + centroid (source px)
//               ox, oy } ] }                            // centroid offset from body centroid
// The rig scales everything by (targetBodyHeight / body.h) and places each part at
// bodyPos + (ox,oy)*scale, then layers its own procedural drift on top.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const arg = (k, d) => {
  const hit = args.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};

const id = arg("id");
const inArg = arg("in");
const kind = arg("kind", "character"); // "character" | "weapon"
const ALPHA = Number(arg("alpha", "128")); // opaque-pixel threshold
const MIN_AREA_PCT = Number(arg("minAreaPct", "0.05")); // drop specks < this % of canvas
const inputPath = inArg
  ? resolve(ROOT, inArg)
  : id
    ? join(ROOT, "out", id, "identity-ref.keyed.png")
    : null;

if (!inputPath) {
  console.error("Usage: node guards/slice.mjs --id=<subject>  (or --in=<keyed.png>)");
  process.exit(2);
}
if (!existsSync(inputPath)) {
  console.error(
    `No keyed input at ${inputPath}.\n` +
      `Run the chroma-keyer first:  node guards/chroma-key.mjs --only=${id ?? "<id>"}`,
  );
  process.exit(2);
}

const subjectId = id ?? basename(dirname(inputPath));
const outDir = resolve(ROOT, arg("out", join("out", subjectId, "parts")));

const ts = () => new Date().toISOString().slice(11, 19);
const log = (m) => console.log(`[${ts()}] slice ${subjectId}: ${m}`);

/** Flood-fill connected-component labeling (8-connectivity) over the alpha mask.
 *  Iterative (explicit stack) so a ~1.5M-px canvas can't blow the call stack. */
function labelComponents(mask, w, h) {
  const labels = new Int32Array(w * h); // 0 = unlabeled/background
  const comps = [];
  const stack = new Int32Array(w * h); // reused scratch stack of pixel indices
  let next = 0;

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    next++;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = next;
    let area = 0;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    let sumX = 0;
    let sumY = 0;

    while (sp > 0) {
      const p = stack[--sp];
      const px = p % w;
      const py = (p / w) | 0;
      area++;
      sumX += px;
      sumY += py;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;

      for (let dy = -1; dy <= 1; dy++) {
        const ny = py + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = px + dx;
          if (nx < 0 || nx >= w) continue;
          const q = ny * w + nx;
          if (mask[q] && !labels[q]) {
            labels[q] = next;
            stack[sp++] = q;
          }
        }
      }
    }

    comps.push({
      label: next,
      area,
      bbox: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
      cx: sumX / area,
      cy: sumY / area,
    });
  }
  // Return labels too: parts are cropped MASKED to their own component, so a part's bbox
  // can't leak a neighbour's pixels (e.g. hand slivers baked into the body — which the rig
  // would expose the moment it animates the real hands away). Rectangular crops are wrong here.
  return { comps, labels };
}

/** Assign character part roles by geometry relative to the body blob. */
function classify(comps) {
  const sorted = [...comps].sort((a, b) => b.area - a.area);
  const body = sorted[0];
  const bodyBottom = body.bbox.y + body.bbox.h;
  const rest = sorted.slice(1);

  // A separated character head is the top-most substantial island above the
  // largest (body) island. This must happen before the legacy limb classifier:
  // otherwise the newly detached head is indistinguishable from a high hand.
  // Existing baked-head characters have no qualifying island and keep their
  // five-part manifests unchanged.
  const head = rest
    .filter((c) => c.bbox.y < body.bbox.y && c.cy < body.cy)
    .sort((a, b) => a.cy - b.cy || a.bbox.y - b.bbox.y)[0];
  const limbs = head ? rest.filter((c) => c !== head) : rest;

  const hands = [];
  const feet = [];
  for (const c of limbs) {
    // A foot sits below the body's lower edge (boots under the duster); everything
    // else floating beside the body is a hand. Hovering builds simply have no feet.
    if (c.cy > bodyBottom - body.bbox.h * 0.12) feet.push(c);
    else hands.push(c);
  }
  const side = (arr) => arr.sort((a, b) => a.cx - b.cx); // left → right
  side(hands);
  side(feet);

  const named = [{ role: "body", comp: body }];
  if (head) named.push({ role: "head", comp: head });
  const tag = (arr, base) => {
    if (arr.length === 1) named.push({ role: base, comp: arr[0] });
    else if (arr.length === 2) {
      named.push({ role: `${base}-l`, comp: arr[0] }, { role: `${base}-r`, comp: arr[1] });
    } else arr.forEach((c, i) => named.push({ role: `${base}-${i + 1}`, comp: c }));
  };
  tag(hands, "hand");
  tag(feet, "foot");
  return { body, named };
}

async function main() {
  log(`reading ${inputPath.replace(ROOT, ".")}`);
  const img = sharp(inputPath).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;

  // Build opaque-pixel mask from the alpha channel.
  const mask = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += channels, p++) {
    if (data[i + (channels - 1)] >= ALPHA) mask[p] = 1;
  }

  const minArea = (MIN_AREA_PCT / 100) * w * h;
  const { comps: allComps, labels } = labelComponents(mask, w, h);
  const comps = allComps.filter((c) => c.area >= minArea);
  comps.sort((a, b) => b.area - a.area);
  log(`found ${comps.length} part(s) ≥ ${Math.round(minArea)}px (${MIN_AREA_PCT}% of canvas)`);
  if (comps.length === 0) {
    console.error("No parts found — is the input actually keyed (transparent bg)?");
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });

  let layout;
  if (kind === "weapon") {
    // Weapons: emit left→right, no body classification (rig is positional, §28.11).
    const ordered = [...comps].sort((a, b) => a.bbox.x - b.bbox.x);
    layout = { body: ordered[0], named: ordered.map((c, i) => ({ role: `part-${i + 1}`, comp: c })) };
  } else {
    layout = classify(comps);
  }

  const body = layout.body;
  const parts = [];
  for (const { role, comp } of layout.named) {
    const file = `${role}.png`;
    const { x, y, w: pw, h: ph } = comp.bbox;
    // MASKED crop: copy only pixels labelled as THIS component; everything else in the bbox
    // (a neighbour's overlapping pixels) goes transparent. No hand-editing — the mask is the
    // connected-component label the keyer already implied (§26 #2 still satisfied).
    const buf = Buffer.alloc(pw * ph * 4, 0);
    for (let ry = 0; ry < ph; ry++) {
      for (let rx = 0; rx < pw; rx++) {
        const sIdx = (y + ry) * w + (x + rx);
        if (labels[sIdx] !== comp.label) continue;
        const s = sIdx * channels;
        const d = (ry * pw + rx) * 4;
        buf[d] = data[s];
        buf[d + 1] = data[s + 1];
        buf[d + 2] = data[s + 2];
        buf[d + 3] = channels >= 4 ? data[s + 3] : 255;
      }
    }
    await sharp(buf, { raw: { width: pw, height: ph, channels: 4 } }).png().toFile(join(outDir, file));
    parts.push({
      role,
      file,
      w: pw,
      h: ph,
      cx: Math.round(comp.cx),
      cy: Math.round(comp.cy),
      ox: Math.round(comp.cx - body.cx),
      oy: Math.round(comp.cy - body.cy),
    });
    log(`  ${role.padEnd(7)} ${pw}x${ph} @ (${Math.round(comp.cx)},${Math.round(comp.cy)})`);
  }

  const manifest = {
    id: subjectId,
    kind,
    canvas: { w, h },
    body: { cx: Math.round(body.cx), cy: Math.round(body.cy), w: body.bbox.w, h: body.bbox.h },
    parts,
  };
  writeFileSync(join(outDir, "parts.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  log(`wrote ${parts.length} part PNG(s) + parts.json → ${outDir.replace(ROOT, ".")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
