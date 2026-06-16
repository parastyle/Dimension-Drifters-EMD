/**
 * Device-pixel-ratio the renderer draws at (§28 crispness). Phaser's RESIZE scale mode locks the
 * drawing buffer to the CSS size, so on a hi-DPI display (e.g. 1.5×) the 1× buffer is upscaled and
 * looks soft. The fix renders the buffer at CSS × this value:
 *   - `main.ts` sizes the drawing buffer to `window.inner* × RENDER_DPR` and displays it at CSS size
 *     (`scale.zoom = 1 / RENDER_DPR`).
 *   - `ArenaScene` zooms the world camera by `RENDER_DPR` (so the visible world area is unchanged) and
 *     lays out the screen-space UI in CSS units via `cam.width / RENDER_DPR`.
 * ONE source of truth so the two can't drift. **Set to 1 to disable hi-DPI rendering (revert).**
 * Capped at 2 so 3×/4× phones don't pay a 9–16× fill cost.
 */
export const RENDER_DPR = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
