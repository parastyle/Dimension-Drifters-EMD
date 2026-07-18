import { readFileSync } from "node:fs";
import type { PetId, PetStageBand } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { assemblePetStage, type PetPartsManifest, petManifestStage } from "./pet-parts.js";

const manifest = JSON.parse(
  readFileSync(
    new URL("../../public/sprites/pets/pet-parts-manifest.json", import.meta.url),
    "utf8",
  ),
) as PetPartsManifest;

describe("pet part manifest assembly", () => {
  it("normalizes all 24 forms to their authored head-scale envelopes", () => {
    const envelopes = [0, 30, 37, 44] as const;
    expect(manifest.socketFrame.id).toBe("PET_SOCKET_FRAME_V1");
    expect(manifest.pets).toHaveLength(8);
    for (const pet of manifest.pets) {
      for (const stage of pet.stages) {
        const assembly = assemblePetStage(stage);
        expect(assembly.parts.length, `${pet.id}/s${stage.stage}`).toBeGreaterThanOrEqual(2);
        expect(assembly.parts.length, `${pet.id}/s${stage.stage}`).toBeLessThanOrEqual(4);
        expect(Math.max(assembly.width, assembly.height), `${pet.id}/s${stage.stage}`).toBeCloseTo(
          envelopes[stage.stage],
          8,
        );
        expect(assembly.parts.every((part) => Number.isFinite(part.x + part.y + part.scale))).toBe(
          true,
        );
        const body = assembly.parts.find((part) => part.source.id === "body");
        expect(body?.x).toBe(0);
        expect(body?.y).toBe(0);
      }
    }
  });

  it("maps raw body sockets and a child tail-tip socket into the body-root frame", () => {
    const wingStage = petManifestStage(manifest, "verdant-wing", 3);
    expect(wingStage).toBeDefined();
    if (!wingStage) throw new Error("Verdant Wing stage 3 is absent");
    const wingAssembly = assemblePetStage(wingStage);
    const nearWing = wingAssembly.parts.find((part) => part.source.id === "near-wing");
    expect(nearWing).toBeDefined();
    if (!nearWing) throw new Error("Verdant Wing near-wing is absent");
    expect(nearWing.x / wingAssembly.scale).toBeCloseTo(499.2 - 512, 8);
    expect(nearWing.y / wingAssembly.scale).toBeCloseTo(545.84 - 510, 8);

    const geckoStage = petManifestStage(manifest, "gilded-gecko" as PetId, 3 as PetStageBand);
    expect(geckoStage).toBeDefined();
    if (!geckoStage) throw new Error("Gilded Gecko stage 3 is absent");
    const geckoAssembly = assemblePetStage(geckoStage);
    const pan = geckoAssembly.parts.find((part) => part.source.id === "balance-pan");
    expect(pan).toBeDefined();
    if (!pan) throw new Error("Gilded Gecko balance-pan is absent");
    expect(pan.x / geckoAssembly.scale).toBeCloseTo(-0.45 * 256 + 0.42 * 256, 8);
    expect(pan.y / geckoAssembly.scale).toBeCloseTo(0.05 * 256, 8);
  });
});
