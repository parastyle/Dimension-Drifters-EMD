import type { WeaponDef } from "@dd/shared";
import type { FxPackName } from "./fx-composer.js";

export const QUAKE_VFX_VARIANT_IDS = [
  "faultline-crack",
  "hammer-slam",
  "double-ripple",
  "aftershock-eruption",
] as const;

export type QuakeVfxVariantId = (typeof QUAKE_VFX_VARIANT_IDS)[number];
export type QuakeVfxElement =
  | "physical"
  | "fire"
  | "frost"
  | "shock"
  | "holy"
  | "toxic"
  | "void"
  | "arcane";

export interface QuakeVfxRecipe {
  readonly variant: QuakeVfxVariantId;
  /** Gameplay element remains coherent with the weapon definition. */
  readonly element: QuakeVfxElement;
  /** Optional presentation-only palette override; never changes damage typing. */
  readonly visualElement?: QuakeVfxElement;
  /** Stable visual signature used by the V3X clone-cap test. */
  readonly signature: string;
  readonly pack: FxPackName;
  readonly primaryShape: "shard" | "spark" | "ring" | "wisp";
  readonly secondaryShape: "splat" | "mote" | "ring" | "shard";
  readonly pulseDelayMs: number;
  readonly ringCount: number;
  readonly particleCount: number;
  readonly effectCountMultiplier: number;
  readonly shake: number;
  /** Optional whole-pack tint for an owner-authored color pass that retains the original motion recipe. */
  readonly packTint?: number;
  /** Owner-authored impact replaces every debris/spark layer with smoke while retaining its radius cue. */
  readonly smokeOnly?: true;
  readonly palette: {
    readonly hot: number;
    readonly mid: number;
    readonly ground: number;
  };
}

/**
 * Honest pre-V3X inventory: these were the 31 catalog weapons whose quake reached the same
 * `quake-burst` component pack plus the same procedural gold ellipse/dust/debris fallback as
 * Anvil-Heart. Grave-call semantics, Tombstone's hero quake, and explicitly suppressed/replaced
 * quake recipes are intentionally outside this family.
 */
export const LEGACY_ANVIL_QUAKE_CLUSTER_IDS = Object.freeze([
  "x2-sluicebox-maul-axe",
  "x2-choir-iron-greataxe",
  "x2-boomtown-maul",
  "x2-frostbite-headstone",
  "x2-anvil-drop",
  "x2-dustdevil-warmaul",
  "x2-saint-calamity",
  "x2-hoarfrost-piledriver",
  "x2-widowmaker-wrecking-ball",
  "x2-plaguethresh",
  "x2-ferrous-serpent",
  "x2-maledict-tome-of-salt-lines",
  "x2-cinderquill-almanac",
  "x2-ledger-of-spent-souls",
  "x2-anvil-heart-quake-maul-staff",
  "x2-throne-of-ash-coal-scepter",
  "x2-saint-bough-frost-crozier",
  "x2-obsidian-maw-void-staff",
  "x2-saint-s-knucklebone-censer-orb",
  "x2-coffin-nail-rosary-orb",
  "x2-reckoning-s-sun-orb",
  "x2-dust-devil-cyclone-orb",
  "x2-frostbite-snowglobe",
  "x2-rotgrove-totem",
  "x2-idol-of-the-pale-verdict",
  "x2-miasma-bell-censer",
  "x2-godsbone-pillar",
  "x2-mawstone-cairn-idol",
  "x2-pyreclap-mauler",
  "x2-ironbrand-heatfist",
  "x2-thunderhead-stormfists",
] as const);

/** Explicit distribution keeps visual authorship reviewable instead of hiding it behind an id hash. */
export const ANVIL_QUAKE_VARIANT_ASSIGNMENTS = Object.freeze({
  "x2-sluicebox-maul-axe": "faultline-crack",
  "x2-choir-iron-greataxe": "faultline-crack",
  "x2-boomtown-maul": "hammer-slam",
  "x2-frostbite-headstone": "faultline-crack",
  "x2-anvil-drop": "hammer-slam",
  "x2-dustdevil-warmaul": "double-ripple",
  "x2-saint-calamity": "hammer-slam",
  "x2-hoarfrost-piledriver": "hammer-slam",
  "x2-widowmaker-wrecking-ball": "aftershock-eruption",
  "x2-plaguethresh": "faultline-crack",
  "x2-ferrous-serpent": "faultline-crack",
  "x2-maledict-tome-of-salt-lines": "faultline-crack",
  "x2-cinderquill-almanac": "aftershock-eruption",
  "x2-ledger-of-spent-souls": "faultline-crack",
  "x2-anvil-heart-quake-maul-staff": "faultline-crack",
  "x2-throne-of-ash-coal-scepter": "double-ripple",
  "x2-saint-bough-frost-crozier": "double-ripple",
  "x2-obsidian-maw-void-staff": "hammer-slam",
  "x2-saint-s-knucklebone-censer-orb": "double-ripple",
  "x2-coffin-nail-rosary-orb": "double-ripple",
  "x2-reckoning-s-sun-orb": "aftershock-eruption",
  "x2-dust-devil-cyclone-orb": "double-ripple",
  "x2-frostbite-snowglobe": "aftershock-eruption",
  "x2-rotgrove-totem": "aftershock-eruption",
  "x2-idol-of-the-pale-verdict": "faultline-crack",
  "x2-miasma-bell-censer": "double-ripple",
  "x2-godsbone-pillar": "hammer-slam",
  "x2-mawstone-cairn-idol": "hammer-slam",
  "x2-pyreclap-mauler": "hammer-slam",
  "x2-ironbrand-heatfist": "aftershock-eruption",
  "x2-thunderhead-stormfists": "hammer-slam",
} as const satisfies Record<
  (typeof LEGACY_ANVIL_QUAKE_CLUSTER_IDS)[number],
  QuakeVfxVariantId
>);

const ELEMENT_RECIPES: Record<
  QuakeVfxElement,
  Pick<QuakeVfxRecipe, "pack" | "palette">
> = {
  physical: {
    pack: "quake-burst",
    palette: { hot: 0xf2dfb0, mid: 0xc49a5a, ground: 0x6e5a3e },
  },
  fire: {
    pack: "ember-eruption",
    palette: { hot: 0xffd27a, mid: 0xff6a2a, ground: 0x6b2418 },
  },
  frost: {
    pack: "frost-nova",
    palette: { hot: 0xe8fbff, mid: 0x6fd6ff, ground: 0x315c70 },
  },
  shock: {
    pack: "lightning-ball",
    palette: { hot: 0xffffff, mid: 0x33e6ff, ground: 0x315b67 },
  },
  holy: {
    pack: "holy-smite",
    palette: { hot: 0xfff6cf, mid: 0xffd36b, ground: 0x76653c },
  },
  toxic: {
    pack: "toxic-burst",
    palette: { hot: 0xe4ff9c, mid: 0x9cff3b, ground: 0x3d5b28 },
  },
  void: {
    pack: "void-implosion",
    palette: { hot: 0xf1c6ff, mid: 0xb14bff, ground: 0x3e2355 },
  },
  arcane: {
    pack: "void-implosion",
    palette: { hot: 0xe0d2ff, mid: 0x8f6aff, ground: 0x3f3767 },
  },
};

const VARIANT_RECIPES: Record<
  QuakeVfxVariantId,
  Pick<
    QuakeVfxRecipe,
    | "primaryShape"
    | "secondaryShape"
    | "pulseDelayMs"
    | "ringCount"
    | "particleCount"
    | "shake"
  >
> = {
  "faultline-crack": {
    primaryShape: "shard",
    secondaryShape: "splat",
    pulseDelayMs: 0,
    ringCount: 1,
    particleCount: 8,
    shake: 0.012,
  },
  "hammer-slam": {
    primaryShape: "spark",
    secondaryShape: "shard",
    pulseDelayMs: 0,
    ringCount: 1,
    particleCount: 12,
    shake: 0.018,
  },
  "double-ripple": {
    primaryShape: "ring",
    secondaryShape: "mote",
    pulseDelayMs: 70,
    ringCount: 3,
    particleCount: 6,
    shake: 0.009,
  },
  "aftershock-eruption": {
    primaryShape: "wisp",
    secondaryShape: "shard",
    pulseDelayMs: 105,
    ringCount: 2,
    particleCount: 9,
    shake: 0.015,
  },
};

function quakeElement(weapon: WeaponDef): QuakeVfxElement {
  const element = weapon.tags.element;
  return element in ELEMENT_RECIPES ? (element as QuakeVfxElement) : "physical";
}

export function resolveQuakeVfxRecipe(
  weapon: WeaponDef | undefined,
): QuakeVfxRecipe | undefined {
  if (!weapon?.quake) return undefined;
  const variant =
    ANVIL_QUAKE_VARIANT_ASSIGNMENTS[
      weapon.id as keyof typeof ANVIL_QUAKE_VARIANT_ASSIGNMENTS
    ];
  if (!variant) return undefined;
  const gameplayElement = quakeElement(weapon);
  const visualElement: QuakeVfxElement =
    weapon.id === "x2-dust-devil-cyclone-orb" ? "arcane" : gameplayElement;
  const elemental = ELEMENT_RECIPES[gameplayElement];
  const visualPalette = ELEMENT_RECIPES[visualElement].palette;
  const shape = VARIANT_RECIPES[variant];
  return Object.freeze({
    variant,
    element: gameplayElement,
    ...(visualElement !== gameplayElement ? { visualElement } : {}),
    signature: `${visualElement}/${variant}/${elemental.pack}/${shape.primaryShape}/${shape.pulseDelayMs}`,
    ...elemental,
    palette: visualPalette,
    ...shape,
    effectCountMultiplier: weapon.id === "x2-godsbone-pillar" ? 2 : 1,
    ...(weapon.id === "x2-dust-devil-cyclone-orb" ? { packTint: 0xb14bff } : {}),
    ...(weapon.id === "x2-anvil-drop" ? { smokeOnly: true as const } : {}),
  });
}
