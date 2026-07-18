import type { WeaponDockLayout } from "./weapon-dock-layout.js";

export interface UltimateHudLayoutInput {
  screenWidth: number;
  screenHeight: number;
  barX: number;
  xpY: number;
  uiScale: number;
  belt: boolean;
  dock?: WeaponDockLayout;
  dockBodyScale?: number;
}

export interface UltimateHudLayout {
  x: number;
  y: number;
  radius: number;
  labelX: number;
  labelY: number;
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/** Ultimate Charge stays distinct on the shoulder opposite the dock's horizontal Drive truth layer. */
export function ultimateHudLayout(input: UltimateHudLayoutInput): UltimateHudLayout {
  const scale = Math.max(0.5, input.uiScale);
  let x = input.barX + 230 * scale;
  let y = input.xpY - 25 * scale;
  let radius = 10 * scale;
  if (!input.belt && input.dock) {
    const dock = input.dock;
    const bodyScale = clamp(input.dockBodyScale ?? 1, 0.1, 2);
    const anchorX = dock.cornerLeft + dock.junctionSize;
    const anchorY = dock.cornerTop + dock.junctionSize;
    x = anchorX + (dock.junction.x - dock.junctionSize * 0.36 - anchorX) * bodyScale;
    y = anchorY + (dock.junction.y - dock.junctionSize * 0.35 - anchorY) * bodyScale;
    radius = Math.max(8, dock.junctionSize * 0.105) * bodyScale;
  }
  const pad = radius + 3;
  x = clamp(x, pad, Math.max(pad, input.screenWidth - pad));
  y = clamp(y, pad, Math.max(pad, input.screenHeight - pad));
  return {
    x,
    y,
    radius,
    labelX: clamp(x - radius - 5 * scale, 4, Math.max(4, input.screenWidth - 4)),
    labelY: clamp(y - radius - 2 * scale, 4, Math.max(4, input.screenHeight - 4)),
  };
}
