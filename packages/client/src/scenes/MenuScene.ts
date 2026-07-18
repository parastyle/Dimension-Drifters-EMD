import {
  beltLevelFor,
  DEFAULT_DIMENSION,
  DIMENSION_IDS,
  getDimension,
  type MetaAccountV2,
  PET_IDS,
  type PetId,
} from "@dd/shared";
import Phaser from "phaser";
import { AudioBus } from "../audio/AudioBus.js";
// Type-only: erased at build time so the menu/boot chunk stays net-free (the module itself is imported
// lazily inside launch(), alongside the lazy ArenaScene import).
import type { LaunchIntent } from "../net/matchmaking.js";
import { RENDER_DPR } from "../render-dpr.js";
import { loadPetMetaAccount, petSelectionView, selectPet } from "../ui/pet-select.js";

/**
 * §17 title / dimension-select screen — the first scene. Lists every dimension as a themed card (its own
 * palette as the swatch + frame); click one (or press its number) to launch the run, which hands the pick
 * to `ArenaScene` via `scene.start("arena", { dimensionId })`. ArenaScene forwards it as the room's
 * `dimensionId` join option, and that pick is a REAL matchmaking filter (§50 finding #1): the server's
 * `filterBy(["belt", "beltLevel", "dimensionId", "bossRush"])` means a launch can only ever match a room
 * created with the same pick. The menu also chooses a launch INTENT — QUICK JOIN (share a matching live
 * run, or start one) vs HOST NEW RUN (always mint a fresh room) — armed via `net/matchmaking.ts`, which
 * additionally discloses on arrival what was actually joined (mode/dimension/depth/drifters, plus an
 * explicit notice if a matched run has since descended past the requested dimension).
 * Screen-space + DPR-aware, mirroring ArenaScene's hi-DPI camera so it stays crisp + responsive
 * from a laptop up to a 4K ultrawide.
 *
 * Cards are a FIXED size (built once at full size so each card's input hit area matches its geometry — a
 * resize only re-flows their grid POSITIONS, never their size, so clicks always land).
 */

const CARD_W = 288;
const CARD_H = 172;
const MENU_ART_PREFIX = "menu-dimension:";
let arenaSceneImport: Promise<typeof import("./ArenaScene.js").ArenaScene> | undefined;

/** §17 payload diet: import the arena graph only when a run launches, then register its scene exactly once. */
async function ensureArenaScene(scene: Phaser.Scenes.ScenePlugin): Promise<void> {
  if (scene.get("arena")) return;
  arenaSceneImport ??= import("./ArenaScene.js").then(({ ArenaScene }) => ArenaScene);
  const ArenaSceneClass = await arenaSceneImport;
  if (!scene.get("arena")) scene.add("arena", ArenaSceneClass, false);
}
const TITLE_COLOR = "#f0e6d2";
const ACCENT = "#33e6ff";

/** One rendered dimension card — its container is repositioned by `layout()` on every resize. */
interface MenuCard {
  id: string;
  root: Phaser.GameObjects.Container;
}

interface CompanionChip {
  id: PetId;
  root: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Rectangle;
  portrait: Phaser.GameObjects.Image;
  lock: Phaser.GameObjects.Text;
}

export class MenuScene extends Phaser.Scene {
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private cards: MenuCard[] = [];
  /** §19 v0.108 the shared AudioBus (registry-backed) + its settings row. */
  private audio!: AudioBus;
  private audioLabel?: Phaser.GameObjects.Text;
  private audioRow?: Phaser.GameObjects.Container;
  /** §17 P0.5 optional dimension key-art that failed to load; absent renders preserve the vector card. */
  private readonly menuArtMissing = new Set<string>();
  private launching = false;
  /** §50 finding #1 — the launch intent a card click will use: QUICK JOIN (default; joinOrCreate, which the
   *  server filters to same-pick rooms) or HOST NEW RUN (always create a fresh room). Handed to
   *  `net/matchmaking.ts` at launch, where it steers the arena's join call. */
  private launchIntent: LaunchIntent = "quick";
  private intentRow?: Phaser.GameObjects.Container;
  private intentCaption?: Phaser.GameObjects.Text;
  private metaAccount!: MetaAccountV2;
  private companionRow?: Phaser.GameObjects.Container;
  private companionName?: Phaser.GameObjects.Text;
  private companionDetail?: Phaser.GameObjects.Text;
  private companionChips: CompanionChip[] = [];

  constructor() {
    super("menu");
  }

  /** §17 P0.5 preload every level-select key frame. A detached render may not have installed all five yet;
   *  loaderror is consumed into a missing set, and buildCard keeps the exact palette/vector fallback. */
  preload(): void {
    // Vite can serve index.html for an absent public asset (HTTP 200). Silence Phaser's default per-file
    // decode console.error for these explicitly optional JPGs while retaining normal loader completion.
    const queueOptionalArt = (key: string, url: string): void => {
      const file = new Phaser.Loader.FileTypes.ImageFile(this.load, key, url);
      file.onProcessError = () => {
        this.menuArtMissing.add(key);
        file.state = Phaser.Loader.FILE_ERRORED;
        file.loader.fileProcessComplete(file);
      };
      this.load.addFile(file);
    };
    for (const dimensionId of DIMENSION_IDS) {
      const key = `${MENU_ART_PREFIX}${dimensionId}`;
      if (!this.textures.exists(key) && !this.menuArtMissing.has(key)) {
        queueOptionalArt(key, `ui/menu/${dimensionId}.jpg`);
      }
    }
    // Until dedicated portraits land, the folio uses the approved Hatchling body cutouts. These are the
    // only pet textures loaded by the menu; ArenaScene keeps all animated stage parts lazy.
    for (const petId of PET_IDS) {
      const key = `pet-select:${petId}`;
      if (!this.textures.exists(key)) this.load.image(key, `sprites/pets/${petId}/s1/body.png`);
    }
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      if (file.key.startsWith(MENU_ART_PREFIX)) this.menuArtMissing.add(file.key);
    });
  }

  create(): void {
    // §17 Phaser reuses the MenuScene instance: discard every destroyed UI handle before an early launch or
    // rebuilding the card grid, otherwise layout() walks roots owned by the previous entry.
    this.cards = [];
    this.title = undefined!;
    this.subtitle = undefined!;
    this.hint = undefined!;
    this.audioLabel = undefined;
    this.audioRow = undefined;
    this.intentRow = undefined;
    this.intentCaption = undefined;
    this.companionRow = undefined;
    this.companionName = undefined;
    this.companionDetail = undefined;
    this.companionChips = [];
    this.launchIntent = "quick";
    this.launching = false;
    // §39 DEV PORTAL deep-link: `?dev=boss:<kind>` / `weapon:<id>` / `char:<id>` skips the menu and drops
    // straight into a Testing-Grounds sandbox (top-down arena, full room to fight) with that asset applied.
    const dev = new URLSearchParams(location.search).get("dev");
    if (dev) {
      void ensureArenaScene(this.scene).then(() =>
        this.scene.start("arena", { dimensionId: DEFAULT_DIMENSION, dev }),
      );
      return;
    }
    // §40 BELT is shelved from the menu (user ruling: top-down is the primary mode) but stays reachable for
    // dev/testing via `?belt=<levelId>` — auto-launches that belt level directly (the Dev Portal links use it).
    const beltParam = new URLSearchParams(location.search).get("belt");
    if (beltParam && beltParam !== "1") {
      this.launchBelt(beltParam);
      return;
    }
    this.cameras.main.setBackgroundColor("#0f0c14");
    this.cameras.main.fadeIn(360, 0, 0, 0);
    // §19 v0.108 one AudioBus shared with ArenaScene via the registry. Resume its context on the first
    // real gesture (a menu click), then wire the volume/mute row.
    this.audio = (this.game.registry.get("audio") as AudioBus | undefined) ?? new AudioBus();
    this.game.registry.set("audio", this.audio);
    this.metaAccount = loadPetMetaAccount();
    this.input.on("pointerdown", () => this.audio.resume());
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

    // §40 the menu leads with the DIMENSIONS as top-down arena runs (the primary mode); belt is URL-only.
    for (const id of DIMENSION_IDS) this.cards.push(this.buildCard(id));
    // §16 v0.116 a special BOSS RUSH card at the end of the grid — every bespoke boss, back-to-back.
    this.cards.push(this.buildBossRushCard());

    this.hint = this.add
      .text(
        0,
        0,
        "Choose a DIMENSION — click it, or press its number — to drift in.  ·  B: BOSS RUSH",
        {
          fontSize: "15px",
          color: "#9aa0ac",
        },
      )
      .setOrigin(0.5, 0.5);

    // Number-key shortcuts (1–5 → the nth DIMENSION, a top-down run); B → the boss-rush gauntlet;
    // H → toggle the QUICK JOIN / HOST NEW RUN launch intent (§50 finding #1).
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (e.key === "b" || e.key === "B") {
        this.launch(DEFAULT_DIMENSION, true);
        return;
      }
      if (e.key === "h" || e.key === "H") {
        this.setLaunchIntent(this.launchIntent === "quick" ? "host" : "quick");
        return;
      }
      const n = Number.parseInt(e.key, 10);
      if (Number.isFinite(n) && n >= 1 && n <= DIMENSION_IDS.length) {
        this.launch(DIMENSION_IDS[n - 1] ?? DEFAULT_DIMENSION);
      }
    });

    // §19 v0.108 a slow breathing pulse on the title — the menu reads as alive, not a static poster.
    this.tweens.add({
      targets: this.title,
      scale: 1.02,
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });

    this.buildIntentRow();
    this.buildCompanionRow();
    this.buildAudioRow();
    this.layout();
  }

  /** §50 finding #1 — the QUICK JOIN / HOST NEW RUN selector (between the subtitle and the cards), so the
   *  card click is an honest, chosen contract rather than an implicit joinOrCreate. */
  private buildIntentRow(): void {
    const mkChip = (
      label: string,
      intent: LaunchIntent,
      x: number,
    ): Phaser.GameObjects.Container => {
      const bg = this.add.rectangle(0, 0, 168, 30, 0x1b1822, 0.9).setStrokeStyle(1.5, 0x3a3550);
      const txt = this.add
        .text(0, 0, label, { fontSize: "14px", color: "#9aa0ac", fontStyle: "bold" })
        .setOrigin(0.5);
      const c = this.add.container(x, 0, [bg, txt]);
      bg.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
        this.audio.resume();
        this.setLaunchIntent(intent);
      });
      c.setData("bg", bg);
      c.setData("txt", txt);
      c.setData("intent", intent);
      return c;
    };
    const quick = mkChip("QUICK JOIN", "quick", -92);
    const host = mkChip("HOST NEW RUN", "host", 92);
    this.intentCaption = this.add
      .text(0, 26, "", { fontSize: "13px", color: "#9aa0ac" })
      .setOrigin(0.5, 0.5);
    this.intentRow = this.add.container(0, 0, [quick, host, this.intentCaption]);
    this.refreshIntentRow();
  }

  private setLaunchIntent(intent: LaunchIntent): void {
    this.launchIntent = intent;
    this.refreshIntentRow();
  }

  private refreshIntentRow(): void {
    if (!this.intentRow || !this.intentCaption) return;
    for (const child of this.intentRow.list) {
      const chip = child as Phaser.GameObjects.Container;
      const intent = chip.getData?.("intent") as LaunchIntent | undefined;
      if (!intent) continue; // the caption text
      const bg = chip.getData("bg") as Phaser.GameObjects.Rectangle;
      const txt = chip.getData("txt") as Phaser.GameObjects.Text;
      const selected = intent === this.launchIntent;
      bg.setStrokeStyle(selected ? 2 : 1.5, selected ? 0x33e6ff : 0x3a3550);
      bg.setFillStyle(selected ? 0x14232a : 0x1b1822, selected ? 1 : 0.9);
      txt.setColor(selected ? TITLE_COLOR : "#9aa0ac");
    }
    this.intentCaption.setText(
      this.launchIntent === "quick"
        ? "Pick a card to JOIN a live run with the same pick — or start one if none is open.   (H toggles)"
        : "Pick a card to HOST a fresh run — drifters making the same pick can still join you.   (H toggles)",
    );
  }

  /** Pre-ready companion folio. Selection writes the account payload immediately and freezes on launch. */
  private buildCompanionRow(): void {
    const panel = this.add
      .rectangle(0, 0, 930, 112, 0x14121b, 0.98)
      .setStrokeStyle(2, 0x3a3550, 0.95);
    const heading = this.add
      .text(-445, -45, "COMPANIONS", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#8fdcff",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5);
    this.companionName = this.add
      .text(-445, -22, "", {
        fontSize: "18px",
        color: TITLE_COLOR,
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5);
    this.companionDetail = this.add
      .text(-445, 2, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#b8b1c4",
        lineSpacing: 3,
      })
      .setOrigin(0, 0);
    this.companionRow = this.add.container(0, 0, [
      panel,
      heading,
      this.companionName,
      this.companionDetail,
    ]);

    for (const [i, id] of PET_IDS.entries()) {
      const x = -30 + i * 62;
      const frame = this.add.rectangle(0, 0, 52, 58, 0x1b1822, 1).setStrokeStyle(1.5, 0x3a3550, 1);
      const portrait = this.add
        .image(0, -2, `pet-select:${id}`)
        .setDisplaySize(124, 124)
        .setOrigin(0.5);
      const lock = this.add
        .text(0, 22, "LOCKED", {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#8d8794",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      const root = this.add.container(x, 0, [frame, portrait, lock]);
      frame
        .setInteractive({ useHandCursor: true })
        .on("pointerover", () => {
          if (!this.launching) {
            this.refreshCompanionRow(id);
            frame.setFillStyle(0x292332, 1);
          }
        })
        .on("pointerout", () => this.refreshCompanionRow())
        .on("pointerdown", () => {
          if (this.launching || !this.metaAccount.pets[id]) return;
          this.audio.resume();
          this.metaAccount = selectPet(this.metaAccount, id);
          this.refreshCompanionRow();
        });
      this.companionRow.add(root);
      this.companionChips.push({ id, root, frame, portrait, lock });
    }
    this.refreshCompanionRow();
  }

  private refreshCompanionRow(previewId?: PetId): void {
    if (!this.companionName || !this.companionDetail) return;
    const selectedId = (previewId ?? this.metaAccount.selectedPetId) || "verdant-wing";
    const selected = petSelectionView(this.metaAccount, selectedId);
    this.companionName.setText(
      `${selected.name} · Lv ${selected.level}/10${selected.owned ? "" : " · LOCKED"}`,
    );
    const progress = !selected.owned
      ? selected.id === "slate-tortoise"
        ? "Wild egg · Verdant Ruins terminal victories"
        : "◈ 160 Scrip egg · Companion shop"
      : selected.nextBondXp === null
        ? "Maxed Bond"
        : `${selected.bondXp.toLocaleString()} / ${selected.nextBondXp.toLocaleString()} Bond XP`;
    this.companionDetail.setText(
      `${progress} · ${selected.stage}\n${selected.bonus}\n${selected.capstone}`,
    );
    for (const chip of this.companionChips) {
      const view = petSelectionView(this.metaAccount, chip.id);
      chip.frame.setFillStyle(view.selected ? 0x14232a : 0x1b1822, 1);
      chip.frame.setStrokeStyle(view.selected ? 2.5 : 1.5, view.selected ? 0x33e6ff : 0x3a3550, 1);
      chip.portrait.setAlpha(view.owned ? 1 : 0.25).setTint(view.owned ? 0xffffff : 0x55545b);
      chip.lock.setVisible(!view.owned);
      chip.root.setScale(view.selected ? 1.06 : 1);
    }
  }

  /** §19 v0.108 audio settings row (bottom-left): −/+ volume + a mute toggle, reflecting the persisted
   *  AudioBus setting. Clickable text chips (reliable hit areas), no drag needed. */
  private buildAudioRow(): void {
    const mk = (label: string, w: number, onClick: () => void): Phaser.GameObjects.Container => {
      const bg = this.add.rectangle(0, 0, w, 26, 0x1b1822, 0.9).setStrokeStyle(1.5, 0x3a3550);
      const txt = this.add
        .text(0, 0, label, { fontSize: "14px", color: "#c9c2d4", fontStyle: "bold" })
        .setOrigin(0.5);
      const c = this.add.container(0, 0, [bg, txt]);
      bg.setInteractive({ useHandCursor: true })
        .on("pointerover", () => bg.setFillStyle(0x2a2436, 1))
        .on("pointerout", () => bg.setFillStyle(0x1b1822, 0.9))
        .on("pointerdown", () => {
          this.audio.resume();
          onClick();
        });
      c.setData("txt", txt);
      return c;
    };
    this.audioLabel = this.add
      .text(0, 0, "", { fontSize: "14px", color: "#9aa0ac" })
      .setOrigin(0, 0.5);
    const minus = mk("−", 26, () => {
      this.audio.setVolume(Math.round((this.audio.vol - 0.1) * 10) / 10);
      this.refreshAudioRow();
    }).setPosition(132, 0);
    const plus = mk("+", 26, () => {
      this.audio.setVolume(Math.round((this.audio.vol + 0.1) * 10) / 10);
      this.refreshAudioRow();
    }).setPosition(164, 0);
    const mute = mk("MUTE", 64, () => {
      this.audio.toggleMute();
      this.refreshAudioRow();
    }).setPosition(214, 0);
    this.audioLabel.setPosition(0, 0);
    this.audioRow = this.add.container(0, 0, [this.audioLabel, minus, plus, mute]);
    this.audioRow.setData("mute", mute);
    this.refreshAudioRow();
  }

  private refreshAudioRow(): void {
    if (!this.audioLabel) return;
    this.audioLabel.setText(`🔊 Volume ${Math.round(this.audio.vol * 100)}%`);
    const mute = this.audioRow?.getData("mute") as Phaser.GameObjects.Container | undefined;
    const txt = mute?.getData("txt") as Phaser.GameObjects.Text | undefined;
    txt
      ?.setText(this.audio.isMuted ? "UNMUTE" : "MUTE")
      .setColor(this.audio.isMuted ? "#ff8a6a" : "#c9c2d4");
  }

  /** Build one themed dimension card at its FINAL size (frame + name + tagline + palette swatch strip), all
   *  positioned in container-local space. Interactivity lives on the full-size frame (hit area matches). */
  private buildCard(dimensionId: string): MenuCard {
    // §40 a DIMENSION card — a top-down arena run themed by the dimension's palette (the primary mode).
    const dim = getDimension(dimensionId);
    const p = dim.palette;
    const root = this.add.container(0, 0);

    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, p.groundBed, 0.96).setOrigin(0.5);
    // §17 P0.5 KEY ART: centre-crop (true cover-fit, no stretching), darken for copy contrast, and insert
    // between the existing palette fallback and every existing frame/title/tagline/swatch layer.
    const artKey = `${MENU_ART_PREFIX}${dimensionId}`;
    let art: Phaser.GameObjects.Image | undefined;
    if (!this.menuArtMissing.has(artKey) && this.textures.exists(artKey)) {
      const source = this.textures.get(artKey).getSourceImage() as {
        width: number;
        height: number;
      };
      if (source.width > 8 && source.height > 8) {
        const coverScale = Math.max(CARD_W / source.width, CARD_H / source.height);
        const cropW = CARD_W / coverScale;
        const cropH = CARD_H / coverScale;
        art = this.add
          .image(0, 0, artKey)
          .setCrop((source.width - cropW) / 2, (source.height - cropH) / 2, cropW, cropH)
          .setDisplaySize(CARD_W, CARD_H)
          .setTint(0x999999);
      }
    }
    const frame = this.add
      .rectangle(0, 0, CARD_W, CARD_H, 0x000000, 0.001)
      .setOrigin(0.5)
      .setStrokeStyle(3, p.boundaryRail, 0.9);
    const name = this.add
      .text(0, -CARD_H / 2 + 30, dim.name, {
        fontSize: "23px",
        color: "#f4eee0",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0.5);
    const tagline = this.add
      .text(0, -CARD_H / 2 + 54, dim.tagline, {
        fontSize: "13px",
        color: "#c9c2b4",
        align: "center",
        wordWrap: { width: CARD_W - 30 },
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

    root.add([bg, ...(art ? [art] : []), frame, name, tagline, ...swatches]);

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
      .on("pointerdown", () => this.launch(dimensionId));
    return { id: dimensionId, root };
  }

  /** §36 launch a specific belt LEVEL (belt mode, the level's own dimension roster/palette). */
  private launchBelt(levelId: string): void {
    this.launch(beltLevelFor(levelId).dimensionId, false, true, levelId);
  }

  /** §16 v0.116 the BOSS RUSH card — a distinct crimson tile that launches the boss gauntlet (all 10
   *  bespoke bosses back-to-back). Same footprint as a dimension card so it slots into the grid. */
  private buildBossRushCard(): MenuCard {
    const root = this.add.container(0, 0);
    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, 0x1a0d10, 0.96).setOrigin(0.5);
    const frame = this.add
      .rectangle(0, 0, CARD_W, CARD_H, 0x000000, 0.001)
      .setOrigin(0.5)
      .setStrokeStyle(3, 0xff5d3b, 0.95);
    const name = this.add
      .text(0, -CARD_H / 2 + 32, "☠ BOSS RUSH", {
        fontSize: "26px",
        color: "#ff7a5c",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0.5);
    const tagline = this.add
      .text(0, 4, "Every boss, back-to-back.\nNo horde. Escalating. Bank it all — or wipe.", {
        fontSize: "14px",
        color: "#e6c2b4",
        align: "center",
        wordWrap: { width: CARD_W - 36 },
      })
      .setOrigin(0.5, 0.5);
    const badge = this.add
      .text(0, CARD_H / 2 - 22, "press B", { fontSize: "13px", color: "#a06055" })
      .setOrigin(0.5, 0.5);
    root.add([bg, frame, name, tagline, badge]);
    frame
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => {
        frame.setStrokeStyle(4, 0xffab5c, 1);
        bg.setFillStyle(0x2a1015, 1);
        root.setScale(1.04);
      })
      .on("pointerout", () => {
        frame.setStrokeStyle(3, 0xff5d3b, 0.95);
        bg.setFillStyle(0x1a0d10, 0.96);
        root.setScale(1);
      })
      .on("pointerdown", () => this.launch(DEFAULT_DIMENSION, true));
    return { id: "__bossrush__", root };
  }

  /** Re-flow the title + responsive card grid + hint for the current CSS viewport (positions only). */
  private layout(): void {
    const w = this.screenW();
    const h = this.screenH();
    this.title.setPosition(w / 2, Math.max(70, h * 0.13)).setFontSize(Math.min(56, w / 13));
    this.subtitle.setPosition(w / 2, Math.max(70, h * 0.13) + 44);
    // §50 finding #1 — the launch-intent selector sits between the subtitle and the card grid.
    this.intentRow?.setPosition(w / 2, Math.max(70, h * 0.13) + 88);
    this.companionRow
      ?.setPosition(w / 2, Math.max(70, h * 0.13) + 168)
      .setScale(Math.min(1, (w - 24) / 930));

    const n = this.cards.length;
    const gapX = 26;
    const gapY = 28;
    const cols = Math.max(1, Math.min(n, Math.floor((w - 40) / (CARD_W + gapX))));
    const rows = Math.ceil(n / cols);
    const gridW = cols * CARD_W + (cols - 1) * gapX;
    const startX = (w - gridW) / 2 + CARD_W / 2;
    const startY = Math.max(370, h * 0.43) + CARD_H / 2;

    this.cards.forEach((card, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      card.root.setPosition(startX + col * (CARD_W + gapX), startY + row * (CARD_H + gapY));
    });

    const lastRowY = startY + (rows - 1) * (CARD_H + gapY) + CARD_H / 2;
    this.hint.setPosition(w / 2, Math.min(h - 44, lastRowY + 34));
    // §19 v0.108 audio settings row pinned bottom-left.
    this.audioRow?.setPosition(24, h - 26);
  }

  private launch(id: string, bossRush = false, belt = false, beltLevel?: string): void {
    if (this.launching) return; // guard the key+click double-fire
    this.launching = true;
    const intent = this.launchIntent;
    const ready = Promise.all([
      ensureArenaScene(this.scene),
      // §50 finding #1 — arm the matchmaking contract BEFORE the arena connects: the wrapper routes the
      // arena's joinOrCreate through the chosen intent (QUICK JOIN vs HOST NEW RUN) and discloses the
      // joined room's actual mode/dimension/depth on arrival. Lazy import: same chunk timing as the
      // arena itself, so the menu's first paint stays net-free.
      import("../net/matchmaking.js").then((m) => {
        m.setLaunchIntent(intent);
        return m.installMatchmakingContract();
      }),
    ]);
    // §19 v0.108 fade to black, THEN start the arena — every run start feels intentional.
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once(
      "camerafadeoutcomplete",
      () =>
        void ready.then(() =>
          this.scene.start("arena", {
            dimensionId: id,
            bossRush,
            belt,
            beltLevel,
            selectedPetId: this.metaAccount.selectedPetId,
          }),
        ),
    );
  }

  private screenW(): number {
    return this.cameras.main.width / RENDER_DPR;
  }
  private screenH(): number {
    return this.cameras.main.height / RENDER_DPR;
  }
}
