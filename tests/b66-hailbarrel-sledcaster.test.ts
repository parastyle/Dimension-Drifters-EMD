import { existsSync, readFileSync } from "node:fs";
import { WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { SPRITES } from "../packages/client/src/sprites/manifest.js";
import { PROJECTILE_SPRITES } from "../packages/client/src/sprites/projectile-manifest.js";
import { GUN_GENERATED_PROJECTILES } from "../packages/client/src/vfx/gun-projectile-art.js";
import {
  HAILBARREL_MUZZLE_FLASH,
  MUZZLE_FLASH_ASSIGNMENTS,
} from "../packages/client/src/vfx/muzzle-flash-catalog.js";
import { WEAPON_ART_MUZZLES } from "../packages/shared/src/weapon-muzzles.generated.js";

const WEAPON_ID = "x2-hailbarrel-sledcaster";
const PROJECTILE_ID = "hailbarrel-sledcaster-ice-puck";

interface HailbarrelConcept {
  readonly id: string;
  readonly theme: string;
  readonly artPrompt: string;
  readonly hitStatus: {
    readonly kind: string;
    readonly multiplier: number;
    readonly seconds: number;
  };
  readonly behavior: {
    readonly bounces: number;
    readonly muzzle: string;
    readonly muzzleColor: number;
  };
}

function sourceConcept(): HailbarrelConcept {
  const source = JSON.parse(
    readFileSync(new URL("../data/weapon-concepts-300.json", import.meta.url), "utf8"),
  ) as { weapons: HailbarrelConcept[] };
  const matches = source.weapons.filter((concept) => concept.id === WEAPON_ID);
  expect(matches).toHaveLength(1);
  const concept = matches[0];
  if (!concept) throw new Error("missing Hailbarrel Sledcaster source concept");
  return concept;
}

describe("B66 Hailbarrel Sledcaster", () => {
  it("ships the specified moderate frost puck-launcher without splash or ricochet", () => {
    const weapon = WEAPONS[WEAPON_ID];
    expect(weapon).toMatchObject({
      name: "Hailbarrel Sledcaster",
      tier: 2,
      damage: 13,
      cooldown: 0.58,
      recoil: 64,
      tags: {
        classPool: "ranged",
        family: "puck-launcher",
        element: "frost",
        rangeBand: "mid",
      },
      hitStatus: { kind: "slow", multiplier: 0.72, seconds: 0.75 },
      gun: {
        damage: 13,
        projectileSpeed: 1250,
        range: 620,
        fireRate: 0.58,
        magazine: 8,
        reloadSeconds: 1.4,
        muzzle: "punch",
        muzzleColor: 0x8feff4,
        recoil: 0.0012,
        projectileArt: "generated",
      },
    });
    expect(weapon?.gun?.explode).toBeUndefined();
    expect(sourceConcept().behavior.bounces).toBe(0);
  });

  it("keeps the generator-facing copy shape-only and free of dangling elements", () => {
    const concept = sourceConcept();
    const visibleCopy = `${concept.theme} ${concept.artPrompt}`.toLowerCase();
    expect(visibleCopy).toContain("squat horizontal cylinder");
    expect(visibleCopy).toContain("bore faces right");
    expect(visibleCopy).not.toMatch(
      /\b(?:rifle|shotgun|pistol|revolver|carbine|musket|crossbow|cannon|brand|model)\b/,
    );
    expect(visibleCopy).not.toMatch(/\b(?:chain|tassel|rope|cord|strap|dangle)\w*\b/);
  });

  it("uses the bespoke painted puck and its right-facing mirror-upright contract", () => {
    expect(GUN_GENERATED_PROJECTILES[WEAPON_ID]).toMatchObject({
      spriteId: PROJECTILE_ID,
      url: "projectiles/hailbarrel-sledcaster-ice-puck.png",
      displayLength: 52,
    });
    expect(PROJECTILE_SPRITES[PROJECTILE_ID]).toEqual({
      url: "projectiles/hailbarrel-sledcaster-ice-puck.png",
      width: 192,
      height: 100,
      source: "generated",
      asymmetric: true,
      facing: "mirror-upright",
    });
    expect(existsSync("packages/client/public/projectiles/hailbarrel-sledcaster-ice-puck.png")).toBe(
      true,
    );
  });

  it("anchors a compact shard flash and frost powder at the painted bore", () => {
    expect(MUZZLE_FLASH_ASSIGNMENTS[WEAPON_ID]).toEqual({
      weaponId: WEAPON_ID,
      variant: "shard",
      frame: 5,
    });
    expect(HAILBARREL_MUZZLE_FLASH).toEqual({
      key: "vfx:hailbarrel-sledcaster-muzzle",
      url: "particles/hailbarrel-sledcaster-muzzle.png",
      originX: 0.25,
    });
    expect(existsSync("packages/client/public/particles/hailbarrel-sledcaster-muzzle.png")).toBe(
      true,
    );
    expect(WEAPON_ART_MUZZLES[WEAPON_ID]).toMatchObject({
      sprite: WEAPON_ID,
      parts: [{ width: 256, height: 80 }],
      points: [{ part: 0, x: 255, y: 26.5, derived: { x: 255, y: 26.5 } }],
    });
    const arenaVfx = readFileSync(
      new URL("../packages/client/src/scenes/arena/vfx.ts", import.meta.url),
      "utf8",
    );
    expect(arenaVfx).toContain('weaponId === "x2-hailbarrel-sledcaster"');
    expect(arenaVfx).toContain('"steel-wisp"');
    expect(SPRITES[WEAPON_ID]).toMatchObject({
      kind: "weapon",
      body: { w: 256, h: 80 },
      parts: [{ file: "part-1.png", w: 256, h: 80 }],
    });
  });
});
