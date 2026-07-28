import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  composeWeaponTransform,
  meleeReach,
  WEAPONS,
  type WeaponDef,
  weaponMuzzleWorldPoint,
  weaponSpriteTransform,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { SPRITES, spriteImageFacingX } from "../packages/client/src/sprites/manifest.js";

const SIZE_ORDERS = [
  {
    id: "x2-idol-of-the-pale-verdict",
    before: 148,
    after: 207.2,
    multiplier: 1.4,
    damage: 11,
    range: 140,
    reachFollowsArt: true,
  },
  {
    id: "x-sword-whirlwind",
    before: 118,
    after: 236,
    multiplier: 2,
    damage: 9,
    range: 150,
    reachFollowsArt: true,
  },
  {
    id: "x2-mournveil-scythe",
    before: 280,
    after: 364,
    multiplier: 1.3,
    damage: 14,
    range: 250,
    reachFollowsArt: false,
  },
  {
    id: "x2-gravewind-rimfire",
    before: 54,
    after: 108,
    multiplier: 2,
    damage: 7,
    range: 80,
    reachFollowsArt: false,
  },
] as const;

const EXPECTED_ASSET_DIMENSIONS = {
  "x2-idol-of-the-pale-verdict": { width: 256, height: 176 },
  "x-sword-whirlwind": { width: 256, height: 90 },
  "x2-mournveil-scythe": { width: 728, height: 364 },
  "x2-gravewind-rimfire": { width: 256, height: 99 },
  "x2-prismhex-diffraction-gauntlet": { width: 256, height: 162 },
} as const;

const MOURNVEIL_PRE_RESTORATION_MANIFEST = {
  canvas: { w: 261, h: 261 },
  body: { cx: 171.22, cy: 128, w: 256, h: 128 },
  part: {
    role: "part-1",
    file: "part-1.png",
    w: 256,
    h: 128,
    cx: 171.22,
    cy: 128,
    ox: 0,
    oy: 0,
  },
} as const;
const MOURNVEIL_REGISTRATION_TOLERANCE_PX = 1;

const RIG_SOURCE = readFileSync(
  new URL("../packages/client/src/entities/rig/rig-gear.ts", import.meta.url),
  "utf8",
);
const HARVEST_SOURCE = readFileSync(
  new URL("../tools/artkit/harvest-install.mjs", import.meta.url),
  "utf8",
);

describe("B9 weapon size orders", () => {
  /**
   * SUPERSEDED 2026-07-27 — B9 shipped these as PRESENTATION-ONLY: art scaled, `collisionLength`
   * pinned at the pre-order length, reach deliberately unchanged. The owner reversed that after
   * measuring the result on the Dervish Greatblade: 236px of drawn blade against a 150px hitbox,
   * 57.7px of dead tip. Ruling: "art is truth" — the drawn edge must hit.
   *
   * So the size multiplier and the untouched damage/range are still contracts, but the pinned
   * collision datum is NOT: these weapons now derive reach from their art like the other ~220 melee
   * weapons, which is also what stops the next resize from silently leaving the hitbox behind.
   * `weapon-reach-truth.test.ts` is the standing guard for that invariant.
   */
  it.each(SIZE_ORDERS)("$id is exactly $multiplier× larger, with damage and range untouched", ({
    id,
    before,
    after,
    multiplier,
    damage,
    range,
  }) => {
    const weapon = WEAPONS[id];
    expect(weapon, id).toBeDefined();
    if (!weapon) return;
    expect(weapon.displayLength, `${id} exact visual length`).toBe(after);
    expect(weapon.displayLength / before, `${id} exact multiplier`).toBe(multiplier);
    expect(weapon.damage, `${id} base damage`).toBe(damage);
    expect(weapon.range, `${id} base range`).toBe(range);
  });

  it.each(
    SIZE_ORDERS.filter((order) => order.reachFollowsArt),
  )("$id now reaches its drawn tip (owner ruling supersedes B9's collision pin)", ({
    id,
    before,
  }) => {
    const weapon = WEAPONS[id];
    expect(weapon, id).toBeDefined();
    if (!weapon) return;
    // The pre-order collision pin is gone; reach derives from displayLength like ~220 other melee.
    expect(weapon.collisionLength, `${id} no longer pins a stale collision datum`).toBeUndefined();
    const drawnTip = (1 - weapon.gripFrac) * weapon.displayLength;
    expect(meleeReach(weapon), `${id} reach covers its drawn tip`).toBeGreaterThanOrEqual(
      drawnTip - 0.5,
    );
    // Strictly longer than the superseded presentation-only reach — this IS the balance change.
    const pinned = { ...weapon, collisionLength: before } as WeaponDef;
    expect(meleeReach(weapon), `${id} out-reaches the B9 presentation-only value`).toBeGreaterThan(
      meleeReach(pinned),
    );
  });

  it.each(
    SIZE_ORDERS.filter((order) => !order.reachFollowsArt),
  )("$id keeps its B9 presentation-only contract (art already covered by range, or not melee)", ({
    id,
  }) => {
    const weapon = WEAPONS[id];
    expect(weapon, id).toBeDefined();
    if (!weapon) return;
    // These were NOT reversed: the scythe's authored range already covers its art, and Gravewind is
    // a gun whose muzzle datum — not melee reach — is the thing its size order had to preserve.
    const drawnTip = (1 - weapon.gripFrac) * weapon.displayLength;
    if (!weapon.gun) {
      expect(meleeReach(weapon), `${id} art was never unreachable`).toBeGreaterThanOrEqual(
        drawnTip - 0.5,
      );
    }
  });

  it("preserves each non-sprite gameplay mechanic at its pre-order value", () => {
    expect(WEAPONS["x2-idol-of-the-pale-verdict"]?.quake).toMatchObject({
      radius: 140,
      damage: 11,
    });
    expect(WEAPONS["x2-gravewind-rimfire"]?.gun).toMatchObject({
      damage: 12,
      range: 660,
    });
    expect(WEAPONS["x2-mournveil-scythe"]?.swingArc).toBe(Math.PI * 2);
    expect(WEAPONS["x-sword-whirlwind"]?.swingArc).toBe(Math.PI * 4);
  });

  it("keeps Gravewind's canonical projectile origin at its pre-order collision length", () => {
    const weapon = WEAPONS["x2-gravewind-rimfire"];
    if (!weapon) throw new Error("Gravewind Rimfire fixture is required");
    const pose = { x: 120, y: 240, aimX: 1, aimY: 0, facing: 1 as const };
    const preOrder = {
      ...weapon,
      displayLength: 54,
      collisionLength: undefined,
    } as WeaponDef;
    expect(weaponMuzzleWorldPoint(weapon, pose)).toEqual(weaponMuzzleWorldPoint(preOrder, pose));
  });

  it("changes no installed bitmap dimensions for any B9 subject", () => {
    for (const [id, expected] of Object.entries(EXPECTED_ASSET_DIMENSIONS)) {
      const part = SPRITES[id as keyof typeof SPRITES]?.parts[0];
      expect(part, id).toBeDefined();
      expect({ width: part?.w, height: part?.h }, id).toEqual(expected);
    }
  });
});

describe("B9 Mournveil native-resolution restoration", () => {
  it("retains 364 display length and the pre-order 280 collision datum", () => {
    const mournveil = WEAPONS["x2-mournveil-scythe"];
    expect(mournveil.displayLength).toBe(364);
    expect(mournveil.collisionLength).toBe(280);
    expect(mournveil.damage).toBe(14);
    expect(mournveil.range).toBe(250);
    expect(mournveil.cooldown).toBe(0.82);
    expect(mournveil.swingArc).toBe(Math.PI * 2);
  });

  it("ships a true 2x-density held sprite through the generated manifest", () => {
    const mournveil = SPRITES["x2-mournveil-scythe"];
    const part = mournveil.parts[0];
    const bitmap = readFileSync(
      new URL("../packages/client/public/sprites/x2-mournveil-scythe/part-1.png", import.meta.url),
    );

    expect(part.role).toBe(MOURNVEIL_PRE_RESTORATION_MANIFEST.part.role);
    expect(part.file).toBe(MOURNVEIL_PRE_RESTORATION_MANIFEST.part.file);
    expect({ width: bitmap.readUInt32BE(16), height: bitmap.readUInt32BE(20) }).toEqual({
      width: 728,
      height: 364,
    });
    expect({ width: part.w, height: part.h }).toEqual({ width: 728, height: 364 });
    expect(part.w / WEAPONS["x2-mournveil-scythe"].displayLength).toBe(2);
  });

  it("keeps manifest grip and blade-edge registration within one display pixel", () => {
    const before = MOURNVEIL_PRE_RESTORATION_MANIFEST;
    const after = SPRITES["x2-mournveil-scythe"];
    const part = after.parts[0];
    const displayLength = WEAPONS["x2-mournveil-scythe"].displayLength;
    const displayDelta = (beforeFraction: number, afterFraction: number) =>
      Math.abs(afterFraction - beforeFraction) * displayLength;

    expect(
      displayDelta(before.body.cx / before.canvas.w, after.body.cx / after.canvas.w),
    ).toBeLessThanOrEqual(MOURNVEIL_REGISTRATION_TOLERANCE_PX);
    expect(
      displayDelta(before.body.cy / before.canvas.h, after.body.cy / after.canvas.h),
    ).toBeLessThanOrEqual(MOURNVEIL_REGISTRATION_TOLERANCE_PX);
    expect(
      displayDelta(before.part.w / before.canvas.w, part.w / after.canvas.w),
    ).toBeLessThanOrEqual(MOURNVEIL_REGISTRATION_TOLERANCE_PX);
    expect(
      displayDelta(before.part.h / before.canvas.h, part.h / after.canvas.h),
    ).toBeLessThanOrEqual(MOURNVEIL_REGISTRATION_TOLERANCE_PX);

    const gripBefore = {
      x: WEAPONS["x2-mournveil-scythe"].gripFrac * displayLength,
      y: (before.part.h / before.part.w) * displayLength * 0.5,
    };
    const gripAfter = {
      x: WEAPONS["x2-mournveil-scythe"].gripFrac * displayLength,
      y: (part.h / part.w) * displayLength * 0.5,
    };
    expect(Math.abs(gripAfter.x - gripBefore.x)).toBeLessThanOrEqual(
      MOURNVEIL_REGISTRATION_TOLERANCE_PX,
    );
    expect(Math.abs(gripAfter.y - gripBefore.y)).toBeLessThanOrEqual(
      MOURNVEIL_REGISTRATION_TOLERANCE_PX,
    );

    const bladeEdgesBefore = {
      left: -gripBefore.x,
      right: displayLength - gripBefore.x,
    };
    const bladeEdgesAfter = {
      left: -gripAfter.x,
      right: displayLength - gripAfter.x,
    };
    expect(Math.abs(bladeEdgesAfter.left - bladeEdgesBefore.left)).toBeLessThanOrEqual(
      MOURNVEIL_REGISTRATION_TOLERANCE_PX,
    );
    expect(Math.abs(bladeEdgesAfter.right - bladeEdgesBefore.right)).toBeLessThanOrEqual(
      MOURNVEIL_REGISTRATION_TOLERANCE_PX,
    );
    expect({ ox: part.ox, oy: part.oy }).toEqual({
      ox: before.part.ox,
      oy: before.part.oy,
    });
  });
});

describe("B35 Prismhex correct actor-facing mirror axis", () => {
  it("retains the exact installed gauntlet bitmap instead of regenerating a similar subject", () => {
    const bitmap = readFileSync(
      new URL(
        "../packages/client/public/sprites/x2-prismhex-diffraction-gauntlet/part-1.png",
        import.meta.url,
      ),
    );
    expect(createHash("sha256").update(bitmap).digest("hex")).toBe(
      "6bb02a389afce46517ca621e5a62456fc55f8561367d3c5eb06424e6304336f3",
    );
  });

  it("removes the erroneous local mirror and leaves actor-facing as the only mirror axis", () => {
    const prismhex = SPRITES["x2-prismhex-diffraction-gauntlet"];
    expect(prismhex.imageFacing).toBeUndefined();
    expect(spriteImageFacingX(prismhex.imageFacing)).toBe(1);
    expect(spriteImageFacingX(undefined)).toBe(1);
    expect(HARVEST_SOURCE).not.toContain('"x2-prismhex-diffraction-gauntlet": "mirror-x"');
    expect(RIG_SOURCE.match(/weapon\.img\.scaleX \*= weapon\.imageFacingX/g)).toHaveLength(1);
    expect(RIG_SOURCE).not.toContain("weapon.img.scaleY *= weapon.imageFacingX");
  });

  it.each([
    1, -1,
  ] as const)("mirrors once with actor facing %i while the painted Y axis remains upright", (actorFacing) => {
    const imageFacingX = spriteImageFacingX(
      SPRITES["x2-prismhex-diffraction-gauntlet"].imageFacing,
    );
    const root = weaponSpriteTransform({
      x: 0,
      y: 0,
      originX: 0,
      originY: 0,
      rotation: 0,
      scaleX: actorFacing,
      scaleY: 1,
    });
    const image = weaponSpriteTransform({
      x: 0,
      y: 0,
      originX: 0,
      originY: 0,
      rotation: 0,
      scaleX: imageFacingX,
      scaleY: 1,
    });
    const screen = composeWeaponTransform(root, image);
    expect(screen.a, "one actor-facing X mirror").toBe(actorFacing);
    expect(screen.d, "no vertical inversion").toBe(1);
    expect(Math.sign(screen.a * screen.d - screen.b * screen.c), "composed handedness").toBe(
      actorFacing,
    );
  });
});
