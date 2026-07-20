import type { Grade, WeaponDef } from "@dd/shared";

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
  readonly bodyScale: number;
  readonly particleShape: CasterParticleShape;
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
  readonly impact: CasterVfxImpactRecipe;
  readonly signature?: CasterVfxSignature;
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
    "x-staff-arcane-lance": "arcane-lance-line",
    "x2-codex-of-forked-tongues": "forked-page-flutter",
    "x2-null-grimoire-of-the-hollow-page": "hollow-page-aperture",
    "x2-sunmote-reliquary-staff": "sunmote-corona",
    "x2-mesa-spine-thunder-stave": "mesa-lightning-crown",
    "x2-obsidian-maw-void-staff": "obsidian-maw",
  });

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

function casterGrade(grade: Grade | undefined): CasterVfxGrade {
  if (grade === "S") return "pinnacle";
  if (grade === "A") return "master";
  return "adept";
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

/** Resolve presentation only from existing weapon truth plus the six-entry signature table. */
export function resolveCasterVfxRecipe(def: WeaponDef | undefined): CasterVfxRecipe | undefined {
  if (def?.tags.classPool !== "caster") return undefined;
  const cached = RECIPE_CACHE.get(def);
  if (cached) return cached;
  const element = CASTER_VFX_ELEMENTS.includes(def.tags.element as CasterVfxElement)
    ? (def.tags.element as CasterVfxElement)
    : "arcane";
  const form = casterVfxFormFor(def);
  const grade = casterGrade(def.scalingGrades?.int);
  const damageTier = damageTierFor(def);
  const gradeIndex = grade === "pinnacle" ? 2 : grade === "master" ? 1 : 0;
  const damageIndex = damageTier === "nova" ? 2 : damageTier === "burst" ? 1 : 0;
  const sourceBase = FORM_SOURCE[form];
  const projectileBase = FORM_PROJECTILE[form];
  const impactBase = FORM_IMPACT[form];
  const signature = CASTER_VFX_SIGNATURES[def.id];
  const source = Object.freeze({
    ...sourceBase,
    radius: 18 + gradeIndex * 4,
    lineWidth: 1.5 + gradeIndex * 0.6,
    particles: 3 + gradeIndex + (signature ? 1 : 0),
  });
  const projectile = Object.freeze({
    ...projectileBase,
    coreRadius: 3.5 + gradeIndex * 1.1,
    bodyScale: 0.2 + gradeIndex * 0.035,
  });
  const impact = Object.freeze({
    ...impactBase,
    radius: 18 + damageIndex * 8,
    particles: 4 + damageIndex * 2,
  });
  const recipe = Object.freeze({
    kind: "caster-vfx" as const,
    isDefault: false as const,
    key: `caster:${element}:${form}:${grade}:${damageTier}${signature ? `:${signature}` : ""}`,
    weaponId: def.id,
    element,
    form,
    grade,
    damageTier,
    palette: ELEMENT_PALETTES[element],
    source,
    projectile,
    impact,
    ...(signature ? { signature } : {}),
  });
  RECIPE_CACHE.set(def, recipe);
  return recipe;
}
