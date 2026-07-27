import {
  type ArenaMap,
  LAVA_BACKGROUND_FILE,
  LAVA_DECORATIVE_PREFABS,
  LAVA_FLOW_FILE,
  LAVA_PLATFORM_PREFABS,
} from "@dd/shared";
import Phaser from "phaser";

export const LAVA_BACKGROUND_KEY = "lava-foundry:background";
export const LAVA_FLOW_KEY = "lava-foundry:flow";
const LAVA_SPAWN_RING_KEY = "lava-foundry:spawn-ring";

export type LavaParallax = Readonly<{
  background: Phaser.GameObjects.TileSprite;
  flow: Phaser.GameObjects.TileSprite;
}>;

export function lavaPlatformTextureKey(prefabId: string): string {
  return `lava-foundry:platform:${prefabId}`;
}

export function lavaDebrisTextureKey(prefabId: string): string {
  return `lava-foundry:debris:${prefabId}`;
}

export function lavaAssetFilesForMap(map: ArenaMap): Array<{ key: string; url: string }> {
  const layout = map.lavaLayout;
  if (!layout) return [];
  const files = [
    { key: LAVA_BACKGROUND_KEY, url: LAVA_BACKGROUND_FILE },
    { key: LAVA_FLOW_KEY, url: LAVA_FLOW_FILE },
  ];
  for (const prefabId of new Set(layout.rooms.map((room) => room.prefabId))) {
    const prefab = LAVA_PLATFORM_PREFABS[prefabId];
    if (prefab) files.push({ key: lavaPlatformTextureKey(prefabId), url: prefab.file });
  }
  for (const prefabId of new Set(layout.debris.map((debris) => debris.prefabId))) {
    const prefab = LAVA_DECORATIVE_PREFABS[prefabId];
    if (prefab) files.push({ key: lavaDebrisTextureKey(prefabId), url: prefab.file });
  }
  return files;
}

export function buildLavaDimensionFloor(
  scene: Phaser.Scene,
  map: ArenaMap,
): {
  objects: Phaser.GameObjects.GameObject[];
  parallax: LavaParallax;
} {
  const layout = map.lavaLayout;
  if (!layout) throw new Error("buildLavaDimensionFloor requires a Lava Foundry map");
  const width = scene.scale.width;
  const height = scene.scale.height;
  const background = scene.add
    .tileSprite(0, 0, width, height, LAVA_BACKGROUND_KEY)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(-200)
    .setAlpha(0.9);
  background.tileScaleX = 0.9;
  background.tileScaleY = 0.9;
  const flow = scene.add
    .tileSprite(0, 0, width, height, LAVA_FLOW_KEY)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(-190)
    .setAlpha(0.48)
    .setBlendMode(Phaser.BlendModes.ADD);
  flow.tileScaleX = 1.1;
  flow.tileScaleY = 1.1;
  const objects: Phaser.GameObjects.GameObject[] = [background, flow];

  for (const debris of layout.debris) {
    const key = lavaDebrisTextureKey(debris.prefabId);
    if (!scene.textures.exists(key)) continue;
    objects.push(
      scene.add
        .image(debris.x, debris.y, key)
        .setScale(debris.scale)
        .setFlipX(debris.flipX)
        .setAlpha(0.64)
        .setDepth(-17),
    );
  }

  for (const room of layout.rooms) {
    const key = lavaPlatformTextureKey(room.prefabId);
    if (!scene.textures.exists(key)) continue;
    // Owner invariant: source pixels map 1:1 into world pixels. Never call setDisplaySize here.
    objects.push(
      scene.add.image(room.x, room.y, key).setOrigin(0, 0).setScale(room.nativeScale).setDepth(-15),
    );
  }

  if (!scene.textures.exists(LAVA_SPAWN_RING_KEY)) {
    const textureSize = 248;
    const texture = scene.textures.createCanvas(LAVA_SPAWN_RING_KEY, textureSize, textureSize);
    if (texture) {
      const context = texture.getContext();
      context.clearRect(0, 0, textureSize, textureSize);
      context.strokeStyle = "#33e6ff";
      context.globalAlpha = 0.8;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(textureSize / 2, textureSize / 2, 118, 0, Math.PI * 2);
      context.stroke();
      texture.refresh();
    }
  }
  objects.push(scene.add.image(map.spawnX, map.spawnY, LAVA_SPAWN_RING_KEY).setDepth(-14.8));
  return { objects, parallax: { background, flow } };
}

export function updateLavaParallax(
  parallax: LavaParallax | undefined,
  camera: Phaser.Cameras.Scene2D.Camera,
  timeMs: number,
  viewportWidth: number,
  viewportHeight: number,
): void {
  if (!parallax) return;
  const cameraCoverage = 1 / Math.max(0.01, camera.zoom);
  parallax.background.setSize(viewportWidth * cameraCoverage, viewportHeight * cameraCoverage);
  parallax.flow.setSize(viewportWidth * cameraCoverage, viewportHeight * cameraCoverage);
  // Two independently tiled layers: slow camera parallax plus different endless time drift.
  parallax.background.tilePositionX = camera.scrollX * 0.065 - timeMs * 0.004;
  parallax.background.tilePositionY = camera.scrollY * 0.045 - timeMs * 0.003;
  parallax.flow.tilePositionX = camera.scrollX * 0.22 + timeMs * 0.024;
  parallax.flow.tilePositionY = camera.scrollY * 0.15 + timeMs * 0.014;
}
