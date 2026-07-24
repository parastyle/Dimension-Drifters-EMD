import { AUTHORED_DUAL_MELEE_BAR, WEAPONS, weaponDisplaySpriteId } from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ default: {} }));

import { SPRITES, type SpriteManifest } from "../sprites/manifest.js";
import { poseSupportHandFor } from "../sprites/pose-language.js";
import {
  authoredDualPistolHandYOffset,
  authoredWeaponRenderPlan,
  DUAL_PISTOL_HAND_RISE_BODY_FRAC,
  routeSwingChannels,
  sampleAuthoredDualCeremony,
} from "./SpriteRig.js";

describe("authored pre-made dual rig presentation", () => {
  it("resolves every catalog dual into two render pieces from its own definition", () => {
    const catalogDuals = Object.values(WEAPONS).filter((weapon) => weapon.tags.grip === "dual");
    const expansionDuals = catalogDuals.filter((weapon) => weapon.id.startsWith("x2-"));

    // The owner's 22-weapon census is the expansion catalog. The legacy twin-bowie-fangs
    // is also catalog-authored and remains covered, bringing the live total to 23.
    expect(expansionDuals).toHaveLength(22);
    expect(catalogDuals.map((weapon) => weapon.id)).toContain("twin-bowie-fangs");

    for (const weapon of catalogDuals) {
      const spriteId = weaponDisplaySpriteId(weapon);
      const manifest = (SPRITES as Record<string, SpriteManifest>)[spriteId];
      expect(manifest, `${weapon.id} manifest`).toBeDefined();
      if (!manifest) continue;

      const plan = authoredWeaponRenderPlan(spriteId, weapon, manifest);
      expect(plan, `${weapon.id} render count`).toHaveLength(2);
      expect(plan[0]?.def, `${weapon.id} lead definition`).toBe(weapon);
      expect(plan[1]?.def, `${weapon.id} off definition`).toBe(weapon);
      expect(plan[0]?.spriteId, `${weapon.id} lead sprite`).toBe(spriteId);
      expect(plan[1]?.spriteId, `${weapon.id} off sprite`).toBe(spriteId);
      expect(manifest.parts[plan[0]?.partIndex ?? 0], `${weapon.id} lead part`).toBeDefined();
      expect(manifest.parts[plan[1]?.partIndex ?? 0], `${weapon.id} off part`).toBeDefined();
    }
  });

  it("routes an authored off beat onto only the rear weapon and hand channels", () => {
    const routed = routeSwingChannels(
      {
        weaponAngle: 1.2,
        backWeaponAngle: Number.NaN,
        swingOffX: 18,
        swingOffY: -7,
        swingBackOffX: 0,
        swingBackOffY: 0,
        ownFront: 0.85,
        ownBack: 0.1,
      },
      1,
      -0.2,
      0.32,
    );

    expect(routed.backWeaponAngle).toBeCloseTo(0.88, 8);
    expect(routed).toMatchObject({
      weaponAngle: -0.2,
      swingOffX: 0,
      swingOffY: 0,
      swingBackOffX: 18,
      swingBackOffY: -7,
      ownFront: 0,
      ownBack: 0.85,
    });
  });

  it("leaves lead and Crossfall samples on their authored channels", () => {
    const sample = {
      weaponAngle: 0.4,
      backWeaponAngle: -0.4,
      swingOffX: 4,
      swingOffY: 5,
      swingBackOffX: -4,
      swingBackOffY: -5,
      ownFront: 1,
      ownBack: 1,
    };

    expect(routeSwingChannels(sample, 0, 0, 0.32)).toBe(sample);
    expect(routeSwingChannels(sample, "both", 0, 0.32)).toBe(sample);
  });

  it("samples the authored equip as a 460ms sequential paper flip and held X", () => {
    const leadFlip = sampleAuthoredDualCeremony(140);
    const crossed = sampleAuthoredDualCeremony(250);
    const release = sampleAuthoredDualCeremony(410);

    expect(leadFlip.active).toBe(true);
    expect(Math.abs(leadFlip.leadScaleX)).toBeLessThan(0.1);
    expect(leadFlip.offScaleX).toBeGreaterThan(0);
    expect(crossed.crossBlend).toBe(1);
    expect(crossed.leadScaleX).toBe(-1);
    expect(crossed.offScaleX).toBe(-1);
    expect(crossed.glintAlpha).toBeGreaterThan(0.9);
    expect(release.crossBlend).toBeCloseTo(0.5, 5);
    expect(release.ruffle).toBeCloseTo(1, 5);
    expect(sampleAuthoredDualCeremony(460).active).toBe(false);
  });

  it("passes the guard job to the non-striking hand on alternating authored beats", () => {
    const firstFour = AUTHORED_DUAL_MELEE_BAR.slice(0, 4);
    expect(firstFour).toEqual(["lead", "off", "lead", "off"]);
    expect(
      firstFour.map((hand: "lead" | "off" | "both") =>
        poseSupportHandFor(hand === "off" ? 1 : 0, true, false, false, false),
      ),
    ).toEqual([1, 0, 1, 0]);
  });

  it("gives Crossfall both hands to the authored attack channels", () => {
    expect(poseSupportHandFor(0, true, false, true, false)).toBe(-1);
    expect(poseSupportHandFor(1, true, false, true, false)).toBe(-1);
  });

  it("raises exactly one hand for an authored dual pistol", () => {
    const weapon = WEAPONS["x2-coyote-stinger"];
    expect(weapon).toBeDefined();
    expect(authoredDualPistolHandYOffset(weapon, 0)).toBe(-DUAL_PISTOL_HAND_RISE_BODY_FRAC);
    expect(authoredDualPistolHandYOffset(weapon, 1)).toBe(0);
    expect(authoredDualPistolHandYOffset(WEAPONS["x-gun-nailgun"], 0)).toBe(0);
  });
});
