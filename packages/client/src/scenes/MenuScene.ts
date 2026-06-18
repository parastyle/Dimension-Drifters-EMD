import { DEFAULT_DIMENSION, DIMENSION_IDS, getDimension } from "@dd/shared";
import Phaser from "phaser";
import { RENDER_DPR } from "../render-dpr.js";

/**
 * §17 title / dimension-select screen — the first scene. Lists every dimension as a themed card (its own
 * palette as the swatch + frame); click one (or press its number) to launch the run, which hands the pick
 * to `ArenaScene` via `scene.start("arena", { dimensionId })`. ArenaScene forwards it as the room's
 * `dimensionId` join option (only the room CREATOR's pick takes effect; joiners inherit the host's synced
 * dimension). Screen-space + DPR-aware, mirroring ArenaScene's hi-DPI camera so it stays crisp + responsive
 * from a laptop up to a 4K ultrawide.
 *
 * Cards are a FIXED size (built once at full size so each card's input hit area matches its geometry — a
 * resize only re-flows their grid POSITIONS, never their size, so clicks always land).
 */

const CARD_W = 288;
const CARD_H = 172;
const TITLE_COLOR = "#f0e6d2";
const ACCENT = "#33e6ff";

/** One rendered dimension card — its container is repositioned by `layout()` on every resize. */
interface MenuCard {
  id: string;
  root: Phaser.GameObjects.Container;
}

export class MenuScene extends Phaser.Scene {
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private cards: MenuCard[] = [];

  constructor() {
    super("menu");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0f0c14");
    // Mirror ArenaScene's hi-DPI camera: zoom by RENDER_DPR + origin (0,0) so screen-space UI maps 1:1 to
    // CSS px and we lay everything out in `screenW()/screenH()` (the visible CSS size).
    this.cameras.main.setZoom(RENDER_DPR).setOrigin(0, 0);
    // Re-flow on resize. MenuScene is SHUT DOWN when a dimension is picked (scene.start("arena")), so the
    // listener MUST be removed on shutdown — otherwise it fires post-teardown against a destroyed camera and
    // throws on the next window resize. (ArenaScene's twin listener is safe — that scene never shuts down.)
    const onResize = (size: Phaser.Structs.Size): void => {
      if (!this.cameras?.main) return;
      this.cameras.main.setSize(size.width, size.height);
      this.cameras.main.setZoom(RENDER_DPR).setOrigin(0, 0);
      this.layout();
    };
    this.scale.on("resize", onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", onResize));

    this.title = this.add
      .text(0, 0, "DIMENSION DRIFTERS", { fontSize: "52px", color: TITLE_COLOR, fontStyle: "bold" })
      .setOrigin(0.5, 0.5);
    this.subtitle = this.add
      .text(0, 0, "Pick your dimension · 1–10 player co-op bullet-heaven", {
        fontSize: "18px",
        color: ACCENT,
      })
      .setOrigin(0.5, 0.5);

    for (const id of DIMENSION_IDS) this.cards.push(this.buildCard(id));

    this.hint = this.add
      .text(0, 0, "Click a dimension — or press its number — to drift in.", {
        fontSize: "15px",
        color: "#9aa0ac",
      })
      .setOrigin(0.5, 0.5);

    // Number-key shortcuts (1–9 → the nth dimension).
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      const n = Number.parseInt(e.key, 10);
      if (Number.isFinite(n) && n >= 1 && n <= DIMENSION_IDS.length) {
        this.launch(DIMENSION_IDS[n - 1] ?? DEFAULT_DIMENSION);
      }
    });

    this.layout();
  }

  /** Build one themed dimension card at its FINAL size (frame + name + tagline + palette swatch strip), all
   *  positioned in container-local space. Interactivity lives on the full-size frame (hit area matches). */
  private buildCard(id: string): MenuCard {
    const dim = getDimension(id);
    const p = dim.palette;
    const root = this.add.container(0, 0);

    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, p.groundBed, 0.96).setOrigin(0.5);
    const frame = this.add
      .rectangle(0, 0, CARD_W, CARD_H, 0x000000, 0.001)
      .setOrigin(0.5)
      .setStrokeStyle(3, p.boundaryRail, 0.9);
    const name = this.add
      .text(0, -CARD_H / 2 + 30, dim.name, {
        fontSize: "24px",
        color: "#f4eee0",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0.5);
    const tagline = this.add
      .text(0, -CARD_H / 2 + 54, dim.tagline, {
        fontSize: "14px",
        color: "#c9c2b4",
        align: "center",
        wordWrap: { width: CARD_W - 36 },
      })
      .setOrigin(0.5, 0);
    // Palette swatch strip — the four signature theme colours, so each card reads as its own world.
    const chips = [p.boundaryRail, p.pitAmberLip, p.spawnRingSafe, p.dustDrift];
    const stride = 34;
    const totalW = chips.length * 26 + (chips.length - 1) * (stride - 26);
    const swatches = chips.map((c, i) =>
      this.add
        .rectangle(-totalW / 2 + 13 + i * stride, CARD_H / 2 - 22, 26, 9, c, 1)
        .setOrigin(0.5),
    );

    root.add([bg, frame, name, tagline, ...swatches]);

    frame
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => {
        frame.setStrokeStyle(4, p.spawnRingSafe, 1);
        bg.setFillStyle(p.gridColor2, 1);
        root.setScale(1.04);
      })
      .on("pointerout", () => {
        frame.setStrokeStyle(3, p.boundaryRail, 0.9);
        bg.setFillStyle(p.groundBed, 0.96);
        root.setScale(1);
      })
      .on("pointerdown", () => this.launch(id));
    return { id, root };
  }

  /** Re-flow the title + responsive card grid + hint for the current CSS viewport (positions only). */
  private layout(): void {
    const w = this.screenW();
    const h = this.screenH();
    this.title.setPosition(w / 2, Math.max(70, h * 0.13)).setFontSize(Math.min(56, w / 13));
    this.subtitle.setPosition(w / 2, Math.max(70, h * 0.13) + 44);

    const n = this.cards.length;
    const gapX = 26;
    const gapY = 28;
    const cols = Math.max(1, Math.min(n, Math.floor((w - 40) / (CARD_W + gapX))));
    const rows = Math.ceil(n / cols);
    const gridW = cols * CARD_W + (cols - 1) * gapX;
    const startX = (w - gridW) / 2 + CARD_W / 2;
    const startY = Math.max(200, h * 0.3) + CARD_H / 2;

    this.cards.forEach((card, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      card.root.setPosition(startX + col * (CARD_W + gapX), startY + row * (CARD_H + gapY));
    });

    const lastRowY = startY + (rows - 1) * (CARD_H + gapY) + CARD_H / 2;
    this.hint.setPosition(w / 2, Math.min(h - 26, lastRowY + 34));
  }

  private launch(id: string): void {
    this.scene.start("arena", { dimensionId: id });
  }

  private screenW(): number {
    return this.cameras.main.width / RENDER_DPR;
  }
  private screenH(): number {
    return this.cameras.main.height / RENDER_DPR;
  }
}
