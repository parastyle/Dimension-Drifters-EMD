import { WEAPONS, type WeaponDef } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { SPRITES, type SpriteManifest } from "../sprites/manifest.js";
import {
  classifyHandRole,
  idleHandPoseFor,
  resolveIdleHandTarget,
} from "../sprites/pose-language.js";

const TARGET_BODY_HEIGHT = 76;
const WHOLE_ART_PROTOS = ["proto-samurai", "proto-sheriff", "proto-witch"] as const;
const OWNER_NOTE_WEAPONS = [
  { id: "x2-ironbrand-heatfist", pose: "mirror-guard" },
  { id: "x2-hellmouth-palmcaster", pose: "casting-gesture" },
] as const;

function weapon(id: string): WeaponDef {
  const def = WEAPONS[id];
  if (!def) throw new Error(`missing B16 weapon fixture ${id}`);
  return def;
}

function manifest(id: (typeof WHOLE_ART_PROTOS)[number]): SpriteManifest {
  return SPRITES[id] as SpriteManifest;
}

describe("B16 single-glove occupancy and facing-side idle hand", () => {
  it("keeps Ironbrand on one action-owned glove while its unequipped hand stays authored-idle", () => {
    const ironbrand = weapon("x2-ironbrand-heatfist");
    const actionFrame = {
      phase: "active" as const,
      phaseT: 0.5,
      actionOwnedHands: [true, false] as const,
    };

    expect(ironbrand.poseLanguage?.idle).toBe("mirror-guard");
    expect(([0, 1] as const).map((hand) => classifyHandRole(ironbrand, actionFrame, hand))).toEqual(
      ["action-owned", "authored-idle"],
    );
    expect(
      ([0, 1] as const).map((hand) =>
        classifyHandRole(ironbrand, { ...actionFrame, dualEquipped: true }, hand),
      ),
    ).toEqual(["hard-constrained", "hard-constrained"]);
    expect(ironbrand.tags.grip).toBe("1H");
    expect(ironbrand.glovePair).toBeUndefined();
    expect(ironbrand.damage).toBe(6);
    expect(ironbrand.cooldown).toBe(0.6);
    expect(ironbrand.quake).toMatchObject({ radius: 120, damage: 7 });
  });

  it("uses the caster-family default for Hellmouth and classifies exactly one neutral idle hand", () => {
    const hellmouth = weapon("x2-hellmouth-palmcaster");
    const idleFrame = { phase: "idle" as const, phaseT: 0 };

    expect(hellmouth.poseLanguage?.idle).toBeUndefined();
    expect(idleHandPoseFor(hellmouth)).toBe("casting-gesture");
    expect(([0, 1] as const).map((hand) => classifyHandRole(hellmouth, idleFrame, hand))).toEqual([
      "hard-constrained",
      "authored-idle",
    ]);
  });

  it("resolves both unused hands to a positive world-facing margin on every shipped whole-art prototype", () => {
    for (const protoId of WHOLE_ART_PROTOS) {
      const rig = manifest(protoId);
      const scale = TARGET_BODY_HEIGHT / rig.body.h;
      const freeHand = rig.parts
        .filter((part) => part.role.startsWith("hand"))
        .sort((a, b) => a.ox - b.ox)[0];
      if (!freeHand) throw new Error(`${protoId} has no negative authored hand socket`);

      for (const ownerNote of OWNER_NOTE_WEAPONS) {
        const def = weapon(ownerNote.id);
        const target = resolveIdleHandTarget(
          def,
          {
            bodyX: 0,
            bodyY: 0,
            bodyHeight: TARGET_BODY_HEIGHT,
            aimLocal: Math.PI,
            movementX: -8,
            movementY: 3,
            microX: -3,
            microY: 1,
            manifestSocketX: freeHand.ox * scale,
          },
          { x: 0, y: 0 },
        );

        expect(idleHandPoseFor(def), `${protoId}:${ownerNote.id}:pose`).toBe(ownerNote.pose);
        for (const facing of [-1, 1] as const) {
          const worldBodyX = 100;
          const worldHandX = worldBodyX + target.x * facing;
          expect(
            (worldHandX - worldBodyX) * facing,
            `${protoId}:${ownerNote.id}:${ownerNote.pose}:facing=${facing}`,
          ).toBeGreaterThan(0);
        }

        const visibleFacingEdge = target.x + (freeHand.w * scale) / 2;
        const bodyFacingEdge = (rig.body.w * scale) / 2;
        expect(
          visibleFacingEdge,
          `${protoId}:${ownerNote.id}:visible-facing-alpha`,
        ).toBeGreaterThan(bodyFacingEdge);
      }
    }
  });
});
