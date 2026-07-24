import type Phaser from "phaser";

export interface PageProjectileArt {
  readonly textureKey: string;
  readonly url: string;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly scaleMultiplier: number;
}

export const PAGE_PROJECTILE_ART: Readonly<Partial<Record<string, PageProjectileArt>>> =
  Object.freeze({
    "x2-twin-whispervolumes": Object.freeze({
      textureKey: "page-projectile:twin-whispervolumes",
      url: "projectiles/twin-whisper-page.png",
      displayWidth: 45,
      displayHeight: 33,
      scaleMultiplier: 1.5,
    }),
    "x2-verdigris-grand-grimoire": Object.freeze({
      textureKey: "page-projectile:verdigris-grand-grimoire",
      url: "projectiles/verdigris-grand-page.png",
      // Earlier owner order: the melee-damage pages remain seven times ordinary page scale.
      displayWidth: 98,
      displayHeight: 70,
      scaleMultiplier: 7,
    }),
  });

export function pageProjectileArtFor(weaponId: string): PageProjectileArt | undefined {
  return PAGE_PROJECTILE_ART[weaponId];
}

export function preloadPageProjectileArt(scene: Phaser.Scene): void {
  for (const art of Object.values(PAGE_PROJECTILE_ART))
    if (art) scene.load.image(art.textureKey, art.url);
}
