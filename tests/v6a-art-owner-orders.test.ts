import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PROJECTILE_SPRITES } from "../packages/client/src/sprites/projectile-manifest.js";
import { THROWN_GENERATED_PROJECTILES } from "../packages/client/src/vfx/gun-projectile-art.js";
import {
  HEADSMAN_PROTOTYPES,
  headsmanExtensionGeometry,
  headsmanExtensionReveal,
  headsmanPrototypeFromSearch,
  SANCTIFIED_HEADSMAN_LENGTH_MULTIPLIER,
} from "../packages/client/src/vfx/headsman-prototypes.js";
import { PAGE_PROJECTILE_ART } from "../packages/client/src/vfx/page-projectile-art.js";
import { WEAPONS } from "../packages/shared/src/weapons.js";

describe("V6A generated-art owner orders", () => {
  it("keeps four distinct Headsman treatments behind proto=1..4 on one 3x mechanism", () => {
    expect(HEADSMAN_PROTOTYPES).toHaveLength(4);
    expect(new Set(HEADSMAN_PROTOTYPES.map((prototype) => prototype.url)).size).toBe(4);
    for (const prototype of HEADSMAN_PROTOTYPES)
      expect(
        headsmanPrototypeFromSearch(`?dev=weapon:x2-sanctified-headsman&proto=${prototype.proto}`),
      ).toBe(prototype);
    expect(headsmanPrototypeFromSearch("?dev=weapon:x2-sanctified-headsman").proto).toBe(1);

    const headsman = WEAPONS["x2-sanctified-headsman"];
    expect(headsman).toBeDefined();
    if (!headsman) throw new Error("missing Sanctified Headsman fixture");
    const geometry = headsmanExtensionGeometry(headsman);
    expect(geometry.totalBladeLength).toBeCloseTo(
      geometry.physicalBladeLength * SANCTIFIED_HEADSMAN_LENGTH_MULTIPLIER,
    );
    expect(geometry.extensionLength).toBeCloseTo(geometry.physicalBladeLength * 2);
    expect(headsman.range).toBe(160); // prototype visuals do not silently rebalance damage reach
  });

  it("grows the Headsman extension during wind-up and holds it across the active clock", () => {
    const swing = { activeStartSeconds: 0.2, activeEndSeconds: 0.6 };
    expect(headsmanExtensionReveal(swing, 0.01)).toBe(0);
    expect(headsmanExtensionReveal(swing, 0.11)).toBeGreaterThan(0);
    expect(headsmanExtensionReveal(swing, 0.2)).toBe(1);
    expect(headsmanExtensionReveal(swing, 0.4)).toBe(1);
    expect(headsmanExtensionReveal(swing, 0.6)).toBe(0);
  });

  it("swaps the stable Spade id to the generated Gravewarden Buster and only widens its radius", () => {
    expect(WEAPONS["gravediggers-spade"]).toMatchObject({
      id: "gravediggers-spade",
      name: "Gravewarden Buster",
      sprite: "gravewarden-buster",
      range: 210,
      cooldown: 0.6,
      swingArc: Math.PI * 2,
      timingSwingArc: 2.7,
      performance: { hold: "steady", action: "default-swing", frontflip: true },
    });
  });

  it("registers real page images and preserves Verdigris's 7x page scale", () => {
    expect(PAGE_PROJECTILE_ART["x2-twin-whispervolumes"]?.url).toBe(
      "projectiles/twin-whisper-page.png",
    );
    expect(PAGE_PROJECTILE_ART["x2-verdigris-grand-grimoire"]).toMatchObject({
      url: "projectiles/verdigris-grand-page.png",
      scaleMultiplier: 7,
      displayWidth: 98,
    });
  });

  it("registers a generated standalone Coyote projectile instead of the tiled held-art part", () => {
    expect(THROWN_GENERATED_PROJECTILES["x2-coyote-s-grin"]).toMatchObject({
      spriteId: "coyotes-grin-throwing-blade",
      url: "projectiles/coyotes-grin-throwing-blade.png",
    });
    expect(PROJECTILE_SPRITES["coyotes-grin-throwing-blade"].source).toBe("generated");
  });

  it("keeps every thrown payload free of the old blanket yellow-circle overlay", () => {
    const source = readFileSync("packages/client/src/scenes/arena/projectile-factory.ts", "utf8");
    const thrownFactory = source.slice(
      source.indexOf("export function makeThrownWeapon"),
      source.indexOf("export function makeMagma"),
    );
    expect(thrownFactory).not.toMatch(/add\.(?:circle|ellipse)\(/);
    expect(thrownFactory).not.toContain("0xffb23b");
  });
});
