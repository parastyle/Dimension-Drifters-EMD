import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  breakActionNominalDps,
  isBreakActionWeapon,
  sampleBreakActionClock,
  TICK_MS,
  WEAPONS,
  weaponMuzzleWorldPointsForShot,
} from "@dd/shared";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const weaponId = "x2-frostbore-scattergun";
const workspace = process.cwd();

describe("B32 Frostbore registered sprite surgery", () => {
  it("recomposites the two registered canvases to the harvested source with zero RGBA diff", async () => {
    const referencePath = resolve(
      workspace,
      "tools/artkit/fixtures/x2-frostbore-scattergun-closed.png",
    );
    const spriteDir = resolve(workspace, "packages/client/public/sprites/x2-frostbore-scattergun");
    const [reference, part1, part2] = await Promise.all([
      sharp(await readFile(referencePath))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true }),
      readFile(resolve(spriteDir, "part-1.png")),
      readFile(resolve(spriteDir, "part-2.png")),
    ]);
    const composite = await sharp({
      create: {
        width: reference.info.width,
        height: reference.info.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: part1 }, { input: part2 }])
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    expect([composite.info.width, composite.info.height]).toEqual([1808, 459]);
    let differingChannels = 0;
    let maximumDelta = 0;
    for (let index = 0; index < reference.data.length; index++) {
      const delta = Math.abs((reference.data[index] ?? 0) - (composite.data[index] ?? 0));
      if (delta > 0) differingChannels++;
      maximumDelta = Math.max(maximumDelta, delta);
    }
    expect({ differingChannels, maximumDelta }).toEqual({
      differingChannels: 0,
      maximumDelta: 0,
    });
  });
});

describe("B32 Frostbore cadence and authoritative break clock", () => {
  const weapon = WEAPONS[weaponId];

  it("is a two-shell 30-degree break gun at the prior 60 DPS nominal", () => {
    expect(isBreakActionWeapon(weapon)).toBe(true);
    if (!isBreakActionWeapon(weapon)) throw new Error("missing Frostbore break-action fixture");
    expect(weapon.gun.magazine).toBe(2);
    expect(weapon.gun.damage).toBe(7);
    expect(weapon.gun.pellets).toBe(6);
    expect(weapon.gun.fireRate).toBe(0.5);
    expect(weapon.gun.reloadSeconds).toBe(0.9);
    expect(weapon.breakAction.openAngleRad).toBeCloseTo(Math.PI / 6, 9);
    expect(breakActionNominalDps(weapon)).toBeCloseTo(60, 9);
    expect(Math.abs(breakActionNominalDps(weapon) / 60 - 1)).toBeLessThanOrEqual(0.1);
  });

  it("derives open, eject, close, and ready solely from replicated ticks and charges", () => {
    if (!isBreakActionWeapon(weapon)) throw new Error("missing Frostbore break-action fixture");
    const acceptedTick = 1_000;
    const totalTicks = Math.round((weapon.gun.reloadSeconds * 1_000) / TICK_MS);
    const opening = sampleBreakActionClock(weapon, acceptedTick, acceptedTick + 3, 0, 2);
    const eject = sampleBreakActionClock(weapon, acceptedTick, acceptedTick + 7, 0, 2);
    const closing = sampleBreakActionClock(weapon, acceptedTick, acceptedTick + 12, 0, 2);
    const ready = sampleBreakActionClock(weapon, acceptedTick, acceptedTick + totalTicks, 2, 2);

    expect(totalTicks).toBe(18);
    expect(opening.phase).toBe("opening");
    expect(opening.angleRad).toBeGreaterThan(0);
    expect(opening.muzzleAllowed).toBe(false);
    expect(eject.phase).toBe("eject");
    expect(eject.angleRad).toBeCloseTo(Math.PI / 6, 9);
    expect(eject.ejectStrength).toBeGreaterThan(0);
    expect(eject.muzzleAllowed).toBe(false);
    expect(closing.phase).toBe("closing");
    expect(closing.angleRad).toBeGreaterThan(0);
    expect(closing.angleRad).toBeLessThan(eject.angleRad);
    expect(ready).toMatchObject({
      active: false,
      angleRad: 0,
      muzzleAllowed: true,
      phase: "closed",
    });
  });

  it("cycles the two registered bore points and keeps either facing ahead of the wielder", () => {
    if (!isBreakActionWeapon(weapon)) throw new Error("missing Frostbore break-action fixture");
    expect(weapon.muzzle?.barrelMode).toBe("cycle");
    expect(weapon.muzzle?.points).toHaveLength(2);
    expect(new Set(weapon.muzzle?.points.map((point) => point.part))).toEqual(new Set([1]));
    for (const facing of [-1, 1] as const) {
      const first = weaponMuzzleWorldPointsForShot(
        weapon,
        { x: 500, y: 400, aimX: facing, aimY: 0, facing },
        1,
      )[0];
      const second = weaponMuzzleWorldPointsForShot(
        weapon,
        { x: 500, y: 400, aimX: facing, aimY: 0, facing },
        2,
      )[0];
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      expect(((first?.x ?? 500) - 500) * facing).toBeGreaterThan(0);
      expect(((second?.x ?? 500) - 500) * facing).toBeGreaterThan(0);
      expect(first?.y).not.toBeCloseTo(second?.y ?? 0, 4);
    }
  });
});
