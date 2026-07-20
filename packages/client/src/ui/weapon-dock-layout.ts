// Dock consumers import the authority projection beside the pure geometry API; the implementation lives
// separately so its unit tests never need Phaser or layout fixtures.
export { type LoadoutEntryView, loadoutEntryView } from "./loadout-entry-view.js";

export type WeaponDockPoint = { x: number; y: number };

export type WeaponDockLayout = {
  scale: number;
  idleScale?: number;
  junctionSize: number;
  junction: WeaponDockPoint;
  cornerLeft: number;
  cornerTop: number;
  bottomChipWidth: number;
  bottomChipHeight: number;
  rightChipWidth: number;
  rightChipHeight: number;
  gap: number;
  bottom: WeaponDockPoint[];
  right: WeaponDockPoint[];
  bottomTab: WeaponDockPoint;
  rightTab: WeaponDockPoint;
  bottomOccupiedLeft: number;
  rightOccupiedTop: number;
  focus: WeaponDockPoint & { scale: number; width?: number; height?: number };
  positionBar?: { x: number; y: number; width: number; height: number };
};

export type WeaponDockLayoutInput = {
  screenWidth: number;
  screenHeight: number;
  rosterCount: number;
  bottomVisible: number;
  rightVisible: number;
  leftStop: number;
  topStop: number;
  safeRight?: number;
  safeBottom?: number;
};

export type BackpackModalLayout = {
  mode: "wide" | "floor" | "safety";
  panel: { x: number; y: number; width: number; height: number };
  header: { x: number; y: number; width: number; height: number };
  grid: { x: number; y: number; width: number; height: number };
  detail: { x: number; y: number; width: number; height: number };
  dock: { x: number; y: number; width: number; height: number };
  cells: Array<{ x: number; y: number; width: number; height: number }>;
};

/** Wide idle multiplier; floor geometry returns the exact 96/128 ratio through `layout.idleScale`. */
export const IDLE_DOCK_SCALE = 116 / 152;

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function halfPixel(value: number): number {
  return Math.round(value * 2) / 2;
}

/** Exact fixed-cell modal tiers from the Armory panel spec. */
export function backpackModalLayout(screenWidth: number, screenHeight: number): BackpackModalLayout {
  const width = Math.max(1, screenWidth);
  const height = Math.max(1, screenHeight);
  const mode = width >= 1_440 && height >= 800 ? "wide" : width >= 1_280 && height >= 720 ? "floor" : "safety";
  const wide = mode === "wide";
  const panelWidth = Math.min(width - (wide ? 96 : 32), wide ? 1_536 : 1_184);
  const panelHeight = Math.min(height - (wide ? 96 : 32), wide ? 824 : 624);
  const panel = {
    x: halfPixel((width - panelWidth) / 2),
    y: halfPixel((height - panelHeight) / 2),
    width: panelWidth,
    height: panelHeight,
  };
  const headerHeight = wide ? 72 : 64;
  const dockHeight = wide ? 120 : 100;
  const contentPadding = 24;
  const gap = 16;
  const detailWidth = Math.min(wide ? 432 : 360, panelWidth * 0.34);
  const gridWidth = panelWidth - contentPadding * 2 - gap - detailWidth;
  const contentY = panel.y + headerHeight;
  const contentHeight = panelHeight - headerHeight - dockHeight;
  const grid = { x: panel.x + contentPadding, y: contentY, width: gridWidth, height: contentHeight };
  const detail = {
    x: grid.x + grid.width + gap,
    y: contentY,
    width: detailWidth,
    height: contentHeight,
  };
  const dock = {
    x: panel.x,
    y: panel.y + panel.height - dockHeight,
    width: panel.width,
    height: dockHeight,
  };
  const cellWidth = wide ? 244 : 181;
  const cellHeight = wide ? 176 : 136;
  const cellGap = wide ? 12 : 8;
  const usedWidth = cellWidth * 4 + cellGap * 3;
  const usedHeight = cellHeight * 3 + cellGap * 2;
  const cellX = grid.x + Math.max(0, (grid.width - usedWidth) / 2);
  const cellY = grid.y + Math.max(0, (grid.height - usedHeight) / 2);
  const cells = Array.from({ length: 12 }, (_, index) => ({
    x: halfPixel(cellX + (index % 4) * (cellWidth + cellGap)),
    y: halfPixel(cellY + Math.floor(index / 4) * (cellHeight + cellGap)),
    width: cellWidth,
    height: cellHeight,
  }));
  return { mode, panel, header: { x: panel.x, y: panel.y, width: panel.width, height: headerHeight }, grid, detail, dock, cells };
}

/** CSS-pixel layout for the retained five-chip mirrored-L dock and one lazy focus card. */
export function weaponDockLayout(input: WeaponDockLayoutInput): WeaponDockLayout {
  const width = Math.max(1, input.screenWidth);
  const height = Math.max(1, input.screenHeight);
  const viewportScale = clamp(Math.min(width / 1920, height / 1080), 2 / 3, 1);
  const t = clamp((viewportScale - 2 / 3) * 3, 0, 1);
  const lerp = (floor: number, wide: number): number => floor + (wide - floor) * t;
  const rightInset = Math.max(input.safeRight ?? 0, lerp(16, 24));
  const bottomInset = Math.max(input.safeBottom ?? 0, lerp(16, 24));
  const junctionSize = halfPixel(lerp(128, 152));
  const cornerLeft = halfPixel(width - rightInset - junctionSize);
  const cornerTop = halfPixel(height - bottomInset - junctionSize);
  const wantedBottom = Math.max(0, Math.min(2, Math.floor(input.bottomVisible)));
  const wantedRight = Math.max(0, Math.min(2, Math.floor(input.rightVisible)));
  const baseBottomWidth = lerp(88, 104);
  const baseBottomHeight = lerp(64, 72);
  const baseRightWidth = lerp(64, 72);
  const baseRightHeight = lerp(88, 104);
  const baseGap = lerp(8, 12);
  const bottomSpan = wantedBottom * (baseBottomWidth + baseGap);
  const rightSpan = wantedRight * (baseRightHeight + baseGap);
  const fit = clamp(
    Math.min(
      1,
      bottomSpan > 0 ? (cornerLeft - input.leftStop) / bottomSpan : 1,
      rightSpan > 0 ? (cornerTop - input.topStop) / rightSpan : 1,
    ),
    0.8,
    1,
  );
  const bottomChipWidth = halfPixel(baseBottomWidth * fit);
  const bottomChipHeight = halfPixel(baseBottomHeight * fit);
  const rightChipWidth = halfPixel(baseRightWidth * fit);
  const rightChipHeight = halfPixel(baseRightHeight * fit);
  const gap = halfPixel(Math.max(4, baseGap * fit));
  const bottom: WeaponDockPoint[] = [];
  const right: WeaponDockPoint[] = [];
  for (let index = 0; index < wantedBottom; index++) {
    const step = index + 1;
    const x = cornerLeft - step * (bottomChipWidth + gap) + bottomChipWidth / 2;
    if (x - bottomChipWidth / 2 < input.leftStop) break;
    bottom.push({ x: halfPixel(x), y: halfPixel(height - bottomInset - bottomChipHeight / 2) });
  }
  for (let index = 0; index < wantedRight; index++) {
    const step = index + 1;
    const y = cornerTop - step * (rightChipHeight + gap) + rightChipHeight / 2;
    if (y - rightChipHeight / 2 < input.topStop) break;
    right.push({ x: halfPixel(width - rightInset - rightChipWidth / 2), y: halfPixel(y) });
  }
  const bottomOccupiedLeft =
    bottom.length > 0 ? (bottom[bottom.length - 1]?.x ?? cornerLeft) - bottomChipWidth / 2 : cornerLeft;
  const rightOccupiedTop =
    right.length > 0 ? (right[right.length - 1]?.y ?? cornerTop) - rightChipHeight / 2 : cornerTop;
  const bottomTab = {
    x: halfPixel(bottomOccupiedLeft - lerp(12, 16)),
    y: halfPixel(height - bottomInset - bottomChipHeight / 2),
  };
  const rightTab = {
    x: halfPixel(width - rightInset - rightChipWidth / 2),
    y: halfPixel(rightOccupiedTop - lerp(12, 16)),
  };
  const focusWidth = lerp(320, 360);
  const focusHeight = lerp(456, 520);
  const focusRight = cornerLeft - lerp(8, 12);
  const focusBottom = cornerTop - lerp(8, 12);
  return {
    scale: 1,
    idleScale: lerp(96, 116) / junctionSize,
    junctionSize,
    junction: {
      x: halfPixel(cornerLeft + junctionSize / 2),
      y: halfPixel(cornerTop + junctionSize / 2),
    },
    cornerLeft,
    cornerTop,
    bottomChipWidth,
    bottomChipHeight,
    rightChipWidth,
    rightChipHeight,
    gap,
    bottom,
    right,
    bottomTab,
    rightTab,
    bottomOccupiedLeft: halfPixel(Math.min(bottomOccupiedLeft, bottomTab.x - 8)),
    rightOccupiedTop: halfPixel(Math.min(rightOccupiedTop, rightTab.y - 7)),
    focus: {
      x: halfPixel(focusRight - focusWidth / 2),
      y: halfPixel(focusBottom - focusHeight / 2),
      scale: focusWidth / 360,
      width: focusWidth,
      height: focusHeight,
    },
    positionBar: {
      x: halfPixel(cornerLeft - lerp(176, 224)),
      y: halfPixel(height - bottomInset - lerp(18, 22)),
      width: lerp(144, 192),
      height: 6,
    },
  };
}

/** Preserve the carousel's strict even-roster tie behavior. */
export function wrappedDockOffset(index: number, selectedIndex: number, count: number): number {
  if (count <= 0 || selectedIndex < 0) return 0;
  let offset = index - selectedIndex;
  if (offset > count / 2) offset -= count;
  if (offset < -count / 2) offset += count;
  return offset;
}
