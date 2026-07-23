import { existsSync } from "node:fs";
import { DEFAULT_CHARACTER, PLAYABLE_CHARACTERS, WHOLE_ART_CHARACTERS } from "@dd/shared";
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

const EXPECTED_WHOLE_ART_CHARACTER_IDS = [
  "proto-alien-void-scholar",
  "proto-armored-bean-heavy",
  "proto-blob-bruiser",
  "proto-blue-spectral-demon-hunter",
  "proto-bone-cleric",
  "proto-capsule-tactical-unit",
  "proto-carnival-harlequin",
  "proto-clockwork-butler",
  "proto-cowboy",
  "proto-cowboy-hidden-face",
  "proto-cyberpunk-hacker",
  "proto-desert-nomad",
  "proto-frost-rune-guardian",
  "proto-geometric-robot-pod",
  "proto-gothic-vampire-hunter",
  "proto-helmeted-enforcer",
  "proto-hooded-rogue",
  "proto-junkyard-mechanic",
  "proto-masked-oval-fighter",
  "proto-molten-forge-golem",
  "proto-mushroom-alchemist",
  "proto-mutant-lump",
  "proto-ninja-purple",
  "proto-paper-cutout-fighter",
  "proto-pirate-captain",
  "proto-plague-doctor",
  "proto-punk-occult-summoner",
  "proto-red-rebel-demon-hunter",
  "proto-red-rebel-demon-hunter-v2",
  "proto-royal-executioner",
  "proto-samurai",
  "proto-soft-mascot-fighter",
  "proto-space-miner",
  "proto-swamp-shaman",
  "proto-templar-knight",
  "proto-toxic-wasteland-scavenger",
  "proto-wizard",
] as const;

describe("whole-art character texture contract", () => {
  it("enumerates exactly the 37 no-thumb owner prototypes and retires both legacy ids", () => {
    expect(WHOLE_ART_CHARACTERS).toEqual(EXPECTED_WHOLE_ART_CHARACTER_IDS);
    expect(WHOLE_ART_CHARACTERS).toHaveLength(37);
    expect(DEFAULT_CHARACTER).toBe("proto-cowboy-hidden-face");
    expect(WHOLE_ART_CHARACTERS).not.toContain("proto-sheriff");
    expect(WHOLE_ART_CHARACTERS).not.toContain("proto-witch");
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

  it.each(EXPECTED_WHOLE_ART_CHARACTER_IDS)(
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
    for (const id of WHOLE_ART_CHARACTER_IDS) {
      const scale = wholeArtCharacterVisualScale(id);
      const sourceHeight = characterStaticEnvelopeHeight(id);
      expect(scale, id).toBeGreaterThanOrEqual(0.65);
      expect(scale, id).toBeLessThanOrEqual(0.95);
      expect(scale, id).not.toBe(1);
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

    expect(ensureWholeArtCharacterTextures(scene, DEFAULT_CHARACTER)).toBe("pending");
    expect(scene.load.image).toHaveBeenCalledTimes(6);
    expect(scene.load.start).toHaveBeenCalledTimes(1);
    for (const role of WHOLE_ART_CHARACTER_PART_ROLES) {
      const key = wholeArtCharacterTextureKey(DEFAULT_CHARACTER, role);
      expect(queued.get(key)).toBe(`sprites/${DEFAULT_CHARACTER}/${role}.png`);
      textureKeys.add(key);
    }
    complete?.();

    expect(ensureWholeArtCharacterTextures(scene, DEFAULT_CHARACTER)).toBe("ready");
    expect(scene.load.image).toHaveBeenCalledTimes(6);
  });
});
