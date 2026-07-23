import { readFileSync } from "node:fs";
import { EXPANSION_WEAPON_IDS, WEAPON_RESOURCE_PROFILES, WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { SPRITES } from "../packages/client/src/sprites/manifest.js";
import { WEAPON_VFX } from "../packages/client/src/vfx/weapon-vfx.generated.js";

const RIFLE_IDS = [
  "x2-gravedog-auto-rifle",
  "x2-stormspur-coil-carbine",
  "x2-brimstone-gallows-rifle",
] as const;

describe("V3X foregrip auto rifles", () => {
  it("resolves all three through catalog, grip, muzzle, sprite, resource, and VFX data", () => {
    for (const id of RIFLE_IDS) {
      const weapon = WEAPONS[id];
      expect(EXPANSION_WEAPON_IDS, id).toContain(id);
      expect(weapon?.tags.family, id).toBe("auto-rifle");
      expect(weapon?.tags.fireMode, id).toBe("auto");
      expect(weapon?.tags.grip, id).toBe("2H");
      expect(weapon?.gripPoints?.secondary?.role, id).toBe("vertical-foregrip");
      expect(weapon?.gun?.muzzle, id).toMatch(/^(rapid|spark|heavy)$/);
      expect(weapon?.gun?.muzzleColor, id).toBeTypeOf("number");
      expect(SPRITES[id]?.parts, id).toHaveLength(1);
      expect(WEAPON_RESOURCE_PROFILES[id], id).toBeDefined();
      expect(Object.keys(WEAPON_VFX[id]?.suite ?? {}).sort(), id).toEqual([
        "muzzle-flash",
        "shell-eject",
        "tracer",
      ]);
    }
  });

  it("publishes art-backed Testing Grounds links for every rifle in the regenerated portal", () => {
    const portal = readFileSync("tools/portal/index.html", "utf8");
    expect(portal).toContain('"count":333');
    for (const id of RIFLE_IDS) {
      expect(portal, id).toContain(`"path":"/?dev=weapon:${id}"`);
      expect(portal, id).toContain(
        `"thumb":"../../packages/client/public/sprites/${id}/part-1.png"`,
      );
    }
  });
});
