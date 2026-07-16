export type LevelUpMode = "flex" | "signature";
export type LevelUpLayoutTier = "wide" | "medium" | "compact";

export interface LevelUpCardSlot {
  x: number;
  y: number;
  width: number;
  height: number;
  horizontal: boolean;
}

export interface LevelUpLayout {
  tier: LevelUpLayoutTier;
  panelX: number;
  panelY: number;
  panelWidth: number;
  panelHeight: number;
  titleY: number;
  contextY: number;
  timerY: number;
  timerLeft: number;
  timerWidth: number;
  footerY: number;
  cards: LevelUpCardSlot[];
}

function layoutTier(width: number, height: number): LevelUpLayoutTier {
  if (width >= 980 && height >= 620) return "wide";
  if (width >= 620) return "medium";
  return "compact";
}

/** CSS-pixel layout. ArenaScene's DPR-aware screenW/screenH already return this coordinate space. */
export function levelUpLayout(
  screenWidth: number,
  screenHeight: number,
  mode: LevelUpMode,
  choiceCount: number,
): LevelUpLayout {
  const tier = layoutTier(screenWidth, screenHeight);
  const safe = tier === "compact" ? 12 : 16;
  const maxWidth = tier === "wide" ? 1040 : tier === "medium" ? 920 : 560;
  const maxHeight = tier === "wide" ? 590 : tier === "medium" ? 500 : 700;
  const panelWidth = Math.max(280, Math.min(screenWidth - safe * 2, maxWidth));
  const panelHeight = Math.max(300, Math.min(screenHeight - safe * 2, maxHeight));
  const panelX = (screenWidth - panelWidth) / 2;
  const panelY = (screenHeight - panelHeight) / 2;
  const titleY = panelY + (tier === "wide" ? 30 : 24);
  const contextY = panelY + (tier === "wide" ? 62 : 50);
  const timerY = panelY + (tier === "wide" ? 94 : 76);
  const inset = tier === "wide" ? 28 : tier === "medium" ? 18 : 12;
  const timerLeft = panelX + inset;
  const timerWidth = panelWidth - inset * 2;
  const footerY = panelY + panelHeight - (tier === "wide" ? 25 : 18);
  const cardTop = panelY + (tier === "wide" ? 126 : tier === "medium" ? 101 : 99);
  const cardBottom = footerY - (tier === "wide" ? 34 : 24);
  const availableHeight = Math.max(44, cardBottom - cardTop);
  const innerWidth = panelWidth - inset * 2;
  const count = Math.max(1, choiceCount);
  const cards: LevelUpCardSlot[] = [];

  if (tier === "wide") {
    const gap = mode === "flex" ? 12 : 18;
    const width = (innerWidth - gap * (count - 1)) / count;
    const height = Math.min(availableHeight, mode === "flex" ? 340 : 350);
    const y = cardTop + (availableHeight - height) / 2 + height / 2;
    for (let i = 0; i < count; i++) {
      cards.push({
        x: timerLeft + width / 2 + i * (width + gap),
        y,
        width,
        height,
        horizontal: false,
      });
    }
  } else if (tier === "medium" && mode === "flex") {
    const columns = 3;
    const rows = Math.ceil(count / columns);
    const gap = 10;
    const width = (innerWidth - gap * (columns - 1)) / columns;
    const height = Math.max(44, (availableHeight - gap * (rows - 1)) / rows);
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / columns);
      const rowStart = row * columns;
      const rowCount = Math.min(columns, count - rowStart);
      const rowWidth = rowCount * width + (rowCount - 1) * gap;
      const left = panelX + (panelWidth - rowWidth) / 2;
      const column = i - rowStart;
      cards.push({
        x: left + width / 2 + column * (width + gap),
        y: cardTop + height / 2 + row * (height + gap),
        width,
        height,
        horizontal: height < 155,
      });
    }
  } else if (tier === "medium") {
    const gap = 10;
    const width = (innerWidth - gap * (count - 1)) / count;
    const height = Math.min(availableHeight, 250);
    const y = cardTop + (availableHeight - height) / 2 + height / 2;
    for (let i = 0; i < count; i++) {
      cards.push({
        x: timerLeft + width / 2 + i * (width + gap),
        y,
        width,
        height,
        horizontal: height < 170,
      });
    }
  } else {
    const gap = 6;
    const maxCardHeight = mode === "flex" ? 92 : 112;
    const height = Math.max(
      44,
      Math.min(maxCardHeight, (availableHeight - gap * (count - 1)) / count),
    );
    const blockHeight = count * height + (count - 1) * gap;
    const startY = cardTop + Math.max(0, (availableHeight - blockHeight) / 2);
    for (let i = 0; i < count; i++) {
      cards.push({
        x: panelX + panelWidth / 2,
        y: startY + height / 2 + i * (height + gap),
        width: innerWidth,
        height,
        horizontal: true,
      });
    }
  }

  return {
    tier,
    panelX,
    panelY,
    panelWidth,
    panelHeight,
    titleY,
    contextY,
    timerY,
    timerLeft,
    timerWidth,
    footerY,
    cards,
  };
}

export function levelUpLayoutKey(screenWidth: number, screenHeight: number): string {
  const width = Math.round(screenWidth);
  const height = Math.round(screenHeight);
  return `${layoutTier(width, height)}:${width}x${height}`;
}
