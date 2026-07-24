import { WEAPONS } from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ default: {} }));

import {
  gunHandlingMechanismFor,
  resolveBreakActionSecondaryGripPosition,
  resolveSecondaryGripPosition,
  type SecondaryGripTransformInput,
} from "./SpriteRig.js";

describe("SpriteRig Frostbore break attachment", () => {
  const weapon = WEAPONS["x2-frostbore-scattergun"];

  it("joins the generic GunHandlingMechanism family as break", () => {
    expect(gunHandlingMechanismFor(weapon)).toBe("break");
  });

  it("keeps the support hand rigidly registered to the fore-wrap through the hinge stroke", () => {
    if (!weapon?.breakAction || !weapon.gripPoints?.secondary)
      throw new Error("missing Frostbore break grip fixture");
    const input: SecondaryGripTransformInput = {
      primaryX: 40,
      primaryY: 22,
      spriteWidth: 1808,
      spriteHeight: 459,
      scaleX: 0.08,
      scaleY: 0.08,
      rotationRad: -0.2,
      primary: weapon.gripPoints.primary,
      secondary: weapon.gripPoints.secondary,
      flourishForward: 0,
      flourishLateral: 0,
    };
    const closed = resolveBreakActionSecondaryGripPosition(input, weapon.breakAction.hinge, 0, {
      x: 0,
      y: 0,
    });
    const ordinaryClosed = resolveSecondaryGripPosition(input, { x: 0, y: 0 });
    expect(closed.x).toBeCloseTo(ordinaryClosed.x, 9);
    expect(closed.y).toBeCloseTo(ordinaryClosed.y, 9);

    const open = resolveBreakActionSecondaryGripPosition(
      input,
      weapon.breakAction.hinge,
      weapon.breakAction.openAngleRad,
      { x: 0, y: 0 },
    );
    expect(Math.hypot(open.x - closed.x, open.y - closed.y)).toBeGreaterThan(10);

    // Actor facing mirrors X at the root; Y still travels downward for both left and right silhouettes.
    for (const facing of [-1, 1] as const) {
      const closedWorld = { x: closed.x * facing, y: closed.y };
      const openWorld = { x: open.x * facing, y: open.y };
      expect(openWorld.y).toBeGreaterThan(closedWorld.y);
    }
  });
});
