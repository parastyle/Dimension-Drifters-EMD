#!/usr/bin/env node
// W4R/V5A reference-guided projectile art. Codex generates new ammunition silhouettes from the
// installed weapon sprites; this pipeline intentionally never crops source weapon art. The only
// edit exception is Brimstone's already-shipped missile: its existing projectile crop is flattened
// and trimmed to the warhead. Failed renders never replace an installed survivor.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";
import { emit, isCheck } from "./lib/emit.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const out = resolve(here, "out/w4r-projectiles");
const installed = resolve(repo, "packages/client/public/projectiles");
const manifestPath = resolve(repo, "packages/client/src/sprites/projectile-manifest.ts");
mkdirSync(out, { recursive: true });
mkdirSync(installed, { recursive: true });
configureCodex({ perChatRoot: resolve(here, ".artkit-codex-homes"), log: console.log });

const commonPrompt = `Style/medium: the game's chunky flat-cel painted sprite style, 4-6 colors, thick slightly uneven charcoal outline, minimal interior detail.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background with no floor, shadow, gradient, texture, reflection, or lighting variation.
Constraints: one loose projectile only, fully separated from the background with crisp edges and generous padding; no weapon, hands, character, duplicated ammunition, text, watermark, shadow, mist, or glow; do not use #00ff00 in the subject.
Pipeline contract: generate the image only; do not copy, install, crop, trace, or edit any repository file because the artkit harvester owns installation.
Avoid: copying, cropping, or tracing pixels from Image 1; photorealism; perspective; background texture.`;

const jobs = [
  {
    id: "barrett-50cal-round",
    weaponId: "x2-barrett-50-cal-sniper",
    reference: resolve(
      repo,
      "packages/client/public/sprites/x2-barrett-50-cal-sniper/part-1.png",
    ),
    maxWidth: 176,
    maxHeight: 88,
    minAspect: 2.2,
    maxAspect: 5.5,
    prompt: `Use case: stylized-concept
Asset type: Dimension Drifters in-flight .50-cal projectile VFX sprite
Primary request: Generate one brand-new oversized .50-caliber anti-materiel round inspired by Image 1; the rifle is only a style and material reference and must never be cropped.
Input images: Image 1 is a style, palette, material, and caliber-weight reference only; it is not an edit target and no pixels should be copied or cropped.
Subject: one complete heavy .50-cal cartridge with a long blunt copper-jacketed projectile, short thick muted-brass case silhouette, dark steel extraction rim, and one rust-red identification band; physical ammunition, not an orb.
Composition/framing: flat orthographic full side-profile, perfectly horizontal, projectile nose points RIGHT, entire round visible with generous padding.
${commonPrompt}`,
  },
  {
    id: "m50-50cal-round",
    weaponId: "x2-m50-anti-materiel-rifle",
    reference: resolve(
      repo,
      "packages/client/public/sprites/x2-m50-anti-materiel-rifle/part-1.png",
    ),
    maxWidth: 176,
    maxHeight: 88,
    minAspect: 2.2,
    maxAspect: 5.5,
    prompt: `Use case: stylized-concept
Asset type: Dimension Drifters in-flight .50-cal projectile VFX sprite
Primary request: Generate one brand-new plain modern-military .50-caliber anti-materiel round inspired by Image 1; the rifle is only a style and material reference and must never be cropped.
Input images: Image 1 is a style, palette, material, and caliber-weight reference only; it is not an edit target and no pixels should be copied or cropped.
Subject: one complete heavy .50-cal cartridge with a long dark copper-jacketed projectile, short thick muted-brass case silhouette, blackened steel extraction rim, and no decorative markings; physical ammunition, not an orb.
Composition/framing: flat orthographic full side-profile, perfectly horizontal, projectile nose points RIGHT, entire round visible with generous padding.
${commonPrompt}`,
  },
  {
    id: "coyotes-grin-throwing-blade",
    weaponId: "x2-coyote-s-grin",
    reference: resolve(repo, "packages/client/public/sprites/x2-coyote-s-grin/part-5.png"),
    maxWidth: 176,
    maxHeight: 88,
    minAspect: 2,
    maxAspect: 5.5,
    prompt: `Use case: stylized-concept
Asset type: Dimension Drifters in-flight thrown-weapon projectile sprite
Primary request: Generate one brand-new single Coyote's Grin throwing blade inspired by Image 1; the existing paired weapon art is only a visual reference and must never be cropped, detached, traced, or copied.
Input images: Image 1 is a style, palette, material, and blade-language reference only; it is not an edit target and no pixels should be copied or cropped.
Subject: one complete original western-gothic throwing knife with a compact brass sun-disc pommel, dark crisscross-wrapped grip, asymmetrical gunmetal guard, and a broad slightly hooked chipped steel blade. It must be exactly ONE knife, not twins, a sheet, a panel, or a contact sheet.
Composition/framing: flat orthographic full side-profile, perfectly horizontal, blade tip points RIGHT, entire knife visible with generous padding.
${commonPrompt}`,
  },
  {
    id: "widowmaker-arbalest-arrow",
    weaponId: "x2-widowmaker-arbalest",
    reference: resolve(repo, "packages/client/public/sprites/x2-widowmaker-arbalest/part-1.png"),
    maxWidth: 256,
    maxHeight: 112,
    minAspect: 2.2,
    maxAspect: 8,
    prompt: `Use case: stylized-concept
Asset type: Dimension Drifters in-flight projectile sprite
Primary request: Generate the picture of an arrow; do not crop from the weapon art. Create one brand-new massive siege-crossbow arrow inspired by Image 1.
Input images: Image 1 is a style, palette, material, and engineering reference only; it is not an edit target and no pixels should be copied or cropped.
Subject: one complete heavy iron arbalest arrow with a broad faceted steel point, thick dark shaft, compact pale fletching, and small brass engineering accents matching the reference weapon.
Composition/framing: flat orthographic full side-profile, perfectly horizontal, arrowhead points RIGHT, entire arrow visible with generous padding.
${commonPrompt}`,
  },
  {
    id: "tidehook-bombarpoon-harpoon",
    weaponId: "x2-tidehook-bombarpoon",
    reference: resolve(repo, "packages/client/public/sprites/x2-tidehook-bombarpoon/part-1.png"),
    maxWidth: 256,
    maxHeight: 112,
    minAspect: 2.2,
    maxAspect: 8,
    prompt: `Use case: stylized-concept
Asset type: Dimension Drifters in-flight projectile sprite
Primary request: Generate one new loose bomb-harpoon ammunition projectile matching the Tidehook Bombarpoon in Image 1; use the weapon as reference, never as a crop source.
Input images: Image 1 is a style, palette, material, and ammunition-design reference only; it is not an edit target and no pixels should be copied or cropped.
Subject: one complete white-steel harpoon with a large triangular barbed point, compact bulbous depth-charge collar behind the head, short reinforced shaft, dull-teal bands, and tiny solid cyan frost accents.
Composition/framing: flat orthographic full side-profile, perfectly horizontal, harpoon tip points RIGHT, entire projectile visible with generous padding.
${commonPrompt}`,
  },
  {
    id: "saintskull-monstrance-holy-skull",
    weaponId: "x2-saintskull-monstrance",
    reference: resolve(repo, "packages/client/public/sprites/x2-saintskull-monstrance/part-1.png"),
    maxWidth: 160,
    maxHeight: 160,
    minAspect: 0.72,
    maxAspect: 1.38,
    prompt: `Use case: stylized-concept
Asset type: Dimension Drifters in-flight projectile sprite
Primary request: Generate one brand-new holy saint-skull projectile inspired by the skull in Image 1; do not crop or detach the skull from the weapon.
Input images: Image 1 is a style, palette, bone-material, and sacred-ornament reference only; it is not an edit target and no pixels should be copied or cropped.
Subject: one complete ivory saint skull facing RIGHT in a readable three-quarter side profile, jaw slightly open as if flying forward, with a compact gold halo ring and three tiny gold ray accents; solid painted shapes, no glow.
Composition/framing: centered near-square sprite, skull fills most of the frame, entire skull and halo visible with even padding.
${commonPrompt}`,
  },
  {
    id: "quill-storm-repeater-arrow",
    weaponId: "x2-quill-storm-repeater",
    reference: resolve(repo, "packages/client/public/sprites/x2-quill-storm-repeater/part-1.png"),
    maxWidth: 192,
    maxHeight: 80,
    minAspect: 2.4,
    maxAspect: 8,
    prompt: `Use case: stylized-concept
Asset type: Dimension Drifters in-flight projectile sprite
Primary request: Generate one brand-new rapid-repeater arrow inspired by Image 1; the weapon is only a visual reference and must never be cropped.
Input images: Image 1 is a style, palette, material, and ammunition-design reference only; it is not an edit target and no pixels should be copied or cropped.
Subject: one complete short quill-like crossbow arrow with a small pale steel point, stout dark shaft, compact bone fletching, and one worn olive band; optimized for a repeating magazine, not a long siege bolt.
Composition/framing: flat orthographic full side-profile, perfectly horizontal, arrowhead points RIGHT, entire arrow visible with generous padding.
${commonPrompt}`,
  },
  {
    id: "mesa-hand-cannon-50cal",
    weaponId: "x2-mesa-hand-cannon",
    reference: resolve(repo, "packages/client/public/sprites/x2-mesa-hand-cannon/part-1.png"),
    maxWidth: 144,
    maxHeight: 80,
    minAspect: 1.7,
    maxAspect: 4.5,
    prompt: `Use case: stylized-concept
Asset type: Dimension Drifters in-flight projectile sprite
Primary request: Generate one brand-new oversized .50-caliber hand-cannon round inspired by Image 1; use the revolver as a palette and material reference, never as a crop source.
Input images: Image 1 is a style, palette, material, and caliber-weight reference only; it is not an edit target and no pixels should be copied or cropped.
Subject: one complete huge .50-caliber cartridge with a blunt copper-jacketed projectile, short heavy brass case, dark steel extraction rim, and one small rust-red band; unmistakably heavy ammunition.
Composition/framing: flat orthographic full side-profile, perfectly horizontal, bullet points RIGHT, entire round visible with generous padding.
${commonPrompt}`,
  },
  {
    id: "hand-mortar-shell",
    weaponId: "x-gun-hand-mortar",
    reference: resolve(repo, "packages/client/public/sprites/x-gun-hand-mortar/part-1.png"),
    maxWidth: 144,
    maxHeight: 96,
    minAspect: 1.35,
    maxAspect: 3.5,
    prompt: `Use case: stylized-concept
Asset type: Dimension Drifters in-flight projectile sprite
Primary request: Generate one brand-new real mortar shell inspired by the Hand Mortar in Image 1; replace a generic VFX blob with physical ammunition and never crop the weapon.
Input images: Image 1 is a style, palette, brass-material, and engineering reference only; it is not an edit target and no pixels should be copied or cropped.
Subject: one complete squat hand-mortar shell with a rounded dark iron nose, fat riveted brass explosive body, narrow black driving band, and compact tail plug; a physical shell, not fire, smoke, or an energy orb.
Composition/framing: flat orthographic full side-profile, perfectly horizontal, shell nose points RIGHT, entire shell visible with generous padding.
${commonPrompt}`,
  },
  {
    id: "ghostbolt-crossbow-arrow",
    weaponId: "x2-ghostbolt-crossbow",
    reference: resolve(repo, "packages/client/public/sprites/x2-ghostbolt-crossbow/part-1.png"),
    maxWidth: 224,
    maxHeight: 96,
    minAspect: 2.3,
    maxAspect: 8,
    prompt: `Use case: stylized-concept
Asset type: Dimension Drifters in-flight projectile sprite
Primary request: Generate one brand-new full ghostbolt arrow inspired by Image 1; the crossbow is only a visual reference and must never be cropped.
Input images: Image 1 is a style, palette, material, and occult-ammunition reference only; it is not an edit target and no pixels should be copied or cropped.
Subject: one complete long void-crossbow arrow with a pale bone spear point, black obsidian shaft, compact dark fletching, and two small solid arc-violet rune bands; physical readable silhouette with no smoke or glow.
Composition/framing: flat orthographic full side-profile, perfectly horizontal, arrowhead points RIGHT, entire arrow visible with generous padding.
${commonPrompt}`,
  },
  {
    id: "leviathan-harpoon-gun-harpoon",
    weaponId: "x2-leviathan-harpoon-gun",
    reference: resolve(repo, "packages/client/public/sprites/x2-leviathan-harpoon-gun/part-1.png"),
    maxWidth: 256,
    maxHeight: 112,
    minAspect: 2.2,
    maxAspect: 8,
    prompt: `Use case: stylized-concept
Asset type: Dimension Drifters in-flight projectile sprite
Primary request: Generate one brand-new loose Leviathan harpoon inspired by Image 1; do not crop, detach, or trace the loaded harpoon from the gun.
Input images: Image 1 is a style, palette, material, and harpoon-engineering reference only; it is not an edit target and no pixels should be copied or cropped.
Subject: one complete brutal salt-crusted iron harpoon with a large forked triangular head, two wicked rear-facing barbs, long dark shaft, dull-teal binding collar, and a small tether eye at the tail; no cable attached.
Composition/framing: flat orthographic full side-profile, perfectly horizontal, harpoon tip points RIGHT, entire projectile visible with generous padding.
${commonPrompt}`,
  },
  {
    id: "hexbore-voidmaw-rune",
    weaponId: "x2-hexbore-voidmaw",
    reference: resolve(repo, "packages/client/public/sprites/x2-hexbore-voidmaw/part-1.png"),
    maxWidth: 128,
    maxHeight: 112,
    minAspect: 0.7,
    maxAspect: 1.65,
    prompt: `Use case: stylized-concept
Asset type: Dimension Drifters in-flight projectile sprite
Primary request: Generate one brand-new solid void-rune projectile inspired by the carved runes in Image 1; never crop, detach, trace, or copy a rune from the barrel.
Input images: Image 1 is a style, palette, material, and runic-language reference only; it is not an edit target and no pixels should be copied or cropped.
Subject: one original angular arc-violet rune shaped like a compact pointed hex-seal, with a near-black obsidian center, thick purple facets, and a charcoal outline; solid readable ammunition, not a cloud or glow.
Composition/framing: centered near-square emblem in flat orthographic view, forward point faces RIGHT, entire rune visible with even padding.
${commonPrompt}`,
  },
  {
    id: "calamity-howitzer-battleship-shell",
    weaponId: "x2-calamity-howitzer",
    reference: resolve(repo, "packages/client/public/sprites/x2-calamity-howitzer/part-1.png"),
    maxWidth: 240,
    maxHeight: 112,
    minAspect: 1.8,
    maxAspect: 5,
    prompt: `Use case: stylized-concept
Asset type: Dimension Drifters in-flight projectile sprite
Primary request: Generate one brand-new enormous battleship artillery shell inspired by the Calamity Howitzer in Image 1; use the cannon as a palette and engineering reference, never as a crop source.
Input images: Image 1 is a style, palette, material, and caliber-weight reference only; it is not an edit target and no pixels should be copied or cropped.
Subject: one complete colossal naval shell with a blunt faceted gunmetal nose, fat brass explosive casing, two dark steel driving bands, a heavy extraction base, and a tiny hazard-red marking; it must read much larger and heavier than ordinary ammunition.
Composition/framing: flat orthographic full side-profile, perfectly horizontal, shell nose points RIGHT, entire shell visible with generous padding.
${commonPrompt}`,
  },
];

/** Accepted projectiles supplied by later owner-note art runs. This generator owns their runtime
 * manifest registration too, so generated output is never hand-edited when a supplier uses a
 * versioned subdirectory. */
const supplementalAssets = [
  ["brimstone-flaming-cross", "x2-brimstone-gallows-rifle", "projectiles/v7/brimstone-flaming-cross.png"],
  ["exploding-present-variant-1", "x2-exploding-present-lobber", "sprites/vfx-present-variants/part-1.png"],
  ["exploding-present-variant-2", "x2-exploding-present-lobber", "sprites/vfx-present-variants/part-2.png"],
  ["exploding-present-variant-3", "x2-exploding-present-lobber", "sprites/vfx-present-variants/part-3.png"],
  ["exploding-present-variant-4", "x2-exploding-present-lobber", "sprites/vfx-present-variants/part-4.png"],
  ["exploding-present-variant-5", "x2-exploding-present-lobber", "sprites/vfx-present-variants/part-5.png"],
  ["frostfang-pictured-harpoon", "x2-frostfang-speargun", "projectiles/v7/frostfang-pictured-harpoon.png"],
  ["galvanic-coachgun-electric-slug", "x2-galvanic-coachgun", "projectiles/v7/galvanic-coachgun-electric-slug.png"],
  ["hailbarrel-sledcaster-ice-puck", "x2-hailbarrel-sledcaster", "projectiles/hailbarrel-sledcaster-ice-puck.png"],
  ["ironhide-anti-tank-shell", "x2-ironhide-buffalo-gun", "projectiles/v7/ironhide-anti-tank-shell.png"],
  ["plaguespitter-green-shot", "x2-plaguespitter-flak-gun", "projectiles/v7/plaguespitter-green-shot.png"],
  ["ricochet-icicle", "x-gun-ricochet-pistol", "projectiles/v7/ricochet-icicle.png"],
  ["streetsweeper-grenade-explosion", "x2-quicksilver-streetsweeper", "sprites/vfx-streetsweeper-grenade/part-2.png"],
  ["streetsweeper-grenade-shell", "x2-quicksilver-streetsweeper", "sprites/vfx-streetsweeper-grenade/part-1.png"],
  ["tesla-drumbore-electric-particle", "x2-tesla-drumbore", "projectiles/v7/tesla-drumbore-electric-particle.png"],
  ["tesla-faradayer-hand-drawn-bolt", "x2-tesla-faradayer", "projectiles/v7/tesla-faradayer-hand-drawn-bolt.png"],
  ["thornhive-drill-seed", "x2-thornhive-seedcaster", "projectiles/b66/thornhive-drill-seed.png", { width: 176, height: 96 }],
  ["thunderhead-blue-helix", "x2-thunderhead-lever-gun", "projectiles/v8/thunderhead-blue-helix.png", { width: 160, height: 80 }],
  ["thunderhead-smoke-ring", "x2-thunderhead-repeater-cannon", "projectiles/v8/thunderhead-smoke-ring.png", { width: 112, height: 112 }],
].map(([id, weaponId, url, normalize]) => ({ id, weaponId, url, normalize }));

/** Directional side-profile art with a meaningful authored top. These sprites face left by mirroring
 * horizontally and retain at most a quarter-turn of flight tilt; they must never be spun through pi. */
const mirrorUprightProjectileIds = new Set([
  "barrett-50cal-round",
  "brimstone-flaming-cross",
  "brimstone-rocket-warhead",
  "calamity-howitzer-battleship-shell",
  "frostfang-pictured-harpoon",
  "galvanic-coachgun-electric-slug",
  "ghostbolt-crossbow-arrow",
  "hailbarrel-sledcaster-ice-puck",
  "hand-mortar-shell",
  "hexbore-voidmaw-rune",
  "ironhide-anti-tank-shell",
  "leviathan-harpoon-gun-harpoon",
  "m50-50cal-round",
  "mesa-hand-cannon-50cal",
  "plaguespitter-green-shot",
  "quill-storm-repeater-arrow",
  "ricochet-icicle",
  "saintskull-monstrance-holy-skull",
  "streetsweeper-grenade-shell",
  "tesla-drumbore-electric-particle",
  "tesla-faradayer-hand-drawn-bolt",
  "thornhive-drill-seed",
  "thunderhead-blue-helix",
  "tidehook-bombarpoon-harpoon",
  "widowmaker-arbalest-arrow",
]);

const options = { only: undefined, force: false, manifestOnly: false, maxAttempts: 3 };
for (const arg of process.argv.slice(2)) {
  if (arg === "--force") options.force = true;
  else if (arg === "--manifest-only") options.manifestOnly = true;
  else if (arg === "--check") continue;
  else if (arg.startsWith("--only=")) options.only = arg.slice(7);
  else if (arg.startsWith("--max-attempts=")) options.maxAttempts = Number(arg.slice(15));
  else if (arg === "--help" || arg === "-h") {
    console.log("Usage: node tools/artkit/gen-w4r-projectiles.mjs [--only=<asset-id>] [--force] [--manifest-only] [--max-attempts=1..3]");
    process.exit(0);
  } else throw new Error(`Unknown argument: ${arg}`);
}
if (!Number.isInteger(options.maxAttempts) || options.maxAttempts < 1 || options.maxAttempts > 3)
  throw new Error("--max-attempts must be an integer from 1 to 3");
if (isCheck && !options.manifestOnly)
  throw new Error("--check is only supported with --manifest-only");

function disallowedRenderLog(path) {
  if (!existsSync(path)) return false;
  return /moderation_blocked|image generation failed|System\.Drawing\.Bitmap|PIL unavailable|raster script failed/i.test(
    readFileSync(path, "utf8"),
  );
}

async function scrubGreen(rawPath, outputPath, job) {
  const { data, info } = await sharp(rawPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let index = 0; index < info.width * info.height; index++) {
    const offset = index * info.channels;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const dominance = green - Math.max(red, blue);
    if (dominance > 90) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    } else if (dominance > 40) {
      data[offset + 3] = Math.round(255 * (1 - (dominance - 40) / 50));
      data[offset + 1] = Math.max(red, blue);
    }
  }
  const keyed = await sharp(Buffer.from(data), {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png()
    .toBuffer();
  await sharp(keyed)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ width: job.maxWidth, height: job.maxHeight, fit: "inside", withoutEnlargement: false })
    .extend({ top: 8, bottom: 8, left: 8, right: 8, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
}

async function validateProjectile(path, job) {
  const image = sharp(path).ensureAlpha();
  const metadata = await image.metadata();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  let transparentPixels = 0;
  let visiblePixels = 0;
  let greenSpillPixels = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const alpha = data[offset + 3];
    if (alpha === 0) transparentPixels++;
    if (alpha > 64) visiblePixels++;
    if (alpha > 64 && data[offset + 1] - Math.max(data[offset], data[offset + 2]) > 40)
      greenSpillPixels++;
  }
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const aspect = height > 0 ? width / height : 0;
  const failures = [];
  if (!metadata.hasAlpha) failures.push("missing alpha");
  if (!width || !height) failures.push("empty dimensions");
  if (aspect < job.minAspect || aspect > job.maxAspect)
    failures.push(`aspect ${aspect.toFixed(2)} outside ${job.minAspect}-${job.maxAspect}`);
  if (transparentPixels === 0) failures.push("no transparent pixels");
  if (visiblePixels < 180) failures.push(`only ${visiblePixels} visible pixels`);
  if (greenSpillPixels > 0) failures.push(`${greenSpillPixels} green-spill pixels`);
  if (width > job.maxWidth + 16 || height > job.maxHeight + 16)
    failures.push(`oversize ${width}x${height}`);
  return { valid: failures.length === 0, failures, width, height, aspect, visiblePixels };
}

async function renderJob(job) {
  const final = resolve(installed, `${job.id}.png`);
  if (!options.force && existsSync(final)) {
    const validation = await validateProjectile(final, job);
    let recordedAttempts = 0;
    for (let attempt = 1; attempt <= 3; attempt++)
      if (existsSync(resolve(out, `${job.id}-attempt-${attempt}-raw.png`))) recordedAttempts = attempt;
    if (validation.valid)
      return {
        id: job.id,
        weaponId: job.weaponId,
        status: "VALID",
        attempts: recordedAttempts,
        ...validation,
      };
  }
  const survivor = existsSync(final) ? `${final}.survivor` : undefined;
  if (survivor) copyFileSync(final, survivor);
  let lastFailures = ["no render produced"];
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    const raw = resolve(out, `${job.id}-attempt-${attempt}-raw.png`);
    const candidate = resolve(out, `${job.id}-attempt-${attempt}-candidate.png`);
    const log = resolve(out, `${job.id}-attempt-${attempt}.codex.log`);
    if (options.force) {
      rmSync(raw, { force: true });
      rmSync(candidate, { force: true });
    }
    if (!existsSync(raw)) {
      console.log(`RENDER ${job.id} attempt ${attempt}/${options.maxAttempts}`);
      const code = await runCodexExec({
        prompt: job.prompt,
        images: [job.reference],
        cwd: repo,
        label: `v5a-${job.id}-a${attempt}`,
        harvestTo: raw,
        stdoutFile: log,
      });
      if (code !== 0 || !existsSync(raw) || disallowedRenderLog(log)) {
        lastFailures = [`Codex render failed (exit ${code})`];
        continue;
      }
    }
    try {
      await scrubGreen(raw, candidate, job);
      const validation = await validateProjectile(candidate, job);
      lastFailures = validation.failures;
      if (!validation.valid) {
        console.log(`REJECT ${job.id} attempt ${attempt}: ${validation.failures.join(", ")}`);
        continue;
      }
      copyFileSync(candidate, final);
      if (survivor) rmSync(survivor, { force: true });
      console.log(`VALID ${job.id} attempt ${attempt} -> ${validation.width}x${validation.height}`);
      return { id: job.id, weaponId: job.weaponId, status: "VALID", attempts: attempt, ...validation };
    } catch (error) {
      lastFailures = [error.message];
      console.log(`REJECT ${job.id} attempt ${attempt}: ${error.message}`);
    }
  }
  if (survivor && existsSync(survivor)) {
    copyFileSync(survivor, final);
    rmSync(survivor, { force: true });
  }
  return {
    id: job.id,
    weaponId: job.weaponId,
    status: "KEPT_CURRENT",
    attempts: options.maxAttempts,
    valid: false,
    failures: lastFailures,
  };
}

async function installBrimstoneWarhead() {
  const id = "brimstone-rocket-warhead";
  const final = resolve(installed, `${id}.png`);
  const source = resolve(repo, "packages/client/public/sprites/x2-brimstone-rocket-tube/part-1.png");
  if (options.force || !existsSync(final)) {
    // The W3 runtime projectile was x=158..255/y=13..64. Flatten that existing generated missile,
    // then remove its tube/body (local x=0..41), leaving only the shipped red warhead + base ring.
    await sharp(source)
      .extract({ left: 200, top: 13, width: 56, height: 52 })
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize({ width: 80, height: 64, fit: "inside", withoutEnlargement: false })
      .extend({ top: 8, bottom: 8, left: 8, right: 8, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(final);
  }
  const validation = await validateProjectile(final, {
    minAspect: 0.9,
    maxAspect: 2.3,
    maxWidth: 80,
    maxHeight: 64,
  });
  return {
    id,
    weaponId: "x2-brimstone-rocket-tube",
    status: validation.valid ? "VALID" : "KEPT_CURRENT",
    attempts: 0,
    edit: "existing-generated-missile-to-warhead",
    ...validation,
  };
}

async function writeProjectileManifest() {
  const assets = new Map(
    jobs.map((job) => [
      job.id,
      { source: "generated", path: resolve(installed, `${job.id}.png`), url: `projectiles/${job.id}.png` },
    ]),
  );
  assets.set("brimstone-rocket-warhead", {
    source: "edited",
    path: resolve(installed, "brimstone-rocket-warhead.png"),
    url: "projectiles/brimstone-rocket-warhead.png",
  });
  for (const asset of supplementalAssets) {
    const path = resolve(repo, "packages/client/public", asset.url);
    if (asset.normalize && existsSync(path) && !isCheck) {
      const normalized = await sharp(path)
        .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .resize({
          width: asset.normalize.width,
          height: asset.normalize.height,
          fit: "inside",
          withoutEnlargement: false,
        })
        .extend({
          top: 8,
          bottom: 8,
          left: 8,
          right: 8,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9 })
        .toBuffer();
      writeFileSync(path, normalized);
    }
    assets.set(asset.id, { source: "generated", path, url: asset.url });
  }
  const entries = [];
  for (const [id, asset] of [...assets].sort(([a], [b]) => a.localeCompare(b))) {
    const { path, source, url } = asset;
    if (!existsSync(path)) continue;
    const metadata = await sharp(path).metadata();
    if (!metadata.width || !metadata.height) continue;
    const asymmetric = mirrorUprightProjectileIds.has(id);
    entries.push({
      id,
      source,
      url,
      width: metadata.width,
      height: metadata.height,
      asymmetric,
      facing: asymmetric ? "mirror-upright" : "rotate",
    });
  }
  const body = entries
    .map(
      (entry) =>
        `  "${entry.id}": {\n` +
        `    url: "${entry.url}",\n` +
        `    width: ${entry.width},\n` +
        `    height: ${entry.height},\n` +
        `    source: "${entry.source}",\n` +
        `    asymmetric: ${entry.asymmetric},\n` +
        `    facing: "${entry.facing}",\n` +
        `  },`,
    )
    .join("\n");
  emit(
    manifestPath,
    `// AUTO-GENERATED by tools/artkit/gen-w4r-projectiles.mjs. Do not edit by hand.\n` +
      `// Standalone in-flight identity sprites; generated entries use weapon art as reference, never as crop data.\n` +
      `export interface ProjectileSpriteManifestEntry {\n` +
      `  readonly url: string;\n` +
      `  readonly width: number;\n` +
      `  readonly height: number;\n` +
      `  readonly source: "generated" | "edited";\n` +
      `  readonly asymmetric: boolean;\n` +
      `  readonly facing: "rotate" | "mirror-upright";\n` +
      `}\n` +
      `export const PROJECTILE_SPRITES = {\n${body}\n` +
      `} as const satisfies Record<string, ProjectileSpriteManifestEntry>;\n\n` +
      `export type ProjectileSpriteId = keyof typeof PROJECTILE_SPRITES;\n`,
    "projectile-manifest.ts",
  );
  return entries.length;
}

const selected = options.manifestOnly
  ? []
  : options.only
    ? jobs.filter((job) => job.id === options.only)
    : jobs;
if (options.only && selected.length === 0 && options.only !== "brimstone-rocket-warhead")
  throw new Error(`Unknown projectile asset ${options.only}`);
const outcomes = [];
let nextJob = 0;
async function renderWorker() {
  for (;;) {
    const job = selected[nextJob++];
    if (!job) return;
    outcomes.push(await renderJob(job));
  }
}
await Promise.all(Array.from({ length: Math.min(3, selected.length) }, renderWorker));
if (!options.manifestOnly && (!options.only || options.only === "brimstone-rocket-warhead"))
  outcomes.push(await installBrimstoneWarhead());
const manifestCount = await writeProjectileManifest();
if (!isCheck)
  writeFileSync(resolve(out, "render-outcomes.json"), `${JSON.stringify(outcomes, null, 2)}\n`);
console.table(
  outcomes.map(({ id, weaponId, status, attempts, width, height, failures }) => ({
    id,
    weaponId,
    status,
    attempts,
    size: width && height ? `${width}x${height}` : "-",
    failures: failures?.join("; ") ?? "",
  })),
);
console.log(`projectile manifest: ${manifestCount} installed sprite(s)`);
if (outcomes.some((outcome) => outcome.status !== "VALID")) process.exitCode = 1;
