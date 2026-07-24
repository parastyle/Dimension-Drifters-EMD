import { isMonkGloveWeapon, meleeComboSelectionFor, WEAPONS } from "@dd/shared";
import { describe, expect, it, vi } from "vitest";
import { SPRITES, type SpriteManifest, spriteImageFacingX } from "../sprites/manifest.js";

vi.mock("phaser", () => ({ default: {} }));

const {
  authoredWeaponRenderPlan,
  strikeOverlayImpactVisible,
  wrapRigFacingSign,
  wrapRigMountPlan,
  wrapRigReceiverRelativeScale,
} = await import("./SpriteRig.js");
const { twoHandedPoseFor } = await import("../sprites/pose-language.js");

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
    if (!weapon || !manifest) throw new Error(`Missing B25 wrap fixture: ${weaponId}`);
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
    "x2-emberfist-wraps",
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
    const [lead, off] = authoredWeaponRenderPlan(weaponId, weapon, manifest);

    expect(lead).toMatchObject({ spriteId: weaponId, partIndex: 0 });
    expect(off).toMatchObject({ spriteId: weaponId, partIndex: 0 });
    expect(lead.def).toBe(weapon);
    expect(off?.def).toBe(weapon);
    expect(twoHandedPoseFor(weapon)).toBe(false);
  });

  it("uses Wyrmscale's back and palm art as one pre-made dual set", () => {
    const weapon = WEAPONS["x2-wyrmscale-hex-talon"];
    const manifest = SPRITES["x2-wyrmscale-hex-talon"];
    if (!weapon || !manifest) throw new Error("Missing Wyrmscale fixture");
    expect(authoredWeaponRenderPlan(weapon.id, weapon, manifest)).toMatchObject([
      { partIndex: 0 },
      { partIndex: 1 },
    ]);
  });

  it("shows Emberfist's flame sheath only on the striking fist's impact frames", () => {
    expect(strikeOverlayImpactVisible(0.4, 0.4, 0, 0)).toBe(true);
    expect(strikeOverlayImpactVisible(0.4, 0.4, 0, 1)).toBe(false);
    expect(strikeOverlayImpactVisible(0.4, 0.4, 1, 1)).toBe(true);
    expect(strikeOverlayImpactVisible(0.3, 0.4, 1, 1)).toBe(false);
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

  it("fits full wrap canvases to hand and foot receivers instead of held-prop display length", () => {
    const handScale = wrapRigReceiverRelativeScale({
      sourceWidth: 512,
      sourceHeight: 368,
      receiverWidth: 42,
      receiverHeight: 34,
      receiverScaleX: 1,
      receiverScaleY: 1,
      rigScaleX: 1,
      rigScaleY: 1,
      padding: 1.16,
    });
    const footScale = wrapRigReceiverRelativeScale({
      sourceWidth: 512,
      sourceHeight: 417,
      receiverWidth: 46,
      receiverHeight: 30,
      receiverScaleX: 1,
      receiverScaleY: 1,
      rigScaleX: 1,
      rigScaleY: 1,
      padding: 1.12,
    });

    expect(512 * handScale).toBeLessThanOrEqual(42 * 1.16);
    expect(368 * handScale).toBeLessThanOrEqual(34 * 1.16);
    expect(512 * footScale).toBeLessThanOrEqual(46 * 1.12);
    expect(417 * footScale).toBeLessThanOrEqual(30 * 1.12);
    expect(handScale).toBeLessThan(62 / 512);
    expect(footScale).toBeLessThan(62 / 512);
  });

  it("keeps Sparkknuckle's approved glove frames while banning its former player aura", () => {
    const sparkknuckle = WEAPONS["x2-sparkknuckle-hex-mitt"];
    if (!sparkknuckle) throw new Error("Missing Sparkknuckle fixture");
    const combo = meleeComboSelectionFor(sparkknuckle);

    expect(sparkknuckle.performance).toEqual({
      hold: "steady",
      action: "default-swing",
      continuous: true,
    });
    expect(sparkknuckle.glovePair).toEqual({});
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
    expect(WEAPONS["x2-emberfist-wraps"]?.performance?.forwardDrift).toBeUndefined();
  });
});
