import { WHOLE_ART_CHARACTERS } from "@dd/shared";
import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { WHOLE_ART_CHARACTER_PART_ROLES } from "../../sprites/whole-art-character.js";
import { characterPortraitLayout, queueCharacterPreviewTextures } from "./preview.js";

describe("menu character previews", () => {
  it("queues exactly six whole-art cuts for every shared roster entry", () => {
    const image = vi.fn();
    const scene = {
      textures: { exists: () => false },
      load: { image },
    } as unknown as Phaser.Scene;

    queueCharacterPreviewTextures(scene);

    expect(image).toHaveBeenCalledTimes(
      WHOLE_ART_CHARACTERS.length * WHOLE_ART_CHARACTER_PART_ROLES.length,
    );
    const keys = image.mock.calls.map(([key]) => String(key));
    expect(new Set(keys).size).toBe(keys.length);
    for (const id of WHOLE_ART_CHARACTERS) {
      expect(keys.filter((key) => key.startsWith(`char:${id}:`))).toHaveLength(6);
    }
  });

  it.each(WHOLE_ART_CHARACTERS)("fits all six authored parts for %s inside the portrait", (id) => {
    const width = 220;
    const height = 250;
    const layout = characterPortraitLayout(id, width, height);

    expect(layout.map((part) => part.role).sort()).toEqual(
      [...WHOLE_ART_CHARACTER_PART_ROLES].sort(),
    );
    for (const part of layout) {
      expect(Math.abs(part.x) + part.width / 2).toBeLessThanOrEqual(width / 2);
      expect(Math.abs(part.y) + part.height / 2).toBeLessThanOrEqual(height / 2);
    }
  });
});
