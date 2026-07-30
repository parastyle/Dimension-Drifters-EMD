import Phaser from "phaser";
import { BattleStage } from "./BattleStage.js";

/**
 * SLICE 1 host scene for the squad-autobattler direction (see `docs/DESIGN_LOG.md`, 2026-07-28).
 *
 * Right now this is the Overgrown Ruin backdrop and nothing else — no units, no beats, no parry. It
 * exists so the art can be judged in the engine rather than in a preview composite, and so there is a
 * real place for the fight to be built into: everything gameplay goes into `stage.actorLayer`.
 *
 * Deliberately standalone. It does not touch ArenaScene, the server, or any existing system, so the
 * current game keeps working untouched while this direction is prototyped.
 */
export class BattleScene extends Phaser.Scene {
  private stage?: BattleStage;

  constructor() {
    super("battle");
  }

  preload(): void {
    BattleStage.preload(this);
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#05070a");
    this.stage = new BattleStage(this);

    // Placeholder marker so the actor layer is provably in the right depth band — it must sit above
    // the ferns and below the lens overlay. Delete once real units land here.
    const label = this.add
      .text(1920, 1080, "ACTOR LAYER", {
        fontFamily: "monospace",
        fontSize: "64px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setAlpha(0.28);
    this.stage.actorLayer.add(label);
  }

  override update(_time: number, deltaMs: number): void {
    this.stage?.update(deltaMs);
  }

  shutdown(): void {
    this.stage?.destroy();
    this.stage = undefined;
  }
}
