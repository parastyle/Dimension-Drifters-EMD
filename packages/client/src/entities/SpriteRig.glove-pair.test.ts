import { isMonkGloveWeapon, meleeComboSelectionFor, WEAPONS } from "@dd/shared";
import { describe, expect, it, vi } from "vitest";
import { SPRITES, type SpriteManifest, spriteImageFacingX } from "../sprites/manifest.js";

vi.mock("phaser", () => ({ default: {} }));

const { SpriteRig, wrapRigFacingSign, wrapRigMountPlan } = await import("./SpriteRig.js");
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
    "x2-muay-thai-wraps",
    "x2-wing-chun-wraps",
    "x2-drunken-fist-wraps",
    "x2-iron-palm-wraps",
  ] as const)("mounts %s as two independent hands and two independent feet", (weaponId) => {
    const weapon = WEAPONS[weaponId];
    const manifest = SPRITES[weaponId];
    if (!weapon || !manifest) throw new Error(`Missing B19 wrap fixture: ${weaponId}`);
    const mounts = wrapRigMountPlan(weapon, manifest);

    expect(weapon.glovePair?.wrapsFeet).toBe(true);
    expect(mounts).toEqual([
      { receiver: "hand-r", partIndex: 0 },
      { receiver: "hand-l", partIndex: 0 },
      { receiver: "foot-r", partIndex: 1 },
      { receiver: "foot-l", partIndex: 1 },
    ]);
    expect(mounts.filter((mount) => mount.partIndex === 0)).toHaveLength(2);
    expect(mounts.filter((mount) => mount.partIndex === 1)).toHaveLength(2);
    expect(new Set(mounts.map((mount) => mount.receiver)).size).toBe(4);

    const imageFacing = spriteImageFacingX((manifest as SpriteManifest).imageFacing);
    expect(wrapRigFacingSign(1, imageFacing)).toBe(imageFacing);
    expect(wrapRigFacingSign(-1, imageFacing)).toBe(-imageFacing);
  });

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
    (
      rig as unknown as { equipLoadout: (a: CapturedPiece, b?: CapturedPiece) => void }
    ).equipLoadout = (a, b) => {
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

  it("routes every close worn punch weapon into the systemic monk lane", () => {
    const monkIds = Object.values(WEAPONS)
      .filter(isMonkGloveWeapon)
      .map((weapon) => weapon.id);
    expect(monkIds).toEqual(
      expect.arrayContaining([
        "fists",
        "x2-revenant-knuckle",
        "x2-sparkknuckle-hex-mitt",
        "x2-cinderpalm-brand-glove",
        "x2-pyreclap-mauler",
        "x2-frostknuckle-rimewrap",
        "x2-stormcradle-faradaygloves",
        "x2-blightgrip-spore-mitt",
        "x2-ironbrand-heatfist",
        "x2-prismhex-diffraction-gauntlet",
        "x2-coyote-trickster-s-sparkmitt",
      ]),
    );
    expect(monkIds).not.toContain("x2-thunderhead-stormfists"); // authored lunge remains stronger
    expect(monkIds).not.toContain("x2-wyrmscale-hex-talon"); // claws retain the rake vocabulary
    expect(monkIds).not.toContain("x2-tesla-faradayer"); // projectile gauntlets retain firing poses
  });

  it("keeps Sparkknuckle's approved glove frames while removing only its authored root drift", () => {
    const sparkknuckle = WEAPONS["x2-sparkknuckle-hex-mitt"];
    if (!sparkknuckle) throw new Error("Missing Sparkknuckle fixture");
    const combo = meleeComboSelectionFor(sparkknuckle);

    expect(sparkknuckle.performance).toEqual({
      hold: "steady",
      action: "default-swing",
      continuous: true,
    });
    expect(sparkknuckle.glovePair).toEqual({ auraColor: 0x33e6ff, auraRadius: 48 });
    expect(combo).toMatchObject({
      family: "punch",
      variant: "sparkknuckle-voltage-boxing",
    });
    expect(combo?.sequence.map(({ name, motion, hand }) => ({ name, motion, hand }))).toEqual([
      { name: "lead rising hook", motion: "hook", hand: "lead" },
      { name: "rear voltage cross", motion: "cross", hand: "off" },
      { name: "off-side body hook", motion: "hook", hand: "lead" },
      { name: "thunder cross finisher", motion: "cross", hand: "off" },
    ]);

    // The sibling owner-approved Coyote movement remains authored; the B5 deletion is weapon-local.
    expect(WEAPONS["x2-coyote-trickster-s-sparkmitt"]?.performance?.forwardDrift).toEqual({
      speedPxPerSecond: 48,
      durationSeconds: 0.12,
    });
  });
});
