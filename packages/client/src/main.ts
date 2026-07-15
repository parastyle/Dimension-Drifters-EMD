import Phaser from "phaser";
import { RENDER_DPR } from "./render-dpr.js";
import { MenuScene } from "./scenes/MenuScene.js";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-root",
  backgroundColor: "#1a1320",
  // §17 MenuScene is the only boot scene; it imports + registers ArenaScene on demand before every launch,
  // keeping the arena/net/registry graph out of first paint. §29 `?belt=1` still selects its belt renderer.
  scene: [MenuScene],
  scale: {
    // §28 crispness: the DRAWING BUFFER is the window size × RENDER_DPR (so it matches the physical
    // display), but the canvas is DISPLAYED at the CSS window size (`zoom = 1/RENDER_DPR`). RESIZE mode
    // would force the buffer back to 1× CSS, so we size manually (NONE) and re-resize on window changes.
    // ArenaScene zooms the world camera by RENDER_DPR so the visible slice is unchanged — just sharper.
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

// Keep the buffer at window × RENDER_DPR as the window resizes (NONE mode doesn't auto-fit).
window.addEventListener("resize", () => {
  game.scale.resize(window.innerWidth * RENDER_DPR, window.innerHeight * RENDER_DPR);
});

// Debug handle — lets us inspect scale/camera state from the console. Harmless to ship.
(globalThis as unknown as { ddGame: Phaser.Game }).ddGame = game;
