#!/usr/bin/env node
// install-cards.mjs — sync generated card art into the game (the missing counterpart to
// harvest-install.mjs for sprites). Copies out/<id>/cardart.png → packages/client/public/cards/<id>.png
// for every weapon, so regenerating card art + running this is ONE step (no manual `cp`, no stale art).
//   node tools/artkit/install-cards.mjs
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "out");
const CARDS = resolve(ROOT, "..", "..", "packages", "client", "public", "cards");
mkdirSync(CARDS, { recursive: true });

let n = 0;
for (const id of readdirSync(OUT)) {
  if (id.startsWith("vfx-") || id.startsWith("x-") || id.startsWith("_") || id.startsWith(".")) continue;
  const src = join(OUT, id, "cardart.png");
  if (!existsSync(src)) continue;
  copyFileSync(src, join(CARDS, `${id}.png`));
  console.log(`[install-cards] ${id} → public/cards/${id}.png`);
  n++;
}
console.log(`[install-cards] synced ${n} card(s).`);
