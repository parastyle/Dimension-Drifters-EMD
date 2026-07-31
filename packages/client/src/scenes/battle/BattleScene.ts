import Phaser from "phaser";
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

    // R restarts the encounter — the fight is short and the whole point is watching it repeatedly.
    this.input.keyboard?.on("keydown-R", () => this.scene.restart());
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
