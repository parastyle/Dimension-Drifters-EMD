// Verify a plain-JS port of generateArena reproduces the REAL @dd/shared build byte-for-byte (so the
// review widget can roll live maps that match the game). Compares against tmp-maps.json.
const fs = require("node:fs");
const REAL = JSON.parse(fs.readFileSync("tmp-maps.json", "utf8"));

const TILE_GROUND = 0;
const TILE_PIT = 1;
const COLS = 30;
const ROWS = 30;
const TILE = 80;
const BORDER = 1;
const SPAWN_CLEAR = 3;
const PIT_TARGET = 0.16;
const PIT_SPACING = 4;
const PIT_MAX = 0.26;
const MAX_JUMP = 2;
const CARD = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const idx = (x, y) => y * COLS + x;
const inB = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;

function makeRng(seed) {
  let s = seed | 0;
  const next = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const range = (a, b) => a + next() * (b - a);
  return { next, range, int: (a, b) => Math.floor(range(a, b + 1)), chance: (p) => next() < p };
}
function mixSeeds(...nums) {
  let h = 0x9e3779b1 | 0;
  for (const n of nums) {
    h = Math.imul(h ^ (n | 0), 0x85ebca6b);
    h = (h ^ (h >>> 13)) | 0;
  }
  h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f);
  return (h ^ (h >>> 16)) >>> 0;
}
function pitSites(rng) {
  const sites = [];
  const sp2 = PIT_SPACING * PIT_SPACING;
  const wanted = Math.max(4, Math.round((COLS * ROWS * PIT_TARGET) / 9));
  const attempts = wanted * 12;
  for (let a = 0; a < attempts && sites.length < wanted; a++) {
    const x = rng.int(BORDER + 1, COLS - BORDER - 2);
    const y = rng.int(BORDER + 1, ROWS - BORDER - 2);
    let ok = true;
    for (const [sx, sy] of sites) {
      const dx = sx - x;
      const dy = sy - y;
      if (dx * dx + dy * dy < sp2) {
        ok = false;
        break;
      }
    }
    if (ok) sites.push([x, y]);
  }
  return sites;
}
function growBlob(tiles, cx, cy, rng) {
  const r = rng.int(1, 2);
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (!inB(x, y)) continue;
      const dist = Math.hypot(dx, dy);
      if (dist > r + 0.5) continue;
      if (dist <= r - 0.5 || rng.chance(1 - (dist - (r - 0.5)))) tiles[idx(x, y)] = TILE_PIT;
    }
}
function smooth(tiles) {
  const next = tiles.slice();
  for (let y = 1; y < ROWS - 1; y++)
    for (let x = 1; x < COLS - 1; x++) {
      let pit = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (tiles[idx(x + dx, y + dy)] === TILE_PIT) pit++;
        }
      const i = idx(x, y);
      if (pit >= 5) next[i] = TILE_PIT;
      else if (pit <= 2) next[i] = TILE_GROUND;
    }
  tiles.set(next);
}
function pitCount(tiles) {
  let n = 0;
  for (let i = 0; i < tiles.length; i++) if (tiles[i] === TILE_PIT) n++;
  return n;
}
function erode(tiles) {
  const next = tiles.slice();
  for (let y = 1; y < ROWS - 1; y++)
    for (let x = 1; x < COLS - 1; x++) {
      const i = idx(x, y);
      if (tiles[i] !== TILE_PIT) continue;
      let pit = 0;
      for (const [dx, dy] of CARD) if (tiles[idx(x + dx, y + dy)] === TILE_PIT) pit++;
      if (pit <= 2) next[i] = TILE_GROUND;
    }
  tiles.set(next);
}
function forceGround(tiles, sx, sy) {
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const onB = x < BORDER || y < BORDER || x >= COLS - BORDER || y >= ROWS - BORDER;
      const inS = Math.hypot(x - sx, y - sy) <= SPAWN_CLEAR;
      if (onB || inS) tiles[idx(x, y)] = TILE_GROUND;
    }
}
function reachable(tiles, start) {
  const seen = new Uint8Array(COLS * ROWS);
  if (tiles[start] !== TILE_GROUND) return seen;
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const cur = stack.pop();
    const cx = cur % COLS;
    const cy = (cur / COLS) | 0;
    for (const [dx, dy] of CARD) {
      const wx = cx + dx;
      const wy = cy + dy;
      if (inB(wx, wy)) {
        const wi = idx(wx, wy);
        if (tiles[wi] === TILE_GROUND && !seen[wi]) {
          seen[wi] = 1;
          stack.push(wi);
        }
      }
      for (let g = 1; g <= MAX_JUMP; g++) {
        const mx = cx + dx * g;
        const my = cy + dy * g;
        if (!inB(mx, my) || tiles[idx(mx, my)] !== TILE_PIT) break;
        const lx = cx + dx * (g + 1);
        const ly = cy + dy * (g + 1);
        if (!inB(lx, ly)) continue;
        const li = idx(lx, ly);
        if (tiles[li] === TILE_GROUND && !seen[li]) {
          seen[li] = 1;
          stack.push(li);
        }
      }
    }
  }
  return seen;
}
function groundComponent(tiles, start) {
  const out = [];
  const seen = new Uint8Array(COLS * ROWS);
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const cur = stack.pop();
    out.push(cur);
    const cx = cur % COLS;
    const cy = (cur / COLS) | 0;
    for (const [dx, dy] of CARD) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inB(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (tiles[ni] === TILE_GROUND && !seen[ni]) {
        seen[ni] = 1;
        stack.push(ni);
      }
    }
  }
  return out;
}
function carveBridge(tiles, from, reached) {
  const prev = new Int32Array(COLS * ROWS).fill(-1);
  const seen = new Uint8Array(COLS * ROWS);
  const q = [from];
  seen[from] = 1;
  let head = 0;
  let found = -1;
  while (head < q.length) {
    const cur = q[head++];
    if (cur !== from && tiles[cur] === TILE_GROUND && reached[cur]) {
      found = cur;
      break;
    }
    const cx = cur % COLS;
    const cy = (cur / COLS) | 0;
    for (const [dx, dy] of CARD) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inB(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (!seen[ni]) {
        seen[ni] = 1;
        prev[ni] = cur;
        q.push(ni);
      }
    }
  }
  if (found < 0) return false;
  for (let node = found; node !== -1 && node !== from; node = prev[node]) tiles[node] = TILE_GROUND;
  return true;
}
function ensureConnected(tiles, spawn) {
  const NUB = 3;
  const maxR = COLS * ROWS;
  for (let r = 0; r < maxR; r++) {
    const reached = reachable(tiles, spawn);
    let target = -1;
    for (let i = 0; i < tiles.length; i++)
      if (tiles[i] === TILE_GROUND && !reached[i]) {
        target = i;
        break;
      }
    if (target < 0) return;
    const region = groundComponent(tiles, target);
    if (region.length <= NUB || !carveBridge(tiles, target, reached))
      for (const i of region) tiles[i] = TILE_PIT;
  }
  const reached = reachable(tiles, spawn);
  for (let i = 0; i < tiles.length; i++)
    if (tiles[i] === TILE_GROUND && !reached[i]) tiles[i] = TILE_PIT;
}
function generateArena(s) {
  const tiles = new Uint8Array(COLS * ROWS);
  const sc = Math.floor(COLS / 2);
  const sr = Math.floor(ROWS / 2);
  const hz = makeRng(mixSeeds(s.seedHazard, s.seedTerrain, 0x1701));
  for (const [sx, sy] of pitSites(hz)) growBlob(tiles, sx, sy, hz);
  smooth(tiles);
  smooth(tiles);
  const cap = Math.floor(COLS * ROWS * PIT_MAX);
  for (let g = 0; g < 8 && pitCount(tiles) > cap; g++) erode(tiles);
  forceGround(tiles, sc, sr);
  ensureConnected(tiles, idx(sc, sr));
  return tiles;
}

let pass = 0;
for (const m of REAL) {
  const sc = m.spawnCol;
  const sr = m.spawnRow;
  void sc;
  void sr;
  const tiles = generateArena({
    seedHazard: m.__h ?? null,
  });
  void tiles;
}
// We need the actual seeds; re-dump expects seeds. tmp-maps.json doesn't carry seeds, so regenerate from
// the SAME seed list used to produce it.
const SEEDS = [
  [2070146939, 3950870455, 202598712, 1141054278],
  [11, 22, 33, 44],
  [7, 101, 5, 9],
  [123456, 654321, 1, 2],
  [999, 1, 2, 3],
  [42, 42, 42, 42],
  [314159, 271828, 161803, 141421],
  [8675309, 5551234, 1, 7],
];
pass = 0;
for (let k = 0; k < SEEDS.length; k++) {
  const [a, b, c, d] = SEEDS[k];
  const t = generateArena({ seedTerrain: a, seedHazard: b, seedTheme: c, seedDecor: d });
  const str = Array.from(t).join("");
  if (str === REAL[k].tiles) pass++;
  else console.log(`MISMATCH seed#${k}`);
}
console.log(`port matches real build: ${pass}/${SEEDS.length}`);
