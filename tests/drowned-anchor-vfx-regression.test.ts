import {
  bladeAngleAt,
  meleeReach,
  swingDescriptorFor,
  swingDescriptorWithComboStep,
  swingEdgeProgress,
  WEAPONS,
  type SwingDescriptor,
  type WeaponDef,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import "../packages/client/src/vfx/vfx-render.js";

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  width: number;
  color: number;
  alpha: number;
}

class GeometryGraphics {
  readonly fills: Point[][] = [];
  readonly strokes: Stroke[] = [];
  private path: Point[] = [];
  private stroke = { width: 0, color: 0, alpha: 0 };
  private tx = 0;
  private ty = 0;

  save(): this {
    return this;
  }

  restore(): this {
    this.tx = 0;
    this.ty = 0;
    return this;
  }

  translateCanvas(x: number, y: number): this {
    this.tx += x;
    this.ty += y;
    return this;
  }

  fillStyle(): this {
    return this;
  }

  lineStyle(width: number, color: number, alpha: number): this {
    this.stroke = { width, color, alpha };
    return this;
  }

  beginPath(): this {
    this.path = [];
    return this;
  }

  moveTo(x: number, y: number): this {
    this.path.push({ x: x + this.tx, y: y + this.ty });
    return this;
  }

  lineTo(x: number, y: number): this {
    this.path.push({ x: x + this.tx, y: y + this.ty });
    return this;
  }

  closePath(): this {
    return this;
  }

  fillPath(): this {
    this.fills.push(this.path.map((point) => ({ ...point })));
    return this;
  }

  strokePath(): this {
    this.strokes.push({
      points: this.path.map((point) => ({ ...point })),
      ...this.stroke,
    });
    return this;
  }
}

function polygonArea(points: readonly Point[]): number {
  let twiceArea = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (!a || !b) continue;
    twiceArea += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twiceArea) / 2;
}

function weapon(id: string): WeaponDef {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`Missing test weapon: ${id}`);
  return definition;
}

function surfaceFor(definition: WeaponDef, swing: SwingDescriptor, gfx: GeometryGraphics) {
  return {
    scene: { textures: { exists: () => false } },
    perLoading: Object.create(null) as Record<string, boolean>,
    perFrame: {},
    perQuality: 4,
    perWebGL: false,
    gfxAdd: gfx,
    per: {
      swing,
      reach: meleeReach(definition),
      swingArc: definition.swingArc,
      style: swing.style,
      size: definition.tags.size,
      grip: definition.tags.grip,
      family: definition.tags.family,
      paint: 0,
      originX: 0,
      originY: 0,
      edgeProgress: (elapsedSeconds: number) => swingEdgeProgress(swing, elapsedSeconds),
      angleAt: (progress: number) => bladeAngleAt(0, definition.swingArc, progress),
    },
  };
}

function renderLayer(
  id: string,
  surface: ReturnType<typeof surfaceFor>,
  phase: number,
  params: Record<string, number>,
): void {
  const renderer = globalThis.VFXRENDER.R[id] as
    | ((S: ReturnType<typeof surfaceFor>, g: { R: number }, p: number, o: { params: Record<string, number> }) => void)
    | undefined;
  if (!renderer) throw new Error(`Missing renderer: ${id}`);
  renderer(surface, { R: 74 }, phase, { params });
}

describe("Drowned Anchor straight-streak regression", () => {
  it("keeps the diagnosed diameter stroke legacy-only and paints nondegenerate anchor geometry", () => {
    const anchor = weapon("x-sword-anchor");
    const swing = swingDescriptorFor(anchor, anchor.cooldown);
    expect(anchor).toMatchObject({ displayLength: 247.5, gripFrac: 0.1, swingArc: 3.1 });
    expect(swing.style).toBe("orbit");
    expect(swing.comboRibbon).toBeUndefined();
    expect(meleeReach(anchor)).toBeCloseTo(245.55, 8);

    const legacyGfx = new GeometryGraphics();
    renderLayer("cleave-flash-legacy", surfaceFor(anchor, swing, legacyGfx), 0.3, {
      intensity: 0.85,
    });
    expect(legacyGfx.strokes).toHaveLength(1);
    expect(legacyGfx.strokes[0]).toMatchObject({
      width: 4,
      color: 0xf6ffff,
      alpha: 0.85,
      points: [
        { x: -74, y: 29.6 },
        { x: 74, y: -29.6 },
      ],
    });
    const [from, to] = legacyGfx.strokes[0]?.points ?? [];
    expect(((from?.x ?? 0) + (to?.x ?? 0)) / 2).toBe(0);
    expect(((from?.y ?? 0) + (to?.y ?? 0)) / 2).toBe(0);

    // The old artifact peaked at phase 0.3. The production key must emit no stroked segment there.
    const oldPeakGfx = new GeometryGraphics();
    renderLayer("cleave-flash", surfaceFor(anchor, swing, oldPeakGfx), 0.3, {
      intensity: 0.85,
    });
    expect(oldPeakGfx.strokes).toHaveLength(0);

    // At the anchor's actual impact phase, PER's missing-texture path is an arc of positive-area quads,
    // never a zero-area line through the origin.
    const impactGfx = new GeometryGraphics();
    renderLayer("cleave-flash", surfaceFor(anchor, swing, impactGfx), 0.52, {
      intensity: 0.85,
    });
    expect(impactGfx.strokes).toHaveLength(0);
    expect(impactGfx.fills.length).toBeGreaterThan(0);
    for (const polygon of impactGfx.fills) {
      expect(polygonArea(polygon)).toBeGreaterThan(1);
      expect(polygon.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(
        true,
      );
      expect(polygon.every((point) => Math.hypot(point.x, point.y) > 100)).toBe(true);
    }
  });

  it("keeps Twin Bowie Fangs on positive-area twin ribbons with no raw stroke", () => {
    const bowies = weapon("twin-bowie-fangs");
    const base = swingDescriptorFor(bowies, bowies.cooldown);
    const swing = swingDescriptorWithComboStep(base, bowies, 0);
    const gfx = new GeometryGraphics();
    renderLayer("twin-slash", surfaceFor(bowies, swing, gfx), 0.52, {
      reach: 1,
      paint: 0,
      history: 1,
      bodyAlpha: 0.72,
      lipAlpha: 0.54,
      lipColor: 0xd6dde6,
    });
    expect(gfx.strokes).toHaveLength(0);
    expect(gfx.fills.length).toBeGreaterThan(0);
    expect(gfx.fills.every((polygon) => polygonArea(polygon) > 1)).toBe(true);
  });
});
