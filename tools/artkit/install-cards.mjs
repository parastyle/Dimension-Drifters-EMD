#!/usr/bin/env node
// install-cards.mjs — sync generated weapon CARD art into the game (the §9 carousel counterpart to
// harvest-install.mjs for sprites). For every WEAPON id that has rendered card art, PRESIZE
// out/<id>/cardart.png (Codex masters are ~1400px / ~2.3MB — far bigger than the carousel's ~220px window)
// down to a game-res JPEG at packages/client/public/cards/<id>.jpg. JPEG (no alpha needed — a card face is
// a rectangular illustration) keeps the whole set to ~10-15MB instead of ~700MB of raw PNG.
//
// Filtered to the actual weapon id set (WEAPON_IDS + EXPANSION_WEAPON_IDS + WEAPONS keys), passed in via
// weapon-ids.tmp.json (generated from the built @dd/shared), so character/boss/enemy cardart never leaks
// into the weapon carousel (and never bloats the boot preload — non-expansion weapon cards preload at boot).
//
//   node --input-type=module -e "import * as S from '@dd/shared'; ..."  # writes weapon-ids.tmp.json
//   node tools/artkit/install-cards.mjs
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "out");
const CARDS = resolve(ROOT, "..", "..", "packages", "client", "public", "cards");
mkdirSync(CARDS, { recursive: true });

// Longest-side px for the presized card. The carousel draws the card face at ~220px; 2× keeps it crisp at
// hi-DPI without shipping the 1400px master.
const CARD_LONG = Number(process.env.CARD_LONG || 460);

const idsFile = join(ROOT, "weapon-ids.tmp.json");
if (!existsSync(idsFile)) {
  console.error(
    `No ${idsFile}. Generate it first from the built @dd/shared (WEAPON_IDS + EXPANSION_WEAPON_IDS + WEAPONS keys).`,
  );
  process.exit(1);
}
const weaponIds = new Set(JSON.parse(readFileSync(idsFile, "utf8")));

const present = new Set(readdirSync(OUT));
let n = 0;
let skipped = 0;
const jobs = [];
for (const id of weaponIds) {
  if (id === "fists") continue; // fists has no card
  const src = join(OUT, id, "cardart.png");
  if (!present.has(id) || !existsSync(src)) {
    skipped++;
    continue;
  }
  jobs.push(
    sharp(src)
      .resize(CARD_LONG, CARD_LONG, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(join(CARDS, `${id}.jpg`))
      .then(() => {
        n++;
      })
      .catch((e) => {
        console.error(`[install-cards] FAILED ${id}: ${e.message}`);
      }),
  );
}
await Promise.all(jobs);
console.log(
  `[install-cards] presized ${n} weapon card(s) → public/cards/*.jpg (${skipped} weapon ids had no rendered cardart)`,
);
