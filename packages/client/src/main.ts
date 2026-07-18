import Phaser from "phaser";
import { RENDER_DPR, updateRenderDpr } from "./render-dpr.js";
import { MenuScene } from "./scenes/MenuScene.js";
import { loadSettings, onSettingsChange, type RenderScaleMode } from "./settings.js";

let renderScaleMode: RenderScaleMode = loadSettings().rendering.renderScale;
updateRenderDpr(
  window.innerWidth,
  window.innerHeight,
  window.devicePixelRatio || 1,
  renderScaleMode,
);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-root",
  backgroundColor: "#1a1320",
  // §17 MenuScene is the only boot scene; it imports + registers ArenaScene on demand before every launch,
  // keeping the arena/net/registry graph out of first paint. §29 `?belt=1` still selects its belt renderer.
  scene: [MenuScene],
  scale: {
    // §28 crispness: the DRAWING BUFFER is CSS size × the pixel-budgeted RENDER_DPR, while the canvas is
    // DISPLAYED at CSS size (`zoom = 1/RENDER_DPR`). RESIZE mode would force the buffer back to 1× CSS,
    // so we size manually (NONE). Scene camera zoom keeps the visible world and UI layout unchanged.
    mode: Phaser.Scale.NONE,
    width: window.innerWidth * RENDER_DPR,
    height: window.innerHeight * RENDER_DPR,
    zoom: 1 / RENDER_DPR,
  },
  // §37 loop driver: requestAnimationFrame in a BROWSER (vsync-locked, smooth, and the browser tab is
  // presented so rAF never parks), but setTimeout under the ELECTRON desktop shell — there rAF is throttled
  // when the window is unfocused/occluded (froze the loop: "arena renders, nothing spawns"), and the shell's
  // disable-background-timer-throttling switch keeps setTimeout firing. Forcing setTimeout in a plain browser
  // tab caps + stutters FPS (no vsync, ~4ms clamp), so only force it where it's actually needed.
  // smoothStep TRUE either way — averaging the timestep keeps movement + belt camera scroll smooth.
  fps: {
    target: 60,
    forceSetTimeOut: /electron/i.test(navigator.userAgent),
    smoothStep: true,
  },
  render: {
    // HD sprites are pre-sized to ~2x their on-screen footprint at install time (see
    // tools/artkit/harvest-install.mjs), but they still rotate (weapons track aim) and scale
    // a little during animation, so the residual minification needs proper filtering:
    antialias: true, // LINEAR texture filtering (not NEAREST/pixel-art) — smooth scaling
    mipmapFilter: "LINEAR_MIPMAP_LINEAR", // trilinear mips kill the rotate/downscale shimmer (WebGL2 NPOT)
    // §37 MSAA OFF — the framebuffer-resolve cost scales with the hi-DPI buffer and the big textured belt
    // deck/backdrop; `antialias` (linear filtering) + trilinear mips already carry most of the smoothing, so
    // dropping MSAA is a real GPU win for only a slight softening of rotated sprite edges.
    antialiasGL: false,
    roundPixels: false, // sub-pixel placement so motion stays smooth, not steppy
  },
});

// NONE mode doesn't auto-fit. Coalesce resize storms, then update the live DPR before Phaser notifies
// scene resize handlers; cameras and CSS-space UI therefore observe one consistent buffer/scale pair.
let resizeFrame = 0;
function requestRendererResize(): void {
  if (resizeFrame !== 0) return;
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0;
    const cssWidth = Math.max(1, window.innerWidth);
    const cssHeight = Math.max(1, window.innerHeight);
    const renderDpr = updateRenderDpr(
      cssWidth,
      cssHeight,
      window.devicePixelRatio || 1,
      renderScaleMode,
    );
    // ScaleManager.resize reads this public zoom while updating both canvas CSS size and its buffer.
    game.scale.zoom = 1 / renderDpr;
    game.scale.resize(cssWidth * renderDpr, cssHeight * renderDpr);
  });
}

window.addEventListener("resize", requestRendererResize);
onSettingsChange((settings) => {
  if (settings.rendering.renderScale === renderScaleMode) return;
  renderScaleMode = settings.rendering.renderScale;
  requestRendererResize();
});

// Debug handle — lets us inspect scale/camera state from the console. Harmless to ship.
(globalThis as unknown as { ddGame: Phaser.Game }).ddGame = game;
