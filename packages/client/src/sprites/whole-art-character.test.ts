import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import {
  ensureWholeArtCharacterTextures,
  isWholeArtCharacterId,
  WHOLE_ART_CHARACTER_PART_ROLES,
  wholeArtCharacterManifest,
  wholeArtCharacterTextureKey,
} from "./whole-art-character.js";

describe("whole-art character texture contract", () => {
  it("qualifies the three owner prototypes without changing the legacy Drifter wardrobe mode", () => {
    for (const id of ["proto-samurai", "proto-sheriff", "proto-witch"]) {
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
