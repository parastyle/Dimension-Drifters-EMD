// Ambient types for the canonical VFX core (plain-JS modules shared with the Weaponsmith). They set
// globals as a side effect; this lets TS accept the side-effect imports + the globalThis access.
declare module "*/vfx-render.js";
declare module "*/vfx-layers.js";

declare global {
  interface VfxSurface {
    scene: unknown;
    container: unknown;
    suite: Record<string, { on: boolean; params: Record<string, number> }>;
    fired: Record<string, number>;
    R: number;
    heroEnabled?: boolean;
    wantHeroKey?: string | null;
    heroImg?: unknown;
    gfxAdd?: { clear(): void };
    emit?: unknown;
    emitStreak?: unknown;
    eScatter?: unknown;
    scatterMeta?: unknown;
    paintedImpact?: (params: Record<string, number>) => void;
  }

  interface VfxRender {
    ensureTextures(scene: unknown): void;
    attachSurface(scene: unknown, S: VfxSurface): void;
    loadScatter(S: VfxSurface, url: string, frameW: number, frameH: number, count: number): void;
    renderLayers(S: VfxSurface, p: number, mode: "swing" | "impact" | "all", cyc: number): void;
    renderHero(scene: unknown, S: VfxSurface, p: number): void;
    R: Record<string, unknown>;
    PARTS: Record<string, unknown>;
    makePerRope(scene: unknown): unknown;
    updateLinearRope(
      rope: unknown,
      key: string,
      frame: number,
      quality: 4 | 8 | 12,
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      width: number,
      alpha: number,
      color: number,
      phase?: number,
      normalWobble?: number,
    ): boolean;
  }

  interface VfxLayers {
    LAYERS: Record<
      string,
      {
        label: string;
        trigger: string;
        anchor: "character" | "weapon" | "muzzle" | "flight" | "target";
        params: { key: string; def: number }[];
      }
    >;
    ORDER: string[];
    CYCLE: number;
  }

  // eslint-disable-next-line no-var
  var VFXRENDER: VfxRender;
  // eslint-disable-next-line no-var
  var VFXLAYERS: VfxLayers;
}

export {};
