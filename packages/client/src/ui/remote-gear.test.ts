import { readFileSync } from "node:fs";
import {
  decodeGearCosmetics,
  encodeGearCosmetics,
  type GearId,
  type GearSlot,
  STARTER_GEAR_LOADOUT,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { replacementPairManifest } from "../sprites/gear-pairs.test-fixture.js";
import { resolveGearBakeLoadout } from "../sprites/gear-parts.js";
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

// GEAR REPLACEMENT BOT 3 — append-only remote recipe/reflection-law proof.
describe("remote replacement recipe identity", () => {
  it("derives identical part keys from identical nested wire strings and prestige", () => {
    const loadout = {
      ...STARTER_GEAR_LOADOUT,
      head: "demon-mask-head" as GearId,
      glasses: "pressurized-glasses" as GearId,
      torso: "pressurized-shirt" as GearId,
    } as Record<GearSlot, GearId>;
    const encoded = encodeGearCosmetics(loadout);
    const local = { dualWield: { ...encoded, prestige: 11 } };
    const remote = {
      gearUpper: "forbidden-top-level-decoy",
      gearLower: "forbidden-top-level-decoy",
      dualWield: { ...encoded, prestige: 11 },
    };
    const manifest = replacementPairManifest("remote-test-r1");
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
