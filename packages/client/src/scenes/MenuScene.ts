import {
  type ArenaState,
  beltLevelFor,
  DEFAULT_DIMENSION,
  DIMENSION_IDS,
  GEAR_CATALOG,
  GEAR_IDS,
  GEAR_SLOTS,
  type GearId,
  type GearSlot,
  getDimension,
  type MetaAccountV4,
  PET_IDS,
  type PetId,
  petLevelForXp,
  petModsForLevel,
  STARTER_GEAR_LOADOUT,
} from "@dd/shared";
import type { Room } from "colyseus.js";
import Phaser from "phaser";
import { AudioBus } from "../audio/AudioBus.js";
// Type-only: erased at build time so the menu/boot chunk stays net-free (the module itself is imported
// lazily inside launch(), alongside the lazy ArenaScene import).
import type { LaunchIntent } from "../net/matchmaking.js";
import { RENDER_DPR } from "../render-dpr.js";
import {
  boilerplateTextureKey,
  boilerplateTextureUrl,
  GEAR_PARTS_MANIFEST,
} from "../sprites/gear-parts.js";
import {
  type ArmoryDraft,
  armoryCarrySelection,
  armoryEntryViews,
  armorySummary,
  createArmoryDraft,
  toggleArmoryEntry,
} from "../ui/armory/model.js";
import {
  loadPetMetaAccount,
  petSelectionView,
  savePetMetaAccount,
  selectPet,
} from "../ui/pet-select.js";
import {
  truncateMeasuredBlock,
  truncateMeasuredLine,
  WARDROBE_ITEM_CARD_HEIGHT,
  WARDROBE_ITEM_CARD_WIDTH,
  WARDROBE_ITEM_TEXT_WIDTH,
  WARDROBE_LAYOUT,
  wardrobeViewportLayout,
} from "../ui/wardrobe/layout.js";
import {
  applyWardrobePreset,
  beginPrestigeReceiptFlow,
  equipWardrobeItem,
  gearRarityPips,
  loadWardrobePresetState,
  overwriteWardrobePreset,
  PRESTIGE_CONFIRM_HOLD_MS,
  type PrestigeReceiptFlow,
  prestigeCeremonyView,
  prestigeHoldProgress,
  receivePrestigeAccount,
  receivePrestigeReceipt,
  saveWardrobePresetState,
  type WardrobePresetState,
  wardrobePresetViews,
  wardrobePreview,
  wardrobeSetViews,
  wardrobeSlotItems,
} from "../ui/wardrobe/model.js";
import { WardrobeCharacterPreview } from "../ui/wardrobe/preview.js";

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

/** DEV PORTAL account projection. Gear inspections own the complete closet and equip the requested
 * piece in its canonical slot; pet inspections own and select the requested companion. The projected
 * account is sent through the normal join sanitizer, so the Testing-Grounds player uses the same
 * wardrobe/pet path as an ordinary menu launch. */
export function devInspectionAccount(account: MetaAccountV4, spec: string): MetaAccountV4 {
  const separator = spec.indexOf(":");
  const kind = separator < 0 ? spec : spec.slice(0, separator);
  const arg = separator < 0 ? "" : spec.slice(separator + 1);
  if (kind === "gear") {
    const gearId = GEAR_IDS.find((id) => id === arg);
    if (!gearId) return account;
    const item = GEAR_CATALOG[gearId];
    return {
      ...account,
      ownedGear: [...GEAR_IDS],
      equippedGear: { ...account.equippedGear, [item.slot]: gearId },
    };
  }
  if (kind === "pet") {
    const petId = PET_IDS.find((id) => id === arg);
    if (!petId) return account;
    return {
      ...account,
      pets: { ...account.pets, [petId]: account.pets[petId] ?? { bondXp: 0 } },
      selectedPetId: petId,
    };
  }
  return account;
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

interface MenuSceneData {
  prestigeRoom?: Room<ArenaState>;
  prestigeGameCleared?: boolean;
}

type MenuTab = "wardrobe" | "armory" | "run";

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
  private metaAccount!: MetaAccountV4;
  private companionRow?: Phaser.GameObjects.Container;
  private companionName?: Phaser.GameObjects.Text;
  private companionDetail?: Phaser.GameObjects.Text;
  private companionChips: CompanionChip[] = [];
  private menuTab: MenuTab = "wardrobe";
  private tabRow?: Phaser.GameObjects.Container;
  private readonly tabButtons = new Map<MenuTab, Phaser.GameObjects.Container>();
  private wardrobeRoot?: Phaser.GameObjects.Container;
  private wardrobePresetState!: WardrobePresetState;
  private selectedGearSlot: GearSlot = "hat";
  private wardrobeItemPage = 0;
  private wardrobeTitle?: Phaser.GameObjects.Text;
  private wardrobeInspector?: Phaser.GameObjects.Text;
  private wardrobeStats?: Phaser.GameObjects.Text;
  private wardrobeCollections?: Phaser.GameObjects.Text;
  private wardrobeFooter?: Phaser.GameObjects.Text;
  private wardrobePreviewSurface?: WardrobeCharacterPreview;
  private wardrobeHoveredGearId?: GearId;
  private wardrobeItemRows: Phaser.GameObjects.Container[] = [];
  private wardrobeSlotRows: Phaser.GameObjects.Container[] = [];
  private wardrobePresetRows: Phaser.GameObjects.Container[] = [];
  private prestigeRoom?: Room<ArenaState>;
  private prestigeGameCleared = false;
  private prestigeRoot?: Phaser.GameObjects.Container;
  private prestigeTierText?: Phaser.GameObjects.Text;
  private prestigeCostText?: Phaser.GameObjects.Text;
  private prestigeSurvivorText?: Phaser.GameObjects.Text;
  private prestigeButtonBg?: Phaser.GameObjects.Rectangle;
  private prestigeButtonText?: Phaser.GameObjects.Text;
  private prestigeHoldFill?: Phaser.GameObjects.Rectangle;
  private prestigeArmed = false;
  private prestigeHoldStartedAt = -1;
  private prestigeFlow?: PrestigeReceiptFlow;
  private prestigeRevealPlayedFor = -1;
  private prestigeDisposers: Array<() => void> = [];
  private armoryRoot?: Phaser.GameObjects.Container;
  private armoryDraft!: ArmoryDraft;
  private armoryPage = 0;
  private armoryTitle?: Phaser.GameObjects.Text;
  private armorySummaryText?: Phaser.GameObjects.Text;
  private armoryCarryText?: Phaser.GameObjects.Text;
  private armoryFooter?: Phaser.GameObjects.Text;
  private armoryRows: Phaser.GameObjects.Container[] = [];

  constructor() {
    super("menu");
  }

  init(data?: MenuSceneData): void {
    this.disposePrestigeTransport();
    this.prestigeRoom = data?.prestigeRoom;
    this.prestigeGameCleared = data?.prestigeGameCleared === true;
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
    // The shared baker owns every composed result. Preloading only its canonical six base sources keeps the
    // first wardrobe pose visible while the initial scene-scoped lease is acquired.
    if (GEAR_PARTS_MANIFEST) {
      for (const part of GEAR_PARTS_MANIFEST.boilerplate.parts) {
        const key = boilerplateTextureKey(part.id);
        if (!this.textures.exists(key)) {
          this.load.image(key, boilerplateTextureUrl(part.texture));
        }
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
    this.menuTab = "wardrobe";
    this.tabRow = undefined;
    this.tabButtons.clear();
    this.wardrobeRoot = undefined;
    this.wardrobePreviewSurface = undefined;
    this.wardrobeHoveredGearId = undefined;
    this.wardrobeItemRows = [];
    this.wardrobeSlotRows = [];
    this.wardrobePresetRows = [];
    this.prestigeRoot = undefined;
    this.prestigeTierText = undefined;
    this.prestigeCostText = undefined;
    this.prestigeSurvivorText = undefined;
    this.prestigeButtonBg = undefined;
    this.prestigeButtonText = undefined;
    this.prestigeHoldFill = undefined;
    this.prestigeArmed = false;
    this.prestigeHoldStartedAt = -1;
    this.prestigeFlow = undefined;
    this.prestigeRevealPlayedFor = -1;
    this.armoryRoot = undefined;
    this.armoryRows = [];
    this.launchIntent = "quick";
    this.launching = false;
    // §39 DEV PORTAL deep-link: boss/weapon/character/gear/pet specs skip the menu and drop straight into
    // Testing Grounds. Gear and pet specs project the normal local account BEFORE ArenaScene reads it, so
    // the server joins with the complete closet + equipped slot, or the owned + selected companion.
    const dev = new URLSearchParams(location.search).get("dev");
    if (dev) {
      if (import.meta.env.DEV) {
        const account = loadPetMetaAccount();
        const inspected = devInspectionAccount(account, dev);
        if (inspected !== account) savePetMetaAccount(inspected);
      }
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
    // DEV CLOSET — `?closet=1`, dev builds only: own the ENTIRE gear catalog locally so any outfit
    // can be dressed without farming. Purely a local-trust cosmetic grant (the server sanitizes the
    // account at join either way); it persists, so one visit unlocks the wardrobe from then on.
    if (import.meta.env.DEV && new URLSearchParams(location.search).get("closet")) {
      this.metaAccount = savePetMetaAccount({ ...this.metaAccount, ownedGear: [...GEAR_IDS] });
    }
    this.wardrobePresetState = loadWardrobePresetState(this.metaAccount);
    const petXp = this.metaAccount.selectedPetId
      ? (this.metaAccount.pets[this.metaAccount.selectedPetId]?.bondXp ?? 0)
      : 0;
    const packCapacity =
      12 +
      (this.metaAccount.selectedPetId
        ? petModsForLevel(this.metaAccount.selectedPetId, petLevelForXp(petXp)).bagCapacityAdd
        : 0);
    this.armoryDraft = createArmoryDraft(this.metaAccount, packCapacity);
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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize);
      this.disposePrestigeTransport();
    });
    this.installPrestigeTransport();

    this.title = this.add
      .text(0, 0, "DIMENSION DRIFTERS", { fontSize: "52px", color: TITLE_COLOR, fontStyle: "bold" })
      .setOrigin(0.5, 0.5);
    this.subtitle = this.add
      .text(0, 0, "GEAR IS WHO YOU ARE · WEAPONS ARE WHAT YOU RISK", {
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

    // Each tab owns its key grammar: presets in Wardrobe, carry review in Armory, destinations in Run.
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (this.menuTab === "wardrobe") {
        const preset = Number.parseInt(e.key, 10);
        if (Number.isFinite(preset) && preset >= 1 && preset <= 6) {
          this.applyWardrobePresetIndex(preset - 1);
          return;
        }
        if (e.key === "r" || e.key === "R") {
          this.equipWardrobe(STARTER_GEAR_LOADOUT[this.selectedGearSlot]);
          return;
        }
        if (e.key === "Enter") {
          this.setMenuTab("run");
          return;
        }
      }
      if (this.menuTab === "armory" && e.key === "Enter") {
        this.setMenuTab("run");
        return;
      }
      if (this.menuTab !== "run") return;
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

    this.buildTabRow();
    this.buildIntentRow();
    this.buildWardrobePanel();
    this.buildArmoryPanel();
    this.buildCompanionRow();
    this.buildAudioRow();
    this.setMenuTab("wardrobe");
    this.layout();
  }

  private makeMenuChip(
    label: string,
    width: number,
    onClick: () => void,
    height = 30,
  ): Phaser.GameObjects.Container {
    const bg = this.add
      .rectangle(0, 0, width, height, 0x1b1822, 0.96)
      .setStrokeStyle(1.5, 0x3a3550);
    const labelText = this.add
      .text(0, 0, label, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#b8b1c4",
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5);
    const root = this.add.container(0, 0, [bg, labelText]);
    bg.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
      this.audio.resume();
      onClick();
    });
    root.setData("bg", bg).setData("text", labelText);
    return root;
  }

  private disposePrestigeTransport(): void {
    for (const dispose of this.prestigeDisposers.splice(0)) dispose();
  }

  private installPrestigeTransport(): void {
    const room = this.prestigeRoom;
    if (!room) return;
    const disposeReceipt = room.onMessage<unknown>("prestigeReceipt", (payload) => {
      if (this.prestigeRoom !== room || !this.prestigeFlow) return;
      const previous = this.prestigeFlow.status;
      this.prestigeFlow = receivePrestigeReceipt(this.prestigeFlow, payload);
      this.refreshPrestigeSurface();
      if (previous !== "revealed" && this.prestigeFlow.status === "revealed") {
        this.finishPrestigeReveal();
      }
    }) as () => void;
    const disposeAccount = room.onMessage<unknown>("metaAccount", (payload) => {
      if (this.prestigeRoom !== room) return;
      this.metaAccount = savePetMetaAccount(payload);
      if (this.prestigeFlow) {
        const previous = this.prestigeFlow.status;
        this.prestigeFlow = receivePrestigeAccount(this.prestigeFlow, this.metaAccount);
        if (previous !== "revealed" && this.prestigeFlow.status === "revealed") {
          this.finishPrestigeReveal();
        }
      }
      const selectedPet = this.metaAccount.selectedPetId;
      const petXp = selectedPet ? (this.metaAccount.pets[selectedPet]?.bondXp ?? 0) : 0;
      const packCapacity =
        12 + (selectedPet ? petModsForLevel(selectedPet, petLevelForXp(petXp)).bagCapacityAdd : 0);
      this.armoryDraft = createArmoryDraft(this.metaAccount, packCapacity);
      this.refreshWardrobePanel();
      this.refreshArmoryPanel();
      this.refreshPrestigeSurface();
    }) as () => void;
    this.prestigeDisposers.push(disposeReceipt, disposeAccount);
  }

  private buildPrestigeSurface(parent: Phaser.GameObjects.Container): void {
    const prestige = WARDROBE_LAYOUT.prestige;
    const rootX = prestige.x + prestige.width / 2;
    const rootY = prestige.y + prestige.height / 2;
    const root = this.add.container(rootX, rootY);
    const panel = this.add
      .rectangle(0, 0, prestige.width, prestige.height, 0x130d0b, 0.99)
      .setStrokeStyle(2, 0x9d6b38, 0.95);
    this.prestigeTierText = this.add
      .text(-142, -81, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffd479",
        fontStyle: "bold",
        lineSpacing: 1,
        wordWrap: { width: 284 },
      })
      .setOrigin(0, 0);
    this.prestigeCostText = this.add
      .text(-142, -49, "", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#ff9a6a",
        lineSpacing: 0,
        wordWrap: { width: 284 },
      })
      .setOrigin(0, 0);
    this.prestigeSurvivorText = this.add
      .text(-142, 7, "", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#9cff8a",
        lineSpacing: 0,
        wordWrap: { width: 284 },
      })
      .setOrigin(0, 0);
    this.prestigeButtonBg = this.add
      .rectangle(0, 68, 280, 28, 0x2b1711, 1)
      .setStrokeStyle(2, 0xff8a2b)
      .setInteractive({ useHandCursor: true });
    this.prestigeButtonText = this.add
      .text(0, 68, "", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#ffd8a8",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const holdTrack = this.add.rectangle(-140, 88, 280, 4, 0x331c17, 1).setOrigin(0, 0.5);
    this.prestigeHoldFill = this.add
      .rectangle(-140, 88, 280, 4, 0xffb24a, 1)
      .setOrigin(0, 0.5)
      .setScale(0, 1);
    this.prestigeButtonBg
      .on("pointerdown", () => {
        const view = prestigeCeremonyView(this.metaAccount, this.hasPrestigeGameClear());
        if (!view.eligible || this.prestigeFlow?.status === "pending") return;
        this.audio.resume();
        if (!this.prestigeArmed) {
          this.prestigeArmed = true;
          this.audio.play("armory:stage");
          this.refreshPrestigeSurface();
          return;
        }
        this.prestigeHoldStartedAt = this.time.now;
      })
      .on("pointerup", () => this.finishPrestigeHold())
      .on("pointerout", () => this.cancelPrestigeHold());
    root.add([
      panel,
      this.prestigeTierText,
      this.prestigeCostText,
      this.prestigeSurvivorText,
      this.prestigeButtonBg,
      this.prestigeButtonText,
      holdTrack,
      this.prestigeHoldFill,
    ]);
    parent.add(root);
    this.prestigeRoot = root;
    this.refreshPrestigeSurface();
  }

  private hasPrestigeGameClear(): boolean {
    return (
      this.prestigeGameCleared &&
      this.prestigeRoom?.state.outcome === "victory" &&
      this.prestigeFlow?.status !== "revealed"
    );
  }

  private cancelPrestigeHold(): void {
    this.prestigeHoldStartedAt = -1;
    this.prestigeHoldFill?.setScale(0, 1);
  }

  private finishPrestigeHold(): void {
    const progress = prestigeHoldProgress(this.prestigeHoldStartedAt, this.time.now);
    if (progress >= 1) this.submitPrestige();
    else this.cancelPrestigeHold();
  }

  private submitPrestige(): void {
    if (!this.prestigeRoom || this.prestigeFlow) return;
    const requestId = `prestige_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const flow = beginPrestigeReceiptFlow(this.metaAccount, this.hasPrestigeGameClear(), requestId);
    if (!flow) return;
    this.prestigeFlow = flow;
    this.prestigeHoldStartedAt = -1;
    this.prestigeRoom.send("prestigeReset", flow.request);
    this.refreshPrestigeSurface();
  }

  private refreshPrestigeSurface(): void {
    if (
      !this.prestigeRoot ||
      !this.prestigeTierText ||
      !this.prestigeCostText ||
      !this.prestigeSurvivorText ||
      !this.prestigeButtonBg ||
      !this.prestigeButtonText
    )
      return;
    const view = prestigeCeremonyView(this.metaAccount, this.hasPrestigeGameClear());
    this.setBoundedWardrobeText(
      this.prestigeTierText,
      `PRESTIGE ${view.worldTier} · WORLD TIER ${view.worldTier}\n${view.nextHatPromise}`,
      WARDROBE_LAYOUT.prestigeTier,
    );
    this.setBoundedWardrobeText(this.prestigeCostText, view.costCopy, WARDROBE_LAYOUT.prestigeCost);
    this.setBoundedWardrobeText(
      this.prestigeSurvivorText,
      view.survivorCopy,
      WARDROBE_LAYOUT.prestigeSurvivor,
    );
    const pending =
      this.prestigeFlow?.status === "pending" || this.prestigeFlow?.status === "awaiting-account";
    const revealed = this.prestigeFlow?.status === "revealed";
    const label = revealed
      ? `WORLD TIER ${this.prestigeFlow?.expectedPrestige} REVEALED`
      : pending
        ? this.prestigeFlow?.status === "awaiting-account"
          ? "RECEIPT HELD · REFRESHING ACCOUNT"
          : "FAREWELL SENT · AWAITING RECEIPT"
        : !view.eligible
          ? view.eligibilityCopy
          : this.prestigeArmed
            ? `HOLD 2.0s · WORLD TIER ${view.worldTier} → ${view.nextWorldTier}`
            : "FAREWELL THE ARMORY · REVIEW";
    this.prestigeButtonText.setFontSize(label.length > 34 ? 8 : 9);
    const fittedLabel = truncateMeasuredLine(
      label,
      WARDROBE_LAYOUT.prestigeButton.width - 14,
      (candidate) => {
        this.prestigeButtonText?.setText(candidate);
        return this.prestigeButtonText?.width ?? 0;
      },
    );
    this.prestigeButtonText.setText(fittedLabel);
    this.prestigeButtonBg
      .setFillStyle(view.eligible && !pending ? 0x2b1711 : 0x151316, 1)
      .setStrokeStyle(view.eligible && !pending ? 2 : 1.5, view.eligible ? 0xff8a2b : 0x4d454d);
  }

  private finishPrestigeReveal(): void {
    const prestige = this.prestigeFlow?.expectedPrestige;
    if (!prestige || this.prestigeRevealPlayedFor === prestige) return;
    this.prestigeRevealPlayedFor = prestige;
    this.prestigeGameCleared = false;
    this.prestigeArmed = false;
    this.cancelPrestigeHold();
    this.audio.play("prestige:reveal");

    const width = Math.min(620, Math.max(330, this.screenW() - 56));
    const paper = this.add.graphics();
    paper.fillStyle(0x171219, 0.98).fillRoundedRect(-width / 2, -72, width, 144, 12);
    paper.lineStyle(3, 0xffd479, 1).strokeRoundedRect(-width / 2, -72, width, 144, 12);
    paper.lineStyle(1, 0x9d6b38, 0.75).lineBetween(-width / 2 + 22, 31, width / 2 - 22, 31);
    const title = this.add
      .text(0, -31, `WORLD TIER ${prestige}`, {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#ffd479",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const detail = this.add
      .text(0, 18, `HAT TIER ${Math.min(30, prestige + 1)} REVEALED\nTHE SPRING TOWER GROWS`, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#e8f5ff",
        fontStyle: "bold",
        align: "center",
        lineSpacing: 4,
      })
      .setOrigin(0.5);
    const reveal = this.add
      .container(this.screenW() / 2, this.screenH() / 2, [paper, title, detail])
      .setDepth(1000);
    const reduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    reveal.setAlpha(0).setScale(reduced ? 1 : 0.08, 1);
    this.tweens.add({
      targets: reveal,
      alpha: 1,
      scaleX: 1,
      duration: reduced ? 160 : 420,
      ease: reduced ? "Linear" : "Back.Out",
      onComplete: () => {
        this.tweens.add({
          targets: reveal,
          alpha: 0,
          y: reveal.y - (reduced ? 0 : 18),
          delay: 1_450,
          duration: 360,
          onComplete: () => reveal.destroy(true),
        });
      },
    });
    this.refreshPrestigeSurface();
  }

  private buildTabRow(): void {
    const rows: Array<{ tab: MenuTab; label: string; width: number }> = [
      { tab: "wardrobe", label: "WARDROBE", width: 142 },
      { tab: "armory", label: "ARMORY / CARRY", width: 176 },
      { tab: "run", label: "DESTINATIONS", width: 142 },
    ];
    this.tabRow = this.add.container(0, 0);
    rows.forEach(({ tab, label, width }, index) => {
      const chip = this.makeMenuChip(label, width, () => this.setMenuTab(tab));
      chip.setPosition((index - 1) * 166, 0).setData("tab", tab);
      this.tabRow?.add(chip);
      this.tabButtons.set(tab, chip);
    });
  }

  private setMenuTab(tab: MenuTab): void {
    if (tab !== "wardrobe" && this.wardrobeHoveredGearId) {
      this.wardrobeHoveredGearId = undefined;
      this.wardrobePreviewSurface?.refresh(
        this.metaAccount.equippedGear,
        this.metaAccount.prestige,
      );
    }
    this.menuTab = tab;
    for (const [id, chip] of this.tabButtons) {
      const selected = id === tab;
      (chip.getData("bg") as Phaser.GameObjects.Rectangle)
        .setFillStyle(selected ? 0x14232a : 0x1b1822, 0.98)
        .setStrokeStyle(selected ? 2.5 : 1.5, selected ? 0x33e6ff : 0x3a3550);
      (chip.getData("text") as Phaser.GameObjects.Text).setColor(
        selected ? TITLE_COLOR : "#8d8794",
      );
    }
    this.wardrobeRoot?.setVisible(tab === "wardrobe");
    this.companionRow?.setVisible(tab === "wardrobe");
    this.armoryRoot?.setVisible(tab === "armory");
    this.intentRow?.setVisible(tab === "run");
    this.hint?.setVisible(tab === "run");
    for (const card of this.cards) card.root.setVisible(tab === "run");
    if (tab === "wardrobe") this.refreshWardrobePanel();
    if (tab === "armory") this.refreshArmoryPanel();
  }

  private buildWardrobePanel(): void {
    const root = this.add.container(0, 0);
    const panel = this.add
      .rectangle(0, 0, WARDROBE_LAYOUT.panel.width, WARDROBE_LAYOUT.panel.height, 0x0b0a0f, 0.98)
      .setStrokeStyle(2, 0x3a3550);
    const heading = this.add
      .text(WARDROBE_LAYOUT.heading.x, WARDROBE_LAYOUT.heading.y, "THE WARDROBE", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: ACCENT,
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5);
    this.wardrobeTitle = this.add
      .text(
        WARDROBE_LAYOUT.headerTitle.x,
        WARDROBE_LAYOUT.headerTitle.y + WARDROBE_LAYOUT.headerTitle.height / 2,
        "",
        { fontSize: "18px", color: TITLE_COLOR, fontStyle: "bold" },
      )
      .setOrigin(0, 0.5);

    this.wardrobePreviewSurface = new WardrobeCharacterPreview(this);

    this.wardrobeInspector = this.add
      .text(WARDROBE_LAYOUT.inspector.x, WARDROBE_LAYOUT.inspector.y, "", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#d8cfb8",
        lineSpacing: 2,
        wordWrap: { width: WARDROBE_LAYOUT.inspector.width, useAdvancedWrap: true },
      })
      .setOrigin(0, 0);
    this.wardrobeStats = this.add
      .text(
        WARDROBE_LAYOUT.stats.x + WARDROBE_LAYOUT.stats.width / 2,
        WARDROBE_LAYOUT.stats.y,
        "",
        {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#bfefff",
          align: "center",
        },
      )
      .setOrigin(0.5, 0);
    this.wardrobeCollections = this.add
      .text(WARDROBE_LAYOUT.collections.x, WARDROBE_LAYOUT.collections.y, "", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#8d8794",
        lineSpacing: -1,
        wordWrap: { width: WARDROBE_LAYOUT.collections.width },
      })
      .setOrigin(0, 0);
    this.wardrobeFooter = this.add
      .text(
        0,
        WARDROBE_LAYOUT.footerY,
        "[Click] Equip · [R] Clear slot · [1-6] Preset · [Enter] Ready",
        {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#9fb0c2",
        },
      )
      .setOrigin(0.5);
    root.add([
      panel,
      heading,
      this.wardrobeTitle,
      this.wardrobePreviewSurface.root,
      this.wardrobeInspector,
      this.wardrobeStats,
      this.wardrobeCollections,
      this.wardrobeFooter,
    ]);

    for (const [index, slot] of GEAR_SLOTS.entries()) {
      const prominent = slot === "hat";
      const chip = this.makeMenuChip(
        slot === "facialHair" ? "FACIAL HAIR" : slot.toUpperCase(),
        prominent ? 190 : 150,
        () => {
          this.selectedGearSlot = slot;
          this.wardrobeItemPage = 0;
          this.wardrobeHoveredGearId = undefined;
          this.refreshWardrobePanel();
        },
        prominent ? 42 : 30,
      );
      chip.setPosition(
        WARDROBE_LAYOUT.slotX,
        WARDROBE_LAYOUT.slotStartY + index * WARDROBE_LAYOUT.slotStepY,
      );
      if (prominent) {
        (chip.getData("bg") as Phaser.GameObjects.Rectangle).setStrokeStyle(2.5, 0xffd479);
        (chip.getData("text") as Phaser.GameObjects.Text)
          .setText("HAT GALLERY")
          .setColor("#ffd479");
      }
      root.add(chip);
      this.wardrobeSlotRows.push(chip);
    }
    for (let index = 0; index < 6; index++) {
      const row = this.makeMenuChip(
        "",
        WARDROBE_ITEM_CARD_WIDTH,
        () => {
          const id = row.getData("gearId") as GearId | undefined;
          if (id) this.equipWardrobe(id);
        },
        WARDROBE_ITEM_CARD_HEIGHT,
      );
      row.setPosition(
        WARDROBE_LAYOUT.itemX,
        WARDROBE_LAYOUT.itemStartY + index * WARDROBE_LAYOUT.itemStepY,
      );
      const rowBg = row.getData("bg") as Phaser.GameObjects.Rectangle;
      rowBg
        .on("pointerover", () => {
          const id = row.getData("catalogGearId") as GearId | undefined;
          if (!id) return;
          this.wardrobeHoveredGearId = id;
          this.refreshWardrobeInspector(id);
          this.wardrobePreviewSurface?.refresh(
            this.metaAccount.equippedGear,
            this.metaAccount.prestige,
            id,
          );
        })
        .on("pointerout", () => {
          this.wardrobeHoveredGearId = undefined;
          this.refreshWardrobeInspector();
          this.wardrobePreviewSurface?.refresh(
            this.metaAccount.equippedGear,
            this.metaAccount.prestige,
          );
        });
      root.add(row);
      this.wardrobeItemRows.push(row);
    }
    for (const [index, rect] of WARDROBE_LAYOUT.presetChipRects.entries()) {
      const chip = this.makeMenuChip(String(index + 1), rect.width, () =>
        this.applyWardrobePresetIndex(index),
      );
      chip.setPosition(rect.x + rect.width / 2, rect.y + rect.height / 2);
      root.add(chip);
      this.wardrobePresetRows.push(chip);
    }
    const previous = this.makeMenuChip("‹", 38, () => {
      this.wardrobeItemPage = Math.max(0, this.wardrobeItemPage - 1);
      this.wardrobeHoveredGearId = undefined;
      this.refreshWardrobePanel();
    }).setPosition(WARDROBE_LAYOUT.pagePrevious.x, WARDROBE_LAYOUT.pagePrevious.y);
    const next = this.makeMenuChip("›", 38, () => {
      this.wardrobeItemPage++;
      this.wardrobeHoveredGearId = undefined;
      this.refreshWardrobePanel();
    }).setPosition(WARDROBE_LAYOUT.pageNext.x, WARDROBE_LAYOUT.pageNext.y);
    root.add([previous, next]);
    this.buildPrestigeSurface(root);
    this.wardrobeRoot = root;
    this.refreshWardrobePanel();
  }

  private equipWardrobe(id: GearId): void {
    const next = equipWardrobeItem(this.metaAccount, id);
    if (next.equippedGear[GEAR_CATALOG[id].slot] !== id) return;
    this.metaAccount = savePetMetaAccount(next);
    const selected = Math.max(1, this.wardrobePresetState.selected);
    this.wardrobePresetState = overwriteWardrobePreset(
      this.wardrobePresetState,
      this.metaAccount,
      selected,
    );
    this.wardrobePresetState = saveWardrobePresetState(this.wardrobePresetState, this.metaAccount);
    this.audio.play("wardrobe:equip");
    this.refreshWardrobePanel();
  }

  private applyWardrobePresetIndex(index: number): void {
    const result = applyWardrobePreset(this.metaAccount, this.wardrobePresetState, index);
    this.metaAccount = savePetMetaAccount(result.account);
    this.wardrobePresetState = saveWardrobePresetState(result.state, this.metaAccount);
    this.audio.play("wardrobe:equip");
    this.refreshWardrobePanel();
  }

  private setBoundedWardrobeText(
    text: Phaser.GameObjects.Text,
    value: string,
    bounds: { width: number; height: number },
  ): void {
    const fitted = truncateMeasuredBlock(value, bounds, (candidate) => {
      text.setText(candidate);
      return { width: text.width, height: text.height };
    });
    text.setText(fitted);
  }

  private refreshWardrobeInspector(id?: GearId): void {
    if (!this.wardrobeInspector) return;
    const inspectedId = id ?? this.metaAccount.equippedGear[this.selectedGearSlot];
    const def = GEAR_CATALOG[inspectedId];
    const item = wardrobeSlotItems(this.metaAccount, def.slot).find(
      (row) => row.id === inspectedId,
    );
    const availability = item?.equipped
      ? "Equipped for the next run"
      : item?.owned
        ? "Owned · click the card to equip"
        : (item?.lockedCopy ?? "Locked");
    const dependency =
      "effectAvailability" in def && def.effectAvailability === "inert"
        ? "Dependency pending · preview only"
        : availability;
    this.setBoundedWardrobeText(
      this.wardrobeInspector,
      `${def.name}\n${def.rarity} · ${gearRarityPips(def)} · ${def.gearClass}\n${def.effectText}\n${dependency}`,
      WARDROBE_LAYOUT.inspector,
    );
  }

  private refreshWardrobePanel(): void {
    if (
      !this.wardrobeRoot ||
      !this.wardrobeTitle ||
      !this.wardrobeInspector ||
      !this.wardrobeStats ||
      !this.wardrobeCollections
    )
      return;
    const items = wardrobeSlotItems(this.metaAccount, this.selectedGearSlot);
    const pageSize = 6;
    const maxPage = Math.max(0, Math.ceil(items.length / pageSize) - 1);
    this.wardrobeItemPage = Math.min(this.wardrobeItemPage, maxPage);
    const page = items.slice(
      this.wardrobeItemPage * pageSize,
      (this.wardrobeItemPage + 1) * pageSize,
    );
    const titleCopy =
      this.selectedGearSlot === "hat"
        ? `HAT GALLERY · ${items.filter((row) => row.owned).length}/${items.length} launch signatures · 27 legacy pedestals archived`
        : `${this.selectedGearSlot.toUpperCase()} · OWNED FIRST · LOCKED SILHOUETTES AFTER`;
    const fittedTitle = truncateMeasuredLine(
      titleCopy,
      WARDROBE_LAYOUT.headerTitle.width,
      (candidate) => {
        this.wardrobeTitle?.setText(candidate);
        return this.wardrobeTitle?.width ?? 0;
      },
    );
    this.wardrobeTitle.setText(fittedTitle);
    this.refreshWardrobeInspector(this.wardrobeHoveredGearId);
    this.wardrobePreviewSurface?.refresh(
      this.metaAccount.equippedGear,
      this.metaAccount.prestige,
      this.wardrobeHoveredGearId,
    );
    const preview = wardrobePreview(this.metaAccount);
    this.setBoundedWardrobeText(
      this.wardrobeStats,
      `STR ${preview.baseStats.str} · DEX ${preview.baseStats.dex} · INT ${preview.baseStats.int} · CON ${preview.baseStats.con} · LUK ${preview.baseStats.luk}\nSIGNATURE · ${preview.quirk.name}`,
      WARDROBE_LAYOUT.stats,
    );
    const sets = wardrobeSetViews(this.metaAccount);
    const collectionLines = [
      "LEGACY SET COLLECTIONS",
      ...sets.map(
        (set) =>
          `${set.name} ${set.owned}/${set.total}${set.equipped > 0 ? ` · worn ${set.equipped}` : ""}`,
      ),
    ];
    this.wardrobeCollections.setFontSize(8);
    const fittedCollectionLines = collectionLines.map((line) =>
      truncateMeasuredLine(line, WARDROBE_LAYOUT.collections.width, (candidate) => {
        this.wardrobeCollections?.setText(candidate);
        return this.wardrobeCollections?.width ?? 0;
      }),
    );
    this.wardrobeCollections.setText(fittedCollectionLines.join("\n"));
    if (this.wardrobeCollections.height > WARDROBE_LAYOUT.collections.height) {
      this.wardrobeCollections.setFontSize(7);
    }
    this.wardrobeSlotRows.forEach((row, index) => {
      const selected = GEAR_SLOTS[index] === this.selectedGearSlot;
      (row.getData("bg") as Phaser.GameObjects.Rectangle).setFillStyle(
        selected ? 0x14232a : 0x1b1822,
        1,
      );
    });
    this.wardrobeItemRows.forEach((row, index) => {
      const item = page[index];
      row
        .setVisible(!!item)
        .setData("catalogGearId", item?.id)
        .setData("gearId", item?.owned ? item.id : undefined);
      if (!item) return;
      const text = row.getData("text") as Phaser.GameObjects.Text;
      const bg = row.getData("bg") as Phaser.GameObjects.Rectangle;
      text.setFontSize(10).setLineSpacing(1).setAlign("center");
      const fitLine = (value: string): string =>
        truncateMeasuredLine(value, WARDROBE_ITEM_TEXT_WIDTH, (candidate) => {
          text.setText(candidate);
          return text.width;
        });
      const nameLine = fitLine(`${item.equipped ? "EQUIPPED · " : ""}${item.def.name}`);
      const detailLine = fitLine(
        `${item.def.rarity} · ${item.owned ? item.def.effectText : item.lockedCopy}`,
      );
      text
        .setText(`${nameLine}\n${detailLine}`)
        .setColor(item.owned ? (item.equipped ? "#9cff6a" : TITLE_COLOR) : "#686472");
      bg.setFillStyle(
        item.equipped ? 0x173021 : item.owned ? 0x1b1822 : 0x111016,
        1,
      ).setStrokeStyle(
        item.equipped ? 2.5 : 1.5,
        item.equipped ? 0x9cff6a : item.owned ? 0x3a3550 : 0x28252e,
      );
    });
    const presets = wardrobePresetViews(this.wardrobePresetState);
    this.wardrobePresetRows.forEach((row, index) => {
      const preset = presets[index];
      (row.getData("text") as Phaser.GameObjects.Text).setText(
        index === 0 ? "[1] RESET" : `[${index + 1}]`,
      );
      (row.getData("bg") as Phaser.GameObjects.Rectangle)
        .setFillStyle(preset?.selected ? 0x14232a : 0x1b1822, 1)
        .setStrokeStyle(preset?.selected ? 2 : 1.5, preset?.selected ? 0x33e6ff : 0x3a3550);
    });
    this.refreshPrestigeSurface();
  }

  override update(): void {
    if (this.prestigeHoldStartedAt < 0 || this.prestigeFlow) return;
    const progress = prestigeHoldProgress(this.prestigeHoldStartedAt, this.time.now);
    this.prestigeHoldFill?.setScale(progress, 1);
    this.prestigeButtonText?.setText(
      `HOLDING · ${((PRESTIGE_CONFIRM_HOLD_MS * (1 - progress)) / 1_000).toFixed(1)}s`,
    );
    if (progress >= 1) this.submitPrestige();
  }

  private buildArmoryPanel(): void {
    const root = this.add.container(0, 0);
    const panel = this.add.rectangle(0, 0, 1160, 440, 0x090a0d, 0.99).setStrokeStyle(2, 0x5d4932);
    const heading = this.add
      .text(-560, -204, "THE ARMORY", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffd479",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5);
    this.armoryTitle = this.add
      .text(-560, -178, "STASH · CLICK TO STAGE THE CARRY", {
        fontSize: "18px",
        color: TITLE_COLOR,
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5);
    this.armorySummaryText = this.add
      .text(40, -160, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#ffb24a",
        fontStyle: "bold",
        lineSpacing: 6,
      })
      .setOrigin(0, 0);
    this.armoryCarryText = this.add
      .text(40, -60, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#cfc6ae",
        lineSpacing: 5,
        wordWrap: { width: 420 },
      })
      .setOrigin(0, 0);
    this.armoryFooter = this.add
      .text(0, 202, "Click a Stash card to stage/remove · [Enter] Review destinations", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#9fb0c2",
      })
      .setOrigin(0.5);
    root.add([
      panel,
      heading,
      this.armoryTitle,
      this.armorySummaryText,
      this.armoryCarryText,
      this.armoryFooter,
    ]);
    for (let index = 0; index < 8; index++) {
      const row = this.makeMenuChip("", 500, () => {
        const entryId = row.getData("entryId") as string | undefined;
        if (!entryId) return;
        const result = toggleArmoryEntry(this.metaAccount, this.armoryDraft, entryId);
        this.armoryDraft = result.draft;
        this.audio.play(result.error === "carry-full" ? "drive:empty" : "armory:stage");
        this.refreshArmoryPanel();
      });
      row.setPosition(-285, -138 + index * 42);
      root.add(row);
      this.armoryRows.push(row);
    }
    const previous = this.makeMenuChip("‹", 38, () => {
      this.armoryPage = Math.max(0, this.armoryPage - 1);
      this.refreshArmoryPanel();
    }).setPosition(-40, -178);
    const next = this.makeMenuChip("›", 38, () => {
      this.armoryPage++;
      this.refreshArmoryPanel();
    }).setPosition(0, -178);
    root.add([previous, next]);
    this.armoryRoot = root;
    this.refreshArmoryPanel();
  }

  private refreshArmoryPanel(): void {
    if (
      !this.armoryRoot ||
      !this.armorySummaryText ||
      !this.armoryCarryText ||
      !this.armoryTitle ||
      !this.armoryFooter
    )
      return;
    const rows = armoryEntryViews(this.metaAccount, this.armoryDraft);
    const pageSize = 8;
    const maxPage = Math.max(0, Math.ceil(rows.length / pageSize) - 1);
    this.armoryPage = Math.min(this.armoryPage, maxPage);
    const page = rows.slice(this.armoryPage * pageSize, (this.armoryPage + 1) * pageSize);
    this.armoryRows.forEach((row, index) => {
      const item = page[index];
      row.setVisible(!!item).setData("entryId", item?.entry.entryId);
      if (!item) return;
      const staged = !!item.placement;
      (row.getData("text") as Phaser.GameObjects.Text)
        .setText(
          `${staged ? "AT RISK · " : "SAFE · "}${item.name}\n${item.detail} · ◈${item.atRiskValue}`,
        )
        .setFontSize(10)
        .setColor(staged ? "#ffb24a" : TITLE_COLOR);
      (row.getData("bg") as Phaser.GameObjects.Rectangle)
        .setFillStyle(staged ? 0x2a1710 : 0x15151b, 1)
        .setStrokeStyle(staged ? 2.5 : 1.5, staged ? 0xff8a2b : 0x3a3550);
    });
    const summary = armorySummary(this.metaAccount, this.armoryDraft);
    this.armoryTitle.setText(
      `STASH ${this.metaAccount.weaponBank.stash.length}/72 · SAFE HOME STORAGE`,
    );
    this.armorySummaryText.setText(
      `AT STAKE · ${summary.atRiskPhysical} weapons · ◈${summary.atRiskValue}\nSAFE · ${summary.safeEntries} entries · WORLD TIER ${summary.requiredWorldTier}`,
    );
    const active = this.armoryDraft.placements.filter((row) => row.zone === "active");
    const pack = this.armoryDraft.placements.filter((row) => row.zone === "pack");
    const byId = new Map(rows.map((row) => [row.entry.entryId, row]));
    const labels = (placements: typeof active) =>
      placements
        .sort((a, b) => a.start - b.start)
        .map(
          (row) => `${row.start + 1}. ${byId.get(row.entryId)?.name ?? "Missing Last Carry item"}`,
        )
        .join("\n") || "Empty";
    this.armoryCarryText.setText(
      `ACTIVE ${summary.activePhysical}/3\n${labels(active)}\n\nPACK ${summary.packPhysical}/${this.armoryDraft.packCapacity}\n${labels(pack)}\n\nHOME ISSUE · Rusty Cleaver · ◈0 · RETURNS\nNot a bank instance. Not counted at stake.`,
    );
    if (summary.intakeBlocked) {
      this.armoryFooter
        .setText(
          `INTAKE ${this.metaAccount.weaponBank.intake.length} · Make Stash room before embark`,
        )
        .setColor("#ff5d5d");
    } else {
      this.armoryFooter
        .setText("Click a Stash card to stage/remove · [Enter] Review destinations")
        .setColor("#9fb0c2");
    }
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
          const level = petLevelForXp(this.metaAccount.pets[id]?.bondXp ?? 0);
          const mods = petModsForLevel(id, level);
          this.armoryDraft = createArmoryDraft(this.metaAccount, 12 + mods.bagCapacityAdd);
          this.refreshCompanionRow();
          this.refreshArmoryPanel();
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
    const titleY = Math.max(52, Math.min(86, h * 0.09));
    this.title.setPosition(w / 2, titleY).setFontSize(Math.min(52, w / 13));
    this.subtitle.setPosition(w / 2, titleY + 40);
    this.tabRow?.setPosition(w / 2, titleY + 76);
    const wardrobeLayout = wardrobeViewportLayout(w, h);
    const loadoutScale = wardrobeLayout.scale;
    const loadoutY = wardrobeLayout.centerY;
    this.wardrobeRoot
      ?.setPosition(wardrobeLayout.centerX, wardrobeLayout.centerY)
      .setScale(loadoutScale);
    this.armoryRoot?.setPosition(wardrobeLayout.centerX, loadoutY).setScale(loadoutScale);
    // §50 finding #1 — the launch-intent selector sits between the subtitle and the card grid.
    this.intentRow?.setPosition(w / 2, titleY + 126);
    this.companionRow
      ?.setPosition(w / 2, Math.min(h - 82, loadoutY + 220 * loadoutScale + 70))
      .setScale(Math.min(0.88, (w - 24) / 930, Math.max(0.65, h / 1020)));

    const n = this.cards.length;
    const gapX = 26;
    const gapY = 28;
    const cols = Math.max(1, Math.min(n, Math.floor((w - 40) / (CARD_W + gapX))));
    const rows = Math.ceil(n / cols);
    const gridW = cols * CARD_W + (cols - 1) * gapX;
    const startX = (w - gridW) / 2 + CARD_W / 2;
    const startY = Math.max(220, h * 0.25) + CARD_H / 2;

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
    const account = this.metaAccount ?? loadPetMetaAccount();
    const draft = this.armoryDraft ?? createArmoryDraft(account);
    const stake = armorySummary(account, draft);
    if (stake.intakeBlocked) {
      this.setMenuTab("armory");
      this.audio.play("drive:empty");
      return;
    }
    const requestId = `menu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const carry = armoryCarrySelection(account, draft, requestId);
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
            selectedPetId: account.selectedPetId,
            carry,
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
