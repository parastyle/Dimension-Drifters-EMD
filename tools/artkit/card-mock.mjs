// Throwaway mock of the redesigned weapon card (full-bleed art + overlaid info panel + drawn icons
// + damage equation + scaling-grade chips). Renders via SVG-over-art with sharp so we can eyeball
// the design before porting it to the in-game Phaser card. node tools/artkit/card-mock.mjs
import sharp from "sharp";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(ROOT, "..", "..");
const W = 280, H = 392, R = 16;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

const GRADE_COL = { S: "#ffd479", A: "#ff8a2b", B: "#9cff3b", C: "#6fd6ff", D: "#6f8bff", E: "#9a9484" };

// ── little drawn icons (white strokes; recoloured per use) ──
const icon = {
  dmg: (x, y, s, c) => `<g stroke="${c}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(${x},${y})">
    <path d="M0 ${-s} L${s * 0.34} ${s * 0.5} L0 ${s * 0.75} L${-s * 0.34} ${s * 0.5} Z" fill="${c}" fill-opacity="0.25"/>
    <line x1="0" y1="${s * 0.75}" x2="0" y2="${s}"/><line x1="${-s * 0.45}" y1="${s * 0.62}" x2="${s * 0.45}" y2="${s * 0.62}"/></g>`,
  reach: (x, y, s, c) => `<g stroke="${c}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(${x},${y})">
    <line x1="${-s}" y1="0" x2="${s}" y2="0"/><path d="M${-s} 0 l${s * 0.4} ${-s * 0.4} M${-s} 0 l${s * 0.4} ${s * 0.4}"/><path d="M${s} 0 l${-s * 0.4} ${-s * 0.4} M${s} 0 l${-s * 0.4} ${s * 0.4}"/></g>`,
  speed: (x, y, s, c) => `<g stroke="${c}" stroke-width="1.8" fill="none" stroke-linecap="round" transform="translate(${x},${y})">
    <circle cx="0" cy="${s * 0.1}" r="${s * 0.8}"/><line x1="0" y1="${-s}" x2="0" y2="${-s * 0.5}"/><line x1="0" y1="${s * 0.1}" x2="0" y2="${-s * 0.35}"/><line x1="0" y1="${s * 0.1}" x2="${s * 0.45}" y2="${s * 0.1}"/></g>`,
  aoe: (x, y, s, c) => `<g stroke="${c}" stroke-width="1.8" fill="none" transform="translate(${x},${y})">
    <circle cx="0" cy="0" r="${s * 0.35}" fill="${c}" fill-opacity="0.3"/><circle cx="0" cy="0" r="${s * 0.75}" stroke-opacity="0.6"/></g>`,
  pierce: (x, y, s, c) => `<g stroke="${c}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(${x},${y})">
    <line x1="${-s}" y1="0" x2="${s}" y2="0"/><path d="M${s} 0 l${-s * 0.5} ${-s * 0.4} M${s} 0 l${-s * 0.5} ${s * 0.4}"/></g>`,
};

function statGroup(x, y, ic, value, c) {
  return `${ic(x, y - 4, 9, c)}<text x="${x}" y="${y + 20}" font-family="sans-serif" font-size="13" font-weight="700" fill="#f0ead8" text-anchor="middle">${esc(value)}</text>`;
}

function chip(x, y, attr, grade) {
  const c = GRADE_COL[grade], w = 50;
  return `<g transform="translate(${x},${y})">
    <rect x="0" y="0" width="${w}" height="20" rx="5" fill="#000000" fill-opacity="0.45" stroke="${c}" stroke-opacity="0.7"/>
    <text x="8" y="14" font-family="sans-serif" font-size="11" font-weight="700" fill="#cfc6ae">${attr}</text>
    <text x="${w - 8}" y="14" font-family="sans-serif" font-size="12" font-weight="800" fill="${c}" text-anchor="end">${grade}</text></g>`;
}

function overlaySvg(card) {
  const { accent, size, grip, name, sub, base, bonus, total, grades, stats } = card;
  const chips = Object.entries(grades).map(([a, g], i) => chip(16 + i * 58, H - 92, a.toUpperCase(), g)).join("");
  const sw = W / (stats.length + 0.0);
  const statsSvg = stats.map((s, i) => statGroup(sw * (i + 0.5), H - 52, icon[s.icon], s.value, "#cfc6ae")).join("");
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="pan" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.42" stop-color="#0a0805" stop-opacity="0"/>
      <stop offset="0.62" stop-color="#0a0805" stop-opacity="0.78"/>
      <stop offset="1" stop-color="#070503" stop-opacity="0.97"/></linearGradient></defs>
    <rect x="0" y="${H * 0.4}" width="${W}" height="${H * 0.6}" fill="url(#pan)"/>
    <!-- border -->
    <rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="${R}" fill="none" stroke="${accent}" stroke-width="3" stroke-opacity="0.92"/>
    <rect x="5" y="5" width="${W - 10}" height="${H - 10}" rx="${R - 4}" fill="none" stroke="#000000" stroke-opacity="0.4"/>
    <!-- top-left size badge -->
    <circle cx="30" cy="30" r="19" fill="#0c0a07" fill-opacity="0.82" stroke="${accent}" stroke-width="2"/>
    <text x="30" y="36" font-family="sans-serif" font-size="17" font-weight="800" fill="#f0ead8" text-anchor="middle">${size}</text>
    <!-- top-right grip pill -->
    <rect x="${W - 86}" y="14" width="72" height="24" rx="12" fill="#0c0a07" fill-opacity="0.8" stroke="${accent}" stroke-opacity="0.6"/>
    <text x="${W - 50}" y="30" font-family="sans-serif" font-size="11" font-weight="700" fill="${accent}" text-anchor="middle">${grip}</text>
    <!-- name + subtitle -->
    <text x="16" y="${H * 0.6}" font-family="sans-serif" font-size="22" font-weight="800" fill="#f6efe0">${esc(name)}</text>
    <text x="16" y="${H * 0.6 + 19}" font-family="sans-serif" font-size="12.5" font-weight="600" fill="#b9b3a3">${esc(sub)}</text>
    <line x1="16" y1="${H * 0.6 + 28}" x2="${W - 16}" y2="${H * 0.6 + 28}" stroke="${accent}" stroke-opacity="0.35"/>
    <!-- damage equation: base + bonus = total -->
    ${icon.dmg(28, H * 0.6 + 52, 11, "#ff8a2b")}
    <text x="46" y="${H * 0.6 + 58}" font-family="sans-serif" font-size="19" font-weight="800">
      <tspan fill="#e8e2d4">${base}</tspan><tspan fill="#8a8478"> + </tspan><tspan fill="#9cff3b">${bonus}</tspan><tspan fill="#8a8478"> = </tspan><tspan fill="#ffd479" font-size="22">${total}</tspan></text>
    <!-- scaling grade chips -->
    ${chips}
    <!-- icon stat row -->
    ${statsSvg}
  </svg>`;
}

async function makeCard(id, card) {
  const art = await sharp(join(REPO, "tools", "artkit", "out", id, "cardart.png"))
    .resize(W, H, { fit: "cover", position: "top" }).toBuffer();
  const mask = Buffer.from(`<svg width="${W}" height="${H}"><rect x="0" y="0" width="${W}" height="${H}" rx="${R}" fill="#fff"/></svg>`);
  const rounded = await sharp(art).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  return sharp(rounded).composite([{ input: Buffer.from(overlaySvg(card)), top: 0, left: 0 }]).png().toBuffer();
}

// sample mid-run stats for the equation demo: STR 8, DEX 10
const cards = {
  driftblade: { accent: "#6fd6ff", size: "XL", grip: "2-HAND", name: "Driftblade", sub: "Sword · Physical",
    base: 9, bonus: 8, total: 17, grades: { str: "C", dex: "B" }, stats: [{ icon: "reach", value: 280 }, { icon: "speed", value: "0.62s" }] },
  "tombstone-greatsword": { accent: "#9cff3b", size: "L", grip: "2-HAND", name: "Tombstone", sub: "Sword · Physical",
    base: 11, bonus: 6, total: 17, grades: { str: "A" }, stats: [{ icon: "reach", value: 156 }, { icon: "speed", value: "0.78s" }, { icon: "aoe", value: 185 }] },
};

const bufs = await Promise.all(Object.entries(cards).map(([id, c]) => makeCard(id, c)));
const GAP = 24, OW = W * bufs.length + GAP * (bufs.length + 1), OH = H + GAP * 2;
await sharp({ create: { width: OW, height: OH, channels: 4, background: { r: 18, g: 16, b: 11, alpha: 1 } } })
  .composite(bufs.map((b, i) => ({ input: b, top: GAP, left: GAP + i * (W + GAP) })))
  .png().toFile(join(REPO, "tmp-card-mock.png")); // PNG: crisp text (JPEG blurs small type)
console.log("ok", OW, OH);
