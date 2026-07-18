import { describe, expect, it } from "vitest";
import type { DamageNumberEvent } from "../combat-feedback.js";
import type { FeedbackSettings } from "../settings.js";
import { scaleWorldDeterminant } from "../vfx/screen-true-transform.js";
import { DamageNumberRenderer, DEFAULT_DAMAGE_NUMBER_TUNING } from "./damage-numbers.js";

const settings: FeedbackSettings = {
  damageNumbers: "all",
  damageNumberStyle: "detailed",
  damageNumberScale: 1,
  hitConfirmAudio: true,
  hitSparks: true,
  screenShake: 1,
  hitStop: true,
  flashes: "full",
};

function makeLabel() {
  return {
    active: true,
    parentContainer: null,
    scaleX: 1,
    scaleY: 1,
    fontSize: 14,
    setOrigin() {
      return this;
    },
    setDepth() {
      return this;
    },
    setScale(x: number, y = x) {
      this.scaleX = x;
      this.scaleY = y;
      return this;
    },
    setVisible() {
      return this;
    },
    setFont(_key: string, size: number) {
      this.fontSize = size;
      return this;
    },
    setFontSize(size: number) {
      this.fontSize = size;
      return this;
    },
    setText() {
      return this;
    },
    setPosition() {
      return this;
    },
    setAlpha() {
      return this;
    },
    destroy() {},
  };
}

describe("DamageNumberRenderer transform law", () => {
  it("keeps number glyph world determinants positive regardless of owner facing", () => {
    for (const ownerFacing of [-1, 1] as const) {
      const labels: ReturnType<typeof makeLabel>[] = [];
      const scene = {
        textures: { exists: () => true },
        cache: { bitmapFont: { has: () => true } },
        add: {
          bitmapText: () => {
            const label = makeLabel();
            labels.push(label);
            return label;
          },
        },
      };
      const renderer = new DamageNumberRenderer(scene as never, settings, () => false, 1, {
        ...DEFAULT_DAMAGE_NUMBER_TUNING,
        maxLabels: 1,
      });
      const event: DamageNumberEvent = {
        targetId: "owner",
        damage: 12,
        x: 40,
        y: 30,
        visible: true,
        attribution: "self",
        crit: false,
        finalBlow: false,
        selfDamage: false,
      };
      renderer.beginFrame();
      renderer.add(event, 0);
      renderer.update(16, 16, false);

      const glyph = labels[0];
      const ownerWorldDeterminant = scaleWorldDeterminant(ownerFacing, 1, 1, 1);
      expect(Math.sign(ownerWorldDeterminant)).toBe(ownerFacing);
      expect(glyph?.parentContainer).toBeNull();
      expect(scaleWorldDeterminant(1, 1, glyph?.scaleX ?? 0, glyph?.scaleY ?? 0)).toBeGreaterThan(
        0,
      );
      renderer.destroy();
    }
  });
});
