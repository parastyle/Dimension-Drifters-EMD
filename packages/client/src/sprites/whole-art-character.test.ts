import { existsSync } from "node:fs";
import { PLAYABLE_CHARACTERS, WHOLE_ART_CHARACTERS } from "@dd/shared";
import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import {
  characterStaticEnvelopeHeight,
  ensureWholeArtCharacterTextures,
  isWholeArtCharacterId,
  WHOLE_ART_CHARACTER_IDS,
  WHOLE_ART_CHARACTER_PART_ROLES,
  wholeArtCharacterManifest,
  wholeArtCharacterTextureKey,
  wholeArtCharacterVisualScale,
} from "./whole-art-character.js";

const BATCH2_WHOLE_ART_CHARACTER_IDS = [
  "proto-armored-bean-heavy",
  "proto-blob-bruiser",
  "proto-capsule-tactical-unit",
  "proto-geometric-robot-pod",
  "proto-helmeted-enforcer",
  "proto-hooded-rogue",
  "proto-masked-oval-fighter",
  "proto-mutant-lump",
  "proto-paper-cutout-fighter",
  "proto-soft-mascot-fighter",
] as const;

const EXPECTED_WHOLE_ART_CHARACTER_IDS = [
  "proto-armored-bean-heavy",
  "proto-blob-bruiser",
  "proto-capsule-tactical-unit",
  "proto-geometric-robot-pod",
  "proto-helmeted-enforcer",
  "proto-hooded-rogue",
  "proto-masked-oval-fighter",
  "proto-mutant-lump",
  "proto-paper-cutout-fighter",
  "proto-samurai",
  "proto-sheriff",
  "proto-soft-mascot-fighter",
  "proto-witch",
] as const;

describe("whole-art character texture contract", () => {
  it("enumerates the 3 shipped plus 10 new owner prototypes as the 13 whole-art choices", () => {
    expect(WHOLE_ART_CHARACTERS).toEqual(EXPECTED_WHOLE_ART_CHARACTER_IDS);
    expect([...WHOLE_ART_CHARACTER_IDS]).toEqual(
      PLAYABLE_CHARACTERS.filter((characterId) => characterId.startsWith("proto-")),
    );
    for (const id of WHOLE_ART_CHARACTER_IDS) {
      const manifest = wholeArtCharacterManifest(id);
      expect(manifest?.kind).toBe("character");
      expect(
        WHOLE_ART_CHARACTER_PART_ROLES.every((role) =>
          manifest?.parts.some((part) => part.role === role),
        ),
      ).toBe(true);
      expect(isWholeArtCharacterId(id)).toBe(true);
    }
    expect(isWholeArtCharacterId("drifter")).toBe(false);
    expect(isWholeArtCharacterId("cc-pyra-cinderhowl-the-flame-caster")).toBe(false);
  });

  it.each(BATCH2_WHOLE_ART_CHARACTER_IDS)(
    "installs all six manifest textures for %s as real loose PNGs with a head mount",
    (characterId) => {
      const manifest = wholeArtCharacterManifest(characterId);
      expect(manifest?.parts.map((part) => part.role)).toEqual([
        ...WHOLE_ART_CHARACTER_PART_ROLES,
      ]);
      expect(manifest?.body.h).toBe(168);
      for (const role of WHOLE_ART_CHARACTER_PART_ROLES) {
        const part = manifest?.parts.find((candidate) => candidate.role === role);
        expect(part, `${characterId}:${role}`).toBeDefined();
        expect(
          part &&
            existsSync(
              new URL(`../../public/sprites/${characterId}/${part.file}`, import.meta.url),
            ),
          `${characterId}:${role}`,
        ).toBe(true);
      }
      expect(manifest?.parts.find((part) => part.role === "head")?.oy).toBeLessThan(0);
    },
  );

  it("derives bounded whole-art corrections from the retained Drifter full-part envelope", () => {
    const referenceHeight = characterStaticEnvelopeHeight("drifter");
    expect(referenceHeight).toBeDefined();
    const expectedScales: Readonly<Record<string, number>> = {
      "proto-samurai": 0.847,
      "proto-sheriff": 0.73,
      "proto-witch": 0.739,
    };

    for (const id of WHOLE_ART_CHARACTER_IDS) {
      const scale = wholeArtCharacterVisualScale(id);
      const sourceHeight = characterStaticEnvelopeHeight(id);
      expect(scale, id).toBeGreaterThanOrEqual(0.65);
      expect(scale, id).toBeLessThanOrEqual(0.95);
      expect(scale, id).not.toBe(1);
      if (expectedScales[id] !== undefined) {
        expect(scale, id).toBeCloseTo(expectedScales[id], 3);
      }
      expect(sourceHeight, id).toBeDefined();
      expect(((sourceHeight ?? 0) * scale) / (referenceHeight ?? 1), id).toBeGreaterThanOrEqual(
        0.95,
      );
      expect(
        ((sourceHeight ?? 0) * scale) / (referenceHeight ?? 1),
        id,
      ).toBeLessThanOrEqual(1 + Number.EPSILON);
    }

    expect(wholeArtCharacterVisualScale("drifter")).toBe(1);
    expect(wholeArtCharacterVisualScale("cc-pyra-cinderhowl-the-flame-caster")).toBe(1);
    expect(wholeArtCharacterVisualScale("boilerplate")).toBe(1);
  });

  it("queues all six loose files once and becomes ready only after TextureManager owns every key", () => {
    const textureKeys = new Set<string>();
    const queued = new Map<string, string>();
    let complete: (() => void) | undefined;
    const scene = {
      textures: {
        exists: (key: string) => textureKeys.has(key),
      },
      load: {
        image: vi.fn((key: string, url: string) => queued.set(key, url)),
        on: vi.fn(),
        once: vi.fn((event: string, callback: () => void) => {
          if (event === "complete") complete = callback;
        }),
        off: vi.fn(),
        isLoading: vi.fn(() => false),
        start: vi.fn(),
      },
    } as unknown as Phaser.Scene;

    expect(ensureWholeArtCharacterTextures(scene, "proto-sheriff")).toBe("pending");
    expect(scene.load.image).toHaveBeenCalledTimes(6);
    expect(scene.load.start).toHaveBeenCalledTimes(1);
    for (const role of WHOLE_ART_CHARACTER_PART_ROLES) {
      const key = wholeArtCharacterTextureKey("proto-sheriff", role);
      expect(queued.get(key)).toBe(`sprites/proto-sheriff/${role}.png`);
      textureKeys.add(key);
    }
    complete?.();

    expect(ensureWholeArtCharacterTextures(scene, "proto-sheriff")).toBe("ready");
    expect(scene.load.image).toHaveBeenCalledTimes(6);
  });
});
