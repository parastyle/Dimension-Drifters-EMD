import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, sanitizeSettings } from "../settings.js";

vi.mock("phaser", () => {
  const target = function PhaserStub() {};
  let stub: unknown;
  stub = new Proxy(target, {
    get(inner, property) {
      if (property === "prototype") return inner.prototype;
      if (property === Symbol.toPrimitive) return () => 0;
      return stub;
    },
    apply: () => 0,
    construct: () => ({}),
  });
  return { default: stub };
});

const { ACCESSIBILITY_OPTION_IDS, accessibilityOptionValue, cycleAccessibilitySetting } =
  await import("./MenuScene.js");

describe("MenuScene accessibility options", () => {
  it("exposes every one of the eleven persisted gameplay settings", () => {
    expect(ACCESSIBILITY_OPTION_IDS).toEqual([
      "damageNumbers",
      "damageNumberStyle",
      "damageNumberScale",
      "hitConfirmAudio",
      "confirmVolume",
      "hitSparks",
      "screenShake",
      "hitStop",
      "flashes",
      "colorblindAssist",
      "renderScale",
    ]);
    expect(new Set(ACCESSIBILITY_OPTION_IDS).size).toBe(11);
  });

  it("cycles every option through a sanitized update patch and presents its changed value", () => {
    const initial = sanitizeSettings(DEFAULT_SETTINGS);
    for (const id of ACCESSIBILITY_OPTION_IDS) {
      const before = accessibilityOptionValue(initial, id);
      const patch = cycleAccessibilitySetting(initial, id, 1);
      const updated = sanitizeSettings({
        ...initial,
        ...patch,
        feedback: { ...initial.feedback, ...patch.feedback },
        rendering: { ...initial.rendering, ...patch.rendering },
      });
      expect(accessibilityOptionValue(updated, id), id).not.toBe(before);
    }
  });

  it("reaches the honest minimums for flashes, shake, hit stop, and confirm volume", () => {
    let current = sanitizeSettings(DEFAULT_SETTINGS);
    current = sanitizeSettings({
      ...current,
      ...cycleAccessibilitySetting(current, "flashes", 1),
      feedback: {
        ...current.feedback,
        ...cycleAccessibilitySetting(current, "flashes", 1).feedback,
      },
    });
    expect(current.feedback.flashes).toBe("reduced");

    for (const id of ["screenShake", "hitStop", "confirmVolume"] as const) {
      for (let step = 0; step < 20; step++) {
        const patch = cycleAccessibilitySetting(current, id, -1);
        current = sanitizeSettings({
          ...current,
          ...patch,
          feedback: { ...current.feedback, ...patch.feedback },
        });
        if (
          (id === "screenShake" && current.feedback.screenShake === 0) ||
          (id === "hitStop" && current.feedback.hitStop === false) ||
          (id === "confirmVolume" && current.feedback.confirmVolume === 0)
        )
          break;
      }
    }
    expect(current.feedback.screenShake).toBe(0);
    expect(current.feedback.hitStop).toBe(false);
    expect(current.feedback.confirmVolume).toBe(0);
  });
});
