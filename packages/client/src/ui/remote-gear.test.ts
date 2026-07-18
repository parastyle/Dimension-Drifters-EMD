import { encodeGearCosmetics, STARTER_GEAR_LOADOUT } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { syncRemoteGearLoadouts } from "./remote-gear.js";

describe("remote gear data plumb", () => {
  it("decodes synced ids without constructing or mutating a rig", () => {
    const loadout = { ...STARTER_GEAR_LOADOUT, hat: "ash-walker-hat" as const };
    const encoded = encodeGearCosmetics(loadout);
    const cache = new Map();
    syncRemoteGearLoadouts(cache, [["remote", encoded]]);
    expect(cache.get("remote")).toMatchObject({ hat: "ash-walker-hat" });
    syncRemoteGearLoadouts(cache, []);
    expect(cache.size).toBe(0);
  });
});
