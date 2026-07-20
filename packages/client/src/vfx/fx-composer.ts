// Bespoke weapon-FX component composer (§49): unlike a flipbook, every trimmed island owns a timeline —
// especially shrapnel, whose separately-cut pieces must fan/spin independently instead of moving as a slab.
import Phaser from "phaser";
import { wispTweenTiming } from "./fx-emitter-lifetime.js";
import { FX_BUZZSAW_WAKE } from "./fx-pack-buzzsaw-wake.js";
import { FX_EMBER_ERUPTION } from "./fx-pack-ember-eruption.js";
import { FX_FROST_NOVA } from "./fx-pack-frost-nova.js";
import { FX_GRAVE_CALL } from "./fx-pack-grave-call.js";
import { FX_HOLY_SMITE } from "./fx-pack-holy-smite.js";
import { FX_LIGHTNING_BALL } from "./fx-pack-lightning-ball.js";
import { FX_NUKE } from "./fx-pack-nuke.js";
import { FX_QUAKE_BURST } from "./fx-pack-quake-burst.js";
import { FX_STORM_CALL } from "./fx-pack-storm-call.js";
import { FX_TIDE_CRASH } from "./fx-pack-tide-crash.js";
import { FX_TOXIC_BURST } from "./fx-pack-toxic-burst.js";
import { FX_VOID_IMPLOSION } from "./fx-pack-void-implosion.js";

export const FX_PACK_NAMES = [
  "nuke",
  "lightning-ball",
  "frost-nova",
  "void-implosion",
  "holy-smite",
  "toxic-burst",
  "ember-eruption",
  "storm-call",
  "buzzsaw-wake",
  "tide-crash",
  "quake-burst",
  "grave-call",
] as const;
export type FxPackName = (typeof FX_PACK_NAMES)[number];

const PACK_TEXTURES: Record<FxPackName, readonly string[]> = {
  nuke: FX_NUKE,
  "lightning-ball": FX_LIGHTNING_BALL,
  "frost-nova": FX_FROST_NOVA,
  "void-implosion": FX_VOID_IMPLOSION,
  "holy-smite": FX_HOLY_SMITE,
  "toxic-burst": FX_TOXIC_BURST,
  "ember-eruption": FX_EMBER_ERUPTION,
  "storm-call": FX_STORM_CALL,
  "buzzsaw-wake": FX_BUZZSAW_WAKE,
  "tide-crash": FX_TIDE_CRASH,
  "quake-burst": FX_QUAKE_BURST,
  "grave-call": FX_GRAVE_CALL,
};

interface ComponentBand {
  indexes: readonly number[];
  /** Energy/light uses ADD; painted water, stone, metal, smoke and all debris stay NORMAL. */
  additive?: boolean;
}

interface PackPlan {
  core: ComponentBand;
  hot?: ComponentBand;
  rings?: ComponentBand;
  shrapnel?: readonly number[];
  wisps?: ComponentBand;
  ground?: readonly number[];
}

// gen-decals authored each spread semantically left→right, but the extractor numbered ACTUAL detected islands
// by their x positions (and occasionally omitted/shifted an island). These roles are therefore from a visual
// audit against those prompts, not wishful ordinal ranges: e.g. lightning is arc 0/ring 1/CORE 2, nuke is
// mushroom 0/CORE 1/smaller mushroom 2/rings 3–4, and quake is CORE 0/chunks 1–4/ring 5/crack 6/plume 7.
const PACK_PLANS: Record<FxPackName, PackPlan> = {
  nuke: {
    core: { indexes: [1], additive: true },
    rings: { indexes: [3, 4], additive: true },
    shrapnel: [7, 9, 10],
    wisps: { indexes: [0, 2, 6, 8] }, // two mushroom stages, dust wall, ash cloud
    ground: [5],
  },
  "lightning-ball": {
    core: { indexes: [2], additive: true },
    hot: { indexes: [0, 3, 7], additive: true }, // three authored arc filaments
    rings: { indexes: [1], additive: true },
    shrapnel: [4, 5, 8, 9, 10],
    wisps: { indexes: [6], additive: true },
  },
  "frost-nova": {
    core: { indexes: [0], additive: true },
    rings: { indexes: [1], additive: true },
    shrapnel: [2, 3, 4, 5, 9],
    wisps: { indexes: [6, 7] },
    ground: [8],
  },
  "void-implosion": {
    core: { indexes: [2], additive: true },
    rings: { indexes: [3, 9], additive: true }, // inward-authored ring + distortion halo
    shrapnel: [0, 1, 4, 5, 6],
    wisps: { indexes: [7, 8], additive: true },
  },
  "holy-smite": {
    core: { indexes: [2], additive: true }, // pillar; shards precede it at 0–1 in the extracted spread
    hot: { indexes: [6, 8, 9], additive: true },
    rings: { indexes: [3], additive: true },
    shrapnel: [0, 1, 4, 5],
    wisps: { indexes: [7] }, // feather
  },
  "toxic-burst": {
    core: { indexes: [0], additive: true },
    shrapnel: [3, 4, 5, 6, 7],
    wisps: { indexes: [1, 2, 9] }, // gas puffs + bubble cluster
    ground: [8],
  },
  "ember-eruption": {
    core: { indexes: [2], additive: true },
    hot: { indexes: [0, 1, 3], additive: true }, // three lava-gout tongues
    shrapnel: [5, 6, 7, 8, 9],
    wisps: { indexes: [4] },
    ground: [10],
  },
  "storm-call": {
    core: { indexes: [6], additive: true }, // distant flash glow
    hot: { indexes: [1, 2, 3], additive: true },
    wisps: { indexes: [0, 4, 5, 7] }, // storm cloud, rain sheet, two wind swirls
  },
  "buzzsaw-wake": {
    core: { indexes: [0] }, // blade blur is metal, not an additive light disc
    hot: { indexes: [1, 2, 3, 4], additive: true },
    shrapnel: [5, 6, 7],
    wisps: { indexes: [8] }, // the authored cut-line island was not retained by extraction
  },
  "tide-crash": {
    core: { indexes: [0] },
    rings: { indexes: [1, 2] }, // foam ring was extracted as two curling water arcs
    shrapnel: [3, 4, 5, 6, 7],
    wisps: { indexes: [8] },
    ground: [9],
  },
  "quake-burst": {
    core: { indexes: [0] },
    rings: { indexes: [5] },
    shrapnel: [1, 2, 3, 4],
    wisps: { indexes: [7] },
    ground: [6],
  },
  "grave-call": {
    core: { indexes: [0], additive: true },
    rings: { indexes: [1], additive: true },
    shrapnel: [2, 3, 4, 5],
    wisps: { indexes: [6, 7], additive: true },
    ground: [8],
  },
};

const missingFxTextures = new Set<string>();
const FX_TEXTURE_PREFIX = "fx-";

/** Queue all twelve small packs. Decode/404 failure is deliberately silent: procedural combat VFX remain. */
export function preloadFxPacks(scene: Phaser.Scene): void {
  scene.load.on("loaderror", (file: Phaser.Loader.File) => {
    if (file.key.startsWith(FX_TEXTURE_PREFIX)) missingFxTextures.add(file.key);
  });
  for (const packName of FX_PACK_NAMES) {
    for (const key of PACK_TEXTURES[packName]) {
      if (scene.textures.exists(key) || missingFxTextures.has(key)) continue;
      const file = new Phaser.Loader.FileTypes.ImageFile(
        scene.load,
        key,
        `vfx/packs/${packName}/${key}.png`,
      );
      // Vite may answer an absent public asset with HTML/200; consume that decode failure just like a 404.
      file.onProcessError = () => {
        missingFxTextures.add(key);
        file.state = Phaser.Loader.FILE_ERRORED;
        file.loader.fileProcessComplete(file);
      };
      scene.load.addFile(file);
    }
  }
}

export interface PlayFxPackOpts {
  /** Pixel-size driver. Explosion/quake callers pass their gameplay radius, keeping visual tiers stable. */
  intensity?: number;
  /** Alias for intensity when the call site naturally owns a radius. `radius` wins when both are supplied. */
  radius?: number;
}

interface FrameBudget {
  frame: number;
  spent: number;
}

const frameBudgets = new WeakMap<Phaser.Scene, FrameBudget>();
const FX_PACK_FRAME_BUDGET = 10; // mirrors ArenaScene's ten full authored-contact stacks per render frame

function spendFrameBudget(scene: Phaser.Scene): boolean {
  const frame = scene.game.loop.frame;
  let b = frameBudgets.get(scene);
  if (!b) {
    b = { frame, spent: 0 };
    frameBudgets.set(scene, b);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => frameBudgets.delete(scene));
  } else if (b.frame !== frame) {
    b.frame = frame;
    b.spent = 0;
  }
  if (b.spent >= FX_PACK_FRAME_BUDGET) return false;
  b.spent++;
  return true;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Deterministic scale tier: 110 gameplay px = authored 1×; only trajectories/rotation get organic jitter. */
function packScale(opts: PlayFxPackOpts): { scale: number; radius: number } {
  const raw = opts.radius ?? opts.intensity ?? 110;
  const radius = Number.isFinite(raw) ? Math.max(1, raw) : 110;
  return { scale: clamp(radius / 110, 0.28, 2.4), radius };
}

function imageAt(
  scene: Phaser.Scene,
  textures: readonly string[],
  index: number,
  x: number,
  y: number,
  depth: number,
  additive = false,
): Phaser.GameObjects.Image | undefined {
  const key = textures[index];
  if (!key || missingFxTextures.has(key) || !scene.textures.exists(key)) return undefined;
  try {
    const img = scene.add.image(x, y, key).setDepth(depth);
    if (additive) img.setBlendMode(Phaser.BlendModes.ADD);
    return img;
  } catch {
    return undefined; // partially-loaded/invalid optional texture: preserve the underlying procedural VFX
  }
}

/**
 * Stage one bespoke component pack at world (x,y). Returns false for an unknown/missing pack or a spent
 * frame budget; otherwise every surviving island receives its own self-destroying tween/tween-chain.
 */
export function playFxPack(
  scene: Phaser.Scene,
  packName: FxPackName,
  x: number,
  y: number,
  opts: PlayFxPackOpts = {},
): boolean {
  const plan = PACK_PLANS[packName];
  const textures = PACK_TEXTURES[packName];
  if (!plan || !textures || !textures.some((key) => scene.textures.exists(key))) return false;
  if (!spendFrameBudget(scene)) return false;
  const sizing = packScale(opts);
  const sc = sizing.scale;
  const radius = clamp(sizing.radius, 28, 280);

  const flashBand = (band: ComponentBand | undefined, baseDuration: number): void => {
    band?.indexes.forEach((index, order) => {
      const img = imageAt(scene, textures, index, x, y, 99520 + order, band.additive);
      if (!img) return;
      const targetScale = sc * (0.82 + ((index * 17) % 5) * 0.045);
      img.setScale(targetScale * 0.42).setAlpha(0.98).setRotation((Math.random() - 0.5) * 0.22);
      scene.tweens.add({
        targets: img,
        scale: targetScale * 1.08,
        alpha: 0,
        angle: img.angle + (Math.random() - 0.5) * 24,
        delay: order * 12,
        duration: baseDuration + order * 14,
        ease: "Cubic.easeOut",
        onComplete: () => img.destroy(),
      });
    });
  };
  flashBand(plan.core, 230);
  flashBand(plan.hot, 285);

  plan.rings?.indexes.forEach((index, order) => {
    const img = imageAt(scene, textures, index, x, y, 99490 + order, plan.rings?.additive);
    if (!img) return;
    const targetScale = sc * (1.02 + order * 0.1);
    img.setScale(targetScale * 0.2).setAlpha(0.88).setRotation(Math.random() * Math.PI * 2);
    scene.tweens.add({
      targets: img,
      scale: targetScale,
      alpha: 0,
      delay: order * 35,
      duration: 340 + order * 55,
      ease: "Cubic.easeOut",
      onComplete: () => img.destroy(),
    });
  });

  // ONE chain per separately-cut piece: lift/fast leg → dragged short fall leg. A shared target/tween here
  // would reassemble the source spread and defeat the entire reason shrapnel was harvested as islands.
  const shards = plan.shrapnel ?? [];
  shards.forEach((index, order) => {
    const img = imageAt(scene, textures, index, x, y, 99505 + order);
    if (!img) return;
    const step = (Math.PI * 2) / Math.max(1, shards.length);
    const ang = order * step + Math.random() * step * 0.72;
    const dist = radius * (0.72 + Math.random() * 0.52);
    const lift = radius * (0.12 + Math.random() * 0.13);
    const pieceScale = sc * (0.25 + ((index * 13) % 4) * 0.035);
    const spin = (Math.random() < 0.5 ? -1 : 1) * (190 + Math.random() * 330);
    const mx = x + Math.cos(ang) * dist * 0.78;
    const my = y + Math.sin(ang) * dist * 0.78 - lift;
    img.setScale(pieceScale).setRotation(Math.random() * Math.PI * 2);
    scene.tweens.chain({
      targets: img,
      tweens: [
        {
          x: mx,
          y: my,
          angle: img.angle + spin * 0.72,
          duration: 300 + Math.random() * 100,
          ease: "Cubic.easeOut",
        },
        {
          x: x + Math.cos(ang) * dist,
          y: y + Math.sin(ang) * dist + radius * 0.16, // gravity-lite sink after the outward lift
          angle: img.angle + spin,
          scale: pieceScale * 0.68,
          alpha: 0,
          duration: 180 + Math.random() * 90,
          ease: "Quad.easeIn",
        },
      ],
      onComplete: () => img.destroy(),
    });
  });

  plan.wisps?.indexes.forEach((index, order) => {
    const img = imageAt(scene, textures, index, x, y, 99470 + order, plan.wisps?.additive);
    if (!img) return;
    const wispScale = sc * (0.42 + ((index * 11) % 5) * 0.045);
    const dx = (Math.random() - 0.5) * radius * 0.44;
    const dy = radius * (0.22 + Math.random() * 0.2);
    const timing = wispTweenTiming(order);
    img.setScale(wispScale * 0.78).setAlpha(0.78).setRotation((Math.random() - 0.5) * 0.28);
    scene.tweens.chain({
      targets: img,
      tweens: [
        {
          delay: timing.delay,
          x: x + dx,
          y: y - dy,
          scale: wispScale,
          alpha: 0.68,
          duration: timing.riseDuration,
          ease: "Sine.easeOut",
        },
        {
          x: x + dx * 1.35,
          y: y - dy * 1.35,
          scale: wispScale * 1.12,
          alpha: 0,
          duration: timing.fadeDuration,
          ease: "Sine.easeInOut",
        },
      ],
      onComplete: () => img.destroy(),
    });
  });

  plan.ground?.forEach((index, order) => {
    const img = imageAt(scene, textures, index, x, y, 5 + order);
    if (!img) return;
    const groundScale = sc * (0.78 + order * 0.08);
    img.setScale(groundScale * 0.72).setAlpha(0.62).setRotation(Math.random() * Math.PI * 2);
    scene.tweens.add({
      targets: img,
      scale: groundScale,
      alpha: 0,
      delay: 180,
      duration: 1150,
      ease: "Cubic.easeOut",
      onComplete: () => img.destroy(),
    });
  });
  return true;
}
