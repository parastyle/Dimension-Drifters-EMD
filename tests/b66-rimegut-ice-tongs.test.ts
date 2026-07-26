import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { MELEE_COMBO_VARIANT_SEQUENCES, WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { SPRITES } from "../packages/client/src/sprites/manifest.js";
import { MUZZLE_FLASH_ASSIGNMENTS } from "../packages/client/src/vfx/muzzle-flash-catalog.js";
import { WEAPON_VFX } from "../packages/client/src/vfx/weapon-vfx.generated.js";

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs") as {
  PNG: {
    sync: {
      read(bytes: Buffer): { width: number; height: number; data: Buffer };
    };
  };
};

const ID = "x2-rimegut-ice-tongs";

function rgba(path: string): { width: number; height: number; data: Buffer } {
  return PNG.sync.read(readFileSync(path));
}

describe("B66 Rimegut Ice-Tongs", () => {
  it("ships the narrow planted two-beat pincer mechanic", () => {
    const weapon = WEAPONS[ID];
    const combo = MELEE_COMBO_VARIANT_SEQUENCES["rimegut-open-and-close"];

    expect(weapon).toMatchObject({
      id: ID,
      damage: 7.2,
      range: 124,
      halfArc: 0.32,
      cooldown: 0.48,
      displayLength: 144,
      collisionLength: 132,
      swingArc: 1.8,
      tags: {
        grip: "2H",
        size: "M",
        delivery: "melee-arc",
        element: "frost",
        classPool: "melee",
        family: "pincer",
      },
      performance: {
        hold: "steady",
        action: "default-swing",
        continuous: true,
        comboForwardPx: 0,
      },
    });
    expect(combo).toHaveLength(2);
    expect(combo?.[0]).toMatchObject({
      motion: "rake",
      path: { kind: "sweep", arcMultiplier: 0.42, damageMultiplier: 0.62 },
    });
    expect(combo?.[1]).toMatchObject({
      motion: "scissor",
      path: {
        kind: "capsule",
        deltaAngle: 0,
        arcMultiplier: 0.18,
        rangeMultiplier: 1.08,
        damageMultiplier: 1.58,
      },
    });
    expect(weapon?.gun).toBeUndefined();
    expect(weapon?.muzzle).toBeUndefined();
    expect(MUZZLE_FLASH_ASSIGNMENTS[ID]).toBeUndefined();
  });

  it("installs one right-facing weapon sprite and its bespoke target-contact VFX", () => {
    expect(SPRITES[ID]).toMatchObject({
      id: ID,
      kind: "weapon",
      parts: [{ role: "part-1", file: "part-1.png", w: 256, h: 89 }],
    });
    expect(WEAPON_VFX[ID]).toMatchObject({
      suite: {
        "hero-skin": {
          on: true,
          params: { size: 1, rise: 0 },
        },
      },
      rot: 0,
      vfxRadius: 52,
      hero: "vfx/x2-rimegut-ice-tongs.png",
      suppressFallback: true,
    });

    const sprite = rgba("packages/client/public/sprites/x2-rimegut-ice-tongs/part-1.png");
    const vfx = rgba("packages/client/public/vfx/x2-rimegut-ice-tongs.png");
    expect({ width: sprite.width, height: sprite.height }).toEqual({ width: 256, height: 89 });
    expect({ width: vfx.width, height: vfx.height }).toEqual({ width: 528, height: 379 });

    for (const image of [sprite, vfx]) {
      const cornerAlpha = [
        image.data[3],
        image.data[(image.width - 1) * 4 + 3],
        image.data[((image.height - 1) * image.width) * 4 + 3],
        image.data[(image.width * image.height - 1) * 4 + 3],
      ];
      expect(cornerAlpha).toEqual([0, 0, 0, 0]);
      let keyedGreen = 0;
      for (let offset = 0; offset < image.data.length; offset += 4) {
        const red = image.data[offset] ?? 0;
        const green = image.data[offset + 1] ?? 0;
        const blue = image.data[offset + 2] ?? 0;
        const alpha = image.data[offset + 3] ?? 0;
        if (alpha > 24 && green > 140 && green - Math.max(red, blue) > 70) keyedGreen++;
      }
      expect(keyedGreen).toBe(0);
    }

    let cyan = 0;
    let white = 0;
    for (let offset = 0; offset < vfx.data.length; offset += 4) {
      const red = vfx.data[offset] ?? 0;
      const green = vfx.data[offset + 1] ?? 0;
      const blue = vfx.data[offset + 2] ?? 0;
      const alpha = vfx.data[offset + 3] ?? 0;
      if (alpha <= 24) continue;
      if (green > 105 && blue > 120 && blue > red + 20) cyan++;
      if (red > 210 && green > 210 && blue > 210) white++;
    }
    expect(cyan).toBeGreaterThan(10_000);
    expect(white).toBeGreaterThan(250);
  });
});
