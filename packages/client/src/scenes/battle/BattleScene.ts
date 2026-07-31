import Phaser from "phaser";
import {
  budgetedCameraShakeIntensity,
  type CameraShakeSource,
} from "../../camera-shake.js";
import { BattleStage } from "./BattleStage.js";
import { BattleFight } from "./BattleFight.js";

/**
 * SLICE 1 host scene for the squad-autobattler direction (see `docs/DESIGN_LOG.md`, 2026-07-28).
 *
 * Two halves, deliberately kept apart:
 *   - `BattleStage` is the Overgrown Ruin backdrop, driven entirely by its art manifest.
 *   - `BattleFight` is the 4v4 encounter, built into the stage's `actorLayer`.
 *
 * Standalone by design. It does not touch ArenaScene, the server, or any existing system, so the
 * current game keeps working untouched while this direction is prototyped.
 *
 * The question this slice exists to answer is not "does it run" — it is "is 90 seconds of this fun?",
 * which only playing it can settle.
 */
export class BattleScene extends Phaser.Scene {
  private stage?: BattleStage;
  private fight?: BattleFight;

  constructor() {
    super("battle");
  }

  preload(): void {
    BattleStage.preload(this);
    BattleFight.preload(this);
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#05070a");
    this.stage = new BattleStage(this);
    this.fight = new BattleFight(this, this.stage.actorLayer);

    // R restarts the encounter with a NEW seed — the fight is short and meant to be re-run.
    this.input.keyboard?.on("keydown-R", () => this.scene.restart());
    this.input.keyboard?.on("keydown-F", () => this.toggleWidescreen());
  }

  /**
   * The scene's camera-shake adapter.
   *
   * `camera-shake.test.ts` pins raw `cameras.main.shake` to a short audited list so every shake passes
   * through the player-weapon budget and nothing can quietly spam the camera. A new scene with its own
   * camera needs its own adapter rather than an exemption, so this is it — and the scene is registered in
   * that list alongside the arena's.
   *
   * Every shake here is `world`: they are discrete events (a death, a parry you landed), not the continuous
   * self-inflicted recoil the player-weapon budget exists to damp.
   */
  shakeCam(durationMs: number, intensity: number, source: CameraShakeSource = "world"): void {
    this.cameras.main.shake(durationMs, budgetedCameraShakeIntensity(intensity, source), true);
  }

  /**
   * 4K widescreen toggle.
   *
   * The stage art is authored at 3840x2160 and the scene letterboxes it into whatever viewport exists, so
   * "4K" here means giving it a viewport big enough to draw 1:1 instead of downscaled. Fullscreen does
   * that: `main.ts` resizes the drawing buffer to the CSS window times the chosen render DPR, so on a 4K
   * display a fullscreen window lands on a 3840x2160 buffer and every stage layer renders at native size.
   *
   * The HUD prints the live buffer dimensions rather than claiming a mode, because whether you actually get
   * 4K depends on the display and OS scaling — it should be verifiable, not asserted.
   */
  private toggleWidescreen(): void {
    if (this.scale.isFullscreen) this.scale.stopFullscreen();
    else this.scale.startFullscreen();
  }

  override update(_time: number, deltaMs: number): void {
    this.stage?.update(deltaMs);
    this.fight?.update(deltaMs);
  }

  shutdown(): void {
    this.fight?.destroy();
    this.fight = undefined;
    this.stage?.destroy();
    this.stage = undefined;
  }
}
