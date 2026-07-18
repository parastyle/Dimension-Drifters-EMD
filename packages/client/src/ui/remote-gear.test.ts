import { encodeGearCosmetics, STARTER_GEAR_LOADOUT } from "@dd/shared";
import { describe, expect, it } from "vitest";
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
