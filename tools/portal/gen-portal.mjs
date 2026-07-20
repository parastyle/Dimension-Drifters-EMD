#!/usr/bin/env node
// Generate the Dimension Drifters developer portal from the built shared catalogs.
//
//   node tools/portal/gen-portal.mjs        -> tools/portal/index.html
//
// The output is deliberately self-contained (inline CSS/JS). Art and audio stay as relative references to
// packages/client/public so the portal works when opened from disk or served from the repository root.
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emit, isCheck } from "../artkit/lib/emit.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const PUBLIC_DIR = resolve(REPO, "packages/client/public");
const PUBLIC_REL = "../../packages/client/public";
const sharedDist = resolve(REPO, "packages/shared/dist/index.js");
const GEAR_MANIFEST = resolve(REPO, "tools/artkit/out/gear/gear-parts-manifest.json");

if (isCheck && !existsSync(sharedDist)) {
  console.warn(
    "tools/portal/index.html check SKIPPED - packages/shared/dist/index.js is unavailable.",
  );
  process.exit(0);
}

const shared = await import(pathToFileURL(sharedDist).href);
const {
  AUGMENTS,
  AUGMENT_IDS,
  BEAM_AUGMENT_IDS,
  BELT_LEVELS,
  BOSSES,
  BOSS_DEF_IDS,
  CHARACTER_KITS,
  DIMENSIONS,
  DIMENSION_IDS,
  ENEMY_KINDS,
  EXPANSION_WEAPON_IDS,
  GEAR_CATALOG,
  GEAR_IDS,
  PET_CATALOG,
  PET_IDS,
  PET_STAGE_DEFS,
  PLAYABLE_CHARACTERS,
  ULTIMATE_VARIANTS,
  UltimateFamily,
  WEAPONS,
  WEAPON_IDS,
  characterName,
  ultimateCodeFor,
} = shared;

function prettyId(id) {
  return String(id)
    .replace(/^(cc-|x-)/, "")
    .replace(/[-_/]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function kebab(value) {
  return String(value).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function publicAsset(relativePath) {
  return `${PUBLIC_REL}/${relativePath.replace(/\\/g, "/")}`;
}

function firstExistingPublic(...relativePaths) {
  for (const relativePath of relativePaths) {
    if (relativePath && existsSync(resolve(PUBLIC_DIR, relativePath)))
      return publicAsset(relativePath);
  }
  return "";
}

/** Pick a current rig image without hard-coding per-asset filenames. */
function rigThumbnail(id, preferred = ["body.png", "part-1.png"]) {
  const relativeDir = join("sprites", id);
  const absoluteDir = resolve(PUBLIC_DIR, relativeDir);
  if (!existsSync(absoluteDir)) return "";
  const files = readdirSync(absoluteDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        [".png", ".jpg", ".jpeg", ".webp"].includes(extname(entry.name).toLowerCase()),
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
  const picked =
    preferred.find((name) => files.includes(name)) ??
    files.find((name) => /(^|[-_])(body|head)([-_.]|$)/i.test(name)) ??
    files[0];
  return picked ? publicAsset(join(relativeDir, picked)) : "";
}

function normalizedDelivery(weapon) {
  const delivery = weapon?.tags?.delivery;
  if (delivery === "beam") return "beam";
  if (delivery === "thrown") return "thrown";
  if (weapon?.tags?.classPool === "caster") return "cast";
  if (delivery === "projectile" || delivery === "spread" || weapon?.gun) return "gun";
  return "melee";
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

const gearManifest = readJson(GEAR_MANIFEST, { slots: [], missing: [] });
const installedGearIds = new Set(
  (gearManifest.slots ?? []).flatMap((slot) => (slot.items ?? []).map((item) => item.id)),
);
const missingGearIds = new Set(
  (gearManifest.missing ?? [])
    .map((path) => String(path).match(/\/([^/]+)\.png$/)?.[1])
    .filter(Boolean),
);

function explicitArtStatus({ ready, intentional = false, rendering = false, expected = true }) {
  if (rendering) return "rendering";
  if (ready) return "ready";
  if (intentional || !expected) return "artless";
  return "unavailable";
}

function bossNameFor(kind) {
  const def = shared.bossDefFor?.(kind);
  if (def && def.kind !== kind) return `${prettyId(kind)} - ${def.name}`;
  return def?.name ?? BOSSES[kind]?.name ?? prettyId(kind);
}

function bossSize(kind) {
  const radius = ENEMY_KINDS?.[kind]?.radius;
  if (kind === "seam-eater" || (Number.isFinite(radius) && radius > 90)) return "colossal";
  if (Number.isFinite(radius) && radius <= 40) return "duelist";
  return "large";
}

function topStats(spread) {
  const pairs = Object.entries(spread ?? {}).sort((a, b) => Number(b[1]) - Number(a[1]));
  if (!pairs.length) return "no spread";
  const peak = Number(pairs[0][1]);
  return pairs
    .filter(([, value]) => Number(value) === peak)
    .map(([key]) => key.toUpperCase())
    .join("/");
}

const weaponIds = [...WEAPON_IDS, ...EXPANSION_WEAPON_IDS];
const weapons = weaponIds.map((id) => {
  const weapon = WEAPONS[id];
  const family = weapon?.tags?.family ?? "untyped";
  const delivery = normalizedDelivery(weapon);
  const grip = weapon?.tags?.grip ?? (weapon?.twoHanded ? "2H" : "1H");
  const thumb =
    firstExistingPublic(join("sprites", id, "part-1.png"), join("cards", `${id}.jpg`)) ||
    rigThumbnail(id);
  return {
    key: id,
    id,
    copyId: id,
    name: weapon?.name ?? prettyId(id),
    thumb,
    glyph: "W",
    facts: [family, delivery, grip],
    keywords: [
      family,
      delivery,
      grip,
      weapon?.tags?.classPool,
      weapon?.tags?.element,
      weapon?.tags?.size,
      weapon?.tags?.rangeBand,
      weapon?.tags?.fireMode,
      weapon?.expansion ? "expansion" : "base",
      "rarity loot",
    ].filter(Boolean),
    family,
    weaponClass: weapon?.tags?.classPool ?? "weapon",
    delivery,
    grip,
    element: weapon?.tags?.element ?? "physical",
    rarityCapable: true,
    source: weapon?.expansion ? "expansion" : "base",
    artStatus: explicitArtStatus({ ready: Boolean(thumb) }),
    action: "launch",
    path: `/?dev=weapon:${encodeURIComponent(id)}`,
    actionLabel: "Open in Testing Grounds",
  };
});

const gear = GEAR_IDS.map((id) => {
  const item = GEAR_CATALOG[id];
  const slot = kebab(item.slot);
  const set = item.legacySetId ?? item.originPool ?? "utility";
  const thumb = firstExistingPublic(join("sprites", "gear", slot, `${item.artKey}.png`));
  const intentionalArtless = id.startsWith("blank-drifter-");
  const expectedArt = !intentionalArtless;
  return {
    key: id,
    id,
    copyId: id,
    name: item.name,
    thumb,
    glyph: "G",
    facts: [prettyId(slot), item.rarity, prettyId(set)],
    keywords: [
      slot,
      item.slot,
      item.rarity,
      set,
      item.gearClass,
      item.powerTag,
      item.effectText,
      item.originPool,
    ].filter(Boolean),
    slot,
    rarity: item.rarity,
    set,
    gearClass: item.gearClass,
    ownership: intentionalArtless
      ? "Default blank"
      : item.legacySetId
        ? "Player catalog"
        : "Pool / utility",
    artStatus: explicitArtStatus({
      ready: installedGearIds.has(id) || Boolean(thumb),
      intentional: intentionalArtless,
      expected: expectedArt || missingGearIds.has(id),
    }),
    action: "launch",
    path: `/?dev=gear:${encodeURIComponent(id)}`,
    actionLabel: "Equip in Testing Grounds",
  };
});

const gearSetMembers = new Map();
for (const item of gear) {
  if (!gearSetMembers.has(item.set)) gearSetMembers.set(item.set, []);
  gearSetMembers.get(item.set).push(item);
}
const playerCompletableSets = new Set(
  [...gearSetMembers.entries()]
    .filter(([setId, members]) => setId !== "blank-drifter" && members.length === 8)
    .map(([setId]) => setId),
);
for (const item of gear) {
  const members = gearSetMembers.get(item.set) ?? [];
  item.playerCompletableSet = playerCompletableSets.has(item.set);
  item.setSize = members.length;
  item.setArtReady = members.filter((member) => member.artStatus === "ready").length;
  item.setMissingArt = members
    .filter((member) => member.artStatus !== "ready" && member.artStatus !== "artless")
    .map((member) => prettyId(member.slot));
}

const dimensionBosses = new Map(
  Object.values(DIMENSIONS).map((dimension) => [dimension.boss, dimension.name]),
);
const bossIds = [...new Set([...BOSS_DEF_IDS, ...dimensionBosses.keys()])];
const bosses = bossIds.map((id) => {
  const resolved = shared.bossDefFor?.(id);
  const type = resolved?.encounter ?? resolved?.move ?? "scripted";
  const size = bossSize(id);
  const source = dimensionBosses.get(id) ?? "Bespoke encounter";
  return {
    key: id,
    id,
    copyId: id,
    name: bossNameFor(id),
    thumb: rigThumbnail(id),
    glyph: "B",
    facts: [size, type, source],
    keywords: [
      size,
      type,
      source,
      resolved?.name,
      resolved?.kind,
      ENEMY_KINDS?.[id]?.archetype,
    ].filter(Boolean),
    size,
    type,
    source,
    action: "launch",
    path: `/?dev=boss:${encodeURIComponent(id)}`,
    actionLabel: "Fight in Testing Grounds",
  };
});

const pets = PET_IDS.flatMap((petId) => {
  const pet = PET_CATALOG[petId];
  return PET_STAGE_DEFS.map((stage) => ({
    key: `${petId}:s${stage.band}`,
    id: petId,
    copyId: petId,
    idSuffix: `s${stage.band}`,
    name: `${pet.name} - ${stage.name}`,
    thumb: firstExistingPublic(join("sprites", "pets", petId, `s${stage.band}`, "body.png")),
    glyph: "P",
    facts: [stage.name, `Lv ${stage.minLevel}-${stage.maxLevel}`, prettyId(pet.bonus.kind)],
    keywords: [
      stage.name,
      `s${stage.band}`,
      pet.budgetKey,
      pet.bonus.kind,
      pet.capstone.kind,
    ].filter(Boolean),
    stage: String(stage.band),
    species: petId,
    bonus: pet.bonus.kind,
    action: "launch",
    path: `/?dev=pet:${encodeURIComponent(petId)}`,
    actionLabel: "Select in Testing Grounds",
  }));
});

const dimensionThemes = DIMENSION_IDS.map((id) => {
  const dimension = DIMENSIONS[id];
  return {
    key: id,
    id,
    copyId: id,
    name: dimension.name,
    thumb: firstExistingPublic(join("tiles", id, "tile-0.png")),
    glyph: "D",
    facts: ["world theme", prettyId(dimension.boss), `${dimension.roster?.length ?? 0} enemies`],
    keywords: [
      dimension.tagline,
      dimension.boss,
      dimension.hazard?.name,
      dimension.hazard?.description,
      ...(dimension.roster ?? []),
    ].filter(Boolean),
    boss: dimension.boss,
    hazard: dimension.hazard?.name ?? "",
    kind: "dimension",
    action: "launch",
    path: "/",
    actionLabel: "Launch dimension",
  };
});

const beltLevels = Object.values(BELT_LEVELS).map((level) => {
  const dimension = DIMENSIONS[level.dimensionId];
  const boss = level.rooms?.find?.((room) => room.boss)?.bossKind ?? dimension?.boss ?? "";
  return {
    key: `belt:${level.id}`,
    id: level.id,
    copyId: level.id,
    name: level.name,
    thumb: firstExistingPublic(
      join("belt", `bg-${level.id}.png`),
      join("belt", `${level.id}.png`),
      join("belt", `bg-${level.dimensionId}.png`),
    ),
    glyph: "L",
    facts: [
      "belt level",
      dimension?.name ?? prettyId(level.dimensionId),
      boss ? prettyId(boss) : `${level.rooms?.length ?? 0} rooms`,
    ],
    keywords: [
      level.blurb,
      level.dimensionId,
      dimension?.name,
      boss,
      ...(level.rooms ?? []).map((room) => room.name),
    ].filter(Boolean),
    boss,
    hazard: `${level.pits?.length ?? 0} pits`,
    kind: "belt level",
    action: "launch",
    path: `/?belt=${encodeURIComponent(level.id)}`,
    actionLabel: "Launch dimension",
  };
});

const dimensions = [...dimensionThemes, ...beltLevels];

const familyNames = Object.entries(UltimateFamily)
  .filter(([, value]) => Number(value) > 0)
  .sort((a, b) => Number(a[1]) - Number(b[1]));
const ultimateFamilies = familyNames.map(([name]) => name.replace(/([a-z])([A-Z])/g, "$1 $2"));
const ultimateAttrs = ["STR", "DEX", "INT", "CON", "LUK"];
const ultimates = ULTIMATE_VARIANTS.flatMap((variants, row) =>
  variants.map((variant) => {
    const family = row + 1;
    const code = ultimateCodeFor(family, variant);
    const familyName = ultimateFamilies[row] ?? `Family ${family}`;
    const primary = ultimateAttrs[row] ?? `Family ${family}`;
    return {
      key: `ultimate:${code}`,
      id: String(code),
      copyId: String(code),
      idPrefix: "code",
      name: `${familyName} - ${String(variant).toUpperCase()} variant`,
      thumb: "",
      glyph: primary.slice(0, 1),
      facts: [familyName, `${primary} family`, `${String(variant).toUpperCase()} variant`],
      keywords: [familyName, primary, variant, `ultimate code ${code}`],
      family: familyName,
      variant: String(variant).toUpperCase(),
      action: "copy",
      actionLabel: "Copy ultimate code",
      unavailable: "No dev grant path - ultimate code",
    };
  }),
);

const augmentIds = [...new Set([...AUGMENT_IDS, ...BEAM_AUGMENT_IDS])];
const augments = augmentIds.map((id) => {
  const augment = AUGMENTS[id];
  const delivery = augment.weapon ?? "parry";
  return {
    key: id,
    id,
    copyId: id,
    name: augment.name,
    thumb: "",
    glyph: "A",
    facts: [augment.tag, delivery, augment.stacks ? "stacks" : "unique"],
    keywords: [
      augment.tag,
      delivery,
      augment.desc,
      augment.icon,
      augment.stacks ? "stacks" : "unique",
    ],
    tag: augment.tag,
    delivery,
    stackable: augment.stacks ? "stackable" : "unique",
    action: "copy",
    actionLabel: "Copy augment ID",
    unavailable: "No dev grant path - augment ID",
  };
});

const characters = PLAYABLE_CHARACTERS.map((id) => {
  const kit = CHARACTER_KITS[id] ?? { spread: {}, quirk: "unwritten" };
  const spreadTotal = Object.values(kit.spread ?? {}).reduce(
    (sum, value) => sum + Number(value),
    0,
  );
  const quirk = kit.quirk ?? "unwritten";
  return {
    key: id,
    id,
    copyId: id,
    name: characterName(id),
    thumb: rigThumbnail(id),
    glyph: "C",
    facts: [prettyId(quirk), `spread ${spreadTotal}`, `peak ${topStats(kit.spread)}`],
    keywords: [quirk, ...Object.entries(kit.spread ?? {}).map(([key, value]) => `${key} ${value}`)],
    quirk,
    peak: topStats(kit.spread),
    action: "launch",
    path: `/?dev=char:${encodeURIComponent(id)}`,
    actionLabel: "Wear in Testing Grounds",
  };
});

function readSounds() {
  const manifestPath = resolve(PUBLIC_DIR, "audio/sfx/manifest.json");
  if (!existsSync(manifestPath)) return [];
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  return (manifest.entries ?? []).map((entry) => {
    const firstFile = firstExistingPublic(
      join("audio", "sfx", `${entry.id}.mp3`),
      join("audio", "sfx", `${entry.id}-v1.mp3`),
      join("audio", "sfx", `${entry.id}.ogg`),
      join("audio", "sfx", `${entry.id}-v1.ogg`),
    );
    return {
      key: entry.id,
      id: entry.id,
      copyId: entry.id,
      name: prettyId(entry.id),
      thumb: "",
      glyph: "S",
      facts: [
        entry.category,
        `${entry.durationSeconds}s`,
        `${entry.variations} take${entry.variations === 1 ? "" : "s"}`,
      ],
      keywords: [
        entry.category,
        entry.replaces,
        `priority ${entry.priority}`,
        entry.loop ? "loop" : "one-shot",
      ].filter(Boolean),
      soundCategory: entry.category,
      priority: String(entry.priority),
      action: firstFile ? "audio" : "copy",
      href: firstFile,
      actionLabel: firstFile ? "Open first rendered take" : "Copy sound ID",
      unavailable: firstFile ? "" : "Rendered sample missing",
    };
  });
}

const sounds = readSounds();
const catalogs = {
  weapons,
  gear,
  bosses,
  pets,
  dimensions,
  ultimates,
  augments,
  characters,
  sounds,
};
const expectedArtCatalogs = new Set([
  "weapons",
  "gear",
  "bosses",
  "pets",
  "dimensions",
  "characters",
]);
for (const [categoryId, items] of Object.entries(catalogs)) {
  for (const item of items) {
    item.artStatus ??= explicitArtStatus({
      ready: Boolean(item.thumb),
      expected: expectedArtCatalogs.has(categoryId),
    });
  }
}
const categoryMeta = [
  {
    id: "weapons",
    label: "Weapons",
    key: "1",
    glyph: "W",
    description: "Full weapon-definition catalog. Select a card to inspect; launch is explicit.",
  },
  {
    id: "gear",
    label: "Gear",
    key: "2",
    glyph: "G",
    description:
      "Wardrobe definitions, twelve complete eight-piece sets, pools, rarity, and art readiness.",
  },
  {
    id: "bosses",
    label: "Bosses",
    key: "3",
    glyph: "B",
    description: "Bespoke and dimension bosses - click to spawn the selected fight.",
  },
  {
    id: "pets",
    label: "Pets",
    key: "4",
    glyph: "P",
    description: "Every companion stage - click to own and select that pet in Testing Grounds.",
  },
  {
    id: "dimensions",
    label: "Dimensions",
    key: "5",
    glyph: "D",
    description:
      "World themes open the game launch surface; belt cards launch their authored level directly.",
  },
  {
    id: "ultimates",
    label: "Ultimates",
    key: "6",
    glyph: "U",
    description: "The complete five-family by four-variant wire-code matrix.",
  },
  {
    id: "augments",
    label: "Augments",
    key: "7",
    glyph: "A",
    description: "Universal and delivery-gated signature augments.",
  },
  {
    id: "characters",
    label: "Legacy Characters",
    key: "8",
    glyph: "C",
    description: "Legacy kits - click to wear the selected identity in Testing Grounds.",
  },
  {
    id: "sounds",
    label: "Sounds",
    key: "9",
    glyph: "S",
    description: "Rendered SFX manifest - click to audition the first take.",
  },
].filter((category) => category.id !== "sounds" || sounds.length > 0);

const DATA = {
  gameUrl: "http://localhost:5180",
  categories: categoryMeta.map((category) => ({
    ...category,
    count: catalogs[category.id].length,
  })),
  catalogs,
};
const embeddedData = JSON.stringify(DATA).replace(/</g, "\\u003c");

const PORTAL_STYLE = String.raw`
  :root {
    --bg:#080A0D; --surface-0:#0E1117; --surface-1:#11141A; --surface-2:#171A21;
    --surface-3:#20242C; --border:#39414D; --stitch:#59616D; --text-primary:#F4EAD7;
    --text-secondary:#B9B2A6; --text-muted:#8F8A84; --accent:#49D9E8; --action:#F2C66D;
    --success:#8EE28F; --warning:#FFAA55; --danger:#FF6B6B; --common:#9AA5B1;
    --uncommon:#59C96B; --rare:#4AA3FF; --really-rare:#2FD6C3; --legendary:#FFA53A;
    --ultimate:#FF4A6A; --cursed:#A06BFF; --sans:"Segoe UI Variable","Segoe UI",Arial,sans-serif;
    --mono:"Cascadia Mono",Consolas,monospace; --rail-width:264px; --inspector-width:420px;
    color-scheme:dark;
  }
  * { box-sizing:border-box; }
  html,body { width:100%; height:100%; margin:0; overflow:hidden; }
  body {
    min-width:320px; color:var(--text-primary);
    background:radial-gradient(circle at 70% -10%,rgba(73,217,232,.09),transparent 42%),
      linear-gradient(115deg,rgba(255,255,255,.018),transparent 34%),var(--bg);
    font:500 16px/22px var(--sans);
  }
  button,input,select { font:inherit; }
  button,input,select,a { min-height:44px; }
  button,select { color:inherit; }
  button { cursor:pointer; }
  button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible,[tabindex]:focus-visible {
    outline:3px solid var(--accent); outline-offset:2px; box-shadow:0 0 0 1px var(--bg);
  }
  .skip-link { position:fixed; left:12px; top:-72px; z-index:100; padding:10px 14px; color:var(--bg); background:var(--accent); border-radius:8px; font-weight:700; }
  .skip-link:focus { top:12px; }
  .app { display:grid; grid-template-columns:var(--rail-width) minmax(0,1fr) var(--inspector-width); grid-template-rows:84px minmax(0,1fr); width:100vw; height:100vh; }
  .rail { grid-row:1/3; min-width:0; overflow-y:auto; padding:24px 16px; border-right:1px solid var(--border); background:linear-gradient(180deg,rgba(17,20,26,.99),rgba(8,10,13,.99)); }
  .brand { display:flex; align-items:center; gap:12px; padding:0 8px 24px; }
  .brand-mark { position:relative; display:grid; place-items:center; flex:0 0 48px; width:48px; height:48px; color:var(--accent); border:1px solid var(--border); border-radius:12px; background:var(--surface-2); font:700 16px/20px var(--mono); }
  .brand-mark::after { content:""; position:absolute; inset:7px; border:1px dashed var(--stitch); border-radius:6px; transform:rotate(45deg); }
  .brand-copy { min-width:0; }
  .brand-title { font-size:18px; line-height:24px; font-weight:700; }
  .brand-sub,.nav-label,.eyebrow,.mono { font-family:var(--mono); }
  .brand-sub { margin-top:2px; color:var(--text-muted); font-size:14px; line-height:20px; }
  .nav-label { padding:0 8px 8px; color:var(--text-muted); font-size:14px; line-height:20px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; }
  .places,.category-nav { display:grid; gap:4px; }
  .places { margin-bottom:24px; }
  .place-link,.nav-item { min-width:0; border:1px solid transparent; border-radius:8px; color:var(--text-secondary); background:transparent; text-decoration:none; }
  .place-link { display:flex; align-items:center; padding:0 12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .place-link:hover,.nav-item:hover { color:var(--text-primary); border-color:var(--border); background:var(--surface-2); }
  .nav-item { width:100%; display:grid; grid-template-columns:36px minmax(0,1fr) auto; align-items:center; gap:8px; padding:4px 8px; text-align:left; }
  .nav-item.active { color:var(--text-primary); border-color:var(--accent); background:#10252B; }
  .nav-glyph { display:grid; place-items:center; width:32px; height:32px; color:var(--accent); border:1px solid var(--border); border-radius:8px; background:var(--surface-0); font:700 14px/20px var(--mono); }
  .nav-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:650; }
  .nav-count { color:var(--text-muted); font:600 14px/20px var(--mono); font-variant-numeric:tabular-nums; }
  .rail-footer { margin:24px 8px 0; padding-top:16px; border-top:1px solid var(--border); }
  .service { display:flex; align-items:center; gap:8px; color:var(--text-secondary); font:700 14px/20px var(--mono); }
  .service svg { width:20px; height:20px; }
  .rail-hint { margin-top:12px; color:var(--text-muted); font:500 14px/20px var(--mono); }
  .topbar { grid-column:2/4; display:grid; grid-template-columns:minmax(280px,360px) minmax(0,1fr) auto; align-items:center; gap:12px; min-width:0; padding:16px 24px; border-bottom:1px solid var(--border); background:rgba(14,17,23,.98); }
  .search-wrap { position:relative; min-width:0; }
  .search-icon { position:absolute; left:14px; top:50%; translate:0 -50%; color:var(--accent); font:700 14px/20px var(--mono); pointer-events:none; }
  #search { width:100%; height:52px; padding:0 54px 0 44px; color:var(--text-primary); caret-color:var(--accent); border:1px solid var(--border); border-radius:8px; background:var(--surface-0); }
  #search::placeholder { color:var(--text-muted); }
  .shortcut { position:absolute; right:12px; top:50%; translate:0 -50%; padding:2px 7px; color:var(--text-muted); border:1px solid var(--border); border-radius:4px; font:700 14px/20px var(--mono); }
  .filters { min-width:0; display:flex; align-items:center; gap:8px; overflow-x:auto; padding:4px 2px; scrollbar-width:thin; }
  .select-chip { flex:0 0 auto; display:flex; align-items:center; gap:6px; min-height:44px; padding:0 8px 0 12px; border:1px solid var(--border); border-radius:8px; background:var(--surface-2); }
  .select-chip span { color:var(--text-muted); font-size:14px; font-weight:700; }
  .select-chip select { min-width:72px; max-width:166px; border:0; outline:0; background:transparent; }
  .select-chip option { color:var(--text-primary); background:var(--surface-1); }
  .toggle-chip,.clear-filters,.density button,.button { min-height:44px; padding:0 12px; border:1px solid var(--border); border-radius:8px; color:var(--text-secondary); background:var(--surface-2); font-weight:650; }
  .toggle-chip.active { color:var(--accent); border-color:var(--accent); background:#10252B; }
  .clear-filters { flex:0 0 auto; }
  .top-actions { display:flex; align-items:center; gap:12px; }
  .density { display:flex; gap:4px; padding:0 4px; border:1px solid var(--border); border-radius:8px; background:var(--surface-0); }
  .density button { min-height:44px; border-color:transparent; background:transparent; font-size:14px; }
  .density button.active { color:var(--bg); background:var(--accent); }
  .result-count { min-width:118px; color:var(--text-secondary); font:700 14px/20px var(--mono); text-align:right; font-variant-numeric:tabular-nums; }
  .library { grid-column:2; grid-row:2; min-width:0; min-height:0; display:grid; grid-template-rows:auto minmax(0,1fr) 60px; background:var(--surface-0); }
  .library-head { display:flex; align-items:end; justify-content:space-between; gap:16px; padding:18px 24px 14px; }
  .library-head h1 { margin:2px 0 0; font-size:24px; line-height:30px; }
  .section-copy { max-width:720px; margin:2px 0 0; color:var(--text-secondary); font-size:14px; line-height:20px; }
  .section-stat { color:var(--text-muted); font:700 14px/20px var(--mono); text-align:right; font-variant-numeric:tabular-nums; }
  .grid-viewport { min-width:0; min-height:0; overflow:auto; padding:0 24px 24px; outline:none; }
  .grid-spacer { position:relative; width:100%; min-height:100%; }
  .grid-window { position:absolute; inset:0 0 auto 0; }
  .card { position:absolute; display:grid; grid-template-rows:minmax(0,1fr) auto; min-width:0; overflow:hidden; border:1px solid var(--border); border-radius:8px; background:linear-gradient(145deg,rgba(255,255,255,.035),transparent 42%),var(--surface-2); contain:strict; cursor:pointer; transition:transform .14s ease,border-color .14s ease,background .14s ease; }
  .card::after { content:""; position:absolute; inset:7px; border:1px dashed rgba(89,97,109,.36); border-radius:5px; pointer-events:none; }
  .card:hover { transform:translateY(-2px); border-color:var(--stitch); background-color:var(--surface-3); }
  .card.selected { border:2px solid var(--accent); background-color:var(--surface-3); }
  .card.focused { box-shadow:inset 0 0 0 3px var(--accent),inset 0 0 0 4px var(--bg); }
  .thumb { position:relative; min-height:0; overflow:hidden; display:grid; place-items:center; margin:8px 8px 0; border-radius:6px; background:radial-gradient(circle,#303944,#12161C 72%); }
  .thumb-glyph { color:var(--stitch); font:700 32px/36px var(--mono); }
  .thumb img { position:absolute; inset:0; width:100%; height:100%; padding:8px; object-fit:contain; }
  .thumb.tile img { padding:0; object-fit:cover; opacity:.9; }
  .card-category { position:absolute; left:8px; top:8px; z-index:2; min-height:28px; display:flex; align-items:center; padding:0 8px; color:var(--bg); border-radius:4px; background:var(--accent); font:700 14px/20px var(--mono); text-transform:uppercase; }
  .card-info { min-width:0; padding:8px 12px 12px; }
  .card-name { display:-webkit-box; overflow:hidden; color:var(--text-primary); font-size:16px; line-height:20px; font-weight:700; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
  .card-id { overflow:hidden; margin-top:2px; color:var(--text-muted); font:500 14px/20px var(--mono); text-overflow:ellipsis; white-space:nowrap; }
  .card-meta { min-width:0; display:flex; align-items:center; gap:8px; margin-top:6px; overflow:hidden; }
  .card-meta .rarity-mark { margin:0; }
  .fact { overflow:hidden; color:var(--text-secondary); font-size:14px; line-height:20px; text-overflow:ellipsis; white-space:nowrap; }
  .compact .card-info { padding:6px 10px 9px; }
  .compact .thumb { margin:6px 6px 0; }
  .compact .card-meta { margin-top:2px; }
  .command-rail { display:flex; align-items:center; justify-content:center; padding:8px 16px; color:var(--text-secondary); border-top:1px solid var(--border); background:var(--surface-1); font:650 14px/20px var(--mono); text-align:center; }
  .inspector { grid-column:3; grid-row:2; min-width:0; min-height:0; overflow-y:auto; padding:24px; border-left:1px solid var(--border); background:var(--surface-1); }
  .inspector-close.button { display:none; float:right; }
  .inspector h2 { margin:4px 0 8px; font-size:24px; line-height:30px; }
  .inspector-id { color:var(--text-muted); font:500 14px/20px var(--mono); overflow-wrap:anywhere; }
  .status-chip { display:inline-flex; align-items:center; gap:6px; min-height:28px; color:var(--text-muted); font-size:14px; line-height:20px; font-weight:700; }
  .status-chip svg { flex:0 0 20px; width:20px; height:20px; }
  .status-chip.ready,.service.connected { color:var(--success); }
  .status-chip.rendering,.service.checking { color:var(--warning); }
  .status-chip.unavailable,.service.offline { color:var(--danger); }
  .inspector-art { position:relative; min-height:220px; display:grid; place-items:center; margin:16px 0; overflow:hidden; border:1px solid var(--border); border-radius:8px; background:radial-gradient(circle,#303944,#11141A 70%); }
  .inspector-art::after { content:""; position:absolute; inset:8px; border:1px dashed rgba(89,97,109,.45); border-radius:5px; pointer-events:none; }
  .inspector-art img { width:100%; height:220px; padding:16px; object-fit:contain; }
  .inspector-art.tile img { padding:0; object-fit:cover; }
  .art-placeholder { max-width:240px; padding:24px; color:var(--text-muted); text-align:center; }
  .rarity-mark { display:flex; align-items:center; gap:8px; min-height:28px; margin:8px 0; font-size:14px; font-weight:800; }
  .rarity-mark svg { height:16px; }
  .rarity-common{color:var(--common)} .rarity-uncommon{color:var(--uncommon)} .rarity-rare{color:var(--rare)}
  .rarity-really-rare{color:var(--really-rare)} .rarity-legendary{color:var(--legendary)}
  .rarity-ultimate{color:var(--ultimate)} .rarity-cursed{color:var(--cursed)}
  .facts-list { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px 12px; margin:16px 0; padding:16px 0; border-top:1px solid var(--border); border-bottom:1px solid var(--border); }
  .facts-list dt { color:var(--text-muted); }
  .facts-list dd { margin:0; color:var(--text-primary); font-weight:700; text-align:right; overflow-wrap:anywhere; }
  .set-block { margin:16px 0; padding:16px; border:1px solid var(--border); border-radius:8px; background:var(--surface-2); }
  .set-block h3 { margin:0 0 4px; font-size:18px; line-height:24px; }
  .set-stitches { display:grid; grid-template-columns:repeat(8,1fr); gap:4px; margin:12px 0 8px; }
  .set-stitch { height:12px; border:1px dashed var(--stitch); border-radius:4px; }
  .set-stitch.ready { border-style:solid; border-color:var(--success); background:var(--success); }
  .inspector-actions { position:sticky; bottom:-24px; display:grid; gap:8px; margin:20px -24px -24px; padding:16px 24px 24px; background:linear-gradient(transparent,var(--surface-1) 18%); }
  .button { display:inline-flex; align-items:center; justify-content:center; text-decoration:none; }
  .button.primary { min-height:52px; color:var(--action); border-color:#8B713D; background:#342B1A; }
  .button.secondary:hover { color:var(--accent); border-color:var(--accent); }
  .button-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .empty { display:grid; place-items:center; min-height:240px; padding:32px; color:var(--text-secondary); border:1px dashed var(--stitch); border-radius:8px; text-align:center; }
  .empty strong { display:block; margin-bottom:8px; color:var(--text-primary); font-size:18px; line-height:24px; }
  #toast { position:fixed; left:50%; bottom:24px; z-index:120; max-width:min(560px,calc(100vw - 32px)); padding:12px 16px; translate:-50% 18px; opacity:0; pointer-events:none; color:var(--text-primary); border:1px solid var(--accent); border-radius:8px; background:var(--surface-1); font:600 14px/20px var(--mono); transition:opacity .15s ease,translate .15s ease; }
  #toast.show { opacity:1; translate:-50% 0; }
  @media (max-width:1439px) {
    :root { --rail-width:88px; --inspector-width:360px; }
    .app { grid-template-rows:72px minmax(0,1fr); }
    .rail { padding:16px 8px; }
    .brand { justify-content:center; padding-inline:0; }
    .brand-copy,.nav-label,.nav-name,.nav-count,.places,.rail-hint { display:none; }
    .nav-item { display:flex; justify-content:center; padding:4px; }
    .nav-glyph { width:40px; height:40px; }
    .rail-footer { margin-inline:0; }
    .service span { display:none; }
    .service { justify-content:center; }
    .topbar { grid-template-columns:minmax(240px,300px) minmax(0,1fr) auto; padding:10px 16px; gap:8px; }
    .library { grid-template-rows:auto minmax(0,1fr) 52px; }
    .library-head { padding:12px 16px 10px; }
    .section-copy { display:none; }
    .grid-viewport { padding:0 16px 16px; }
    .inspector { padding:16px; }
    .inspector-actions { bottom:-16px; margin:16px -16px -16px; padding:16px; }
    .density button { padding-inline:8px; }
  }
  @media (max-width:1100px) {
    .app { grid-template-columns:88px minmax(0,1fr); }
    .topbar { grid-column:2; }
    .inspector { position:fixed; z-index:70; top:72px; right:0; bottom:0; width:min(420px,calc(100vw - 88px)); box-shadow:-18px 0 36px rgba(0,0,0,.45); }
    .inspector.closed { display:none; }
    .inspector-close.button { display:inline-flex; }
  }
  @media (max-width:760px) {
    :root { --rail-width:64px; }
    .app { grid-template-columns:64px minmax(0,1fr); grid-template-rows:124px minmax(0,1fr); }
    .brand { display:none; }
    .topbar { grid-template-columns:minmax(0,1fr) auto; grid-template-rows:52px 44px; align-content:center; }
    .filters { grid-column:1/3; }
    .result-count { display:none; }
    .inspector { top:124px; width:calc(100vw - 64px); }
    .library-head { align-items:center; }
    .section-stat { display:none; }
    .button-row { grid-template-columns:1fr; }
  }
  @media (prefers-reduced-motion:reduce) { *,*::before,*::after { scroll-behavior:auto!important; transition-duration:.001ms!important; } }
`;

const PORTAL_SCRIPT = String.raw`
  "use strict";
  const PREF_KEY="ddDevPortal.armoryPanel";
  const STATUS={ready:{label:"READY",icon:"check"},rendering:{label:"ART RENDERING",icon:"hourglass"},unavailable:{label:"UNAVAILABLE",icon:"warning"},artless:{label:"ARTLESS",icon:"circle"}};
  const RARITIES={Common:{count:1,className:"common",hollow:false},Uncommon:{count:2,className:"uncommon",hollow:false},Rare:{count:3,className:"rare",hollow:false},"Really Rare":{count:4,className:"really-rare",hollow:false},Legendary:{count:5,className:"legendary",hollow:false},Ultimate:{count:6,className:"ultimate",hollow:false},Cursed:{count:6,className:"cursed",hollow:true}};
  const FILTERS={
    weapons:[{key:"weaponClass",label:"Class"},{key:"family",label:"Family"},{key:"delivery",label:"Delivery",order:["melee","gun","thrown","beam","cast"]},{key:"grip",label:"Grip",order:["1H","2H","dual","mounted"]},{key:"element",label:"Element"},{key:"source",label:"Source",order:["base","expansion"]},{key:"rarityCapable",label:"Rarity-capable",type:"toggle"}],
    gear:[{key:"slot",label:"Slot"},{key:"rarity",label:"Rarity",order:["Common","Uncommon","Rare","Really Rare","Legendary","Ultimate","Cursed"]},{key:"set",label:"Set / pool"},{key:"gearClass",label:"Class"},{key:"ownership",label:"Ownership"}],
    bosses:[{key:"size",label:"Size",order:["duelist","large","colossal"]},{key:"type",label:"Type"}],
    pets:[{key:"stage",label:"Stage",order:["1","2","3"]},{key:"species",label:"Pet"}],
    dimensions:[{key:"kind",label:"Kind",order:["dimension","belt level"]},{key:"boss",label:"Boss"}],
    ultimates:[{key:"family",label:"Family"},{key:"variant",label:"Variant"}],
    augments:[{key:"tag",label:"Tag"},{key:"delivery",label:"Delivery"},{key:"stackable",label:"Stacks"}],
    characters:[{key:"quirk",label:"Quirk"},{key:"peak",label:"Peak"}],
    sounds:[{key:"soundCategory",label:"Category"},{key:"priority",label:"Priority"}]
  };
  const SORTS=[{value:"az",label:"A-Z"},{value:"za",label:"Z-A"},{value:"id",label:"ID"}];
  const categoryById=Object.fromEntries(DATA.categories.map(function(category){return[category.id,category]}));
  const validCategories=new Set(DATA.categories.map(function(category){return category.id}));
  const search=document.getElementById("search");
  const filtersNode=document.getElementById("filters");
  const viewport=document.getElementById("gridViewport");
  const spacer=document.getElementById("gridSpacer");
  const windowNode=document.getElementById("gridWindow");
  const inspector=document.getElementById("inspector");
  const saved=readPrefs();
  const state={category:validCategories.has(saved.category)?saved.category:DATA.categories[0].id,query:"",density:saved.density==="compact"?"compact":"comfortable",filters:saved.filters&&typeof saved.filters==="object"?saved.filters:{},artStatus:typeof saved.artStatus==="string"?saved.artStatus:"",selectedKey:"",focusKey:"",focusIndex:0,results:[],columns:1,rowPitch:208,cardHeight:196,gap:12};
  let scope=state.category;
  let renderFrame=0;
  let toastTimer=0;
  function readPrefs(){try{return JSON.parse(localStorage.getItem(PREF_KEY)||"{}")}catch(_error){return{}}}
  function savePrefs(){try{localStorage.setItem(PREF_KEY,JSON.stringify({category:state.category,density:state.density,filters:state.filters,artStatus:state.artStatus}))}catch(_error){}}
  function normalize(value){return String(value==null?"":value).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"")}
  function entryKey(entry){return entry.category+":"+entry.item.key}
  function domId(entry){return"asset-"+entryKey(entry).replace(/[^a-z0-9_-]/gi,"-")}
  function searchable(item){if(!item._search)item._search=normalize([item.name,item.id,item.idSuffix,...(item.facts||[]),...(item.keywords||[])].join(" "));return item._search}
  function subsequenceScore(needle,haystack){let at=0,gaps=0,previous=-1;for(let i=0;i<needle.length;i+=1){const found=haystack.indexOf(needle[i],at);if(found<0)return-1;if(previous>=0)gaps+=found-previous-1;previous=found;at=found+1}return Math.max(1,48-gaps-Math.max(0,haystack.length-needle.length)*.015)}
  function fuzzyScore(item,query){const terms=normalize(query).trim().split(/\s+/).filter(Boolean);if(!terms.length)return 0;const haystack=searchable(item),name=normalize(item.name),id=normalize(item.id);let score=0;for(const term of terms){if(name===term||id===term)score+=260;else if(name.startsWith(term)||id.startsWith(term))score+=190;else{const index=haystack.indexOf(term);if(index>=0)score+=120-Math.min(index,80)*.35;else{const fuzzy=Math.max(subsequenceScore(term,name),subsequenceScore(term,id),subsequenceScore(term,haystack));if(fuzzy<0)return-1;score+=fuzzy}}}return score}
  function activeFilters(categoryId){if(!state.filters[categoryId])state.filters[categoryId]={};return state.filters[categoryId]}
  function filterItem(item,categoryId,applyCategoryFilters){if(state.artStatus&&item.artStatus!==state.artStatus)return false;if(!applyCategoryFilters)return true;const values=activeFilters(categoryId);return(FILTERS[categoryId]||[]).every(function(definition){const selected=values[definition.key];if(definition.type==="toggle")return!selected||Boolean(item[definition.key]);return!selected||String(item[definition.key])===String(selected)})}
  function compareEntries(a,b,sort){if(sort==="za")return b.item.name.localeCompare(a.item.name);if(sort==="id")return a.item.id.localeCompare(b.item.id);return a.item.name.localeCompare(b.item.name)}
  function categoryResults(categoryId,applyCategoryFilters){const query=state.query.trim();return DATA.catalogs[categoryId].map(function(item){return{item:item,score:fuzzyScore(item,query),category:categoryId}}).filter(function(entry){return entry.score>=0&&filterItem(entry.item,categoryId,applyCategoryFilters)})}
  function currentResults(){if(scope==="all")return DATA.categories.flatMap(function(category){return categoryResults(category.id,false)}).sort(function(a,b){return b.score-a.score||a.item.name.localeCompare(b.item.name)});const values=activeFilters(state.category);return categoryResults(state.category,true).sort(function(a,b){return compareEntries(a,b,values.sort||"az")})}
  function svgIcon(kind){const ns="http://www.w3.org/2000/svg",svg=document.createElementNS(ns,"svg");svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("aria-hidden","true");svg.setAttribute("fill","none");svg.setAttribute("stroke","currentColor");svg.setAttribute("stroke-width","2");svg.setAttribute("stroke-linecap","round");svg.setAttribute("stroke-linejoin","round");const add=function(name,attrs){const part=document.createElementNS(ns,name);Object.entries(attrs).forEach(function(pair){part.setAttribute(pair[0],pair[1])});svg.appendChild(part)};if(kind==="check")add("path",{d:"M5 12l4 4L19 6"});else if(kind==="hourglass")add("path",{d:"M7 3h10M7 21h10M8 3c0 5 3 5 4 9-1 4-4 4-4 9M16 3c0 5-3 5-4 9 1 4 4 4 4 9"});else if(kind==="warning")add("path",{d:"M12 3L2.8 20h18.4L12 3zM12 9v5M12 17h.01"});else add("circle",{cx:"12",cy:"12",r:"8"});return svg}
  function statusChip(status){const value=STATUS[status]?status:"artless",chip=document.createElement("span");chip.className="status-chip "+value;chip.append(svgIcon(STATUS[value].icon),document.createTextNode(STATUS[value].label));return chip}
  function rarityMark(rarity){const meta=RARITIES[rarity];if(!meta)return null;const wrap=document.createElement("div");wrap.className="rarity-mark rarity-"+meta.className;const label=document.createElement("span");label.textContent=rarity.toUpperCase();const ns="http://www.w3.org/2000/svg",svg=document.createElementNS(ns,"svg");svg.setAttribute("viewBox","0 0 "+meta.count*15+" 14");svg.setAttribute("width",String(meta.count*15));svg.setAttribute("aria-label",meta.count+(meta.hollow?" hollow diamonds":" filled diamonds"));for(let index=0;index<meta.count;index+=1){const diamond=document.createElementNS(ns,"polygon");diamond.setAttribute("points",(index*15+7)+",1 "+(index*15+13)+",7 "+(index*15+7)+",13 "+(index*15+1)+",7");diamond.setAttribute("fill",meta.hollow?"none":"currentColor");diamond.setAttribute("stroke","currentColor");diamond.setAttribute("stroke-width","1.5");if(meta.hollow)diamond.setAttribute("stroke-dasharray","2 1");svg.appendChild(diamond)}wrap.append(label,svg);return wrap}
  function pretty(value){return String(value||"").replace(/[-_/]+/g," ").replace(/\b\w/g,function(letter){return letter.toUpperCase()})}
  function toast(message){const node=document.getElementById("toast");node.textContent=message;node.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(function(){node.classList.remove("show")},1900)}
  async function copyText(value){try{if(!navigator.clipboard||!navigator.clipboard.writeText)throw new Error("clipboard unavailable");await navigator.clipboard.writeText(value)}catch(_error){const area=document.createElement("textarea");area.value=value;area.style.position="fixed";area.style.opacity="0";document.body.appendChild(area);area.select();document.execCommand("copy");area.remove()}}
  function openGame(path){window.open(DATA.gameUrl.replace(/\/$/,"")+(path||"/"),"_blank","noopener")}
  function activateEntry(entry){if(!entry)return;const item=entry.item;if(item.action==="launch"||item.action==="closet"||item.action==="menu")openGame(item.action==="menu"?"/":item.path);else if(item.action==="audio"&&item.href)window.open(item.href,"_blank","noopener");else void copyText(item.copyId).then(function(){toast((item.unavailable||categoryById[entry.category].label+" ID")+" copied")})}
  function button(label,className,action){const node=document.createElement("button");node.type="button";node.className="button "+className;node.textContent=label;node.addEventListener("click",action);return node}
  function selectedEntry(){return state.results.find(function(entry){return entryKey(entry)===state.selectedKey})||null}
  function factLabel(categoryId,index){const labels={weapons:["Family","Delivery","Grip"],gear:["Slot","Rarity","Set / pool"],bosses:["Size","Encounter","Source"],pets:["Stage","Level band","Bonus"],dimensions:["Kind","Boss","Rooms"],ultimates:["Family","Attribute","Variant"],augments:["Tag","Delivery","Stacking"],characters:["Quirk","Spread","Peak"],sounds:["Category","Duration","Takes"]};return labels[categoryId]?.[index]||"Fact "+(index+1)}
  function renderInspector(entry){
    const content=document.getElementById("inspectorContent");content.replaceChildren();
    if(!entry){const empty=document.createElement("div");empty.className="empty";empty.textContent="No matches. Clear filters to restore the catalog.";content.appendChild(empty);inspector.classList.remove("closed");return}
    const item=entry.item,category=categoryById[entry.category],eyebrow=document.createElement("div");eyebrow.className="eyebrow";eyebrow.textContent=category.label.slice(0,-1)+" definition";
    const title=document.createElement("h2");title.textContent=item.name;const id=document.createElement("div");id.className="inspector-id";id.textContent=(item.idPrefix?item.idPrefix+" ":"")+item.id+(item.idSuffix?" · "+item.idSuffix:"");content.append(eyebrow,title,id,statusChip(item.artStatus));
    if(item.rarity){const rarity=rarityMark(item.rarity);if(rarity)content.appendChild(rarity)}
    const art=document.createElement("div");art.className="inspector-art"+(entry.category==="dimensions"?" tile":"");
    if(item.thumb){const image=document.createElement("img");image.src=item.thumb;image.alt=item.name+" art";image.addEventListener("error",function(){image.remove();const error=document.createElement("div");error.className="art-placeholder";error.textContent="Preview failed to load. Text metadata remains available.";art.appendChild(error)});art.appendChild(image)}else{const placeholder=document.createElement("div");placeholder.className="art-placeholder";placeholder.textContent=item.artStatus==="artless"?"This definition is intentionally artless.":item.artStatus==="rendering"?"Art is still rendering.":"Expected art is unavailable.";art.appendChild(placeholder)}content.appendChild(art);
    const facts=document.createElement("dl");facts.className="facts-list";(item.facts||[]).forEach(function(value,index){const dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=factLabel(entry.category,index);dd.textContent=value;facts.append(dt,dd)});content.appendChild(facts);
    if(entry.category==="gear"&&item.playerCompletableSet){const set=document.createElement("section");set.className="set-block";const heading=document.createElement("h3");heading.textContent=pretty(item.set);const summary=document.createElement("div");summary.className="mono";summary.textContent=item.setSize+"/8 defined · "+item.setArtReady+"/8 art ready";const stitches=document.createElement("div");stitches.className="set-stitches";stitches.setAttribute("aria-label",item.setArtReady+" of 8 set pieces have ready art");for(let index=0;index<8;index+=1){const stitch=document.createElement("span");stitch.className="set-stitch"+(index<item.setArtReady?" ready":"");stitches.appendChild(stitch)}const missing=document.createElement("div");missing.className="section-copy";missing.textContent=item.setMissingArt.length?"Art unavailable: "+item.setMissingArt.join(", "):"Complete eight-piece catalog pair · all art ready";set.append(heading,summary,stitches,missing);content.appendChild(set)}
    const actions=document.createElement("div");actions.className="inspector-actions";actions.appendChild(button(item.actionLabel,"primary",function(){activateEntry(entry)}));const row=document.createElement("div");row.className="button-row";row.appendChild(button("Copy ID","secondary",function(){void copyText(item.copyId).then(function(){toast("Copied "+item.copyId)})}));if(item.path)row.appendChild(button("Copy deep link","secondary",function(){const link=DATA.gameUrl.replace(/\/$/,"")+item.path;void copyText(link).then(function(){toast("Deep link copied")})}));else row.appendChild(button("Copy name","secondary",function(){void copyText(item.name).then(function(){toast("Name copied")})}));actions.appendChild(row);content.appendChild(actions);inspector.classList.remove("closed")
  }
  function uniqueOptions(categoryId,key,order){const found=[...new Set(DATA.catalogs[categoryId].map(function(item){return item[key]}).filter(function(value){return value!==undefined&&value!==null&&value!==""}).map(String))];if(order){const rank=new Map(order.map(function(value,index){return[String(value),index]}));found.sort(function(a,b){return(rank.get(a)??999)-(rank.get(b)??999)||a.localeCompare(b)})}else found.sort(function(a,b){return a.localeCompare(b)});return found}
  function makeSelect(definition,options,value,onChange){const wrap=document.createElement("label");wrap.className="select-chip";const label=document.createElement("span");label.textContent=definition.label;const select=document.createElement("select");select.setAttribute("aria-label",definition.label+" filter");if(!definition.noAll){const all=document.createElement("option");all.value="";all.textContent="All";select.appendChild(all)}options.forEach(function(optionValue){const option=document.createElement("option");option.value=optionValue.value??optionValue;option.textContent=optionValue.label??pretty(optionValue);select.appendChild(option)});select.value=value||(definition.noAll?(options[0]?.value??options[0]):"");select.addEventListener("change",function(){onChange(select.value)});wrap.append(label,select);return wrap}
  function renderFilters(){filtersNode.replaceChildren();filtersNode.appendChild(makeSelect({label:"Art status"},Object.keys(STATUS).map(function(value){return{value:value,label:STATUS[value].label}}),state.artStatus,function(value){state.artStatus=value;savePrefs();resetAndRender()}));if(scope!=="all"){const categoryId=state.category,values=activeFilters(categoryId);(FILTERS[categoryId]||[]).forEach(function(definition){if(definition.type==="toggle"){const toggle=document.createElement("button");toggle.type="button";toggle.className="toggle-chip"+(values[definition.key]?" active":"");toggle.textContent=definition.label;toggle.setAttribute("aria-pressed",values[definition.key]?"true":"false");toggle.addEventListener("click",function(){values[definition.key]=!values[definition.key];savePrefs();resetAndRender()});filtersNode.appendChild(toggle)}else filtersNode.appendChild(makeSelect(definition,uniqueOptions(categoryId,definition.key,definition.order),values[definition.key],function(value){values[definition.key]=value;savePrefs();resetAndRender()}))});filtersNode.appendChild(makeSelect({key:"sort",label:"Sort",noAll:true},SORTS,values.sort||"az",function(value){values.sort=value;savePrefs();resetAndRender()}))}const categoryValues=scope==="all"?{}:activeFilters(state.category);const hasFilters=Boolean(state.query||state.artStatus||Object.entries(categoryValues).some(function(pair){return pair[0]!=="sort"&&Boolean(pair[1])}));if(hasFilters){const clear=document.createElement("button");clear.type="button";clear.className="clear-filters";clear.textContent="Clear";clear.addEventListener("click",clearFilters);filtersNode.appendChild(clear)}}
  function renderNav(){const nav=document.getElementById("categoryNav");nav.replaceChildren();DATA.categories.forEach(function(category){const node=document.createElement("button");node.type="button";node.className="nav-item"+(scope!=="all"&&category.id===state.category?" active":"");node.setAttribute("aria-current",scope!=="all"&&category.id===state.category?"page":"false");node.setAttribute("aria-label",category.label+", "+category.count+" items, key "+category.key);const glyph=document.createElement("span");glyph.className="nav-glyph";glyph.textContent=category.glyph;const name=document.createElement("span");name.className="nav-name";name.textContent=category.label;const count=document.createElement("span");count.className="nav-count";count.textContent=category.count;node.append(glyph,name,count);node.addEventListener("click",function(){selectCategory(category.id)});nav.appendChild(node)})}
  function createCard(entry,index,left,top,width){const item=entry.item,category=categoryById[entry.category],card=document.createElement("article");card.id=domId(entry);card.className="card"+(entryKey(entry)===state.selectedKey?" selected":"")+(index===state.focusIndex?" focused":"");card.setAttribute("role","option");card.setAttribute("aria-selected",entryKey(entry)===state.selectedKey?"true":"false");card.setAttribute("aria-rowindex",String(Math.floor(index/state.columns)+1));card.setAttribute("aria-colindex",String(index%state.columns+1));card.setAttribute("aria-posinset",String(index+1));card.setAttribute("aria-setsize",String(state.results.length));card.setAttribute("aria-label",item.name+". "+STATUS[item.artStatus].label+". Select to inspect.");card.style.left=left+"px";card.style.top=top+"px";card.style.width=width+"px";card.style.height=state.cardHeight+"px";const thumb=document.createElement("div");thumb.className="thumb"+(entry.category==="dimensions"?" tile":"");const glyph=document.createElement("span");glyph.className="thumb-glyph";glyph.textContent=item.glyph||category.glyph;thumb.appendChild(glyph);if(item.thumb){const image=document.createElement("img");image.src=item.thumb;image.alt="";image.loading="lazy";image.decoding="async";image.addEventListener("error",function(){image.remove()});thumb.appendChild(image)}if(scope==="all"){const badge=document.createElement("span");badge.className="card-category";badge.textContent=category.label;thumb.appendChild(badge)}const info=document.createElement("div");info.className="card-info";const title=document.createElement("div");title.className="card-name";title.textContent=item.name;title.title=item.name;const id=document.createElement("div");id.className="card-id";id.textContent=item.id+(item.idSuffix?" · "+item.idSuffix:"");const meta=document.createElement("div");meta.className="card-meta";if(item.rarity){const rarity=rarityMark(item.rarity);if(rarity)meta.appendChild(rarity)}else meta.appendChild(statusChip(item.artStatus));if(item.facts?.[0]){const fact=document.createElement("span");fact.className="fact";fact.textContent=item.facts[0];meta.appendChild(fact)}info.append(title,id,meta);card.append(thumb,info);card.addEventListener("click",function(){state.focusIndex=index;state.focusKey=entryKey(entry);state.selectedKey=entryKey(entry);viewport.focus();renderInspector(entry);renderWindow()});return card}
  function measureGrid(){state.gap=window.innerWidth<1440?8:12;state.cardHeight=state.density==="compact"?156:196;state.rowPitch=state.cardHeight+state.gap;const width=Math.max(1,viewport.clientWidth-(window.innerWidth<1440?32:48)),target=state.density==="compact"?220:264;state.columns=Math.max(1,Math.floor((width+state.gap)/(target+state.gap)));viewport.setAttribute("aria-colcount",String(state.columns));viewport.setAttribute("aria-rowcount",String(Math.ceil(state.results.length/state.columns)))}
  function renderWindow(){measureGrid();const rows=Math.ceil(state.results.length/state.columns);spacer.style.height=Math.max(viewport.clientHeight,rows*state.rowPitch-state.gap)+"px";windowNode.replaceChildren();if(!state.results.length){const empty=document.createElement("div");empty.className="empty";empty.style.position="absolute";empty.style.inset="0";const wrap=document.createElement("div"),strong=document.createElement("strong"),copy=document.createElement("div"),clear=button("Clear filters","secondary",clearFilters);strong.textContent="No matches";copy.textContent="Clear search and filters to restore the catalog.";clear.style.marginTop="16px";wrap.append(strong,copy,clear);empty.appendChild(wrap);windowNode.appendChild(empty);updateDebug(0);return}const overscan=2,firstRow=Math.max(0,Math.floor(viewport.scrollTop/state.rowPitch)-overscan),lastRow=Math.min(rows,Math.ceil((viewport.scrollTop+viewport.clientHeight)/state.rowPitch)+overscan),start=firstRow*state.columns,end=Math.min(state.results.length,lastRow*state.columns);if(document.activeElement===viewport&&(state.focusIndex<start||state.focusIndex>=end)){state.focusIndex=Math.min(state.results.length-1,start);state.focusKey=entryKey(state.results[state.focusIndex])}const available=viewport.clientWidth-(window.innerWidth<1440?32:48),columnWidth=(available-state.gap*(state.columns-1))/state.columns,fragment=document.createDocumentFragment();for(let index=start;index<end;index+=1){const row=Math.floor(index/state.columns),column=index%state.columns;fragment.appendChild(createCard(state.results[index],index,column*(columnWidth+state.gap),row*state.rowPitch,columnWidth))}windowNode.appendChild(fragment);const active=state.results[state.focusIndex];if(active)viewport.setAttribute("aria-activedescendant",domId(active));updateDebug(end-start)}
  function updateDebug(mountedCards){window.__PORTAL_DEBUG__={scope:scope,category:state.category,query:state.query,visible:state.results.length,mountedCards:mountedCards,columns:state.columns,selected:state.selectedKey,totals:Object.fromEntries(DATA.categories.map(function(category){return[category.id,category.count]}))}}
  function syncSelection(){let selectedIndex=state.results.findIndex(function(entry){return entryKey(entry)===state.selectedKey});if(selectedIndex<0){selectedIndex=0;state.selectedKey=state.results[0]?entryKey(state.results[0]):""}const focusIndex=state.results.findIndex(function(entry){return entryKey(entry)===state.focusKey});state.focusIndex=focusIndex>=0?focusIndex:Math.max(0,selectedIndex);state.focusKey=state.results[state.focusIndex]?entryKey(state.results[state.focusIndex]):""}
  function render(){state.results=currentResults();syncSelection();document.body.classList.toggle("compact",state.density==="compact");document.querySelectorAll("[data-density]").forEach(function(node){const active=node.dataset.density===state.density;node.classList.toggle("active",active);node.setAttribute("aria-pressed",active?"true":"false")});renderNav();renderFilters();const activeCategory=categoryById[state.category],total=scope==="all"?DATA.categories.reduce(function(sum,category){return sum+category.count},0):activeCategory.count;document.getElementById("resultCount").textContent=state.results.length+" / "+total;document.getElementById("eyebrow").textContent=scope==="all"?"Global fuzzy search":"Catalog "+activeCategory.key+" of "+DATA.categories.length;document.getElementById("sectionTitle").textContent=scope==="all"?"Search results":activeCategory.label;document.getElementById("sectionCopy").textContent=scope==="all"?"Matches across every generated catalog. Select a card to inspect it; launch remains a separate action.":activeCategory.description;document.getElementById("sectionStat").textContent=state.results.length===total?total+" definitions":state.results.length+" matches · "+total+" total";renderInspector(selectedEntry());renderWindow();document.documentElement.dataset.portalReady="true"}
  function scheduleRender(){cancelAnimationFrame(renderFrame);renderFrame=requestAnimationFrame(render)}
  function resetAndRender(){viewport.scrollTop=0;scheduleRender()}
  function clearFilters(){search.value="";state.query="";state.artStatus="";scope=state.category;const sort=activeFilters(state.category).sort||"az";state.filters[state.category]={sort:sort};savePrefs();resetAndRender()}
  function selectCategory(categoryId){if(!validCategories.has(categoryId))return;state.category=categoryId;state.query="";search.value="";scope=categoryId;state.selectedKey="";state.focusKey="";savePrefs();resetAndRender()}
  function moveFocus(nextIndex,select){if(!state.results.length)return;state.focusIndex=Math.max(0,Math.min(state.results.length-1,nextIndex));const entry=state.results[state.focusIndex];state.focusKey=entryKey(entry);if(select){state.selectedKey=state.focusKey;renderInspector(entry)}const row=Math.floor(state.focusIndex/state.columns),top=row*state.rowPitch;if(top<viewport.scrollTop)viewport.scrollTop=top;else if(top+state.cardHeight>viewport.scrollTop+viewport.clientHeight)viewport.scrollTop=top+state.cardHeight-viewport.clientHeight;renderWindow()}
  function setServiceState(service,state,label){const text=document.createElement("span");text.textContent=label;service.className="service "+state;service.replaceChildren(svgIcon(state==="connected"?"check":state==="checking"?"hourglass":"warning"),text)}
  async function probeGame(){const service=document.getElementById("serviceState");setServiceState(service,"checking","CHECKING localhost:5180");const controller=new AbortController(),timer=setTimeout(function(){controller.abort()},2500);try{await fetch(DATA.gameUrl,{method:"HEAD",mode:"no-cors",cache:"no-store",signal:controller.signal});setServiceState(service,"connected","CONNECTED localhost:5180")}catch(_error){setServiceState(service,"offline","OFFLINE localhost:5180")}finally{clearTimeout(timer)}}
  search.addEventListener("input",function(){state.query=search.value;scope=state.query.trim()?"all":state.category;state.selectedKey="";state.focusKey="";resetAndRender()});
  document.querySelectorAll("[data-density]").forEach(function(node){node.addEventListener("click",function(){state.density=node.dataset.density;savePrefs();resetAndRender()})});
  viewport.addEventListener("scroll",function(){cancelAnimationFrame(renderFrame);renderFrame=requestAnimationFrame(renderWindow)},{passive:true});
  viewport.addEventListener("keydown",function(event){let next=state.focusIndex;if(event.key==="ArrowRight")next+=1;else if(event.key==="ArrowLeft")next-=1;else if(event.key==="ArrowDown")next+=state.columns;else if(event.key==="ArrowUp")next-=state.columns;else if(event.key==="Home")next=0;else if(event.key==="End")next=state.results.length-1;else if(event.key==="PageDown")next+=state.columns*Math.max(1,Math.floor(viewport.clientHeight/state.rowPitch));else if(event.key==="PageUp")next-=state.columns*Math.max(1,Math.floor(viewport.clientHeight/state.rowPitch));else if(event.key==="Enter"){event.preventDefault();if(event.shiftKey)activateEntry(selectedEntry());else moveFocus(state.focusIndex,true);return}else if(event.key===" "){event.preventDefault();moveFocus(state.focusIndex,true);return}else return;event.preventDefault();moveFocus(next,false)});
  document.getElementById("closeInspector").addEventListener("click",function(){inspector.classList.add("closed");viewport.focus()});
  document.addEventListener("keydown",function(event){const target=event.target,typing=target&&(target.matches("input,textarea,select,button")||target.isContentEditable);if(!typing&&event.key==="/"){event.preventDefault();search.focus();search.select();return}if(!typing&&event.key==="Escape"&&window.innerWidth<=1100){inspector.classList.add("closed");viewport.focus();return}if(typing||event.altKey||event.ctrlKey||event.metaKey)return;const category=DATA.categories.find(function(candidate){return candidate.key===event.key});if(category)selectCategory(category.id)});
  new ResizeObserver(function(){renderWindow()}).observe(viewport);
  render(); void probeGame(); setInterval(probeGame,15000);
`;

const ARMORY_PORTAL_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <title>Dimension Drifters - Developer Portal</title>
  <style>${PORTAL_STYLE}</style>
</head>
<body>
  <a class="skip-link" href="#gridViewport">Skip to catalog</a>
  <div class="app" id="app">
    <aside class="rail" aria-label="Developer navigation">
      <div class="brand"><div class="brand-mark" aria-hidden="true">DD</div><div class="brand-copy"><div class="brand-title">Developer Portal</div><div class="brand-sub">Dimension Drifters</div></div></div>
      <div class="nav-label">Places</div>
      <nav class="places" aria-label="Developer places">
        <a class="place-link" href="http://localhost:5180/?closet=1" target="_blank" rel="noopener">Game</a>
        <a class="place-link" href="http://localhost:5180/?dev=weapon:rusty-cleaver" target="_blank" rel="noopener">Testing Grounds</a>
        <a class="place-link" href="http://localhost:5050" target="_blank" rel="noopener">Weaponsmith</a>
        <a class="place-link" href="../artkit/out/character-concepts/index.html" target="_blank" rel="noopener">Character concepts</a>
        <a class="place-link" href="../artkit/out/gear/hat-contact-sheet.png" target="_blank" rel="noopener">Hat contact sheet</a>
      </nav>
      <div class="nav-label">Catalogs</div>
      <nav class="category-nav" id="categoryNav" aria-label="Asset catalogs"></nav>
      <div class="rail-footer"><div class="service checking" id="serviceState" aria-live="polite"><span>CHECKING localhost:5180</span></div><div class="rail-hint">1-9 catalogs<br />/ global search<br />Shift+Enter launch</div></div>
    </aside>
    <header class="topbar">
      <div class="search-wrap"><span class="search-icon" aria-hidden="true">/_</span><input id="search" type="search" autocomplete="off" spellcheck="false" aria-label="Search every asset catalog" placeholder="Search names, IDs, families, tags..." /><span class="shortcut" aria-hidden="true">/</span></div>
      <div class="filters" id="filters" aria-label="Catalog filters"></div>
      <div class="top-actions"><div class="density" role="group" aria-label="Card density"><button type="button" data-density="comfortable">Comfort</button><button type="button" data-density="compact">Compact</button></div><div class="result-count" id="resultCount" aria-live="polite"></div></div>
    </header>
    <main class="library" id="catalog">
      <div class="library-head"><div><div class="eyebrow" id="eyebrow">Asset catalog</div><h1 id="sectionTitle"></h1><p class="section-copy" id="sectionCopy"></p></div><div class="section-stat" id="sectionStat"></div></div>
      <div class="grid-viewport" id="gridViewport" role="grid" aria-label="Asset results" aria-rowcount="0" aria-colcount="1" tabindex="0"><div class="grid-spacer" id="gridSpacer"><div class="grid-window" id="gridWindow"></div></div></div>
      <footer class="command-rail">Arrows navigate · Enter select · Shift+Enter launch · / search · 1-9 catalogs</footer>
    </main>
    <aside class="inspector" id="inspector" aria-label="Selected asset inspector"><button type="button" class="button secondary inspector-close" id="closeInspector" aria-label="Close inspector">Close</button><div id="inspectorContent"></div></aside>
  </div>
  <div id="toast" role="status" aria-live="polite"></div>
  <script>const DATA=${embeddedData};${PORTAL_SCRIPT}</script>
</body>
</html>`;


const html = ARMORY_PORTAL_HTML;

if (!isCheck) mkdirSync(here, { recursive: true });
emit(resolve(here, "index.html"), html, "tools/portal/index.html");

if (!isCheck) {
  console.log("dev portal -> tools/portal/index.html");
  for (const category of DATA.categories)
    console.log(`  ${category.label.padEnd(20)} ${String(category.count).padStart(4)}`);
  console.log(
    `  ${"Total".padEnd(20)} ${String(DATA.categories.reduce((sum, category) => sum + category.count, 0)).padStart(4)}`,
  );
}
