import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  authoredDualShowcaseVerticalOffset,
  WEAPONS,
  weaponHasHandlingTag,
  weaponMuzzleGripOffset,
} from "../packages/shared/src/index.js";

vi.mock("phaser", () => ({ default: {} }));

function weapon(id: string) {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`missing B48 fixture ${id}`);
  return definition;
}

describe("B48 gun mechanism census and ownership", () => {
  it("moves the deliberate pump, lever, fan, and B63 bolt pins together", () => {
    const definitions = Object.values(WEAPONS);
    const tagged = (tag: "pump" | "lever" | "revolver") =>
      definitions.filter((definition) => weaponHasHandlingTag(definition, tag));

    expect(tagged("pump")).toHaveLength(11);
    expect(tagged("lever")).toHaveLength(10);
    expect(tagged("revolver")).toHaveLength(19);
    expect(
      definitions.filter((definition) =>
        (["break", "bolt", "lever", "pump"] as const).some((tag) =>
          weaponHasHandlingTag(definition, tag),
        ),
      ),
    ).toHaveLength(30);
  });

  it("routes Hallowbore to the B29 support-hand fan instead of a pump cycle", async () => {
    const { createRevolverHammerBeatSample, sampleRevolverHammerBeat } = await import(
      "../packages/client/src/sprites/pose-language.js"
    );
    const hallowbore = weapon("x2-hallowbore-coachgun");
    expect(weaponHasHandlingTag(hallowbore, "pump")).toBe(false);
    expect(weaponHasHandlingTag(hallowbore, "revolver")).toBe(true);
    expect(hallowbore.gripPoints).toEqual({
      primary: { x: 0.35, y: 0.72 },
      secondary: { x: 0.34, y: 0.29, role: "hammer" },
    });
    const sample = createRevolverHammerBeatSample();
    sampleRevolverHammerBeat(hallowbore, 68.4, hallowbore.displayLength, false, sample);
    expect(sample.active).toBe(true);
    expect(Math.abs(sample.handForward)).toBeGreaterThan(10);
    expect(Math.abs(sample.handLateral)).toBeGreaterThan(8);
  });

  it("makes Boomstick a painted lever cycle and keeps Thunderhead's barrel hand planted", () => {
    const boomstick = weapon("x2-boomstick-saddlegun");
    expect(weaponHasHandlingTag(boomstick, "pump")).toBe(false);
    expect(weaponHasHandlingTag(boomstick, "lever")).toBe(true);
    expect(boomstick.gripPoints).toEqual({
      primary: { x: 0.38, y: 0.58 },
      secondary: { x: 0.27, y: 0.78, role: "lever" },
    });
    const thunderhead = weapon("x2-thunderhead-repeater-cannon");
    expect(thunderhead.gripPoints).toEqual({
      primary: { x: 0.27, y: 0.62 },
      secondary: { x: 0.66, y: 0.5, role: "horizontal-foregrip" },
    });
  });
});

describe("B48 corrected painted holds", () => {
  it("angles Dustline's lever hand at the trigger-loop contact", () => {
    const dustline = weapon("x2-dustline-lever-action");
    expect(dustline.gripPoints?.secondary).toEqual({
      x: 0.34,
      y: 0.66,
      role: "lever",
      angleRad: 0.72,
    });
  });

  it("puts Widowmaker's trigger hand behind its crank hand so the stock reaches the shoulder", () => {
    const widowmaker = weapon("x2-widowmaker-arbalest");
    expect(widowmaker.gripPoints).toEqual({
      primary: { x: 0.31, y: 0.66 },
      secondary: { x: 0.44, y: 0.88, role: "crank" },
    });
    expect((widowmaker.gripPoints?.primary.x ?? 0) - 0).toBeGreaterThan(0.3);
    expect(
      (widowmaker.gripPoints?.secondary?.y ?? 0) - (widowmaker.gripPoints?.primary.y ?? 0),
    ).toBeGreaterThan(0.2);
  });

  it("holds Whisperbarb as a vertically showcased dual pair through the shared muzzle affine", () => {
    const whisperbarb = weapon("x2-whisperbarb-hand-crossbow");
    expect(whisperbarb.dualVerticalSplit).toBe(0.1);
    expect(authoredDualShowcaseVerticalOffset(whisperbarb, 0)).toBeCloseTo(-7.6, 10);
    expect(authoredDualShowcaseVerticalOffset(whisperbarb, 1)).toBeCloseTo(7.6, 10);
    const lead = weaponMuzzleGripOffset(whisperbarb, 0, {
      aimX: 1,
      aimY: 0,
      facing: 1,
      hand: 0,
      recoilElapsedMs: 1_000,
    });
    const off = weaponMuzzleGripOffset(whisperbarb, 1, {
      aimX: 1,
      aimY: 0,
      facing: 1,
      hand: 1,
      recoilElapsedMs: 1_000,
    });
    expect(off.y - lead.y).toBeGreaterThan(15);
  });

  it("puts Powderkeg's firing hand on the handle without moving the retained support point", () => {
    expect(weapon("x2-powderkeg-mortar").gripPoints).toEqual({
      primary: { x: 0.08, y: 0.64 },
      secondary: { x: 0.7, y: 0.68, role: "two-hand-rifle" },
    });
  });
});

describe("B48 Gravedog ballistic tracers", () => {
  it("keeps tracer presentation over an explicit ballistic bullet body", () => {
    const gravedog = weapon("x2-gravedog-auto-rifle");
    expect(gravedog.gun).toMatchObject({
      bulletKind: "tracer",
      projectileArt: "bullet",
      projectileSpeed: 1_000,
      range: 650,
    });
    const factory = readFileSync("packages/client/src/scenes/arena/projectile-factory.ts", "utf8");
    expect(factory).toContain('art === "bullet"');
    expect(factory).toContain('.setData("ballisticCore", true)');
  });
});
