import type { WeaponDef } from "@dd/shared";
import { generatedImageVfxReplacesProceduralRecipe } from "./generated-image-weapon-vfx-recipes.js";

export const CASTER_VFX_ELEMENTS = [
  "arcane",
  "fire",
  "frost",
  "holy",
  "shock",
  "toxic",
  "void",
] as const;

export type CasterVfxElement = (typeof CASTER_VFX_ELEMENTS)[number];
export type CasterVfxForm =
  | "staff"
  | "tome"
  | "codex"
  | "lance"
  | "orb"
  | "focus"
  | "relic"
  | "gauntlet";
export type CasterVfxGrade = "adept" | "master" | "pinnacle";
export type CasterVfxDamageTier = "spark" | "burst" | "nova";
export type CasterVfxSignature =
  | "arcane-lance-line"
  | "forked-page-flutter"
  | "hollow-page-aperture"
  | "sunmote-corona"
  | "mesa-lightning-crown"
  | "obsidian-maw";
export type CasterParticleShape =
  | "bolt"
  | "mote"
  | "orb"
  | "ring"
  | "shard"
  | "spark"
  | "splat"
  | "wisp";
export type BeamVfxWidthProfile =
  | "needle"
  | "tapered"
  | "ribbon"
  | "braided"
  | "segmented"
  | "hourglass";
export type BeamVfxRippleSignature =
  | "steady"
  | "sine"
  | "cosine"
  | "double-helix"
  | "sawtooth"
  | "pulse-train"
  | "stutter";
export type BeamVfxStructureFamily =
  | "segmented-arcs"
  | "converging-strands"
  | "pulse-train"
  | "flame-tongues"
  | "ice-particles";

export interface BeamVfxStructureRecipe {
  readonly family: BeamVfxStructureFamily;
  /** Generated sheet width as an inset fraction of the authoritative damage diameter. */
  readonly artWidth: number;
  /** Thin continuous readability core; Frostquill's ice-particle family deliberately uses zero. */
  readonly readableCoreWidth: number;
  readonly phaseRate: number;
  readonly iceOnly?: true;
}

/** Presentation-only beam dialect. All widths are inset fractions of the authoritative damage band. */
export interface BeamVfxRecipe {
  readonly signature: string;
  readonly widthProfile: BeamVfxWidthProfile;
  readonly edgeColor: number;
  readonly accentColor: number;
  readonly coreColor: number;
  /** Optional per-authoritative-row palette for prismatic multi-beam weapons. */
  readonly rainbowPalette?: readonly number[];
  /** Parallel inset ribbon colors rendered together inside one authoritative beam row. */
  readonly strandPalette?: readonly number[];
  readonly edgeWidth: number;
  readonly chromaWidth: number;
  readonly coreWidth: number;
  readonly ripple: BeamVfxRippleSignature;
  readonly rippleAmplitude: number;
  /** Complete lateral cycles from source to terminus. */
  readonly rippleFrequency: number;
  /** Static waveform phase; cosine is also available as an identity-level shorthand. */
  readonly ripplePhaseRad?: number;
  readonly flickerHz: number;
  readonly conePolish?: {
    readonly sheets: number;
    readonly ribs: number;
    readonly meltParticles: number;
    readonly residuePatches: number;
  };
  readonly particleElement: CasterVfxElement;
  readonly bodyParticle: CasterParticleShape;
  readonly coreParticle: CasterParticleShape;
  readonly bodyFrame: number;
  readonly coreFrame: number;
  readonly structure: BeamVfxStructureRecipe;
  readonly impact: {
    readonly points: number;
    readonly rings: number;
    readonly radiusScale: number;
    readonly spin: number;
  };
}

export interface CasterVfxPalette {
  readonly core: number;
  readonly mid: number;
  readonly shadow: number;
}

export interface CasterVfxSourceRecipe {
  readonly glyph: "circle" | "pages" | "diamond" | "line" | "orbit" | "star" | "ward" | "palm";
  readonly radius: number;
  readonly lineWidth: number;
  readonly particles: number;
  readonly particleShape: CasterParticleShape;
}

export interface CasterVfxProjectileRecipe {
  readonly silhouette: "bolt" | "leaf" | "diamond" | "lance" | "sphere" | "prism" | "seal" | "fist";
  readonly coreRadius: number;
  readonly trailLength: number;
  readonly trailWidth: number;
  readonly bodySizePx: number;
  readonly particleShape: CasterParticleShape;
  /** Particle-pack-only in-flight identity; no procedural shell or character-centered aura. */
  readonly particleTreatment?: "stream";
  readonly particlePack?: string;
  readonly particleCount?: number;
}

/** A bounded crop from the weapon's own installed part texture, used as its projectile identity. */
export interface CasterSpriteProjectileRecipe {
  readonly spriteId: string;
  readonly partRole: string;
  readonly crop: Readonly<{ x: number; y: number; width: number; height: number }>;
  readonly displayLength: number;
  readonly flutterRadians?: number;
  readonly flutterMs?: number;
}

/** Standalone W4M projectile art. Generated sheets use fixed cells; derived cutouts use a single image. */
export interface CasterTextureProjectileRecipe {
  readonly textureKey: string;
  readonly url: string;
  readonly displayLength: number;
  readonly frame?: number;
  readonly frameWidth?: number;
  readonly frameHeight?: number;
  readonly flutterRadians?: number;
  readonly flutterMs?: number;
  /** Right-facing source art mirrors horizontally on leftward shots instead of rotating upside down. */
  readonly mirrorLeft?: boolean;
}

export interface CasterPaintedImpactRecipe {
  readonly textureKey: string;
  readonly url: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frames: readonly number[];
  readonly displayLength: number;
  readonly durationMs: number;
}

export interface CasterVfxImpactRecipe {
  readonly blossom: "radial" | "pages" | "square" | "axis" | "rings" | "star" | "ward" | "burst";
  readonly radius: number;
  readonly particles: number;
  readonly particleShape: CasterParticleShape;
}

export interface CasterVfxRecipe {
  readonly kind: "caster-vfx";
  readonly isDefault: false;
  readonly key: string;
  readonly weaponId: string;
  readonly element: CasterVfxElement;
  readonly form: CasterVfxForm;
  readonly grade: CasterVfxGrade;
  readonly damageTier: CasterVfxDamageTier;
  readonly palette: CasterVfxPalette;
  readonly source: CasterVfxSourceRecipe;
  readonly projectile: CasterVfxProjectileRecipe;
  readonly spriteProjectile?: CasterSpriteProjectileRecipe;
  readonly textureProjectile?: CasterTextureProjectileRecipe;
  readonly paintedImpact?: CasterPaintedImpactRecipe;
  readonly impact: CasterVfxImpactRecipe;
  readonly signature?: CasterVfxSignature;
  readonly beam?: BeamVfxRecipe;
}

const ELEMENT_PALETTES: Readonly<Record<CasterVfxElement, CasterVfxPalette>> = Object.freeze({
  arcane: Object.freeze({ core: 0xffffff, mid: 0x9d7cff, shadow: 0x4a247f }),
  fire: Object.freeze({ core: 0xfff1bd, mid: 0xff6a2a, shadow: 0x791d12 }),
  frost: Object.freeze({ core: 0xffffff, mid: 0x6fd6ff, shadow: 0x245b91 }),
  holy: Object.freeze({ core: 0xffffff, mid: 0xffe6a0, shadow: 0x9e6f22 }),
  shock: Object.freeze({ core: 0xffffff, mid: 0xffe24a, shadow: 0x6652c7 }),
  toxic: Object.freeze({ core: 0xedffb0, mid: 0x9cff3b, shadow: 0x285f2a }),
  void: Object.freeze({ core: 0xf1dcff, mid: 0xb14bff, shadow: 0x32104f }),
});

/** Exact owner-note palette exceptions; mechanics keep their normal element typing. */
export const CASTER_VFX_PALETTE_OVERRIDES: Readonly<Partial<Record<string, CasterVfxPalette>>> =
  Object.freeze({
    "x-staff-storm-rod": Object.freeze({
      core: 0xe8fbff,
      mid: 0x4aa8ff,
      shadow: 0x173f91,
    }),
    "x2-thunderhead-stormfists": Object.freeze({
      core: 0xffffff,
      mid: 0x33e6ff,
      shadow: 0x245b91,
    }),
    "x2-fulgurite-storm-sphere": Object.freeze({
      core: 0xe8fbff,
      mid: 0x3f9dff,
      shadow: 0x173f91,
    }),
  });

/** Legacy caster crop retained only where no projectile-identity regeneration was ordered. */
export const CASTER_SPRITE_PROJECTILES: Readonly<
  Partial<Record<string, CasterSpriteProjectileRecipe>>
> = Object.freeze({
  "x2-permafrost-cryo-bracer": Object.freeze({
    spriteId: "x2-permafrost-cryo-bracer",
    partRole: "part-1",
    crop: Object.freeze({ x: 121, y: 0, width: 135, height: 84 }),
    displayLength: 58,
  }),
});

/** Plague's bug is re-derived without the amber shell; Gravesinger uses its generated 2×2 painted sheet. */
export const CASTER_TEXTURE_PROJECTILES: Readonly<
  Partial<Record<string, CasterTextureProjectileRecipe>>
> = Object.freeze({
  "x2-locust-glass-plague-orb": Object.freeze({
    textureKey: "caster:plague-locust",
    url: "vfx/caster/plague-locust.png",
    displayLength: 48,
    flutterRadians: 0.18,
    flutterMs: 230,
    mirrorLeft: true,
  }),
  "x2-gravesinger-s-hex-wand": Object.freeze({
    textureKey: "caster:gravesinger-hex",
    url: "vfx/caster/gravesinger-hex-sheet.png",
    frame: 0,
    frameWidth: 627,
    frameHeight: 627,
    displayLength: 72,
  }),
  "x2-glyphward-manuscript": Object.freeze({
    textureKey: "caster:glyphward-holy-feather",
    url: "vfx/packs/holy-smite/fx-holy-smite-07.png",
    displayLength: 64,
    flutterRadians: 0.12,
    flutterMs: 120,
    mirrorLeft: true,
  }),
});

export const CASTER_PAINTED_IMPACTS: Readonly<
  Partial<Record<string, CasterPaintedImpactRecipe>>
> = Object.freeze({
  "x2-gravesinger-s-hex-wand": Object.freeze({
    textureKey: "caster:gravesinger-hex",
    url: "vfx/caster/gravesinger-hex-sheet.png",
    frameWidth: 627,
    frameHeight: 627,
    frames: Object.freeze([1, 2, 3]),
    displayLength: 180,
    durationMs: 360,
  }),
});

export const CASTER_PARTICLE_PROJECTILES: Readonly<
  Partial<
    Record<
      string,
      Readonly<{ treatment: "stream"; pack: string; count: number }>
    >
  >
> = Object.freeze({
  "x2-reliquary-lantern-wand": Object.freeze({
    treatment: "stream",
    pack: "holy-spark",
    count: 4,
  }),
  "x2-rimebound-folio": Object.freeze({
    treatment: "stream",
    pack: "frost-shard",
    count: 5,
  }),
});

const FORM_SOURCE: Readonly<
  Record<CasterVfxForm, Pick<CasterVfxSourceRecipe, "glyph" | "particleShape">>
> = Object.freeze({
  staff: Object.freeze({ glyph: "circle", particleShape: "mote" }),
  tome: Object.freeze({ glyph: "pages", particleShape: "wisp" }),
  codex: Object.freeze({ glyph: "diamond", particleShape: "shard" }),
  lance: Object.freeze({ glyph: "line", particleShape: "bolt" }),
  orb: Object.freeze({ glyph: "orbit", particleShape: "orb" }),
  focus: Object.freeze({ glyph: "star", particleShape: "spark" }),
  relic: Object.freeze({ glyph: "ward", particleShape: "ring" }),
  gauntlet: Object.freeze({ glyph: "palm", particleShape: "spark" }),
});

const FORM_PROJECTILE: Readonly<
  Record<
    CasterVfxForm,
    Pick<CasterVfxProjectileRecipe, "silhouette" | "trailLength" | "trailWidth" | "particleShape">
  >
> = Object.freeze({
  staff: Object.freeze({
    silhouette: "bolt",
    trailLength: 42,
    trailWidth: 10,
    particleShape: "bolt",
  }),
  tome: Object.freeze({
    silhouette: "leaf",
    trailLength: 34,
    trailWidth: 14,
    particleShape: "wisp",
  }),
  codex: Object.freeze({
    silhouette: "diamond",
    trailLength: 38,
    trailWidth: 12,
    particleShape: "shard",
  }),
  lance: Object.freeze({
    silhouette: "lance",
    trailLength: 66,
    trailWidth: 7,
    particleShape: "bolt",
  }),
  orb: Object.freeze({
    silhouette: "sphere",
    trailLength: 30,
    trailWidth: 16,
    particleShape: "orb",
  }),
  focus: Object.freeze({
    silhouette: "prism",
    trailLength: 40,
    trailWidth: 9,
    particleShape: "spark",
  }),
  relic: Object.freeze({
    silhouette: "seal",
    trailLength: 32,
    trailWidth: 15,
    particleShape: "ring",
  }),
  gauntlet: Object.freeze({
    silhouette: "fist",
    trailLength: 29,
    trailWidth: 13,
    particleShape: "bolt",
  }),
});

const FORM_IMPACT: Readonly<
  Record<CasterVfxForm, Pick<CasterVfxImpactRecipe, "blossom" | "particleShape">>
> = Object.freeze({
  staff: Object.freeze({ blossom: "radial", particleShape: "spark" }),
  tome: Object.freeze({ blossom: "pages", particleShape: "wisp" }),
  codex: Object.freeze({ blossom: "square", particleShape: "shard" }),
  lance: Object.freeze({ blossom: "axis", particleShape: "bolt" }),
  orb: Object.freeze({ blossom: "rings", particleShape: "orb" }),
  focus: Object.freeze({ blossom: "star", particleShape: "spark" }),
  relic: Object.freeze({ blossom: "ward", particleShape: "ring" }),
  gauntlet: Object.freeze({ blossom: "burst", particleShape: "splat" }),
});

export const CASTER_VFX_SIGNATURES: Readonly<Partial<Record<string, CasterVfxSignature>>> =
  Object.freeze({
    "x2-codex-of-forked-tongues": "forked-page-flutter",
    "x2-null-grimoire-of-the-hollow-page": "hollow-page-aperture",
    "x2-sunmote-reliquary-staff": "sunmote-corona",
    "x2-mesa-spine-thunder-stave": "mesa-lightning-crown",
    "x2-obsidian-maw-void-staff": "obsidian-maw",
  });

/**
 * The complete beam catalog gets authored identities rather than element-only recolours. The renderer uses
 * these recipes for its inset width stack, motion trace, painted 96-pack ropes, and endpoint punctuation.
 */
const BEAM_VFX_BASE_RECIPES: Readonly<Record<string, Omit<BeamVfxRecipe, "structure">>> =
  Object.freeze({
  "x2-voltcaster-machine-pistol": Object.freeze({
    signature: "voltcaster-needle-burst",
    widthProfile: "needle",
    edgeColor: 0x5c0505,
    accentColor: 0xff2a1f,
    coreColor: 0xffe0d4,
    edgeWidth: 0.92,
    chromaWidth: 0.42,
    coreWidth: 0.1,
    ripple: "stutter",
    rippleAmplitude: 0.1,
    rippleFrequency: 8,
    flickerHz: 19,
    particleElement: "shock",
    bodyParticle: "bolt",
    coreParticle: "spark",
    bodyFrame: 0,
    coreFrame: 3,
    impact: Object.freeze({ points: 3, rings: 0, radiusScale: 0.7, spin: 2.8 }),
  }),
  "x2-stormcaller-tesla-gatling": Object.freeze({
    signature: "stormcaller-six-needle-barrage",
    widthProfile: "needle",
    edgeColor: 0x4348b8,
    accentColor: 0x68d8ff,
    coreColor: 0xfff6a8,
    edgeWidth: 0.82,
    chromaWidth: 0.38,
    coreWidth: 0.08,
    ripple: "stutter",
    rippleAmplitude: 0.08,
    rippleFrequency: 7,
    flickerHz: 17,
    particleElement: "shock",
    bodyParticle: "bolt",
    coreParticle: "bolt",
    bodyFrame: 1,
    coreFrame: 6,
    impact: Object.freeze({ points: 3, rings: 0, radiusScale: 0.62, spin: -1.5 }),
  }),
  "x2-mirage-coilrifle": Object.freeze({
    signature: "mirage-purple-double-helix",
    widthProfile: "braided",
    edgeColor: 0x32105f,
    accentColor: 0xb14bff,
    coreColor: 0xf1d7ff,
    edgeWidth: 0.94,
    chromaWidth: 0.58,
    coreWidth: 0.12,
    ripple: "double-helix",
    rippleAmplitude: 0.42,
    rippleFrequency: 4,
    ripplePhaseRad: Math.PI / 2,
    flickerHz: 5.5,
    particleElement: "arcane",
    bodyParticle: "wisp",
    coreParticle: "spark",
    bodyFrame: 7,
    coreFrame: 5,
    impact: Object.freeze({ points: 6, rings: 2, radiusScale: 0.92, spin: 1.4 }),
  }),
  "x2-permafrost-siege-lobber": Object.freeze({
    signature: "permafrost-ice-cone-stream",
    widthProfile: "tapered",
    edgeColor: 0x173f58,
    accentColor: 0x6fd6ff,
    coreColor: 0xe8fbff,
    edgeWidth: 1,
    chromaWidth: 0.82,
    coreWidth: 0.36,
    ripple: "sine",
    rippleAmplitude: 0.14,
    rippleFrequency: 5,
    flickerHz: 7,
    conePolish: Object.freeze({ sheets: 5, ribs: 11, meltParticles: 7, residuePatches: 5 }),
    particleElement: "frost",
    bodyParticle: "wisp",
    coreParticle: "shard",
    bodyFrame: 6,
    coreFrame: 4,
    impact: Object.freeze({ points: 7, rings: 1, radiusScale: 0.78, spin: -1.6 }),
  }),
  "x2-doomsday-drum-cannon": Object.freeze({
    signature: "doomsday-magma-cone-wave",
    widthProfile: "tapered",
    edgeColor: 0x3b0b08,
    accentColor: 0xff5a24,
    coreColor: 0xffd06a,
    edgeWidth: 1,
    chromaWidth: 0.84,
    coreWidth: 0.4,
    ripple: "pulse-train",
    rippleAmplitude: 0.18,
    rippleFrequency: 6,
    flickerHz: 9,
    particleElement: "fire",
    bodyParticle: "wisp",
    coreParticle: "orb",
    bodyFrame: 4,
    coreFrame: 2,
    impact: Object.freeze({ points: 8, rings: 2, radiusScale: 0.9, spin: 1.8 }),
  }),
  "x2-null-grimoire-of-the-hollow-page": Object.freeze({
    signature: "hollow-page-aperture-ray",
    widthProfile: "ribbon",
    edgeColor: 0xb14bff,
    accentColor: 0x6d1fd1,
    coreColor: 0x030106,
    edgeWidth: 1,
    chromaWidth: 0.68,
    coreWidth: 0.48,
    ripple: "sine",
    rippleAmplitude: 0.18,
    rippleFrequency: 3.5,
    flickerHz: 4,
    particleElement: "void",
    bodyParticle: "wisp",
    coreParticle: "ring",
    bodyFrame: 1,
    coreFrame: 6,
    impact: Object.freeze({ points: 4, rings: 2, radiusScale: 0.94, spin: 0.7 }),
  }),
  "x2-psalter-of-the-burning-halo": Object.freeze({
    signature: "burning-halo-pulse-train",
    widthProfile: "segmented",
    edgeColor: 0xb56a16,
    accentColor: 0xffd45f,
    coreColor: 0xffffed,
    edgeWidth: 0.94,
    chromaWidth: 0.6,
    coreWidth: 0.23,
    ripple: "pulse-train",
    rippleAmplitude: 0.2,
    rippleFrequency: 6,
    flickerHz: 7,
    particleElement: "holy",
    bodyParticle: "ring",
    coreParticle: "mote",
    bodyFrame: 2,
    coreFrame: 7,
    impact: Object.freeze({ points: 6, rings: 3, radiusScale: 1.2, spin: 0.9 }),
  }),
  "x2-frostquill-compendium": Object.freeze({
    signature: "frostquill-feather-ribbon",
    widthProfile: "tapered",
    edgeColor: 0x276ca8,
    accentColor: 0x91e8ff,
    coreColor: 0xffffff,
    edgeWidth: 0.9,
    chromaWidth: 0.58,
    coreWidth: 0.16,
    ripple: "sine",
    rippleAmplitude: 0.12,
    rippleFrequency: 2.5,
    flickerHz: 3,
    particleElement: "frost",
    bodyParticle: "wisp",
    coreParticle: "shard",
    bodyFrame: 6,
    coreFrame: 4,
    impact: Object.freeze({ points: 7, rings: 1, radiusScale: 1.05, spin: -0.45 }),
  }),
  "x2-brinequill-tidescepter": Object.freeze({
    signature: "brinequill-tidal-hourglass",
    widthProfile: "hourglass",
    edgeColor: 0x176982,
    accentColor: 0x4fd8ce,
    coreColor: 0xdffcff,
    edgeWidth: 0.93,
    chromaWidth: 0.66,
    coreWidth: 0.14,
    ripple: "double-helix",
    rippleAmplitude: 0.14,
    rippleFrequency: 3,
    flickerHz: 2,
    particleElement: "frost",
    bodyParticle: "orb",
    coreParticle: "wisp",
    bodyFrame: 3,
    coreFrame: 8,
    impact: Object.freeze({ points: 5, rings: 2, radiusScale: 0.88, spin: 0.38 }),
  }),
  "x2-sunmote-reliquary-staff": Object.freeze({
    signature: "sunmote-corona-column",
    widthProfile: "tapered",
    edgeColor: 0xe84b16,
    accentColor: 0xffa82e,
    coreColor: 0xfff4b0,
    edgeWidth: 0.97,
    chromaWidth: 0.7,
    coreWidth: 0.3,
    ripple: "steady",
    rippleAmplitude: 0.06,
    rippleFrequency: 1.5,
    flickerHz: 6,
    particleElement: "fire",
    bodyParticle: "mote",
    coreParticle: "ring",
    bodyFrame: 4,
    coreFrame: 0,
    impact: Object.freeze({ points: 12, rings: 2, radiusScale: 1.28, spin: 0.62 }),
  }),
  "x2-carrion-roost-necro-scepter": Object.freeze({
    signature: "carrion-roost-witchwake",
    widthProfile: "segmented",
    edgeColor: 0x29123f,
    accentColor: 0x8ecb44,
    coreColor: 0xd8ff9b,
    edgeWidth: 0.91,
    chromaWidth: 0.48,
    coreWidth: 0.12,
    ripple: "stutter",
    rippleAmplitude: 0.24,
    rippleFrequency: 5.5,
    flickerHz: 13,
    particleElement: "toxic",
    bodyParticle: "splat",
    coreParticle: "wisp",
    bodyFrame: 5,
    coreFrame: 2,
    impact: Object.freeze({ points: 5, rings: 0, radiusScale: 1.12, spin: -2.1 }),
  }),
  "x2-auroral-filament-wand": Object.freeze({
    signature: "auroral-filament-thread",
    widthProfile: "needle",
    edgeColor: 0x6b65ff,
    accentColor: 0x8df6ff,
    coreColor: 0xffffff,
    edgeWidth: 0.76,
    chromaWidth: 0.28,
    coreWidth: 0.055,
    ripple: "cosine",
    rippleAmplitude: 0.08,
    rippleFrequency: 4,
    flickerHz: 8,
    particleElement: "shock",
    bodyParticle: "wisp",
    coreParticle: "spark",
    bodyFrame: 8,
    coreFrame: 1,
    impact: Object.freeze({ points: 2, rings: 1, radiusScale: 0.5, spin: 1.8 }),
  }),
  "x2-mesa-spine-thunder-stave": Object.freeze({
    signature: "mesa-spine-forked-crown",
    widthProfile: "braided",
    edgeColor: 0x5535ad,
    accentColor: 0xffdc38,
    coreColor: 0xffffd9,
    edgeWidth: 0.98,
    chromaWidth: 0.62,
    coreWidth: 0.19,
    ripple: "sawtooth",
    rippleAmplitude: 0.3,
    rippleFrequency: 5,
    flickerHz: 17,
    particleElement: "shock",
    bodyParticle: "bolt",
    coreParticle: "shard",
    bodyFrame: 5,
    coreFrame: 7,
    impact: Object.freeze({ points: 9, rings: 0, radiusScale: 1.22, spin: -2.6 }),
  }),
  "x2-riftglass-prism-lantern": Object.freeze({
    signature: "riftglass-prismatic-saw",
    widthProfile: "ribbon",
    edgeColor: 0x3b1c91,
    accentColor: 0xff55c8,
    coreColor: 0x75fff2,
    rainbowPalette: Object.freeze([
      0xff4f73, 0xff9f32, 0xffe55c, 0x55e87a, 0x42cfff, 0x7187ff, 0xd96cff,
    ]),
    edgeWidth: 0.94,
    chromaWidth: 0.54,
    coreWidth: 0.11,
    ripple: "sawtooth",
    rippleAmplitude: 0.22,
    rippleFrequency: 6.5,
    flickerHz: 9,
    particleElement: "arcane",
    bodyParticle: "shard",
    coreParticle: "spark",
    bodyFrame: 7,
    coreFrame: 5,
    impact: Object.freeze({ points: 10, rings: 1, radiusScale: 1.1, spin: 2.2 }),
  }),
  "x2-quartzlight-wayfinder": Object.freeze({
    signature: "quartzlight-compass-dashes",
    widthProfile: "segmented",
    edgeColor: 0x8c7433,
    accentColor: 0xfff0a0,
    coreColor: 0xffffff,
    edgeWidth: 0.88,
    chromaWidth: 0.44,
    coreWidth: 0.09,
    ripple: "pulse-train",
    rippleAmplitude: 0.1,
    rippleFrequency: 5,
    flickerHz: 4.5,
    particleElement: "holy",
    bodyParticle: "shard",
    coreParticle: "bolt",
    bodyFrame: 0,
    coreFrame: 8,
    impact: Object.freeze({ points: 4, rings: 1, radiusScale: 0.72, spin: 1.1 }),
  }),
  "x2-pearl-of-penance-censer": Object.freeze({
    signature: "penance-pearl-rosary",
    widthProfile: "segmented",
    edgeColor: 0x9a815d,
    accentColor: 0xffe5b0,
    coreColor: 0xffffff,
    edgeWidth: 0.96,
    chromaWidth: 0.74,
    coreWidth: 0.25,
    ripple: "steady",
    rippleAmplitude: 0.03,
    rippleFrequency: 1,
    flickerHz: 2.5,
    particleElement: "holy",
    bodyParticle: "orb",
    coreParticle: "mote",
    bodyFrame: 6,
    coreFrame: 3,
    impact: Object.freeze({ points: 5, rings: 3, radiusScale: 1.18, spin: -0.18 }),
  }),
  "x2-smoldering-eye-of-perdition": Object.freeze({
    signature: "perdition-ocular-pulse",
    widthProfile: "hourglass",
    edgeColor: 0x16070d,
    accentColor: 0xe13c24,
    coreColor: 0xffb14f,
    edgeWidth: 0.99,
    chromaWidth: 0.58,
    coreWidth: 0.16,
    ripple: "pulse-train",
    rippleAmplitude: 0.26,
    rippleFrequency: 3,
    flickerHz: 6.5,
    particleElement: "void",
    bodyParticle: "orb",
    coreParticle: "ring",
    bodyFrame: 7,
    coreFrame: 3,
    impact: Object.freeze({ points: 1, rings: 2, radiusScale: 1.34, spin: 0 }),
  }),
  "x2-nullsaint-reliquary": Object.freeze({
    signature: "nullsaint-razor-null",
    widthProfile: "needle",
    edgeColor: 0x12051e,
    accentColor: 0x7d2dce,
    coreColor: 0xf1dcff,
    edgeWidth: 0.82,
    chromaWidth: 0.3,
    coreWidth: 0.07,
    ripple: "steady",
    rippleAmplitude: 0.02,
    rippleFrequency: 2,
    flickerHz: 10,
    particleElement: "void",
    bodyParticle: "bolt",
    coreParticle: "shard",
    bodyFrame: 8,
    coreFrame: 0,
    impact: Object.freeze({ points: 4, rings: 0, radiusScale: 0.62, spin: 3.4 }),
  }),
  "x2-sanctum-brazier-staff": Object.freeze({
    signature: "sanctum-brazier-blueflame",
    widthProfile: "braided",
    edgeColor: 0x1c318d,
    accentColor: 0x46bbff,
    coreColor: 0xffec83,
    edgeWidth: 0.98,
    chromaWidth: 0.69,
    coreWidth: 0.2,
    ripple: "sine",
    rippleAmplitude: 0.25,
    rippleFrequency: 3.5,
    flickerHz: 12,
    particleElement: "shock",
    bodyParticle: "wisp",
    coreParticle: "mote",
    bodyFrame: 2,
    coreFrame: 4,
    impact: Object.freeze({ points: 7, rings: 2, radiusScale: 1.26, spin: 1.7 }),
  }),
  "x2-seraph-s-knuckle-reliquary": Object.freeze({
    signature: "seraph-knuckle-piston",
    widthProfile: "segmented",
    edgeColor: 0xa85e18,
    accentColor: 0xffca4d,
    coreColor: 0xffffff,
    edgeWidth: 0.9,
    chromaWidth: 0.5,
    coreWidth: 0.15,
    ripple: "stutter",
    rippleAmplitude: 0.18,
    rippleFrequency: 7.5,
    flickerHz: 15,
    particleElement: "holy",
    bodyParticle: "splat",
    coreParticle: "bolt",
    bodyFrame: 3,
    coreFrame: 6,
    impact: Object.freeze({ points: 6, rings: 0, radiusScale: 0.96, spin: 2.4 }),
  }),
  "x2-voidgrasp-null-gauntlet": Object.freeze({
    signature: "voidgrasp-claw-braid",
    widthProfile: "braided",
    edgeColor: 0x180522,
    accentColor: 0xa73ce6,
    coreColor: 0xf1bcff,
    edgeWidth: 0.93,
    chromaWidth: 0.57,
    coreWidth: 0.13,
    ripple: "double-helix",
    rippleAmplitude: 0.34,
    rippleFrequency: 4.5,
    flickerHz: 8.5,
    particleElement: "void",
    bodyParticle: "bolt",
    coreParticle: "splat",
    bodyFrame: 6,
    coreFrame: 5,
    impact: Object.freeze({ points: 5, rings: 1, radiusScale: 1.08, spin: -2.9 }),
  }),
  "x2-glasswidow-hexweave": Object.freeze({
    signature: "glasswidow-web-stitch",
    widthProfile: "hourglass",
    edgeColor: 0x21072b,
    accentColor: 0xe057ff,
    coreColor: 0xf7e6ff,
    edgeWidth: 0.86,
    chromaWidth: 0.39,
    coreWidth: 0.06,
    ripple: "stutter",
    rippleAmplitude: 0.31,
    rippleFrequency: 8.5,
    flickerHz: 14,
    particleElement: "void",
    bodyParticle: "ring",
    coreParticle: "shard",
    bodyFrame: 0,
    coreFrame: 8,
    impact: Object.freeze({ points: 8, rings: 2, radiusScale: 0.78, spin: 3.1 }),
  }),
  "x2-unicorn-rainbow-beam": Object.freeze({
    signature: "unicorn-five-strand-rainbow-ribbon",
    widthProfile: "ribbon",
    edgeColor: 0x261132,
    accentColor: 0xff6ca8,
    coreColor: 0xffffff,
    strandPalette: Object.freeze([0xff3d5a, 0xff982e, 0xffe85a, 0x54d975, 0x5c83f2]),
    edgeWidth: 0.96,
    chromaWidth: 0.9,
    coreWidth: 0.08,
    ripple: "sine",
    rippleAmplitude: 0.08,
    rippleFrequency: 2.5,
    flickerHz: 5,
    particleElement: "arcane",
    bodyParticle: "wisp",
    coreParticle: "spark",
    bodyFrame: 5,
    coreFrame: 3,
    impact: Object.freeze({ points: 10, rings: 2, radiusScale: 1.08, spin: 1.1 }),
  }),
  });

const STRUCTURE_FAMILY_RECIPE: Readonly<
  Record<BeamVfxStructureFamily, BeamVfxStructureRecipe>
> = Object.freeze({
  "segmented-arcs": Object.freeze({
    family: "segmented-arcs",
    artWidth: 0.88,
    readableCoreWidth: 0.065,
    phaseRate: 1.15,
  }),
  "converging-strands": Object.freeze({
    family: "converging-strands",
    artWidth: 0.92,
    readableCoreWidth: 0.055,
    phaseRate: 0.7,
  }),
  "pulse-train": Object.freeze({
    family: "pulse-train",
    artWidth: 0.84,
    readableCoreWidth: 0.045,
    phaseRate: 1.45,
  }),
  "flame-tongues": Object.freeze({
    family: "flame-tongues",
    artWidth: 0.9,
    readableCoreWidth: 0.075,
    phaseRate: 0.9,
  }),
  "ice-particles": Object.freeze({
    family: "ice-particles",
    artWidth: 0.92,
    readableCoreWidth: 0,
    phaseRate: 0.6,
    iceOnly: true,
  }),
});

/** Data-owned family distribution. BeamRenderer consumes only this resolved recipe and never branches by ID. */
export const BEAM_STRUCTURE_FAMILY_BY_WEAPON: Readonly<
  Record<string, BeamVfxStructureFamily>
> = Object.freeze({
  "x2-voltcaster-machine-pistol": "segmented-arcs",
  "x2-stormcaller-tesla-gatling": "segmented-arcs",
  "x2-mirage-coilrifle": "converging-strands",
  "x2-permafrost-siege-lobber": "ice-particles",
  "x2-doomsday-drum-cannon": "flame-tongues",
  "x2-null-grimoire-of-the-hollow-page": "flame-tongues",
  "x2-psalter-of-the-burning-halo": "pulse-train",
  "x2-frostquill-compendium": "ice-particles",
  "x2-brinequill-tidescepter": "converging-strands",
  "x2-sunmote-reliquary-staff": "flame-tongues",
  "x2-carrion-roost-necro-scepter": "segmented-arcs",
  "x2-auroral-filament-wand": "converging-strands",
  "x2-mesa-spine-thunder-stave": "converging-strands",
  "x2-riftglass-prism-lantern": "segmented-arcs",
  "x2-quartzlight-wayfinder": "pulse-train",
  "x2-pearl-of-penance-censer": "pulse-train",
  "x2-smoldering-eye-of-perdition": "flame-tongues",
  "x2-nullsaint-reliquary": "pulse-train",
  "x2-sanctum-brazier-staff": "converging-strands",
  "x2-seraph-s-knuckle-reliquary": "pulse-train",
  "x2-voidgrasp-null-gauntlet": "converging-strands",
  "x2-glasswidow-hexweave": "segmented-arcs",
  "x2-unicorn-rainbow-beam": "converging-strands",
});

export const BEAM_VFX_RECIPES: Readonly<Record<string, BeamVfxRecipe>> = Object.freeze(
  Object.fromEntries(
    Object.entries(BEAM_VFX_BASE_RECIPES).map(([weaponId, recipe]) => {
      const family = BEAM_STRUCTURE_FAMILY_BY_WEAPON[weaponId];
      if (!family) throw new Error(`Missing V7 beam structure family for ${weaponId}`);
      return [weaponId, Object.freeze({ ...recipe, structure: STRUCTURE_FAMILY_RECIPE[family] })];
    }),
  ) as Record<string, BeamVfxRecipe>,
);

const BOOK_FAMILIES =
  /^(?:almanac|bestiary|chapbook|compendium|grimoire|ledger|manuscript|psalter|spellbook|tome)$/;
const RECIPE_CACHE = new WeakMap<WeaponDef, CasterVfxRecipe>();

/** Normalize generated content families into a compact VFX silhouette vocabulary. */
export function casterVfxFormFor(def: WeaponDef): CasterVfxForm {
  const family = def.tags.family.toLowerCase();
  const words = `${def.id} ${def.name} ${family}`.toLowerCase();
  if (/\blance\b/.test(words)) return "lance";
  if (/\b(?:codex|codicil|manuscript|ledger|compendium)\b/.test(words)) return "codex";
  if (
    BOOK_FAMILIES.test(family) ||
    /\b(?:book|folio|grimoire|tome|volume|liber|psalter|almanac|bestiary|chapbook|apocrypha|hexicon)\b/.test(
      words,
    )
  )
    return "tome";
  if (/\b(?:staff|stave|rod|scepter|wand|crozier)\b/.test(words)) return "staff";
  if (family === "orb" || /\b(?:orb|globe|marble|sphere|bauble|geode)\b/.test(words)) return "orb";
  if (
    family === "relic/totem" ||
    /\b(?:relic|totem|censer|idol|reliquary|monstrance|cairn|effigy|fetish)\b/.test(words)
  )
    return "relic";
  if (family === "gauntlet" || /\b(?:gauntlet|glove|mitt|fist|bracer|knuckle|palm)\b/.test(words))
    return "gauntlet";
  return "focus";
}

function authoredDamage(def: WeaponDef): number {
  return Math.max(
    def.damage,
    def.cast?.damage ?? 0,
    (def.gun?.damage ?? 0) + (def.gun?.explode?.damage ?? 0),
    (def.scatter?.damage ?? 0) + (def.scatter?.explode?.damage ?? 0),
    def.quake?.damage ?? 0,
    def.chainLightning?.damage ?? 0,
    (def.beam?.damagePerSecond ?? 0) * 0.25,
  );
}

function damageTierFor(def: WeaponDef): CasterVfxDamageTier {
  const damage = authoredDamage(def);
  if (damage >= 16) return "nova";
  if (damage >= 9) return "burst";
  return "spark";
}

/** Resolve presentation only from weapon truth plus the authored caster and beam signatures. */
export function resolveCasterVfxRecipe(def: WeaponDef | undefined): CasterVfxRecipe | undefined {
  if (!def || (def.tags.classPool !== "caster" && !def.beam)) return undefined;
  if (generatedImageVfxReplacesProceduralRecipe(def.id)) return undefined;
  const cached = RECIPE_CACHE.get(def);
  if (cached) return cached;
  const element = CASTER_VFX_ELEMENTS.includes(def.tags.element as CasterVfxElement)
    ? (def.tags.element as CasterVfxElement)
    : "arcane";
  const damageTier = damageTierFor(def);
  const form = casterVfxFormFor(def);
  const grade: CasterVfxGrade =
    damageTier === "nova" ? "pinnacle" : damageTier === "burst" ? "master" : "adept";
  const spriteProjectile = CASTER_SPRITE_PROJECTILES[def.id];
  const textureProjectile = CASTER_TEXTURE_PROJECTILES[def.id];
  const particleProjectile = CASTER_PARTICLE_PROJECTILES[def.id];
  const paintedImpact = CASTER_PAINTED_IMPACTS[def.id];
  const gradeIndex = grade === "pinnacle" ? 2 : grade === "master" ? 1 : 0;
  const damageIndex = damageTier === "nova" ? 2 : damageTier === "burst" ? 1 : 0;
  const sourceBase = FORM_SOURCE[form];
  const projectileBase = FORM_PROJECTILE[form];
  const impactBase = FORM_IMPACT[form];
  const signature = CASTER_VFX_SIGNATURES[def.id];
  const beam = BEAM_VFX_RECIPES[def.id];
  const source = Object.freeze({
    ...sourceBase,
    radius: 18 + gradeIndex * 4,
    lineWidth: 1.5 + gradeIndex * 0.6,
    particles: 3 + gradeIndex + (signature ? 1 : 0),
  });
  const projectile = Object.freeze({
    ...projectileBase,
    coreRadius: 3.5 + gradeIndex * 1.1,
    bodySizePx: (3.5 + gradeIndex * 1.1) * 5.5,
    ...(particleProjectile
      ? {
          particleTreatment: particleProjectile.treatment,
          particlePack: particleProjectile.pack,
          particleCount: particleProjectile.count,
        }
      : {}),
  });
  const impact = Object.freeze({
    ...impactBase,
    radius: 18 + damageIndex * 8,
    particles: 4 + damageIndex * 2,
  });
  const recipe = Object.freeze({
    kind: "caster-vfx" as const,
    isDefault: false as const,
    key: `caster:${element}:${form}:${grade}:${damageTier}${signature ? `:${signature}` : ""}${beam ? `:beam:${beam.signature}` : ""}`,
    weaponId: def.id,
    element,
    form,
    grade,
    damageTier,
    palette: CASTER_VFX_PALETTE_OVERRIDES[def.id] ?? ELEMENT_PALETTES[element],
    source,
    projectile,
    ...(spriteProjectile ? { spriteProjectile } : {}),
    ...(textureProjectile ? { textureProjectile } : {}),
    ...(paintedImpact ? { paintedImpact } : {}),
    impact,
    ...(signature ? { signature } : {}),
    ...(beam ? { beam } : {}),
  });
  RECIPE_CACHE.set(def, recipe);
  return recipe;
}
