import { ACTIVE_WEAPON_CATALOG_IDS, WEAPONS, type WeaponDef } from "@dd/shared";

export const GUN_FIRE_FAMILY_PROFILES = Object.freeze({
  revolver: Object.freeze({
    cue: "gun:fire:revolver",
    sampleId: "gun-family-revolver",
    minIntervalMs: 34,
    volume: 0.58,
    fallback: "powder" as const,
  }),
  "scatter-sidearm": Object.freeze({
    cue: "gun:fire:scatter-sidearm",
    sampleId: "gun-family-scatter-sidearm",
    minIntervalMs: 44,
    volume: 0.6,
    fallback: "scatter" as const,
  }),
  "hand-cannon": Object.freeze({
    cue: "gun:fire:hand-cannon",
    sampleId: "gun-family-hand-cannon",
    minIntervalMs: 55,
    volume: 0.66,
    fallback: "heavy" as const,
  }),
  shotgun: Object.freeze({
    cue: "gun:fire:shotgun",
    sampleId: "gun-family-shotgun",
    minIntervalMs: 54,
    volume: 0.68,
    fallback: "scatter" as const,
  }),
  blunderbuss: Object.freeze({
    cue: "gun:fire:blunderbuss",
    sampleId: "gun-family-blunderbuss",
    minIntervalMs: 60,
    volume: 0.7,
    fallback: "heavy" as const,
  }),
  "rotary-auto": Object.freeze({
    cue: "gun:fire:rotary-auto",
    sampleId: "gun-family-rotary-auto",
    minIntervalMs: 25,
    volume: 0.42,
    fallback: "auto" as const,
  }),
  "industrial-repeater": Object.freeze({
    cue: "gun:fire:industrial-repeater",
    sampleId: "gun-family-industrial-repeater",
    minIntervalMs: 28,
    volume: 0.44,
    fallback: "mechanical" as const,
  }),
  "lever-rifle": Object.freeze({
    cue: "gun:fire:lever-rifle",
    sampleId: "gun-family-lever-rifle",
    minIntervalMs: 38,
    volume: 0.6,
    fallback: "powder" as const,
  }),
  "long-rifle": Object.freeze({
    cue: "gun:fire:long-rifle",
    sampleId: "gun-family-long-rifle",
    minIntervalMs: 55,
    volume: 0.66,
    fallback: "heavy" as const,
  }),
  "coil-rail": Object.freeze({
    cue: "gun:fire:coil-rail",
    sampleId: "gun-family-coil-rail",
    minIntervalMs: 34,
    volume: 0.58,
    fallback: "energy" as const,
  }),
  "siege-ordnance": Object.freeze({
    cue: "gun:fire:siege-ordnance",
    sampleId: "gun-family-siege-ordnance",
    minIntervalMs: 64,
    volume: 0.72,
    fallback: "heavy" as const,
  }),
  "heavy-scatter": Object.freeze({
    cue: "gun:fire:heavy-scatter",
    sampleId: "gun-family-heavy-scatter",
    minIntervalMs: 48,
    volume: 0.66,
    fallback: "scatter" as const,
  }),
  "bolt-launcher": Object.freeze({
    cue: "gun:fire:bolt-launcher",
    sampleId: "gun-family-bolt-launcher",
    minIntervalMs: 34,
    volume: 0.5,
    fallback: "mechanical" as const,
  }),
  "occult-relic": Object.freeze({
    cue: "gun:fire:occult-relic",
    sampleId: "gun-family-occult-relic",
    minIntervalMs: 38,
    volume: 0.56,
    fallback: "energy" as const,
  }),
  "gauntlet-discharge": Object.freeze({
    cue: "gun:fire:gauntlet-discharge",
    sampleId: "gun-family-gauntlet-discharge",
    minIntervalMs: 30,
    volume: 0.52,
    fallback: "energy" as const,
  }),
  "novelty-launcher": Object.freeze({
    cue: "gun:fire:novelty-launcher",
    sampleId: "gun-family-novelty-launcher",
    minIntervalMs: 55,
    volume: 0.6,
    fallback: "scatter" as const,
  }),
});

export type GunFireFamily = keyof typeof GUN_FIRE_FAMILY_PROFILES;
export type GunFireFamilyProfile = (typeof GUN_FIRE_FAMILY_PROFILES)[GunFireFamily];

const NOVELTY_LAUNCHERS = new Set([
  "x2-confetti-cannon",
  "x2-exploding-present-lobber",
  "x2-fish-launcher",
]);

const HEAVY_SCATTER = new Set([
  "x2-buckshot-avalanche",
  "x2-cinderfan-dragoon",
  "x2-plaguespitter-flak-gun",
  "x2-scattershell-duster",
]);

const ROTARY_HEAVY = new Set(["x2-hellbore-gatling", "x2-ironhail-pepperbox"]);

function classifyExoticRanged(weapon: WeaponDef): GunFireFamily {
  const fiction = `${weapon.id} ${weapon.name}`.toLowerCase();
  if (/scattergun/.test(fiction)) return "scatter-sidearm";
  if (/carom|ricochet/.test(fiction)) return "revolver";
  if (/arbalest|bombarpoon|bow|crossbow|harpoon|speargun/.test(fiction)) return "bolt-launcher";
  return "industrial-repeater";
}

/**
 * Resolve one active gun by authored fiction and mechanism. The shared `family` is the primary source;
 * narrow id/name exceptions split broad generated-catalog buckets where the actual mechanism differs.
 */
export function gunFireFamilyForWeapon(weapon: WeaponDef): GunFireFamily | undefined {
  if (!weapon.gun) return undefined;
  if (NOVELTY_LAUNCHERS.has(weapon.id)) return "novelty-launcher";

  switch (weapon.tags.family) {
    case "pistol":
      return (weapon.gun.pellets ?? 1) > 1 || weapon.gun.bulletKind === "pellet"
        ? "scatter-sidearm"
        : "revolver";
    case "hand-cannon":
      return weapon.id === "x-gun-hand-mortar" ? "siege-ordnance" : "hand-cannon";
    case "concussion-cannon":
      return "hand-cannon";
    case "shotgun":
      return "shotgun";
    case "blunderbuss":
      return "blunderbuss";
    case "gun":
    case "machine-pistol":
    case "auto-rifle":
      return "rotary-auto";
    case "nailgun":
    case "scrap-cannon":
      return "industrial-repeater";
    case "seed-launcher":
      return "bolt-launcher";
    case "lever-rifle":
      return "lever-rifle";
    case "marksman-rifle":
      return "long-rifle";
    case "railgun":
      return "coil-rail";
    case "heavy-ordnance":
    case "grenade-launcher":
      if (weapon.id === "x2-hailstorm-coilgun") return "coil-rail";
      if (ROTARY_HEAVY.has(weapon.id)) return "rotary-auto";
      if (HEAVY_SCATTER.has(weapon.id)) return "heavy-scatter";
      return "siege-ordnance";
    case "exotic-ranged":
      return classifyExoticRanged(weapon);
    case "wand":
    case "relic/totem":
      return "occult-relic";
    case "gauntlet":
      return "gauntlet-discharge";
    default:
      return undefined;
  }
}

const activeGunFamilyEntries = ACTIVE_WEAPON_CATALOG_IDS.flatMap((weaponId) => {
  const weapon = WEAPONS[weaponId];
  if (!weapon?.gun) return [];
  const family = gunFireFamilyForWeapon(weapon);
  if (!family) throw new Error(`Active gun ${weaponId} has no fire-sound family`);
  return [[weaponId, family] as const];
});

export const ACTIVE_GUN_FIRE_FAMILY_BY_ID: Readonly<Record<string, GunFireFamily>> = Object.freeze(
  Object.fromEntries(activeGunFamilyEntries),
);

const FAMILY_BY_CUE = new Map<GunFireFamilyProfile["cue"], GunFireFamily>(
  Object.entries(GUN_FIRE_FAMILY_PROFILES).map(([family, profile]) => [
    profile.cue,
    family as GunFireFamily,
  ]),
);

export const GUN_FIRE_SAMPLE_IDS = Object.freeze(
  Object.values(GUN_FIRE_FAMILY_PROFILES).map((profile) => profile.sampleId),
);

export function gunFireFamilyFor(weaponId: string | undefined): GunFireFamily | undefined {
  return weaponId ? ACTIVE_GUN_FIRE_FAMILY_BY_ID[weaponId] : undefined;
}

export function gunFireAudioCue(weaponId: string | undefined): string | undefined {
  const family = gunFireFamilyFor(weaponId);
  return family ? GUN_FIRE_FAMILY_PROFILES[family].cue : undefined;
}

export function gunFireFamilyForCue(cue: string): GunFireFamily | undefined {
  return FAMILY_BY_CUE.get(cue as GunFireFamilyProfile["cue"]);
}
