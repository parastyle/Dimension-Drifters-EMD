export interface WardrobeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WardrobeViewportLayout {
  mode: "wide" | "floor" | "safety";
  scale: number;
  centerX: number;
  centerY: number;
  panelRect: WardrobeRect;
  headerRect: WardrobeRect;
  footerRect: WardrobeRect;
  bodyRect: WardrobeRect;
  slotRailRect: WardrobeRect;
  slotRects: WardrobeRect[];
  heroRect: WardrobeRect;
  heroArtRect: WardrobeRect;
  companionShelfRect: WardrobeRect;
  catalogRect: WardrobeRect;
  catalogToolbarRect: WardrobeRect;
  catalogViewportRect: WardrobeRect;
  detailRect: WardrobeRect;
  detailArtRect: WardrobeRect;
  presetChipRects: WardrobeRect[];
  gridColumns: number;
  gridGap: number;
  gridRowHeight: number;
  tilePoolSize: number;
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

export const WARDROBE_PANEL_WIDTH = 1_920;
export const WARDROBE_PANEL_HEIGHT = 1_080;
export const WARDROBE_ITEM_CARD_WIDTH = 208;
export const WARDROBE_ITEM_CARD_HEIGHT = 216;
export const WARDROBE_ITEM_TEXT_WIDTH = 188;

/** Compatibility coordinates owned by the opaque bounds-derived preview. Callers may transform its root. */
export const WARDROBE_LAYOUT = {
  panel: { x: 0, y: 0, width: WARDROBE_PANEL_WIDTH, height: WARDROBE_PANEL_HEIGHT },
  heading: { x: 0, y: 0 },
  headerTitle: { x: 0, y: 0, width: 640, height: 30 },
  presetRow: { x: 0, y: 0, width: 640, height: 48 },
  presetChipRects: [] as WardrobeRect[],
  pagePrevious: { x: 0, y: 0 },
  pageNext: { x: 0, y: 0 },
  slotX: 0,
  slotStartY: 0,
  slotStepY: 0,
  itemX: 0,
  itemStartY: 0,
  itemStepY: 0,
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
    x: (index % 3) * (WARDROBE_ITEM_CARD_WIDTH + 12),
    y: Math.floor(index / 3) * (WARDROBE_ITEM_CARD_HEIGHT + 12),
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

export function wardrobeViewportLayout(width: number, height: number): WardrobeViewportLayout {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const mode = safeWidth >= 1_440 && safeHeight >= 720 ? "wide" : safeWidth >= 1_280 ? "floor" : "safety";
  const floor = mode !== "wide";
  const margin = floor ? 16 : 24;
  const gap = floor ? 8 : 12;
  const headerHeight = floor ? 72 : 88;
  const footerHeight = floor ? 60 : 64;
  const bodyY = floor ? 84 : 100;
  const bodyHeight = Math.max(360, safeHeight - bodyY - footerHeight - (floor ? 0 : gap));
  const slotWidth = floor ? Math.min(80, safeWidth * 0.07) : 132;
  const heroWidth = floor ? Math.max(300, Math.min(384, safeWidth * 0.3)) : Math.min(620, safeWidth * 0.323);
  const detailWidth = floor ? Math.min(292, Math.round(safeWidth * 0.228)) : 404;
  const remaining = safeWidth - margin * 2 - gap * 3 - slotWidth - heroWidth - detailWidth;
  const catalogWidth = Math.max(floor ? 360 : 420, remaining);
  const slotRailRect = { x: margin, y: bodyY, width: slotWidth, height: bodyHeight };
  const heroRect = { x: slotRailRect.x + slotWidth + gap, y: bodyY, width: heroWidth, height: bodyHeight };
  const catalogRect = { x: heroRect.x + heroWidth + gap, y: bodyY, width: catalogWidth, height: bodyHeight };
  const detailRect = {
    x: Math.min(safeWidth - margin - detailWidth, catalogRect.x + catalogRect.width + gap),
    y: bodyY,
    width: detailWidth,
    height: bodyHeight,
  };
  const padding = floor ? 12 : 16;
  const toolbarHeight = floor ? 144 : 132;
  const gridColumns = floor || safeWidth < 1_800 ? 2 : 3;
  const gridGap = floor ? 8 : 12;
  const tileWidth = (catalogRect.width - padding * 2 - gridGap * (gridColumns - 1)) / gridColumns;
  const tileHeight = floor ? 184 : 216;
  const gridRowHeight = tileHeight + gridGap;
  const visibleRows = floor ? 2 : 3;
  const catalogViewportRect = {
    x: catalogRect.x + padding,
    y: catalogRect.y + padding + toolbarHeight,
    width: catalogRect.width - padding * 2,
    height: Math.min(visibleRows * gridRowHeight - gridGap, bodyHeight - padding * 2 - toolbarHeight),
  };
  const itemCardRects = Array.from({ length: floor ? 8 : 15 }, (_, index) => ({
    x: catalogViewportRect.x + (index % gridColumns) * (tileWidth + gridGap),
    y: catalogViewportRect.y + Math.floor(index / gridColumns) * gridRowHeight,
    width: tileWidth,
    height: tileHeight,
  }));
  const companionHeight = floor ? 112 : 128;
  const companionShelfRect = {
    x: heroRect.x + padding,
    y: heroRect.y + heroRect.height - companionHeight - padding,
    width: heroRect.width - padding * 2,
    height: companionHeight,
  };
  const heroArtRect = {
    x: heroRect.x + padding,
    y: heroRect.y + padding,
    width: heroRect.width - padding * 2,
    height: companionShelfRect.y - heroRect.y - padding * 2,
  };
  const slotGap = floor ? 8 : 8;
  const slotHeight = Math.max(48, (slotRailRect.height - padding * 2 - slotGap * 7) / 8);
  const slotRects = Array.from({ length: 8 }, (_, index) => ({
    x: slotRailRect.x + padding / 2,
    y: slotRailRect.y + padding + index * (slotHeight + slotGap),
    width: slotRailRect.width - padding,
    height: slotHeight,
  }));
  const presetWidth = floor ? 48 : 76;
  const presetChipRects = Array.from({ length: 6 }, (_, index) => ({
    x: margin + 250 + index * (presetWidth + 8),
    y: floor ? 14 : 20,
    width: presetWidth,
    height: 48,
  }));
  const headerRect = { x: margin, y: 0, width: safeWidth - margin * 2, height: headerHeight };
  const footerRect = {
    x: margin,
    y: safeHeight - footerHeight,
    width: safeWidth - margin * 2,
    height: footerHeight,
  };
  const detailArtRect = {
    x: detailRect.x + padding,
    y: detailRect.y + (floor ? 132 : 148),
    width: detailRect.width - padding * 2,
    height: floor ? 120 : 160,
  };
  const collectionsRect = {
    x: detailRect.x + padding,
    y: detailArtRect.y + detailArtRect.height + 92,
    width: detailRect.width - padding * 2,
    height: Math.max(112, detailRect.height - (detailArtRect.y - detailRect.y) - detailArtRect.height - 180),
  };
  const prestigeRect = {
    x: heroRect.x + padding,
    y: heroRect.y + padding,
    width: heroRect.width - padding * 2,
    height: Math.min(260, heroArtRect.height),
  };
  return {
    mode,
    scale: 1,
    centerX: 0,
    centerY: 0,
    panelRect: { x: 0, y: 0, width: safeWidth, height: safeHeight },
    headerRect,
    footerRect,
    bodyRect: { x: margin, y: bodyY, width: safeWidth - margin * 2, height: bodyHeight },
    slotRailRect,
    slotRects,
    heroRect,
    heroArtRect,
    companionShelfRect,
    catalogRect,
    catalogToolbarRect: {
      x: catalogRect.x + padding,
      y: catalogRect.y + padding,
      width: catalogRect.width - padding * 2,
      height: toolbarHeight - gap,
    },
    catalogViewportRect,
    detailRect,
    detailArtRect,
    presetChipRects,
    gridColumns,
    gridGap,
    gridRowHeight,
    tilePoolSize: floor ? 8 : 15,
    headerTitleRect: { x: margin + 16, y: 14, width: 210, height: headerHeight - 24 },
    presetRowRect: {
      x: presetChipRects[0]?.x ?? margin,
      y: presetChipRects[0]?.y ?? 0,
      width: 6 * presetWidth + 5 * 8,
      height: 48,
    },
    itemCardRects,
    itemCardTextRects: itemCardRects.map((card) => ({
      x: card.x + 10,
      y: card.y + card.height * 0.62,
      width: card.width - 20,
      height: card.height * 0.34,
    })),
    collectionsRect,
    prestigeRect,
    prestigeSurvivorRect: { x: prestigeRect.x + 16, y: prestigeRect.y + 120, width: prestigeRect.width - 32, height: Math.max(40, prestigeRect.height - 136) },
    previewArtRect: { ...heroArtRect, height: Math.max(1, heroArtRect.height - 44) },
    previewCaptionRect: { x: heroArtRect.x, y: heroArtRect.y + heroArtRect.height - 44, width: heroArtRect.width, height: 20 },
    previewStatusRect: { x: heroArtRect.x, y: heroArtRect.y + heroArtRect.height - 22, width: heroArtRect.width, height: 20 },
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
