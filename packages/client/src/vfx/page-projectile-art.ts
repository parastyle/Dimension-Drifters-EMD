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

export const VERDIGRIS_PAGE_CONE_COUNT = 9;
export const VERDIGRIS_PAGE_CONE_HALF_ANGLE_RAD = 0.42;

export interface VerdigrisPageConeLane {
  readonly angleOffsetRad: number;
  readonly startForward: number;
  readonly startLateral: number;
  readonly distanceScale: number;
  readonly delayMs: number;
  readonly durationMs: number;
  readonly spinRad: number;
}

/** Deterministic book-origin lanes keep all nine painted pages inside one forward damage-readable cone. */
export function verdigrisPageConeLane(index: number): VerdigrisPageConeLane {
  const bounded = Math.max(0, Math.min(VERDIGRIS_PAGE_CONE_COUNT - 1, Math.floor(index)));
  const signedLane = (bounded / (VERDIGRIS_PAGE_CONE_COUNT - 1)) * 2 - 1;
  const centerWeight = 1 - Math.abs(signedLane);
  return Object.freeze({
    angleOffsetRad: signedLane * VERDIGRIS_PAGE_CONE_HALF_ANGLE_RAD,
    startForward: 8 + centerWeight * 5,
    startLateral: signedLane * 7,
    distanceScale: 0.56 + centerWeight * 0.18,
    delayMs: Math.abs(bounded - Math.floor(VERDIGRIS_PAGE_CONE_COUNT / 2)) * 10,
    durationMs: 300 + Math.round(Math.abs(signedLane) * 50),
    spinRad: (bounded & 1) === 0 ? 1.2 : -1.05,
  });
}

export function preloadPageProjectileArt(scene: Phaser.Scene): void {
  for (const art of Object.values(PAGE_PROJECTILE_ART))
    if (art) scene.load.image(art.textureKey, art.url);
}
