import type { RenderScaleMode } from "./settings.js";

/** Midpoint of the audit's recommended 6-10 MP total drawing-buffer budget. */
export const AUTO_RENDER_PIXEL_BUDGET = 8_000_000;
export const MIN_RENDER_DPR = 1;
export const MAX_RENDER_DPR = 2;
export const MIN_TEXT_DPR = 2;

function positiveFinite(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Chooses one uniform drawing-buffer scale while leaving CSS and visible world dimensions unchanged.
 * Auto mode spends at most 8 MP unless a 1x CSS-pixel buffer already exceeds that budget. Native mode
 * retains the old device-DPR behavior (capped at 2x); performance mode fixes the buffer at 1x.
 */
export function chooseRenderDpr(
  cssWidth: number,
  cssHeight: number,
  deviceDpr: number,
  mode: RenderScaleMode = "auto",
  pixelBudget = AUTO_RENDER_PIXEL_BUDGET,
): number {
  const width = positiveFinite(cssWidth, 1);
  const height = positiveFinite(cssHeight, 1);
  const nativeDpr = Math.min(
    MAX_RENDER_DPR,
    Math.max(MIN_RENDER_DPR, positiveFinite(deviceDpr, MIN_RENDER_DPR)),
  );

  if (mode === "performance") return MIN_RENDER_DPR;
  if (mode === "native") return nativeDpr;

  const budget = positiveFinite(pixelBudget, AUTO_RENDER_PIXEL_BUDGET);
  const budgetDpr = Math.sqrt(budget / (width * height));
  return Math.min(nativeDpr, Math.max(MIN_RENDER_DPR, budgetDpr));
}

function browserRenderDpr(): number {
  if (typeof window === "undefined") return MIN_RENDER_DPR;
  return chooseRenderDpr(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
}

/**
 * Live renderer scale shared by the Scale Manager and scene cameras. Main updates it before emitting a
 * Phaser resize event, so existing scene resize callbacks always observe the matching scale.
 */
export let RENDER_DPR = browserRenderDpr();

export function updateRenderDpr(
  cssWidth: number,
  cssHeight: number,
  deviceDpr: number,
  mode: RenderScaleMode,
): number {
  RENDER_DPR = chooseRenderDpr(cssWidth, cssHeight, deviceDpr, mode);
  return RENDER_DPR;
}

/** UI texture density stays crisp even when the world framebuffer is budgeted down to 1x. */
export function textRenderDpr(renderDpr = RENDER_DPR): number {
  return Math.max(MIN_TEXT_DPR, Math.ceil(positiveFinite(renderDpr, MIN_RENDER_DPR)));
}
