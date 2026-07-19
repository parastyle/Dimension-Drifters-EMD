import { BOSS_DEF_IDS } from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

// ArenaScene owns the pure summon geometry, but its render module extends Phaser classes. A callable proxy is
// sufficient for module definition; the tests below execute only summonMenuLayout's number-only path.
vi.mock("phaser", () => {
  const target = function PhaserStub() {};
  let stub: unknown;
  stub = new Proxy(target, {
    get(inner, property) {
      if (property === "prototype") return inner.prototype;
      if (property === Symbol.toPrimitive) return () => 0;
      return stub;
    },
    apply: () => 0,
    construct: () => ({}),
  });
  return { default: stub };
});

const { summonMenuLayout } = await import("./ArenaScene.js");

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

function overlaps(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

function gridRects(
  panelX: number,
  startY: number,
  count: number,
  columns: number,
  width: number,
  height: number,
  gap: number,
  rowGap: number,
): Rect[] {
  return Array.from({ length: count }, (_unused, index) => ({
    x: panelX + 24 + (index % columns) * (width + gap),
    y: startY + Math.floor(index / columns) * rowGap - height / 2,
    width,
    height,
  }));
}

describe("ArenaScene Testing-Grounds summon layout", () => {
  it.each([
    [1_280, 720],
    [1_600, 900],
    [1_920, 1_080],
    [3_840, 2_160],
  ])("keeps every final-size control disjoint and inside the panel at %d×%d", (width, height) => {
    const layout = summonMenuLayout(width, height);
    const enemies = gridRects(
      layout.panel.x,
      layout.enemyStartY,
      8,
      layout.columns,
      layout.buttonWidth,
      layout.buttonHeight,
      layout.gap,
      layout.rowGap,
    );
    const bosses = gridRects(
      layout.panel.x,
      layout.bossStartY,
      layout.bossPageSize,
      layout.columns,
      layout.buttonWidth,
      layout.buttonHeight,
      layout.gap,
      layout.rowGap,
    );
    const pager: Rect[] = [
      { x: width / 2 - 140, y: layout.pagerY - 16, width: 72, height: 32 },
      { x: width / 2 + 68, y: layout.pagerY - 16, width: 72, height: 32 },
    ];
    const footer = {
      x: layout.panel.x + 24,
      y: layout.footerY - 8,
      width: layout.panel.width - 48,
      height: 16,
    };
    const controls = [...enemies, ...bosses, ...pager, footer];

    controls.forEach((control) => {
      expect(contains(layout.panel, control)).toBe(true);
    });
    for (let i = 0; i < controls.length; i++) {
      for (let j = i + 1; j < controls.length; j++) {
        const left = controls[i];
        const right = controls[j];
        if (!left || !right) throw new Error("missing summon control rectangle");
        expect(overlaps(left, right)).toBe(false);
      }
    }
    expect(layout.titleY).toBeLessThan(layout.hintY);
    expect(layout.hintY).toBeLessThan(layout.controlsY);
    expect(layout.controlsY).toBeLessThan(layout.enemyLabelY);
    expect(layout.enemyLabelY).toBeLessThan(layout.enemyStartY - layout.buttonHeight / 2);
    expect(layout.bossLabelY).toBeLessThan(layout.bossStartY - layout.buttonHeight / 2);
  });

  it("pages the current boss roster instead of extending it below the viewport", () => {
    const layout = summonMenuLayout(1_280, 720);
    const bossCount = 1 + BOSS_DEF_IDS.length; // classic Old Rust + all bespoke definitions
    expect(layout.bossPageSize).toBe(8);
    expect(Math.ceil(bossCount / layout.bossPageSize)).toBe(2);
  });
});
