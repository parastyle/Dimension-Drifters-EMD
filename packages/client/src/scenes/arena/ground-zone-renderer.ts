import { ZoneStyle } from "@dd/shared";
import Phaser from "phaser";
import { PARTICLE_PACKS } from "../../vfx/particle-manifest.js";

export const GROUND_ZONE_CHUNK_CAP = 24;

export interface GroundZoneChunk {
  frame: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  revealRadius: number;
}

export interface GroundZoneRenderRow {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  style: number;
  seed: number;
}

function randomStep(state: { value: number }): number {
  let x = state.value || 0x9e3779b9;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state.value = x >>> 0;
  return state.value / 0x100000000;
}

function packForStyle(style: number): "void-splat" | "toxic-splat" | "frost-splat" {
  if (style === ZoneStyle.Nether) return "void-splat";
  if (style === ZoneStyle.Ice) return "frost-splat";
  return "toxic-splat";
}

/** Stable accretion order: small authored splats appear from the core toward a jittered perimeter. */
export function groundZoneChunkPlan(
  seed: number,
  maxRadius: number,
  style: number,
): GroundZoneChunk[] {
  const rng = { value: ((seed & 0xffff) | ((style + 1) << 20)) >>> 0 };
  const radius = Math.max(12, maxRadius);
  const frameCount = PARTICLE_PACKS[packForStyle(style)]?.count ?? 12;
  const chunks: GroundZoneChunk[] = [];
  for (let i = 0; i < GROUND_ZONE_CHUNK_CAP; i++) {
    const radial = Math.sqrt((i + 0.35 + randomStep(rng) * 0.3) / GROUND_ZONE_CHUNK_CAP);
    const angle = i * 2.3999632297 + (randomStep(rng) - 0.5) * 0.9;
    const distance = radial * radius * 0.86;
    const scale = 0.24 + randomStep(rng) * 0.34;
    chunks.push({
      frame: Math.floor(randomStep(rng) * frameCount),
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance * 0.62,
      rotation: randomStep(rng) * Math.PI * 2,
      scale,
      revealRadius: Math.max(0, distance - 96 * scale * 0.42),
    });
  }
  return chunks.sort((a, b) => a.revealRadius - b.revealRadius);
}

export function makeGroundZonePatch(
  scene: Phaser.Scene,
  row: GroundZoneRenderRow,
): Phaser.GameObjects.Container {
  const packId = packForStyle(row.style);
  const key = `ptcl:${packId}`;
  const plan = groundZoneChunkPlan(row.seed, row.maxRadius || row.radius, row.style);
  const images = plan.map((chunk) =>
    scene.add
      .image(chunk.x, chunk.y, key, chunk.frame)
      .setRotation(chunk.rotation)
      .setScale(chunk.scale)
      .setAlpha(0.72),
  );
  const container = scene.add.container(row.x, row.y, images).setDepth(1);
  container.setData("groundZoneChunks", plan);
  container.setData("groundZoneImages", images);
  container.setData("weaponGroundZone", true);
  scene.tweens.add({
    targets: container,
    angle: 0.45,
    scaleX: 1.012,
    scaleY: 0.994,
    duration: 1250 + (row.seed % 350),
    yoyo: true,
    repeat: -1,
    ease: "Sine.inOut",
  });
  syncGroundZonePatch(container, row);
  return container;
}

export function syncGroundZonePatch(
  container: Phaser.GameObjects.Container,
  row: GroundZoneRenderRow,
): void {
  container.setPosition(row.x, row.y);
  const chunks = container.getData("groundZoneChunks") as GroundZoneChunk[] | undefined;
  const images = container.getData("groundZoneImages") as Phaser.GameObjects.Image[] | undefined;
  if (!chunks || !images) return;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const image = images[i]!;
    const edge = row.radius - chunk.revealRadius;
    image.setVisible(edge >= 0);
    if (edge >= 0) image.setAlpha(0.54 + Math.min(0.24, edge / 64));
  }
}
