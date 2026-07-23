import { WEAPONS, type WeaponDef } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { SPRITES, type SpriteManifest } from "../sprites/manifest.js";
import {
  FACING_SIDE_FLOOR_BODY_FRAC,
  idleHandPoseFor,
  resolveIdleHandTarget,
} from "../sprites/pose-language.js";

const TARGET_BODY_HEIGHT = 76;
const FACING_SIDE_FLOOR = TARGET_BODY_HEIGHT * FACING_SIDE_FLOOR_BODY_FRAC;
const WHOLE_ART_PROTOS = ["proto-samurai", "proto-sheriff", "proto-witch"] as const;
const ONE_HAND_REPROS = [
  "rattler-sabre",
  "x2-tumbleweed-flail",
  "x-gun-ricochet-pistol",
  "x2-saint-s-knucklebone-censer-orb",
  "x2-saint-bough-frost-crozier",
  "x2-hellmouth-palmcaster",
] as const;

function weapon(id: string): WeaponDef {
  const def = WEAPONS[id];
  if (!def) throw new Error(`missing B17 weapon fixture ${id}`);
  return def;
}

function manifest(id: (typeof WHOLE_ART_PROTOS)[number]): SpriteManifest {
  return SPRITES[id] as SpriteManifest;
}

function resolvedIdleHand(def: WeaponDef, rig: SpriteManifest) {
  const scale = TARGET_BODY_HEIGHT / rig.body.h;
  const hand = rig.parts
    .filter((part) => part.role.startsWith("hand"))
    .sort((a, b) => a.ox - b.ox)[0];
  if (!hand) throw new Error(`${rig.id} has no negative hand socket`);
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
      manifestSocketX: hand.ox * scale,
    },
    { x: 0, y: 0 },
  );
  return { target, hand, scale };
}

describe("B17 whole-art idle-hand composed-world law", () => {
  it("puts every named one-hand repro on the facing half-plane for all shipped prototypes", () => {
    for (const protoId of WHOLE_ART_PROTOS) {
      const rig = manifest(protoId);
      for (const weaponId of ONE_HAND_REPROS) {
        const def = weapon(weaponId);
        const { target, hand, scale } = resolvedIdleHand(def, rig);
        for (const facing of [-1, 1] as const) {
          const worldX = target.x * facing;
          expect(
            worldX * facing,
            `${protoId}:${weaponId}:${idleHandPoseFor(def)}:facing=${facing}:local=${target.x.toFixed(3)}`,
          ).toBeGreaterThanOrEqual(FACING_SIDE_FLOOR);
        }
        const visibleFacingEdge = target.x + (hand.w * scale) / 2;
        const bodyFacingEdge = (rig.body.w * scale) / 2;
        expect(
          visibleFacingEdge,
          `${protoId}:${weaponId}:${idleHandPoseFor(def)}:anti-occlusion`,
        ).toBeGreaterThan(bodyFacingEdge);
      }
    }
  });
});
