export interface WardrobeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WardrobeViewportLayout {
  scale: number;
  centerX: number;
  centerY: number;
  panelRect: WardrobeRect;
  headerTitleRect: WardrobeRect;
  presetRowRect: WardrobeRect;
  itemCardRects: WardrobeRect[];
  itemCardTextRects: WardrobeRect[];
  collectionsRect: WardrobeRect;
  prestigeRect: WardrobeRect;
  prestigeSurvivorRect: WardrobeRect;
  previewArtRect: WardrobeRect;
  previewCaptionRect: WardrobeRect;
  previewStatusRect: WardrobeRect;
}

export const WARDROBE_PANEL_WIDTH = 1_160;
export const WARDROBE_PANEL_HEIGHT = 440;
export const WARDROBE_ITEM_CARD_WIDTH = 350;
export const WARDROBE_ITEM_CARD_HEIGHT = 40;
export const WARDROBE_ITEM_TEXT_WIDTH = 322;

const panelRect: WardrobeRect = {
  x: -WARDROBE_PANEL_WIDTH / 2,
  y: -WARDROBE_PANEL_HEIGHT / 2,
  width: WARDROBE_PANEL_WIDTH,
  height: WARDROBE_PANEL_HEIGHT,
};

export const WARDROBE_LAYOUT = {
  panel: panelRect,
  heading: { x: -560, y: -204 },
  headerTitle: { x: -560, y: -192, width: 1_120, height: 24 },
  presetRow: { x: -410, y: -158, width: 344, height: 30 },
  presetChipRects: [
    { x: -410, y: -158, width: 84, height: 30 },
    { x: -318, y: -158, width: 44, height: 30 },
    { x: -266, y: -158, width: 44, height: 30 },
    { x: -214, y: -158, width: 44, height: 30 },
    { x: -162, y: -158, width: 44, height: 30 },
    { x: -110, y: -158, width: 44, height: 30 },
  ],
  pagePrevious: { x: 198, y: -143 },
  pageNext: { x: 242, y: -143 },
  slotX: -500,
  slotStartY: -104,
  slotStepY: 36,
  itemX: 60,
  itemStartY: -96,
  itemStepY: 44,
  previewArt: { x: -410, y: -120, width: 240, height: 184 },
  previewCaption: { x: -410, y: 68, width: 240, height: 12 },
  previewStatus: { x: -410, y: 82, width: 240, height: 12 },
  inspector: { x: -410, y: 99, width: 240, height: 91 },
  stats: { x: -130, y: 153, width: 365, height: 34 },
  collections: { x: 270, y: -119, width: 280, height: 124 },
  prestige: { x: 250, y: 12, width: 310, height: 184 },
  prestigeTier: { x: 263, y: 23, width: 284, height: 27 },
  prestigeCost: { x: 263, y: 55, width: 284, height: 52 },
  prestigeSurvivor: { x: 263, y: 111, width: 284, height: 39 },
  prestigeButton: { x: 265, y: 158, width: 280, height: 28 },
  prestigeTrack: { x: 265, y: 190, width: 280, height: 4 },
  footerY: 205,
} as const;

export function wardrobeItemCardRect(index: number): WardrobeRect {
  return {
    x: WARDROBE_LAYOUT.itemX - WARDROBE_ITEM_CARD_WIDTH / 2,
    y:
      WARDROBE_LAYOUT.itemStartY +
      index * WARDROBE_LAYOUT.itemStepY -
      WARDROBE_ITEM_CARD_HEIGHT / 2,
    width: WARDROBE_ITEM_CARD_WIDTH,
    height: WARDROBE_ITEM_CARD_HEIGHT,
  };
}

export function wardrobeItemTextRect(index: number): WardrobeRect {
  const card = wardrobeItemCardRect(index);
  return {
    x: card.x + (card.width - WARDROBE_ITEM_TEXT_WIDTH) / 2,
    y: card.y + 5,
    width: WARDROBE_ITEM_TEXT_WIDTH,
    height: card.height - 10,
  };
}

function viewportRect(
  rect: WardrobeRect,
  scale: number,
  centerX: number,
  centerY: number,
): WardrobeRect {
  return {
    x: centerX + rect.x * scale,
    y: centerY + rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

export function wardrobeViewportLayout(width: number, height: number): WardrobeViewportLayout {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const titleY = Math.max(52, Math.min(86, safeHeight * 0.09));
  const scale = Math.min(
    1,
    (safeWidth - 24) / WARDROBE_PANEL_WIDTH,
    Math.max(0.72, (safeHeight - 300) / WARDROBE_PANEL_HEIGHT),
  );
  const centerX = safeWidth / 2;
  const centerY = titleY + 112 + (WARDROBE_PANEL_HEIGHT / 2) * scale;
  const transform = (rect: WardrobeRect): WardrobeRect =>
    viewportRect(rect, scale, centerX, centerY);
  return {
    scale,
    centerX,
    centerY,
    panelRect: transform(WARDROBE_LAYOUT.panel),
    headerTitleRect: transform(WARDROBE_LAYOUT.headerTitle),
    presetRowRect: transform(WARDROBE_LAYOUT.presetRow),
    itemCardRects: Array.from({ length: 6 }, (_, index) => transform(wardrobeItemCardRect(index))),
    itemCardTextRects: Array.from({ length: 6 }, (_, index) =>
      transform(wardrobeItemTextRect(index)),
    ),
    collectionsRect: transform(WARDROBE_LAYOUT.collections),
    prestigeRect: transform(WARDROBE_LAYOUT.prestige),
    prestigeSurvivorRect: transform(WARDROBE_LAYOUT.prestigeSurvivor),
    previewArtRect: transform(WARDROBE_LAYOUT.previewArt),
    previewCaptionRect: transform(WARDROBE_LAYOUT.previewCaption),
    previewStatusRect: transform(WARDROBE_LAYOUT.previewStatus),
  };
}

export function rectsOverlap(a: WardrobeRect, b: WardrobeRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function rectContains(outer: WardrobeRect, inner: WardrobeRect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/** Binary-search a real renderer's measured width; callers provide Phaser Text or a test double. */
export function truncateMeasuredLine(
  value: string,
  maxWidth: number,
  measureWidth: (candidate: string) => number,
): string {
  if (measureWidth(value) <= maxWidth) return value;
  const ellipsis = "…";
  if (measureWidth(ellipsis) > maxWidth) return "";
  let low = 0;
  let high = value.length;
  let best = ellipsis;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = `${value.slice(0, middle).trimEnd()}${ellipsis}`;
    if (measureWidth(candidate) <= maxWidth) {
      best = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return best;
}

export function truncateMeasuredBlock(
  value: string,
  bounds: Pick<WardrobeRect, "width" | "height">,
  measure: (candidate: string) => { width: number; height: number },
): string {
  const fits = (candidate: string): boolean => {
    const size = measure(candidate);
    return size.width <= bounds.width && size.height <= bounds.height;
  };
  if (fits(value)) return value;
  const ellipsis = "…";
  if (!fits(ellipsis)) return "";
  let low = 0;
  let high = value.length;
  let best = ellipsis;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = `${value.slice(0, middle).trimEnd()}${ellipsis}`;
    if (fits(candidate)) {
      best = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return best;
}
