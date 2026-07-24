import { WEAPONS } from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ default: {} }));

import { FIRING_FRAME_RELEASE_WINDOW_MS } from "../sprites/firing-frame.js";
import { SpriteRig } from "./SpriteRig.js";

describe("SpriteRig authoritative firing-frame swap", () => {
  it("ignores prediction, opens on confirmation, and restores the closed texture at the exact end", () => {
    const weapon = WEAPONS["x2-wyrmskull-reliquary"];
    if (!weapon) throw new Error("missing Wyrmskull fixture");
    const img = {
      scaleX: 0.75,
      scaleY: 0.6,
      setOrigin: vi.fn(),
      setScale: vi.fn(),
      setTexture: vi.fn(),
    };
    img.setOrigin.mockReturnValue(img);
    img.setScale.mockImplementation((scaleX: number, scaleY: number) => {
      img.scaleX = scaleX;
      img.scaleY = scaleY;
      return img;
    });
    img.setTexture.mockReturnValue(img);
    const rig = Object.create(SpriteRig.prototype) as {
      attackBeatSeq: number;
      attackBeatWallEpochMs: number;
      authoritativeFiringBeatSeq: number;
      authoritativeFiringAttackTick: number;
      authoritativeFiringClockTick: number;
      authoritativeFiringWeaponId: string;
      hasAttackBeatSeq: boolean;
      hasAuthoritativeFiringBeat: boolean;
      prevAnimMs: number;
      scene: {
        animClock: number;
        textures: { exists(key: string): boolean };
        time: { now: number };
      };
      tome: undefined;
      weaponDef: typeof weapon;
      weapons: Array<{
        baseScale: number;
        closedBaseScale: number;
        closedOriginX: number;
        closedOriginY: number;
        closedTextureFrame?: string;
        closedTextureKey: string;
        def: typeof weapon;
        firingFrame: {
          originX: number;
          originY: number;
          sourceScale: number;
          spriteId: string;
          textureFrame?: string;
          textureKey: string;
        };
        firingFrameVisible: boolean;
        img: typeof img;
      }>;
    };
    Object.assign(rig, {
      attackBeatSeq: 0,
      attackBeatWallEpochMs: -1e9,
      authoritativeFiringBeatSeq: 0,
      authoritativeFiringAttackTick: 0,
      authoritativeFiringClockTick: 0,
      authoritativeFiringWeaponId: "",
      hasAttackBeatSeq: false,
      hasAuthoritativeFiringBeat: false,
      prevAnimMs: 1_000,
      scene: {
        animClock: 1_000,
        textures: { exists: () => true },
        time: { now: 1_000 },
      },
      tome: undefined,
      weaponDef: weapon,
      weapons: [
        {
          baseScale: 0.5,
          closedBaseScale: 0.5,
          closedOriginX: 0.1,
          closedOriginY: 0.5,
          closedTextureKey: "x2-wyrmskull-reliquary:part-1",
          def: weapon,
          firingFrame: {
            originX: 0.1,
            originY: 0.4388888888888889,
            sourceScale: 3,
            spriteId: "x2-wyrmskull-reliquary-open",
            textureKey: "x2-wyrmskull-reliquary-open:part-1",
          },
          firingFrameVisible: false,
          img,
        },
      ],
    });
    const internals = SpriteRig.prototype as unknown as {
      prepareFiringFrames(this: typeof rig): void;
    };

    SpriteRig.prototype.setAuthoritativeAttackClock.call(rig, 100, 100);
    SpriteRig.prototype.setAttackBeat.call(rig, 1, true, 1_000, false);
    internals.prepareFiringFrames.call(rig);
    expect(img.setTexture).not.toHaveBeenCalled();

    SpriteRig.prototype.setAttackBeat.call(rig, 1, true, 1_000);
    internals.prepareFiringFrames.call(rig);
    expect(img.setTexture).toHaveBeenLastCalledWith(
      "x2-wyrmskull-reliquary-open:part-1",
      undefined,
    );
    expect(rig.weapons[0]?.baseScale).toBeCloseTo(0.5 / 3, 10);
    expect(img.scaleX).toBeCloseTo(0.75 / 3, 10);
    expect(img.scaleY).toBeCloseTo(0.6 / 3, 10);

    SpriteRig.prototype.setAuthoritativeAttackClock.call(rig, 100, 102);
    internals.prepareFiringFrames.call(rig);
    expect(img.setTexture).toHaveBeenCalledTimes(1);

    expect(FIRING_FRAME_RELEASE_WINDOW_MS).toBe(150);
    SpriteRig.prototype.setAuthoritativeAttackClock.call(rig, 100, 103);
    internals.prepareFiringFrames.call(rig);
    expect(img.setTexture).toHaveBeenLastCalledWith("x2-wyrmskull-reliquary:part-1", undefined);
    expect(rig.weapons[0]?.baseScale).toBe(0.5);
    expect(img.scaleX).toBeCloseTo(0.75, 10);
    expect(img.scaleY).toBeCloseTo(0.6, 10);
    expect(rig.weapons[0]?.firingFrameVisible).toBe(false);
  });
});
