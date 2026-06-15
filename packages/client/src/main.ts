import Phaser from "phaser";
import { ArenaScene } from "./scenes/ArenaScene.js";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-root",
  backgroundColor: "#1a1320",
  scene: [ArenaScene],
  scale: {
    // Fill the #game-root host (which is pinned to the full viewport). RESIZE keeps the
    // canvas === window so the free-roam camera shows a window-sized slice of the arena.
    mode: Phaser.Scale.RESIZE,
    width: "100%",
    height: "100%",
  },
  // Drive the game loop with setTimeout instead of requestAnimationFrame. rAF is parked by
  // the OS/compositor whenever a window isn't being presented (unfocused, occluded, or
  // launched without foreground), which froze the loop ("arena renders, nothing spawns").
  // setTimeout keeps firing — paired with the Electron shell's disable-background-timer-
  // throttling switch (packages/desktop/main.cjs), the sim/render run regardless of window
  // state. (smoothStep:false avoids the rAF-timestamp delta path entirely.)
  fps: {
    target: 60,
    forceSetTimeOut: true,
    smoothStep: false,
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

// Debug handle — lets us inspect scale/camera state from the console. Harmless to ship.
(globalThis as unknown as { ddGame: Phaser.Game }).ddGame = game;
