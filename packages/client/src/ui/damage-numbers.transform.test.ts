import { describe, expect, it } from "vitest";
import type { DamageNumberEvent } from "../combat-feedback.js";
import type { FeedbackSettings } from "../settings.js";
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

interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

function localMatrix(
  x: number,
  y: number,
  rotation: number,
  scaleX: number,
  scaleY: number,
): Matrix {
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return {
    a: cosine * scaleX,
    b: sine * scaleX,
    c: -sine * scaleY,
    d: cosine * scaleY,
    tx: x,
    ty: y,
  };
}

function multiply(left: Matrix, right: Matrix): Matrix {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    tx: left.a * right.tx + left.c * right.ty + left.tx,
    ty: left.b * right.tx + left.d * right.ty + left.ty,
  };
}

function point(matrix: Matrix, x = 0, y = 0): { x: number; y: number } {
  return {
    x: matrix.a * x + matrix.c * y + matrix.tx,
    y: matrix.b * x + matrix.d * y + matrix.ty,
  };
}

interface FakeLabel {
  active: boolean;
  parentContainer: FakeContainer | null;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  fontSize: number;
  setOrigin(): FakeLabel;
  setScale(x: number, y?: number): FakeLabel;
  setRotation(value: number): FakeLabel;
  setVisible(): FakeLabel;
  setFont(key: string, size: number): FakeLabel;
  setFontSize(size: number): FakeLabel;
  setText(): FakeLabel;
  setPosition(x: number, y: number): FakeLabel;
  setAlpha(): FakeLabel;
  destroy(): void;
}

interface FakeContainer {
  active: boolean;
  parentContainer: null;
  scrollFactorX: number;
  scrollFactorY: number;
  children: FakeLabel[];
  setScrollFactor(x: number, y?: number): FakeContainer;
  setDepth(): FakeContainer;
  add(label: FakeLabel): FakeContainer;
  destroy(): void;
}

function makeLabel(): FakeLabel {
  return {
    active: true,
    parentContainer: null,
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    fontSize: 14,
    setOrigin() {
      return this;
    },
    setScale(x: number, y = x) {
      this.scaleX = x;
      this.scaleY = y;
      return this;
    },
    setRotation(value: number) {
      this.rotation = value;
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
    setPosition(x: number, y: number) {
      this.x = x;
      this.y = y;
      return this;
    },
    setAlpha() {
      return this;
    },
    destroy() {
      this.active = false;
    },
  };
}

function makeContainer(): FakeContainer {
  return {
    active: true,
    parentContainer: null,
    scrollFactorX: 1,
    scrollFactorY: 1,
    children: [],
    setScrollFactor(x: number, y = x) {
      this.scrollFactorX = x;
      this.scrollFactorY = y;
      return this;
    },
    setDepth() {
      return this;
    },
    add(label: FakeLabel) {
      label.parentContainer = this;
      this.children.push(label);
      return this;
    },
    destroy() {
      this.active = false;
    },
  };
}

describe("DamageNumberRenderer live transform chain", () => {
  it("projects a nested reflected hit through camera pan/zoom while keeping the screen baseline upright", () => {
    const labels: FakeLabel[] = [];
    const roots: FakeContainer[] = [];
    const camera = {
      scrollX: 173,
      scrollY: 91,
      rotation: 0.37,
      zoomX: 1.65,
      zoomY: 1.65,
    };
    const scene = {
      cameras: { main: camera },
      textures: { exists: () => true },
      cache: { bitmapFont: { has: () => true } },
      add: {
        container: () => {
          const root = makeContainer();
          roots.push(root);
          return root;
        },
        bitmapText: () => {
          const label = makeLabel();
          labels.push(label);
          return label;
        },
      },
    };

    // Source-local point -> reflected actor -> rotated world group. This is the parent chain that the
    // old helper-only test never exercised.
    const worldGroup = localMatrix(520, 270, -0.23, 1.2, 0.8);
    const reflectedActor = localMatrix(38, -17, 0.41, -1, 1);
    const hitSocket = localMatrix(24, -31, -0.12, 0.9, 1.1);
    const hitWorld = point(multiply(multiply(worldGroup, reflectedActor), hitSocket));

    const renderer = new DamageNumberRenderer(scene as never, settings, () => false, 1, {
      ...DEFAULT_DAMAGE_NUMBER_TUNING,
      maxLabels: 1,
    });
    const event: DamageNumberEvent = {
      targetId: "nested-owner",
      damage: 12,
      x: hitWorld.x,
      y: hitWorld.y,
      visible: true,
      attribution: "self",
      crit: false,
      finalBlow: false,
      selfDamage: false,
    };
    renderer.beginFrame();
    renderer.add(event, 0);
    renderer.update(16, 16, false);

    const root = roots[0];
    const glyph = labels[0];
    const progress = 16 / 600;
    expect(root).toMatchObject({ scrollFactorX: 0, scrollFactorY: 0 });
    expect(glyph?.parentContainer).toBe(root);
    expect(glyph?.x).toBeCloseTo(hitWorld.x - camera.scrollX - 8 * progress, 4);
    expect(glyph?.y).toBeCloseTo(hitWorld.y - camera.scrollY - 30 * progress, 4);

    const cameraLinear = localMatrix(0, 0, camera.rotation, camera.zoomX, camera.zoomY);
    const glyphLinear = localMatrix(
      0,
      0,
      glyph?.rotation ?? 0,
      glyph?.scaleX ?? 0,
      glyph?.scaleY ?? 0,
    );
    const screenLinear = multiply(cameraLinear, glyphLinear);
    expect(screenLinear.a).toBeGreaterThan(0);
    expect(screenLinear.b).toBeCloseTo(0, 10);
    expect(screenLinear.a * screenLinear.d - screenLinear.b * screenLinear.c).toBeGreaterThan(0);

    renderer.destroy();
  });
});
