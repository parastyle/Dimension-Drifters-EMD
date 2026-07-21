// §41 PAINTED PARTICLES runtime — flings individually-painted Codex particles (the element × shape packs
// from tools/artkit/gen-particle-packs.mjs) as one-shot bursts. Each pack is an equal-cell spritesheet;
// a burst picks random frames and scatters them with per-particle velocity/spin/fade. Fire-and-forget,
// tween-driven (same lifecycle as the procedural sparks it upgrades). Every call degrades gracefully to a
// no-op (returns false) if the pack/texture is missing, so procedural fallbacks stay in charge underneath.
import Phaser from "phaser";
import { PARTICLE_PACKS } from "./particle-manifest.js";
import {
  paintedParticlePixels,
  paintedParticleScale,
  type PaintedParticleScaleContract,
} from "./painted-particle-scale.js";

export {
  paintedParticleDisplaySize,
  paintedParticleDominance,
  paintedParticlePixels,
  paintedParticleScale,
} from "./painted-particle-scale.js";
export type { PaintedParticleScaleContract } from "./painted-particle-scale.js";

/** Queue every particle-pack spritesheet (call in scene.preload). ~48 small sheets, lazy-decoded by GL. */
export function preloadParticlePacks(scene: Phaser.Scene): void {
  for (const [id, p] of Object.entries(PARTICLE_PACKS)) {
    scene.load.spritesheet(`ptcl:${id}`, p.url, { frameWidth: p.frameWidth, frameHeight: p.frameWidth });
  }
}

export interface BurstOpts {
  /** Particles flung (default 6). */
  count?: number;
  /** Centre direction (radians). Omit for a full radial burst. */
  dirRad?: number;
  /** Cone half-spread around dirRad (radians; default full circle when dirRad omitted, else 0.9). */
  spread?: number;
  /** Fling speed px/s (default 130), each particle ±40%. */
  speed?: number;
  /** Display-size contract (default 48 px), each particle ±30%. */
  scaleContract?: PaintedParticleScaleContract;
  /** Life ms (default 380), each ±30%. */
  lifeMs?: number;
  /** Additive blend (energy/glow packs read best additive; solid shards/debris without). */
  additive?: boolean;
  /** Extra downward sink over the life, px (cheap gravity for shards/debris). */
  sink?: number;
  /** Render depth (default 99500 — the VFX band). */
  depth?: number;
}

/** Fling a one-shot burst of painted particles from pack `packId` at (x, y). Returns false if unavailable. */
export function particleBurst(
  scene: Phaser.Scene,
  packId: string,
  x: number,
  y: number,
  o: BurstOpts = {},
): boolean {
  const pack = PARTICLE_PACKS[packId];
  const key = `ptcl:${packId}`;
  if (!pack || !scene.textures.exists(key)) return false;
  const n = o.count ?? 6;
  const baseScale = paintedParticleScale(packId, o.scaleContract ?? paintedParticlePixels(48));
  const radial = o.dirRad === undefined;
  const spread = o.spread ?? (radial ? Math.PI : 0.9);
  for (let i = 0; i < n; i++) {
    const frame = (Math.random() * pack.count) | 0;
    const ang = (o.dirRad ?? Math.random() * Math.PI * 2) + (Math.random() - 0.5) * 2 * spread;
    const spd = (o.speed ?? 130) * (0.6 + Math.random() * 0.8);
    const life = (o.lifeMs ?? 380) * (0.7 + Math.random() * 0.6);
    const img = scene.add
      .image(x, y, key, frame)
      .setDepth(o.depth ?? 99500)
      .setScale(baseScale * (0.7 + Math.random() * 0.6))
      .setRotation(Math.random() * Math.PI * 2);
    if (o.additive) img.setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: img,
      x: x + Math.cos(ang) * spd * (life / 1000),
      y: y + Math.sin(ang) * spd * (life / 1000) + (o.sink ?? 0),
      alpha: 0,
      scale: img.scale * 0.55,
      angle: img.angle + (Math.random() - 0.5) * 200,
      duration: life,
      ease: "Quad.easeOut",
      onComplete: () => img.destroy(),
    });
  }
  return true;
}

/** Resolve "<element>-<shape>" with a STEEL fallback for unknown/physical elements, so every element name
 *  (including "physical"/undefined) maps to a real pack. */
export function elementPack(element: string | undefined, shape: string): string {
  const el = element && PARTICLE_PACKS[`${element}-${shape}`] ? element : "steel";
  return `${el}-${shape}`;
}
