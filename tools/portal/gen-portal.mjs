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
  return {
    key: id,
    id,
    copyId: id,
    name: weapon?.name ?? prettyId(id),
    thumb:
      firstExistingPublic(join("sprites", id, "part-1.png"), join("cards", `${id}.jpg`)) ||
      rigThumbnail(id),
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
    delivery,
    grip,
    rarityCapable: true,
    source: weapon?.expansion ? "expansion" : "base",
    action: "launch",
    path: `/?dev=weapon:${encodeURIComponent(id)}`,
    actionLabel: "Open in Testing Grounds",
  };
});

const gear = GEAR_IDS.map((id) => {
  const item = GEAR_CATALOG[id];
  const slot = kebab(item.slot);
  const set = item.legacySetId ?? item.originPool ?? "utility";
  return {
    key: id,
    id,
    copyId: id,
    name: item.name,
    thumb: firstExistingPublic(join("sprites", "gear", slot, `${item.artKey}.png`)),
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
    action: "launch",
    path: `/?dev=gear:${encodeURIComponent(id)}`,
    actionLabel: "Equip in Testing Grounds",
  };
});

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
const categoryMeta = [
  {
    id: "weapons",
    label: "Weapons",
    key: "1",
    glyph: "W",
    description: "Live weapon catalog - click to equip in Testing Grounds.",
  },
  {
    id: "gear",
    label: "Gear",
    key: "2",
    glyph: "G",
    description:
      "Wardrobe catalog - click to own the closet and equip that piece in Testing Grounds.",
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

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <title>Dimension Drifters - Dev Portal</title>
  <style>
    :root {
      --bg: #080b10;
      --rail: #0d1119;
      --surface: #121824;
      --surface-2: #171f2d;
      --surface-3: #0b1018;
      --line: #273245;
      --line-hot: #3a5269;
      --ink: #eef2ed;
      --muted: #8d9aab;
      --cyan: #42dded;
      --cyan-soft: rgba(66, 221, 237, 0.13);
      --ember: #ff9f43;
      --violet: #a685ff;
      --danger: #ff6f7d;
      --mono: ui-monospace, "Cascadia Code", "SFMono-Regular", Consolas, monospace;
      --sans: Inter, "Segoe UI Variable", "Segoe UI", system-ui, sans-serif;
      --rail-w: 236px;
      --card-min: 246px;
      --card-thumb: 76px;
      --card-pad: 13px;
    }
    * { box-sizing: border-box; }
    html { background: var(--bg); scroll-behavior: smooth; }
    body {
      margin: 0;
      min-width: 320px;
      min-height: 100vh;
      color: var(--ink);
      background:
        radial-gradient(900px 620px at 88% -10%, rgba(54, 110, 132, 0.14), transparent 64%),
        linear-gradient(135deg, rgba(255,255,255,0.015) 25%, transparent 25%) 0 0 / 24px 24px,
        var(--bg);
      font-family: var(--sans);
      font-size: 14px;
    }
    button, input, select { font: inherit; }
    button, select { color: inherit; }
    button { -webkit-tap-highlight-color: transparent; }
    .skip-link {
      position: fixed; left: 12px; top: -60px; z-index: 100;
      padding: 9px 13px; color: #061014; background: var(--cyan); border-radius: 7px;
    }
    .skip-link:focus { top: 12px; }
    .app { display: grid; grid-template-columns: var(--rail-w) minmax(0, 1fr); min-height: 100vh; }
    .rail {
      position: sticky; top: 0; z-index: 30; align-self: start;
      height: 100vh; min-width: 0; overflow: auto;
      border-right: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(18, 25, 38, 0.98), rgba(9, 13, 20, 0.99));
      padding: 18px 14px 14px;
    }
    .brand { display: flex; align-items: center; gap: 11px; padding: 2px 6px 18px; }
    .brand-mark {
      position: relative; display: grid; place-items: center; flex: 0 0 39px; height: 39px;
      border: 1px solid rgba(66, 221, 237, 0.5); border-radius: 10px;
      color: var(--cyan); background: linear-gradient(145deg, rgba(66,221,237,.14), rgba(166,133,255,.07));
      box-shadow: inset 0 0 20px rgba(66,221,237,.05), 0 0 24px rgba(66,221,237,.05);
      font: 800 12px/1 var(--mono); letter-spacing: -.1em;
    }
    .brand-mark::after { content: ""; position: absolute; inset: 5px; border: 1px solid rgba(255,255,255,.08); border-radius: 6px; transform: rotate(45deg); }
    .brand-copy { min-width: 0; }
    .brand-title { font-size: 13px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .brand-sub { margin-top: 3px; color: var(--muted); font: 10px/1.25 var(--mono); text-transform: uppercase; letter-spacing: .12em; }
    .places { display: grid; gap: 3px; margin-bottom: 18px; }
    .place-link {
      min-width: 0; overflow: hidden; padding: 7px 8px; border: 1px solid transparent; border-radius: 8px;
      color: #aeb8c5; text-decoration: none; text-overflow: ellipsis; white-space: nowrap;
      font: 11px/1.2 var(--mono);
    }
    .place-link:hover, .place-link:focus-visible { color: var(--ink); border-color: #31455b; background: rgba(66,221,237,.08); outline: none; }
    .nav-label { padding: 0 8px 7px; color: #667588; font: 10px/1 var(--mono); text-transform: uppercase; letter-spacing: .15em; }
    .category-nav { display: grid; gap: 3px; }
    .nav-item {
      width: 100%; min-width: 0; display: grid; grid-template-columns: 27px minmax(0, 1fr) auto; align-items: center; gap: 7px;
      border: 1px solid transparent; border-radius: 9px; padding: 8px 8px;
      color: #aeb8c5; background: transparent; text-align: left; cursor: pointer;
      transition: color .15s ease, background .15s ease, border-color .15s ease;
    }
    .nav-item:hover { color: var(--ink); background: rgba(255,255,255,.035); }
    .nav-item.active { color: var(--ink); border-color: #31455b; background: linear-gradient(90deg, rgba(66,221,237,.13), rgba(66,221,237,.025)); }
    .nav-glyph { color: var(--cyan); font: 700 11px/25px var(--mono); text-align: center; border: 1px solid #2b3b4d; border-radius: 7px; background: #0a1018; }
    .nav-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 650; font-size: 12px; }
    .nav-count { color: #758499; font: 10px/1 var(--mono); }
    .nav-key { display: inline-block; min-width: 16px; margin-left: 4px; padding: 2px 3px; color: #607084; border: 1px solid #273449; border-radius: 4px; font: 9px/1 var(--mono); text-align: center; }
    .rail-footer { margin: 20px 6px 0; padding-top: 14px; border-top: 1px solid rgba(255,255,255,.07); }
    .game-link { display: flex; align-items: center; gap: 8px; color: #a5b3c3; text-decoration: none; font: 11px/1.2 var(--mono); }
    .status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--cyan); box-shadow: 0 0 10px rgba(66,221,237,.6); }
    .rail-hint { margin-top: 9px; color: #667488; font: 10px/1.45 var(--mono); }
    .workspace { min-width: 0; }
    .topbar {
      position: sticky; top: 0; z-index: 20;
      border-bottom: 1px solid rgba(44,57,76,.92);
      background: rgba(8, 12, 18, .91); backdrop-filter: blur(13px);
    }
    .topbar-main {
      min-width: 0; display: grid; grid-template-columns: minmax(300px, 1fr) auto; align-items: center; gap: 16px;
      padding: 15px clamp(20px, 3vw, 38px) 11px;
    }
    .search-wrap { position: relative; min-width: 0; }
    .search-icon { position: absolute; left: 13px; top: 50%; translate: 0 -50%; color: #718298; font: 14px/1 var(--mono); pointer-events: none; }
    #search {
      width: 100%; min-width: 0; height: 42px; padding: 0 96px 0 38px;
      color: var(--ink); caret-color: var(--cyan); outline: none;
      border: 1px solid #2b394b; border-radius: 10px;
      background: rgba(10,15,23,.92); box-shadow: inset 0 1px 0 rgba(255,255,255,.02);
    }
    #search:focus { border-color: #3b8390; box-shadow: 0 0 0 3px rgba(66,221,237,.09); }
    #search::placeholder { color: #66758a; }
    .search-shortcut { position: absolute; right: 10px; top: 50%; translate: 0 -50%; padding: 4px 7px; border: 1px solid #2b394b; border-radius: 5px; color: #718096; background: #0d131d; font: 10px/1 var(--mono); }
    .top-actions { display: flex; align-items: center; gap: 10px; white-space: nowrap; }
    .density { display: flex; padding: 3px; border: 1px solid #29384b; border-radius: 9px; background: #0a1018; }
    .density button { border: 0; border-radius: 6px; padding: 7px 9px; color: #718096; background: transparent; cursor: pointer; font: 10px/1 var(--mono); text-transform: uppercase; }
    .density button.active { color: #081014; background: var(--cyan); font-weight: 800; }
    .result-count { min-width: 112px; color: #91a0b2; font: 11px/1.2 var(--mono); text-align: right; }
    .filters { min-height: 45px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 0 clamp(20px, 3vw, 38px) 11px; }
    .filter-lead { color: #718096; font: 10px/1 var(--mono); text-transform: uppercase; letter-spacing: .1em; margin-right: 2px; }
    .select-chip { position: relative; display: inline-flex; align-items: center; gap: 5px; min-width: 0; height: 29px; padding: 0 7px 0 10px; border: 1px solid #2b394b; border-radius: 999px; background: #0d141e; }
    .select-chip span { color: #708096; font: 9px/1 var(--mono); text-transform: uppercase; letter-spacing: .06em; pointer-events: none; }
    .select-chip select { max-width: 180px; min-width: 52px; border: 0; outline: 0; padding: 0 16px 0 0; color: #cbd4de; background: transparent; cursor: pointer; font-size: 11px; }
    .select-chip option { color: #e8edf1; background: #111824; }
    .toggle-chip, .clear-filters, .scope-button {
      height: 29px; border: 1px solid #2b394b; border-radius: 999px; padding: 0 11px; color: #8c9aad; background: #0d141e; cursor: pointer; font: 10px/1 var(--mono);
    }
    .toggle-chip.active { color: var(--cyan); border-color: #3a6872; background: var(--cyan-soft); }
    .clear-filters { border-color: transparent; background: transparent; }
    .clear-filters:hover { color: var(--ink); border-color: #2b394b; }
    .scope-note { color: #738399; font: 11px/1.3 var(--mono); }
    .scope-button { color: var(--cyan); border-color: #31515c; background: rgba(66,221,237,.07); }
    .content { width: 100%; max-width: 1680px; min-width: 0; padding: 27px clamp(20px, 3vw, 38px) 64px; margin: 0 auto; }
    .section-head { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
    .eyebrow { color: var(--cyan); font: 10px/1 var(--mono); text-transform: uppercase; letter-spacing: .18em; }
    h1 { margin: 7px 0 0; font-size: clamp(24px, 2.4vw, 35px); line-height: 1.03; letter-spacing: -.035em; }
    .section-copy { max-width: 620px; margin: 8px 0 0; color: #8e9bad; line-height: 1.45; }
    .section-stat { flex: 0 0 auto; color: #738399; font: 11px/1.35 var(--mono); text-align: right; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--card-min)), 1fr)); gap: 13px; align-items: stretch; }
    .card {
      position: relative; min-width: 0; min-height: 104px; display: grid; grid-template-columns: var(--card-thumb) minmax(0, 1fr); gap: 13px;
      padding: var(--card-pad); overflow: hidden; isolation: isolate;
      border: 1px solid #263246; border-radius: 12px; outline: none;
      background: linear-gradient(145deg, rgba(24,32,46,.97), rgba(14,20,30,.98));
      box-shadow: 0 7px 22px rgba(0,0,0,.14), inset 0 1px 0 rgba(255,255,255,.025);
      cursor: pointer; contain: content;
      transition: translate .14s ease, border-color .14s ease, background .14s ease;
    }
    .card::after { content: ""; position: absolute; inset: auto -30px -54px auto; width: 100px; height: 100px; z-index: -1; border-radius: 50%; background: rgba(66,221,237,.035); }
    .card:hover, .card:focus-visible { translate: 0 -2px; border-color: #3d6b76; background: linear-gradient(145deg, rgba(28,39,54,.98), rgba(15,23,34,.98)); }
    .card:focus-visible { box-shadow: 0 0 0 3px rgba(66,221,237,.11); }
    .thumb {
      position: relative; width: var(--card-thumb); height: var(--card-thumb); display: grid; place-items: center; align-self: center; overflow: hidden;
      border: 1px solid #2b384c; border-radius: 10px;
      background:
        linear-gradient(135deg, rgba(66,221,237,.08), transparent 55%),
        repeating-linear-gradient(0deg, rgba(255,255,255,.018) 0 1px, transparent 1px 7px),
        #0a1018;
    }
    .thumb-glyph { color: #486072; font: 800 25px/1 var(--mono); text-shadow: 0 0 24px rgba(66,221,237,.22); }
    .thumb img { position: absolute; inset: 0; width: 100%; height: 100%; padding: 5px; object-fit: contain; image-rendering: auto; }
    .thumb.tile img { padding: 0; object-fit: cover; opacity: .86; }
    .card-body { min-width: 0; display: flex; flex-direction: column; justify-content: center; }
    .card-top { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 7px; }
    .card-name { overflow: hidden; color: #edf1ee; font-weight: 740; font-size: 13px; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
    .copy-id { width: 28px; height: 28px; margin: -5px -5px 0 0; border: 1px solid transparent; border-radius: 7px; color: #76879a; background: transparent; cursor: pointer; font: 14px/1 var(--mono); }
    .copy-id:hover, .copy-id:focus-visible { color: var(--cyan); border-color: #32465a; background: #0b121b; outline: none; }
    .card-id { min-width: 0; overflow: hidden; margin-top: 3px; color: #718096; font: 10px/1.25 var(--mono); text-overflow: ellipsis; white-space: nowrap; }
    .card-id .id-suffix { color: #a685ff; }
    .facts { display: flex; min-width: 0; flex-wrap: wrap; gap: 4px; margin-top: 11px; }
    .fact { max-width: 100%; overflow: hidden; padding: 3px 7px; border: 1px solid #2b394b; border-radius: 999px; color: #9ba8b7; background: #0c121b; font: 9px/1.15 var(--mono); text-overflow: ellipsis; white-space: nowrap; }
    .card-category { position: absolute; left: 7px; top: 7px; z-index: 2; padding: 3px 5px; color: #061014; border-radius: 5px; background: rgba(66,221,237,.86); font: 8px/1 var(--mono); text-transform: uppercase; letter-spacing: .06em; }
    .empty { grid-column: 1 / -1; padding: 64px 24px; border: 1px dashed #2b394b; border-radius: 14px; color: #7f8ea2; text-align: center; }
    .empty strong { display: block; margin-bottom: 7px; color: #c6d0d9; font-size: 15px; }
    .no-image .thumb-glyph { color: #587185; }
    .compact { --card-min: 211px; --card-thumb: 54px; --card-pad: 9px; }
    .compact .card { min-height: 78px; gap: 10px; border-radius: 10px; }
    .compact .card-name { font-size: 12px; }
    .compact .facts { margin-top: 7px; }
    .compact .fact:nth-child(n+3) { display: none; }
    #toast {
      position: fixed; left: 50%; bottom: 22px; z-index: 90; translate: -50% 14px;
      max-width: min(520px, calc(100vw - 32px)); padding: 10px 14px;
      border: 1px solid #3e6070; border-radius: 9px; color: #dffaff; background: rgba(12,25,34,.97);
      box-shadow: 0 14px 34px rgba(0,0,0,.42); opacity: 0; pointer-events: none;
      font: 11px/1.35 var(--mono); transition: opacity .16s ease, translate .16s ease;
    }
    #toast.show { opacity: 1; translate: -50% 0; }
    @media (max-width: 860px) {
      :root { --rail-w: 78px; }
      .rail { padding-inline: 9px; }
      .brand { justify-content: center; padding-inline: 0; }
      .brand-copy, .nav-label, .nav-name, .nav-count, .nav-key, .rail-footer, .places { display: none; }
      .nav-item { display: flex; justify-content: center; padding-inline: 0; }
      .nav-glyph { width: 31px; }
      .topbar-main { grid-template-columns: minmax(0,1fr); gap: 9px; }
      .top-actions { justify-content: space-between; }
      .result-count { min-width: 0; }
    }
    @media (max-width: 570px) {
      :root { --rail-w: 0px; }
      .app { display: block; }
      .rail { position: static; width: 100%; height: auto; padding: 8px 10px; border: 0; border-bottom: 1px solid var(--line); }
      .brand { display: none; }
      .category-nav { display: flex; overflow-x: auto; gap: 5px; }
      .nav-item { flex: 0 0 auto; width: 39px; }
      .topbar { top: 0; }
      .topbar-main, .filters, .content { padding-inline: 14px; }
      .search-shortcut { display: none; }
      #search { padding-right: 12px; }
      .density button { padding-inline: 7px; }
      .section-head { display: block; }
      .section-stat { margin-top: 10px; text-align: left; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .001ms !important; }
    }
  </style>
</head>
<body>
  <a class="skip-link" href="#catalog">Skip to catalog</a>
  <div class="app" id="app">
    <aside class="rail" aria-label="Asset categories">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">DD</div>
        <div class="brand-copy">
          <div class="brand-title">Dev Portal</div>
          <div class="brand-sub">Dimension Drifters</div>
        </div>
      </div>
      <div class="nav-label">Places</div>
      <nav class="places" aria-label="Developer places">
        <a class="place-link" href="http://localhost:5180/?closet=1" target="_blank" rel="noopener">Game</a>
        <a class="place-link" href="http://localhost:5180/?dev=weapon:rusty-cleaver" target="_blank" rel="noopener">Testing Grounds</a>
        <a class="place-link" href="http://localhost:5050" target="_blank" rel="noopener">Weaponsmith</a>
        <a class="place-link" href="../artkit/out/character-concepts/index.html" target="_blank" rel="noopener">Character concepts</a>
        <a class="place-link" href="../artkit/out/gear/hat-contact-sheet.png" target="_blank" rel="noopener">Hat contact sheet</a>
      </nav>
      <div class="nav-label">Catalogs</div>
      <nav class="category-nav" id="categoryNav"></nav>
      <div class="rail-footer">
        <a class="game-link" href="http://localhost:5180" target="_blank" rel="noopener">
          <span class="status-dot" aria-hidden="true"></span><span>localhost:5180</span>
        </a>
        <div class="rail-hint">Keys 1-9 jump catalogs<br />/ focuses global search</div>
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <div class="topbar-main">
          <div class="search-wrap">
            <span class="search-icon" aria-hidden="true">&gt;_</span>
            <input id="search" type="search" autocomplete="off" spellcheck="false" aria-label="Search every asset catalog" placeholder="Search every asset - name, id, family, tag..." />
            <span class="search-shortcut" aria-hidden="true">/</span>
          </div>
          <div class="top-actions">
            <div class="density" role="group" aria-label="Card density">
              <button type="button" data-density="comfortable">Comfortable</button>
              <button type="button" data-density="compact">Compact</button>
            </div>
            <div class="result-count" id="resultCount" aria-live="polite"></div>
          </div>
        </div>
        <div class="filters" id="filters" aria-label="Catalog filters"></div>
      </header>
      <main class="content" id="catalog" tabindex="-1">
        <div class="section-head">
          <div>
            <div class="eyebrow" id="eyebrow">Asset catalog</div>
            <h1 id="sectionTitle"></h1>
            <p class="section-copy" id="sectionCopy"></p>
          </div>
          <div class="section-stat" id="sectionStat"></div>
        </div>
        <div class="grid" id="grid"></div>
      </main>
    </div>
  </div>
  <div id="toast" role="status" aria-live="polite"></div>
  <script>
    "use strict";
    const DATA = ${embeddedData};
    const PREF_KEY = "ddDevPortal.v2";
    const FILTERS = {
      weapons: [
        { key: "family", label: "Family" },
        { key: "delivery", label: "Delivery", order: ["melee", "gun", "thrown", "beam", "cast"] },
        { key: "grip", label: "Grip", order: ["1H", "2H", "dual", "mounted"] },
        { key: "rarityCapable", label: "Rarity loot", type: "toggle" },
      ],
      gear: [
        { key: "slot", label: "Slot" },
        { key: "rarity", label: "Rarity", order: ["Common", "Uncommon", "Rare", "Really Rare", "Ultimate"] },
        { key: "set", label: "Set" },
      ],
      bosses: [
        { key: "size", label: "Size", order: ["duelist", "large", "colossal"] },
        { key: "type", label: "Type" },
      ],
      pets: [{ key: "stage", label: "Stage", order: ["1", "2", "3"] }, { key: "species", label: "Pet" }],
      dimensions: [{ key: "kind", label: "Kind", order: ["dimension", "belt level"] }, { key: "boss", label: "Boss" }],
      ultimates: [{ key: "family", label: "Family" }, { key: "variant", label: "Variant", order: ["STR", "DEX", "INT", "CON", "LUK"] }],
      augments: [{ key: "tag", label: "Tag" }, { key: "delivery", label: "Delivery" }, { key: "stackable", label: "Stacks" }],
      characters: [{ key: "quirk", label: "Quirk" }, { key: "peak", label: "Peak" }],
      sounds: [{ key: "soundCategory", label: "Category" }, { key: "priority", label: "Priority" }],
    };
    const SORTS = [
      { value: "az", label: "A-Z" },
      { value: "za", label: "Z-A" },
      { value: "id", label: "ID" },
    ];
    const categoryById = Object.fromEntries(DATA.categories.map(function (category) { return [category.id, category]; }));
    const validCategories = new Set(DATA.categories.map(function (category) { return category.id; }));

    function readPrefs() {
      try { return JSON.parse(localStorage.getItem(PREF_KEY) || "{}"); }
      catch (_error) { return {}; }
    }
    const saved = readPrefs();
    const state = {
      category: validCategories.has(saved.category) ? saved.category : DATA.categories[0].id,
      query: typeof saved.query === "string" ? saved.query : "",
      density: saved.density === "compact" ? "compact" : "comfortable",
      filters: saved.filters && typeof saved.filters === "object" ? saved.filters : {},
    };
    let scope = state.query ? "all" : state.category;
    let renderFrame = 0;
    let toastTimer = 0;
    const search = document.getElementById("search");
    const grid = document.getElementById("grid");
    const filters = document.getElementById("filters");
    search.value = state.query;

    function savePrefs() {
      try { localStorage.setItem(PREF_KEY, JSON.stringify(state)); }
      catch (_error) { /* A blocked file-origin store should not break the portal. */ }
    }

    function normalize(value) {
      return String(value == null ? "" : value).toLowerCase().normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "");
    }

    function searchable(item) {
      if (item._search) return item._search;
      item._search = normalize([item.name, item.id, item.idSuffix, ...(item.facts || []), ...(item.keywords || [])].join(" "));
      return item._search;
    }

    function subsequenceScore(needle, haystack) {
      let at = 0;
      let gaps = 0;
      let previous = -1;
      for (let i = 0; i < needle.length; i += 1) {
        const found = haystack.indexOf(needle[i], at);
        if (found < 0) return -1;
        if (previous >= 0) gaps += found - previous - 1;
        previous = found;
        at = found + 1;
      }
      return Math.max(1, 48 - gaps - Math.max(0, haystack.length - needle.length) * 0.015);
    }

    function fuzzyScore(item, query) {
      const terms = normalize(query).trim().split(/\\s+/).filter(Boolean);
      if (!terms.length) return 0;
      const haystack = searchable(item);
      const name = normalize(item.name);
      const id = normalize(item.id);
      let score = 0;
      for (const term of terms) {
        if (name === term || id === term) score += 260;
        else if (name.startsWith(term) || id.startsWith(term)) score += 190;
        else {
          const index = haystack.indexOf(term);
          if (index >= 0) score += 120 - Math.min(index, 80) * 0.35;
          else {
            const fuzzy = Math.max(subsequenceScore(term, name), subsequenceScore(term, id), subsequenceScore(term, haystack));
            if (fuzzy < 0) return -1;
            score += fuzzy;
          }
        }
      }
      return score;
    }

    function activeFilters(categoryId) {
      if (!state.filters[categoryId]) state.filters[categoryId] = {};
      return state.filters[categoryId];
    }

    function filterItem(item, categoryId) {
      const values = activeFilters(categoryId);
      return (FILTERS[categoryId] || []).every(function (definition) {
        const selected = values[definition.key];
        if (definition.type === "toggle") return !selected || Boolean(item[definition.key]);
        return !selected || String(item[definition.key]) === String(selected);
      });
    }

    function categoryResults(categoryId, applyCategoryFilters) {
      const query = state.query.trim();
      return DATA.catalogs[categoryId]
        .map(function (item) { return { item: item, score: fuzzyScore(item, query) }; })
        .filter(function (entry) { return entry.score >= 0 && (!applyCategoryFilters || filterItem(entry.item, categoryId)); });
    }

    function compareEntries(a, b, sort) {
      if (sort === "za") return b.item.name.localeCompare(a.item.name);
      if (sort === "id") return a.item.id.localeCompare(b.item.id);
      return a.item.name.localeCompare(b.item.name);
    }

    function currentResults() {
      if (scope === "all") {
        return DATA.categories.flatMap(function (category) {
          return categoryResults(category.id, false).map(function (entry) { return { ...entry, category: category.id }; });
        }).sort(function (a, b) { return b.score - a.score || a.item.name.localeCompare(b.item.name); });
      }
      const values = activeFilters(state.category);
      return categoryResults(state.category, true)
        .map(function (entry) { return { ...entry, category: state.category }; })
        .sort(function (a, b) { return compareEntries(a, b, values.sort || "az"); });
    }

    function toast(message) {
      const node = document.getElementById("toast");
      node.textContent = message;
      node.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { node.classList.remove("show"); }, 1900);
    }

    async function copyText(value) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(value);
        else throw new Error("clipboard unavailable");
      } catch (_error) {
        const area = document.createElement("textarea");
        area.value = value;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
    }

    function openGame(path) {
      window.open(DATA.gameUrl.replace(/\\/$/, "") + (path || "/"), "_blank", "noopener");
    }

    function activateCard(item, categoryId) {
      if (item.action === "launch") {
        openGame(item.path);
        return;
      }
      if (item.action === "closet") {
        openGame(item.path);
        void copyText(item.copyId).then(function () { toast("Gear ID copied - closet unlocked in new tab"); });
        return;
      }
      if (item.action === "audio" && item.href) {
        window.open(item.href, "_blank", "noopener");
        return;
      }
      if (item.action === "menu") {
        openGame("/");
        void copyText(item.copyId).then(function () { toast((item.unavailable || "No direct deep-link") + " - ID copied, game opened"); });
        return;
      }
      void copyText(item.copyId).then(function () { toast((item.unavailable || categoryById[categoryId].label + " ID") + " copied"); });
    }

    function makeCard(entry) {
      const item = entry.item;
      const category = categoryById[entry.category];
      const card = document.createElement("article");
      card.className = "card" + (item.thumb ? "" : " no-image");
      card.tabIndex = 0;
      card.setAttribute("role", "link");
      card.setAttribute("aria-label", item.name + ". " + item.actionLabel);
      card.title = item.actionLabel;
      card.addEventListener("click", function () { activateCard(item, entry.category); });
      card.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activateCard(item, entry.category);
        }
      });

      const thumb = document.createElement("div");
      thumb.className = "thumb" + (entry.category === "dimensions" ? " tile" : "");
      const glyph = document.createElement("span");
      glyph.className = "thumb-glyph";
      glyph.textContent = item.glyph || category.glyph;
      thumb.appendChild(glyph);
      if (item.thumb) {
        const image = document.createElement("img");
        image.src = item.thumb;
        image.alt = "";
        image.loading = "lazy";
        image.decoding = "async";
        image.addEventListener("error", function () { image.remove(); card.classList.add("no-image"); });
        thumb.appendChild(image);
      }
      if (scope === "all") {
        const badge = document.createElement("span");
        badge.className = "card-category";
        badge.textContent = category.label;
        thumb.appendChild(badge);
      }
      card.appendChild(thumb);

      const body = document.createElement("div");
      body.className = "card-body";
      const top = document.createElement("div");
      top.className = "card-top";
      const title = document.createElement("div");
      title.className = "card-name";
      title.textContent = item.name;
      title.title = item.name;
      const copy = document.createElement("button");
      copy.type = "button";
      copy.className = "copy-id";
      copy.textContent = "⧉";
      copy.title = "Copy ID";
      copy.setAttribute("aria-label", "Copy " + item.name + " ID");
      copy.addEventListener("click", function (event) {
        event.stopPropagation();
        void copyText(item.copyId).then(function () { toast("Copied " + item.copyId); });
      });
      top.append(title, copy);
      body.appendChild(top);
      const id = document.createElement("div");
      id.className = "card-id";
      id.textContent = (item.idPrefix ? item.idPrefix + " " : "") + item.id;
      if (item.idSuffix) {
        const suffix = document.createElement("span");
        suffix.className = "id-suffix";
        suffix.textContent = " · " + item.idSuffix;
        id.appendChild(suffix);
      }
      body.appendChild(id);
      const facts = document.createElement("div");
      facts.className = "facts";
      (item.facts || []).slice(0, 3).forEach(function (value) {
        const fact = document.createElement("span");
        fact.className = "fact";
        fact.textContent = value;
        fact.title = value;
        facts.appendChild(fact);
      });
      body.appendChild(facts);
      card.appendChild(body);
      return card;
    }

    function uniqueOptions(categoryId, key, order) {
      const found = [...new Set(DATA.catalogs[categoryId].map(function (item) { return item[key]; }).filter(function (value) { return value !== undefined && value !== null && value !== ""; }).map(String))];
      if (order) {
        const rank = new Map(order.map(function (value, index) { return [String(value), index]; }));
        found.sort(function (a, b) { return (rank.get(a) ?? 999) - (rank.get(b) ?? 999) || a.localeCompare(b); });
      } else found.sort(function (a, b) { return a.localeCompare(b); });
      return found;
    }

    function makeSelect(categoryId, definition, options) {
      const values = activeFilters(categoryId);
      const wrap = document.createElement("label");
      wrap.className = "select-chip";
      const label = document.createElement("span");
      label.textContent = definition.label;
      const select = document.createElement("select");
      select.setAttribute("aria-label", definition.label + " filter");
      if (!definition.noAll) {
        const all = document.createElement("option");
        all.value = "";
        all.textContent = "All";
        select.appendChild(all);
      }
      options.forEach(function (value) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = definition.key === "stage" ? "Stage " + value : value;
        select.appendChild(option);
      });
      if (options.includes(String(values[definition.key] ?? ""))) select.value = String(values[definition.key]);
      else values[definition.key] = "";
      select.addEventListener("change", function () {
        values[definition.key] = select.value;
        savePrefs();
        scheduleRender();
      });
      wrap.append(label, select);
      return wrap;
    }

    function renderFilters() {
      filters.replaceChildren();
      if (scope === "all") {
        const note = document.createElement("span");
        note.className = "scope-note";
        note.textContent = "Searching all catalogs. Choose a category to compose filters.";
        filters.appendChild(note);
        return;
      }
      const categoryId = state.category;
      const values = activeFilters(categoryId);
      const lead = document.createElement("span");
      lead.className = "filter-lead";
      lead.textContent = "Filter";
      filters.appendChild(lead);
      (FILTERS[categoryId] || []).forEach(function (definition) {
        if (definition.type === "toggle") {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "toggle-chip" + (values[definition.key] ? " active" : "");
          button.textContent = definition.label;
          button.setAttribute("aria-pressed", values[definition.key] ? "true" : "false");
          button.addEventListener("click", function () {
            values[definition.key] = !values[definition.key];
            savePrefs();
            scheduleRender();
          });
          filters.appendChild(button);
        } else filters.appendChild(makeSelect(categoryId, definition, uniqueOptions(categoryId, definition.key, definition.order)));
      });
      filters.appendChild(makeSelect(categoryId, { key: "sort", label: "Sort", noAll: true }, SORTS.map(function (sort) { return sort.value; })));
      const sortSelect = filters.querySelector('select[aria-label="Sort filter"]');
      if (sortSelect) {
        [...sortSelect.options].forEach(function (option) {
          const sort = SORTS.find(function (candidate) { return candidate.value === option.value; });
          if (sort) option.textContent = sort.label;
        });
        sortSelect.value = values.sort || "az";
      }
      const hasFilters = (FILTERS[categoryId] || []).some(function (definition) { return Boolean(values[definition.key]); });
      if (hasFilters) {
        const clear = document.createElement("button");
        clear.type = "button";
        clear.className = "clear-filters";
        clear.textContent = "Clear filters";
        clear.addEventListener("click", function () {
          state.filters[categoryId] = { sort: values.sort || "az" };
          savePrefs();
          scheduleRender();
        });
        filters.appendChild(clear);
      }
      if (state.query) {
        const all = document.createElement("button");
        all.type = "button";
        all.className = "scope-button";
        all.textContent = "Search all catalogs";
        all.addEventListener("click", function () { scope = "all"; scheduleRender(); });
        filters.appendChild(all);
      }
    }

    function renderNav() {
      const nav = document.getElementById("categoryNav");
      nav.replaceChildren();
      DATA.categories.forEach(function (category) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "nav-item" + (scope !== "all" && category.id === state.category ? " active" : "");
        button.dataset.category = category.id;
        button.setAttribute("aria-current", scope !== "all" && category.id === state.category ? "page" : "false");
        const glyph = document.createElement("span");
        glyph.className = "nav-glyph";
        glyph.textContent = category.glyph;
        const name = document.createElement("span");
        name.className = "nav-name";
        name.textContent = category.label;
        const trail = document.createElement("span");
        trail.className = "nav-count";
        trail.textContent = category.count;
        const key = document.createElement("kbd");
        key.className = "nav-key";
        key.textContent = category.key;
        trail.appendChild(key);
        button.append(glyph, name, trail);
        button.addEventListener("click", function () { selectCategory(category.id); });
        nav.appendChild(button);
      });
    }

    function selectCategory(categoryId) {
      if (!validCategories.has(categoryId)) return;
      state.category = categoryId;
      scope = categoryId;
      savePrefs();
      window.scrollTo({ top: 0, behavior: "instant" });
      scheduleRender();
    }

    function render() {
      const results = currentResults();
      const activeCategory = categoryById[state.category];
      document.body.classList.toggle("compact", state.density === "compact");
      document.querySelectorAll("[data-density]").forEach(function (button) {
        const active = button.dataset.density === state.density;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      renderNav();
      renderFilters();

      const total = scope === "all" ? DATA.categories.reduce(function (sum, category) { return sum + category.count; }, 0) : activeCategory.count;
      document.getElementById("resultCount").textContent = results.length + " / " + total + " visible";
      document.getElementById("eyebrow").textContent = scope === "all" ? "Global fuzzy search" : "Asset catalog " + activeCategory.key + "/" + DATA.categories.length;
      document.getElementById("sectionTitle").textContent = scope === "all" ? "Search results" : activeCategory.label;
      document.getElementById("sectionCopy").textContent = scope === "all"
        ? "Matches across every generated catalog. Choose a rail category to narrow and compose its filters."
        : activeCategory.description;
      document.getElementById("sectionStat").textContent = results.length === total ? total + " catalog entries" : results.length + " matches · " + total + " total";

      const fragment = document.createDocumentFragment();
      if (!results.length) {
        const empty = document.createElement("div");
        empty.className = "empty";
        const strong = document.createElement("strong");
        strong.textContent = "No assets match";
        const detail = document.createElement("span");
        detail.textContent = "Try a shorter search or clear one of the category filters.";
        empty.append(strong, detail);
        fragment.appendChild(empty);
      } else results.forEach(function (entry) { fragment.appendChild(makeCard(entry)); });
      grid.replaceChildren(fragment);
      document.documentElement.dataset.portalReady = "true";
      window.__PORTAL_DEBUG__ = {
        scope: scope,
        category: state.category,
        query: state.query,
        visible: results.length,
        totals: Object.fromEntries(DATA.categories.map(function (category) { return [category.id, category.count]; })),
      };
    }

    function scheduleRender() {
      cancelAnimationFrame(renderFrame);
      renderFrame = requestAnimationFrame(render);
    }

    search.addEventListener("input", function () {
      const wasEmpty = !state.query.trim();
      state.query = search.value;
      if (state.query.trim() && wasEmpty) scope = "all";
      if (!state.query.trim() && scope === "all") scope = state.category;
      savePrefs();
      scheduleRender();
    });
    document.querySelectorAll("[data-density]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.density = button.dataset.density;
        savePrefs();
        scheduleRender();
      });
    });
    document.addEventListener("keydown", function (event) {
      const target = event.target;
      const typing = target && (target.matches("input, textarea, select") || target.isContentEditable);
      if (!typing && event.key === "/") {
        event.preventDefault();
        search.focus();
        search.select();
        return;
      }
      if (typing || event.altKey || event.ctrlKey || event.metaKey) return;
      const category = DATA.categories.find(function (candidate) { return candidate.key === event.key; });
      if (category) selectCategory(category.id);
    });
    render();
  </script>
</body>
</html>`;

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
