import { readFileSync } from "node:fs";
import {
  decodeGearCosmetics,
  encodeGearCosmetics,
  type GearId,
  type GearSlot,
  STARTER_GEAR_LOADOUT,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  GEAR_PARTS_MANIFEST,
  type GearPartsManifest,
  resolveGearBakeLoadout,
  validateGearPartsManifest,
} from "../sprites/gear-parts.js";
import { syncRemoteGearLoadouts } from "./remote-gear.js";

describe("remote gear data plumb", () => {
  it("decodes synced ids without constructing or mutating a rig", () => {
    const loadout = { ...STARTER_GEAR_LOADOUT, hat: "ash-walker-hat" as const };
    const encoded = encodeGearCosmetics(loadout);
    const cache = new Map();
    syncRemoteGearLoadouts(cache, [["remote", { ...encoded, prestige: 0 }]]);
    expect(cache.get("remote")).toMatchObject({ hat: "ash-walker-hat" });
    syncRemoteGearLoadouts(cache, []);
    expect(cache.size).toBe(0);
  });
});

// METAGAME WAVE 6 — append-only public prestige projection coverage.
describe("remote prestige data plumb", () => {
  it("retains and bounds the public count beside the decoded cosmetic row", () => {
    const encoded = encodeGearCosmetics(STARTER_GEAR_LOADOUT);
    const cache = new Map();
    syncRemoteGearLoadouts(cache, [["remote", { ...encoded, prestige: 7 }]]);
    expect(cache.get("remote")).toMatchObject({ prestige: 7, hat: "blank-drifter-hat" });
    syncRemoteGearLoadouts(cache, [["remote", { ...encoded, prestige: 999 }]]);
    expect(cache.get("remote")?.prestige).toBe(30);
  });
});

function replacementManifest(): GearPartsManifest {
  if (!GEAR_PARTS_MANIFEST) throw new Error("real gear manifest failed validation");
  const candidate = structuredClone(GEAR_PARTS_MANIFEST);
  candidate.schemaVersion = 2;
  candidate.replacementContract = {
    id: "GEAR_REPLACEMENT_V1",
    revision: "remote-test-r1",
    partFrames: {
      body: [344, 324, 336, 376],
      head: [352, 112, 384, 456],
      "hand-l": [294, 432, 180, 180],
      "hand-r": [550, 432, 180, 180],
      "foot-l": [353, 641, 190, 190],
      "foot-r": [481, 641, 190, 190],
    },
    maskHashes: {
      bodyFill: "body-fill",
      shirtRequired: "shirt-required",
      shirtAllowed: "shirt-allowed",
      pantsRequired: "pants-required",
      pantsAllowed: "pants-allowed",
    },
    compositionOrders: {
      body: ["body", "pants", "shirt"],
      head: ["head", "facialHair", "glasses"],
    },
  };
  const roleForSlot = {
    boots: "replace-foot",
    cloak: "cloak-far",
    facialHair: "head-accessory",
    glasses: "head-accessory",
    gloves: "replace-hand",
    hat: "overlay-hat",
    pants: "body-patch",
    shirt: "body-patch",
  } as const;
  for (const slot of candidate.slots) {
    for (const item of slot.items) {
      item.renderRole =
        item.id === "demon-mask-hat" || item.id === "unbending-hat"
          ? "replace-head"
          : roleForSlot[slot.id];
      item.sourceRevision = `source:${item.id}`;
      for (const part of item.parts) part.sourceRevision = `source:${item.id}:${part.id}`;
      if (item.renderRole === "replace-head") {
        item.replacementTexture = {
          texture: `${item.id}.png`,
          sourceRevision: `head:${item.id}`,
        };
      }
    }
  }
  const validated = validateGearPartsManifest(candidate);
  if (!validated) throw new Error("synthetic replacement manifest failed validation");
  return validated;
}

// GEAR REPLACEMENT BOT 3 — append-only remote recipe/reflection-law proof.
describe("remote replacement recipe identity", () => {
  it("derives identical part keys from identical nested wire strings and prestige", () => {
    const loadout = {
      ...STARTER_GEAR_LOADOUT,
      hat: "demon-mask-hat" as GearId,
      glasses: "pressurized-glasses" as GearId,
      shirt: "pressurized-shirt" as GearId,
    } as Record<GearSlot, GearId>;
    const encoded = encodeGearCosmetics(loadout);
    const local = { dualWield: { ...encoded, prestige: 11 } };
    const remote = {
      gearUpper: "forbidden-top-level-decoy",
      gearLower: "forbidden-top-level-decoy",
      dualWield: { ...encoded, prestige: 11 },
    };
    const manifest = replacementManifest();
    const keysFor = (player: typeof local | typeof remote) => {
      const gearUpper = player.dualWield?.gearUpper ?? "";
      const gearLower = player.dualWield?.gearLower ?? "";
      const prestige = player.dualWield?.prestige ?? 0;
      const decoded = decodeGearCosmetics(gearUpper, gearLower) as Record<GearSlot, GearId>;
      const resolved = resolveGearBakeLoadout(manifest, decoded, prestige);
      return Object.values(resolved.recipe.parts).map((part) => part.key);
    };

    expect(keysFor(remote)).toEqual(keysFor(local));
    const arenaSource = readFileSync(new URL("../scenes/ArenaScene.ts", import.meta.url), "utf8");
    expect(arenaSource).toContain('player.dualWield?.gearUpper ?? ""');
    expect(arenaSource).toContain('player.dualWield?.gearLower ?? ""');
    const executableLines = arenaSource
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//"))
      .join("\n");
    expect(executableLines).not.toMatch(/player\.gear(?:Upper|Lower)/);
  });
});
