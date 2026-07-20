import { WEAPONS } from "@dd/shared";
import { describe, expect, it, vi } from "vitest";
import type { SpriteManifest } from "../sprites/manifest.js";

vi.mock("phaser", () => ({ default: {} }));

const { SpriteRig } = await import("./SpriteRig.js");
const { twoHandedPoseFor } = await import("../sprites/pose-language.js");

interface CapturedPiece {
  spriteId: string;
  def: (typeof WEAPONS)[string];
  manifest: SpriteManifest;
  partIndex?: number;
}

// W-CONVERT — append-only rig proof: one authored glove is intentionally mounted on each hand.
describe("SpriteRig glove-pair rendering", () => {
  it.each([
    "x2-coyote-trickster-s-sparkmitt",
    "x2-sparkknuckle-hex-mitt",
  ] as const)("duplicates %s part-1 into lead and off-hand mounts", (weaponId) => {
    const weapon = WEAPONS[weaponId];
    if (!weapon?.glovePair) throw new Error(`Missing glove-pair fixture: ${weaponId}`);
    const manifest: SpriteManifest = {
      id: weaponId,
      kind: "weapon",
      canvas: { w: 96, h: 64 },
      body: { cx: 48, cy: 32, w: 96, h: 64 },
      parts: [
        {
          role: "part-1",
          file: "part-1.png",
          w: 96,
          h: 64,
          cx: 48,
          cy: 32,
          ox: 0,
          oy: 0,
        },
      ],
    };
    let lead: CapturedPiece | undefined;
    let off: CapturedPiece | undefined;
    const rig = Object.create(SpriteRig.prototype) as InstanceType<typeof SpriteRig>;
    (rig as unknown as { equipLoadout: (a: CapturedPiece, b?: CapturedPiece) => void }).equipLoadout =
      (a, b) => {
        lead = a;
        off = b;
      };

    rig.equipWeapon(weaponId, weapon, manifest);

    expect(lead).toMatchObject({ spriteId: weaponId, partIndex: 0 });
    expect(off).toMatchObject({ spriteId: weaponId, partIndex: 0 });
    expect(lead?.def).toBe(weapon);
    expect(off?.def).toBe(weapon);
    expect(twoHandedPoseFor(weapon)).toBe(false);
  });
});
