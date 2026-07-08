import Phaser from "phaser";
import { RENDER_DPR } from "./render-dpr.js";
import { ArenaScene } from "./scenes/ArenaScene.js";
import { MenuScene } from "./scenes/MenuScene.js";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-root",
  backgroundColor: "#1a1320",
  // §17 MenuScene is FIRST → it auto-starts (Phaser starts only the first scene in the list); picking a
  // dimension calls scene.start("arena", { dimensionId }). ArenaScene stays registered but dormant.
  // §29 belt-scroller mode lives INSIDE ArenaScene (all systems intact) — `?belt=1` makes it render belt.
  scene: [MenuScene, ArenaScene],
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
  // Drive the game loop with setTimeout instead of requestAnimationFrame. rAF is parked by
  // the OS/compositor whenever a window isn't being presented (unfocused, occluded, or
  // launched without foreground), which froze the loop ("arena renders, nothing spawns").
  // setTimeout keeps firing — paired with the Electron shell's disable-background-timer-
  // throttling switch (packages/desktop/main.cjs), the sim/render run regardless of window
  // state. §29 v0.118: smoothStep TRUE — the setTimeout clock jitters frame-to-frame, and feeding that raw
  // delta into movement + the belt CAMERA SCROLL read as stutter (worst on the belt's horizontal scroll).
  // Phaser's delta smoothing averages the timestep → smooth motion; the server stays authoritative so the
  // smoothed client delta can't affect sim correctness.
  fps: {
    target: 60,
    forceSetTimeOut: true,
    smoothStep: true,
  },
  render: {
    // HD sprites are pre-sized to ~2x their on-screen footprint at install time (see
    // tools/artkit/harvest-install.mjs), but they still rotate (weapons track aim) and scale
    // a little during animation, so the residual minification needs proper filtering:
    antialias: true, // LINEAR texture filtering (not NEAREST/pixel-art) — smooth scaling
    mipmapFilter: "LINEAR_MIPMAP_LINEAR", // trilinear mips kill the rotate/downscale shimmer (WebGL2 NPOT)
    antialiasGL: true, // MSAA on the framebuffer — smooths rotated sprite edges
    roundPixels: false, // sub-pixel placement so motion stays smooth, not steppy
  },
});

// Keep the buffer at window × RENDER_DPR as the window resizes (NONE mode doesn't auto-fit).
window.addEventListener("resize", () => {
  game.scale.resize(window.innerWidth * RENDER_DPR, window.innerHeight * RENDER_DPR);
});

// Debug handle — lets us inspect scale/camera state from the console. Harmless to ship.
(globalThis as unknown as { ddGame: Phaser.Game }).ddGame = game;
