#!/usr/bin/env node
// artkit/gen-gear.mjs — GEAR_SOCKET_FRAME_V1 boilerplate + launch wardrobe art.
//
// MASTERS FIRST: the blank boilerplate identity master is rendered before its body/head/hand/foot
// cutouts. Every gear render then receives that approved boilerplate plus the launch set's existing
// portrait and body sprite as identity references.
//
// RESUMABLE: green-field masters under tools/artkit/out/gear/masters are kept and reinstalled without
// another image call. Installs stay on the full 1024x1024 source canvas (NO trim) so every pivot remains
// canvas-authored. Each slot owns a stale-tolerant lock, allowing disjoint slot shards to run in parallel.
//
// MACHINE MANIFEST: tools/artkit/out/gear/gear-parts-manifest.json
//
// Usage:
//   node tools/artkit/gen-gear.mjs --stage=boilerplate
//   node tools/artkit/gen-gear.mjs --slot=hats
//   node tools/artkit/gen-gear.mjs --slot=boots [--only=cinderstep-wraps]
//   node tools/artkit/gen-gear.mjs --validate-only
//   node tools/artkit/gen-gear.mjs --force --slot=hats --only=thornwatch-plume

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const OUT = resolve(HERE, "out/gear");
const MASTERS = resolve(OUT, "masters");
const LOGS = resolve(OUT, "logs");
const LOCKS = resolve(OUT, "locks");
const MANIFEST_PATH = resolve(OUT, "gear-parts-manifest.json");
const SYSTEMS_DOC = resolve(REPO, "docs/metagame-panel/gear-systems.md");
const CONCEPTS_FILE = resolve(HERE, "subjects.concepts.json");
const SPRITES = resolve(REPO, "packages/client/public/sprites");
const BOILERPLATE_DST = resolve(SPRITES, "boilerplate");
const GEAR_DST = resolve(SPRITES, "gear");
const PORTRAITS = resolve(REPO, "packages/client/public/ui/portraits");

const CANVAS = Object.freeze({ width: 1024, height: 1024 });
const BODY_ROOT_SOURCE = Object.freeze({ x: 512, y: 512 });
const BODY_HEIGHT_L = 512;
const FRAME_ID = "GEAR_SOCKET_FRAME_V1";
const STACK_BAND_ID = "HAT_STACK_BAND_V1";
const OUTLINE = Object.freeze({ color: "#101014", rgba: [0x10, 0x10, 0x14, 0xff], baseWidth: 4, referenceCanvas: 512 });
const CONNECTOR_TOLERANCE = Object.freeze({ pixels: 4, degrees: 2 });

mkdirSync(MASTERS, { recursive: true });
mkdirSync(LOGS, { recursive: true });
mkdirSync(LOCKS, { recursive: true });
mkdirSync(BOILERPLATE_DST, { recursive: true });
mkdirSync(GEAR_DST, { recursive: true });

configureCodex({
  perChatRoot: resolve(HERE, ".artkit-codex-homes"),
  log: (message) => console.log(message),
});

function repoPath(path) {
  return relative(REPO, path).split(sep).join("/");
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function slug(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const next = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(next, `${JSON.stringify(value, null, 2)}\n`);
  try {
    renameSync(next, path);
  } catch {
    rmSync(path, { force: true });
    renameSync(next, path);
  }
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock(shard) {
  const safe = shard.replace(/[^a-z0-9-]/gi, "_");
  const path = resolve(LOCKS, `.gen-gear.${safe}.lock`);
  if (existsSync(path)) {
    let prior = null;
    try { prior = JSON.parse(readFileSync(path, "utf8")); } catch {}
    if (processIsAlive(Number(prior?.pid))) {
      throw new Error(`Another gen-gear process owns shard ${shard} (PID ${prior.pid})`);
    }
    console.log(`STALE LOCK ${repoPath(path)} removed (recorded PID ${prior?.pid ?? "invalid"})`);
    rmSync(path, { force: true });
  }
  writeFileSync(path, `${JSON.stringify({ pid: process.pid, shard, createdAt: new Date().toISOString() })}\n`, { flag: "wx" });
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    try {
      const current = JSON.parse(readFileSync(path, "utf8"));
      if (Number(current.pid) === process.pid) rmSync(path, { force: true });
    } catch {}
  };
  process.on("exit", release);
  return release;
}

const RECEIVERS = [
  { id: "head", xL: 0, yL: -0.38, parent: "body", parentTransform: "final body card", plane: "hat" },
  { id: "face.eyes", xL: 0.08, yL: -0.29, parent: "body", parentTransform: "final body card", plane: "glasses" },
  { id: "face.mouth", xL: 0.11, yL: -0.20, parent: "body", parentTransform: "final body card", plane: "facialHair" },
  { id: "torso", xL: 0, yL: -0.04, parent: "body", parentTransform: "final body card", plane: "shirt" },
  { id: "legs", xL: 0, yL: 0.29, parent: "body", parentTransform: "final body card", plane: "pants" },
  { id: "back", xL: -0.12, yL: -0.04, parent: "body", parentTransform: "final body card", plane: "cloakFar" },
  { id: "hand-l", xL: 0, yL: 0, parent: "hand-l", parentTransform: "final procedural hand image", raw: { x: 384, y: 522 }, plane: "backGlove" },
  { id: "hand-r", xL: 0, yL: 0, parent: "hand-r", parentTransform: "final procedural hand image", raw: { x: 640, y: 522 }, plane: "frontGlove" },
  { id: "foot-l", xL: 0, yL: 0, parent: "foot-l", parentTransform: "final procedural foot image", raw: { x: 448, y: 736 }, plane: "boots" },
  { id: "foot-r", xL: 0, yL: 0, parent: "foot-r", parentTransform: "final procedural foot image", raw: { x: 576, y: 736 }, plane: "boots" },
].map((receiver) => ({
  ...receiver,
  normalized: { xL: receiver.xL, yL: receiver.yL },
  raw: receiver.raw ?? {
    x: Number((BODY_ROOT_SOURCE.x + receiver.xL * BODY_HEIGHT_L).toFixed(2)),
    y: Number((BODY_ROOT_SOURCE.y + receiver.yL * BODY_HEIGHT_L).toFixed(2)),
  },
}));

function receiver(id) {
  const found = RECEIVERS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Unknown receiver ${id}`);
  return found;
}

const Z_ORDER = [
  { plane: -60, id: "shadowEchoes", law: "existing shadow and slide echoes" },
  { plane: -50, id: "cloakFar", law: "cloak far cloth" },
  { plane: -40, id: "baseFeet", law: "base feet" },
  { plane: -39, id: "boots", law: "each boot directly over its foot" },
  { plane: -30, id: "behindBody", law: "far held weapon sentinel" },
  { plane: -20, id: "backHand", law: "back hand" },
  { plane: -19, id: "backGlove", law: "back glove" },
  { plane: -18, id: "wornBackWeapon", law: "worn back-hand weapon" },
  { plane: 0, id: "body", law: "boilerplate body" },
  { plane: 10, id: "pants", law: "pants" },
  { plane: 20, id: "shirt", law: "shirt" },
  { plane: 25, id: "cloakClasp", law: "optional near cloak clasp" },
  { plane: 30, id: "facialHair", law: "facial hair" },
  { plane: 31, id: "glasses", law: "glasses" },
  { plane: 32, id: "hat", law: "hat and prestige spring-chain segments" },
  { plane: 40, id: "frontWeapon", law: "normal held weapon below its owning front hand" },
  { plane: 50, id: "frontHand", law: "front hand" },
  { plane: 51, id: "frontGlove", law: "front glove" },
  { plane: 52, id: "wornFrontWeapon", law: "worn front-hand weapon" },
  { plane: 60, id: "protectedVfx", law: "source tells, pair glint, gameplay VFX anchors, and label" },
];

const HAT_STACK_BAND = Object.freeze({
  id: STACK_BAND_ID,
  sourcePivot: Object.freeze({ x: 512, y: 317 }),
  mountStockBand: Object.freeze({ left: 416, top: 289, width: 192, height: 64, right: 607, bottom: 352 }),
  // The envelope includes the baked 8px outline; 24px is also the generator's hard emergency inset.
  silhouetteEnvelope: Object.freeze({ left: 184, top: 24, width: 656, height: 376, right: 839, bottom: 399 }),
  crownCenterBand: Object.freeze({ left: 408, right: 616 }),
  minimumMountOpaquePixels: 24,
  stackTolerance: Object.freeze({ horizontalPixels: 104, verticalPixels: 32 }),
});

const SLOT_SPECS = [
  {
    id: "boots", directory: "boots", docHeader: "Boots", receivers: ["foot-l", "foot-r"], componentIds: ["boot-l", "boot-r"],
    sourcePivots: [{ x: 340, y: 700 }, { x: 684, y: 700 }], maxPartBox: { width: 190, height: 190 }, planeIds: ["boots", "boots"],
    artDirection: "a matched left/right pair of boots or footwear, two separated complete paper islands",
  },
  {
    id: "gloves", directory: "gloves", docHeader: "Gloves", receivers: ["hand-l", "hand-r"], componentIds: ["glove-l", "glove-r"],
    sourcePivots: [{ x: 300, y: 512 }, { x: 724, y: 512 }], maxPartBox: { width: 180, height: 180 }, planeIds: ["backGlove", "frontGlove"],
    artDirection: "a matched left/right pair of gloves, gauntlets, or hand wraps, two separated complete paper islands",
  },
  {
    id: "shirt", directory: "shirt", docHeader: "Shirt", receivers: ["torso"], componentIds: ["torso-panel"],
    sourcePivots: [{ x: 512, y: 492 }], desiredAnchor: [0.5, 0.34], maxPartBox: { width: 420, height: 350 }, planeIds: ["shirt"],
    artDirection: "one isolated torso garment panel with a modest hidden neck/shoulder overlap; no head, arms, hands, pants, or cloak",
  },
  {
    id: "pants", directory: "pants", docHeader: "Pants", receivers: ["legs"], componentIds: ["legs-panel"],
    sourcePivots: [{ x: 512, y: 660 }], desiredAnchor: [0.5, 0.30], maxPartBox: { width: 370, height: 280 }, planeIds: ["pants"],
    artDirection: "one isolated lower-body pants panel with a modest hidden waistband overlap; no torso, boots, feet, or cloak",
  },
  {
    id: "cloak", directory: "cloak", docHeader: "Cloak", receivers: ["back"], componentIds: ["far-cloth"],
    sourcePivots: [{ x: 451, y: 492 }], desiredAnchor: [0.62, 0.24], maxPartBox: { width: 480, height: 540 }, planeIds: ["cloakFar"],
    artDirection: "one isolated far-cloth cloak, mantle, vestment, coat-tail, or apron silhouette; no body, arms, hands, held prop, or VFX",
  },
  {
    id: "glasses", directory: "glasses", docHeader: "Glasses", receivers: ["face.eyes"], componentIds: ["eyes"],
    sourcePivots: [{ x: 553, y: 364 }], desiredAnchor: [0.5, 0.5], maxPartBox: { width: 300, height: 150 }, planeIds: ["glasses"],
    artDirection: "one isolated eyewear cutout; solid lenses/frames only, no face, head, emitted glow, reticle, telegraph, or text",
  },
  {
    id: "facialHair", directory: "facial-hair", docHeader: "Facial hair", receivers: ["face.mouth"], componentIds: ["mouth"],
    sourcePivots: [{ x: 568, y: 410 }], desiredAnchor: [0.5, 0.38], maxPartBox: { width: 290, height: 210 }, planeIds: ["facialHair"],
    artDirection: "one isolated lower-face cosmetic cutout (hair, cord, tusks, mask detail, or digital stubble as named); no face, head, text, particles, or glow",
  },
  {
    id: "hat", directory: "hats", docHeader: "Hat", receivers: ["head"], componentIds: ["hat"],
    sourcePivots: [HAT_STACK_BAND.sourcePivot], desiredAnchor: [0.5, 0.82], maxPartBox: { width: 560, height: 340 }, planeIds: ["hat"],
    artDirection: "one signature isolated hat/headwear segment. It must read immediately as the named legacy character's headwear and also as one stable segment in a tall comic prestige hat stack",
  },
];

const SLOT_ALIASES = new Map([
  ["boots", "boots"], ["boot", "boots"],
  ["gloves", "gloves"], ["glove", "gloves"],
  ["shirt", "shirt"], ["shirts", "shirt"],
  ["pants", "pants"], ["pant", "pants"],
  ["cloak", "cloak"], ["cloaks", "cloak"],
  ["glasses", "glasses"], ["glass", "glasses"],
  ["facial-hair", "facialHair"], ["facialhair", "facialHair"], ["facialHair", "facialHair"],
  ["hat", "hat"], ["hats", "hat"],
]);

const SET_SOURCES = new Map([
  ["Ash-Walker", "cc-asha-the-ash-walker"],
  ["Ashen Crusader", "cc-brother-cassian-the-ashen-crusader"],
  ["Molten Core", "cc-cinderpyre"],
  ["Coldsnap", "cc-cordell-coldsnap-vane"],
  ["Graveside", "cc-elias-parson-thorne"],
  ["Nine Veils", "cc-iridia-of-the-nine-veils"],
  ["Demon Mask", "cc-kuro-oni-the-demon-mask"],
  ["Thornwatch", "cc-dame-veyra-of-the-thornwatch"],
  ["Neon Mirage", "cc-neon-mirage"],
  ["House Edge", "cc-quickfinger-odette-lacroix"],
  ["Unbending", "cc-sir-galloway-the-unbending"],
  ["Pressurized", "cc-tinker-magnus-brasswick"],
]);

function loadConcepts() {
  const rows = JSON.parse(readFileSync(CONCEPTS_FILE, "utf8"));
  return new Map(rows.filter((row) => row?.id).map((row) => [row.id, row]));
}

function parseLaunchItems() {
  const text = readFileSync(SYSTEMS_DOC, "utf8");
  const start = text.indexOf("| Set | Boots | Gloves | Shirt | Pants | Cloak | Glasses | Facial hair | Hat |");
  const end = text.indexOf("\n### Full-set bonuses", start);
  if (start < 0 || end < 0) throw new Error("Could not locate the 12x8 launch content table in gear-systems.md");
  const concepts = loadConcepts();
  const lines = text.slice(start, end).split(/\r?\n/).filter((line) => line.startsWith("|"));
  const headers = lines[0].slice(1, -1).split("|").map((cell) => cell.trim());
  const items = [];
  for (const line of lines.slice(2)) {
    const cells = line.slice(1, -1).split("|").map((cell) => cell.trim());
    if (cells.length !== headers.length) throw new Error(`Malformed launch content row: ${line}`);
    const setName = cells[0];
    const sourceCharacterId = SET_SOURCES.get(setName);
    if (!sourceCharacterId) throw new Error(`No identity source mapped for launch set ${setName}`);
    const concept = concepts.get(sourceCharacterId);
    if (!concept) throw new Error(`No concept identity found for ${sourceCharacterId}`);
    for (const spec of SLOT_SPECS) {
      const cell = cells[headers.indexOf(spec.docHeader)];
      const parsed = cell.match(/^(.*?)\s+\(([^)]+)\)\s+[—–-]\s+(.*)$/u);
      if (!parsed) throw new Error(`Could not parse ${setName}/${spec.docHeader}: ${cell}`);
      const name = parsed[1].trim();
      items.push({
        id: slug(name),
        name,
        rarity: parsed[2].trim(),
        effect: parsed[3].trim(),
        setName,
        setId: slug(setName),
        slot: spec.id,
        slotDirectory: spec.directory,
        sourceCharacterId,
        sourceCharacterName: concept.name,
        identityBrief: concept.prompt,
      });
    }
  }
  const ids = new Set(items.map((item) => item.id));
  if (items.length !== 96 || ids.size !== 96) {
    throw new Error(`Launch table contract drift: expected 96 unique items, found ${items.length}/${ids.size}`);
  }
  for (const sourceId of SET_SOURCES.values()) {
    const portrait = resolve(PORTRAITS, `${sourceId}.jpg`);
    const body = resolve(SPRITES, sourceId, "body.png");
    if (!existsSync(portrait) || !existsSync(body)) throw new Error(`Identity references missing for ${sourceId}`);
  }
  return items;
}

const ITEMS = parseLaunchItems();

const BOILERPLATE_PARTS = [
  {
    id: "body", parent: null, receiver: "body", pivot: BODY_ROOT_SOURCE, desiredAnchor: [0.5, 0.5],
    maxPartBox: { width: 390, height: 500 }, planeId: "body",
    description: "ONLY the pale blank torso/body card from shoulders through pelvis and joined simple upper legs; no head, hands, feet, clothing, hair, gear, or shadow",
  },
  {
    id: "head", parent: "body", receiver: "head", pivot: { x: 512, y: 330 }, desiredAnchor: [0.5, 0.66],
    maxPartBox: { width: 250, height: 240 }, planeId: "body",
    description: "ONLY the blank near-featureless pale pill/wedge head with a short neck overlap tab; no torso, hair, hat, ears, eyewear, facial hair, or shadow",
  },
  {
    id: "hand-l", parent: "hand-l", receiver: "hand-l", pivot: { x: 384, y: 522 }, desiredAnchor: [0.5, 0.5],
    maxPartBox: { width: 120, height: 100 }, planeId: "backHand",
    description: "ONLY the back/left detached pale mitten-bean hand, relaxed and readable without fingers; no arm, glove, weapon, or shadow",
  },
  {
    id: "hand-r", parent: "hand-r", receiver: "hand-r", pivot: { x: 640, y: 522 }, desiredAnchor: [0.5, 0.5],
    maxPartBox: { width: 120, height: 100 }, planeId: "frontHand",
    description: "ONLY the front/right detached pale mitten-bean hand, relaxed and readable without fingers; no arm, glove, weapon, or shadow",
  },
  {
    id: "foot-l", parent: "foot-l", receiver: "foot-l", pivot: { x: 448, y: 736 }, desiredAnchor: [0.5, 0.5],
    maxPartBox: { width: 145, height: 105 }, planeId: "baseFeet",
    description: "ONLY the back/left detached pale wedge foot, plain and bootless; no leg, boot, ground, or shadow",
  },
  {
    id: "foot-r", parent: "foot-r", receiver: "foot-r", pivot: { x: 576, y: 736 }, desiredAnchor: [0.5, 0.5],
    maxPartBox: { width: 145, height: 105 }, planeId: "baseFeet",
    description: "ONLY the front/right detached pale wedge foot, plain and bootless; no leg, boot, ground, or shadow",
  },
];

const BOILERPLATE_MASTER = {
  id: "identity-master",
  pivot: BODY_ROOT_SOURCE,
  desiredAnchor: [0.5, 0.5],
  maxPartBox: { width: 470, height: 650 },
};

function parseOptions(argv) {
  const options = {
    stage: "all",
    slot: null,
    only: null,
    force: false,
    validateOnly: false,
    maxJobs: Number.POSITIVE_INFINITY,
  };
  for (const arg of argv) {
    if (arg === "--force") options.force = true;
    else if (arg === "--validate-only") options.validateOnly = true;
    else if (arg === "--boilerplate") options.stage = "boilerplate";
    else if (arg.startsWith("--stage=")) options.stage = arg.slice(8);
    else if (arg.startsWith("--slot=")) options.slot = arg.slice(7);
    else if (arg.startsWith("--only=")) options.only = arg.slice(7);
    else if (arg.startsWith("--max-jobs=")) options.maxJobs = Number(arg.slice(11));
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node tools/artkit/gen-gear.mjs --stage=boilerplate | --slot=<boots|gloves|shirt|pants|cloak|glasses|facial-hair|hats>");
      console.log("       add [--only=<item-id>] [--force] [--max-jobs=N] or use --validate-only");
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!["all", "boilerplate", "gear"].includes(options.stage)) throw new Error(`Unknown stage ${options.stage}`);
  if (options.slot != null) {
    const normalized = SLOT_ALIASES.get(options.slot);
    if (!normalized) throw new Error(`Unknown slot ${options.slot}`);
    options.slot = normalized;
    options.stage = "gear";
  }
  if (Number.isNaN(options.maxJobs) || options.maxJobs < 1) throw new Error(`--max-jobs must be >= 1`);
  return options;
}

function rawBoilerplatePath(id) {
  return resolve(MASTERS, "boilerplate", `${id}.png`);
}

function installedBoilerplatePath(id) {
  return resolve(BOILERPLATE_DST, `${id}.png`);
}

function rawItemPath(item) {
  return resolve(MASTERS, item.slotDirectory, `${item.id}.png`);
}

function installedItemPath(item) {
  return resolve(GEAR_DST, item.slotDirectory, `${item.id}.png`);
}

function codexLogPath(kind, directory, id) {
  return resolve(LOGS, directory, `${id}.codex.log`);
}

function statusLogPath(kind, directory, id) {
  return resolve(LOGS, directory, `${id}.install.json`);
}

function referencesForItem(item) {
  const refs = [
    resolve(PORTRAITS, `${item.sourceCharacterId}.jpg`),
    resolve(SPRITES, item.sourceCharacterId, "body.png"),
    installedBoilerplatePath("identity-master"),
  ];
  return refs.every(existsSync) ? refs : [];
}

function executionBlock() {
  return `EXECUTION PATH — BINDING
- Use the built-in image_gen tool for this raster render.
- The three/local input images are already attached by the outer generator. Do not inspect the repository, list files, open paths, read more instructions beyond the required imagegen skill, or search for destinations.
- Call image_gen for the requested image and then END THE TURN IMMEDIATELY. The outer generator alone harvests, chroma-keys, registers, outlines, validates, and installs the PNG.
- Do not run shell commands, write or modify workspace files, copy images, crop, resize, reframe, post-process, validate pixels, or use Sharp, System.Drawing, Pillow/PIL, Python, JavaScript, SVG, or canvas.
- If image_gen is blocked, fails, or is unavailable, STOP WITHOUT CREATING A FILE. Do not substitute PowerShell/System.Drawing, Python/Pillow, SVG, HTML/canvas, procedural drawing code, a placeholder, or any other synthetic fallback. The outer generator must receive no PNG so it can record a clean resumable failure.`;
}

function chromaOutputBlock() {
  return `OUTPUT FORMAT — BINDING
- Exactly 1024x1024 PNG. Perfectly flat fully opaque uniform pure #00ff00 background for local chroma-key removal.
- No gradient, lighting variation, floor plane, contact/cast shadow, reflection, transparency, checkerboard, vignette, border, text, guide, watermark, UI, environment, aura, particles, or VFX.
- Never use #00ff00 or chroma-like lime in the art. Crisp opaque paper edges and generous uninterrupted green padding.`;
}

function houseStyleBlock() {
  return `HOUSE STYLE — NON-NEGOTIABLE
- Original HD 2D Flash-era paper-cutout arena art: bold compact silhouette, matte painted card stock, a few paper edge nicks, and a heavy slightly uneven near-black exterior contour.
- Slightly high three-quarter top-down view, semantic facing +X/screen-right, visual depth compression about 0.62. Not front view, isometric, pixel art, soft anime, photorealism, polished 3D toy, or vector-flat clipart.
- Flat cel shading only: base color plus ONE hard shadow band and AT MOST ONE hard highlight per material. No gradients, airbrush, ambient occlusion, bloom, rim light, or baked glow.
- About 5–7 decisive colors, few interior ink marks, no rarity halo, combat ring, telegraph red, parry-white flash, or extraction instruction color as a major silhouette feature.`;
}

function promptForBoilerplateMaster() {
  return `# CHAT ISOLATION — BOILERPLATE IDENTITY MASTER
Generate ONE standalone raster source image for Dimension Drifters. This establishes the immutable blank-slate character that all gear must fit.

${executionBlock()}

Use case: stylized-concept
Asset type: game-ready blank character identity master
Primary request: an ORIGINAL near-featureless pale Flash-era arena mannequin, inspired by the brutally simple readable silhouette language of early web combat cartoons without copying any named character.
Subject: one assembled neutral Drifter — smooth pill/wedge head with no hair, ears, nose, mouth, or eyes; at most one tiny charcoal registration-like face notch; compact pale paper torso; exactly two detached mitten-bean hands and exactly two detached wedge feet with clear green gaps. Gender-neutral, modest, deliberately empty of identity so equipment supplies all personality.
Pose: neutral idle, side-profile-biased facing screen-right; hands relaxed; feet planted; no action.
Palette: warm bone-paper #ded8c8, pale ash #b9b5aa shadow band, tiny muted taupe edge wear, near-black #101014 contour. No bright white.
Constraints: no clothing seams that read as gear, no shirt, pants, boots, gloves, cloak, glasses, facial hair, hat, armor, weapon, hair, face, shadow, VFX, or prop. Keep the complete assembled silhouette in a centered safe box around (${BODY_ROOT_SOURCE.x},${BODY_ROOT_SOURCE.y}).

${houseStyleBlock()}

${chromaOutputBlock()}

Before returning verify: one assembled pale blank identity; exactly one head/body, two detached hands, two detached feet; screen-right top-down 3/4; green gaps; no gear, face, prop, shadow, text, or VFX.`;
}

function promptForBoilerplatePart(part) {
  return `# CHAT ISOLATION — BOILERPLATE PART ${part.id}
Generate ONE standalone raster source image for Dimension Drifters. Render ONLY one separated rig part from the approved blank character.

${executionBlock()}

REFERENCE IMAGES
- Image 1: canonical approved boilerplate identity reference. Preserve its exact pale materials, proportions, viewpoint, lighting direction, contour language, and near-featureless identity. It is a reference, not an edit target; do not include the assembled character.

Use case: identity-preserve
Asset type: game-ready paper-cutout rig part
Primary request: ${part.description}.
Composition: exactly ONE complete opaque paper island. Place its authored connector stock near source pivot (${part.pivot.x},${part.pivot.y}); the pivot must lie inside ordinary painted material with 8–12% hidden overlap stock. Keep the entire part inside a ${part.maxPartBox.width}x${part.maxPartBox.height} safe footprint after registration.
Constraints: no other anatomy, duplicate, montage, guide, socket mark, pivot dot, label, body shadow, equipment, clothing, VFX, or prop. Preserve the canonical identity; do not redesign it.

${houseStyleBlock()}

FUSION REGISTRATION — ${FRAME_ID}
- Source canvas ${CANVAS.width}x${CANVAS.height}; body-local origin (${BODY_ROOT_SOURCE.x},${BODY_ROOT_SOURCE.y}); body height L=${BODY_HEIGHT_L}; semantic facing right.
- This part's authored source pivot is (${part.pivot.x},${part.pivot.y}). Painted connector stock must cover it. Connector tolerance is ${CONNECTOR_TOLERANCE.pixels} raw pixels / ${CONNECTOR_TOLERANCE.degrees} degrees.

${chromaOutputBlock()}

Before returning verify: ONLY ${part.id}; exact blank identity; authored pivot covered by stock; one paper island; clean green field; no other anatomy, gear, shadow, text, or VFX.`;
}

function promptForItem(item, spec) {
  const paired = spec.sourcePivots.length === 2;
  const pivotText = spec.sourcePivots.map((pivot, index) => `${spec.componentIds[index]}=(${pivot.x},${pivot.y})`).join(", ");
  const hatBlock = item.slot === "hat"
    ? `HAT PRESTIGE STACK LAW — ${STACK_BAND_ID}
- The hat is the signature item and one spring-linked prestige-tower segment. It must still read as ${item.sourceCharacterName}'s unmistakable headwear when miniaturized and stacked.
- Authored source pivot (${HAT_STACK_BAND.sourcePivot.x},${HAT_STACK_BAND.sourcePivot.y}) lies inside solid ordinary brim/crown-base stock.
- Solid base stock crosses mount band x=${HAT_STACK_BAND.mountStockBand.left}..${HAT_STACK_BAND.mountStockBand.right}, y=${HAT_STACK_BAND.mountStockBand.top}..${HAT_STACK_BAND.mountStockBand.bottom}.
- Keep the complete silhouette inside stack envelope x=${HAT_STACK_BAND.silhouetteEnvelope.left}..${HAT_STACK_BAND.silhouetteEnvelope.right}, y=${HAT_STACK_BAND.silhouetteEnvelope.top}..${HAT_STACK_BAND.silhouetteEnvelope.bottom}. Keep a central crown path inside x=${HAT_STACK_BAND.crownCenterBand.left}..${HAT_STACK_BAND.crownCenterBand.right} so the next hat has a stable top socket.
- Plumes, veil tabs, mask horns, pipes, and tilted brims may express identity inside that envelope, but may not turn the segment into a full head/body, VFX plume, or wildly off-axis tower branch.`
    : "";
  return `# CHAT ISOLATION — ONE GEAR ITEM ${item.id}
Generate ONE standalone raster source image for Dimension Drifters. This ticket targets only ${item.name}, slot ${spec.directory}, from the ${item.setName} launch set.

${executionBlock()}

REFERENCE IMAGES — IDENTITY, NOT COMPOSITION
- Image 1: canonical portrait identity reference for ${item.sourceCharacterName}. Copy its specific costume design language, materials, palette, motifs, and especially the named item's recognizable construction.
- Image 2: canonical shipped body-sprite identity reference for the same character. Match its simplified paper-cutout proportions, contour, palette blocking, and screen-right worn perspective.
- Image 3: approved blank boilerplate identity master. Use ONLY its body scale, screen-right top-down perspective, and socket placement as the invisible mannequin; do not paint any boilerplate pixels.

Use case: identity-preserve
Asset type: game-ready isolated wearable sprite part
Primary request: render ${item.name} (${item.rarity}) — ${spec.artDirection}.
Legacy provenance: ${item.identityBrief}
Systems flavor only: ${item.effect}
Composition: wearable pixels ALONE, as if worn on the invisible boilerplate at the ${spec.receivers.join(" + ")} receiver. ${paired ? "Exactly TWO separated matched paper islands, left component in the left bay and right component in the right bay." : "Exactly ONE complete opaque paper island."}
Source pivots: ${pivotText}. Every pivot must lie inside solid ordinary connector stock with 8–12% hidden overlap. No baked skin, head, body, hands, feet, shadow, held weapon, portrait, text, label, VFX, environment, or extra gear.

${houseStyleBlock()}

IDENTITY LOCK
- This is THEIR item, not a generic item sharing the name. Preserve the reference character's exact visual grammar and distinctive silhouette cues.
- Translate the legacy full-character design into this one isolated wearable only. Do not crop the old character, trace a whole body, include a face, or invent a replacement theme.
- The blank boilerplate remains pale and absent; only ${item.name} may be visible.

FUSION REGISTRATION — ${FRAME_ID}
- Source canvas ${CANVAS.width}x${CANVAS.height}; body-local origin (${BODY_ROOT_SOURCE.x},${BODY_ROOT_SOURCE.y}); body height L=${BODY_HEIGHT_L}; semantic facing right; runtime owns mirroring.
- Receiver rows: ${JSON.stringify(spec.receivers.map((id) => receiver(id)))}
- Canvas-authored source pivots: ${JSON.stringify(spec.sourcePivots)}; connector tolerance ${CONNECTOR_TOLERANCE.pixels} pixels / ${CONNECTOR_TOLERANCE.degrees} degrees.
- Installs stay untrimmed. Keep generous green separation from the canvas edge and between paired pieces.

${hatBlock}

${chromaOutputBlock()}

Before returning verify: exactly ${paired ? "two matched wearable islands" : "one wearable island"}; ${item.name} unmistakably belongs to ${item.sourceCharacterName}; screen-right worn perspective; every source pivot covered; stack law obeyed if a hat; no boilerplate pixels, anatomy, shadow, prop, text, or VFX.`;
}

function alphaBounds(data, width, height, threshold = 8, region = null) {
  const x0 = region?.left ?? 0;
  const y0 = region?.top ?? 0;
  const x1 = region ? region.left + region.width - 1 : width - 1;
  const y1 = region ? region.top + region.height - 1 : height - 1;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  let visiblePixelCount = 0;
  let opaquePixelCount = 0;
  let alphaWeight = 0;
  let weightedX = 0;
  let weightedY = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= threshold) continue;
      visiblePixelCount++;
      if (alpha >= 240) opaquePixelCount++;
      alphaWeight += alpha;
      weightedX += x * alpha;
      weightedY += y * alpha;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < left || bottom < top) return null;
  return {
    left, top, right, bottom,
    width: right - left + 1,
    height: bottom - top + 1,
    visiblePixelCount,
    opaquePixelCount,
    alphaCentroid: { x: weightedX / alphaWeight, y: weightedY / alphaWeight },
  };
}

function nearestVisible(data, width, bounds, desired, threshold = 64) {
  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let y = bounds.top; y <= bounds.bottom; y++) {
    for (let x = bounds.left; x <= bounds.right; x++) {
      if (data[(y * width + x) * 4 + 3] < threshold) continue;
      const dx = x - desired.x;
      const dy = y - desired.y;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { x, y };
      }
    }
  }
  return best;
}

function copyRgbaInto(target, source, sourceWidth, sourceHeight, left, top) {
  if (left < 0 || top < 0 || left + sourceWidth > CANVAS.width || top + sourceHeight > CANVAS.height) {
    throw new Error(`registered placement escapes canvas: ${sourceWidth}x${sourceHeight}@${left},${top}`);
  }
  for (let sourceY = 0; sourceY < sourceHeight; sourceY++) {
    const sourceStart = sourceY * sourceWidth * 4;
    const sourceEnd = sourceStart + sourceWidth * 4;
    const targetStart = ((top + sourceY) * CANVAS.width + left) * 4;
    source.copy(target, targetStart, sourceStart, sourceEnd);
  }
}

function nudgeRegionPivotIntoStock(data, pivot, region = null) {
  const pivotOffset = (Math.round(pivot.y) * CANVAS.width + Math.round(pivot.x)) * 4;
  if (data[pivotOffset + 3] >= 192) return data;
  const bounds = alphaBounds(data, CANVAS.width, CANVAS.height, 8, region);
  if (!bounds) throw new Error(`cannot nudge missing stock to pivot (${pivot.x},${pivot.y})`);
  const stock = nearestVisible(data, CANVAS.width, bounds, pivot, 192);
  if (!stock) throw new Error(`cannot find deep painted stock near pivot (${pivot.x},${pivot.y})`);
  const dx = Math.round(pivot.x - stock.x);
  const dy = Math.round(pivot.y - stock.y);
  if (dx === 0 && dy === 0) return data;
  const shifted = Buffer.from(data);
  for (let y = bounds.top; y <= bounds.bottom; y++) {
    for (let x = bounds.left; x <= bounds.right; x++) shifted.fill(0, (y * CANVAS.width + x) * 4, (y * CANVAS.width + x) * 4 + 4);
  }
  for (let y = bounds.top; y <= bounds.bottom; y++) {
    for (let x = bounds.left; x <= bounds.right; x++) {
      const targetX = x + dx;
      const targetY = y + dy;
      if (targetX < 0 || targetY < 0 || targetX >= CANVAS.width || targetY >= CANVAS.height) continue;
      const sourceOffset = (y * CANVAS.width + x) * 4;
      const targetOffset = (targetY * CANVAS.width + targetX) * 4;
      data.copy(shifted, targetOffset, sourceOffset, sourceOffset + 4);
    }
  }
  return shifted;
}

async function decodeAndKey(raw) {
  const { data, info } = await sharp(raw)
    .resize(CANVAS.width, CANVAS.height, { fit: "fill" })
    .removeAlpha()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    if (green > 150 && green > red * 1.48 && green > blue * 1.48 && green - Math.max(red, blue) > 52) {
      data[index + 3] = 0;
    } else if (green > red && green > blue && green - Math.max(red, blue) > 20) {
      data[index + 1] = Math.max(red, blue);
    }
  }
  return { data, info };
}

function circularKernel(radius) {
  const size = radius * 2 + 1;
  const kernel = [];
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) kernel.push(x * x + y * y <= radius * radius ? 1 : 0);
  }
  return { width: size, height: size, kernel, scale: 1 };
}

async function bakeOutline(registered) {
  const radius = Math.max(1, Math.round(OUTLINE.baseWidth * Math.max(CANVAS.width, CANVAS.height) / OUTLINE.referenceCanvas));
  const { data: dilated } = await sharp(registered, { raw: { width: CANVAS.width, height: CANVAS.height, channels: 4 } })
    .extractChannel(3)
    .threshold(1)
    .convolve(circularKernel(radius))
    .threshold(1)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const output = Buffer.from(registered);
  let rimPixels = 0;
  for (let pixel = 0, offset = 0; pixel < CANVAS.width * CANVAS.height; pixel++, offset += 4) {
    if (registered[offset + 3] === 0 && dilated[pixel] > 0) {
      output[offset] = OUTLINE.rgba[0];
      output[offset + 1] = OUTLINE.rgba[1];
      output[offset + 2] = OUTLINE.rgba[2];
      output[offset + 3] = OUTLINE.rgba[3];
      rimPixels++;
    }
  }
  return { data: output, radius, rimPixels };
}

async function registerSingle(keyed, pivot, desiredAnchor, maxPartBox) {
  const bounds = alphaBounds(keyed, CANVAS.width, CANVAS.height);
  if (!bounds) throw new Error("chroma key removed the entire render");
  const approximate = {
    x: bounds.left + bounds.width * desiredAnchor[0],
    y: bounds.top + bounds.height * desiredAnchor[1],
  };
  // Register to deep painted stock so Lanczos downscaling cannot leave the exact pivot on a weak AA fringe.
  const authoredPixel = nearestVisible(keyed, CANVAS.width, bounds, approximate, 192);
  if (!authoredPixel) throw new Error("could not locate opaque stock for authored pivot");
  const scale = Math.min(1, maxPartBox.width / bounds.width, maxPartBox.height / bounds.height);
  const registeredWidth = Math.max(1, Math.round(bounds.width * scale));
  const registeredHeight = Math.max(1, Math.round(bounds.height * scale));
  const cutout = await sharp(keyed, { raw: { width: CANVAS.width, height: CANVAS.height, channels: 4 } })
    .extract({ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height })
    .resize(registeredWidth, registeredHeight, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .raw()
    .toBuffer();
  const anchorX = (authoredPixel.x - bounds.left) * registeredWidth / bounds.width;
  const anchorY = (authoredPixel.y - bounds.top) * registeredHeight / bounds.height;
  const left = Math.round(pivot.x - anchorX);
  const top = Math.round(pivot.y - anchorY);
  let registered = Buffer.alloc(CANVAS.width * CANVAS.height * 4);
  copyRgbaInto(registered, cutout, registeredWidth, registeredHeight, left, top);
  registered = nudgeRegionPivotIntoStock(registered, pivot);
  return registered;
}

async function registerPaired(keyed, spec) {
  const overall = alphaBounds(keyed, CANVAS.width, CANVAS.height);
  if (!overall) throw new Error("chroma key removed the entire paired render");
  const middle = Math.floor(overall.left + overall.width / 2);
  const regions = [
    { left: overall.left, top: overall.top, width: Math.max(1, middle - overall.left + 1), height: overall.height },
    { left: middle + 1, top: overall.top, width: Math.max(1, overall.right - middle), height: overall.height },
  ];
  const registered = Buffer.alloc(CANVAS.width * CANVAS.height * 4);
  for (let index = 0; index < 2; index++) {
    const bounds = alphaBounds(keyed, CANVAS.width, CANVAS.height, 8, regions[index]);
    if (!bounds || bounds.opaquePixelCount < 100) throw new Error(`paired component ${spec.componentIds[index]} missing or too small`);
    const desired = bounds.alphaCentroid;
    const authoredPixel = nearestVisible(keyed, CANVAS.width, bounds, desired, 192);
    if (!authoredPixel) throw new Error(`could not locate opaque stock for ${spec.componentIds[index]}`);
    const scale = Math.min(1, spec.maxPartBox.width / bounds.width, spec.maxPartBox.height / bounds.height);
    const width = Math.max(1, Math.round(bounds.width * scale));
    const height = Math.max(1, Math.round(bounds.height * scale));
    const cutout = await sharp(keyed, { raw: { width: CANVAS.width, height: CANVAS.height, channels: 4 } })
      .extract({ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height })
      .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .raw()
      .toBuffer();
    const anchorX = (authoredPixel.x - bounds.left) * width / bounds.width;
    const anchorY = (authoredPixel.y - bounds.top) * height / bounds.height;
    const left = Math.round(spec.sourcePivots[index].x - anchorX);
    const top = Math.round(spec.sourcePivots[index].y - anchorY);
    copyRgbaInto(registered, cutout, width, height, left, top);
  }
  const split = Math.floor((spec.sourcePivots[0].x + spec.sourcePivots[1].x) / 2);
  let nudged = nudgeRegionPivotIntoStock(registered, spec.sourcePivots[0], { left: 0, top: 0, width: split + 1, height: CANVAS.height });
  nudged = nudgeRegionPivotIntoStock(nudged, spec.sourcePivots[1], { left: split + 1, top: 0, width: CANVAS.width - split - 1, height: CANVAS.height });
  return nudged;
}

function countOpaqueInRect(data, rect, threshold = 64) {
  let count = 0;
  for (let y = rect.top; y <= rect.bottom; y++) {
    for (let x = rect.left; x <= rect.right; x++) {
      if (data[(y * CANVAS.width + x) * 4 + 3] >= threshold) count++;
    }
  }
  return count;
}

function verifyHatStackBand(data, bounds) {
  const band = HAT_STACK_BAND;
  const pivotAlpha = data[(band.sourcePivot.y * CANVAS.width + band.sourcePivot.x) * 4 + 3];
  const mountOpaquePixels = countOpaqueInRect(data, band.mountStockBand);
  let topSocketSource = null;
  for (let y = bounds.top; y <= Math.min(bounds.bottom, band.mountStockBand.top); y++) {
    let bestX = null;
    let bestDx = Number.POSITIVE_INFINITY;
    for (let x = band.crownCenterBand.left; x <= band.crownCenterBand.right; x++) {
      if (data[(y * CANVAS.width + x) * 4 + 3] < 64) continue;
      const dx = Math.abs(x - band.sourcePivot.x);
      if (dx < bestDx) { bestDx = dx; bestX = x; }
    }
    if (bestX != null) { topSocketSource = { x: bestX, y }; break; }
  }
  const envelope = band.silhouetteEnvelope;
  const silhouetteInsideEnvelope = bounds.left >= envelope.left
    && bounds.right <= envelope.right
    && bounds.top >= envelope.top
    && bounds.bottom <= envelope.bottom;
  const pivotInsideStock = pivotAlpha >= 64;
  const mountBandOccupied = mountOpaquePixels >= band.minimumMountOpaquePixels;
  const centralCrownPath = topSocketSource != null;
  return {
    frame: STACK_BAND_ID,
    verified: pivotInsideStock && mountBandOccupied && silhouetteInsideEnvelope && centralCrownPath,
    pivotInsideStock,
    pivotAlpha,
    mountBandOccupied,
    mountOpaquePixels,
    minimumMountOpaquePixels: band.minimumMountOpaquePixels,
    silhouetteInsideEnvelope,
    topSocketSource,
    centralCrownPath,
    bounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom },
  };
}

async function processAndInstall({ raw, dst, pivots, desiredAnchor, maxPartBox, pairedSpec = null, hat = false }) {
  const decoded = await decodeAndKey(raw);
  const registered = pairedSpec
    ? await registerPaired(decoded.data, pairedSpec)
    : await registerSingle(decoded.data, pivots[0], desiredAnchor, maxPartBox);
  const outlined = await bakeOutline(registered);
  const bounds = alphaBounds(outlined.data, CANVAS.width, CANVAS.height);
  if (!bounds) throw new Error("registered art contains no visible pixels");
  if (bounds.left < 24 || bounds.top < 24 || bounds.right >= CANVAS.width - 24 || bounds.bottom >= CANVAS.height - 24) {
    throw new Error(`alpha bounds violate 24px emergency canvas inset: ${JSON.stringify(bounds)}`);
  }
  if (bounds.opaquePixelCount < 250 || bounds.opaquePixelCount > 280000) {
    throw new Error(`opaque coverage ${bounds.opaquePixelCount} outside sane range 250..280000`);
  }
  for (const pivot of pivots) {
    const alpha = outlined.data[(Math.round(pivot.y) * CANVAS.width + Math.round(pivot.x)) * 4 + 3];
    if (alpha < 64) throw new Error(`source pivot (${pivot.x},${pivot.y}) is outside painted stock (alpha ${alpha})`);
  }
  if (hat) {
    const stack = verifyHatStackBand(outlined.data, bounds);
    if (!stack.verified) throw new Error(`hat stack-band verification failed: ${JSON.stringify(stack)}`);
  }
  const png = await sharp(outlined.data, { raw: { width: CANVAS.width, height: CANVAS.height, channels: 4 } }).png().toBuffer();
  const metadata = await sharp(png).metadata();
  if (metadata.width !== CANVAS.width || metadata.height !== CANVAS.height || metadata.channels !== 4 || metadata.hasAlpha !== true) {
    throw new Error(`encoded metadata invalid: ${JSON.stringify(metadata)}`);
  }
  mkdirSync(dirname(dst), { recursive: true });
  const temp = `${dst}.${process.pid}.tmp.png`;
  writeFileSync(temp, png);
  try { renameSync(temp, dst); } catch { rmSync(dst, { force: true }); renameSync(temp, dst); }
  return { bounds, outline: { ...OUTLINE, radius: outlined.radius, rimPixels: outlined.rimPixels } };
}

function componentRegionsForSpec(spec) {
  if (spec.sourcePivots.length === 1) return [null];
  const split = Math.floor((spec.sourcePivots[0].x + spec.sourcePivots[1].x) / 2);
  return [
    { left: 0, top: 0, width: split + 1, height: CANVAS.height },
    { left: split + 1, top: 0, width: CANVAS.width - split - 1, height: CANVAS.height },
  ];
}

async function inspectInstalled(path, pivots, regions = [null], hat = false) {
  const metadata = await sharp(path).metadata();
  if (metadata.width !== CANVAS.width || metadata.height !== CANVAS.height || metadata.channels !== 4 || metadata.hasAlpha !== true || metadata.format !== "png") {
    throw new Error(`expected 1024x1024 RGBA PNG, got ${metadata.width}x${metadata.height} channels=${metadata.channels} alpha=${metadata.hasAlpha} format=${metadata.format}`);
  }
  const { data } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bounds = alphaBounds(data, CANVAS.width, CANVAS.height);
  if (!bounds) throw new Error("no visible alpha pixels");
  const parts = [];
  for (let index = 0; index < pivots.length; index++) {
    const pivot = pivots[index];
    const pivotAlpha = data[(Math.round(pivot.y) * CANVAS.width + Math.round(pivot.x)) * 4 + 3];
    if (pivotAlpha < 64) throw new Error(`pivot ${index} alpha ${pivotAlpha} is below 64`);
    const partBounds = regions[index] ? alphaBounds(data, CANVAS.width, CANVAS.height, 8, regions[index]) : bounds;
    if (!partBounds || partBounds.opaquePixelCount < 100) throw new Error(`part ${index} has insufficient visible stock`);
    parts.push({ pivotAlpha, bounds: partBounds });
  }
  const stackBandVerification = hat ? verifyHatStackBand(data, bounds) : null;
  if (hat && !stackBandVerification.verified) throw new Error(`hat stack-band invalid: ${JSON.stringify(stackBandVerification)}`);
  return {
    bounds,
    parts,
    stackBandVerification,
    image: {
      width: metadata.width,
      height: metadata.height,
      channels: metadata.channels,
      hasAlpha: metadata.hasAlpha,
      format: metadata.format,
      sha256: sha256(path),
      opaquePixelCount: bounds.opaquePixelCount,
      visiblePixelCount: bounds.visiblePixelCount,
      transparentPixelCount: CANVAS.width * CANVAS.height - bounds.visiblePixelCount,
    },
  };
}

function disallowedRenderLog(path) {
  const log = existsSync(path) ? readFileSync(path, "utf8") : "";
  return /moderation_blocked|codex_core::tools::router: error=image generation failed|System\.Drawing\.Bitmap|PIL unavailable|raster script failed/i.test(log);
}

async function renderIfNeeded({ key, raw, dst, refs, prompt, logPath, force }) {
  mkdirSync(dirname(raw), { recursive: true });
  mkdirSync(dirname(logPath), { recursive: true });
  if (!force && (existsSync(raw) || existsSync(dst))) {
    console.log(`RESUME ${key}: source/install already exists`);
    return { rendered: false, code: 0 };
  }
  const harvestTo = force && existsSync(raw) ? resolve(dirname(raw), `${key.replaceAll("/", "-")}.force-${Date.now()}.png`) : raw;
  console.log(`RENDER ${key} refs=${refs.length}`);
  const code = await runCodexExec({
    label: `gear-${key.replace(/[^a-z0-9-]/gi, "-")}`,
    cwd: REPO,
    prompt,
    images: refs,
    harvestTo,
    stdoutFile: logPath,
  });
  if (disallowedRenderLog(logPath)) {
    if (existsSync(harvestTo)) {
      const rejected = resolve(OUT, "rejected", `${key.replaceAll("/", "-")}-${Date.now()}.png`);
      mkdirSync(dirname(rejected), { recursive: true });
      renameSync(harvestTo, rejected);
      console.log(`REJECTED ${key}: blocked image call or code-drawn fallback moved to ${repoPath(rejected)}`);
    }
    return { rendered: true, code: code || 1, rejected: true };
  }
  if (harvestTo !== raw && existsSync(harvestTo)) {
    copyFileSync(harvestTo, raw);
    rmSync(harvestTo, { force: true });
  }
  return { rendered: true, code };
}

async function runBoilerplate(options) {
  let failures = 0;
  const masterRaw = rawBoilerplatePath(BOILERPLATE_MASTER.id);
  const masterDst = installedBoilerplatePath(BOILERPLATE_MASTER.id);
  if (!options.validateOnly) {
    const logPath = codexLogPath("boilerplate", "boilerplate", BOILERPLATE_MASTER.id);
    const render = await renderIfNeeded({
      key: `boilerplate/${BOILERPLATE_MASTER.id}`,
      raw: masterRaw,
      dst: masterDst,
      refs: [],
      prompt: promptForBoilerplateMaster(),
      logPath,
      force: options.force,
    });
    if (!existsSync(masterRaw) && !existsSync(masterDst)) {
      console.log(`RENDER FAIL boilerplate/${BOILERPLATE_MASTER.id} exit=${render.code}`);
      return 1;
    }
    if (existsSync(masterRaw)) {
      try {
        const installed = await processAndInstall({
          raw: masterRaw, dst: masterDst, pivots: [BOILERPLATE_MASTER.pivot],
          desiredAnchor: BOILERPLATE_MASTER.desiredAnchor, maxPartBox: BOILERPLATE_MASTER.maxPartBox,
        });
        console.log(`INSTALLED ${repoPath(masterDst)} bounds=${installed.bounds.width}x${installed.bounds.height}@${installed.bounds.left},${installed.bounds.top}`);
      } catch (error) {
        console.log(`INSTALL FAIL boilerplate/${BOILERPLATE_MASTER.id}: ${error.message}`);
        return 1;
      }
    }
  }
  if (!existsSync(masterDst)) {
    if (options.validateOnly) return 0;
    console.log(`BOILERPLATE BLOCKED: ${repoPath(masterDst)} is missing`);
    return 1;
  }
  let completed = 0;
  for (const part of BOILERPLATE_PARTS) {
    if (options.only && options.only !== part.id && options.only !== `boilerplate/${part.id}`) continue;
    if (completed >= options.maxJobs) break;
    completed++;
    const raw = rawBoilerplatePath(part.id);
    const dst = installedBoilerplatePath(part.id);
    const logPath = codexLogPath("boilerplate", "boilerplate", part.id);
    if (!options.validateOnly) {
      const render = await renderIfNeeded({
        key: `boilerplate/${part.id}`,
        raw, dst,
        refs: [masterDst],
        prompt: promptForBoilerplatePart(part),
        logPath,
        force: options.force,
      });
      if (!existsSync(raw) && !existsSync(dst)) {
        console.log(`RENDER FAIL boilerplate/${part.id} exit=${render.code}`);
        failures++;
        continue;
      }
      if (existsSync(raw)) {
        try {
          const installed = await processAndInstall({ raw, dst, pivots: [part.pivot], desiredAnchor: part.desiredAnchor, maxPartBox: part.maxPartBox });
          atomicJson(statusLogPath("boilerplate", "boilerplate", part.id), {
            id: part.id, installedAt: new Date().toISOString(), installedFile: repoPath(dst),
            pivot: part.pivot, alphaBounds: installed.bounds, outline: installed.outline,
          });
          console.log(`INSTALLED ${repoPath(dst)} bounds=${installed.bounds.width}x${installed.bounds.height}@${installed.bounds.left},${installed.bounds.top}`);
        } catch (error) {
          console.log(`INSTALL FAIL boilerplate/${part.id}: ${error.message}`);
          failures++;
        }
      }
    }
    if (existsSync(dst)) {
      try { await inspectInstalled(dst, [part.pivot]); }
      catch (error) { console.log(`VALIDATE FAIL boilerplate/${part.id}: ${error.message}`); failures++; }
    }
  }
  if (BOILERPLATE_PARTS.every((part) => existsSync(installedBoilerplatePath(part.id)))) {
    try {
      await emitSocketReferenceSheet();
      console.log(`SOCKET SHEET ${repoPath(installedBoilerplatePath("socket-reference"))}`);
    } catch (error) {
      console.log(`SOCKET SHEET FAIL: ${error.message}`);
      failures++;
    }
  }
  return failures;
}

async function runSlot(options, spec) {
  if (!existsSync(installedBoilerplatePath("identity-master"))) {
    if (options.validateOnly) return 0;
    console.log(`SLOT BLOCKED ${spec.directory}: run --stage=boilerplate first; approved boilerplate identity master is missing`);
    return 1;
  }
  let failures = 0;
  let completed = 0;
  const jobs = ITEMS.filter((item) => item.slot === spec.id && (!options.only || options.only === item.id));
  if (!options.validateOnly && jobs.length === 0) throw new Error(`No ${spec.directory} item matched --only=${options.only}`);
  for (const item of jobs) {
    if (completed >= options.maxJobs) break;
    completed++;
    const key = `${spec.directory}/${item.id}`;
    const raw = rawItemPath(item);
    const dst = installedItemPath(item);
    const refs = referencesForItem(item);
    const logPath = codexLogPath("gear", spec.directory, item.id);
    if (!options.validateOnly) {
      if (refs.length !== 3) {
        console.log(`RENDER FAIL ${key}: identity reference missing`);
        failures++;
        continue;
      }
      const render = await renderIfNeeded({
        key, raw, dst, refs,
        prompt: promptForItem(item, spec),
        logPath,
        force: options.force,
      });
      if (!existsSync(raw) && !existsSync(dst)) {
        console.log(`RENDER FAIL ${key} exit=${render.code}`);
        failures++;
        continue;
      }
      if (existsSync(raw)) {
        try {
          const installed = await processAndInstall({
            raw, dst,
            pivots: spec.sourcePivots,
            desiredAnchor: spec.desiredAnchor ?? [0.5, 0.5],
            maxPartBox: spec.maxPartBox,
            pairedSpec: spec.sourcePivots.length === 2 ? spec : null,
            hat: spec.id === "hat",
          });
          atomicJson(statusLogPath("gear", spec.directory, item.id), {
            id: item.id, name: item.name, setId: item.setId, sourceCharacterId: item.sourceCharacterId,
            installedAt: new Date().toISOString(), installedFile: repoPath(dst), sourcePivots: spec.sourcePivots,
            identityReferences: refs.map(repoPath), alphaBounds: installed.bounds, outline: installed.outline,
          });
          console.log(`INSTALLED ${repoPath(dst)} bounds=${installed.bounds.width}x${installed.bounds.height}@${installed.bounds.left},${installed.bounds.top}`);
        } catch (error) {
          console.log(`INSTALL FAIL ${key}: ${error.message}`);
          failures++;
        }
      }
    }
    if (existsSync(dst)) {
      try {
        const inspected = await inspectInstalled(dst, spec.sourcePivots, componentRegionsForSpec(spec), spec.id === "hat");
        console.log(`VALID ${key} opaque=${inspected.image.opaquePixelCount} pivotAlpha=${inspected.parts.map((part) => part.pivotAlpha).join(",")}${inspected.stackBandVerification ? ` stack=${inspected.stackBandVerification.verified}` : ""}`);
      } catch (error) {
        console.log(`VALIDATE FAIL ${key}: ${error.message}`);
        failures++;
      }
    }
  }
  return failures;
}

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function emitSocketReferenceSheet() {
  const layers = ["foot-l", "foot-r", "body", "head", "hand-l", "hand-r"]
    .map((id) => installedBoilerplatePath(id))
    .filter(existsSync)
    .map((input) => ({ input }));
  const markers = RECEIVERS.map((row, index) => {
    const color = row.id === "head" ? "#ffcf4a" : row.id.startsWith("face") ? "#62d4ff" : "#f2eee2";
    const labelX = row.raw.x + (row.raw.x < 512 ? -12 : 12);
    const anchor = row.raw.x < 512 ? "end" : "start";
    return `<g><circle cx="${row.raw.x}" cy="${row.raw.y}" r="8" fill="${color}" stroke="#101014" stroke-width="4"/><text x="${labelX}" y="${row.raw.y - 12}" text-anchor="${anchor}" fill="#f2eee2" stroke="#101014" stroke-width="3" paint-order="stroke" font-family="monospace" font-size="20" font-weight="700">${escapeXml(row.id)}</text></g>`;
  }).join("");
  const band = HAT_STACK_BAND.mountStockBand;
  const backgroundSvg = Buffer.from(`<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="1024" height="1024" fill="#25212c"/>
    <text x="32" y="44" fill="#f2eee2" font-family="monospace" font-size="24" font-weight="700">${FRAME_ID} · L=${BODY_HEIGHT_L} · RIGHT FACING</text>
  </svg>`);
  const markerSvg = Buffer.from(`<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <rect x="${band.left}" y="${band.top}" width="${band.width}" height="${band.height}" fill="none" stroke="#ffcf4a" stroke-width="3" stroke-dasharray="10 8"/>
    <text x="${band.right + 12}" y="${band.top + 24}" fill="#ffcf4a" stroke="#101014" stroke-width="3" paint-order="stroke" font-family="monospace" font-size="18">${STACK_BAND_ID}</text>
    ${markers}
    <circle cx="${BODY_ROOT_SOURCE.x}" cy="${BODY_ROOT_SOURCE.y}" r="11" fill="#ff6f91" stroke="#101014" stroke-width="4"/>
    <text x="${BODY_ROOT_SOURCE.x + 16}" y="${BODY_ROOT_SOURCE.y + 30}" fill="#ff6f91" stroke="#101014" stroke-width="3" paint-order="stroke" font-family="monospace" font-size="18">body centroid</text>
  </svg>`);
  const background = await sharp(backgroundSvg).png().toBuffer();
  const artLayers = layers.map((layer) => ({ ...layer, blend: "over" }));
  const markerLayer = await sharp(markerSvg).png().toBuffer();
  await sharp(background).composite([...artLayers, { input: markerLayer }]).png().toFile(installedBoilerplatePath("socket-reference"));
}

function listPngs(root) {
  const files = [];
  const walk = (directory) => {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) files.push(path);
    }
  };
  walk(root);
  return files.sort();
}

function boundsManifest(bounds) {
  return { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height, right: bounds.right, bottom: bounds.bottom };
}

async function emitHatContactSheet() {
  const hats = ITEMS.filter((item) => item.slot === "hat" && existsSync(installedItemPath(item)));
  if (hats.length === 0) return null;
  const tileWidth = 256;
  const tileHeight = 256;
  const columns = 4;
  const rows = Math.ceil(hats.length / columns);
  const sheet = sharp({ create: { width: tileWidth * columns, height: tileHeight * rows, channels: 4, background: "#25212c" } });
  const layers = [];
  for (let index = 0; index < hats.length; index++) {
    const item = hats[index];
    const inspected = await inspectInstalled(installedItemPath(item), SLOT_SPECS.find((spec) => spec.id === "hat").sourcePivots, [null], true);
    const pad = 16;
    const left = Math.max(0, inspected.bounds.left - pad);
    const top = Math.max(0, inspected.bounds.top - pad);
    const width = Math.min(CANVAS.width - left, inspected.bounds.width + pad * 2);
    const height = Math.min(CANVAS.height - top, inspected.bounds.height + pad * 2);
    const art = await sharp(installedItemPath(item)).extract({ left, top, width, height }).resize({
      width: 226,
      height: 190,
      fit: "contain",
      background: { r: 0x25, g: 0x21, b: 0x2c, alpha: 1 },
    }).png().toBuffer();
    const x = (index % columns) * tileWidth;
    const y = Math.floor(index / columns) * tileHeight;
    const label = Buffer.from(`<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="252" height="252" rx="12" fill="none" stroke="${inspected.stackBandVerification.verified ? "#72d39b" : "#ff6f91"}" stroke-width="3"/><text x="128" y="226" text-anchor="middle" fill="#f2eee2" font-family="sans-serif" font-size="14" font-weight="700">${escapeXml(item.name)}</text><text x="128" y="246" text-anchor="middle" fill="#72d39b" font-family="monospace" font-size="12">STACK ${inspected.stackBandVerification.verified ? "PASS" : "FAIL"}</text></svg>`);
    layers.push({ input: art, left: x + 15, top: y + 12 });
    layers.push({ input: label, left: x, top: y });
  }
  const out = resolve(OUT, "hat-contact-sheet.png");
  await sheet.composite(layers).png().toFile(out);
  return out;
}

async function buildManifest() {
  const invalid = [];
  const installedPaths = new Set();
  const boilerplateParts = [];
  let boilerplateMaster = null;
  const masterPath = installedBoilerplatePath("identity-master");
  if (existsSync(masterPath)) {
    try {
      const inspected = await inspectInstalled(masterPath, [BOILERPLATE_MASTER.pivot]);
      installedPaths.add(repoPath(masterPath));
      boilerplateMaster = {
        id: "identity-master", installedFile: repoPath(masterPath), pivotSource: BOILERPLATE_MASTER.pivot,
        pivotTrimmed: BOILERPLATE_MASTER.pivot, alphaBounds: boundsManifest(inspected.bounds), image: inspected.image,
      };
    } catch (error) { invalid.push({ file: repoPath(masterPath), error: error.message }); }
  }
  for (const part of BOILERPLATE_PARTS) {
    const path = installedBoilerplatePath(part.id);
    if (!existsSync(path)) continue;
    try {
      const inspected = await inspectInstalled(path, [part.pivot]);
      installedPaths.add(repoPath(path));
      boilerplateParts.push({
        id: part.id,
        texture: `${part.id}.png`,
        installedFile: repoPath(path),
        parent: part.parent,
        receiver: part.receiver,
        pivotSource: part.pivot,
        pivotTrimmed: part.pivot,
        receiverAnchor: part.receiver === "body"
          ? { frame: FRAME_ID, socket: "body", xL: 0, yL: 0, raw: BODY_ROOT_SOURCE }
          : receiver(part.receiver),
        restAngle: 0,
        mountScale: 1,
        plane: Z_ORDER.find((plane) => plane.id === part.planeId)?.plane ?? 0,
        alphaBounds: boundsManifest(inspected.bounds),
        image: inspected.image,
      });
    } catch (error) { invalid.push({ file: repoPath(path), error: error.message }); }
  }

  const slotRows = [];
  let installedItemCount = 0;
  let installedPartCount = 0;
  for (const spec of SLOT_SPECS) {
    const rows = [];
    for (const item of ITEMS.filter((candidate) => candidate.slot === spec.id)) {
      const path = installedItemPath(item);
      if (!existsSync(path)) continue;
      try {
        const inspected = await inspectInstalled(path, spec.sourcePivots, componentRegionsForSpec(spec), spec.id === "hat");
        installedPaths.add(repoPath(path));
        installedItemCount++;
        installedPartCount += spec.componentIds.length;
        const identityReferences = [
          resolve(PORTRAITS, `${item.sourceCharacterId}.jpg`),
          resolve(SPRITES, item.sourceCharacterId, "body.png"),
          installedBoilerplatePath("identity-master"),
        ].map(repoPath);
        rows.push({
          id: item.id,
          name: item.name,
          setId: item.setId,
          setName: item.setName,
          rarity: item.rarity,
          slot: item.slot,
          slotDirectory: item.slotDirectory,
          sourceCharacterId: item.sourceCharacterId,
          sourceCharacterName: item.sourceCharacterName,
          identityReferences,
          texture: `${item.id}.png`,
          installedFile: repoPath(path),
          renderLog: repoPath(codexLogPath("gear", spec.directory, item.id)),
          alphaBounds: boundsManifest(inspected.bounds),
          image: inspected.image,
          parts: spec.componentIds.map((id, index) => ({
            id,
            parent: receiver(spec.receivers[index]).parent,
            receiver: spec.receivers[index],
            pivotSource: spec.sourcePivots[index],
            pivotTrimmed: spec.sourcePivots[index],
            receiverAnchor: receiver(spec.receivers[index]),
            restAngle: 0,
            mountScale: 1,
            plane: Z_ORDER.find((plane) => plane.id === spec.planeIds[index])?.plane ?? 0,
            spring: spec.id === "hat" ? { preset: "hat-jiggle", hz: 5.2, dampingRatio: 0.58, maxDeg: 9, dragGain: 0.70 } : null,
            alphaBounds: boundsManifest(inspected.parts[index].bounds),
            pivotAlpha: inspected.parts[index].pivotAlpha,
          })),
          stackBandVerification: inspected.stackBandVerification,
        });
      } catch (error) { invalid.push({ file: repoPath(path), error: error.message }); }
    }
    slotRows.push({
      id: spec.id,
      directory: spec.directory,
      shardCommand: `node tools/artkit/gen-gear.mjs --slot=${spec.directory}`,
      receivers: spec.receivers,
      componentIds: spec.componentIds,
      expectedItemCount: 12,
      installedItemCount: rows.length,
      expectedPartCount: 12 * spec.componentIds.length,
      installedPartCount: rows.length * spec.componentIds.length,
      items: rows,
    });
  }
  const expectedGear = new Set(ITEMS.map((item) => repoPath(installedItemPath(item))));
  const actualGear = new Set(listPngs(GEAR_DST).map(repoPath));
  const missing = [...expectedGear].filter((path) => !installedPaths.has(path)).sort();
  const extras = [...actualGear].filter((path) => !expectedGear.has(path)).sort();
  const socketReference = installedBoilerplatePath("socket-reference");
  const manifest = {
    schemaVersion: 1,
    generator: "tools/artkit/gen-gear.mjs",
    contentSource: "docs/metagame-panel/gear-systems.md#6-launch-content-12-sets--8-slots",
    renderContractSource: "docs/metagame-panel/gear-tech.md#6-rendering-and-the-art-program-contract",
    socketFrame: {
      id: FRAME_ID,
      canvas: CANVAS,
      bodyRootSource: BODY_ROOT_SOURCE,
      bodyHeightL: BODY_HEIGHT_L,
      coordinateUnits: { source: "untrimmed 1024x1024 pixels", receiver: "boilerplate body heights L" },
      origin: "boilerplate body centroid",
      facing: "semantic right; SpriteRig owns mirroring",
      receivers: RECEIVERS,
      connectorTolerance: CONNECTOR_TOLERANCE,
      hiddenConnectorOverlapPercent: [8, 12],
      hatStackBand: HAT_STACK_BAND,
    },
    outlinePass: {
      ...OUTLINE,
      radiusRule: "radiusPx=max(1,round(baseWidth*max(canvasWidth,canvasHeight)/referenceCanvas))",
      installedRadius: 8,
      law: "original nonzero-alpha pixels retained; #101014 rim written only into circularly dilated transparent pixels",
    },
    zOrder: Z_ORDER,
    boilerplate: {
      expectedPartCount: BOILERPLATE_PARTS.length,
      installedPartCount: boilerplateParts.length,
      master: boilerplateMaster,
      parts: boilerplateParts,
      socketReference: existsSync(socketReference) ? { installedFile: repoPath(socketReference), sha256: sha256(socketReference) } : null,
      missing: BOILERPLATE_PARTS.map((part) => installedBoilerplatePath(part.id)).filter((path) => !existsSync(path)).map(repoPath),
    },
    expectedItemCount: ITEMS.length,
    installedItemCount,
    expectedPartCount: SLOT_SPECS.reduce((sum, spec) => sum + 12 * spec.componentIds.length, 0),
    installedPartCount,
    slots: slotRows,
    missing,
    extras,
    invalid,
  };
  return manifest;
}

async function emitManifest() {
  const release = acquireLock("manifest");
  try {
    const manifest = await buildManifest();
    atomicJson(MANIFEST_PATH, manifest);
    console.log(`MANIFEST ${repoPath(MANIFEST_PATH)} items=${manifest.installedItemCount}/${manifest.expectedItemCount} parts=${manifest.installedPartCount}/${manifest.expectedPartCount} missing=${manifest.missing.length} extras=${manifest.extras.length} invalid=${manifest.invalid.length}`);
    return manifest;
  } finally {
    release();
  }
}

const options = parseOptions(process.argv.slice(2));
const releases = [];
const requestedSpecs = options.stage === "gear"
  ? (options.slot ? SLOT_SPECS.filter((spec) => spec.id === options.slot) : SLOT_SPECS)
  : options.stage === "all" ? SLOT_SPECS : [];
if (!options.validateOnly) {
  if (options.stage === "boilerplate" || options.stage === "all") releases.push(acquireLock("boilerplate"));
  for (const spec of requestedSpecs) releases.push(acquireLock(`slot-${spec.directory}`));
}

let failures = 0;
try {
  console.log(`GEAR ART RUN stage=${options.stage} slots=${requestedSpecs.map((spec) => spec.directory).join(",") || "none"} force=${options.force} validateOnly=${options.validateOnly}`);
  if (options.stage === "boilerplate" || options.stage === "all") failures += await runBoilerplate(options);
  for (const spec of requestedSpecs) failures += await runSlot(options, spec);
  const manifest = await emitManifest();
  if (manifest.extras.length > 0 || manifest.invalid.length > 0) failures++;
  if (manifest.slots.find((slot) => slot.id === "hat")?.installedItemCount === 12) {
    try {
      const sheet = await emitHatContactSheet();
      if (sheet) console.log(`HAT CONTACT SHEET ${repoPath(sheet)}`);
    } catch (error) {
      console.log(`HAT CONTACT SHEET FAIL: ${error.message}`);
      failures++;
    }
  }
  console.log(failures ? `DONE with ${failures} failure(s); rerun the same shard command to resume` : "DONE selected renders installed and manifest verified");
} finally {
  for (const release of releases.reverse()) release();
}
if (failures > 0) process.exitCode = 1;
