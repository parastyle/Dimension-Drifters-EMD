import { PLAYABLE_CHARACTERS } from "@dd/shared";
import type Phaser from "phaser";
import { SPRITES, type SpriteManifest, type SpritePart } from "./manifest.js";

export const WHOLE_ART_CHARACTER_PART_ROLES = [
  "body",
  "head",
  "hand-l",
  "hand-r",
  "foot-l",
  "foot-r",
] as const;

export type WholeArtCharacterPartRole = (typeof WHOLE_ART_CHARACTER_PART_ROLES)[number];
export type WholeArtCharacterTextureState = "ready" | "pending" | "missing";

/**
 * The generated sprite manifest does not yet carry a render-mode field: legacy Drifter/cc-* wardrobe
 * scaffolds also happen to have six sliced parts. Source the semantic candidates from the shared playable
 * roster's proto subset, then retain the six-part qualification below as the client asset guard.
 */
export const WHOLE_ART_CHARACTER_IDS: ReadonlySet<string> = new Set(
  PLAYABLE_CHARACTERS.filter((characterId) => characterId.startsWith("proto-")),
);

const LEGACY_REFERENCE_CHARACTER_ID = "drifter";
const MIN_VISUAL_ENVELOPE_SCALE = 0.65;
const MAX_VISUAL_ENVELOPE_SCALE = 0.95;
const MIN_ART_DIRECTION_ENVELOPE_FRACTION = 0.95;
const MAX_ART_DIRECTION_ENVELOPE_FRACTION = 1;

/**
 * Broad authored head silhouettes read slightly larger than their rectangular full-part bounds. These
 * bounded fractions keep the initial geometry audit on its art-directed target while the scale itself
 * remains derived from current manifest geometry.
 */
const WHOLE_ART_ENVELOPE_FRACTIONS: Readonly<Record<string, number>> = Object.freeze({
  "proto-samurai": 0.98,
  "proto-sheriff": 0.97,
  "proto-witch": 0.958,
});

interface WholeArtTextureRegistry {
  readonly pending: Set<string>;
  readonly failed: Set<string>;
}

const registries = new WeakMap<object, WholeArtTextureRegistry>();

function textureRegistry(scene: Phaser.Scene): WholeArtTextureRegistry {
  const owner = scene.textures as unknown as object;
  let registry = registries.get(owner);
  if (!registry) {
    registry = { pending: new Set<string>(), failed: new Set<string>() };
    registries.set(owner, registry);
  }
  return registry;
}

export function wholeArtCharacterManifest(
  characterId: string | null | undefined,
): SpriteManifest | undefined {
  if (!characterId || !WHOLE_ART_CHARACTER_IDS.has(characterId)) return undefined;
  const manifest = (SPRITES as Readonly<Record<string, SpriteManifest>>)[characterId];
  if (manifest?.kind !== "character") return undefined;
  return WHOLE_ART_CHARACTER_PART_ROLES.every((role) =>
    manifest.parts.some((part) => part.role === role),
  )
    ? manifest
    : undefined;
}

export function isWholeArtCharacterId(
  characterId: string | null | undefined,
): characterId is string {
  return wholeArtCharacterManifest(characterId) !== undefined;
}

/**
 * Static texture-rectangle height normalized to one authored body height. Because SpriteRig normalizes
 * every body to the same target height, this is also the deterministic rendered-height comparison.
 */
export function characterStaticEnvelopeHeight(characterId: string): number | undefined {
  const manifest = (SPRITES as Readonly<Record<string, SpriteManifest>>)[characterId];
  if (manifest?.kind !== "character" || manifest.body.h <= 0 || manifest.parts.length === 0) {
    return undefined;
  }
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const part of manifest.parts) {
    minY = Math.min(minY, part.oy - part.h / 2);
    maxY = Math.max(maxY, part.oy + part.h / 2);
  }
  return (maxY - minY) / manifest.body.h;
}

/**
 * Client-only root multiplier that makes a whole-art rig fit the retained Drifter visual envelope.
 * Legacy/unknown rigs deliberately return 1 and continue to use only the caller's ordinary rig scale.
 */
export function wholeArtCharacterVisualScale(characterId: string | null | undefined): number {
  if (!characterId || !wholeArtCharacterManifest(characterId)) return 1;
  const referenceHeight = characterStaticEnvelopeHeight(LEGACY_REFERENCE_CHARACTER_ID);
  const characterHeight = characterStaticEnvelopeHeight(characterId);
  if (!referenceHeight || !characterHeight) return 1;
  const authoredFraction = WHOLE_ART_ENVELOPE_FRACTIONS[characterId] ?? 1;
  const boundedFraction = Math.max(
    MIN_ART_DIRECTION_ENVELOPE_FRACTION,
    Math.min(MAX_ART_DIRECTION_ENVELOPE_FRACTION, authoredFraction),
  );
  return Math.max(
    MIN_VISUAL_ENVELOPE_SCALE,
    Math.min(MAX_VISUAL_ENVELOPE_SCALE, (referenceHeight / characterHeight) * boundedFraction),
  );
}

export function wholeArtCharacterTextureKey(
  characterId: string,
  role: WholeArtCharacterPartRole,
): string {
  return `char:${characterId}:${role}`;
}

export function isWholeArtCharacterPartRole(role: string): role is WholeArtCharacterPartRole {
  return (WHOLE_ART_CHARACTER_PART_ROLES as readonly string[]).includes(role);
}

export function wholeArtCharacterTextureUrl(characterId: string, part: SpritePart): string {
  return `sprites/${characterId}/${part.file}`;
}

export function wholeArtCharacterTextureState(
  scene: Phaser.Scene,
  characterId: string,
): WholeArtCharacterTextureState {
  const manifest = wholeArtCharacterManifest(characterId);
  if (!manifest) return "missing";
  const registry = textureRegistry(scene);
  let missing = false;
  for (const role of WHOLE_ART_CHARACTER_PART_ROLES) {
    const key = wholeArtCharacterTextureKey(characterId, role);
    if (scene.textures.exists(key)) continue;
    if (registry.failed.has(key)) missing = true;
    else return "pending";
  }
  return missing ? "missing" : "ready";
}

/**
 * Queue one manifest-backed character's six authored cuts. Callers wait for `ready` before constructing
 * the rig, so Phaser never paints an atlas/boilerplate placeholder while these inspectable textures load.
 */
export function ensureWholeArtCharacterTextures(
  scene: Phaser.Scene,
  characterId: string,
): WholeArtCharacterTextureState {
  const manifest = wholeArtCharacterManifest(characterId);
  if (!manifest) return "missing";
  const registry = textureRegistry(scene);
  const queuedKeys = new Set<string>();

  for (const role of WHOLE_ART_CHARACTER_PART_ROLES) {
    const part = manifest.parts.find((candidate) => candidate.role === role);
    if (!part) return "missing";
    const key = wholeArtCharacterTextureKey(characterId, role);
    if (scene.textures.exists(key) || registry.failed.has(key)) continue;
    if (registry.pending.has(key)) {
      if (scene.load.isLoading()) continue;
      registry.pending.delete(key);
    }
    registry.pending.add(key);
    queuedKeys.add(key);
    scene.load.image(key, wholeArtCharacterTextureUrl(characterId, part));
  }

  if (queuedKeys.size > 0) {
    const onError = (file: Phaser.Loader.File): void => {
      const key = String(file.key);
      if (queuedKeys.has(key)) registry.failed.add(key);
    };
    scene.load.on("loaderror", onError);
    scene.load.once("complete", () => {
      scene.load.off("loaderror", onError);
      for (const key of queuedKeys) {
        registry.pending.delete(key);
        if (!scene.textures.exists(key)) registry.failed.add(key);
      }
    });
    if (!scene.load.isLoading()) scene.load.start();
  }

  return wholeArtCharacterTextureState(scene, characterId);
}
