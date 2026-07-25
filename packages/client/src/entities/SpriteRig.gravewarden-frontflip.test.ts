import { swingDescriptorFor, WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  continuousFrontflipAngle,
  continuousTwirlAxisFor,
  continuousWhirlPhase,
} from "../sprites/pose-language.js";

describe("SpriteRig Gravewarden continuous frontflip routing", () => {
  const gravewarden = WEAPONS["gravediggers-spade"];
  if (!gravewarden) throw new Error("Missing Gravewarden Buster fixture");

  it("routes the held full-body spin to pitch rather than ground-plane yaw", () => {
    expect(gravewarden.performance?.twirl).toMatchObject({
      plane: "continuous-frontflip",
      pivot: "grip",
      direction: "forward",
      visualRevolutions: 6,
    });
    expect(continuousTwirlAxisFor(gravewarden.performance)).toBe("pitch");
    expect(gravewarden.performance?.twirl?.plane).not.toBe("ground-whirlwind");
    expect(continuousFrontflipAngle(0.25, 6, 1, 1)).toBeCloseTo(Math.PI * 3, 12);
    expect(continuousFrontflipAngle(0.25, 6, 1, -1)).toBeCloseTo(-Math.PI * 3, 12);
  });

  it("closes each cadence loop at the same pose and angular velocity", () => {
    const performance = gravewarden.performance;
    const cadence = gravewarden.performance?.twirl?.cadenceSeconds ?? gravewarden.cooldown;
    const beforePhase = continuousWhirlPhase(performance, true, false, cadence - 1e-6, cadence);
    const seamPhase = continuousWhirlPhase(performance, true, false, cadence, cadence);
    const afterPhase = continuousWhirlPhase(performance, true, false, cadence + 1e-6, cadence);

    expect(beforePhase).toBeGreaterThan(0.999);
    expect(seamPhase).toBe(0);
    expect(afterPhase).toBeGreaterThan(0);
    expect(afterPhase).toBeLessThan(0.001);

    const start = continuousFrontflipAngle(0, 6, 1, 1);
    const end = continuousFrontflipAngle(1, 6, 1, 1);
    expect(Math.cos(end)).toBeCloseTo(Math.cos(start), 12);
    expect(Math.sin(end)).toBeCloseTo(Math.sin(start), 12);

    const epsilon = 1e-6;
    const velocityBefore = (end - continuousFrontflipAngle(1 - epsilon, 6, 1, 1)) / epsilon;
    const velocityAfter = (continuousFrontflipAngle(epsilon, 6, 1, 1) - start) / epsilon;
    expect(velocityBefore).toBeCloseTo(Math.PI * 12, 8);
    expect(velocityAfter).toBeCloseTo(velocityBefore, 8);
  });

  it("runs six visible in-place turns in one third of the old cadence", () => {
    const descriptor = swingDescriptorFor(gravewarden, gravewarden.cooldown);

    expect(gravewarden).toMatchObject({
      damage: 8,
      range: 354,
      halfArc: 0.95,
      cooldown: 0.6,
      swingArc: Math.PI * 2,
      performance: {
        twirl: { visualRevolutions: 6, cadenceSeconds: 0.2 },
      },
    });
    expect(descriptor.poseSeconds).toBeLessThanOrEqual(gravewarden.cooldown);
  });
});
