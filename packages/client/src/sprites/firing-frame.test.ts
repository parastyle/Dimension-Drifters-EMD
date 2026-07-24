import { transformWeaponArtPoint, WEAPONS, weaponSpriteTransform } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  FIRING_FRAME_RELEASE_WINDOW_MS,
  firingFrameSpriteAt,
  resolveWeaponFiringFrame,
} from "./firing-frame.js";
import { SPRITES } from "./manifest.js";

const WYRM_ID = "x2-wyrmskull-reliquary";
const OPEN_ID = "x2-wyrmskull-reliquary-open";

describe("weapon firing-frame attack clock", () => {
  it("is closed at idle, open exactly inside the authoritative release window, then closed", () => {
    const weapon = WEAPONS[WYRM_ID];
    expect(weapon?.firingFrame).toBe(OPEN_ID);
    const acceptedTick = 1_000;

    expect(FIRING_FRAME_RELEASE_WINDOW_MS).toBe(150);
    expect(firingFrameSpriteAt(weapon, undefined, acceptedTick)).toBeUndefined();
    expect(firingFrameSpriteAt(weapon, acceptedTick, undefined)).toBeUndefined();
    expect(firingFrameSpriteAt(weapon, acceptedTick, acceptedTick - 1)).toBeUndefined();
    expect(firingFrameSpriteAt(weapon, acceptedTick, acceptedTick)).toBe(OPEN_ID);
    expect(firingFrameSpriteAt(weapon, acceptedTick, acceptedTick + 2)).toBe(OPEN_ID);
    expect(firingFrameSpriteAt(weapon, acceptedTick, acceptedTick + 3)).toBeUndefined();
    expect(firingFrameSpriteAt(weapon, acceptedTick, acceptedTick + 500)).toBeUndefined();
  });

  it("never swaps a weapon without registered firing-frame metadata", () => {
    const ordinaryWeapon = WEAPONS["x2-wyrmscale-hex-talon"];
    expect(ordinaryWeapon?.firingFrame).toBeUndefined();
    expect(firingFrameSpriteAt(ordinaryWeapon, 1_000, 1_020)).toBeUndefined();
  });

  it("registers the high-resolution open frame to the same grip without scale or facing drift", () => {
    const weapon = WEAPONS[WYRM_ID];
    if (!weapon) throw new Error("missing Wyrmskull fixture");
    const resolved = resolveWeaponFiringFrame(weapon, WYRM_ID);
    if (!resolved) throw new Error("missing registered Wyrmskull firing frame");
    const closedPart = SPRITES[WYRM_ID].parts[0];
    const openPart = resolved.manifest.parts[0];
    if (!closedPart || !openPart) throw new Error("missing Wyrmskull sprite part");

    const closedOriginX = weapon.gripFrac * closedPart.w;
    const closedOriginY = closedPart.h * 0.5;
    const openOriginX = resolved.registration.originX * openPart.w;
    const openOriginY = resolved.registration.originY * openPart.h;
    expect(openOriginX / resolved.registration.sourceScale).toBeCloseTo(closedOriginX, 10);
    expect(openOriginY / resolved.registration.sourceScale).toBeCloseTo(closedOriginY, 10);

    const closedScale = weapon.displayLength / closedPart.w;
    const openScale = closedScale / resolved.registration.sourceScale;
    expect(openPart.w * openScale).toBeCloseTo(closedPart.w * closedScale, 10);

    const muzzle = weapon.muzzle?.points[0];
    if (!muzzle) throw new Error("missing Wyrmskull mouth muzzle");
    for (const facing of [-1, 1] as const) {
      const closedTransform = weaponSpriteTransform({
        x: 12,
        y: -8,
        originX: closedOriginX,
        originY: closedOriginY,
        rotation: 0.37,
        scaleX: closedScale * facing,
        scaleY: closedScale,
      });
      const openTransform = weaponSpriteTransform({
        x: 12,
        y: -8,
        originX: openOriginX,
        originY: openOriginY,
        rotation: 0.37,
        scaleX: openScale * facing,
        scaleY: openScale,
      });
      const closedMuzzle = transformWeaponArtPoint(muzzle, closedTransform);
      const openMuzzle = transformWeaponArtPoint(
        {
          x: muzzle.x * resolved.registration.sourceScale,
          y: muzzle.y * resolved.registration.sourceScale,
        },
        openTransform,
      );
      expect(openMuzzle.x).toBeCloseTo(closedMuzzle.x, 10);
      expect(openMuzzle.y).toBeCloseTo(closedMuzzle.y, 10);
    }
  });
});
