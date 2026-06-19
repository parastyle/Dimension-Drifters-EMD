#!/usr/bin/env node
// artkit/pack-atlas.mjs — pack the installed per-part sprite PNGs into a Phaser MULTIATLAS so the client
// loads ONE atlas (a few texture binds → far fewer WebGL draw-call flushes) instead of ~400 individual
// images at boot. Reads the client sprite manifest, packs every NON-expansion subject's parts, and writes
// packages/client/public/sprites/dd-sprites.json (+ page PNGs). Frame names are "<id>/<role>" — SpriteRig
// references those. Expansion weapons (id starts with "x2-") stay per-part (they're gated/not boot-loaded).
//
//   node tools/artkit/pack-atlas.mjs        # run AFTER harvest-install changes the manifest/parts
import ftp from "free-tex-packer-core";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const { packAsync } = ftp;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const REPO = resolve(ROOT, "..", "..");
const SPRITES_DIR = join(REPO, "packages", "client", "public", "sprites");
const MANIFEST = join(REPO, "packages", "client", "src", "sprites", "manifest.ts");
const ATLAS_NAME = "dd-sprites";

/** Is this subject held out of the boot atlas? The §13 +300 expansion weapons (id `x2-…`) are gated — not
 *  boot-loaded — so they stay per-part and out of the atlas. */
const isExpansion = (id) => id.startsWith("x2-");

// Parse the generated SPRITES object out of manifest.ts (unquoted keys + trailing commas → JSON).
const txt = readFileSync(MANIFEST, "utf8");
const mm = txt.match(/export const SPRITES\s*=\s*(\{[\s\S]*\})\s*as const satisfies/);
if (!mm) throw new Error("could not find SPRITES in manifest.ts");
const SPRITES = JSON.parse(
  mm[1].replace(/([{,]\s*)([A-Za-z_][\w-]*)\s*:/g, '$1"$2":').replace(/,(\s*[}\]])/g, "$1"),
);

const images = [];
let subjects = 0;
for (const [id, man] of Object.entries(SPRITES)) {
  if (isExpansion(id)) continue;
  let any = false;
  for (const part of man.parts) {
    const p = join(SPRITES_DIR, id, part.file);
    if (!existsSync(p)) continue;
    // Frame key = "<id>/<role>" (removeFileExtension strips the .png we add for the packer).
    images.push({ path: `${id}/${part.role}.png`, contents: readFileSync(p) });
    any = true;
  }
  if (any) subjects++;
}
if (!images.length) throw new Error("no part PNGs found to pack — run harvest-install first");

const result = await packAsync(images, {
  textureName: ATLAS_NAME,
  width: 4096,
  height: 4096,
  padding: 2,
  extrude: 0,
  allowRotation: false, // keep frames axis-aligned so SpriteRig geometry is identical to the loose PNGs
  allowTrim: false, // the slicer already tight-crops; no-trim keeps frame size == manifest part w/h
  detectIdentical: true,
  removeFileExtension: true,
  prependFolderName: true, // KEEP the "<id>/" folder in the frame name → "<id>/<role>" (unique per part)
  exporter: "Phaser3", // emits Phaser's multipack atlas JSON (load.multiatlas)
});

// Clear any prior atlas pages/json so a shrink doesn't leave orphans, then write the fresh set.
for (const f of readdirSync(SPRITES_DIR)) {
  if (/^dd-sprites(-\d+)?\.(png|json)$/.test(f)) rmSync(join(SPRITES_DIR, f), { force: true });
}
for (const f of result) writeFileSync(join(SPRITES_DIR, f.name), f.buffer);

const pages = result.filter((f) => /\.png$/.test(f.name));
const jsonFile = result.find((f) => /\.json$/.test(f.name));
console.log(
  `packed ${images.length} frames from ${subjects} subjects → ${pages.length} page(s) [${pages
    .map((p) => p.name)
    .join(", ")}] + ${jsonFile?.name} in public/sprites/`,
);
