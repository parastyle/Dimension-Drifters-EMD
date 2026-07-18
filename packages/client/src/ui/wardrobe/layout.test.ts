import { describe, expect, it } from "vitest";
import {
  rectContains,
  rectsOverlap,
  truncateMeasuredLine,
  WARDROBE_ITEM_TEXT_WIDTH,
  wardrobeViewportLayout,
} from "./layout.js";

const supportedWardrobeViewports = [
  { width: 1_280, height: 720 },
  { width: 1_600, height: 900 },
  { width: 1_920, height: 1_080 },
] as const;

// METAGAME WAVE 7B — append-only regression coverage for the rejected wardrobe collision classes.
describe("wardrobe responsive layout", () => {
  it.each(
    supportedWardrobeViewports,
  )("keeps header controls, preview labels, collections, and prestige disjoint at $width×$height", ({
    width,
    height,
  }) => {
    const layout = wardrobeViewportLayout(width, height);
    expect(rectsOverlap(layout.headerTitleRect, layout.presetRowRect)).toBe(false);
    expect(rectsOverlap(layout.previewArtRect, layout.previewCaptionRect)).toBe(false);
    expect(rectsOverlap(layout.previewCaptionRect, layout.previewStatusRect)).toBe(false);
    expect(rectsOverlap(layout.collectionsRect, layout.prestigeRect)).toBe(false);
    expect(rectContains(layout.prestigeRect, layout.prestigeSurvivorRect)).toBe(true);
    expect(rectContains(layout.panelRect, layout.collectionsRect)).toBe(true);
    expect(rectContains(layout.panelRect, layout.prestigeRect)).toBe(true);
  });

  it.each(
    supportedWardrobeViewports,
  )("fits measured item descriptions inside every card at $width×$height", ({ width, height }) => {
    const layout = wardrobeViewportLayout(width, height);
    const description =
      "Ultimate · A successful parry heals the nearest ally within 220 px for the same amount";
    const measureWidth = (candidate: string): number => candidate.length * 6.15;
    const fitted = truncateMeasuredLine(description, WARDROBE_ITEM_TEXT_WIDTH, measureWidth);

    expect(fitted.endsWith("…")).toBe(true);
    layout.itemCardRects.forEach((card, index) => {
      const text = layout.itemCardTextRects[index];
      if (!text) throw new Error(`missing text rectangle ${index}`);
      expect(rectContains(card, text)).toBe(true);
      expect(measureWidth(fitted) * layout.scale).toBeLessThanOrEqual(text.width);
    });
  });
});
