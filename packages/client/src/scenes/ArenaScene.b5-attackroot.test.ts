import { swingDescriptorFor, WEAPONS } from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

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

const { ArenaScene } = await import("./ArenaScene.js");

// biome-ignore lint/suspicious/noExplicitAny: focused presentation test reaches private cue seams.
type AnyScene = any;

describe("ArenaScene — B5 destination-authored attack presentation", () => {
  it("delays Stormfists source paint until dash arrival and samples the authoritative endpoint once", () => {
    const weapon = WEAPONS["x2-thunderhead-stormfists"];
    if (!weapon) throw new Error("Missing Stormfists fixture");
    const swing = swingDescriptorFor(weapon, weapon.cooldown);
    const scene = Object.create(ArenaScene.prototype) as AnyScene;
    const delayed = vi.fn();
    scene.time = {
      delayedCall: vi.fn((delayMs: number, callback: () => void) => {
        delayed.mockImplementation(callback);
        return { delayMs };
      }),
    };
    scene.room = {
      state: {
        players: new Map([["storm", { x: 1_860, y: 1_420 }]]),
      },
    };
    scene.belt = false;
    scene.spawnCasterSource = vi.fn();
    const onCue = vi.fn();

    scene.cueAttackCasterSource(weapon, swing, "storm", { x: 1_500, y: 1_420 }, 0, onCue);

    expect(scene.time.delayedCall).toHaveBeenCalledTimes(1);
    expect(scene.time.delayedCall).toHaveBeenCalledWith(
      (swing.activeStartSeconds + (weapon.performance?.lunge?.durationSeconds ?? 0)) * 1_000,
      expect.any(Function),
    );
    expect(scene.spawnCasterSource).not.toHaveBeenCalled();

    delayed();
    expect(scene.spawnCasterSource).toHaveBeenCalledTimes(1);
    expect(scene.spawnCasterSource).toHaveBeenCalledWith(weapon, 1_860, 1_420, 0);
    expect(onCue).toHaveBeenCalledTimes(1);
  });
});
