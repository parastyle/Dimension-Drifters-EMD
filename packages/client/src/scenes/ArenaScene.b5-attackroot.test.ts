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
  it("paints Stormfists from the planted implement root with no dash arrival dependency", () => {
    const weapon = WEAPONS["x2-thunderhead-stormfists"];
    if (!weapon) throw new Error("Missing Stormfists fixture");
    const swing = swingDescriptorFor(weapon, weapon.cooldown);
    const scene = Object.create(ArenaScene.prototype) as AnyScene;
    scene.time = {
      delayedCall: vi.fn(),
    };
    scene.spawnCasterSource = vi.fn();
    const onCue = vi.fn();
    const rig = { x: 1_500, y: 1_420 };

    scene.cueAttackCasterSource(weapon, swing, rig, 0, onCue);

    expect(scene.time.delayedCall).not.toHaveBeenCalled();
    expect(scene.spawnCasterSource).toHaveBeenCalledTimes(1);
    expect(scene.spawnCasterSource).toHaveBeenCalledWith(weapon, rig.x, rig.y, 0);
    expect(onCue).toHaveBeenCalledTimes(1);
  });
});
