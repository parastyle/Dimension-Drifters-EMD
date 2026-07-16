#!/usr/bin/env node
// artkit/gen-particle-packs.mjs — §41 the CODEX PARTICLE FACTORY: the magma-ball pipeline generalized into a
// systematic ELEMENT × SHAPE matrix. Each pack renders ONE cluster of ~10 separate painted particles on
// #00ff00 → chroma-key → connected-component dissection → an equal-cell horizontal spritesheet installed to
// packages/client/public/particles/<pack>.png, plus ONE generated manifest the engine consumes.
//
//   node tools/artkit/gen-particle-packs.mjs                # the full 12×8 matrix (96 packs, ~960 particles)
//   node tools/artkit/gen-particle-packs.mjs fire-shard     # just one pack
//
// Output manifest: packages/client/src/vfx/particle-manifest.ts (PARTICLE_PACKS: id → {url, frameWidth, count}).
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const OUT = resolve(here, "out/particles");
const PUBLIC = resolve(REPO, "packages/client/public/particles");
const MANIFEST = resolve(REPO, "packages/client/src/vfx/particle-manifest.ts");
mkdirSync(OUT, { recursive: true });
mkdirSync(PUBLIC, { recursive: true });
configureCodex({ perChatRoot: resolve(here, ".artkit-codex-homes"), log: (m) => console.log(m) });

// ── The systematic matrix ────────────────────────────────────────────────────────────────────────────
const ELEMENTS = {
  fire: "FIRE — molten orange-red with white-hot cores (#ff6a2a over #fff3b0), licking flame edges, embers",
  frost: "FROST — glacial ice, pale cyan over deep blue (#6fd6ff over #1e3a8a), crystalline, frosted edges",
  shock: "SHOCK — electric yellow-white lightning energy (#ffe24a with #ffffff cores), crackling, jagged",
  void: "VOID — dark purple anti-light (#b14bff edges around near-black #14001f cores), smoky, unstable",
  arcane: "ARCANE — violet-blue spell energy (#8f6aff with glowing runic flecks), luminous, mystical",
  holy: "HOLY — warm radiant gold-white light (#ffe6a0 over #ffffff), soft glow, sacred",
  toxic: "TOXIC — virulent acid green (#9cff3b over #3a5f0b), dripping, caustic, bubbling",
  steel: "STEEL — hot metal sparks, silver-white slivers with orange friction heat (#eef2f6 + #ffb24a)",
  blood: "BLOOD — deep crimson gore (#7a1020 over #c4313f), wet specular sheen, viscous, dark clotted edges",
  sand: "SAND — dry tan grit (#c49a5a over #8a6840), dusty, granular, chalky wind-scoured edges",
  water: "WATER — clear blue droplets and splashes (#6fd6ff over #1e6fa8), translucent highlights, fluid, fresh",
  nature: "NATURE — living green leaves, spores, and petals (#6eaa42 over #d8ef9a), organic, buoyant, varied",
};
const SHAPES = {
  shard: "angular broken SHARDS / splinters, sharp jagged fragments in assorted sizes and angles",
  orb: "round ORBS / droplets, glowing spheres with bright cores and soft falloff, assorted sizes",
  bolt: "jagged BOLT segments / zigzag energy streaks, elongated and directional, assorted lengths",
  mote: "small MOTES / sparks / specks, tiny simple glowing points and flecks, assorted tiny sizes",
  ring: "RINGS / circular halos, thin glowing loops and arcs, some broken/partial, assorted diameters",
  wisp: "curling WISPS / flame-tongue trails, soft S-curved streamers that taper, assorted curves",
  spark: "tiny fast SPARKS / hot chips, short sharp directional flecks with bright cores, additive-friendly",
  splat: "directional SPLATS / impact smears for kills and wall hits, wet or dry streaks with scattered flecks",
};

const packs = [];
for (const [el, elDesc] of Object.entries(ELEMENTS))
  for (const [sh, shDesc] of Object.entries(SHAPES))
    packs.push({
      id: `${el}-${sh}`,
      prompt: `Paint a loose CLUSTER of exactly 10 SEPARATE small video-game VFX particle sprites on a flat
PURE GREEN #00ff00 background. The particles: ${shDesc}. The look: ${elDesc}. Painterly with clean silhouettes.
Every particle FULLY SEPARATED from the others by clear green space (at least a particle-width apart, nothing
touching or overlapping), scattered casually across the canvas. Each one a distinct variation of the same
family. NO text, NO border, NO background detail — only the 10 particles on flat #00ff00.`,
    });

// ── chroma-key (the pinned #00ff00 method, inlined) ─────────────────────────────────────────────────
async function keyGreen(rawPath) {
  const { data, info } = await sharp(rawPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  for (let i = 0; i < W * H; i++) {
    const o = i * C;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    const dom = g - Math.max(r, b);
    if (dom > 90) data[o + 3] = 0; // hard green → transparent
    else if (dom > 40) {
      data[o + 3] = Math.round(255 * (1 - (dom - 40) / 50)); // soft edge
      data[o + 1] = Math.max(r, b); // despill the green fringe
    }
  }
  return { data, W, H, C };
}

// ── connected-component dissection → equal-cell sheet (the slice-scatter method) ────────────────────
async function sliceToSheet(keyed, outPath, cellPx = 96, minArea = 120, maxCells = 12) {
  const { data, W, H, C } = keyed;
  const A = (x, y) => data[(y * W + x) * C + 3];
  const seen = new Uint8Array(W * H);
  const stack = new Int32Array(W * H);
  const blobs = [];
  for (let y0 = 0; y0 < H; y0++)
    for (let x0 = 0; x0 < W; x0++) {
      const i0 = y0 * W + x0;
      if (seen[i0] || A(x0, y0) <= 40) continue;
      let sp = 0;
      stack[sp++] = i0;
      seen[i0] = 1;
      let minx = x0, maxx = x0, miny = y0, maxy = y0, area = 0;
      while (sp > 0) {
        const i = stack[--sp], x = i % W, y = (i / W) | 0;
        area++;
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
        for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const ni = ny * W + nx;
          if (!seen[ni] && A(nx, ny) > 40) { seen[ni] = 1; stack[sp++] = ni; }
        }
      }
      if (area >= minArea) blobs.push({ minx, miny, w: maxx - minx + 1, h: maxy - miny + 1, area });
    }
  blobs.sort((a, b) => b.area - a.area);
  const use = blobs.slice(0, maxCells);
  if (use.length < 4) return 0; // too few particles — treat the render as a failure
  const png = await sharp(Buffer.from(data), { raw: { width: W, height: H, channels: C } }).png().toBuffer();
  const cells = await Promise.all(
    use.map((b) =>
      sharp(png)
        .extract({ left: b.minx, top: b.miny, width: b.w, height: b.h })
        .resize(cellPx - 8, cellPx - 8, { fit: "inside", withoutEnlargement: false })
        .toBuffer()
        .then(async (buf) => {
          const m = await sharp(buf).metadata();
          return { buf, w: m.width ?? 1, h: m.height ?? 1 };
        }),
    ),
  );
  await sharp({ create: { width: cellPx * cells.length, height: cellPx, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(cells.map((c, i) => ({ input: c.buf, left: i * cellPx + ((cellPx - c.w) >> 1), top: (cellPx - c.h) >> 1 })))
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  return cells.length;
}

// ── run: bounded concurrency over the matrix ─────────────────────────────────────────────────────────
const only = process.argv[2];
const todo = only ? packs.filter((p) => p.id === only) : packs;
if (!todo.length) { console.log(`unknown pack "${only}"`); process.exit(1); }
const CELL = 96;
const CONCURRENCY = 8;
const results = [];
let next = 0;
async function worker() {
  for (;;) {
    const job = todo[next++];
    if (!job) return;
    const raw = resolve(OUT, `${job.id}-raw.png`);
    try {
      if (!existsSync(raw)) {
        console.log(`=== render ${job.id} ===`);
        const code = await runCodexExec({
          prompt: job.prompt, cwd: REPO, label: `ptcl-${job.id}`, harvestTo: raw,
          stdoutFile: resolve(OUT, `${job.id}.codex.log`),
        });
        if (code !== 0 || !existsSync(raw)) { console.log(`FAIL render ${job.id}`); results.push({ id: job.id, count: 0 }); continue; }
      }
      const keyed = await keyGreen(raw);
      const count = await sliceToSheet(keyed, resolve(PUBLIC, `${job.id}.png`), CELL);
      console.log(count >= 4 ? `OK ${job.id} — ${count} particles` : `FAIL slice ${job.id} (${count})`);
      results.push({ id: job.id, count: count >= 4 ? count : 0 });
    } catch (e) {
      console.log(`FAIL ${job.id}: ${e.message}`);
      results.push({ id: job.id, count: 0 });
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// ── manifest (merge with any packs already installed from earlier runs) ─────────────────────────────
const entries = new Map();
if (existsSync(MANIFEST)) {
  const prev = readFileSync(MANIFEST, "utf8");
  for (const m of prev.matchAll(/"([a-z-]+)": \{ url: "particles\/[a-z-]+\.png", frameWidth: (\d+), count: (\d+) \}/g)) {
    entries.set(m[1], { frameWidth: Number(m[2]), count: Number(m[3]) });
  }
}
for (const r of results) if (r.count > 0) entries.set(r.id, { frameWidth: CELL, count: r.count });
const ids = [...entries.keys()].sort();
const body = ids.map((id) => `  "${id}": { url: "particles/${id}.png", frameWidth: ${entries.get(id).frameWidth}, count: ${entries.get(id).count} },`).join("\n");
writeFileSync(
  MANIFEST,
  `// AUTO-GENERATED by tools/artkit/gen-particle-packs.mjs — §41 the Codex particle factory. Do not edit.
// Each pack is an equal-cell horizontal spritesheet of individually painted VFX particles (chroma-keyed +
// connected-component dissected from one cluster render). Consumed by vfx/particles.ts.
export interface ParticlePack {
  url: string;
  frameWidth: number;
  count: number;
}
export const PARTICLE_PACKS: Record<string, ParticlePack> = {
${body}
};
export const PARTICLE_PACK_IDS = Object.keys(PARTICLE_PACKS);
`,
);
const ok = results.filter((r) => r.count > 0);
console.log(`\nparticle packs: ${ok.length}/${todo.length} ok · ${ok.reduce((s, r) => s + r.count, 0)} particles · manifest ${ids.length} packs total`);
