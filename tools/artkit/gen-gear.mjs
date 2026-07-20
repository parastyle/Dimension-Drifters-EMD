import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";
import { readGearCatalog } from "./lib/gear-catalog.mjs";
import {
  COMPOSITION_ORDERS,
  FACE_ENVELOPES,
  MIGRATION_EXPECTED,
  PART_FRAMES,
  REPLACEMENT_CONTRACT_ID,
  VALIDATION_THRESHOLDS,
  assertMigrationPlan,
  buildMigrationPlan,
  describeMask,
  dilateMask,
  erodeMask,
  hashJson,
  hashRgbaCrop,
  maskFromAlpha,
  renderRoleForItem,
  renderVariantsForItem,
  rgbaAlpha,
  scrubSmallAlphaComponents,
  validateFullReplacement,
  validateHatReadability,
  validateHeadAccessory,
  validatePairedReplacements,
  validateReplacementHeadSockets,
  validateTorsoReplacement,
} from "./lib/gear-replacement-contract.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const OUT = resolve(HERE, "out/gear");
const MASTERS = resolve(OUT, "masters");
const LOGS = resolve(OUT, "logs");
const LOCKS = resolve(OUT, "locks");
const MANIFEST_PATH = resolve(OUT, "gear-parts-manifest.json");
const REUSE_VERDICTS_PATH = resolve(OUT, "torso-head-reuse-verdicts.json");
const FLEET_STATE_PATH = resolve(OUT, "torso-head-fleet-state.json");
const SYSTEMS_DOC = resolve(REPO, "docs/metagame-panel/gear-systems.md");
const GEAR_CATALOG_SOURCE = resolve(REPO, "packages/shared/src/gear.ts");
const CONCEPTS_FILE = resolve(HERE, "subjects.concepts.json");
const SPRITES = resolve(REPO, "packages/client/public/sprites");
const BOILERPLATE_DST = resolve(SPRITES, "boilerplate");
const GEAR_DST = resolve(SPRITES, "gear");
const ART_INSTALL = resolve(OUT, "installed");
const PORTRAITS = resolve(REPO, "packages/client/public/ui/portraits");

const CANVAS = Object.freeze({ width: 1024, height: 1024 });
const BODY_ROOT_SOURCE = Object.freeze({ x: 512, y: 512 });
const BODY_HEIGHT_L = 512;
const FRAME_ID = "GEAR_SOCKET_FRAME_V1";
const STACK_BAND_ID = "HAT_STACK_BAND_V1";
const OUTLINE = Object.freeze({ color: "#101014", rgba: [0x10, 0x10, 0x14, 0xff], baseWidth: 4, referenceCanvas: 512 });
// Display-only fit correction. Keep this out of loadReplacementContext() so changing the mounted
// head size never changes the replacement contract revision or causes an art rerender.
const HEAD_MOUNT_SCALE = 0.85;
const CONNECTOR_TOLERANCE = Object.freeze({ pixels: 4, degrees: 2 });
const PROPORTION_LAW = Object.freeze({
  // OWNER FIT-CHECK CORRECTION 2026-07-18: the measured legacy 0.58-0.62 W:H is the ratio of a
  // WHOLE legacy bean (head fused in). Applying it to the torso ALONE stretched the body into a
  // tall pill. The torso-only ratio must be squat so head+torso ASSEMBLED lands back on the
  // legacy bean shape: with the head zone at ~0.36-0.39 of assembled height, torso-only W:H is
  // roughly (assembled W:H) / (1 - headZone) ≈ 0.92-1.00 — a compact squat capsule.
  torsoWidthHeight: "0.92-1.00",
  assembledWidthHeight: "0.58-0.62",
  shoulderHipWidth: "0.95-1.05",
  headTorsoWidth: "0.82-0.90",
  headZoneShare: "0.36-0.39",
});

let reuseVerdicts = {
  schemaVersion: 1,
  contractId: REPLACEMENT_CONTRACT_ID,
  evaluatedAt: null,
  items: {},
};
if (existsSync(REUSE_VERDICTS_PATH)) {
  try {
    const prior = JSON.parse(readFileSync(REUSE_VERDICTS_PATH, "utf8"));
    if (prior.contractId === REPLACEMENT_CONTRACT_ID) reuseVerdicts = prior;
  } catch {}
}

mkdirSync(MASTERS, { recursive: true });
mkdirSync(LOGS, { recursive: true });
mkdirSync(LOCKS, { recursive: true });
mkdirSync(ART_INSTALL, { recursive: true });

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

function mountScaleForPart(componentId, receiverId) {
  return componentId === "head" || receiverId === "head" ? HEAD_MOUNT_SCALE : 1;
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
  { id: "torso", xL: 0, yL: -0.04, parent: "body", parentTransform: "final body card", plane: "torso" },
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
  { plane: -40, id: "bakedFeet", law: "two retained baked foot sprites" },
  { plane: -30, id: "behindBody", law: "far held weapon sentinel" },
  { plane: -20, id: "bakedBackHand", law: "retained baked back hand with existing weapon ordering" },
  { plane: 0, id: "bakedBody", law: "winning complete torso replacement" },
  { plane: 10, id: "bakedHead", law: "winning head + facialHair + glasses RenderTexture" },
  { plane: 20, id: "hat", law: "legal overlay-hat spring-chain segments" },
  { plane: 30, id: "frontWeapon", law: "normal held weapon below its owning front hand" },
  { plane: 40, id: "bakedFrontHand", law: "retained baked front hand with existing weapon ordering" },
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
    id: "head", directory: "heads", docHeader: null, receivers: ["head"], componentIds: ["head"],
    sourcePivots: [PART_FRAMES.head.pivotSource], desiredAnchor: [PART_FRAMES.head.outputOrigin.x, PART_FRAMES.head.outputOrigin.y],
    maxPartBox: { width: PART_FRAMES.head.crop[2], height: PART_FRAMES.head.crop[3] }, planeIds: ["bakedHead"],
    artDirection: "ONE complete replacement head in the set identity ON the attached base head silhouette; full floating neckless head, profile view, one visible side, house style, chroma green",
    profileLaw: "REPLACEMENT HEAD: one complete screen-right floating head replacement with one final exterior contour. Cover the default head core, remain neckless, preserve the canonical eyes/mouth accessory stocks and hat mount, and contain no separate boilerplate head, body, shoulders, topper, or mask-over-head double silhouette.",
  },
  {
    id: "torso", directory: "torso", docHeader: null, receivers: ["torso"], componentIds: ["torso"],
    sourcePivots: [PART_FRAMES.body.pivotSource], desiredAnchor: [PART_FRAMES.body.outputOrigin.x, PART_FRAMES.body.outputOrigin.y],
    maxPartBox: { width: PART_FRAMES.body.crop[2], height: PART_FRAMES.body.crop[3] }, planeIds: ["bakedBody"],
    artDirection: "ONE complete dressed torso card in the set identity ON the attached base torso silhouette — the full garment from collar to hem covering the whole card; the lower region wears the set's legwear look; profile view, one visible side; house style; chroma green",
    profileLaw: "One connected screen-right dressed torso card from collar through hem, conforming to the attached base torso silhouette; no head, neck, arms, hands, feet, or cloak.",
  },
  {
    id: "boots", directory: "boots", docHeader: "Boots", receivers: ["foot-l", "foot-r"], componentIds: ["boot-l", "boot-r"],
    sourcePivots: [PART_FRAMES["foot-l"].pivotSource, PART_FRAMES["foot-r"].pivotSource], maxPartBox: { width: 190, height: 190 }, planeIds: ["bakedFeet", "bakedFeet"],
    artDirection: "a matched far/near rig pair of boots or footwear, two separated complete paper islands; each island is one screen-right profile blob-cover fitted to one detached foot, with no toes, heel, sole perspective, or frontal shoe construction",
    profileLaw: "BOOTS: each piece is a single screen-right profile cover for one soft foot-blob. Preserve the foot's rounded lump silhouette; no toes, heel block, frontal pair view, or anatomical foot. The two islands are the far/near rig pieces, not opposite-facing shoes.",
  },
  {
    id: "gloves", directory: "gloves", docHeader: "Gloves", receivers: ["hand-l", "hand-r"], componentIds: ["glove-l", "glove-r"],
    sourcePivots: [PART_FRAMES["hand-l"].pivotSource, PART_FRAMES["hand-r"].pivotSource], maxPartBox: { width: 180, height: 180 }, planeIds: ["bakedBackHand", "bakedFrontHand"],
    artDirection: "a matched far/near rig pair of gloves, gauntlets, or wraps, two separated complete paper islands; each island is one screen-right profile blob-cover fitted to one detached hand, with no fingers, thumb, palm, or frontal glove construction",
    profileLaw: "GLOVES: each piece is a single screen-right profile cover for one soft hand-blob. Preserve the rounded lump silhouette; no fingers, thumb, palm anatomy, or frontal glove display. The two islands are the far/near rig pieces, not opposite-facing gloves.",
  },
  {
    id: "cloak", directory: "cloak", docHeader: "Cloak", receivers: ["back"], componentIds: ["far-cloth"],
    sourcePivots: [{ x: 451, y: 492 }], desiredAnchor: [0.62, 0.24], maxPartBox: { width: 480, height: 540 }, planeIds: ["cloakFar"],
    artDirection: "one isolated visible-side profile cloth panel for a cloak, mantle, vestment, coat-tail, robe, or apron; show only the single side worn in profile, not a complete back or open-front garment",
    profileLaw: "CLOAK/OUTER GARMENT: render ONLY the one visible-side profile panel as worn. Collar/mantle edge, clasp edge, drape, and hem read from the side. No open-front interior, both lapels, symmetric front, second side, or back-of-garment; no body, arms, hands, held prop, or VFX.",
  },
  {
    id: "glasses", directory: "glasses", docHeader: "Glasses", receivers: ["face.eyes"], componentIds: ["eyes"],
    sourcePivots: [{ x: 553, y: 364 }], desiredAnchor: [0.5, 0.5], maxPartBox: { width: 248, height: 128 }, planeIds: ["bakedHead"],
    artDirection: "one isolated screen-right profile eyewear cutout consisting of the temple arm plus exactly one visible lens/frame; never two frontal lenses",
    profileLaw: "GLASSES: strict screen-right profile: one visible lens/frame plus its temple arm following the side of the head. Never two lenses, a frontal bridge, goggles seen head-on, or a symmetric eyewear display; no face, head, emitted glow, reticle, telegraph, or text.",
  },
  {
    id: "facialHair", directory: "facial-hair", docHeader: "Facial hair", receivers: ["face.mouth"], componentIds: ["mouth"],
    sourcePivots: [{ x: 568, y: 410 }], desiredAnchor: [0.5, 0.38], maxPartBox: { width: 248, height: 198 }, planeIds: ["bakedHead"],
    artDirection: "one isolated screen-right profile lower-face attachment fitted to the floating head's visible cheek/jaw zone (hair, cord, tusks, mask detail, or digital stubble as named)",
    profileLaw: "FACIAL HAIR: one screen-right profile attachment following the floating head's visible cheek and jaw. Show only the near-side silhouette/tuft/tusk/cord; no mirrored second cheek, frontal moustache spread, face, head, text, particles, or glow.",
  },
  {
    id: "hat", directory: "hats", docHeader: "Hat", receivers: ["head"], componentIds: ["hat"],
    sourcePivots: [HAT_STACK_BAND.sourcePivot], desiredAnchor: [0.5, 0.82], maxPartBox: { width: 560, height: 340 }, planeIds: ["hat"],
    artDirection: "one signature isolated screen-right profile hat/headwear segment whose crown and brim direction read unmistakably left/right, also functioning as one stable segment in a tall comic prestige hat stack",
    profileLaw: "HAT: strict screen-right profile fitted to the large floating head; crown, band, brim, veil, or mask extension must have a side-view left/right read. No frontal brim ellipse, symmetric face-on crown, rear view, full head, or second side.",
  },
];

const SLOT_ALIASES = new Map([
  ["head", "head"], ["heads", "head"],
  ["torso", "torso"], ["torsos", "torso"],
  ["boots", "boots"], ["boot", "boots"],
  ["gloves", "gloves"], ["glove", "gloves"],
  ["shirt", "torso"], ["shirts", "torso"],
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

function parseLaunchArtDescriptions() {
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
        legacyArtId: slug(name),
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
  const ids = new Set(items.map((item) => item.legacyArtId));
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

const CATALOG_ONLY_ART_DESCRIPTIONS = new Map([
  ["mended-workshirt", "a practical patched canvas workshirt with visible mending and a modest reinforced collar"],
  ["reinforced-workshirt", "a sturdy canvas workshirt with doubled seams, reinforced shoulders, and durable work patches"],
  ["shopkeeps-sunday-best", "a polished Trading Post workshirt with tidy brass fasteners and best-cloth reinforced panels"],
  ["brass-readers", "simple side-profile brass reading glasses with a plain round lens and practical temple arm"],
  ["lucky-readers", "brass reading glasses upgraded with a small lucky-notch motif and a brighter finished frame"],
  ["loaded-readers", "premium heavy brass readers with three restrained luck marks and a richly finished frame"],
  ["work-gloves", "plain sturdy canvas work gloves with a leather palm patch and practical cuff"],
  ["knuckled-gloves", "reinforced work gloves with a compact padded knuckle band and doubled leather cuff"],
  ["ironhand-gloves", "heavy iron-reinforced work gloves with blunt riveted knuckle plates and a strong leather cuff"],
]);

function catalogItems() {
  const catalog = readGearCatalog(GEAR_CATALOG_SOURCE);
  const blankRows = catalog.filter((item) => item.id.startsWith("blank-drifter-"));
  const blankSlots = new Set(blankRows.map((item) => item.slot));
  if (blankRows.length !== SLOT_SPECS.length || blankSlots.size !== SLOT_SPECS.length) {
    throw new Error("Blank Drifter art rule drift: expected exactly one intentionally artless default per slot");
  }

  const launchArt = parseLaunchArtDescriptions();
  const launchBySetSlot = new Map(launchArt.map((item) => [`${item.setId}/${item.slot}`, item]));
  const concepts = loadConcepts();
  const items = [];
  for (const catalogItem of catalog) {
    // The blank Drifter pieces mean "wearing nothing" and intentionally have no wearable PNG.
    if (catalogItem.id.startsWith("blank-drifter-")) continue;
    const spec = SLOT_SPECS.find((candidate) => candidate.id === catalogItem.slot);
    if (!spec) throw new Error(`Catalog item ${catalogItem.id} has unsupported art slot ${catalogItem.slot}`);

    const launch = launchBySetSlot.get(`${catalogItem.setId}/${catalogItem.slot}`);
    if (launch) {
      if (launch.name !== catalogItem.name || launch.rarity !== catalogItem.rarity) {
        throw new Error(
          `Launch art metadata drift for ${catalogItem.id}: doc has ${launch.name} (${launch.rarity}), catalog has ${catalogItem.name} (${catalogItem.rarity})`,
        );
      }
      const concept = concepts.get(launch.sourceCharacterId);
      if (!concept) throw new Error(`No concept identity found for ${launch.sourceCharacterId}`);
      items.push({
        ...catalogItem,
        legacyArtId: launch.legacyArtId,
        artDescription: launch.effect,
        setName: launch.setName,
        slotDirectory: spec.directory,
        sourceCharacterId: launch.sourceCharacterId,
        sourceCharacterName: concept.name,
        identityBrief: concept.prompt,
        expectedReferenceCount: 3,
      });
      launchBySetSlot.delete(`${catalogItem.setId}/${catalogItem.slot}`);
      continue;
    }

    const artDescription = CATALOG_ONLY_ART_DESCRIPTIONS.get(catalogItem.id);
    if (!artDescription) throw new Error(`Catalog item ${catalogItem.id} needs an honest art description`);
    items.push({
      ...catalogItem,
      legacyArtId: null,
      artDescription,
      setName: "Trading Post starter gear",
      slotDirectory: spec.directory,
      sourceCharacterId: null,
      sourceCharacterName: "the Trading Post starter line",
      identityBrief: artDescription,
      expectedReferenceCount: 1,
    });
  }
  if (launchBySetSlot.size > 0) {
    throw new Error(`Launch art rows lack catalog counterparts: ${[...launchBySetSlot.keys()].join(", ")}`);
  }
  if (CATALOG_ONLY_ART_DESCRIPTIONS.size !== items.filter((item) => !item.legacyArtId).length) {
    throw new Error("Catalog-only art descriptions contain an unknown or duplicate catalog id");
  }
  return items;
}

function parseLaunchPairDescriptions() {
  const text = readFileSync(SYSTEMS_DOC, "utf8");
  const start = text.indexOf("| Set | Boots | Gloves | Shirt | Pants | Cloak | Glasses | Facial hair | Hat |");
  const end = text.indexOf("\n### Full-set bonuses", start);
  if (start < 0 || end < 0) throw new Error("Could not locate the 12x8 launch content table in gear-systems.md");
  const concepts = loadConcepts();
  const lines = text.slice(start, end).split(/\r?\n/).filter((line) => line.startsWith("|"));
  const headers = lines[0].slice(1, -1).split("|").map((cell) => cell.trim());
  const slotHeaders = new Map([
    ["boots", "Boots"], ["gloves", "Gloves"], ["shirt", "Shirt"], ["pants", "Pants"],
    ["cloak", "Cloak"], ["glasses", "Glasses"], ["facialHair", "Facial hair"], ["hat", "Hat"],
  ]);
  const sets = new Map();
  for (const line of lines.slice(2)) {
    const cells = line.slice(1, -1).split("|").map((cell) => cell.trim());
    const setName = cells[0];
    const setId = slug(setName);
    const sourceCharacterId = SET_SOURCES.get(setName);
    const concept = loadConcepts().get(sourceCharacterId);
    if (!sourceCharacterId || !concept) throw new Error(`No identity source mapped for launch set ${setName}`);
    const slots = {};
    for (const [slot, header] of slotHeaders) {
      const cell = cells[headers.indexOf(header)];
      const parsed = cell?.match(/^(.*?)\s+\(([^)]+)\)\s+.+?\s+(.*)$/u);
      if (!parsed) throw new Error(`Could not parse ${setName}/${header}: ${cell}`);
      slots[slot] = { legacyArtId: slug(parsed[1]), name: parsed[1].trim(), rarity: parsed[2].trim(), effect: parsed[3].trim() };
    }
    sets.set(setId, {
      setId,
      setName,
      sourceCharacterId,
      sourceCharacterName: concept.name,
      identityBrief: concept.prompt,
      slots,
      torso: {
        ...slots.shirt,
        effect: `Upper garment identity: ${slots.shirt.name} — ${slots.shirt.effect}. Lower region legwear identity: ${slots.pants.name} — ${slots.pants.effect}.`,
      },
      head: {
        legacyArtId: null,
        name: `${setName} Head`,
        rarity: slots.hat.rarity,
        effect: `A complete replacement head translating ${concept.name}'s defining face, mask, helmet, hair, materials, palette, and motifs into the canonical floating-head silhouette.`,
      },
    });
  }
  if (sets.size !== MIGRATION_EXPECTED.setPairs) throw new Error(`Launch table contract drift: expected 12 sets, found ${sets.size}`);
  return sets;
}

let CATALOG_STATE = null;

function pairCatalogItems() {
  const catalog = readGearCatalog(GEAR_CATALOG_SOURCE);
  const launchSets = parseLaunchPairDescriptions();
  const catalogSlots = new Set(catalog.map((item) => item.slot));
  const pairCatalogLanded = catalogSlots.has("torso") && catalogSlots.has("head") && !catalogSlots.has("pants");
  let projectedHeadRows = [];
  let activeCatalog;
  if (pairCatalogLanded) {
    activeCatalog = catalog
      .filter((item) => !item.id.startsWith("blank-drifter-") && item.slot !== "pants")
      .filter((item) => item.slot !== "torso" || launchSets.has(item.setId));
  } else {
    const legacyLaunch = catalog
      .filter((item) => !item.id.startsWith("blank-drifter-") && item.slot !== "pants")
      .filter((item) => item.slot !== "shirt" || launchSets.has(item.setId))
      .map((item) => item.slot === "shirt" ? { ...item, slot: "torso" } : item);
    projectedHeadRows = [...launchSets.values()].map((set) => ({
      id: `${set.setId}-head`,
      name: set.head.name,
      slot: "head",
      rarity: set.head.rarity,
      effect: set.head.effect,
      setId: set.setId,
      originPool: null,
      catalogProjection: true,
    }));
    activeCatalog = [...legacyLaunch, ...projectedHeadRows];
  }
  CATALOG_STATE = Object.freeze({
    pairCatalogLanded,
    mode: pairCatalogLanded ? "catalog-v2" : "pending-parallel-catalog-projection",
    projectedHeadIds: projectedHeadRows.map((item) => item.id),
    retiredCatalogRowsIgnored: catalog.filter((item) => item.slot === "pants").map((item) => item.id),
    retiredStarterShirtsIgnored: catalog.filter((item) => item.slot === "shirt" && !launchSets.has(item.setId)).map((item) => item.id),
    nonPairTorsoRowsIgnored: catalog.filter((item) => item.slot === "torso" && !item.id.startsWith("blank-drifter-") && !launchSets.has(item.setId)).map((item) => item.id),
  });

  const items = [];
  for (const catalogItem of activeCatalog) {
    const spec = SLOT_SPECS.find((candidate) => candidate.id === catalogItem.slot);
    if (!spec) throw new Error(`Catalog item ${catalogItem.id} has unsupported art slot ${catalogItem.slot}`);
    const set = launchSets.get(catalogItem.setId);
    const launch = catalogItem.slot === "torso"
      ? set?.torso
      : catalogItem.slot === "head"
        ? set?.head
        : set?.slots[catalogItem.slot];
    if (launch) {
      items.push({
        ...catalogItem,
        legacyArtId: launch.legacyArtId,
        artDescription: launch.effect,
        setName: set.setName,
        slotDirectory: spec.directory,
        sourceCharacterId: set.sourceCharacterId,
        sourceCharacterName: set.sourceCharacterName,
        identityBrief: set.identityBrief,
        expectedReferenceCount: 3,
      });
      continue;
    }
    const artDescription = CATALOG_ONLY_ART_DESCRIPTIONS.get(catalogItem.id);
    if (!artDescription) throw new Error(`Catalog item ${catalogItem.id} needs an honest art description`);
    items.push({
      ...catalogItem,
      legacyArtId: null,
      artDescription,
      setName: "Trading Post starter gear",
      slotDirectory: spec.directory,
      sourceCharacterId: null,
      sourceCharacterName: "the Trading Post starter line",
      identityBrief: artDescription,
      expectedReferenceCount: 1,
    });
  }
  return items;
}

const ITEMS = pairCatalogItems();
const MIGRATION_PLAN = assertMigrationPlan(buildMigrationPlan(ITEMS));

function specForVariant(item, variant) {
  return SLOT_SPECS.find((candidate) => candidate.id === item.slot);
}

function renderJobsForItem(item) {
  return renderVariantsForItem(item).map((variant) => ({
    item,
    ...variant,
    spec: specForVariant(item, variant),
    key: `${variant.directory}/${item.id}`,
  }));
}

const RENDER_JOBS = ITEMS.flatMap(renderJobsForItem);
const CREATIVE_RENDER_JOBS = RENDER_JOBS.filter((job) => job.creativeRender);

const BOILERPLATE_PARTS = [
  {
    // OWNER RULING 2026-07-18 (stitch-seam identity): torso capsule ONLY — no legs, no head; the head is
    // a fully floating neckless part (Madness bob law; enables helmet alternative-heads); hands and
    // feet are the SAME near-featureless soft blob language (no thumb, no wedge/heel/toe).
    id: "body", parent: null, receiver: "body", pivot: BODY_ROOT_SOURCE, desiredAnchor: [0.5, 0.5],
    maxPartBox: { width: 320, height: 500 }, planeId: "bakedBody",
    description: `ONLY the oatmeal-canvas stitch-seam TORSO: a compact SQUAT capsule, nearly as wide as tall, alpha-bounds width:height ${PROPORTION_LAW.torsoWidthHeight}, with flat-to-gently-curved sides, shoulder:hip width ${PROPORTION_LAW.shoulderHipWidth}, and only a subtle lower taper. Absolutely NO pear shape, pot belly, belly/hip flare, waist bulge, legs, pelvis taper into limbs, head, or neck. Carry one vertical charcoal stitch seam up the midline and one small darker-weave shoulder patch; no hands, feet, clothing, hair, gear, or shadow`,
  },
  {
    id: "head", parent: "body", receiver: "head", pivot: { x: 512, y: 300 }, desiredAnchor: [0.5, 0.55],
    maxPartBox: { width: 285, height: 260 }, planeId: "bakedHead",
    description: `ONLY the LARGE FLOATING blank egg head with NO neck, connector tab, or shoulder hint and a clean closed oval bottom edge. Match head width to ${PROPORTION_LAW.headTorsoWidth} of the approved slim torso width and preserve a ${PROPORTION_LAW.headZoneShare} head-zone share in the assembled head+torso silhouette. Carry one small charcoal cross-stitch X where a face would be; no torso, hair, hat, ears, eyewear, facial hair, or shadow`,
  },
  {
    id: "hand-l", parent: "hand-l", receiver: "hand-l", pivot: { x: 384, y: 522 }, desiredAnchor: [0.5, 0.5],
    maxPartBox: { width: 120, height: 100 }, planeId: "bakedBackHand",
    description: "ONLY the back/left detached soft blob hand — a near-featureless rounded canvas lump with NO thumb lobe or finger reads; no arm, glove, weapon, or shadow",
  },
  {
    id: "hand-r", parent: "hand-r", receiver: "hand-r", pivot: { x: 640, y: 522 }, desiredAnchor: [0.5, 0.5],
    maxPartBox: { width: 120, height: 100 }, planeId: "bakedFrontHand",
    description: "ONLY the front/right detached soft blob hand — a near-featureless rounded canvas lump with NO thumb lobe or finger reads; no arm, glove, weapon, or shadow",
  },
  {
    id: "foot-l", parent: "foot-l", receiver: "foot-l", pivot: { x: 448, y: 736 }, desiredAnchor: [0.5, 0.5],
    maxPartBox: { width: 145, height: 105 }, planeId: "bakedFeet",
    description: "ONLY the back/left detached soft blob foot — the SAME near-featureless rounded canvas lump language as the hands, NO wedge, heel, or toe shape; no leg, boot, ground, or shadow",
  },
  {
    id: "foot-r", parent: "foot-r", receiver: "foot-r", pivot: { x: 576, y: 736 }, desiredAnchor: [0.5, 0.5],
    maxPartBox: { width: 145, height: 105 }, planeId: "bakedFeet",
    description: "ONLY the front/right detached soft blob foot — the SAME near-featureless rounded canvas lump language as the hands, NO wedge, heel, or toe shape; no leg, boot, ground, or shadow",
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
    reuseOnly: false,
    syncClient: false,
    finalizeFleet: false,
    maxJobs: Number.POSITIVE_INFINITY,
    maxAttempts: 3,
  };
  for (const arg of argv) {
    if (arg === "--force") options.force = true;
    else if (arg === "--validate-only") options.validateOnly = true;
    else if (arg === "--reuse-only") options.reuseOnly = true;
    else if (arg === "--sync-client") { options.syncClient = true; options.reuseOnly = true; }
    else if (arg === "--finalize-fleet") options.finalizeFleet = true;
    else if (arg === "--boilerplate") options.stage = "boilerplate";
    else if (arg.startsWith("--stage=")) options.stage = arg.slice(8);
    else if (arg.startsWith("--slot=")) options.slot = arg.slice(7);
    else if (arg.startsWith("--only=")) options.only = arg.slice(7);
    else if (arg.startsWith("--max-jobs=")) options.maxJobs = Number(arg.slice(11));
    else if (arg.startsWith("--max-attempts=")) options.maxAttempts = Number(arg.slice(15));
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node tools/artkit/gen-gear.mjs --stage=boilerplate | --slot=<heads|torso|boots|gloves|cloak|glasses|facial-hair|hats>");
      console.log("       add [--only=<item-id>] [--force] [--max-jobs=N] [--max-attempts=3], --reuse-only, --sync-client, --finalize-fleet, or --validate-only");
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
  if (!Number.isInteger(options.maxAttempts) || options.maxAttempts < 1 || options.maxAttempts > 3) {
    throw new Error(`--max-attempts must be an integer from 1 to 3`);
  }
  if (options.finalizeFleet && !options.reuseOnly) throw new Error("--finalize-fleet requires --reuse-only so it cannot launch image calls");
  if (options.syncClient && options.finalizeFleet) throw new Error("--sync-client cannot be combined with --finalize-fleet");
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

function rawRenderJobPath(job) {
  return resolve(MASTERS, job.directory, `${job.item.id}.png`);
}

function installedRenderJobPath(job) {
  const root = job.renderRole === "replace-torso" || job.renderRole === "replace-head" ? ART_INSTALL : GEAR_DST;
  return resolve(root, job.directory, `${job.item.id}.png`);
}

const clientSyncStats = { copied: 0, current: 0 };

function syncInstalledRenderJobToClient(job, source = installedRenderJobPath(job)) {
  const destination = resolve(GEAR_DST, job.item.slotDirectory, `${job.item.id}.png`);
  if (source === destination) return false;
  if (!existsSync(source)) return false;
  const sourceSha256 = sha256(source);
  if (existsSync(destination) && sha256(destination) === sourceSha256) {
    clientSyncStats.current++;
    return false;
  }
  mkdirSync(dirname(destination), { recursive: true });
  const next = `${destination}.${process.pid}.${Date.now()}.tmp.png`;
  copyFileSync(source, next);
  try {
    renameSync(next, destination);
  } catch {
    rmSync(destination, { force: true });
    renameSync(next, destination);
  }
  clientSyncStats.copied++;
  console.log(`CLIENT SYNC ${repoPath(destination)} sha256=${sourceSha256}`);
  return true;
}

function codexLogPath(_kind, directory, id) {
  return resolve(LOGS, directory, `${id}.codex.log`);
}

function statusLogPath(_kind, directory, id) {
  return resolve(LOGS, directory, `${id}.install.json`);
}

function renderJobLogPath(job, attempt = null) {
  return codexLogPath("gear", job.directory, attempt == null ? job.item.id : `${job.item.id}.attempt-${attempt}`);
}

function renderJobStatusPath(job) {
  return statusLogPath("gear", job.directory, job.item.id);
}

function legacyReferencesForItem(item) {
  const refs = item.sourceCharacterId
    ? [
        resolve(PORTRAITS, `${item.sourceCharacterId}.jpg`),
        resolve(SPRITES, item.sourceCharacterId, "body.png"),
        installedBoilerplatePath("identity-master"),
      ]
    : [installedBoilerplatePath("identity-master")];
  return refs.every(existsSync) ? refs : [];
}

function legacyItemReferenceBlock(item) {
  if (!item.sourceCharacterId) {
    return `REFERENCE IMAGE
- Image 1: approved blank boilerplate identity master. This is the BINDING invisible mannequin: use only its body/head scale, screen-right profile, and socket placement; do not paint any boilerplate pixels.`;
  }
  return `REFERENCE IMAGES — IDENTITY, NOT COMPOSITION
- Image 1: canonical portrait identity reference for ${item.sourceCharacterName}. Copy its specific costume design language, materials, palette, motifs, and especially the named item's recognizable construction.
- Image 2: canonical shipped body-sprite identity reference for the same character. Match its simplified paper-cutout contour, palette blocking, item identity, and screen-right profile construction; do not copy its whole-body anatomy or garment interior.
- Image 3: approved blank boilerplate identity master. This is the BINDING invisible mannequin: a compact squat capsule torso (${PROPORTION_LAW.torsoWidthHeight} W:H, shoulders and hips nearly equal, no belly flare) plus a large floating head (${PROPORTION_LAW.headTorsoWidth} of torso width). Use ONLY its new body/head scale, screen-right profile, and socket placement; do not paint any boilerplate pixels.`;
}

function baseReferenceIdsForRole(renderRole) {
  if (renderRole === "replace-torso") return ["body"];
  if (renderRole === "replace-hand") return ["hand-l", "hand-r"];
  if (renderRole === "replace-foot") return ["foot-l", "foot-r"];
  if (["head-accessory", "replace-head", "overlay-hat"].includes(renderRole)) return ["head"];
  return [];
}

// STRAGGLER SURGERY 2026-07-19: these themes repeatedly overruled the replacement layout with a
// handsome costume close-up or a conventional shoe. Give only those items a proven sibling whose
// geometry is binding; identity still comes from the item's portrait/body references and prose.
const STRAGGLER_LAYOUT_REFERENCES = new Map([
  ["thornwatch-boots", "ash-walker-boots"],
  ["unbending-boots", "ash-walker-boots"],
]);

const STRAGGLER_PROMPT_NUDGES = new Map([
  ["thornwatch-boots", "THE LAYOUT LAW OVERRIDES HERALDIC SHOE DESIGN. Each piece is a dense, solid, squat rounded foot-blob cover like the passing sibling, not a real shoe: no ankle opening, cuff hole, tall shaft, toe cap projection, heel, or sole. Paint green, silver, gold, and thorn motifs across that filled blob."],
  ["unbending-boots", "THE LAYOUT LAW OVERRIDES GREATHELM AND SABATON FLOURISH. Each piece is a dense, solid, squat rounded foot-blob cover like the passing sibling, never a tall greave or conventional boot: no ankle opening, shaft, toe box, heel, sole, or hollow armor construction."],
]);

function exactPivotCoverageLaw(spec) {
  return spec.sourcePivots
    .map((pivot) => `opaque material MUST cover canvas point (${pivot.x},${pivot.y})`)
    .join("; ");
}

function referenceBundleForJob(job) {
  const entries = [];
  const fullObjectBase = job.renderRole === "replace-torso" ? "body" : job.renderRole === "replace-head" ? "head" : null;
  if (fullObjectBase) entries.push({
    path: installedBoilerplatePath(fullObjectBase),
    description: `canonical untrimmed base ${fullObjectBase}.png in ${FRAME_ID}; this is the binding silhouette, source placement, pivot, and full-object fit target`,
  });
  if (job.item.sourceCharacterId) {
    entries.push({
      path: resolve(PORTRAITS, `${job.item.sourceCharacterId}.jpg`),
      description: `canonical portrait identity reference for ${job.item.sourceCharacterName}; preserve its item-specific materials, palette, motifs, and construction`,
    });
    entries.push({
      path: resolve(SPRITES, job.item.sourceCharacterId, "body.png"),
      description: "canonical shipped body-sprite identity reference; translate its set identity into the new rig without copying its whole-body anatomy",
    });
  }
  if (job.renderRole === "replace-foot" && STRAGGLER_LAYOUT_REFERENCES.has(job.item.id)) {
    const passingLayoutPath = resolve(MASTERS, job.directory, `${STRAGGLER_LAYOUT_REFERENCES.get(job.item.id)}.png`);
    if (existsSync(passingLayoutPath)) {
      entries.push({
        path: passingLayoutPath,
        description: "APPROVED PASSING REPLACE-FOOT TOPOLOGY EXAMPLE; copy only its two dense, solid, squat rounded blob silhouettes and separation, never its Ash-Walker colors, wraps, buckle, materials, or costume identity",
      });
    }
  }
  if (!fullObjectBase) {
    entries.push({
      path: installedBoilerplatePath("identity-master"),
      description: `approved blank identity master; preserve its ${PROPORTION_LAW.torsoWidthHeight} squat torso, large floating head, semantic-right profile, and socket placement without painting its pixels`,
    });
  }
  for (const id of fullObjectBase ? [] : baseReferenceIdsForRole(job.renderRole)) {
    entries.push({
      path: installedBoilerplatePath(id),
      description: `canonical untrimmed ${id}.png target card in ${FRAME_ID}; render on this exact source placement, scale, silhouette, and pivot while omitting its bare pixels from the output`,
    });
  }
  return { entries, paths: entries.every((entry) => existsSync(entry.path)) ? entries.map((entry) => entry.path) : [] };
}

function itemReferenceBlock(job, bundle) {
  const entries = bundle.entries.map((entry, index) => `- Image ${index + 1}: ${entry.description}.`).join("\n");
  return `REFERENCE IMAGES — IDENTITY AND EXACT-FRAME FIT
${entries}`;
}

function executionBlock() {
  return `EXECUTION PATH — BINDING
- Use the built-in image_gen tool for this raster render.
- The identity and exact-frame input images named below are already attached by the outer generator. Do not inspect the repository, list files, open paths, read more instructions beyond the required imagegen skill, or search for destinations.
- Call image_gen for the requested image and then END THE TURN IMMEDIATELY. The outer generator alone harvests, chroma-keys, registers, outlines, validates, and installs the PNG.
- Do not run shell commands, write or modify workspace files, copy images, crop, resize, reframe, post-process, validate pixels, or use Sharp, System.Drawing, Pillow/PIL, Python, JavaScript, SVG, or canvas.
- If image_gen is blocked, fails, or is unavailable, STOP WITHOUT CREATING A FILE. Do not substitute PowerShell/System.Drawing, Python/Pillow, SVG, HTML/canvas, procedural drawing code, a placeholder, or any other synthetic fallback. The outer generator must receive no PNG so it can record a clean resumable failure.`;
}

function chromaOutputBlock() {
  return `OUTPUT FORMAT — BINDING
- Exactly 1024x1024 PNG with a 1:1 SQUARE OUTER CANVAS regardless of any inner subject/card aspect ratio. Perfectly flat fully opaque uniform pure #00ff00 background for local chroma-key removal.
- No gradient, lighting variation, floor plane, contact/cast shadow, reflection, transparency, checkerboard, vignette, border, text, guide, watermark, UI, environment, aura, particles, or VFX.
- Never use #00ff00 or chroma-like lime in the art. Crisp opaque paper edges and generous uninterrupted green padding.`;
}

function houseStyleBlock() {
  return `HOUSE STYLE — NON-NEGOTIABLE
- Original HD 2D Flash-era paper-cutout arena art: bold compact silhouette, matte painted card stock, a few paper edge nicks, and a heavy slightly uneven near-black exterior contour.
- Strict side-profile construction with a slight high top-down pitch, semantic facing +X/screen-right, visual depth compression about 0.62; runtime mirrors the complete rig for screen-left. Never show a frontal, symmetric-front, or back view. Not isometric, pixel art, soft anime, photorealism, polished 3D toy, or vector-flat clipart.
- Flat cel shading only: base color plus ONE hard shadow band and AT MOST ONE hard highlight per material. No gradients, airbrush, ambient occlusion, bloom, rim light, or baked glow.
- About 5–7 decisive colors, few interior ink marks, no rarity halo, combat ring, telegraph red, parry-white flash, or extraction instruction color as a major silhouette feature.`;
}

function proportionLawBlock() {
  return `MADNESS PROPORTION LAW — MEASURED AND BINDING
- Torso painted alpha bounds must be width:height ${PROPORTION_LAW.torsoWidthHeight}: a compact SQUAT capsule (nearly as wide as tall — the assembled head+torso, not the torso alone, carries the classic ${PROPORTION_LAW.assembledWidthHeight} bean ratio).
- Shoulder width:hip width must stay ${PROPORTION_LAW.shoulderHipWidth}; use flat-to-gently-curved sides and only a subtle lower taper. NO pear silhouette, pot belly, belly room, hip flare, or bulbous lower half.
- Floating head width must be ${PROPORTION_LAW.headTorsoWidth} of torso width, and the visual head zone must occupy ${PROPORTION_LAW.headZoneShare} of assembled head+torso height. The head is large, close to torso width, and fully neckless.`;
}

function promptForBoilerplateMaster() {
  // OWNER RULING 2026-07-18: the approved identity is the STITCH-SEAM DUMMY concept, amended on two
  // fronts — (1) hands AND feet are nearly indistinguishable soft blobs (no thumb lobe, no wedge/foot
  // shape), (2) the head is a FULLY FLOATING object with NO neck (Madness law: the head bobs free;
  // helmets can later replace it as alternative heads).
  return `# CHAT ISOLATION — BOILERPLATE IDENTITY MASTER
Generate ONE standalone raster source image for Dimension Drifters. This establishes the immutable blank-slate character that all gear must fit.

${executionBlock()}

REFERENCE IMAGES
- Image 1: the OWNER-APPROVED stitch-seam identity concept. Match its burlap/canvas material, stitch language, palette, and charm exactly. It is a style reference; the rig layout below overrides its part layout.

Use case: stylized-concept
Asset type: game-ready blank character identity master
Primary request: an ORIGINAL stitch-seam training-dummy Drifter in the brutally simple readable silhouette language of early web combat cartoons, without copying any named character.
Subject: one assembled neutral Drifter built from exactly SIX fully detached floating pieces with clear green gaps between ALL of them — (a) one compact SQUAT oatmeal-canvas TORSO capsule (no head, no legs), nearly as wide as tall with flat-to-gently-curved sides — the LARGE head above it supplies the rest of the silhouette height, so the assembled pair reads as the classic bean, shoulders about as wide as hips, only a subtle lower taper, a single vertical charcoal stitch seam up its midline, and one small darker-weave patch on one shoulder; (b) one LARGE FLOATING egg head hovering above the torso with NO neck or connector, width close to torso width, carrying a small charcoal cross-stitch X where a face would be; (c) exactly two small soft blob hands — near-featureless rounded lumps, NO thumb lobe or finger reads; (d) exactly two small soft blob feet — the SAME near-featureless rounded lump language as the hands, NO wedge/heel/toe shape. Gender-neutral, deliberately empty of identity so equipment supplies all personality.
Pose: neutral idle in strict side profile facing screen-right with only the house-style high top-down pitch; head hovering centered above the torso gap; blobs relaxed at the sides; feet-blobs planted a body-width apart; no action.
Palette: oatmeal canvas #c9b593, deeper burlap #a8906c hard shadow band, charcoal #2a2622 stitching, near-black #101014 contour. No bright white.
Constraints: absolutely NO pear shape, pot belly, belly/hip flare, bulbous lower torso, or extra belly room. No clothing seams that read as gear beyond the stated stitch/patch, no shirt, pants, boots, gloves, cloak, glasses, facial hair, hat, armor, weapon, hair, eyes, shadow, VFX, or prop. Keep the complete assembled silhouette in a centered safe box around (${BODY_ROOT_SOURCE.x},${BODY_ROOT_SOURCE.y}).

${proportionLawBlock()}

${houseStyleBlock()}

${chromaOutputBlock()}

Before returning verify: SIX fully detached pieces (large floating neckless head, squat capsule torso, two blob hands, two blob feet) with green gaps between every piece; torso/head ratios obey the measured law; hands and feet read as the same blob language; strict screen-right profile with slight top-down pitch; no gear, eyes, prop, shadow, text, or VFX.`;
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

${["body", "head"].includes(part.id) ? proportionLawBlock() : ""}

${houseStyleBlock()}

FUSION REGISTRATION — ${FRAME_ID}
- Source canvas ${CANVAS.width}x${CANVAS.height}; body-local origin (${BODY_ROOT_SOURCE.x},${BODY_ROOT_SOURCE.y}); body height L=${BODY_HEIGHT_L}; semantic facing right.
- This part's authored source pivot is (${part.pivot.x},${part.pivot.y}). Painted connector stock must cover it. Connector tolerance is ${CONNECTOR_TOLERANCE.pixels} raw pixels / ${CONNECTOR_TOLERANCE.degrees} degrees.

${chromaOutputBlock()}

Before returning verify: ONLY ${part.id}; exact blank identity; authored pivot covered by stock; one paper island; clean green field; no other anatomy, gear, shadow, text, or VFX.`;
}

function legacyPromptForItem(item, spec) {
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
Generate ONE standalone raster source image for Dimension Drifters. This ticket targets only ${item.name}, slot ${spec.directory}, from ${item.setName}.

${executionBlock()}

${legacyItemReferenceBlock(item)}

Use case: identity-preserve
Asset type: game-ready isolated wearable sprite part
Primary request: render ${item.name} (${item.rarity}) — ${spec.artDirection}.
Item-specific art description: ${item.artDescription}.
Legacy provenance: ${item.identityBrief}
Systems flavor only: ${item.effect}
Composition: wearable pixels ALONE, as if worn on the invisible boilerplate at the ${spec.receivers.join(" + ")} receiver. ${paired ? "Exactly TWO separated matched paper islands, left component in the left bay and right component in the right bay." : "Exactly ONE complete opaque paper island."}
Source pivots: ${pivotText}. Every pivot must lie inside solid ordinary connector stock with 8–12% hidden overlap. No baked skin, head, body, hands, feet, shadow, held weapon, portrait, text, label, VFX, environment, or extra gear.

PROFILE GARMENT LAW — BINDING FOR ${spec.directory.toUpperCase()}
- ${spec.profileLaw}
- Construct only what a strict side-profile character can expose. Do not complete hidden interiors, the far side, a full front, or a full back merely because the legacy reference shows them.

INVISIBLE MANNEQUIN FIT LAW
- Fit Image 3's NEW slim capsule and large head, not the legacy character's anatomy and not a generic fat bean. Torso wearables hug a ${PROPORTION_LAW.torsoWidthHeight} W:H capsule with shoulder:hip width ${PROPORTION_LAW.shoulderHipWidth}; keep flat-to-gently-curved sides and leave NO belly room or lower-body flare.
- Head wearables fit a head ${PROPORTION_LAW.headTorsoWidth} of torso width and preserve the ${PROPORTION_LAW.headZoneShare} assembled head-zone share. Blob wearables preserve the near-featureless rounded hand/foot language.

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

Before returning verify: exactly ${paired ? "two matched wearable islands" : "one wearable island"}; ${item.name} unmistakably belongs to ${item.sourceCharacterName}; strict screen-right profile; slot-specific visible-side law obeyed; new slim-capsule/large-head fit with no belly room; every source pivot covered; stack law obeyed if a hat; no boilerplate pixels, anatomy, shadow, prop, text, or VFX.`;
}

function replacementAuthoringBlock(job, bundle) {
  const headCrop = JSON.stringify(PART_FRAMES.head.crop);
  const replacementLayoutImage = bundle.entries.findIndex((entry) => entry.description.includes("APPROVED PASSING REPLACE-FOOT")) + 1;
  switch (job.renderRole) {
    case "replace-torso":
      return `ONE complete dressed torso card in ${job.item.setName} identity ON Image 1, the attached base torso silhouette — the full garment from collar to hem covering the whole card; the lower region wears the set's legwear look; profile view, one visible side; house style; chroma green.`;
    case "replace-hand":
      return `GLOVES / replace-hand: Render TWO complete final dressed blob replacements ON the exact canonical hand frames: hand-l ${JSON.stringify(PART_FRAMES["hand-l"].crop)} at (384,522), hand-r ${JSON.stringify(PART_FRAMES["hand-r"].crop)} at (640,522). No bare hand pixels, fingers, thumb, or palm. Each covers >=98% of its base core, stays one connected island inside its frame and side clip, and owns one final outer contour.`;
    case "replace-foot":
      return `BOOTS / replace-foot: Render TWO complete final dressed foot-blob replacements ON the exact canonical foot frames: foot-l ${JSON.stringify(PART_FRAMES["foot-l"].crop)} at (448,736), foot-r ${JSON.stringify(PART_FRAMES["foot-r"].crop)} at (576,736). Before the generated 8px outline, left opaque stock stays inside x=361..502 and y=649..822; right opaque stock stays inside x=521..662 and y=649..822. ${replacementLayoutImage > 0 ? `Image ${replacementLayoutImage} is the BINDING topology example: copy its dense squat filled-blob proportions and two-island separation, then repaint every pixel as ${job.item.name}.` : ""} No bare foot pixels, ankle/cuff opening, toes, heel block, toe-box projection, sole perspective, boot shaft, or leg. Each rounded blob blankets the base foot core, covers >=98% of it, stays one connected island inside its frame and side clip, and owns one final outer contour.`;
    case "head-accessory":
      return job.item.slot === "glasses"
        ? `GLASSES / head-accessory: Render ON canonical head.png at its exact source placement and fixed head frame ${headCrop}, but output accessory pixels only. Stay inside face-eyes envelope ${JSON.stringify(FACE_ENVELOPES.eyes)}, cover face.eyes (553,364) with solid material, and show exactly one semantic-right lens/frame plus temple arm—no head pixels or second frontal lens.`
        : `FACIAL HAIR / head-accessory: Render ON canonical head.png at its exact source placement and fixed head frame ${headCrop}, but output accessory pixels only. Stay inside mouth/jaw envelope ${JSON.stringify(FACE_ENVELOPES.mouthJaw)}, cover face.mouth (568,410) with solid material, and show one near-side cheek/jaw attachment—no head pixels or mirrored far cheek.`;
    case "replace-head":
      return `REPLACEMENT HEAD: Render ONE complete final head card ON Image 1, canonical head.png, at exact fixed frame ${headCrop}. ${job.item.name} IS the head; never draw it over copied boilerplate-head pixels. Cover >=98% of the default head core, remain neckless and one connected island, preserve opaque support beneath face.eyes (553,364) and face.mouth (568,410), preserve hat mount (512,317) within 4px, and own one final outer contour. No body, shoulders, topper, separate mask layer, or double silhouette.`;
    default:
      throw new Error(`No creative replacement prompt contract for ${job.renderRole}`);
  }
}

function promptForRenderJob(job, bundle) {
  const { item, spec } = job;
  const paired = spec.sourcePivots.length === 2;
  const pivotCoverageLaw = exactPivotCoverageLaw(spec);
  const stragglerNudge = STRAGGLER_PROMPT_NUDGES.get(item.id) ?? null;
  const fitBlock = `INVISIBLE MANNEQUIN FIT LAW
- Exact canonical base-part placement wins over the legacy anatomy. Torso fit remains ${PROPORTION_LAW.torsoWidthHeight} W:H with shoulder:hip ${PROPORTION_LAW.shoulderHipWidth}; head fit remains ${PROPORTION_LAW.headTorsoWidth} of torso width; hands and feet remain near-featureless blobs.
- ${paired ? "Exactly TWO separated matched components, one around each named pivot." : "Exactly ONE connected primary island."}`;
  const identityBlock = `IDENTITY LOCK
- Preserve ${item.sourceCharacterName}'s exact visual grammar and ${item.name}'s distinctive construction; do not substitute a generic item.
- No extra gear, held prop, shadow, portrait, label, text, environment, aura, particles, VFX, or baked glow.`;
  const finalCheck = `Before returning verify: exact-frame replacement contract obeyed; ${paired ? "two separated matched islands" : "one primary island"}; strict semantic-right profile; every pivot covered where the role requires stock; no undersized base-revealing object; no unrelated anatomy, shadow, prop, text, or VFX.`;
  const openingLine = `Generate ONE standalone raster source image for Dimension Drifters. This ticket targets only ${item.name}, render role ${job.renderRole}, from ${item.setName}.`;
  return `# CHAT ISOLATION — GEAR REPLACEMENT ${job.key}
${openingLine}

${executionBlock()}

${itemReferenceBlock(job, bundle)}

Use case: identity-preserve
Asset type: game-ready untrimmed replacement-contract source
Primary request: ${spec.artDirection}.
Item identity: ${item.artDescription}.
${stragglerNudge ? `Item-specific layout correction: ${stragglerNudge}` : ""}
Legacy provenance: ${item.identityBrief}
Systems flavor only: ${item.effect}

REPLACEMENT AUTHORING CONTRACT — BINDING
${replacementAuthoringBlock(job, bundle)}

PROFILE LAW — BINDING
- ${spec.profileLaw}
- Strict semantic-right side profile with the house-style slight high top-down pitch. Do not complete a hidden far side, front, or back merely because a legacy reference shows it.

${fitBlock}

${houseStyleBlock()}

${identityBlock}

FUSION REGISTRATION — ${FRAME_ID}
- Source canvas ${CANVAS.width}x${CANVAS.height}; body root (${BODY_ROOT_SOURCE.x},${BODY_ROOT_SOURCE.y}); semantic facing right; runtime owns mirroring; output remains untrimmed.
- Receivers: ${JSON.stringify(spec.receivers.map((id) => receiver(id)))}.
- Authored pivots: ${JSON.stringify(spec.sourcePivots)}; ${pivotCoverageLaw}. These are literal source-canvas pixels, not approximate visual centers; every named pivot must lie well inside ordinary opaque stock before installation.

${chromaOutputBlock()}

${finalCheck} Final literal-point check: ${pivotCoverageLaw}.`;
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
  const radius = generatedOutlineRadius();
  const { data: dilated } = await sharp(registered, { raw: { width: CANVAS.width, height: CANVAS.height, channels: 4 } })
    .extractChannel(3)
    .threshold(VALIDATION_THRESHOLDS.visibleAlpha + 1)
    .convolve(circularKernel(radius))
    .threshold(1)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const output = Buffer.from(registered);
  let rimPixels = 0;
  for (let pixel = 0, offset = 0; pixel < CANVAS.width * CANVAS.height; pixel++, offset += 4) {
    if (registered[offset + 3] <= VALIDATION_THRESHOLDS.visibleAlpha && dilated[pixel] > 0) {
      output[offset] = OUTLINE.rgba[0];
      output[offset + 1] = OUTLINE.rgba[1];
      output[offset + 2] = OUTLINE.rgba[2];
      output[offset + 3] = OUTLINE.rgba[3];
      rimPixels++;
    }
  }
  return { data: output, radius, rimPixels };
}

function generatedOutlineRadius() {
  return Math.max(1, Math.round(OUTLINE.baseWidth * Math.max(CANVAS.width, CANVAS.height) / OUTLINE.referenceCanvas));
}

/** AI renders routinely leave sub-speck stray islands after chroma keying, and Lanczos registration
 *  strict component gates then count as extra parts — this failed honest paired renders ("found 5",
 *  fleet 2026-07-18). Scrub both stages; real parts are thousands of pixels, so the 64px boundary
 *  only removes dust and leaves genuine extra parts for the gates to reject. */
const MIN_COMPONENT_PIXELS = 64;

function scrubAlphaSpecks(rgba, width, height, stage = "keyed", threshold = VALIDATION_THRESHOLDS.visibleAlpha) {
  const before = rgbaAlpha(rgba);
  const alpha = new Uint8Array(before);
  const report = scrubSmallAlphaComponents(alpha, width, height, MIN_COMPONENT_PIXELS, threshold);
  if (report.removedComponentCount === 0) return rgba;
  for (let index = 0; index < alpha.length; index++) {
    if (before[index] === alpha[index]) continue;
    rgba.fill(0, index * 4, index * 4 + 4);
  }
  console.log(`SCRUB ${stage}: ${report.removedComponentCount} speck island(s), ${report.removedPixels}px < ${MIN_COMPONENT_PIXELS}px`);
  return rgba;
}

async function registerSingle(keyed, pivot, desiredAnchor, maxPartBox, contentFrame = null) {
  scrubAlphaSpecks(keyed, CANVAS.width, CANVAS.height);
  const bounds = alphaBounds(keyed, CANVAS.width, CANVAS.height);
  if (!bounds) throw new Error("chroma key removed the entire render");
  const approximate = {
    x: bounds.left + bounds.width * desiredAnchor[0],
    y: bounds.top + bounds.height * desiredAnchor[1],
  };
  // Register to deep painted stock so Lanczos downscaling cannot leave the exact pivot on a weak AA fringe.
  const authoredPixel = nearestVisible(keyed, CANVAS.width, bounds, approximate, 192);
  if (!authoredPixel) throw new Error("could not locate opaque stock for authored pivot");
  const scale = Math.min(
    1,
    maxPartBox.width / bounds.width,
    maxPartBox.height / bounds.height,
    contentFrame ? contentFrame.width / bounds.width : 1,
    contentFrame ? contentFrame.height / bounds.height : 1,
  );
  const registeredWidth = Math.max(1, Math.round(bounds.width * scale));
  const registeredHeight = Math.max(1, Math.round(bounds.height * scale));
  const cutout = await sharp(keyed, { raw: { width: CANVAS.width, height: CANVAS.height, channels: 4 } })
    .extract({ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height })
    .resize(registeredWidth, registeredHeight, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .raw()
    .toBuffer();
  const anchorX = (authoredPixel.x - bounds.left) * registeredWidth / bounds.width;
  const anchorY = (authoredPixel.y - bounds.top) * registeredHeight / bounds.height;
  const proposedLeft = Math.round(pivot.x - anchorX);
  const proposedTop = Math.round(pivot.y - anchorY);
  const left = contentFrame
    ? Math.max(contentFrame.left, Math.min(contentFrame.left + contentFrame.width - registeredWidth, proposedLeft))
    : proposedLeft;
  const top = contentFrame
    ? Math.max(contentFrame.top, Math.min(contentFrame.top + contentFrame.height - registeredHeight, proposedTop))
    : proposedTop;
  let registered = Buffer.alloc(CANVAS.width * CANVAS.height * 4);
  copyRgbaInto(registered, cutout, registeredWidth, registeredHeight, left, top);
  registered = nudgeRegionPivotIntoStock(registered, pivot);
  if (contentFrame) {
    const registeredBounds = alphaBounds(registered, CANVAS.width, CANVAS.height);
    const frameRight = contentFrame.left + contentFrame.width - 1;
    const frameBottom = contentFrame.top + contentFrame.height - 1;
    if (!registeredBounds
      || registeredBounds.left < contentFrame.left
      || registeredBounds.top < contentFrame.top
      || registeredBounds.right > frameRight
      || registeredBounds.bottom > frameBottom) {
      throw new Error(`registered stock cannot cover pivot (${pivot.x},${pivot.y}) inside fixed content frame`);
    }
  }
  return registered;
}

async function registerPaired(keyed, spec) {
  scrubAlphaSpecks(keyed, CANVAS.width, CANVAS.height);
  const overall = alphaBounds(keyed, CANVAS.width, CANVAS.height);
  if (!overall) throw new Error("chroma key removed the entire paired render");
  const middle = Math.floor(overall.left + overall.width / 2);
  const regions = [
    { left: overall.left, top: overall.top, width: Math.max(1, middle - overall.left + 1), height: overall.height },
    { left: middle + 1, top: overall.top, width: Math.max(1, overall.right - middle), height: overall.height },
  ];
  const registered = Buffer.alloc(CANVAS.width * CANVAS.height * 4);
  const split = Math.floor((spec.sourcePivots[0].x + spec.sourcePivots[1].x) / 2);
  for (let index = 0; index < 2; index++) {
    const bounds = alphaBounds(keyed, CANVAS.width, CANVAS.height, 8, regions[index]);
    if (!bounds || bounds.opaquePixelCount < 100) throw new Error(`paired component ${spec.componentIds[index]} missing or too small`);
    const desired = bounds.alphaCentroid;
    const authoredPixel = nearestVisible(keyed, CANVAS.width, bounds, desired, 192);
    if (!authoredPixel) throw new Error(`could not locate opaque stock for ${spec.componentIds[index]}`);
    const frame = PART_FRAMES[spec.receivers[index]];
    if (!frame) throw new Error(`paired component ${spec.componentIds[index]} has no fixed receiver frame`);
    const [frameLeft, frameTop, frameWidth, frameHeight] = frame.crop;
    const inset = spec.generatedOutlineRadius ?? 0;
    const contentFrame = {
      left: frameLeft + inset,
      top: frameTop + inset,
      right: frameLeft + frameWidth - inset - 1,
      bottom: frameTop + frameHeight - inset - 1,
    };
    // Keep at least one transparent column between the generated rims. Merely stopping the left
    // rim at split-1 and starting the right rim at split makes them 4-neighbor adjacent (one island).
    if (index === 0) contentFrame.right = Math.min(contentFrame.right, split - inset - 2);
    else contentFrame.left = Math.max(contentFrame.left, split + inset + 1);
    contentFrame.width = contentFrame.right - contentFrame.left + 1;
    contentFrame.height = contentFrame.bottom - contentFrame.top + 1;
    if (contentFrame.width < 1 || contentFrame.height < 1) throw new Error(`paired component ${spec.componentIds[index]} has no legal content frame`);
    const scale = Math.min(
      1,
      spec.maxPartBox.width / bounds.width,
      spec.maxPartBox.height / bounds.height,
      contentFrame.width / bounds.width,
      contentFrame.height / bounds.height,
    );
    const width = Math.max(1, Math.round(bounds.width * scale));
    const height = Math.max(1, Math.round(bounds.height * scale));
    const cutout = await sharp(keyed, { raw: { width: CANVAS.width, height: CANVAS.height, channels: 4 } })
      .extract({ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height })
      .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .raw()
      .toBuffer();
    const anchorX = (authoredPixel.x - bounds.left) * width / bounds.width;
    const anchorY = (authoredPixel.y - bounds.top) * height / bounds.height;
    const proposedLeft = Math.round(spec.sourcePivots[index].x - anchorX);
    const proposedTop = Math.round(spec.sourcePivots[index].y - anchorY);
    const left = Math.max(contentFrame.left, Math.min(contentFrame.right - width + 1, proposedLeft));
    const top = Math.max(contentFrame.top, Math.min(contentFrame.bottom - height + 1, proposedTop));
    copyRgbaInto(registered, cutout, width, height, left, top);
  }
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

let replacementContextPromise = null;

async function loadReplacementContext() {
  if (replacementContextPromise) return replacementContextPromise;
  replacementContextPromise = (async () => {
    const baseRgba = {};
    const baseAlpha = {};
    const baseSilhouettes = {};
    const cores = {};
    const baseSources = {};
    for (const partId of Object.keys(PART_FRAMES)) {
      const path = installedBoilerplatePath(partId);
      if (!existsSync(path)) throw new Error(`Replacement contract requires preserved boilerplate part ${repoPath(path)}`);
      const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      if (info.width !== CANVAS.width || info.height !== CANVAS.height || info.channels !== 4) {
        throw new Error(`Replacement contract base ${partId} must be 1024x1024 RGBA`);
      }
      baseRgba[partId] = data;
      baseAlpha[partId] = rgbaAlpha(data);
      baseSilhouettes[partId] = maskFromAlpha(baseAlpha[partId], VALIDATION_THRESHOLDS.visibleAlpha + 1);
      cores[partId] = erodeMask(maskFromAlpha(baseAlpha[partId], VALIDATION_THRESHOLDS.stockAlpha), CANVAS.width, CANVAS.height);
      baseSources[partId] = {
        installedFile: repoPath(path),
        sha256: sha256(path),
        fixedCropSha256: hashRgbaCrop(data, CANVAS.width, CANVAS.height, PART_FRAMES[partId].crop),
      };
    }
    const torsoAllowed = dilateMask(
      baseSilhouettes.body,
      CANVAS.width,
      CANVAS.height,
      VALIDATION_THRESHOLDS.torsoSilhouetteTolerancePx,
    );
    const canonicalMasks = {
      source: "installed boilerplate complete-part alpha",
      torsoAllowed: {
        ...describeMask(torsoAllowed),
        rule: `base body alpha>${VALIDATION_THRESHOLDS.visibleAlpha} dilated by ${VALIDATION_THRESHOLDS.torsoSilhouetteTolerancePx}px`,
      },
      replacementCores: Object.fromEntries(
        ["body", "head", "hand-l", "hand-r", "foot-l", "foot-r"].map((partId) => [
          partId,
          { ...describeMask(cores[partId]), rule: "boilerplate alpha>=64 eroded by circular radius 4px" },
        ]),
      ),
    };
    const revision = hashJson({
      id: REPLACEMENT_CONTRACT_ID,
      partFrames: PART_FRAMES,
      canonicalMasks,
      compositionOrders: COMPOSITION_ORDERS,
      thresholds: VALIDATION_THRESHOLDS,
      baseSources,
    });
    return {
      torsoAllowed,
      baseRgba,
      baseAlpha,
      baseSilhouettes,
      cores,
      baseSources,
      revision,
      manifest: {
        id: REPLACEMENT_CONTRACT_ID,
        revision,
        socketFrame: FRAME_ID,
        sourceCanvas: CANVAS,
        partFrames: PART_FRAMES,
        canonicalMasks,
        baseSources,
        compositionOrders: COMPOSITION_ORDERS,
        thresholds: VALIDATION_THRESHOLDS,
        torsoLaw: "one complete replace-torso object; >=90% base-core coverage; one island; base silhouette + 12px collar/hem tolerance; no zones",
      },
    };
  })();
  return replacementContextPromise;
}

function roleUsesGeneratedOutline(renderRole) {
  return ["replace-torso", "replace-hand", "replace-foot", "replace-head", "overlay-hat", "cloak-far"].includes(renderRole);
}

function singleContentFrameForJob(job) {
  if (!job) return null;
  if (job.renderRole === "head-accessory") {
    return job.item.slot === "glasses" ? FACE_ENVELOPES.eyes : FACE_ENVELOPES.mouthJaw;
  }
  if (job.renderRole === "replace-torso" || job.renderRole === "replace-head") {
    const frame = job.renderRole === "replace-torso" ? PART_FRAMES.body : PART_FRAMES.head;
    const [left, top, width, height] = frame.crop;
    const inset = generatedOutlineRadius();
    return { left: left + inset, top: top + inset, width: width - inset * 2, height: height - inset * 2 };
  }
  return null;
}

async function validateReplacementData(job, rgba, generatedOutlineRadius = 0) {
  const context = await loadReplacementContext();
  const alpha = rgbaAlpha(rgba);
  const expectedOutlineRadius = roleUsesGeneratedOutline(job.renderRole) ? 8 : 0;
  if (generatedOutlineRadius !== expectedOutlineRadius) {
    throw new Error(`Outline: role ${job.renderRole} requires generated radius ${expectedOutlineRadius}, got ${generatedOutlineRadius}`);
  }
  let gateReport;
  if (job.renderRole === "replace-torso") {
    gateReport = validateTorsoReplacement({
      alpha,
      width: CANVAS.width,
      height: CANVAS.height,
      frame: PART_FRAMES.body.crop,
      coreMask: context.cores.body,
      allowedMask: context.torsoAllowed,
      pivot: PART_FRAMES.body.pivotSource,
      partBox: job.spec.maxPartBox,
      generatedOutlineRadius,
    });
  } else if (job.renderRole === "replace-hand" || job.renderRole === "replace-foot") {
    const ids = job.renderRole === "replace-hand" ? ["hand-l", "hand-r"] : ["foot-l", "foot-r"];
    const splitX = Math.floor((PART_FRAMES[ids[0]].pivotSource.x + PART_FRAMES[ids[1]].pivotSource.x) / 2);
    gateReport = validatePairedReplacements({
      alpha,
      width: CANVAS.width,
      height: CANVAS.height,
      splitX,
      parts: ids.map((id) => ({ id, frame: PART_FRAMES[id].crop, pivot: PART_FRAMES[id].pivotSource, coreMask: context.cores[id] })),
    });
  } else if (job.renderRole === "head-accessory") {
    const glasses = job.item.slot === "glasses";
    gateReport = validateHeadAccessory({
      alpha,
      width: CANVAS.width,
      height: CANVAS.height,
      envelope: glasses ? FACE_ENVELOPES.eyes : FACE_ENVELOPES.mouthJaw,
      pivot: job.spec.sourcePivots[0],
      label: glasses ? "glasses" : "facial hair",
    });
  } else if (job.renderRole === "replace-head") {
    gateReport = validateFullReplacement({
      alpha,
      width: CANVAS.width,
      height: CANVAS.height,
      frame: PART_FRAMES.head.crop,
      coreMask: context.cores.head,
      pivot: PART_FRAMES.head.pivotSource,
    });
    gateReport.faceCompatibility = validateReplacementHeadSockets({
      alpha,
      width: CANVAS.width,
      height: CANVAS.height,
      eyesPivot: receiver("face.eyes").raw,
      mouthPivot: receiver("face.mouth").raw,
      hatMount: HAT_STACK_BAND.sourcePivot,
    });
  } else if (job.renderRole === "overlay-hat") {
    const bounds = alphaBounds(rgba, CANVAS.width, CANVAS.height);
    if (!bounds) throw new Error("File/frame: hat contains no visible alpha");
    const stackBandVerification = verifyHatStackBand(rgba, bounds);
    if (!stackBandVerification.verified) throw new Error(`Hat/readability: stack-band verification failed ${JSON.stringify(stackBandVerification)}`);
    gateReport = {
      stackBandVerification,
      readability: validateHatReadability({ alpha, width: CANVAS.width, height: CANVAS.height }),
    };
  } else if (job.renderRole === "cloak-far") {
    const bounds = alphaBounds(rgba, CANVAS.width, CANVAS.height);
    if (!bounds) throw new Error("File/frame: cloak contains no visible alpha");
    gateReport = { bounds: boundsManifest(bounds), profile: "preserved cloak-far; manual no-body-pixels contact-sheet review required" };
  } else {
    throw new Error(`Role: unsupported replacement validation role ${job.renderRole}`);
  }
  return {
    verified: true,
    contractId: REPLACEMENT_CONTRACT_ID,
    contractRevision: context.revision,
    renderRole: job.renderRole,
    generatedOutlineRadius,
    gates: gateReport,
  };
}

async function processAndInstall({ raw, dst, pivots, desiredAnchor, maxPartBox, pairedSpec = null, hat = false, replacementJob = null }) {
  let rawMetadata = await sharp(raw).metadata();
  // The image model frequently returns oversized SQUARE canvases (e.g. 1254x1254) for a 1024
  // request — this failed EVERY fleet render at the exact-size gate (0/83, 2026-07-18). A square
  // oversize carries the same composition, so normalize it to the contract canvas with lanczos
  // BEFORE validation; only non-square or non-PNG sources remain hard failures.
  if (
    rawMetadata.format === "png" &&
    rawMetadata.width === rawMetadata.height &&
    rawMetadata.width !== CANVAS.width
  ) {
    const normalized = await sharp(raw)
      .resize(CANVAS.width, CANVAS.height, { kernel: "lanczos3" })
      .png()
      .toBuffer();
    writeFileSync(raw, normalized);
    console.log(`NORMALIZE ${raw.split(/[\\/]/).pop()}: ${rawMetadata.width}x${rawMetadata.height} -> ${CANVAS.width}x${CANVAS.height}`);
    rawMetadata = await sharp(raw).metadata();
  }
  if (rawMetadata.format !== "png" || rawMetadata.width !== CANVAS.width || rawMetadata.height !== CANVAS.height) {
    throw new Error(`File/frame: raw source must be exact 1024x1024 PNG, got ${rawMetadata.width}x${rawMetadata.height} ${rawMetadata.format}`);
  }
  const decoded = await decodeAndKey(raw);
  const registrationPartBox = maxPartBox;
  const registered = pairedSpec
    ? await registerPaired(decoded.data, {
        ...pairedSpec,
        maxPartBox: registrationPartBox,
        generatedOutlineRadius: replacementJob && roleUsesGeneratedOutline(replacementJob.renderRole)
          ? generatedOutlineRadius()
          : 0,
      })
    : await registerSingle(
        decoded.data,
        pivots[0],
        desiredAnchor,
        registrationPartBox,
        singleContentFrameForJob(replacementJob),
      );
  scrubAlphaSpecks(registered, CANVAS.width, CANVAS.height, "post-registration", 0);
  const outlined = replacementJob && !roleUsesGeneratedOutline(replacementJob.renderRole)
    ? { data: registered, radius: 0, rimPixels: 0 }
    : await bakeOutline(registered);
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
  const replacementValidation = replacementJob
    ? await validateReplacementData(replacementJob, outlined.data, outlined.radius)
    : null;
  const png = await sharp(outlined.data, { raw: { width: CANVAS.width, height: CANVAS.height, channels: 4 } }).png().toBuffer();
  const metadata = await sharp(png).metadata();
  if (metadata.width !== CANVAS.width || metadata.height !== CANVAS.height || metadata.channels !== 4 || metadata.hasAlpha !== true) {
    throw new Error(`encoded metadata invalid: ${JSON.stringify(metadata)}`);
  }
  mkdirSync(dirname(dst), { recursive: true });
  const temp = `${dst}.${process.pid}.tmp.png`;
  writeFileSync(temp, png);
  try { renameSync(temp, dst); } catch { rmSync(dst, { force: true }); renameSync(temp, dst); }
  return {
    bounds,
    outline: { ...OUTLINE, radius: outlined.radius, rimPixels: outlined.rimPixels },
    replacementValidation,
    installedSha256: sha256(dst),
  };
}

function componentRegionsForSpec(spec) {
  if (spec.sourcePivots.length === 1) return [null];
  const split = Math.floor((spec.sourcePivots[0].x + spec.sourcePivots[1].x) / 2);
  return [
    { left: 0, top: 0, width: split + 1, height: CANVAS.height },
    { left: split + 1, top: 0, width: CANVAS.width - split - 1, height: CANVAS.height },
  ];
}

async function inspectInstalled(path, pivots, regions = [null], hat = false, replacementJob = null) {
  const metadata = await sharp(path).metadata();
  if (metadata.width !== CANVAS.width || metadata.height !== CANVAS.height || metadata.channels !== 4 || metadata.hasAlpha !== true || metadata.format !== "png") {
    throw new Error(`expected 1024x1024 RGBA PNG, got ${metadata.width}x${metadata.height} channels=${metadata.channels} alpha=${metadata.hasAlpha} format=${metadata.format}`);
  }
  const { data } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bounds = alphaBounds(data, CANVAS.width, CANVAS.height);
  if (!bounds) throw new Error("no visible alpha pixels");
  if (bounds.left < VALIDATION_THRESHOLDS.emergencyCanvasInsetPx
    || bounds.top < VALIDATION_THRESHOLDS.emergencyCanvasInsetPx
    || bounds.right >= CANVAS.width - VALIDATION_THRESHOLDS.emergencyCanvasInsetPx
    || bounds.bottom >= CANVAS.height - VALIDATION_THRESHOLDS.emergencyCanvasInsetPx) {
    throw new Error(`alpha bounds violate ${VALIDATION_THRESHOLDS.emergencyCanvasInsetPx}px emergency canvas inset: ${JSON.stringify(bounds)}`);
  }
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
  const replacementValidation = replacementJob ? await validateReplacementData(replacementJob, data, roleUsesGeneratedOutline(replacementJob.renderRole) ? 8 : 0) : null;
  return {
    data,
    bounds,
    parts,
    stackBandVerification,
    replacementValidation,
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

function currentRenderInstall(job, context) {
  const dst = installedRenderJobPath(job);
  const statusPath = renderJobStatusPath(job);
  if (!existsSync(dst) || !existsSync(statusPath)) return false;
  try {
    const status = JSON.parse(readFileSync(statusPath, "utf8"));
    return status.schemaVersion === 2
      && status.replacementContract?.id === REPLACEMENT_CONTRACT_ID
      && status.replacementContract?.revision === context.revision
      && status.renderRole === job.renderRole
      && status.installedFile === repoPath(dst)
      && status.installedSha256 === sha256(dst)
      && status.validation?.verified === true;
  } catch {
    return false;
  }
}

function reuseCandidateForJob(job) {
  if (job.renderRole === "replace-torso") {
    return resolve(GEAR_DST, "shirt", `${job.item.id}.png`);
  }
  if (job.renderRole === "replace-head") {
    return resolve(GEAR_DST, "heads", `${job.item.setId}-hat.png`);
  }
  return null;
}

function persistReuseVerdict(job, verdict) {
  let onDisk = null;
  try {
    const parsed = JSON.parse(readFileSync(REUSE_VERDICTS_PATH, "utf8"));
    if (parsed.contractId === REPLACEMENT_CONTRACT_ID) onDisk = parsed;
  } catch {}
  if (onDisk) {
    reuseVerdicts = {
      ...onDisk,
      ...reuseVerdicts,
      items: { ...(onDisk.items ?? {}), ...(reuseVerdicts.items ?? {}) },
    };
  }
  reuseVerdicts.evaluatedAt = new Date().toISOString();
  reuseVerdicts.catalogState = CATALOG_STATE;
  reuseVerdicts.items[job.item.id] = {
    id: job.item.id,
    setId: job.item.setId,
    renderRole: job.renderRole,
    ...verdict,
  };
  atomicJson(REUSE_VERDICTS_PATH, reuseVerdicts);
}

async function tryReusePairRender(job, context) {
  const candidate = reuseCandidateForJob(job);
  if (!candidate || !existsSync(candidate)) {
    persistReuseVerdict(job, { verdict: "no-candidate", candidate: candidate ? repoPath(candidate) : null });
    return false;
  }
  try {
    await inspectInstalled(candidate, job.spec.sourcePivots, componentRegionsForSpec(job.spec), false, job);
    const dst = installedRenderJobPath(job);
    mkdirSync(dirname(dst), { recursive: true });
    copyFileSync(candidate, dst);
    const inspected = await inspectInstalled(dst, job.spec.sourcePivots, componentRegionsForSpec(job.spec), false, job);
    syncInstalledRenderJobToClient(job, dst);
    const bundle = referenceBundleForJob(job);
    atomicJson(renderJobStatusPath(job), {
      schemaVersion: 2,
      id: job.item.id,
      name: job.item.name,
      setId: job.item.setId,
      sourceCharacterId: job.item.sourceCharacterId,
      renderRole: job.renderRole,
      replacementContract: { id: REPLACEMENT_CONTRACT_ID, revision: context.revision },
      installedAt: new Date().toISOString(),
      installedFile: repoPath(dst),
      installedSha256: inspected.image.sha256,
      sourcePivots: job.spec.sourcePivots,
      identityReferences: bundle.paths.map(repoPath),
      alphaBounds: inspected.bounds,
      outline: { ...OUTLINE, radius: 8, reusedAuthoredRim: true },
      validation: inspected.replacementValidation,
      reusedFrom: repoPath(candidate),
      renderAttempts: 0,
    });
    persistReuseVerdict(job, {
      verdict: "kept",
      candidate: repoPath(candidate),
      installedFile: repoPath(dst),
      coreCoverage: inspected.replacementValidation?.gates?.coreCoverage ?? null,
    });
    console.log(`REUSE PASS ${job.key} <- ${repoPath(candidate)}`);
    return true;
  } catch (error) {
    persistReuseVerdict(job, { verdict: "rerender", candidate: repoPath(candidate), error: error.message });
    console.log(`REUSE FAIL ${job.key}: ${error.message}`);
    return false;
  }
}

async function tryInstallExistingMaster(job, context) {
  const raw = rawRenderJobPath(job);
  if (!existsSync(raw)) return false;
  const dst = installedRenderJobPath(job);
  try {
    const installed = await processAndInstall({
      raw,
      dst,
      pivots: job.spec.sourcePivots,
      desiredAnchor: job.spec.desiredAnchor ?? [0.5, 0.5],
      maxPartBox: job.spec.maxPartBox,
      pairedSpec: job.spec.sourcePivots.length === 2 ? job.spec : null,
      hat: false,
      replacementJob: job,
    });
    syncInstalledRenderJobToClient(job, dst);
    const bundle = referenceBundleForJob(job);
    const prior = reuseVerdicts.items[job.item.id] ?? {};
    atomicJson(renderJobStatusPath(job), {
      schemaVersion: 2,
      id: job.item.id,
      name: job.item.name,
      setId: job.item.setId,
      sourceCharacterId: job.item.sourceCharacterId,
      renderRole: job.renderRole,
      replacementContract: { id: REPLACEMENT_CONTRACT_ID, revision: context.revision },
      installedAt: new Date().toISOString(),
      installedFile: repoPath(dst),
      installedSha256: installed.installedSha256,
      sourcePivots: job.spec.sourcePivots,
      identityReferences: bundle.paths.map(repoPath),
      alphaBounds: installed.bounds,
      outline: installed.outline,
      validation: installed.replacementValidation,
      renderAttempts: prior.renderAttempts ?? 0,
      attemptFailures: prior.attemptFailures ?? [],
      installedFromExistingMaster: repoPath(raw),
    });
    persistReuseVerdict(job, {
      ...prior,
      verdict: "rerendered",
      installedFile: repoPath(dst),
      installedFromExistingMaster: repoPath(raw),
    });
    console.log(`EXISTING MASTER PASS ${job.key} <- ${repoPath(raw)}`);
    return true;
  } catch (error) {
    console.log(`EXISTING MASTER FAIL ${job.key}: ${error.message}`);
    return false;
  }
}

async function renderIfNeeded({ key, raw, dst, refs, prompt, logPath, force, resumeCurrent = null }) {
  mkdirSync(dirname(raw), { recursive: true });
  mkdirSync(dirname(logPath), { recursive: true });
  const resumable = resumeCurrent == null ? (existsSync(raw) || existsSync(dst)) : resumeCurrent;
  if (!force && resumable) {
    console.log(`RESUME ${key}: ${resumeCurrent == null ? "source/install already exists" : `${REPLACEMENT_CONTRACT_ID} install and hashes are current`}`);
    return { rendered: false, code: 0 };
  }
  const harvestTo = (force || existsSync(raw) || existsSync(dst))
    ? resolve(dirname(raw), `${key.replaceAll("/", "-")}.replacement-${Date.now()}.png`)
    : raw;
  console.log(`RENDER ${key} refs=${refs.length}`);
  const code = await runCodexExec({
    label: `gear-${key.replace(/[^a-z0-9-]/gi, "-")}`,
    cwd: REPO,
    prompt,
    images: refs,
    harvestTo,
    stdoutFile: logPath,
  });
  const produced = existsSync(harvestTo);
  if (disallowedRenderLog(logPath)) {
    if (existsSync(harvestTo)) {
      const rejected = resolve(OUT, "rejected", `${key.replaceAll("/", "-")}-${Date.now()}.png`);
      mkdirSync(dirname(rejected), { recursive: true });
      renameSync(harvestTo, rejected);
      console.log(`REJECTED ${key}: blocked image call or code-drawn fallback moved to ${repoPath(rejected)}`);
    }
    return { rendered: true, code: code || 1, rejected: true, produced };
  }
  if (harvestTo !== raw && existsSync(harvestTo)) {
    copyFileSync(harvestTo, raw);
    rmSync(harvestTo, { force: true });
  }
  return { rendered: true, code, produced };
}

async function runBoilerplate(options) {
  let failures = 0;
  const masterRaw = rawBoilerplatePath(BOILERPLATE_MASTER.id);
  const masterDst = installedBoilerplatePath(BOILERPLATE_MASTER.id);
  if (!options.validateOnly) {
    const logPath = codexLogPath("boilerplate", "boilerplate", BOILERPLATE_MASTER.id);
    // The owner-approved stitch-seam concept anchors the master's material/charm (style ref only;
    // the prompt's six-piece floating rig layout overrides the concept's fused-head layout).
    const approvedConcept = resolve(REPO, "tools/artkit/out/character-concepts/stitch-seam-dummy.png");
    const render = await renderIfNeeded({
      key: `boilerplate/${BOILERPLATE_MASTER.id}`,
      raw: masterRaw,
      dst: masterDst,
      refs: existsSync(approvedConcept) ? [approvedConcept] : [],
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
  if (!options.validateOnly && BOILERPLATE_PARTS.every((part) => existsSync(installedBoilerplatePath(part.id)))) {
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

async function legacyRunSlot(options, spec) {
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
    const refs = legacyReferencesForItem(item);
    const logPath = codexLogPath("gear", spec.directory, item.id);
    if (!options.validateOnly) {
      if (refs.length !== item.expectedReferenceCount) {
        console.log(`RENDER FAIL ${key}: identity reference missing`);
        failures++;
        continue;
      }
      const render = await renderIfNeeded({
        key, raw, dst, refs,
        prompt: legacyPromptForItem(item, spec),
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

async function runSlot(options, slotSpec) {
  if (!existsSync(installedBoilerplatePath("identity-master"))) {
    if (options.validateOnly) return 0;
    console.log(`SLOT BLOCKED ${slotSpec.directory}: preserved boilerplate identity master is missing`);
    return 1;
  }
  const context = await loadReplacementContext();
  const itemMatches = (job) => !options.only
    || options.only === job.item.id
    || options.only === job.key
    || options.only === `${job.directory}/${job.item.id}`;
  const jobs = RENDER_JOBS.filter((job) => job.item.slot === slotSpec.id && itemMatches(job));
  if (!options.validateOnly && jobs.length === 0) throw new Error(`No ${slotSpec.directory} replacement job matched --only=${options.only}`);
  let failures = 0;
  let creativeCallsStarted = 0;
  for (const job of jobs) {
    const raw = rawRenderJobPath(job);
    const dst = installedRenderJobPath(job);
    let current = job.creativeRender && currentRenderInstall(job, context);
    if (!job.creativeRender) {
      if (!existsSync(dst)) {
        console.log(`VALIDATE FAIL ${job.key}: preserved ${job.renderRole} is missing`);
        failures++;
        continue;
      }
      try {
        const inspected = await inspectInstalled(
          dst,
          job.spec.sourcePivots,
          componentRegionsForSpec(job.spec),
          job.renderRole === "overlay-hat",
          job,
        );
        console.log(`VALID PRESERVED ${job.key} role=${job.renderRole} opaque=${inspected.image.opaquePixelCount}${inspected.stackBandVerification ? ` stack=${inspected.stackBandVerification.verified}` : ""}`);
      } catch (error) {
        console.log(`VALIDATE FAIL ${job.key}: ${error.message}`);
        failures++;
      }
      continue;
    }
    if (!options.validateOnly && !current && !options.force) current = await tryInstallExistingMaster(job, context);
    if (!options.validateOnly && !current && !options.force) current = await tryReusePairRender(job, context);
    if (!options.validateOnly && options.reuseOnly && !current) {
      console.log(`REUSE-ONLY PENDING ${job.key}`);
      continue;
    }
    if (options.validateOnly && !current) {
      console.log(`MIGRATION PENDING ${job.key} role=${job.renderRole}`);
      continue;
    }
    if (!options.validateOnly && !current && creativeCallsStarted >= options.maxJobs) continue;
    if (!options.validateOnly && (options.force || !current)) {
      const bundle = referenceBundleForJob(job);
      if (bundle.paths.length !== bundle.entries.length) {
        console.log(`RENDER FAIL ${job.key}: exact-frame identity reference missing`);
        failures++;
        continue;
      }
      creativeCallsStarted++;
      const attemptFailures = [];
      let installed = null;
      for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
        console.log(`ATTEMPT ${job.key} ${attempt}/${options.maxAttempts}`);
        const render = await renderIfNeeded({
          key: `${job.key}/attempt-${attempt}`,
          raw,
          dst,
          refs: bundle.paths,
          prompt: promptForRenderJob(job, bundle),
          logPath: renderJobLogPath(job, attempt),
          force: true,
          resumeCurrent: false,
        });
        if (render.code !== 0 || render.rejected || !render.produced || !existsSync(raw)) {
          const reason = `image generation exit=${render.code} rejected=${Boolean(render.rejected)} produced=${Boolean(render.produced)}`;
          attemptFailures.push({ attempt, stage: "render", error: reason });
          console.log(`RENDER FAIL ${job.key} attempt=${attempt}: ${reason}`);
          continue;
        }
        try {
          installed = await processAndInstall({
            raw,
            dst,
            pivots: job.spec.sourcePivots,
            desiredAnchor: job.spec.desiredAnchor ?? [0.5, 0.5],
            maxPartBox: job.spec.maxPartBox,
            pairedSpec: job.spec.sourcePivots.length === 2 ? job.spec : null,
            hat: false,
            replacementJob: job,
          });
          syncInstalledRenderJobToClient(job, dst);
          atomicJson(renderJobStatusPath(job), {
            schemaVersion: 2,
            id: job.item.id,
            name: job.item.name,
            setId: job.item.setId,
            sourceCharacterId: job.item.sourceCharacterId,
            renderRole: job.renderRole,
            replacementContract: { id: REPLACEMENT_CONTRACT_ID, revision: context.revision },
            installedAt: new Date().toISOString(),
            installedFile: repoPath(dst),
            installedSha256: installed.installedSha256,
            sourcePivots: job.spec.sourcePivots,
            identityReferences: bundle.paths.map(repoPath),
            alphaBounds: installed.bounds,
            outline: installed.outline,
            validation: installed.replacementValidation,
            renderAttempts: attempt,
            attemptFailures,
            renderLog: repoPath(renderJobLogPath(job, attempt)),
          });
          console.log(`INSTALLED ${repoPath(dst)} role=${job.renderRole} bounds=${installed.bounds.width}x${installed.bounds.height}@${installed.bounds.left},${installed.bounds.top}`);
          persistReuseVerdict(job, {
            verdict: "rerendered",
            candidate: reuseCandidateForJob(job) && existsSync(reuseCandidateForJob(job)) ? repoPath(reuseCandidateForJob(job)) : null,
            installedFile: repoPath(dst),
            renderAttempts: attempt,
            attemptFailures,
          });
          break;
        } catch (error) {
          attemptFailures.push({ attempt, stage: "install", error: error.message });
          console.log(`INSTALL FAIL ${job.key} attempt=${attempt}: ${error.message}`);
        }
      }
      if (!installed) {
        persistReuseVerdict(job, {
          verdict: "survivor-after-3",
          candidate: reuseCandidateForJob(job) && existsSync(reuseCandidateForJob(job)) ? repoPath(reuseCandidateForJob(job)) : null,
          renderAttempts: options.maxAttempts,
          attemptFailures,
        });
        console.log(`SURVIVOR ${job.key}: exhausted ${options.maxAttempts} attempt(s)`);
        failures++;
        continue;
      }
      current = true;
    }
    try {
      const inspected = await inspectInstalled(
        dst,
        job.spec.sourcePivots,
        componentRegionsForSpec(job.spec),
        false,
        job,
      );
      console.log(`VALID ${job.key} role=${job.renderRole} opaque=${inspected.image.opaquePixelCount} pivotAlpha=${inspected.parts.map((part) => part.pivotAlpha).join(",")}${inspected.stackBandVerification ? ` stack=${inspected.stackBandVerification.verified}` : ""}`);
    } catch (error) {
      console.log(`VALIDATE FAIL ${job.key}: ${error.message}`);
      failures++;
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
  const markers = RECEIVERS.map((row, _index) => {
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
    const baseScale = Math.min(1, 104 / width, 146 / height);
    const scaled = async (stackScale) => sharp(installedItemPath(item))
      .extract({ left, top, width, height })
      .resize(Math.max(1, Math.round(width * baseScale * stackScale)), Math.max(1, Math.round(height * baseScale * stackScale)), { fit: "fill" })
      .png()
      .toBuffer();
    const art100 = await scaled(1);
    const art082 = await scaled(0.82);
    const art024 = await scaled(0.24);
    const x = (index % columns) * tileWidth;
    const y = Math.floor(index / columns) * tileHeight;
    const label = Buffer.from(`<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="252" height="252" rx="12" fill="none" stroke="${inspected.stackBandVerification.verified ? "#72d39b" : "#ff6f91"}" stroke-width="3"/><text x="128" y="226" text-anchor="middle" fill="#f2eee2" font-family="sans-serif" font-size="14" font-weight="700">${escapeXml(item.name)}</text><text x="128" y="246" text-anchor="middle" fill="#72d39b" font-family="monospace" font-size="12">1.0/.82/.24 ${inspected.stackBandVerification.verified ? "PASS" : "FAIL"}</text></svg>`);
    layers.push({ input: art100, left: x + 12, top: y + 22 });
    layers.push({ input: art082, left: x + 150, top: y + 35 });
    layers.push({ input: art024, left: x + 181, top: y + 142 });
    layers.push({ input: label, left: x, top: y });
  }
  const out = resolve(OUT, "hat-contact-sheet.png");
  await sheet.composite(layers).png().toFile(out);
  return out;
}

function compositeProofState(manifest) {
  const torsos = manifest.slots.find((slot) => slot.id === "torso")?.items ?? [];
  const heads = manifest.slots.find((slot) => slot.id === "head")?.items ?? [];
  const ready = torsos.length === MIGRATION_EXPECTED.torsoItems && heads.length === MIGRATION_EXPECTED.headItems;
  return {
    ready,
    body: { blank: 1, completeTorsos: torsos.length, expectedCompleteTorsos: MIGRATION_EXPECTED.torsoItems },
    head: { completeHeads: heads.length, expectedCompleteHeads: MIGRATION_EXPECTED.headItems },
    laws: {
      torso: "one complete replacement object; no zone or separate pants layer",
      head: "one complete replacement object; accessories remain compatible overlays",
    },
  };
}

async function compositeFullCanvas(paths) {
  const existing = paths.filter(Boolean);
  if (existing.length === 0) throw new Error("Composite proof has no source layers");
  return sharp(existing[0]).composite(existing.slice(1).map((input) => ({ input, blend: "over" }))).png().toBuffer();
}

async function contactTile(canvas, crop, label, detail, border = "#72d39b") {
  const [left, top, width, height] = crop;
  const art = await sharp(canvas).extract({ left, top, width, height }).resize({
    width: 208,
    height: 166,
    fit: "contain",
    background: { r: 0x25, g: 0x21, b: 0x2c, alpha: 1 },
  }).png().toBuffer();
  const overlay = Buffer.from(`<svg width="240" height="220" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="236" height="216" rx="10" fill="none" stroke="${border}" stroke-width="3"/><text x="120" y="191" text-anchor="middle" fill="#f2eee2" font-family="sans-serif" font-size="12" font-weight="700">${escapeXml(label)}</text><text x="120" y="209" text-anchor="middle" fill="#a9a2b5" font-family="monospace" font-size="10">${escapeXml(detail)}</text></svg>`);
  return sharp({ create: { width: 240, height: 220, channels: 4, background: "#25212c" } })
    .composite([{ input: art, left: 16, top: 10 }, { input: overlay, left: 0, top: 0 }])
    .png()
    .toBuffer();
}

async function assertBodyCompositeSilhouette(canvas, context, label) {
  const { data } = await sharp(canvas).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = rgbaAlpha(data);
  let xor = 0;
  for (let index = 0; index < alpha.length; index++) {
    if ((alpha[index] > VALIDATION_THRESHOLDS.visibleAlpha ? 1 : 0) !== context.baseSilhouettes.body[index]) xor++;
  }
  if (xor !== 0) throw new Error(`Composite proof ${label} changes canonical body alpha support by ${xor} pixels`);
}

async function towerProofTile(head, prestige) {
  const headArt = await sharp(resolve(REPO, head.replacementInstalledFile))
    .extract({ left: PART_FRAMES.head.crop[0], top: PART_FRAMES.head.crop[1], width: PART_FRAMES.head.crop[2], height: PART_FRAMES.head.crop[3] })
    .resize({ width: 192, height: 228, fit: "contain" })
    .png()
    .toBuffer();
  const capBounds = head.alphaBounds;
  const topperTotal = Math.min(prestige, 29);
  const visibleCaps = Math.min(topperTotal, 11);
  const capScale = visibleCaps <= 1 ? 0.48 : Math.max(0.16, 0.38 - (visibleCaps - 2) * 0.022);
  const capWidth = Math.max(8, Math.round(capBounds.width * capScale));
  const capHeight = Math.max(8, Math.round(capBounds.height * capScale));
  const capArt = visibleCaps > 0
    ? await sharp(resolve(REPO, head.installedFile))
      .extract({ left: capBounds.left, top: capBounds.top, width: capBounds.width, height: capBounds.height })
      .resize(capWidth, capHeight, { fit: "fill" })
      .png()
      .toBuffer()
    : null;
  const layers = [{ input: headArt, left: 160, top: 760 }];
  let capBottom = 825;
  for (let index = 0; index < visibleCaps; index++) {
    const top = Math.max(0, Math.round(capBottom - capHeight));
    layers.push({ input: capArt, left: Math.round(256 - capWidth / 2), top });
    capBottom = top + Math.max(3, Math.round(capHeight * 0.10));
  }
  const tower = await sharp({ create: { width: 512, height: 1024, channels: 4, background: { r: 0x25, g: 0x21, b: 0x2c, alpha: 1 } } })
    .composite(layers)
    .png()
    .toBuffer();
  const art = await sharp(tower).resize({ width: 208, height: 166, fit: "contain", background: "#25212c" }).png().toBuffer();
  const overlay = Buffer.from(`<svg width="240" height="220" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="236" height="216" rx="10" fill="none" stroke="#ffcf4a" stroke-width="3"/><text x="120" y="191" text-anchor="middle" fill="#f2eee2" font-family="sans-serif" font-size="12" font-weight="700">${escapeXml(`${head.id} P${prestige}`)}</text><text x="120" y="209" text-anchor="middle" fill="#a9a2b5" font-family="monospace" font-size="10">${visibleCaps} visible caps · ${topperTotal - visibleCaps} hidden</text></svg>`);
  return sharp({ create: { width: 240, height: 220, channels: 4, background: "#25212c" } })
    .composite([{ input: art, left: 16, top: 10 }, { input: overlay, left: 0, top: 0 }])
    .png()
    .toBuffer();
}

async function emitGearReplacementContactSheet(manifest) {
  const proof = compositeProofState(manifest);
  if (!proof.ready) throw new Error(`Composite proof is incomplete: ${JSON.stringify(proof)}`);
  const bodyPath = installedBoilerplatePath("body");
  const torsos = manifest.slots.find((slot) => slot.id === "torso").items;
  const heads = manifest.slots.find((slot) => slot.id === "head").items;
  const glasses = manifest.slots.find((slot) => slot.id === "glasses").items;
  const facialHair = manifest.slots.find((slot) => slot.id === "facialHair").items;
  const tiles = [];
  const blankBody = await compositeFullCanvas([bodyPath]);
  tiles.push(await contactTile(blankBody, PART_FRAMES.body.crop, "BLANK BODY", "base silhouette"));
  for (const torso of torsos) {
    tiles.push(await contactTile(resolve(REPO, torso.installedFile), PART_FRAMES.body.crop, torso.id, "complete replace-torso"));
  }
  for (const head of heads) {
    const glassesItem = glasses.find((item) => item.setId === head.setId) ?? null;
    const hairItem = facialHair.find((item) => item.setId === head.setId) ?? null;
    const canvas = await compositeFullCanvas([
      resolve(REPO, head.installedFile),
      hairItem ? resolve(REPO, hairItem.installedFile) : null,
      glassesItem ? resolve(REPO, glassesItem.installedFile) : null,
    ]);
    tiles.push(await contactTile(canvas, PART_FRAMES.head.crop, head.id, `matched accessories`));
  }
  const columns = 8;
  const rows = Math.ceil(tiles.length / columns);
  const out = resolve(OUT, "gear-replacement-contact-sheet.png");
  await sharp({ create: { width: columns * 240, height: rows * 220, channels: 4, background: "#1d1a23" } })
    .composite(tiles.map((input, index) => ({ input, left: (index % columns) * 240, top: Math.floor(index / columns) * 220 })))
    .png()
    .toFile(out);
  return { path: out, proof, tileCount: tiles.length };
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
        mountScale: mountScaleForPart(part.id, part.receiver),
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
        const identityReferences = legacyReferencesForItem(item).map(repoPath);
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
            mountScale: mountScaleForPart(id, spec.receivers[index]),
            plane: Z_ORDER.find((plane) => plane.id === spec.planeIds[index])?.plane ?? 0,
            spring: spec.id === "hat" ? { preset: "hat-jiggle", hz: 5.2, dampingRatio: 0.58, maxDeg: 9, dragGain: 0.70 } : null,
            alphaBounds: boundsManifest(inspected.parts[index].bounds),
            pivotAlpha: inspected.parts[index].pivotAlpha,
          })),
          stackBandVerification: inspected.stackBandVerification,
        });
      } catch (error) { invalid.push({ file: repoPath(path), error: error.message }); }
    }
    const expectedItems = ITEMS.filter((candidate) => candidate.slot === spec.id);
    slotRows.push({
      id: spec.id,
      directory: spec.directory,
      shardCommand: `node tools/artkit/gen-gear.mjs --slot=${spec.directory}`,
      receivers: spec.receivers,
      componentIds: spec.componentIds,
      expectedItemCount: expectedItems.length,
      installedItemCount: rows.length,
      expectedPartCount: expectedItems.length * spec.componentIds.length,
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
    contentSource: "packages/shared/src/gear.ts#GEAR_CATALOG",
    artDescriptionSources: [
      "docs/metagame-panel/gear-systems.md#2-progression-and-the-old-shop",
      "docs/metagame-panel/gear-systems.md#6-launch-content-12-sets--8-slots",
    ],
    blankArtRule: "blank-drifter-* catalog rows mean wearing nothing and intentionally have no wearable PNG or manifest item",
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
    expectedPartCount: SLOT_SPECS.reduce(
      (sum, spec) => sum + ITEMS.filter((item) => item.slot === spec.id).length * spec.componentIds.length,
      0,
    ),
    installedPartCount,
    slots: slotRows,
    missing,
    extras,
    invalid,
  };
  return manifest;
}

function fixedFrameIdForJobPart(job, index) {
  if (job.renderRole === "replace-torso") return "body";
  if (job.renderRole === "head-accessory" || job.renderRole === "replace-head") return "head";
  if (job.renderRole === "replace-hand") return index === 0 ? "hand-l" : "hand-r";
  if (job.renderRole === "replace-foot") return index === 0 ? "foot-l" : "foot-r";
  return null;
}

function hashComponentFixedCrop(data, job, index, crop) {
  if (job.spec.sourcePivots.length !== 2) return hashRgbaCrop(data, CANVAS.width, CANVAS.height, crop);
  const split = Math.floor((job.spec.sourcePivots[0].x + job.spec.sourcePivots[1].x) / 2);
  const isolated = Buffer.from(data);
  for (let y = 0; y < CANVAS.height; y++) {
    for (let x = 0; x < CANVAS.width; x++) {
      if ((index === 0 && x >= split) || (index === 1 && x < split)) isolated.fill(0, (y * CANVAS.width + x) * 4, (y * CANVAS.width + x) * 4 + 4);
    }
  }
  return hashRgbaCrop(isolated, CANVAS.width, CANVAS.height, crop);
}

function manifestPartsForJob(result) {
  const { job, inspected } = result;
  return job.spec.componentIds.map((id, index) => {
    const frameId = fixedFrameIdForJobPart(job, index);
    const frame = frameId ? PART_FRAMES[frameId] : null;
    return {
      id,
      renderRole: job.renderRole,
      parent: receiver(job.spec.receivers[index]).parent,
      receiver: job.spec.receivers[index],
      pivotSource: frame?.pivotSource ?? job.spec.sourcePivots[index],
      pivotTrimmed: frame?.pivotSource ?? job.spec.sourcePivots[index],
      authoringPivotSource: job.spec.sourcePivots[index],
      receiverAnchor: receiver(job.spec.receivers[index]),
      restAngle: 0,
      mountScale: mountScaleForPart(id, job.spec.receivers[index]),
      plane: Z_ORDER.find((plane) => plane.id === job.spec.planeIds[index])?.plane ?? 0,
      spring: job.renderRole === "overlay-hat"
        ? { preset: "hat-jiggle", hz: 5.2, dampingRatio: 0.58, maxDeg: 9, dragGain: 0.70 }
        : null,
      fixedFrame: frameId,
      fixedCrop: frame?.crop ?? null,
      outputOrigin: frame?.outputOrigin ?? null,
      sourceHash: frame
        ? hashComponentFixedCrop(inspected.data, job, index, frame.crop)
        : inspected.image.sha256,
      alphaBounds: boundsManifest(inspected.parts[index].bounds),
      pivotAlpha: inspected.parts[index].pivotAlpha,
    };
  });
}

async function buildManifestV2({ includeValidatedPairInstalls = false } = {}) {
  const context = await loadReplacementContext();
  const invalid = [];
  const installedPaths = new Set();
  const resultByKey = new Map();

  for (const job of RENDER_JOBS) {
    const path = installedRenderJobPath(job);
    const eligible = job.creativeRender
      ? currentRenderInstall(job, context) || (includeValidatedPairInstalls && existsSync(path))
      : existsSync(path);
    if (!eligible) continue;
    try {
      const inspected = await inspectInstalled(
        path,
        job.spec.sourcePivots,
        componentRegionsForSpec(job.spec),
        job.renderRole === "overlay-hat",
        job,
      );
      const result = { job, path, inspected };
      syncInstalledRenderJobToClient(job, path);
      resultByKey.set(job.key, result);
      installedPaths.add(repoPath(path));
    } catch (error) {
      invalid.push({ file: repoPath(path), id: job.item.id, renderRole: job.renderRole, error: error.message });
    }
  }

  const boilerplateParts = [];
  let boilerplateMaster = null;
  const masterPath = installedBoilerplatePath("identity-master");
  if (existsSync(masterPath)) {
    try {
      const inspected = await inspectInstalled(masterPath, [BOILERPLATE_MASTER.pivot]);
      boilerplateMaster = {
        id: "identity-master",
        installedFile: repoPath(masterPath),
        pivotSource: BOILERPLATE_MASTER.pivot,
        pivotTrimmed: BOILERPLATE_MASTER.pivot,
        alphaBounds: boundsManifest(inspected.bounds),
        image: inspected.image,
      };
    } catch (error) {
      invalid.push({ file: repoPath(masterPath), error: error.message });
    }
  }
  for (const part of BOILERPLATE_PARTS) {
    const path = installedBoilerplatePath(part.id);
    if (!existsSync(path)) continue;
    try {
      const inspected = await inspectInstalled(path, [part.pivot]);
      const frame = PART_FRAMES[part.id];
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
        mountScale: mountScaleForPart(part.id, part.receiver),
        plane: Z_ORDER.find((plane) => plane.id === part.planeId)?.plane ?? 0,
        fixedCrop: frame.crop,
        outputOrigin: frame.outputOrigin,
        sourceHash: context.baseSources[part.id].fixedCropSha256,
        alphaBounds: boundsManifest(inspected.bounds),
        image: inspected.image,
      });
    } catch (error) {
      invalid.push({ file: repoPath(path), error: error.message });
    }
  }

  const slotRows = [];
  let installedItemCount = 0;
  let installedPartCount = 0;
  let installedRoleTextureCount = 0;
  for (const slotSpec of SLOT_SPECS) {
    const rows = [];
    const slotItems = ITEMS.filter((item) => item.slot === slotSpec.id);
    const slotJobs = RENDER_JOBS.filter((job) => job.item.slot === slotSpec.id);
    for (const item of slotItems) {
      const jobs = renderJobsForItem(item);
      const results = jobs.map((job) => resultByKey.get(job.key));
      if (results.some((result) => !result)) continue;
      const primary = results[0];
      const parts = results.flatMap(manifestPartsForJob);
      installedItemCount++;
      installedPartCount += parts.length;
      const identityReferences = referenceBundleForJob(primary.job).paths.map(repoPath);
      let status = null;
      try { status = JSON.parse(readFileSync(renderJobStatusPath(primary.job), "utf8")); } catch {}
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
        renderRole: renderRoleForItem(item),
        texture: `${item.id}.png`,
        installedFile: repoPath(primary.path),
        renderLog: status?.renderLog ?? repoPath(renderJobLogPath(primary.job)),
        sourceRevision: primary.inspected.image.sha256,
        alphaBounds: boundsManifest(primary.inspected.bounds),
        image: primary.inspected.image,
        parts,
        validation: Object.fromEntries(results.map((result) => [result.job.renderRole, result.inspected.replacementValidation])),
        stackBandVerification: primary.inspected.stackBandVerification,
      });
    }
    const validSlotResults = slotJobs.map((job) => resultByKey.get(job.key)).filter(Boolean);
    installedRoleTextureCount += validSlotResults.length;
    slotRows.push({
      id: slotSpec.id,
      directory: slotSpec.directory,
      shardCommand: `node tools/artkit/gen-gear.mjs --slot=${slotSpec.directory}`,
      receivers: slotSpec.receivers,
      componentIds: slotSpec.componentIds,
      expectedItemCount: slotItems.length,
      installedItemCount: rows.length,
      expectedRoleTextureCount: slotJobs.length,
      installedRoleTextureCount: validSlotResults.length,
      expectedPartCount: slotJobs.reduce((sum, job) => sum + job.componentParts, 0),
      installedPartCount: validSlotResults.reduce((sum, result) => sum + result.job.componentParts, 0),
      items: rows,
    });
  }

  const expectedGear = new Set(RENDER_JOBS.map((job) => repoPath(installedRenderJobPath(job))));
  const activeDirectories = new Set(RENDER_JOBS.map((job) => dirname(installedRenderJobPath(job))));
  const actualGear = new Set([...activeDirectories].flatMap((directory) => listPngs(directory)).map(repoPath));
  const missing = [...expectedGear].filter((path) => !installedPaths.has(path)).sort();
  const extras = [...actualGear].filter((path) => !expectedGear.has(path)).sort();
  const socketReference = installedBoilerplatePath("socket-reference");
  const completedCreative = CREATIVE_RENDER_JOBS.filter((job) => resultByKey.has(job.key));
  const completedCreativeIds = new Set(
    [...new Set(CREATIVE_RENDER_JOBS.map((job) => job.item.id))].filter((id) => (
      CREATIVE_RENDER_JOBS.filter((job) => job.item.id === id).every((job) => resultByKey.has(job.key))
    )),
  );
  const pairResults = CREATIVE_RENDER_JOBS.map((job) => resultByKey.get(job.key)).filter(Boolean);
  const keptCreativeIds = [];
  const rerenderedCreativeIds = [];
  for (const result of pairResults) {
    let status = null;
    try { status = JSON.parse(readFileSync(renderJobStatusPath(result.job), "utf8")); } catch {}
    (status?.reusedFrom ? keptCreativeIds : rerenderedCreativeIds).push(result.job.item.id);
  }
  const pairInvalid = invalid.filter((row) => ["replace-torso", "replace-head"].includes(row.renderRole));
  const pairMissing = CREATIVE_RENDER_JOBS
    .filter((job) => !resultByKey.has(job.key))
    .map((job) => ({ id: job.item.id, renderRole: job.renderRole, file: repoPath(installedRenderJobPath(job)) }));
  let finalizedFleet = null;
  try {
    const state = JSON.parse(readFileSync(FLEET_STATE_PATH, "utf8"));
    const installedIds = [...completedCreativeIds].sort();
    const survivorIds = pairMissing.map((row) => row.id).sort();
    if (state.contractId === REPLACEMENT_CONTRACT_ID
      && JSON.stringify([...state.installedIds].sort()) === JSON.stringify(installedIds)
      && JSON.stringify([...state.survivorIds].sort()) === JSON.stringify(survivorIds)) {
      finalizedFleet = state;
    }
  } catch {}
  return {
    schemaVersion: 2,
    generator: "tools/artkit/gen-gear.mjs",
    contentSource: "packages/shared/src/gear.ts#GEAR_CATALOG",
    catalogState: CATALOG_STATE,
    blankArtRule: "blank-drifter-* catalog rows mean wearing nothing and intentionally have no wearable PNG or manifest item",
    renderContractSource: "docs/gear-replacement-panel/blueprint.md#2-art-authoring-contract-for-bot-2",
    replacementContract: context.manifest,
    migration: {
      plan: MIGRATION_PLAN.counts,
      rerenderIds: [...new Set(MIGRATION_PLAN.creative.map((job) => job.item.id))],
      preservedOverlayHatIds: MIGRATION_PLAN.preserved.filter((job) => job.renderRole === "overlay-hat").map((job) => job.item.id),
      preservedCloakIds: MIGRATION_PLAN.preserved.filter((job) => job.renderRole === "cloak-far").map((job) => job.item.id),
      completedRerenderItems: completedCreativeIds.size,
      completedRenderCalls: finalizedFleet ? finalizedFleet.attemptedItems : completedCreative.length,
      pendingRenderCalls: finalizedFleet ? 0 : MIGRATION_EXPECTED.renderCalls - completedCreative.length,
      completedComponentParts: completedCreative.reduce((sum, job) => sum + job.componentParts, 0),
      reuseVerdicts: {
        file: repoPath(REUSE_VERDICTS_PATH),
        kept: keptCreativeIds,
        rerendered: rerenderedCreativeIds,
        survivors: finalizedFleet?.survivorIds
          ?? Object.values(reuseVerdicts.items).filter((row) => row.verdict === "survivor-after-3").map((row) => row.id),
      },
      renderFleet: finalizedFleet,
      validation: {
        expectedItems: MIGRATION_EXPECTED.rerenderItems,
        installedItems: pairResults.length,
        missing: pairMissing,
        invalid: pairInvalid,
        verified: pairResults.length === MIGRATION_EXPECTED.rerenderItems && pairMissing.length === 0 && pairInvalid.length === 0,
      },
    },
    compositeProof: compositeProofState({ slots: slotRows }),
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
      completeCardRoles: ["replace-torso", "replace-head", "replace-hand", "replace-foot", "overlay-hat", "cloak-far"],
      zeroGeneratedRimRoles: ["head-accessory"],
      law: "complete cards receive one generated #101014 exterior rim; head accessories retain authored local contours",
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
    expectedItemCount: MIGRATION_PLAN.counts.finalNonblankItems,
    installedItemCount,
    expectedRoleTextureCount: MIGRATION_PLAN.counts.finalRoleTextures,
    installedRoleTextureCount,
    expectedPartCount: MIGRATION_PLAN.counts.finalManifestParts,
    installedPartCount,
    slots: slotRows,
    missing,
    extras,
    invalid,
  };
}

async function emitManifest({ write = true, includeValidatedPairInstalls = false } = {}) {
  const release = write ? acquireLock("manifest") : () => {};
  try {
    const manifest = await buildManifestV2({ includeValidatedPairInstalls });
    if (write) atomicJson(MANIFEST_PATH, manifest);
    console.log(`${write ? "MANIFEST" : "MANIFEST V2 PREVIEW (not written)"} ${repoPath(MANIFEST_PATH)} items=${manifest.installedItemCount}/${manifest.expectedItemCount} roleTextures=${manifest.installedRoleTextureCount}/${manifest.expectedRoleTextureCount} parts=${manifest.installedPartCount}/${manifest.expectedPartCount} missing=${manifest.missing.length} extras=${manifest.extras.length} invalid=${manifest.invalid.length}`);
    console.log(`MIGRATION PLAN setPairs=${MIGRATION_EXPECTED.setPairs} torsos=${MIGRATION_EXPECTED.torsoItems} heads=${MIGRATION_EXPECTED.headItems} calls=${MIGRATION_EXPECTED.renderCalls} reusableHeads=${MIGRATION_EXPECTED.reusableHeadRenders} newHeads=${MIGRATION_EXPECTED.newHeadRenders} catalog=${CATALOG_STATE.mode}`);
    console.log(`MIGRATION STATE completedItems=${manifest.migration.completedRerenderItems}/${MIGRATION_EXPECTED.rerenderItems} completedCalls=${manifest.migration.completedRenderCalls}/${MIGRATION_EXPECTED.renderCalls} pendingCalls=${manifest.migration.pendingRenderCalls} completedComponents=${manifest.migration.completedComponentParts}/${MIGRATION_EXPECTED.rerenderComponentParts}`);
    console.log(`MIGRATION VALIDATION installed=${manifest.migration.validation.installedItems}/${manifest.migration.validation.expectedItems} missing=${manifest.migration.validation.missing.length} invalid=${manifest.migration.validation.invalid.length} verified=${manifest.migration.validation.verified}`);
    return manifest;
  } finally {
    release();
  }
}

function finalizeMigrationFleet(manifest) {
  const installedIds = CREATIVE_RENDER_JOBS
    .map((job) => job.item.id)
    .filter((id) => !manifest.migration.validation.missing.some((row) => row.id === id));
  const survivorIds = manifest.migration.validation.missing.map((row) => row.id);
  const state = {
    schemaVersion: 1,
    contractId: REPLACEMENT_CONTRACT_ID,
    finalizedAt: new Date().toISOString(),
    expectedItems: MIGRATION_EXPECTED.rerenderItems,
    attemptedItems: MIGRATION_EXPECTED.rerenderItems,
    installedItems: installedIds.length,
    survivorItems: survivorIds.length,
    installedIds,
    survivorIds,
    law: "All pair items were attempted; missing items exhausted the per-item cap and are survivors, not pending renders.",
  };
  atomicJson(FLEET_STATE_PATH, state);
  console.log(`FLEET FINALIZED ${repoPath(FLEET_STATE_PATH)} installed=${state.installedItems}/${state.expectedItems} survivors=${state.survivorItems} pending=0`);
  return state;
}

const options = parseOptions(process.argv.slice(2));
const releases = [];
const migrationValidationDefault = options.validateOnly && options.stage === "all" && options.slot == null;
const requestedSpecs = options.syncClient
  ? []
  : migrationValidationDefault
  ? SLOT_SPECS.filter((spec) => ["head", "torso"].includes(spec.id))
  : options.stage === "gear"
  ? (options.slot ? SLOT_SPECS.filter((spec) => spec.id === options.slot) : SLOT_SPECS)
  : options.stage === "all" ? SLOT_SPECS : [];
if (!options.validateOnly && !options.syncClient) {
  if (options.stage === "boilerplate" || options.stage === "all") releases.push(acquireLock("boilerplate"));
  for (const spec of requestedSpecs) releases.push(acquireLock(options.only ? `item-${options.only}` : `slot-${spec.directory}`));
}

let failures = 0;
try {
  console.log(`GEAR ART RUN stage=${options.stage} slots=${requestedSpecs.map((spec) => spec.directory).join(",") || "none"} force=${options.force} validateOnly=${options.validateOnly}`);
  if (!options.syncClient && !migrationValidationDefault && (options.stage === "boilerplate" || options.stage === "all")) failures += await runBoilerplate(options);
  for (const spec of requestedSpecs) failures += await runSlot(options, spec);
  let manifest = await emitManifest({
    write: !options.validateOnly,
    includeValidatedPairInstalls: options.syncClient,
  });
  console.log(`CLIENT SYNC SUMMARY copied=${clientSyncStats.copied} current=${clientSyncStats.current}`);
  if (options.finalizeFleet) {
    finalizeMigrationFleet(manifest);
    manifest = await emitManifest({ write: true });
  }
  if (migrationValidationDefault) {
    if (!manifest.migration.validation.verified) failures++;
  } else if (options.syncClient) {
    if (manifest.migration.validation.invalid.length > 0) failures++;
  } else if (manifest.extras.length > 0 || manifest.invalid.length > 0) failures++;
  if (!options.validateOnly && !options.syncClient && manifest.slots.find((slot) => slot.id === "hat")?.installedItemCount === 12) {
    try {
      const sheet = await emitHatContactSheet();
      if (sheet) console.log(`HAT CONTACT SHEET ${repoPath(sheet)}`);
    } catch (error) {
      console.log(`HAT CONTACT SHEET FAIL: ${error.message}`);
      failures++;
    }
  }
  if (!options.validateOnly
    && !options.syncClient
    && manifest.installedItemCount === MIGRATION_PLAN.counts.finalNonblankItems
    && manifest.installedRoleTextureCount === MIGRATION_PLAN.counts.finalRoleTextures
    && manifest.invalid.length === 0
    && manifest.extras.length === 0) {
    try {
      const sheet = await emitGearReplacementContactSheet(manifest);
      console.log(`REPLACEMENT CONTACT SHEET ${repoPath(sheet.path)} tiles=${sheet.tileCount} torsoCases=${sheet.proof.body.completeTorsos + sheet.proof.body.blank} headCases=${sheet.proof.head.completeHeads}`);
    } catch (error) {
      console.log(`REPLACEMENT CONTACT SHEET FAIL: ${error.message}`);
      failures++;
    }
  }
  console.log(failures ? `DONE with ${failures} failure(s); rerun the same shard command to resume` : "DONE selected renders installed and manifest verified");
} finally {
  for (const release of releases.reverse()) release();
}
if (failures > 0) process.exitCode = 1;
