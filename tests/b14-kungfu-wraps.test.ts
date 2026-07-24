import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { ACTIVE_WEAPON_CATALOG_IDS, meleeComboSelectionFor, WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { SPRITES } from "../packages/client/src/sprites/manifest.js";
import { KUNG_FU_WRAP_VFX_RECIPES } from "../packages/client/src/vfx/kung-fu-wrap-vfx-recipes.js";

const require = createRequire(import.meta.url);
const { PNG } = require("../tools/artkit/node_modules/pngjs") as {
  PNG: {
    sync: {
      read(bytes: Buffer): { width: number; height: number; data: Buffer };
    };
  };
};

const B19_WRAPS = [
  "x2-muay-thai-wraps",
  "x2-wing-chun-wraps",
  "x2-drunken-fist-wraps",
  "x2-iron-palm-wraps",
] as const;

const NATIVE_PARTS: Readonly<
  Record<(typeof B19_WRAPS)[number], readonly (readonly [number, number])[]>
> = {
  "x2-muay-thai-wraps": [
    [380, 512],
    [512, 368],
  ],
  "x2-wing-chun-wraps": [
    [512, 417],
    [512, 416],
  ],
  "x2-drunken-fist-wraps": [
    [364, 512],
    [512, 400],
  ],
  "x2-iron-palm-wraps": [
    [368, 512],
    [512, 408],
  ],
};

function visibleAlphaBounds(data: Buffer, width: number, height: number) {
  let visible = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) <= 16) continue;
      visible++;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { visible, minX, minY, maxX, maxY };
}

function significantAlphaComponents(data: Buffer, width: number, height: number): number {
  const visited = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  let components = 0;
  for (let start = 0; start < visited.length; start++) {
    if (visited[start] || (data[start * 4 + 3] ?? 0) <= 16) continue;
    let head = 0;
    let tail = 1;
    let area = 0;
    stack[0] = start;
    visited[start] = 1;
    while (head < tail) {
      const index = stack[head++]!;
      area++;
      const x = index % width;
      const up = index - width;
      const down = index + width;
      const left = index - 1;
      const right = index + 1;
      if (up >= 0 && !visited[up] && (data[up * 4 + 3] ?? 0) > 16) {
        visited[up] = 1;
        stack[tail++] = up;
      }
      if (down < visited.length && !visited[down] && (data[down * 4 + 3] ?? 0) > 16) {
        visited[down] = 1;
        stack[tail++] = down;
      }
      if (x > 0 && !visited[left] && (data[left * 4 + 3] ?? 0) > 16) {
        visited[left] = 1;
        stack[tail++] = left;
      }
      if (x + 1 < width && !visited[right] && (data[right * 4 + 3] ?? 0) > 16) {
        visited[right] = 1;
        stack[tail++] = right;
      }
    }
    if (area >= 64) components++;
  }
  return components;
}

function comboSteps(id: (typeof B19_WRAPS)[number]) {
  return meleeComboSelectionFor(WEAPONS[id]!)?.sequence;
}

describe("B19 kung-fu wrap rework", () => {
  it("publishes four active four-limb wrap sets with distinct combo, root, and VFX signatures", () => {
    expect(new Set(B19_WRAPS).size).toBe(4);
    const comboSignatures = new Set<string>();
    const vfxSignatures = new Set<string>();
    for (const id of B19_WRAPS) {
      const weapon = WEAPONS[id];
      expect(weapon, id).toBeDefined();
      expect(weapon?.expansion, id).toBe(true);
      expect(weapon?.archived, id).not.toBe(true);
      expect(ACTIVE_WEAPON_CATALOG_IDS, id).toContain(id);
      expect(weapon?.tags, id).toMatchObject({
        grip: "2H",
        delivery: "glove-pair",
        classPool: "melee",
        rangeBand: "close",
      });
      expect(weapon?.twoHanded, id).toBe(true);
      expect(weapon?.glovePair, id).toBeDefined();
      expect(weapon?.glovePair?.wrapsFeet, id).toBe(true);
      expect(weapon?.poseLanguage?.idle, id).toBe("mirror-guard");
      expect(weapon?.authoritativeCombo, id).toBe(true);
      expect(weapon?.impactMuzzle, id).toBe(true);
      expect(weapon?.muzzle?.points.length, id).toBe(NATIVE_PARTS[id].length);
      comboSignatures.add(
        JSON.stringify({
          variant: weapon?.comboVariant,
          cooldown: weapon?.cooldown,
          combo: meleeComboSelectionFor(weapon!)?.sequence,
          drift: weapon?.performance?.forwardDrift,
        }),
      );
      vfxSignatures.add(KUNG_FU_WRAP_VFX_RECIPES[id]?.signature ?? "");
    }
    expect(comboSignatures.size).toBe(4);
    expect(vfxSignatures.size).toBe(4);
  });

  it("pins the longer punch/kick beat charts and authored displacement", () => {
    expect(comboSteps("x2-muay-thai-wraps")?.map((step) => [step.motion, step.limb])).toEqual([
      ["teep-kick", "foot"],
      ["elbow", "hand"],
      ["elbow", "hand"],
      ["knee-strike", "foot"],
      ["spinning-back-elbow", "hand"],
    ]);
    expect(
      comboSteps("x2-wing-chun-wraps")?.map((step) => [step.motion, step.hand, step.limb]),
    ).toEqual([
      ["chain-punch", "lead", "hand"],
      ["chain-punch", "off", "hand"],
      ["chain-punch", "lead", "hand"],
      ["oblique-kick", "off", "foot"],
      ["double-palm", "both", "hand"],
    ]);
    expect(comboSteps("x2-drunken-fist-wraps")?.map((step) => [step.motion, step.limb])).toEqual([
      ["sway-jab", "hand"],
      ["weave-cross", "hand"],
      ["weave-backfist", "hand"],
      ["sweeping-leg", "foot"],
      ["falling-haymaker", "hand"],
    ]);
    expect(
      comboSteps("x2-drunken-fist-wraps")?.map((step) => [
        step.rootMotion?.forwardPx,
        step.rootMotion?.lateralPx,
      ]),
    ).toEqual([
      [3, 7],
      [-3, -9],
      [5, 8],
      [-2, -11],
      [12, 4],
    ]);
    expect(comboSteps("x2-iron-palm-wraps")?.map((step) => [step.motion, step.limb])).toEqual([
      ["crushing-palm", "hand"],
      ["stomp-kick", "foot"],
      ["windup-palm", "hand"],
      ["quake-double-palm", "hand"],
    ]);
    expect(comboSteps("x2-iron-palm-wraps")?.at(-1)?.path.knockback).toBe(48);
  });

  it("keeps every redistributed combo inside ±10% of shipped DPS with requested cadence ordering", () => {
    const weapons = B19_WRAPS.map((id) => WEAPONS[id]!);
    for (const weapon of weapons) {
      const steps = comboSteps(weapon.id as (typeof B19_WRAPS)[number]) ?? [];
      const averageDamage =
        steps.reduce((sum, step) => sum + step.path.damageMultiplier, 0) /
        Math.max(1, steps.length);
      const shippedDps = weapon.damage / weapon.cooldown;
      const redistributedDps = shippedDps * averageDamage;
      expect(redistributedDps, weapon.id).toBeGreaterThanOrEqual(shippedDps * 0.9);
      expect(redistributedDps, weapon.id).toBeLessThanOrEqual(shippedDps * 1.1);
      expect(redistributedDps, weapon.id).toBeGreaterThanOrEqual(18);
      expect(redistributedDps, weapon.id).toBeLessThanOrEqual(22);
    }
    const muay = WEAPONS["x2-muay-thai-wraps"]!;
    const wing = WEAPONS["x2-wing-chun-wraps"]!;
    const drunken = WEAPONS["x2-drunken-fist-wraps"]!;
    const iron = WEAPONS["x2-iron-palm-wraps"]!;
    expect(wing.damage).toBeLessThan(drunken.damage);
    expect(wing.cooldown).toBeLessThan(drunken.cooldown);
    expect(drunken.cooldown).toBeLessThan(muay.cooldown);
    expect(muay.cooldown).toBeLessThan(iron.cooldown);
    expect(muay.damage).toBeGreaterThan(drunken.damage);
    expect(iron.damage).toBeGreaterThan(muay.damage);
    expect(wing.range).toBeLessThan(muay.range);
  });

  it("ships every authored part at its native dimensions with broad visible alpha bounds", () => {
    for (const id of B19_WRAPS) {
      const parts = NATIVE_PARTS[id];
      const expectedCanvas = {
        w: Math.max(...parts.map(([width]) => width)),
        h: Math.max(...parts.map(([, height]) => height)),
      };
      expect(SPRITES[id]?.canvas, id).toEqual(expectedCanvas);
      expect(SPRITES[id]?.parts, id).toHaveLength(parts.length);
      for (let index = 0; index < parts.length; index++) {
        const path = `packages/client/public/sprites/${id}/part-${index + 1}.png`;
        expect(existsSync(path), `${id}/part-${index + 1}`).toBe(true);
        const png = PNG.sync.read(readFileSync(path));
        const [width, height] = parts[index]!;
        expect([png.width, png.height], `${id}/part-${index + 1}`).toEqual([width, height]);
        expect(SPRITES[id]?.parts[index], `${id}/part-${index + 1}`).toMatchObject({
          file: `part-${index + 1}.png`,
          w: width,
          h: height,
        });
        const bounds = visibleAlphaBounds(png.data, png.width, png.height);
        expect(
          significantAlphaComponents(png.data, png.width, png.height),
          `${id}/part-${index + 1} must remain one item, never a fused pair`,
        ).toBe(1);
        expect(bounds.visible, `${id}/part-${index + 1}`).toBeGreaterThan(8_000);
        expect(bounds.maxX - bounds.minX, `${id}/part-${index + 1}`).toBeGreaterThan(width * 0.42);
        expect(bounds.maxY - bounds.minY, `${id}/part-${index + 1}`).toBeGreaterThan(height * 0.42);
        expect(bounds.visible).toBeLessThan(width * height);
      }
    }
  });

  it("keeps striking-hand impact anchors on visible pixels and standing art free of dangles", () => {
    const source = JSON.parse(readFileSync("data/weapon-concepts-300.json", "utf8")) as {
      weapons: Array<{ id: string; theme?: string; artPrompt?: string }>;
    };
    for (const id of B19_WRAPS) {
      const weapon = WEAPONS[id]!;
      for (const [index, point] of (weapon.muzzle?.points ?? []).entries()) {
        const path = `packages/client/public/sprites/${id}/part-${index + 1}.png`;
        const png = PNG.sync.read(readFileSync(path));
        expect(point.part, `${id}/part-${index + 1}`).toBe(index);
        expect(point.x, `${id}/part-${index + 1}`).toBeGreaterThanOrEqual(0);
        expect(point.x, `${id}/part-${index + 1}`).toBeLessThan(png.width);
        expect(point.y, `${id}/part-${index + 1}`).toBeGreaterThanOrEqual(0);
        expect(point.y, `${id}/part-${index + 1}`).toBeLessThan(png.height);
        const x = Math.round(point.x);
        const y = Math.round(point.y);
        expect(png.data[(y * png.width + x) * 4 + 3], `${id} anchor alpha`).toBeGreaterThan(16);
      }
      const row = source.weapons.find((candidate) => candidate.id === id);
      expect(row, id).toBeDefined();
      expect(`${row?.theme ?? ""} ${row?.artPrompt ?? ""}`, id).not.toMatch(
        /\b(?:tassel|rope|dangling|loose chain)\b/i,
      );
    }
  });
});
