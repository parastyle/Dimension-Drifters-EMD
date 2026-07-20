import type Phaser from "phaser";
import type { OnboardingSettings } from "../settings.js";

export type ContextHintId =
  | "beamOverheat"
  | "juggle"
  | "ultimateReady"
  | "pitFall"
  | "empoweredReturn";

interface ContextHintDefinition {
  readonly copy: string;
  readonly color: string;
}

export const CONTEXT_HINTS: Readonly<Record<ContextHintId, ContextHintDefinition>> = {
  beamOverheat: { copy: "DRIVE empty · [RMB] Release", color: "#ffb26b" },
  juggle: { copy: "[LMB] Air parry", color: "#e8f5ff" },
  ultimateReady: { copy: "[F] Ultimate", color: "#a8f1e8" },
  pitFall: { copy: "[Space] Hold to leap gaps", color: "#ff9a78" },
  empoweredReturn: {
    copy: "Gold glint — parry again or step out",
    color: "#ffd66b",
  },
};

const HINT_DURATION_MS = 2_200;
const HINT_THROTTLE_MS = 3_200;
const HINT_FADE_IN_MS = 120;
const HINT_FADE_OUT_MS = 260;
const LEGEND_WIDTH = 760;
const LEGEND_HEIGHT = 490;

export interface VerbLegendSurface {
  layout(width: number, height: number): void;
  setLegendVisible(visible: boolean): void;
  showHint(copy: string, color: string): void;
  setHintAlpha(alpha: number): void;
  hideHint(): void;
  destroy(): void;
}

interface VerbLegendManagerOptions {
  readonly onboarding: OnboardingSettings;
  readonly persist: (onboarding: OnboardingSettings) => void;
  readonly reducedMotion: boolean;
  readonly scene?: Phaser.Scene;
  readonly surface?: VerbLegendSurface;
}

function createText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  copy: string,
  style: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, copy, style).setResolution(2);
}

class PhaserVerbLegendSurface implements VerbLegendSurface {
  private readonly legendDim: Phaser.GameObjects.Rectangle;
  private readonly legendPanel: Phaser.GameObjects.Container;
  private readonly hintRoot: Phaser.GameObjects.Container;
  private readonly hintText: Phaser.GameObjects.Text;
  private width = -1;
  private height = -1;

  constructor(scene: Phaser.Scene) {
    this.legendDim = scene.add
      .rectangle(0, 0, 1, 1, 0x05070a, 0.82)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(100060)
      .setVisible(false);

    const panel = scene.add.graphics();
    panel
      .fillStyle(0x0b1016, 0.98)
      .fillRoundedRect(-LEGEND_WIDTH / 2, -LEGEND_HEIGHT / 2, LEGEND_WIDTH, LEGEND_HEIGHT, 14)
      .lineStyle(2, 0x8ba7b8, 0.72)
      .strokeRoundedRect(-LEGEND_WIDTH / 2, -LEGEND_HEIGHT / 2, LEGEND_WIDTH, LEGEND_HEIGHT, 14)
      .lineStyle(1, 0x263947, 0.9)
      .lineBetween(0, -156, 0, 100)
      .lineBetween(-342, 112, 342, 112);

    const title = createText(scene, 0, -214, "VERB LEGEND", {
      fontFamily: "Arial, sans-serif",
      fontSize: "24px",
      fontStyle: "bold",
      color: "#f4e5bc",
      stroke: "#05070a",
      strokeThickness: 3,
    }).setOrigin(0.5);
    const intro = createText(
      scene,
      0,
      -178,
      "Move clean. Read the glint. Commit to the response.",
      {
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        color: "#aebcc5",
      },
    ).setOrigin(0.5);
    const left = createText(
      scene,
      -342,
      -146,
      [
        "[WASD] Move",
        "[Space] Tap to jump",
        "[Space] Hold to crouch, release to leap",
        "[Space] Tap in air to pound",
        "[Shift/Ctrl] Slide · Safe at the start",
        "[Space] Jump during a slide to hop",
        "[LMB] Parry white glints · Air-parry juggles",
      ].join("\n"),
      {
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        color: "#e6edf1",
        lineSpacing: 8,
      },
    );
    const right = createText(
      scene,
      24,
      -146,
      [
        "[RMB] Fire · Hold to channel",
        "[RMB] Release to vent",
        "[F] Ultimate · Unlock through stat picks",
        "[E] Pick up / interact",
        "[Q] Next weapon or slot",
        "[Z/X] Previous/next gallery page",
        "[T] Enter Testing Grounds",
        "[G/T] Game / weapon note in Grounds",
        "[1–3] Equip slot",
        "[Tab] Backpack",
        "[C] Change cosmetic",
      ].join("\n"),
      {
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        color: "#e6edf1",
        lineSpacing: 8,
      },
    );
    const responseTitle = createText(scene, -342, 126, "RESPONSE LANGUAGE", {
      fontFamily: "Arial, sans-serif",
      fontSize: "12px",
      fontStyle: "bold",
      color: "#91a5b1",
    });
    const white = createText(scene, -342, 152, "WHITE GLINT — PARRY", {
      fontFamily: "Arial, sans-serif",
      fontSize: "15px",
      fontStyle: "bold",
      color: "#f5fbff",
      stroke: "#05070a",
      strokeThickness: 3,
    });
    const gold = createText(scene, -342, 178, "GOLD GLINT — EMPOWERED · PARRY AGAIN OR STEP OUT", {
      fontFamily: "Arial, sans-serif",
      fontSize: "15px",
      fontStyle: "bold",
      color: "#ffd66b",
      stroke: "#05070a",
      strokeThickness: 3,
    });
    const red = createText(scene, 176, 152, "RED — MOVE", {
      fontFamily: "Arial, sans-serif",
      fontSize: "15px",
      fontStyle: "bold",
      color: "#ff705c",
      stroke: "#05070a",
      strokeThickness: 3,
    });
    const footer = createText(scene, 342, 214, "[H] Close", {
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      fontStyle: "bold",
      color: "#c7d8e2",
    }).setOrigin(1, 0.5);

    this.legendPanel = scene.add
      .container(0, 0, [panel, title, intro, left, right, responseTitle, white, gold, red, footer])
      .setScrollFactor(0)
      .setDepth(100061)
      .setVisible(false);

    const hintBack = scene.add.graphics();
    hintBack
      .fillStyle(0x080b0f, 0.88)
      .fillRoundedRect(-226, -22, 452, 44, 8)
      .lineStyle(1, 0x7f929e, 0.68)
      .strokeRoundedRect(-226, -22, 452, 44, 8);
    this.hintText = createText(scene, 0, 0, "", {
      fontFamily: "Arial, sans-serif",
      fontSize: "15px",
      fontStyle: "bold",
      color: "#f5fbff",
      stroke: "#080b0f",
      strokeThickness: 4,
    }).setOrigin(0.5);
    // Protected response geometry owns 99997–99998. The prompt stays below it and cannot cover a tell.
    this.hintRoot = scene.add
      .container(0, 0, [hintBack, this.hintText])
      .setScrollFactor(0)
      .setDepth(99996)
      .setVisible(false)
      .setAlpha(0);
  }

  layout(width: number, height: number): void {
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.legendDim.setDisplaySize(width, height);
    const scale = Math.max(
      0.62,
      Math.min(1, (width - 32) / LEGEND_WIDTH, (height - 32) / LEGEND_HEIGHT),
    );
    this.legendPanel.setPosition(width / 2, height / 2).setScale(scale);
    this.hintRoot.setPosition(width / 2, Math.max(72, Math.min(170, height * 0.22)));
  }

  setLegendVisible(visible: boolean): void {
    this.legendDim.setVisible(visible);
    this.legendPanel.setVisible(visible);
  }

  showHint(copy: string, color: string): void {
    this.hintText.setText(copy).setColor(color);
    this.hintRoot.setVisible(true);
  }

  setHintAlpha(alpha: number): void {
    this.hintRoot.setAlpha(alpha);
  }

  hideHint(): void {
    this.hintRoot.setVisible(false).setAlpha(0);
  }

  destroy(): void {
    this.legendDim.destroy();
    this.legendPanel.destroy(true);
    this.hintRoot.destroy(true);
  }
}

/** One retained surface owns the first-run legend and the single pooled contextual prompt. */
export class VerbLegendManager {
  private readonly surface: VerbLegendSurface;
  private readonly persist: (onboarding: OnboardingSettings) => void;
  private readonly reducedMotion: boolean;
  private readonly onboarding: OnboardingSettings;
  private legendOpen = false;
  private inputReleaseLatch = false;
  private activeHint?: ContextHintId;
  private hintStartedAt = -1e9;
  private hintEndsAt = -1e9;
  private lastHintAt = -1e9;
  private width = -1;
  private height = -1;

  constructor(options: VerbLegendManagerOptions) {
    if (options.surface) {
      this.surface = options.surface;
    } else if (options.scene) {
      this.surface = new PhaserVerbLegendSurface(options.scene);
    } else {
      throw new Error("VerbLegendManager requires a scene or surface");
    }
    this.persist = options.persist;
    this.reducedMotion = options.reducedMotion;
    this.onboarding = {
      verbLegendSeen: options.onboarding.verbLegendSeen,
      contextHints: { ...options.onboarding.contextHints },
    };
  }

  showFirstRun(nowMs: number): boolean {
    if (this.onboarding.verbLegendSeen) return false;
    this.onboarding.verbLegendSeen = true;
    this.persistSnapshot();
    this.openLegend(nowMs);
    return true;
  }

  toggleLegend(nowMs: number): void {
    if (this.legendOpen) {
      this.legendOpen = false;
      this.inputReleaseLatch = true;
      this.surface.setLegendVisible(false);
      this.lastHintAt = nowMs;
      return;
    }
    this.openLegend(nowMs);
  }

  closeForCompetingModal(nowMs: number): void {
    if (!this.legendOpen) return;
    this.legendOpen = false;
    this.inputReleaseLatch = true;
    this.surface.setLegendVisible(false);
    this.lastHintAt = nowMs;
  }

  releaseInputLatchIf(inputsReleased: boolean): void {
    if (this.inputReleaseLatch && inputsReleased) this.inputReleaseLatch = false;
  }

  offerHint(id: ContextHintId, nowMs: number): boolean {
    if (
      this.legendOpen ||
      this.activeHint !== undefined ||
      nowMs - this.lastHintAt < HINT_THROTTLE_MS ||
      this.onboarding.contextHints[id] >= 2
    ) {
      return false;
    }
    this.onboarding.contextHints[id]++;
    this.persistSnapshot();
    const hint = CONTEXT_HINTS[id];
    this.activeHint = id;
    this.hintStartedAt = nowMs;
    this.hintEndsAt = nowMs + HINT_DURATION_MS;
    this.lastHintAt = nowMs;
    this.surface.showHint(hint.copy, hint.color);
    this.surface.setHintAlpha(this.reducedMotion ? 1 : 0);
    return true;
  }

  retireHint(): void {
    if (this.activeHint === undefined) return;
    this.activeHint = undefined;
    this.surface.hideHint();
  }

  update(nowMs: number, width: number, height: number): void {
    if (width !== this.width || height !== this.height) {
      this.width = width;
      this.height = height;
      this.surface.layout(width, height);
    }
    if (this.activeHint === undefined) return;
    if (nowMs >= this.hintEndsAt) {
      this.retireHint();
      return;
    }
    if (this.reducedMotion) {
      this.surface.setHintAlpha(1);
      return;
    }
    const fadeIn = Math.min(1, (nowMs - this.hintStartedAt) / HINT_FADE_IN_MS);
    const fadeOut = Math.min(1, (this.hintEndsAt - nowMs) / HINT_FADE_OUT_MS);
    this.surface.setHintAlpha(Math.max(0, Math.min(fadeIn, fadeOut)));
  }

  isModalBlocking(): boolean {
    return this.legendOpen || this.inputReleaseLatch;
  }

  isLegendOpen(): boolean {
    return this.legendOpen;
  }

  hasInputReleaseLatch(): boolean {
    return this.inputReleaseLatch;
  }

  activeHintId(): ContextHintId | undefined {
    return this.activeHint;
  }

  destroy(): void {
    this.surface.destroy();
  }

  private openLegend(nowMs: number): void {
    this.retireHint();
    this.legendOpen = true;
    this.inputReleaseLatch = false;
    this.lastHintAt = nowMs;
    this.surface.setLegendVisible(true);
  }

  private persistSnapshot(): void {
    this.persist({
      verbLegendSeen: this.onboarding.verbLegendSeen,
      contextHints: { ...this.onboarding.contextHints },
    });
  }
}
