import type Phaser from "phaser";
import type { BeamVfxStructureFamily } from "./caster-vfx-recipes.js";

export interface BeamStructureArt {
  readonly kind: BeamVfxStructureFamily;
  readonly textureKey: `beam-v7-structure:${BeamVfxStructureFamily}`;
  readonly url: string;
  readonly width: 256;
  readonly height: 96;
  readonly alphaBounds: Readonly<{ minX: number; minY: number; maxX: number; maxY: number }>;
  readonly energeticColumnOccupancy: number;
  readonly material: "energy" | "ice-particles";
  readonly provenance: "codex-generated";
}

export const BEAM_STRUCTURE_ART: Readonly<Record<BeamVfxStructureFamily, BeamStructureArt>> =
  Object.freeze({
    "segmented-arcs": Object.freeze({
      kind: "segmented-arcs",
      textureKey: "beam-v7-structure:segmented-arcs",
      url: "vfx/beams/v7-structure/segmented-arcs.png",
      width: 256,
      height: 96,
      alphaBounds: Object.freeze({ minX: 8, minY: 36, maxX: 247, maxY: 58 }),
      energeticColumnOccupancy: 0.70703125,
      material: "energy",
      provenance: "codex-generated",
    }),
    "converging-strands": Object.freeze({
      kind: "converging-strands",
      textureKey: "beam-v7-structure:converging-strands",
      url: "vfx/beams/v7-structure/converging-strands.png",
      width: 256,
      height: 96,
      alphaBounds: Object.freeze({ minX: 8, minY: 17, maxX: 247, maxY: 78 }),
      energeticColumnOccupancy: 0.91015625,
      material: "energy",
      provenance: "codex-generated",
    }),
    "pulse-train": Object.freeze({
      kind: "pulse-train",
      textureKey: "beam-v7-structure:pulse-train",
      url: "vfx/beams/v7-structure/pulse-train.png",
      width: 256,
      height: 96,
      alphaBounds: Object.freeze({ minX: 8, minY: 20, maxX: 247, maxY: 74 }),
      energeticColumnOccupancy: 0.6640625,
      material: "energy",
      provenance: "codex-generated",
    }),
    "flame-tongues": Object.freeze({
      kind: "flame-tongues",
      textureKey: "beam-v7-structure:flame-tongues",
      url: "vfx/beams/v7-structure/flame-tongues.png",
      width: 256,
      height: 96,
      alphaBounds: Object.freeze({ minX: 8, minY: 21, maxX: 247, maxY: 73 }),
      energeticColumnOccupancy: 0.921875,
      material: "energy",
      provenance: "codex-generated",
    }),
    "ice-particles": Object.freeze({
      kind: "ice-particles",
      textureKey: "beam-v7-structure:ice-particles",
      url: "vfx/beams/v7-structure/ice-particles.png",
      width: 256,
      height: 96,
      alphaBounds: Object.freeze({ minX: 8, minY: 27, maxX: 247, maxY: 68 }),
      energeticColumnOccupancy: 0.890625,
      material: "ice-particles",
      provenance: "codex-generated",
    }),
  });

const QUEUED = new WeakMap<Phaser.Scene, Set<string>>();

/** BeamRenderer is constructed during Scene.create(), so these public textures use the established lazy
 * expansion-art idiom. The renderer retains its inset fallback until Phaser reports the texture ready. */
export function preloadBeamStructureArt(scene: Phaser.Scene): void {
  let queued = QUEUED.get(scene);
  if (!queued) {
    queued = new Set<string>();
    QUEUED.set(scene, queued);
  }
  let added = false;
  for (const art of Object.values(BEAM_STRUCTURE_ART)) {
    if (scene.textures.exists(art.textureKey) || queued.has(art.textureKey)) continue;
    queued.add(art.textureKey);
    scene.load.image(art.textureKey, art.url);
    added = true;
  }
  if (added && !scene.load.isLoading()) scene.load.start();
}

export function beamStructureArtFor(kind: BeamVfxStructureFamily): BeamStructureArt {
  return BEAM_STRUCTURE_ART[kind];
}

export interface BeamStructureWorldBounds {
  readonly longitudinalStart: number;
  readonly longitudinalEnd: number;
  readonly transverseMin: number;
  readonly transverseMax: number;
}

/** Convert checked production alpha bounds to beam-local world bounds. Used by unit and live capsule laws. */
export function beamStructureWorldBounds(
  art: BeamStructureArt,
  length: number,
  renderedWidth: number,
): BeamStructureWorldBounds {
  const safeLength = Math.max(0, length);
  const safeWidth = Math.max(0, renderedWidth);
  const centerY = (art.height - 1) * 0.5;
  return {
    longitudinalStart: (art.alphaBounds.minX / art.width) * safeLength,
    longitudinalEnd: ((art.alphaBounds.maxX + 1) / art.width) * safeLength,
    transverseMin: ((art.alphaBounds.minY - centerY) / art.height) * safeWidth,
    transverseMax: ((art.alphaBounds.maxY - centerY) / art.height) * safeWidth,
  };
}
