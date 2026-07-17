export type WeaponDockPoint = {
  x: number;
  y: number;
};

export type WeaponDockLayout = {
  scale: number;
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
  focus: WeaponDockPoint & { scale: number };
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

type DockTier = {
  junction: number;
  bottomWidth: number;
  bottomHeight: number;
  rightWidth: number;
  rightHeight: number;
  gap: number;
};

// AWAKE tier table (dockux-panel §1.2): the dock earns its pixels only while the player uses it —
// awake sizes are ~33% up; the whole dock rides the shared fadeProgress down to IDLE_DOCK_SCALE at rest.
const DOCK_TIERS: readonly DockTier[] = [
  {
    junction: 112,
    bottomWidth: 84,
    bottomHeight: 58,
    rightWidth: 58,
    rightHeight: 84,
    gap: 8,
  },
  {
    junction: 104,
    bottomWidth: 72,
    bottomHeight: 50,
    rightWidth: 50,
    rightHeight: 72,
    gap: 6,
  },
  {
    junction: 96,
    bottomWidth: 60,
    bottomHeight: 44,
    rightWidth: 44,
    rightHeight: 60,
    gap: 5,
  },
];

/** Idle multiplier (dockux-panel §1.2): the whole dock (elbow + arms + tabs) scales by this at rest,
 *  anchored at the bottom-right corner point, riding the existing fade grammar — no new tween. */
export const IDLE_DOCK_SCALE = 0.72;

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function halfPixel(value: number): number {
  return Math.round(value * 2) / 2;
}

function tierFor(rosterCount: number): DockTier {
  if (rosterCount <= 7) return DOCK_TIERS[0] as DockTier;
  if (rosterCount <= 13) return DOCK_TIERS[1] as DockTier;
  return DOCK_TIERS[2] as DockTier;
}

/**
 * CSS-pixel layout for the non-belt mirrored-L dock. Only the two nearest entries on either side are
 * readable; the full cyclic roster is represented separately by the junction's index ticks.
 */
export function weaponDockLayout(input: WeaponDockLayoutInput): WeaponDockLayout {
  const width = Math.max(1, input.screenWidth);
  const height = Math.max(1, input.screenHeight);
  const scale = clamp(Math.min(width / 1600, height / 900), 0.78, 1.25);
  const tier = tierFor(input.rosterCount);
  const rightInset = Math.max(input.safeRight ?? 0, 8 * scale);
  const bottomInset = Math.max(input.safeBottom ?? 0, 8 * scale);
  const junctionSize = halfPixel(tier.junction * scale);
  const cornerLeft = halfPixel(width - rightInset - junctionSize);
  const cornerTop = halfPixel(height - bottomInset - junctionSize);

  const wantedBottom = Math.max(0, Math.min(2, Math.floor(input.bottomVisible)));
  const wantedRight = Math.max(0, Math.min(2, Math.floor(input.rightVisible)));
  const baseBottomWidth = tier.bottomWidth * scale;
  const baseBottomHeight = tier.bottomHeight * scale;
  const baseRightWidth = tier.rightWidth * scale;
  const baseRightHeight = tier.rightHeight * scale;
  const baseGap = tier.gap * scale;
  const bottomSpan = wantedBottom * (baseBottomWidth + baseGap);
  const rightSpan = wantedRight * (baseRightHeight + baseGap);
  // 0.80 floor (dockux-panel §1.2): with the neighbour chips carrying no text they compress slightly
  // less before overflowing to the `+N` tab, keeping the key-hint badges legible.
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
  const gap = halfPixel(Math.max(2, baseGap * fit));
  const bottom: WeaponDockPoint[] = [];
  const right: WeaponDockPoint[] = [];

  for (let index = 0; index < wantedBottom; index++) {
    const step = index + 1;
    const x = cornerLeft - step * (bottomChipWidth + gap) + bottomChipWidth / 2;
    if (x - bottomChipWidth / 2 < input.leftStop) break;
    bottom.push({
      x: halfPixel(x),
      y: halfPixel(height - bottomInset - bottomChipHeight / 2),
    });
  }
  for (let index = 0; index < wantedRight; index++) {
    const step = index + 1;
    const y = cornerTop - step * (rightChipHeight + gap) + rightChipHeight / 2;
    if (y - rightChipHeight / 2 < input.topStop) break;
    right.push({
      x: halfPixel(width - rightInset - rightChipWidth / 2),
      y: halfPixel(y),
    });
  }

  const bottomOccupiedLeft =
    bottom.length > 0
      ? (bottom[bottom.length - 1] as WeaponDockPoint).x - bottomChipWidth / 2
      : cornerLeft;
  const rightOccupiedTop =
    right.length > 0
      ? (right[right.length - 1] as WeaponDockPoint).y - rightChipHeight / 2
      : cornerTop;
  const bottomTab = {
    x: halfPixel(bottomOccupiedLeft - 11 * scale),
    y: halfPixel(height - bottomInset - bottomChipHeight / 2),
  };
  const rightTab = {
    x: halfPixel(width - rightInset - rightChipWidth / 2),
    y: halfPixel(rightOccupiedTop - 10 * scale),
  };

  let focusScale = clamp(scale, 0.82, 1);
  let focusWidth = 212 * focusScale;
  let focusHeight = 296 * focusScale;
  const focusRight = cornerLeft - 12 * scale;
  const focusBottom = cornerTop - 12 * scale;
  // Fallback squeeze raised 0.74 → 0.78 (dockux-panel §1.2): the inspector may overlap the
  // (hidden-while-focused) rails before it shrinks.
  if (focusRight - focusWidth < 8 * scale || focusBottom - focusHeight < 8 * scale) {
    focusScale = 0.78;
    focusWidth = 212 * focusScale;
    focusHeight = 296 * focusScale;
  }

  return {
    scale,
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
    bottomOccupiedLeft: halfPixel(Math.min(bottomOccupiedLeft, bottomTab.x - 8 * scale)),
    rightOccupiedTop: halfPixel(Math.min(rightOccupiedTop, rightTab.y - 7 * scale)),
    focus: {
      x: halfPixel(focusRight - focusWidth / 2),
      y: halfPixel(focusBottom - focusHeight / 2),
      scale: focusScale,
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
