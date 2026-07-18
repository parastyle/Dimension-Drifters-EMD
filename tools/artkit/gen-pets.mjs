#!/usr/bin/env node
// artkit/gen-pets.mjs — PET_SOCKET_FRAME_V1 part-separated pet renders.
//
// RESUMABLE: raw masters under tools/artkit/out/pets/masters are never regenerated unless --force is
// supplied. Jobs are ordered stage-first (all eight Hatchlings before any stage-2 work), then pet, with
// each pet's body first. Later bodies and recurring parts are edits of their earlier-stage raw master;
// newly introduced parts use the current-stage body plus the stage-1 identity master as references.
// Installed textures remain full 1024x1024 canvases (NO trim): the body root and every part pivot are
// canvas-authored registration points, matching the Seam-Eater registration-collar discipline.
//
// MACHINE MANIFEST: tools/artkit/out/pets/pet-parts-manifest.json
// {
//   schemaVersion, socketFrame: { id, canvas, bodyRootSource, axisLength, sockets[] },
//   expectedPartCount, installedPartCount,
//   pets: [{ id, displayName, stages: [{ stage, stageName, body, parts[] }] }],
//   missing: [repo-relative PNG path], extras: [repo-relative PNG path]
// }
// Each parts[] entry is exactly one installed PNG and records:
// {
//   id, texture, installedFile, donorPetId, stage, class, slot, parent,
//   pivotSource, pivotTrimmed, receiverAnchor, restAngle, mountScale, plane,
//   spring, paletteRoles, alphaBounds, image
// }
// `pivotTrimmed === pivotSource` because installs are intentionally not trimmed. `receiverAnchor` is the
// normalized/body-local PET_SOCKET_FRAME_V1 socket for root kit parts; tailTip remains a donor-child
// socket. `image` contains verified dimensions, alpha, and opaque/visible pixel counts.
//
// Usage:
//   node tools/artkit/gen-pets.mjs
//   node tools/artkit/gen-pets.mjs --stage=1
//   node tools/artkit/gen-pets.mjs --pet=verdant-wing [--part=body]
//   node tools/artkit/gen-pets.mjs --only=verdant-wing/s1/body
//   node tools/artkit/gen-pets.mjs --validate-only
//   node tools/artkit/gen-pets.mjs --force --only=verdant-wing/s1/body

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
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const OUT = resolve(here, "out/pets");
const MASTERS = resolve(OUT, "masters");
const MANIFEST_PATH = resolve(OUT, "pet-parts-manifest.json");
// One global lock is intentional: image-generation calls for this program are required to stay serial,
// even when selectors target disjoint pets or stages.
const shardTag = process.argv.slice(2).find((a) => a.startsWith("--pet=") || a.startsWith("--only="));
const LOCK_PATH = resolve(OUT, shardTag ? `.gen-pets.${shardTag.replace(/[^a-z0-9-]/gi, "_")}.lock` : ".gen-pets.lock");
const DST = resolve(REPO, "packages/client/public/sprites/pets");
const CANVAS = { width: 1024, height: 1024 };
const BODY_ROOT = { x: 512, y: 510 };
const AXIS_LENGTH = 256;

mkdirSync(MASTERS, { recursive: true });
mkdirSync(DST, { recursive: true });

if (existsSync(LOCK_PATH)) {
  const previousPid = Number(readFileSync(LOCK_PATH, "utf8").trim());
  let alive = false;
  try { process.kill(previousPid, 0); alive = true; } catch {}
  if (alive) throw new Error(`Another gen-pets process holds this shard (PID ${previousPid})`);
  rmSync(LOCK_PATH, { force: true });
}
writeFileSync(LOCK_PATH, `${process.pid}\n`, { flag: "wx" });
process.on("exit", () => {
  try {
    if (Number(readFileSync(LOCK_PATH, "utf8").trim()) === process.pid) rmSync(LOCK_PATH, { force: true });
  } catch {}
});

configureCodex({
  perChatRoot: resolve(here, ".artkit-codex-homes"),
  log: (message) => console.log(message),
});

const SOCKETS = [
  { id: "side.far", xL: -0.08, yL: -0.14, raw: { x: 491.52, y: 474.16 }, restAngle: -8, mountScale: 1, plane: -20 },
  { id: "side.near", xL: -0.05, yL: 0.14, raw: { x: 499.2, y: 545.84 }, restAngle: 8, mountScale: 1, plane: 20 },
  { id: "side.paired", xL: -0.065, yL: 0, raw: { x: 495.36, y: 510 }, restAngle: 0, mountScale: 1, plane: -20 },
  { id: "rear", xL: -0.45, yL: 0.05, raw: { x: 396.8, y: 522.8 }, restAngle: 0, mountScale: 1, plane: -10 },
  { id: "crown", xL: 0.25, yL: -0.20, raw: { x: 576, y: 458.8 }, restAngle: 0, mountScale: 1, plane: 30 },
  { id: "shell", xL: -0.12, yL: -0.05, raw: { x: 481.28, y: 497.2 }, restAngle: 0, mountScale: 1, plane: 10 },
  { id: "dorsal", xL: -0.06, yL: -0.20, raw: { x: 496.64, y: 458.8 }, restAngle: 0, mountScale: 1, plane: 10 },
  { id: "ventral", xL: 0.03, yL: 0.20, raw: { x: 519.68, y: 561.2 }, restAngle: 0, mountScale: 1, plane: 10 },
];

const SOURCE_PIVOTS = {
  body: BODY_ROOT,
  "side.far": { x: 360, y: 360 },
  "side.near": { x: 664, y: 360 },
  "side.paired": { x: 512, y: 820 },
  rear: { x: 400, y: 255 },
  crown: { x: 512, y: 896 },
  shell: { x: 234, y: 330 },
  dorsal: { x: 512, y: 896 },
  ventral: { x: 780, y: 180 },
  tailTip: { x: 650, y: 255 },
};

const SPRINGS = {
  flutter: { preset: "flutter", hz: 8.5, damping: 0.35, maxDeg: 6, dragGain: 0.82 },
  antenna: { preset: "antenna", hz: 6.5, damping: 0.38, maxDeg: 5, dragGain: 0.72 },
  tail: { preset: "tail", hz: 5.2, damping: 0.55, maxDeg: 7, dragGain: 0.9 },
  weighty: { preset: "weighty", hz: 4.8, damping: 0.70, maxDeg: 4, dragGain: 0.58 },
};

const STAGE_NAMES = { 1: "Hatchling", 2: "Grown / Awakened", 3: "Apex / Ascendant" };
const DIMENSIONS = {
  verdant: "Verdant Ruins",
  ash: "Ashlands",
  frost: "Frostfell",
  west: "Wild West",
  cyber: "Neon-Cyber",
};

function body(description) {
  return { id: "body", class: "body", slot: "body", parent: null, description };
}

function part(id, slot, preset, description, parent = "body") {
  const classBySlot = {
    "side.far": "paired-side",
    "side.near": "paired-side",
    "side.paired": "paired-side",
    rear: "tail-trailing",
    crown: "antennae-crown",
    shell: "accessory",
    dorsal: "accessory",
    ventral: "accessory",
    tailTip: "accessory",
  };
  return { id, class: classBySlot[slot], slot, parent, preset, description };
}

const PETS = [
  {
    id: "verdant-wing",
    displayName: "Verdant Wing",
    dimension: DIMENSIONS.verdant,
    mappingLane: "passive HP-regeneration multiplier plus exactly one additional maximum weapon charge at level 10",
    identity: "An unequivocal friendly green butterfly: plump bud thorax, short curled proboscis face mark, tiny off-white friendly collar stitch, and double-lobed fern-leaf wing cards that read as four wings. Never a moth, dragonfly, fairy, humanoid, enemy, healing pickup, or aura source.",
    palette: { ink: "#111318", structureDark: "#315A3B", structureMid: "#5F7A46", paperLight: "#CFC6AE", signature: "#8FA76A", core: "#9FD8E8" },
    particle: "pet-verdant-wing-dew-mote",
    stages: {
      1: [
        body("Plump round bud-body with one clear eye/face mark and curled proboscis; muted Hatchling proportions."),
        part("folded-wing", "side.paired", "flutter", "One complete folded paired-wing card: two double-lobed fern leaves nested as a single compact butterfly wing silhouette; ordinary moss-paper collar stock at the root."),
      ],
      2: [
        body("The same bud thorax, lengthened subtly by 8–12% while keeping the face mark, root, axis, and every socket exact."),
        part("far-wing", "side.far", "flutter", "Far double-lobed fern-leaf wing, one clean fern notch, compact butterfly anatomy, with a broad moss-paper attachment collar."),
        part("near-wing", "side.near", "flutter", "Near double-lobed fern-leaf wing, one clean fern notch, matching the far wing but clearly the foreground card, with a broad moss-paper attachment collar."),
      ],
      3: [
        body("Mature but compact version of the exact thorax; pale dew veins complete its established form and one tiny flat dew node is present without glow."),
        part("far-wing", "side.far", "flutter", "EDIT the established far fern wing into its mature leaf-crown lobe, preserve pivot/collar exactly, add restrained pale dew veins and one cathedral-clean fern point."),
        part("near-wing", "side.near", "flutter", "EDIT the established near fern wing into its mature foreground leaf-crown lobe, preserve pivot/collar exactly, add restrained pale dew veins and one clean fern point."),
        part("antenna-crest", "crown", "antenna", "A single paired antenna-crest card with two short elegant fern-curl antennae joined at one hidden ordinary moss-paper root collar; not horns, a crown item, or emitted vines."),
      ],
    },
  },
  {
    id: "hearth-newt",
    displayName: "Hearth Newt",
    dimension: DIMENSIONS.ash,
    mappingLane: "explicit healing received plus descent heal",
    identity: "A friendly limbless shoulder newt with a broad charcoal head-body, warm-glass belly language, heavy curled tail, and candle-flame-shaped solid paper crest. No realistic legs, weapon, enemy salamander aggression, actual flame, pickup glow, or turret read.",
    palette: { ink: "#111318", structureDark: "#22252B", structureMid: "#9E3B36", paperLight: "#C49A5A", signature: "#C0341F", core: "#FF8A2B" },
    particle: "pet-hearth-newt-ember-scale",
    stages: {
      1: [
        body("Round coal-pebble head-body with one friendly face mark, broad and charcoal-heavy, no legs."),
        part("tail", "rear", "tail", "One thick heavy curled newt tail card, blunt Hatchling hook, solid ash-red and basalt paper with a wide root collar; no flame or sparks."),
      ],
      2: [
        body("The exact coal head-body lengthened subtly, preserving face, root, body axis, and all sockets."),
        part("tail", "rear", "tail", "EDIT the same curled tail: slightly longer and deeper hook, preserving exact pivot and root collar; no actual fire."),
        part("belly-lens", "ventral", "weighty", "One complete warm-glass belly-lens plate cutout with basalt mounting stock around the root, flat ember coal center, no glow, aura, or medical icon."),
      ],
      3: [
        body("Mature compact traveling-hearth head-body; same face and sockets, with the existing belly-coal language visible but no emitted light."),
        part("tail", "rear", "tail", "EDIT the established tail to a mature sharper hook while keeping pivot/collar exact and silhouette friendly."),
        part("belly-lens", "ventral", "weighty", "EDIT the established belly-lens with a small permanently bright flat coal shape, exact bezel and pivot unchanged, no bloom."),
        part("flame-crest", "crown", "flutter", "A candle-flame-shaped SOLID card-stock crest with basalt root collar and ember-painted interior; it is not actual fire and emits nothing."),
      ],
    },
  },
  {
    id: "lodestar-moth",
    displayName: "Lodestar Moth",
    dimension: DIMENSIONS.frost,
    mappingLane: "XP-mote reach plus pre-cleanup XP sweep",
    identity: "A friendly cobalt moth with compact dark seed thorax, broad graphic compass-eye wing markings, one clear face mark, and a small solid astrolabe ring. The wing marks are never real eyes, reticles, pickup arrows, or enemy targeting symbols.",
    palette: { ink: "#111318", structureDark: "#23303F", structureMid: "#5A6472", paperLight: "#CFC6AE", signature: "#2E6E9E", core: "#9FD8E8" },
    particle: "pet-lodestar-moth-star-tick",
    stages: {
      1: [
        body("Compact round cobalt seed-thorax with one friendly face mark and muted secondary color."),
        part("folded-wing", "side.paired", "flutter", "One complete folded paired-wing card, broad moth shape with incomplete abstract compass-eye paint and a hidden dark-paper root collar; not a pickup compass."),
      ],
      2: [
        body("The same dark thorax lengthened subtly while preserving face, root, axis, and every socket."),
        part("far-wing", "side.far", "flutter", "Far broad cobalt moth wing with completed graphic compass-eye marking and dark attachment collar; eye is flat decoration, not organic or targeting UI."),
        part("near-wing", "side.near", "flutter", "Near broad cobalt moth wing with completed graphic compass-eye marking and dark attachment collar; foreground counterpart, not targeting UI."),
      ],
      3: [
        body("Mature compact thorax, exact established face and connectors, one tiny flat compass-needle core mark without glow."),
        part("far-wing", "side.far", "flutter", "EDIT the far wing with one restrained cathedral point; preserve compass marking, exact pivot, and collar geometry."),
        part("near-wing", "side.near", "flutter", "EDIT the near wing with one restrained cathedral point; preserve compass marking, exact pivot, and collar geometry."),
        part("astrolabe-ring", "crown", "weighty", "One small complete solid astrolabe ring card with a dark mounting collar and flat cobalt/frost compass needle; not a reticle, aura, halo effect, or pickup icon."),
      ],
    },
  },
  {
    id: "copper-snail",
    displayName: "Copper Snail",
    dimension: DIMENSIONS.west,
    mappingLane: "earned-weapon pickup reach plus a thirteenth bag slot",
    identity: "A friendly tiny limbless brass snail: low charcoal bean body, two short feeler nubs, magnetized copper coin-shell, strapped double pannier, and compass rim. Never show loose coins, loot shine, pickup arrow, bag UI, or enemy slug aggression.",
    palette: { ink: "#111318", structureDark: "#3A4049", structureMid: "#A8482E", paperLight: "#CFC6AE", signature: "#C49A5A", core: "#5A6472" },
    particle: "pet-copper-snail-brass-filing",
    stages: {
      1: [
        body("Low soft charcoal bean body with two tiny feeler nubs and one friendly face mark; no legs."),
        part("coin-shell", "shell", "weighty", "One oversized rounded copper coin-shell card with abstract magnet notch language kept muted; broad gunmetal underside collar, no denomination, currency symbol, or shine."),
      ],
      2: [
        body("The same low bean body subtly lengthened, preserving feelers, face, root, axis, and sockets."),
        part("coin-shell", "shell", "weighty", "EDIT the established copper shell with one clear recessed magnet notch; exact pivot, underside collar, and round silhouette unchanged."),
        part("double-pannier", "ventral", "weighty", "One single complete folded double-pannier card: two tiny strapped packs joined as one cutout with a broad body-colored root collar; no bag icon or loose loot."),
      ],
      3: [
        body("Mature compact pack-snail body, exact face and anchors, quiet materials without pickup language."),
        part("coin-shell", "shell", "weighty", "EDIT the same shell to mature finish, keeping exact magnet notch, pivot, collar, and silhouette."),
        part("double-pannier", "ventral", "weighty", "EDIT the established double pannier with sturdier edge tabs, exact pivot and collar unchanged, no loot contents."),
        part("compass-rim", "crown", "antenna", "One thin complete brass compass-rim cutout with a gunmetal mounting collar and one tiny flat north pip; no arrow, reticle, pickup ring, text, or glow."),
      ],
    },
  },
  {
    id: "gilded-gecko",
    displayName: "Gilded Gecko",
    dimension: DIMENSIONS.west,
    mappingLane: "legitimate earned-sale Scrip rate/cap plus larger max-level mint cap",
    identity: "A friendly limbless old-gold gecko with broad wedge head-body, abstract coin spots, a flexible curled tail, dorsal scale ribbon, and tiny balance pan nested at the tail tip. Never show coins, currency symbols, cash-register language, rarity sparkle, legs, or predator pose.",
    palette: { ink: "#111318", structureDark: "#22252B", structureMid: "#C49A5A", paperLight: "#E8E4D8", signature: "#C4B24A", core: "#A8482E" },
    particle: "pet-gilded-gecko-gold-scale",
    stages: {
      1: [
        body("Compact gold bean/wedge head-body with one friendly eye mark, abstract coin spots, and no legs."),
        part("curled-tail", "rear", "tail", "One blunt curled gecko tail card with broad charcoal/gold root collar and simple counterweight hook; no coin or emitted sparkle."),
      ],
      2: [
        body("The same wedge body subtly lengthened, face and spots preserved, root/axis/sockets exact."),
        part("curled-tail", "rear", "tail", "EDIT the same tail so the curl deepens like a quiet counterweight; preserve root pivot/collar and include complete tail-tip mounting stock."),
        part("dorsal-coin-ribbon", "dorsal", "flutter", "One flat dorsal scale ribbon card made of connected old-gold paper scales, with a broad charcoal mounting collar; abstract texture only, not currency."),
      ],
      3: [
        body("Mature compact wedge body, exact established face and connectors; one tiny flat scale-notch core, never glowing."),
        part("curled-tail", "rear", "tail", "EDIT the established tail into its mature balanced curl, keeping body pivot, tailTip child socket, and collars exact."),
        part("dorsal-coin-ribbon", "dorsal", "flutter", "EDIT the dorsal scale ribbon with a restrained mature edge rhythm; exact pivot and collar unchanged."),
        part("balance-pan", "tailTip", "weighty", "One tiny complete shop-scale pan card with a wide old-gold attachment tab for the donor tailTip child socket; no coins, currency, text, or sparkle.", "curled-tail"),
      ],
    },
  },
  {
    id: "brass-crab",
    displayName: "Brass Crab",
    dimension: DIMENSIONS.cyber,
    mappingLane: "gun/thrown reload-refill duration plus faster stowed reload/refill debt",
    identity: "A friendly hovering clockwork crab with squat brass shell-body, no walking legs, detached gauge-claws, and a thin solid ticking ring. It is companion-like and calm, never a hostile crab, reload icon, crosshair, cooldown dial, turret, or pickup.",
    palette: { ink: "#111318", structureDark: "#22252B", structureMid: "#3A4049", paperLight: "#5A6472", signature: "#C49A5A", core: "#33E6FF" },
    particle: "pet-brass-crab-clock-snip",
    stages: {
      1: [
        body("Round squat clockwork shell-body with one friendly face/gauge mark, no legs."),
        part("claw-yoke", "side.paired", "weighty", "One closed paired-claw yoke card: two blunt friendly gauge-claws joined as a single folded cutout with a broad gunmetal root collar; not a weapon or reload symbol."),
      ],
      2: [
        body("The same squat shell-body subtly broadened/lengthened with one wind-up notch, exact root, face, axis, and sockets."),
        part("far-claw", "side.far", "weighty", "Far detached blunt gauge-claw card with one nonfunctional flat needle mark and broad gunmetal collar; relaxed, never snapping."),
        part("near-claw", "side.near", "weighty", "Near detached blunt gauge-claw card with one opposing flat needle mark and broad gunmetal collar; relaxed, never snapping."),
      ],
      3: [
        body("Mature compact clockwork shell-body, exact face/connectors, one tiny flat cyan timing pip without glow."),
        part("far-claw", "side.far", "weighty", "EDIT the far gauge-claw with one restrained vane; preserve exact pivot/collar and avoid reload/cooldown iconography."),
        part("near-claw", "side.near", "weighty", "EDIT the near gauge-claw with one restrained opposing vane; preserve exact pivot/collar and avoid weapon aggression."),
        part("ticking-halo", "crown", "antenna", "One thin SOLID clockwork timing ring card with a broad dark mounting collar and a single tiny cyan pip; not emitted light, aura, crosshair, reload or cooldown dial."),
      ],
    },
  },
  {
    id: "pale-firefly",
    displayName: "Pale Firefly",
    dimension: DIMENSIONS.verdant,
    mappingLane: "revive-effect reach plus increased ally return HP",
    identity: "A friendly milk-white firefly with rounded lantern abdomen/body, dark mask notch, petal-like wing cases, and a paired ribbon-feeler card. No medical cross, revive ring, angel wings, full-white counter flash, pickup glow, or enemy insect pose.",
    palette: { ink: "#111318", structureDark: "#22252B", structureMid: "#3C6E6A", paperLight: "#CFC6AE", signature: "#E8E4D8", core: "#9FD8E8" },
    particle: "pet-pale-firefly-milk-dust",
    stages: {
      1: [
        body("Rounded milk-glass lantern abdomen/body with dark friendly mask notch and muted core, no glow."),
        part("folded-wing-case", "side.paired", "flutter", "One complete folded paired wing-case card: two compact milk-paper petals joined as one cutout with broad charcoal/teal root collar; not angel wings."),
      ],
      2: [
        body("The same rounded lantern body subtly lengthened, face notch/root/axis/sockets exact, with a dull-teal band and no cross."),
        part("far-wing", "side.far", "flutter", "Far petal-like wing case with milk-paper surface and broad dark/teal attachment collar; calm and closed enough for a companion."),
        part("near-wing", "side.near", "flutter", "Near petal-like wing case with milk-paper surface and broad dark/teal attachment collar; foreground counterpart, not angelic."),
      ],
      3: [
        body("Mature compact lantern body, exact face and anchors, existing abdomen core now one small permanently bright flat cyan shape without bloom."),
        part("far-wing", "side.far", "flutter", "EDIT the far wing case with one restrained petal tip, preserving exact pivot and collar."),
        part("near-wing", "side.near", "flutter", "EDIT the near wing case with one restrained petal tip, preserving exact pivot and collar."),
        part("ribbon-feeler", "rear", "tail", "One complete PAIRED ribbon-feeler card: two soft paper ribbons joined at one broad dull-teal root collar, designed to hang ventrally; no medical icon, ring, or emitted trail."),
      ],
    },
  },
  {
    id: "slate-tortoise",
    displayName: "Slate Tortoise",
    dimension: DIMENSIONS.verdant,
    mappingLane: "pit/ground-hazard mitigation plus post-pit regeneration boost",
    identity: "A friendly palm-sized limbless rune-stone tortoise: low mask-head body peeking from a broad slate shell, moss seams, stacked cairn plates, recessed pale-blue core. Never a shield pickup, safe-zone marker, immunity tell, enemy tank, or creature with realistic legs.",
    palette: { ink: "#111318", structureDark: "#22252B", structureMid: "#5A6472", paperLight: "#6E7042", signature: "#3C6E6A", core: "#9FD8E8" },
    particle: "pet-slate-tortoise-rune-grit",
    stages: {
      1: [
        body("Low rounded mask-head body peeking forward with one friendly face mark and no legs."),
        part("shell-cap", "shell", "weighty", "One broad rounded slate shell-cap card with moss seam paint and a wide charcoal/slate underside collar; no shield emblem or aura."),
      ],
      2: [
        body("The same mask-head body subtly lengthened, exact face/root/axis/sockets, rune seams becoming readable but non-iconic."),
        part("shell-cap", "shell", "weighty", "EDIT the established shell cap with clearer muted rune seams; exact pivot, underside collar, and rounded silhouette unchanged."),
        part("cairn-plate", "dorsal", "weighty", "One complete mossy offset cairn top-plate cutout with broad slate mounting stock beneath; a quiet stacked stone, not armor pickup or shield icon."),
      ],
      3: [
        body("Mature compact mask-head body, exact established face and connectors, recessed core language only, no glow."),
        part("shell-cap", "shell", "weighty", "EDIT the same rounded shell cap to mature slate finish, preserving exact pivot/collar and rune layout."),
        part("cairn-plate", "dorsal", "weighty", "EDIT the established cairn plate with one offset ledge, exact pivot and underside collar unchanged."),
        part("core-shutter", "ventral", "weighty", "One small complete recessed core-shutter plate with broad slate mounting collar and one tiny flat pale-blue core wedge; no shield, safe-zone, eye, or emitted light."),
      ],
    },
  },
];

function socketFor(slot) {
  return SOCKETS.find((socket) => socket.id === slot) ?? null;
}

function springFor(partDef, stage) {
  if (!partDef.preset) return null;
  const spring = { ...SPRINGS[partDef.preset] };
  if (stage === 1) spring.maxDeg = Number((spring.maxDeg * 0.75).toFixed(2));
  return spring;
}

function receiverAnchor(partDef) {
  if (partDef.slot === "body") return { frame: "PET_SOCKET_FRAME_V1", socket: "body", xL: 0, yL: 0, raw: BODY_ROOT };
  if (partDef.slot === "tailTip") {
    return { frame: "PET_SOCKET_FRAME_V1", socket: "tailTip", parent: partDef.parent, xL: 0.42, yL: 0, raw: null };
  }
  const socket = socketFor(partDef.slot);
  return { frame: "PET_SOCKET_FRAME_V1", socket: socket.id, xL: socket.xL, yL: socket.yL, raw: socket.raw };
}

function decoratePart(pet, stage, partDef) {
  const socket = socketFor(partDef.slot);
  return {
    ...partDef,
    pet,
    stage,
    stageName: STAGE_NAMES[stage],
    pivot: SOURCE_PIVOTS[partDef.slot],
    receiverAnchor: receiverAnchor(partDef),
    restAngle: socket?.restAngle ?? 0,
    mountScale: socket?.mountScale ?? 1,
    plane: socket?.plane ?? (partDef.slot === "tailTip" ? 20 : 0),
    spring: springFor(partDef, stage),
  };
}

const JOBS = [];
for (const stage of [1, 2, 3]) {
  for (const pet of PETS) {
    for (const partDef of pet.stages[stage]) JOBS.push(decoratePart(pet, stage, partDef));
  }
}

if (JOBS.length !== 72) throw new Error(`Roster contract drift: expected 72 pet part renders, found ${JOBS.length}`);

function rawPath(job) {
  return resolve(MASTERS, job.pet.id, `s${job.stage}`, `${job.id}.png`);
}

function installedPath(job) {
  return resolve(DST, job.pet.id, `s${job.stage}`, `${job.id}.png`);
}

function repoPath(path) {
  return relative(REPO, path).replaceAll("\\", "/");
}

function earlierJob(job) {
  if (job.stage === 1) return null;
  return JOBS.find((candidate) => candidate.pet.id === job.pet.id && candidate.id === job.id && candidate.stage === job.stage - 1) ?? null;
}

function stageBodyJob(job) {
  return JOBS.find((candidate) => candidate.pet.id === job.pet.id && candidate.stage === job.stage && candidate.id === "body");
}

function identityJob(job) {
  return JOBS.find((candidate) => candidate.pet.id === job.pet.id && candidate.stage === 1 && candidate.id === "body");
}

function bestReference(job) {
  const raw = rawPath(job);
  if (existsSync(raw)) return raw;
  const installed = installedPath(job);
  return existsSync(installed) ? installed : null;
}

function referencesFor(job) {
  const refs = [];
  const previous = earlierJob(job);
  const currentBody = stageBodyJob(job);
  const identity = identityJob(job);
  for (const candidate of [previous, job.id === "body" ? null : currentBody, identity]) {
    if (!candidate || candidate === job) continue;
    const ref = bestReference(candidate);
    if (ref && !refs.includes(ref)) refs.push(ref);
  }
  return refs;
}

function attachmentTicket(job) {
  return JSON.stringify({
    id: job.id,
    slotClass: job.class,
    slot: job.slot,
    parent: job.parent,
    pivotSource: job.pivot,
    receiverAnchor: job.receiverAnchor,
    restAngleDeg: job.restAngle,
    mountScale: job.mountScale,
    plane: job.plane,
    spring: job.spring,
    hiddenCollarPercent: job.id === "body" ? null : [10, 12],
  });
}

const SOCKET_TICKET = JSON.stringify(SOCKETS.map((socket) => ({
  id: socket.id,
  normalized: { xL: socket.xL, yL: socket.yL },
  raw: socket.raw,
  restAngleDeg: socket.restAngle,
  mountScale: socket.mountScale,
  plane: socket.plane,
})));

function promptFor(job, refs) {
  const paletteTicket = JSON.stringify(job.pet.palette);
  const repeatedEdit = earlierJob(job) ? `Image 1 is the approved earlier-stage master of THIS SAME PART. EDIT from it; preserve its identity, attachment-root geometry, pivot, lighting direction, and outline language exactly.` : "";
  const referenceText = refs.length
    ? `REFERENCE IMAGES\n${refs.map((_, index) => `- Image ${index + 1}: canonical ${index === 0 ? "edit/identity" : "supporting identity"} reference for this pet. Do not copy its green/transparent background into the part.`).join("\n")}\n${repeatedEdit}`
    : "REFERENCE IMAGES\n- None. This body render establishes the canonical stage-1 identity master.";
  const placement = job.id === "body"
    ? `Render ONLY the root body. Its authored root centroid is exactly (${job.pivot.x},${job.pivot.y}); center the body there inside a 380x380 safe box. The rump-to-face +X body axis L is exactly ${AXIS_LENGTH} raw pixels.`
    : `Render ONLY the isolated \`${job.id}\` cutout—NO body and NO other anatomy. Its authored source pivot is exactly (${job.pivot.x},${job.pivot.y}) in its assigned outer bay. Keep the complete cutout near that bay with generous pure-green padding. The attachment-root stock must cover the pivot and extend 10–12% beyond it as an ordinary painted registration collar.`;

  return `# CHAT ISOLATION — ONE PET, ONE STAGE, ONE PART
This ticket targets only ${job.pet.id}, stage ${job.stage} (${job.stageName}), part ${job.id}. Disregard every other creature or image-generation turn. Generate ONE standalone PNG source image for Dimension Drifters, an HD 2D top-down co-op bullet-heaven.

EXECUTION PATH — BINDING
- Use the built-in image_gen tool for this raster render.
- If image_gen is blocked, fails, or is unavailable, STOP WITHOUT CREATING A FILE. Do not substitute PowerShell/System.Drawing, Python/Pillow, SVG, HTML/canvas, procedural drawing code, a placeholder, or any other synthetic fallback. The outer generator must receive no PNG so it can record a clean resumable failure.

PET IDENTITY — IMMUTABLE
- Display name: ${job.pet.displayName}
- Dimension origin: ${job.pet.dimension}
- Systems/identity lane: ${job.pet.mappingLane}
- Identity lock: ${job.pet.identity}
- This stage/part only: ${job.description}
- Runtime-only particle ${job.pet.particle}: DO NOT PAINT IT.
- This is a loyal cosmetic companion. It must NEVER read as an enemy, pickup, loot item, weapon, turret, telegraph, combat target, or stat icon.

${referenceText}

HOUSE STYLE — NON-NEGOTIABLE
- Original, trademark-distinct, compact horizontally biased creature anatomy; body-first, no human anatomy or human face.
- HD paper-cutout 2D game art, NOT pixel art, soft anime, photorealism, polished toy, or collectible mascot.
- Heavy slightly uneven hand-inked near-black outer contour; only a few decisive interior ink marks. Matte painted card stock with a few edge nicks.
- Flat cel shading only: base color plus ONE hard shadow band and AT MOST ONE hard highlight per material. No gradients, ambient occlusion, airbrush, bloom, or baked glow.
- Exact six palette-role swatches: ${paletteTicket}. Do not introduce near-duplicate shades. Saturated signature plus core covers at most 8% of visible area; 70–80% remains dark/materially muted.
- Tiny off-white friendly collar stitch may appear on the BODY only. No text, logo, UI, frame, floor, cast shadow, environment, aura, ring, trail, dust, sparks, motes, particles, or emitted VFX.

CAMERA, ORIENTATION, AND PART ISOLATION
- Slightly high THREE-QUARTER TOP-DOWN arena view, visual depth compression about 0.62, facing +X/SCREEN-RIGHT. Show top and near/front planes. Not side profile, front view, or isometric.
- Neutral hovering rest anatomy only. No attack, running, lunging, snapping, celebration, or dramatic action pose.
- ${placement}
- The canvas contains EXACTLY ONE complete opaque paper island: ${job.id}. No duplicate, assembled pet, hidden extra part, nesting, guide, label, pivot mark, or assembly line.

FUSION REGISTRATION — PET_SOCKET_FRAME_V1 — REQUIRED
- Canvas is 1024x1024. Body-local origin is (${BODY_ROOT.x},${BODY_ROOT.y}); body faces +X/screen-right; rump-to-face axis L=${AXIS_LENGTH}.
- Design body stock as continuous painted card beneath every socket zone, including unused native sockets. Never draw socket marks, holes, generic joints, guides, or mechanical collars.
- Exact body socket table: ${SOCKET_TICKET}
- Exact machine attachment row for this part: ${attachmentTicket(job)}
- Preserve all existing socket and pivot geometry within 4 raw pixels and 2 degrees of the approved reference. New stage anatomy may not move an old connector.
- Non-body attachment roots contain 10–12% hidden painted overlap beyond the pivot. The collar is ordinary species structureMid material, wide enough to remain covered at the full allowed shift; one narrow signature stitch is allowed, never glow.
- Material/stage edits may change only the explicitly allowed paint and outer silhouette. They may not change connector geometry.

OUTPUT FORMAT
- Exactly 1024x1024 PNG. Background is perfectly flat, fully opaque, uniform pure #00ff00 with no lighting variation. Never use #00ff00 or chroma-like lime in the art.
- Keep at least 64 raw pixels of uninterrupted pure green between the cutout bounds and canvas edges. No floor, contact shadow, reflection, transparency, checkerboard, vignette, border, text, or watermark.
- Return ONE standalone image, not a grid, montage, contact sheet, multi-stage lineup, rig sheet, turntable, or card.

Before returning verify: one pet identity; stage ${job.stage}; ONLY ${job.id}; screen-right top-down 3/4; exact authored pivot placement; clean green field; no baked VFX/shadow/text; friendly companion read; identity and connectors unchanged.`;
}

function alphaBounds(data, width, height, threshold = 8) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  let visiblePixelCount = 0;
  let opaquePixelCount = 0;
  let alphaWeight = 0;
  let weightedX = 0;
  let weightedY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
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
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
    right,
    bottom,
    visiblePixelCount,
    opaquePixelCount,
    alphaCentroid: { x: weightedX / alphaWeight, y: weightedY / alphaWeight },
  };
}

function desiredAnchor(bounds, slot) {
  const fractions = {
    "side.far": [0.85, 0.78],
    "side.near": [0.15, 0.78],
    "side.paired": [0.5, 0.78],
    rear: [0.88, 0.5],
    crown: [0.5, 0.82],
    shell: [0.5, 0.62],
    dorsal: [0.5, 0.80],
    ventral: [0.5, 0.20],
    tailTip: [0.12, 0.5],
  };
  if (slot === "body") return bounds.alphaCentroid;
  const [fx, fy] = fractions[slot];
  return { x: bounds.left + bounds.width * fx, y: bounds.top + bounds.height * fy };
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

function placeRgba(data, width, height, left, top) {
  const placed = Buffer.alloc(CANVAS.width * CANVAS.height * 4);
  if (left < 0 || top < 0 || left + width > CANVAS.width || top + height > CANVAS.height) return placed;
  for (let sourceY = 0; sourceY < height; sourceY++) {
    const sourceStart = sourceY * width * 4;
    const sourceEnd = sourceStart + width * 4;
    const targetStart = ((top + sourceY) * CANVAS.width + left) * 4;
    data.copy(placed, targetStart, sourceStart, sourceEnd);
  }
  return placed;
}

async function processAndInstall(job, raw, dst) {
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

  const initialBounds = alphaBounds(data, info.width, info.height);
  if (!initialBounds) throw new Error("chroma key removed the entire render");
  const approximate = desiredAnchor(initialBounds, job.slot);
  const authoredPixel = nearestVisible(data, info.width, initialBounds, approximate);
  if (!authoredPixel) throw new Error("could not locate opaque stock for the authored pivot");
  const maxBounds = job.id === "body" ? 380 : 340;
  const scale = Math.min(1, maxBounds / initialBounds.width, maxBounds / initialBounds.height);
  const registeredWidth = Math.max(1, Math.round(initialBounds.width * scale));
  const registeredHeight = Math.max(1, Math.round(initialBounds.height * scale));
  const cutout = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({ left: initialBounds.left, top: initialBounds.top, width: initialBounds.width, height: initialBounds.height })
    .resize(registeredWidth, registeredHeight, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .raw()
    .toBuffer();
  const anchorX = (authoredPixel.x - initialBounds.left) * registeredWidth / initialBounds.width;
  const anchorY = (authoredPixel.y - initialBounds.top) * registeredHeight / initialBounds.height;
  const placementLeft = Math.round(job.pivot.x - anchorX);
  const placementTop = Math.round(job.pivot.y - anchorY);
  const registered = placeRgba(cutout, registeredWidth, registeredHeight, placementLeft, placementTop);
  const bounds = alphaBounds(registered, info.width, info.height);
  if (!bounds) throw new Error("registration translation moved the entire part off canvas");

  const minOpaque = job.id === "body" ? 2000 : 400;
  if (bounds.opaquePixelCount < minOpaque || bounds.opaquePixelCount > 160000) {
    throw new Error(`opaque coverage ${bounds.opaquePixelCount} outside sane range ${minOpaque}..160000`);
  }
  const pivotAlpha = registered[(Math.round(job.pivot.y) * info.width + Math.round(job.pivot.x)) * 4 + 3];
  if (pivotAlpha < 64) throw new Error(`authored pivot is not inside painted stock (alpha ${pivotAlpha})`);
  if (bounds.left < 32 || bounds.top < 32 || bounds.right >= info.width - 32 || bounds.bottom >= info.height - 32) {
    throw new Error(`registered alpha bounds violate 32px emergency canvas inset: ${JSON.stringify(bounds)}`);
  }

  const png = await sharp(registered, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  const metadata = await sharp(png).metadata();
  if (metadata.width !== CANVAS.width || metadata.height !== CANVAS.height || metadata.channels !== 4 || metadata.hasAlpha !== true) {
    throw new Error(`encoded PNG metadata invalid: ${JSON.stringify(metadata)}`);
  }
  mkdirSync(dirname(dst), { recursive: true });
  writeFileSync(dst, png);
  console.log(`INSTALLED ${repoPath(dst)} opaque=${bounds.opaquePixelCount} visible=${bounds.visiblePixelCount} bounds=${bounds.width}x${bounds.height}@${bounds.left},${bounds.top}`);
}

async function inspectInstalled(job, path) {
  const metadata = await sharp(path).metadata();
  if (metadata.width !== CANVAS.width || metadata.height !== CANVAS.height || metadata.channels !== 4 || metadata.hasAlpha !== true) {
    throw new Error(`metadata expected 1024x1024 RGBA, got ${metadata.width}x${metadata.height} channels=${metadata.channels} alpha=${metadata.hasAlpha}`);
  }
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bounds = alphaBounds(data, info.width, info.height);
  if (!bounds) throw new Error("no visible alpha pixels");
  const minOpaque = job.id === "body" ? 2000 : 400;
  if (bounds.opaquePixelCount < minOpaque || bounds.opaquePixelCount > 160000) throw new Error(`opaque coverage ${bounds.opaquePixelCount} outside sane range`);
  const pivotAlpha = data[(Math.round(job.pivot.y) * info.width + Math.round(job.pivot.x)) * 4 + 3];
  if (pivotAlpha < 64) throw new Error(`pivot alpha ${pivotAlpha} is below 64`);
  return {
    bounds,
    image: {
      width: metadata.width,
      height: metadata.height,
      channels: metadata.channels,
      hasAlpha: metadata.hasAlpha,
      format: metadata.format,
      opaquePixelCount: bounds.opaquePixelCount,
      visiblePixelCount: bounds.visiblePixelCount,
      transparentPixelCount: metadata.width * metadata.height - bounds.visiblePixelCount,
      pivotAlpha,
    },
  };
}

function parseOptions(argv) {
  const options = { force: false, validateOnly: false, stage: null, pet: null, part: null, only: null, maxJobs: Number.POSITIVE_INFINITY };
  for (const arg of argv) {
    if (arg === "--force") options.force = true;
    else if (arg === "--validate-only") options.validateOnly = true;
    else if (arg.startsWith("--stage=")) options.stage = Number(arg.slice(8));
    else if (arg.startsWith("--pet=")) options.pet = arg.slice(6);
    else if (arg.startsWith("--part=")) options.part = arg.slice(7).replace(/\.png$/i, "");
    else if (arg.startsWith("--only=")) options.only = arg.slice(7).replace(/\.png$/i, "");
    else if (arg.startsWith("--max-jobs=")) options.maxJobs = Number(arg.slice(11));
    else if (!arg.startsWith("--") && !options.pet) options.pet = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function selectedJobs(options) {
  let jobs = JOBS.filter((job) => {
    const key = `${job.pet.id}/s${job.stage}/${job.id}`;
    return (!options.stage || job.stage === options.stage)
      && (!options.pet || job.pet.id === options.pet)
      && (!options.part || job.id === options.part)
      && (!options.only || key === options.only);
  });
  if (Number.isFinite(options.maxJobs)) jobs = jobs.slice(0, Math.max(0, options.maxJobs));
  return jobs;
}

function listPngs(root) {
  const files = [];
  const walk = (directory) => {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.toLowerCase().endsWith(".png")) files.push(path);
    }
  };
  walk(root);
  return files.sort();
}

async function emitManifest() {
  const petRows = [];
  const installedPaths = new Set();
  const invalid = [];
  for (const pet of PETS) {
    const stages = [];
    for (const stage of [1, 2, 3]) {
      const parts = [];
      for (const job of JOBS.filter((candidate) => candidate.pet.id === pet.id && candidate.stage === stage)) {
        const path = installedPath(job);
        if (!existsSync(path)) continue;
        try {
          const inspected = await inspectInstalled(job, path);
          installedPaths.add(repoPath(path));
          parts.push({
            id: job.id,
            texture: `${job.id}.png`,
            installedFile: repoPath(path),
            donorPetId: pet.id,
            stage,
            class: job.class,
            slot: job.slot,
            parent: job.parent,
            pivotSource: job.pivot,
            pivotTrimmed: job.pivot,
            receiverAnchor: job.receiverAnchor,
            restAngle: job.restAngle,
            mountScale: job.mountScale,
            plane: job.plane,
            spring: job.spring,
            paletteRoles: pet.palette,
            alphaBounds: {
              left: inspected.bounds.left,
              top: inspected.bounds.top,
              width: inspected.bounds.width,
              height: inspected.bounds.height,
            },
            image: inspected.image,
          });
        } catch (error) {
          invalid.push({ file: repoPath(path), error: error.message });
        }
      }
      if (parts.length > 0) {
        stages.push({
          stage,
          stageName: STAGE_NAMES[stage],
          body: {
            axisLength: AXIS_LENGTH,
            rootSource: BODY_ROOT,
            sockets: SOCKETS,
            paletteRoles: pet.palette,
          },
          parts,
        });
      }
    }
    if (stages.length > 0) petRows.push({ id: pet.id, displayName: pet.displayName, stages });
  }

  const expected = new Set(JOBS.map((job) => repoPath(installedPath(job))));
  const actual = new Set(listPngs(DST).map(repoPath));
  const missing = [...expected].filter((path) => !installedPaths.has(path)).sort();
  const extras = [...actual].filter((path) => !installedPaths.has(path)).sort();
  const manifest = {
    schemaVersion: 1,
    socketFrame: {
      id: "PET_SOCKET_FRAME_V1",
      canvas: CANVAS,
      bodyRootSource: BODY_ROOT,
      axisLength: AXIS_LENGTH,
      coordinateUnits: { source: "untrimmed 1024x1024 pixels", receiver: "body-axis lengths L" },
      sockets: SOCKETS,
      childSockets: [{ id: "tailTip", parentSlot: "rear", xL: 0.42, yL: 0, restAngle: 0, mountScale: 1, plane: 20 }],
      connectorTolerance: { pixels: 4, degrees: 2 },
      hiddenCollarPercent: [10, 12],
    },
    expectedPartCount: JOBS.length,
    installedPartCount: installedPaths.size,
    pets: petRows,
    missing,
    extras,
    invalid,
  };
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`MANIFEST ${repoPath(MANIFEST_PATH)} installed=${installedPaths.size}/${JOBS.length} missing=${missing.length} extras=${extras.length} invalid=${invalid.length}`);
  return manifest;
}

const options = parseOptions(process.argv.slice(2));
const jobs = selectedJobs(options);
if (!options.validateOnly && jobs.length === 0) throw new Error("No pet render jobs matched the supplied selectors");

let failures = 0;
if (!options.validateOnly) {
  console.log(`PET ART RUN jobs=${jobs.length} order=stage-first force=${options.force}`);
  for (const job of jobs) {
    const key = `${job.pet.id}/s${job.stage}/${job.id}`;
    const raw = rawPath(job);
    const dst = installedPath(job);
    mkdirSync(dirname(raw), { recursive: true });
    if (options.force || (!existsSync(raw) && !existsSync(dst))) {
      const refs = referencesFor(job);
      if ((job.id !== "body" || job.stage > 1) && refs.length === 0) {
        console.log(`RENDER FAIL ${key}: identity/body reference missing; resume after its body master exists`);
        failures++;
        continue;
      }
      console.log(`RENDER ${key} refs=${refs.length}`);
      const stdoutFile = resolve(OUT, "logs", job.pet.id, `s${job.stage}-${job.id}.log`);
      mkdirSync(dirname(stdoutFile), { recursive: true });
      const harvestTo = options.force && existsSync(raw)
        ? resolve(dirname(raw), `${job.id}.force-${Date.now()}.png`)
        : raw;
      const code = await runCodexExec({
        label: `pet-${job.pet.id}-s${job.stage}-${job.id}`,
        cwd: REPO,
        prompt: promptFor(job, refs),
        images: refs,
        harvestTo,
        stdoutFile,
      });
      const renderLog = existsSync(stdoutFile) ? readFileSync(stdoutFile, "utf8") : "";
      const disallowedFallback = /moderation_blocked|codex_core::tools::router: error=image generation failed|System\.Drawing\.Bitmap|PIL unavailable|raster script failed/i.test(renderLog);
      if (disallowedFallback) {
        const rejectedSource = existsSync(harvestTo) ? harvestTo : (harvestTo === raw && existsSync(raw) ? raw : null);
        if (rejectedSource) {
          const rejectedDir = resolve(OUT, "rejected", job.pet.id);
          mkdirSync(rejectedDir, { recursive: true });
          const rejected = resolve(rejectedDir, `s${job.stage}-${job.id}-${Date.now()}.png`);
          renameSync(rejectedSource, rejected);
          console.log(`REJECTED ${key}: blocked image call or code-drawn fallback moved to ${repoPath(rejected)}`);
        } else {
          console.log(`REJECTED ${key}: blocked image call or attempted code-drawn fallback`);
        }
        failures++;
        continue;
      }
      if (harvestTo !== raw && existsSync(harvestTo)) {
        copyFileSync(harvestTo, raw);
        rmSync(harvestTo, { force: true });
      }
      if (!existsSync(raw)) {
        console.log(`RENDER FAIL ${key} exit=${code}`);
        failures++;
        continue;
      }
    } else {
      console.log(`RESUME ${key}: source/install already exists`);
    }

    if (!existsSync(raw) && existsSync(dst) && !options.force) {
      try {
        await inspectInstalled(job, dst);
        console.log(`VALID EXISTING ${key}`);
      } catch (error) {
        console.log(`INSTALL FAIL ${key}: ${error.message}`);
        failures++;
      }
      continue;
    }
    try {
      await processAndInstall(job, raw, dst);
    } catch (error) {
      console.log(`INSTALL FAIL ${key}: ${error.message}`);
      failures++;
    }
  }
}

const manifest = await emitManifest();
if (manifest.extras.length > 0 || manifest.invalid.length > 0) failures++;
console.log(failures ? `DONE with ${failures} failure(s); rerun the same command to resume` : "DONE all selected renders installed and manifest verified");
if (failures > 0) process.exitCode = 1;
