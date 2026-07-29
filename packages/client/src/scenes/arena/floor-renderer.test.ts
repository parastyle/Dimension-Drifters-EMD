import { type ArenaMapSeeds, generateArena, getDimension } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { buildArenaFloor, drawArena } from "./floor-renderer.js";

const SEEDS: ArenaMapSeeds = {
  seedTerrain: 101,
  seedHazard: 202,
  seedTheme: 303,
  seedDecor: 404,
};

type FloorCall = Readonly<{
  kind: string;
  width?: number;
  height?: number;
  key?: string;
}>;

function floorScene(): {
  scene: Phaser.Scene;
  calls: FloorCall[];
  generatedTextures: Array<Readonly<{ width: number; height: number }>>;
} {
  const calls: FloorCall[] = [];
  const generatedTextures: Array<Readonly<{ width: number; height: number }>> = [];
  const object = {
    setDepth() {
      return this;
    },
    setStrokeStyle() {
      return this;
    },
    setDisplaySize() {
      return this;
    },
    lineStyle() {
      return this;
    },
    strokeCircle() {
      return this;
    },
    once() {
      return this;
    },
    tileScaleX: 1,
    tileScaleY: 1,
  };
  const scene = {
    add: {
      rectangle(_x: number, _y: number, width: number, height: number) {
        calls.push({ kind: "rectangle", width, height });
        return { ...object };
      },
      tileSprite(_x: number, _y: number, width: number, height: number, key: string) {
        calls.push({ kind: "tileSprite", width, height, key });
        return { ...object };
      },
      grid(_x: number, _y: number, width: number, height: number) {
        calls.push({ kind: "grid", width, height });
        return { ...object };
      },
      image(_x: number, _y: number, key: string) {
        calls.push({ kind: "image", key });
        return { ...object };
      },
      graphics() {
        calls.push({ kind: "graphics" });
        return { ...object };
      },
    },
    textures: {
      exists(key: string) {
        return key === "tile-ground";
      },
      remove() {},
      createCanvas(_key: string, width: number, height: number) {
        generatedTextures.push({ width, height });
        return {
          getContext() {
            return {
              clearRect() {},
              fillStyle: "",
              globalAlpha: 1,
              beginPath() {},
              arc() {},
              fill() {},
            };
          },
          refresh() {},
        };
      },
    },
  };
  return { scene: scene as unknown as Phaser.Scene, calls, generatedTextures };
}

describe("open-arena floor allocation", () => {
  it.each([
    [4_800, 4_800],
    [38_400, 38_400],
  ])("keeps one repeated tile and a fixed 128px generated texture at %ix%i", (width, height) => {
    const map = generateArena(SEEDS, width, height);
    const mock = floorScene();
    const palette = getDimension("wild-west").palette;
    const drawn = drawArena(mock.scene, map, () => true, palette);
    const built = buildArenaFloor(mock.scene, map, "wild-west", palette);

    expect(drawn).toHaveLength(3);
    expect(built).toHaveLength(2);
    expect(mock.calls.filter((call) => call.kind === "tileSprite")).toEqual([
      {
        kind: "tileSprite",
        width: width + 6_400,
        height: height + 6_400,
        key: "tile-ground",
      },
    ]);
    expect(mock.generatedTextures).toEqual([{ width: 128, height: 128 }]);
    expect(
      Math.max(...mock.generatedTextures.map((texture) => texture.width * texture.height)),
    ).toBe(16_384);
  });
});
