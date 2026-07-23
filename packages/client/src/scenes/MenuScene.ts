import {
  type ArenaState,
  beltLevelFor,
  DEFAULT_CHARACTER,
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
  type WholeArtCharacter,
  WHOLE_ART_CHARACTERS,
  weaponEntryInstances,
} from "@dd/shared";
import type { Room } from "colyseus.js";
import Phaser from "phaser";
import { AudioBus } from "../audio/AudioBus.js";
import { SPRITE_ATLAS } from "../entities/SpriteRig.js";
// Type-only: erased at build time so the menu/boot chunk stays net-free (the module itself is imported
// lazily inside launch(), alongside the lazy ArenaScene import).
import type { LaunchIntent } from "../net/matchmaking.js";
import { RENDER_DPR } from "../render-dpr.js";
import {
  gearClickVisibility,
  gearClickVisibilityNotice,
  gearManifestItem,
  gearTextureKey,
  GEAR_PARTS_MANIFEST,
} from "../sprites/gear-parts.js";
import {
  type ArmoryDraft,
  armoryCatalogEntries,
  armoryCarrySelection,
  armoryEntryViews,
  armorySummary,
  createArmoryDraft,
  DEFAULT_ARMORY_FILTERS,
  type ArmoryCatalogFilters,
  moveArmoryEntryZone,
  selectArmoryActiveCell,
  toggleArmoryEntry,
} from "../ui/armory/model.js";
import {
  ARMORY_ART_STATUS,
  ARMORY_COLORS,
  ARMORY_CSS_COLORS,
  armoryArtStatusFromNotice,
  armoryTextStyle,
  drawArmoryPanel,
  rarityMark,
  rarityToken,
} from "../ui/armory-ui/tokens.js";
import { artStatusIcon, drawArmoryIcon } from "../ui/armory-ui/icons.js";
import {
  VirtualGridFocusController,
  virtualGridWindow,
} from "../ui/armory-ui/virtual-grid.js";
import { routeArmoryUiInput } from "../input-routing.js";
import {
  characterSelectionOptions,
  loadCharacterSelection,
  routeCharacterSelectionKey,
  saveCharacterSelection,
} from "../ui/character-select.js";
import {
  buildCharacterPortrait,
  queueCharacterPreviewTextures,
} from "../ui/characters/preview.js";
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
  type wardrobeViewportLayout,
} from "../ui/wardrobe/layout.js";
import {
  applyWardrobePreset,
  beginPrestigeReceiptFlow,
  DEFAULT_WARDROBE_FILTERS,
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
  type WardrobeCatalogFilters,
  type WardrobeSlotItemView,
  unequipWardrobeSlot,
  wardrobeCatalogItems,
  wardrobePresetViews,
  wardrobePreview,
  wardrobeSetViews,
  wardrobeSlotItems,
} from "../ui/wardrobe/model.js";
import { WardrobeCharacterPreview } from "../ui/wardrobe/preview.js";
import { bakeCardArt } from "./arena/card-art.js";

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

interface CharacterCardControl {
  id: WholeArtCharacter;
  root: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
}

interface WardrobeTileControl {
  root: Phaser.GameObjects.Container;
  paper: Phaser.GameObjects.Graphics;
  art: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Graphics;
  name: Phaser.GameObjects.Text;
  rarity: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Rectangle;
  gearId?: GearId;
  pointerIntent?: Phaser.Time.TimerEvent;
}

interface ArmoryCardControl {
  root: Phaser.GameObjects.Container;
  paper: Phaser.GameObjects.Graphics;
  art: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  meta: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Rectangle;
  entryId?: string;
}

interface MenuSceneData {
  prestigeRoom?: Room<ArenaState>;
  prestigeGameCleared?: boolean;
}

export type MenuTab = "characters" | "armory" | "run";

export const INITIAL_MENU_TAB: MenuTab = "characters";

export const MENU_TAB_DESCRIPTORS = [
  { tab: "characters", label: "CHARACTERS", width: 142 },
  { tab: "armory", label: "ARMORY / CARRY", width: 176 },
  { tab: "run", label: "DESTINATIONS", width: 142 },
] as const satisfies ReadonlyArray<{ tab: MenuTab; label: string; width: number }>;

export function menuTabVisibility(tab: MenuTab): {
  characters: boolean;
  companions: boolean;
  armory: boolean;
  destinations: boolean;
  prestige: boolean;
  fullScreen: boolean;
} {
  return {
    characters: tab === "characters",
    companions: tab === "characters",
    armory: tab === "armory",
    destinations: tab === "run",
    prestige: tab === "run",
    fullScreen: tab === "characters" || tab === "armory",
  };
}

export function menuLaunchSelections(
  selectedCharacterId: WholeArtCharacter,
  selectedPetId: PetId | "",
): { selectedCharacterId: WholeArtCharacter; selectedPetId: PetId | "" } {
  return { selectedCharacterId, selectedPetId };
}

export const DESTINATION_PRESTIGE_COPY = {
  context: "DESTINATION DIFFICULTY",
  review: "ADVANCE WORLD TIER · REVIEW",
  reveal: "NEW WORLD TIER ACTIVE\nREVIEW DESTINATIONS AND CARRY",
} as const;

export function destinationPrestigeEligibilityCopy(view: {
  nextWorldTier: number | null;
  eligibilityCopy: string;
}): string {
  return view.nextWorldTier === null ? "WORLD TIER 30 · CAP" : view.eligibilityCopy;
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
  private metaAccount!: MetaAccountV4;
  private companionRow?: Phaser.GameObjects.Container;
  private companionName?: Phaser.GameObjects.Text;
  private companionDetail?: Phaser.GameObjects.Text;
  private companionChips: CompanionChip[] = [];
  private menuTab: MenuTab = INITIAL_MENU_TAB;
  private tabRow?: Phaser.GameObjects.Container;
  private readonly tabButtons = new Map<MenuTab, Phaser.GameObjects.Container>();
  private characterRoot?: Phaser.GameObjects.Container;
  private characterChrome?: Phaser.GameObjects.Graphics;
  private characterTitle?: Phaser.GameObjects.Text;
  private characterSubtitle?: Phaser.GameObjects.Text;
  private characterHint?: Phaser.GameObjects.Text;
  private characterCards: CharacterCardControl[] = [];
  private selectedCharacterId: WholeArtCharacter = DEFAULT_CHARACTER;
  private characterFocusIndex = 0;
  private characterCardScale = 1;
  private wardrobeRoot?: Phaser.GameObjects.Container;
  private wardrobeChrome?: Phaser.GameObjects.Graphics;
  private wardrobePresetState!: WardrobePresetState;
  private wardrobeFilters: WardrobeCatalogFilters = { ...DEFAULT_WARDROBE_FILTERS };
  private readonly wardrobeFocus = new VirtualGridFocusController(3, 0, 228, 648);
  private wardrobeKeyboardFocus = false;
  private wardrobeSearchFocused = false;
  private wardrobeFocusedGearId?: GearId;
  private wardrobeLayout?: ReturnType<typeof wardrobeViewportLayout>;
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
  private wardrobeTiles: WardrobeTileControl[] = [];
  private wardrobeSlotRows: Phaser.GameObjects.Container[] = [];
  private wardrobePresetRows: Phaser.GameObjects.Container[] = [];
  private wardrobeToolbarRows: Phaser.GameObjects.Container[] = [];
  private wardrobeSearchText?: Phaser.GameObjects.Text;
  private wardrobeResultText?: Phaser.GameObjects.Text;
  private wardrobeDetailArt?: Phaser.GameObjects.Image;
  private wardrobeDetailPaper?: Phaser.GameObjects.Graphics;
  private wardrobeSetPaper?: Phaser.GameObjects.Graphics;
  private wardrobePrimary?: Phaser.GameObjects.Container;
  private wardrobePrimaryText?: Phaser.GameObjects.Text;
  private wardrobeWorldTier?: Phaser.GameObjects.Container;
  private prestigeDrawerOpen = false;
  private prestigeRoom?: Room<ArenaState>;
  private prestigeGameCleared = false;
  private prestigeRoot?: Phaser.GameObjects.Container;
  private prestigePanel?: Phaser.GameObjects.Rectangle;
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
  private destinationsWorldTier?: Phaser.GameObjects.Container;
  private destinationsPrestigeLayer?: Phaser.GameObjects.Container;
  private armoryRoot?: Phaser.GameObjects.Container;
  private armoryChrome?: Phaser.GameObjects.Graphics;
  private armoryDraft!: ArmoryDraft;
  private armoryFilters: ArmoryCatalogFilters = { ...DEFAULT_ARMORY_FILTERS };
  private readonly armoryFocus = new VirtualGridFocusController(4, 0, 162, 648);
  private armorySearchFocused = false;
  private armoryLayoutMode: "wide" | "floor" = "wide";
  private armoryFocusedEntryId = "";
  private armoryPage = 0;
  private armoryTitle?: Phaser.GameObjects.Text;
  private armorySummaryText?: Phaser.GameObjects.Text;
  private armoryCarryText?: Phaser.GameObjects.Text;
  private armoryFooter?: Phaser.GameObjects.Text;
  private armoryRows: Phaser.GameObjects.Container[] = [];
  private armoryCards: ArmoryCardControl[] = [];
  private armoryToolbarRows: Phaser.GameObjects.Container[] = [];
  private armorySearchText?: Phaser.GameObjects.Text;
  private armoryDetailArt?: Phaser.GameObjects.Image;
  private armoryDetailPaper?: Phaser.GameObjects.Graphics;
  private armoryCarryPaper?: Phaser.GameObjects.Graphics;
  private armoryPrimary?: Phaser.GameObjects.Container;
  private armoryPrimaryText?: Phaser.GameObjects.Text;

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
    if (!this.textures.exists(SPRITE_ATLAS)) {
      this.load.multiatlas(SPRITE_ATLAS, "sprites/dd-sprites.json", "sprites");
    }
    // Ordinary identity is the small shared whole-art roster. Queue its six authored cuts only: the
    // dormant Wardrobe boilerplate and complete gear manifest are intentionally absent from menu preload.
    queueCharacterPreviewTextures(this);
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
    this.menuTab = INITIAL_MENU_TAB;
    this.tabRow = undefined;
    this.tabButtons.clear();
    this.characterRoot = undefined;
    this.characterChrome = undefined;
    this.characterTitle = undefined;
    this.characterSubtitle = undefined;
    this.characterHint = undefined;
    this.characterCards = [];
    this.characterFocusIndex = 0;
    this.characterCardScale = 1;
    this.wardrobeRoot = undefined;
    this.wardrobeChrome = undefined;
    this.wardrobePreviewSurface = undefined;
    this.wardrobeHoveredGearId = undefined;
    this.wardrobeItemRows = [];
    this.wardrobeTiles = [];
    this.wardrobeSlotRows = [];
    this.wardrobePresetRows = [];
    this.wardrobeToolbarRows = [];
    this.wardrobeFilters = { ...DEFAULT_WARDROBE_FILTERS };
    this.wardrobeSearchFocused = false;
    this.wardrobeKeyboardFocus = false;
    this.wardrobeFocusedGearId = undefined;
    this.prestigeDrawerOpen = false;
    this.prestigeRoot = undefined;
    this.prestigePanel = undefined;
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
    this.destinationsWorldTier = undefined;
    this.destinationsPrestigeLayer = undefined;
    this.armoryRoot = undefined;
    this.armoryRows = [];
    this.armoryCards = [];
    this.armoryToolbarRows = [];
    this.armoryFilters = { ...DEFAULT_ARMORY_FILTERS };
    this.armorySearchFocused = false;
    this.armoryFocusedEntryId = "";
    this.launchIntent = "quick";
    this.launching = false;
    this.selectedCharacterId = loadCharacterSelection().selectedCharacterId;
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
        this.scene.start("arena", {
          dimensionId: DEFAULT_DIMENSION,
          dev,
          selectedCharacterId: this.selectedCharacterId,
        }),
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
    this.characterFocusIndex = Math.max(
      0,
      WHOLE_ART_CHARACTERS.indexOf(this.selectedCharacterId),
    );
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
      .text(0, 0, "CHOOSE YOUR HERO · WEAPONS ARE WHAT YOU RISK", {
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

    // Each active tab owns its key grammar: character cards, carry review, or destinations.
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (this.menuTab === "characters") {
        if (e.key === "Escape" || e.key === "Tab") {
          this.setMenuTab("run");
          e.preventDefault();
          return;
        }
        const route = routeCharacterSelectionKey(
          e.key,
          this.characterFocusIndex,
          this.characterCards.length,
        );
        if (!route.handled) return;
        this.characterFocusIndex = route.focusIndex;
        if (route.activate) {
          const id = this.characterCards[this.characterFocusIndex]?.id;
          if (id) this.selectCharacter(id);
        } else {
          this.refreshCharacterWorkspace();
        }
        e.preventDefault();
        return;
      }
      if (this.menuTab === "armory") {
        if (this.handleCatalogSearchKey(e, "armory")) return;
        const route = routeArmoryUiInput(this.armoryUiSample(e, "menu-armory"));
        if (route.move) {
          this.armoryFocus.move(route.move);
          this.refreshArmoryWorkspace();
        }
        if (route.pageDelta !== 0) {
          this.armoryFocus.move(route.pageDelta < 0 ? "page-previous" : "page-next");
          this.refreshArmoryWorkspace();
        }
        if (route.contextDelta !== 0) this.moveArmoryFocusedZone(route.contextDelta);
        if (route.activeSlot !== null) {
          this.armoryDraft = selectArmoryActiveCell(
            this.metaAccount,
            this.armoryDraft,
            route.activeSlot - 1,
          );
          this.refreshArmoryWorkspace();
        }
        if (route.primary) this.activateArmoryFocus();
        if (route.close) this.setMenuTab("run");
        e.preventDefault();
        return;
      }
      if (this.menuTab !== "run") return;
      if (this.prestigeDrawerOpen && e.key === "Escape") {
        this.prestigeDrawerOpen = false;
        this.prestigeRoot?.setVisible(false);
        e.preventDefault();
        return;
      }
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
    this.buildCharacterWorkspace();
    this.buildArmoryWorkspace();
    this.buildCompanionRow();
    this.buildDestinationsPrestige();
    this.buildAudioRow();
    this.setMenuTab(INITIAL_MENU_TAB);
    this.layout();
  }

  private armoryUiSample(
    event: KeyboardEvent,
    context: "wardrobe" | "menu-armory" | "backpack",
  ): Parameters<typeof routeArmoryUiInput>[0] {
    const key = event.key.toLocaleLowerCase();
    const digit = /^[1-9]$/.test(event.key) ? Number(event.key) : null;
    return {
      context,
      modalOpen: false,
      textInputFocused:
        context === "wardrobe" ? this.wardrobeSearchFocused : this.armorySearchFocused,
      leftPressed: event.key === "ArrowLeft",
      rightPressed: event.key === "ArrowRight",
      upPressed: event.key === "ArrowUp",
      downPressed: event.key === "ArrowDown",
      enterPressed: event.key === "Enter",
      escapePressed: event.key === "Escape",
      closePressed: event.key === "Tab",
      previousContextPressed: key === "q",
      nextContextPressed: key === "e",
      previousPagePressed: key === "z",
      nextPagePressed: key === "x",
      resetPressed: key === "r",
      digitPressed: digit,
    };
  }

  private handleCatalogSearchKey(event: KeyboardEvent, owner: "wardrobe" | "armory"): boolean {
    const focused = owner === "wardrobe" ? this.wardrobeSearchFocused : this.armorySearchFocused;
    if (!focused && event.key !== "/") return false;
    event.preventDefault();
    if (!focused) {
      if (owner === "wardrobe") this.wardrobeSearchFocused = true;
      else this.armorySearchFocused = true;
    } else if (event.key === "Escape" || event.key === "Enter") {
      if (owner === "wardrobe") this.wardrobeSearchFocused = false;
      else this.armorySearchFocused = false;
    } else {
      const filters = owner === "wardrobe" ? this.wardrobeFilters : this.armoryFilters;
      if (event.key === "Backspace") filters.query = filters.query.slice(0, -1);
      else if (event.key.length === 1 && /[\w\- ']/u.test(event.key) && filters.query.length < 48) {
        filters.query += event.key;
      }
    }
    if (owner === "wardrobe") {
      this.wardrobeFocus.focus(0);
      this.refreshWardrobeWorkspace();
    } else {
      this.armoryFocus.focus(0);
      this.refreshArmoryWorkspace();
    }
    return true;
  }

  private makeMenuChip(
    label: string,
    width: number,
    onClick: () => void,
    height = 44,
  ): Phaser.GameObjects.Container {
    height = Math.max(44, height);
    const bg = this.add
      .rectangle(0, 0, width, height, 0x1b1822, 0.96)
      .setStrokeStyle(1.5, 0x3a3550);
    const labelText = this.add
      .text(0, 0, label, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: ARMORY_CSS_COLORS.textSecondary,
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
      this.refreshArmoryWorkspace();
      this.refreshPrestigeSurface();
    }) as () => void;
    this.prestigeDisposers.push(disposeReceipt, disposeAccount);
  }

  private buildPrestigeDrawer(parent: Phaser.GameObjects.Container): void {
    const root = this.add.container(0, 0).setDepth(40);
    this.prestigePanel = this.add
      .rectangle(0, 0, 404, 760, ARMORY_COLORS.surface1, 1)
      .setStrokeStyle(3, ARMORY_COLORS.action, 1);
    this.prestigeTierText = this.add
      .text(-180, -350, "", {
        ...armoryTextStyle("section", "action"),
        wordWrap: { width: 360, useAdvancedWrap: true },
      })
      .setOrigin(0, 0);
    this.prestigeCostText = this.add
      .text(-180, -250, "", {
        ...armoryTextStyle("secondary", "danger", true),
        wordWrap: { width: 360, useAdvancedWrap: true },
      })
      .setOrigin(0, 0);
    this.prestigeSurvivorText = this.add
      .text(-180, 0, "", {
        ...armoryTextStyle("secondary", "success", true),
        wordWrap: { width: 360, useAdvancedWrap: true },
      })
      .setOrigin(0, 0);
    this.prestigeButtonBg = this.add
      .rectangle(0, 310, 360, 52, 0x342b1a, 1)
      .setStrokeStyle(2, ARMORY_COLORS.action)
      .setInteractive({ useHandCursor: true });
    this.prestigeButtonText = this.add
      .text(0, 310, "", armoryTextStyle("secondary", "action", true))
      .setOrigin(0.5);
    const holdTrack = this.add.rectangle(-180, 344, 360, 6, ARMORY_COLORS.surface3, 1).setOrigin(0, 0.5);
    this.prestigeHoldFill = this.add
      .rectangle(-180, 344, 360, 6, ARMORY_COLORS.warning, 1)
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
      this.prestigePanel,
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

  private buildDestinationsPrestige(): void {
    this.destinationsWorldTier = this.makeMenuChip(
      `WORLD TIER ${this.metaAccount.prestige}`,
      170,
      () => {
        this.prestigeDrawerOpen = !this.prestigeDrawerOpen;
        this.prestigeRoot?.setVisible(this.prestigeDrawerOpen);
        this.refreshPrestigeSurface();
        this.layoutDestinationsPrestige();
      },
      46,
    ).setDepth(65);
    this.destinationsPrestigeLayer = this.add.container(0, 0).setDepth(70);
    this.buildPrestigeDrawer(this.destinationsPrestigeLayer);
    this.prestigeRoot?.setVisible(false);
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
    const eligibilityCopy = destinationPrestigeEligibilityCopy(view);
    (this.destinationsWorldTier?.getData("text") as Phaser.GameObjects.Text | undefined)?.setText(
      `WORLD TIER ${view.worldTier}`,
    );
    if (this.prestigePanel) {
      this.prestigeTierText.setText(
        `WORLD TIER ${view.worldTier}${view.nextWorldTier ? `  →  ${view.nextWorldTier}` : "  ·  CAP"}\n${DESTINATION_PRESTIGE_COPY.context}`,
      );
      this.prestigeCostText.setText(`AT RISK\n${view.costCopy}`);
      this.prestigeSurvivorText.setText(view.survivorCopy);
      const pending =
        this.prestigeFlow?.status === "pending" || this.prestigeFlow?.status === "awaiting-account";
      const label = this.prestigeFlow?.status === "revealed"
        ? `WORLD TIER ${this.prestigeFlow.expectedPrestige} REVEALED`
        : pending
          ? "FAREWELL SENT  Â·  AWAITING ACCOUNT"
          : !view.eligible
            ? eligibilityCopy
            : this.prestigeArmed
              ? `HOLD 2.0s  Â·  WORLD TIER ${view.worldTier} â†’ ${view.nextWorldTier}`
              : DESTINATION_PRESTIGE_COPY.review;
      this.prestigeButtonText.setText(label).setFontSize(14);
      this.prestigeButtonBg
        .setFillStyle(view.eligible && !pending ? 0x342b1a : ARMORY_COLORS.surface2, 1)
        .setStrokeStyle(2, view.eligible ? ARMORY_COLORS.action : ARMORY_COLORS.border);
      return;
    }
    this.setBoundedWardrobeText(
      this.prestigeTierText,
      `PRESTIGE ${view.worldTier} · WORLD TIER ${view.worldTier}\n${DESTINATION_PRESTIGE_COPY.context}`,
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
          ? eligibilityCopy
          : this.prestigeArmed
            ? `HOLD 2.0s · WORLD TIER ${view.worldTier} → ${view.nextWorldTier}`
            : DESTINATION_PRESTIGE_COPY.review;
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
      .text(0, 18, DESTINATION_PRESTIGE_COPY.reveal, {
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
    this.tabRow = this.add.container(0, 0).setDepth(60);
    MENU_TAB_DESCRIPTORS.forEach(({ tab, label, width }, index) => {
      const chip = this.makeMenuChip(label, width, () => this.setMenuTab(tab));
      chip.setPosition((index - 1) * 166, 0).setData("tab", tab);
      this.tabRow?.add(chip);
      this.tabButtons.set(tab, chip);
    });
  }

  private setMenuTab(tab: MenuTab): void {
    this.menuTab = tab;
    const visibility = menuTabVisibility(tab);
    if (tab !== "run") this.prestigeDrawerOpen = false;
    for (const [id, chip] of this.tabButtons) {
      const selected = id === tab;
      (chip.getData("bg") as Phaser.GameObjects.Rectangle)
        .setFillStyle(selected ? 0x14232a : 0x1b1822, 0.98)
        .setStrokeStyle(selected ? 2.5 : 1.5, selected ? 0x33e6ff : 0x3a3550);
      (chip.getData("text") as Phaser.GameObjects.Text).setColor(
        selected ? TITLE_COLOR : "#8d8794",
      );
    }
    this.characterRoot?.setVisible(visibility.characters);
    this.companionRow?.setVisible(visibility.companions);
    this.armoryRoot?.setVisible(visibility.armory);
    this.intentRow?.setVisible(visibility.destinations);
    this.destinationsWorldTier?.setVisible(visibility.prestige);
    this.destinationsPrestigeLayer?.setVisible(visibility.prestige);
    this.prestigeRoot?.setVisible(visibility.prestige && this.prestigeDrawerOpen);
    this.hint?.setVisible(visibility.destinations);
    for (const card of this.cards) card.root.setVisible(visibility.destinations);
    if (tab === "characters") this.refreshCharacterWorkspace();
    if (tab === "armory") this.refreshArmoryWorkspace();
    if (tab === "run") this.refreshPrestigeSurface();
    this.layout();
  }

  private buildCharacterWorkspace(): void {
    const root = this.add.container(0, 0).setDepth(10);
    this.characterChrome = this.add.graphics();
    this.characterTitle = this.add
      .text(0, 0, "CHOOSE YOUR CHARACTER", armoryTextStyle("pageTitle"))
      .setOrigin(0.5);
    this.characterSubtitle = this.add
      .text(0, 0, "Your whole-art hero is saved for every destination.", {
        ...armoryTextStyle("body", "textSecondary"),
        align: "center",
      })
      .setOrigin(0.5);
    this.characterHint = this.add
      .text(0, 0, "Arrows move · Enter / Space selects · Tab opens Destinations", {
        ...armoryTextStyle("secondary", "textMuted", true),
        align: "center",
      })
      .setOrigin(0.5);
    root.add([
      this.characterChrome,
      this.characterTitle,
      this.characterSubtitle,
      this.characterHint,
    ]);

    for (const option of characterSelectionOptions(this.selectedCharacterId)) {
      const frame = this.add
        .rectangle(0, 0, 260, 390, ARMORY_COLORS.surface1, 1)
        .setStrokeStyle(2, ARMORY_COLORS.border, 1);
      const portraitPaper = this.add
        .rectangle(0, -32, 226, 278, ARMORY_COLORS.surface0, 1)
        .setStrokeStyle(1, ARMORY_COLORS.stitch, 0.9);
      const portrait = buildCharacterPortrait(this, option.id, 210, 258).setPosition(0, -32);
      const name = this.add
        .text(0, 132, option.name, armoryTextStyle("section"))
        .setOrigin(0.5)
        .setWordWrapWidth(230)
        .setAlign("center");
      const status = this.add
        .text(0, 168, "", armoryTextStyle("secondary", "textMuted", true))
        .setOrigin(0.5);
      const hitZone = this.add
        .rectangle(0, 0, 260, 390, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true });
      const cardRoot = this.add.container(0, 0, [
        frame,
        portraitPaper,
        portrait,
        name,
        status,
        hitZone,
      ]);
      const card: CharacterCardControl = {
        id: option.id,
        root: cardRoot,
        frame,
        name,
        status,
      };
      hitZone
        .on("pointerover", () => {
          this.characterFocusIndex = this.characterCards.indexOf(card);
          this.refreshCharacterWorkspace();
        })
        .on("pointerdown", () => {
          this.audio.resume();
          this.selectCharacter(card.id);
        });
      root.add(cardRoot);
      this.characterCards.push(card);
    }
    this.characterRoot = root;
    this.refreshCharacterWorkspace();
  }

  private selectCharacter(id: WholeArtCharacter): void {
    const selection = saveCharacterSelection(id);
    this.selectedCharacterId = selection.selectedCharacterId;
    this.characterFocusIndex = Math.max(
      0,
      WHOLE_ART_CHARACTERS.indexOf(this.selectedCharacterId),
    );
    this.audio.play("armory:stage");
    this.refreshCharacterWorkspace();
  }

  private refreshCharacterWorkspace(): void {
    for (const [index, card] of this.characterCards.entries()) {
      const selected = card.id === this.selectedCharacterId;
      const focused = index === this.characterFocusIndex;
      card.frame
        .setFillStyle(selected ? 0x14232a : ARMORY_COLORS.surface1, 1)
        .setStrokeStyle(
          selected ? 3 : focused ? 2.5 : 1.5,
          selected
            ? ARMORY_COLORS.success
            : focused
              ? ARMORY_COLORS.accent
              : ARMORY_COLORS.border,
          1,
        );
      card.name.setColor(selected ? TITLE_COLOR : ARMORY_CSS_COLORS.textPrimary);
      card.status
        .setText(selected ? "SELECTED · READY" : focused ? "ENTER TO SELECT" : "AVAILABLE")
        .setColor(selected ? ARMORY_CSS_COLORS.success : ARMORY_CSS_COLORS.textMuted);
      card.root.setScale((focused ? 1.025 : 1) * this.characterCardScale);
    }
  }

  private layoutCharacterWorkspace(): void {
    if (!this.characterRoot || !this.characterChrome) return;
    const w = this.screenW();
    const h = this.screenH();
    const chrome = this.characterChrome.clear();
    chrome.fillStyle(ARMORY_COLORS.bg, 0.99).fillRect(0, 0, w, h);
    this.characterTitle?.setPosition(w / 2, 92);
    this.characterSubtitle?.setPosition(w / 2, 124);

    const cardWidth = 260;
    const cardHeight = 390;
    const gap = 24;
    const count = this.characterCards.length;
    const columns = Math.min(
      Math.max(1, count),
      Math.max(1, Math.floor((w - 48 + gap) / (cardWidth + gap))),
    );
    const rows = Math.max(1, Math.ceil(count / columns));
    const availableHeight = Math.max(180, h - 310);
    const rawGridWidth = columns * cardWidth + (columns - 1) * gap;
    const rawGridHeight = rows * cardHeight + (rows - 1) * gap;
    const scale = Math.max(
      0.45,
      Math.min(1, (w - 48) / rawGridWidth, availableHeight / rawGridHeight),
    );
    this.characterCardScale = scale;
    const pitchX = (cardWidth + gap) * scale;
    const pitchY = (cardHeight + gap) * scale;
    const gridWidth = columns * cardWidth * scale + (columns - 1) * gap * scale;
    const gridHeight = rows * cardHeight * scale + (rows - 1) * gap * scale;
    const startX = (w - gridWidth) / 2 + (cardWidth * scale) / 2;
    const startY =
      150 +
      Math.max(0, (availableHeight - gridHeight) / 2) +
      (cardHeight * scale) / 2;
    this.characterCards.forEach((card, index) => {
      card.root
        .setPosition(
          startX + (index % columns) * pitchX,
          startY + Math.floor(index / columns) * pitchY,
        )
        .setScale((index === this.characterFocusIndex ? 1.025 : 1) * scale);
    });

    this.characterHint?.setPosition(w / 2, h - 142);
    const companionScale = Math.min(1, (w - 40) / 580);
    this.companionRow?.setPosition(w / 2, h - 72).setScale(companionScale);
  }

  private layoutDestinationsPrestige(): void {
    const w = this.screenW();
    const h = this.screenH();
    this.destinationsWorldTier?.setPosition(w - 110, 44);
    if (!this.prestigeRoot || !this.prestigePanel) return;
    const drawerWidth = Math.min(404, Math.max(300, w - 40));
    const drawerHeight = Math.min(640, Math.max(420, h - 140));
    this.prestigeRoot.setPosition(
      w - drawerWidth / 2 - 20,
      Math.max(drawerHeight / 2 + 70, h / 2),
    );
    this.prestigePanel.setSize(drawerWidth, drawerHeight);
    this.prestigeTierText
      ?.setPosition(-drawerWidth / 2 + 22, -drawerHeight / 2 + 24)
      .setWordWrapWidth(drawerWidth - 44);
    this.prestigeCostText
      ?.setPosition(-drawerWidth / 2 + 22, -drawerHeight / 2 + 132)
      .setWordWrapWidth(drawerWidth - 44);
    this.prestigeSurvivorText
      ?.setPosition(-drawerWidth / 2 + 22, 32)
      .setWordWrapWidth(drawerWidth - 44);
    this.prestigeButtonBg
      ?.setPosition(0, drawerHeight / 2 - 54)
      .setSize(drawerWidth - 44, 52);
    this.prestigeButtonText?.setPosition(0, drawerHeight / 2 - 54);
    const holdTrack = this.prestigeRoot.list[6] as Phaser.GameObjects.Rectangle | undefined;
    holdTrack
      ?.setPosition(-drawerWidth / 2 + 22, drawerHeight / 2 - 20)
      .setSize(drawerWidth - 44, 6);
    this.prestigeHoldFill
      ?.setPosition(-drawerWidth / 2 + 22, drawerHeight / 2 - 20)
      .setSize(drawerWidth - 44, 6);
  }

  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: retained as the dormant Wardrobe archive.
  private buildWardrobeWorkspace(): void {
    const root = this.add.container(0, 0).setDepth(10);
    this.wardrobeChrome = this.add.graphics();
    this.wardrobeTitle = this.add.text(0, 0, "", armoryTextStyle("body"));
    this.wardrobeStats = this.add
      .text(0, 0, "", { ...armoryTextStyle("secondary", "textSecondary", true), align: "center" })
      .setOrigin(0.5, 0);
    this.wardrobeInspector = this.add
      .text(0, 0, "", {
        ...armoryTextStyle("secondary", "textSecondary"),
        wordWrap: { width: 360, useAdvancedWrap: true },
      })
      .setOrigin(0, 0);
    this.wardrobeCollections = this.add
      .text(0, 0, "", {
        ...armoryTextStyle("secondary", "textSecondary", true),
        wordWrap: { width: 360, useAdvancedWrap: true },
      })
      .setOrigin(0, 0);
    this.wardrobeFooter = this.add
      .text(0, 0, "Arrows navigate Â· Enter equip Â· Q/E slot Â· Z/X page Â· R starter Â· 1â€“6 preset", {
        ...armoryTextStyle("secondary", "textSecondary", true),
        align: "center",
      })
      .setOrigin(0.5);
    this.wardrobeSearchText = this.add.text(0, 0, "", armoryTextStyle("body", "textSecondary"));
    this.wardrobeResultText = this.add
      .text(0, 0, "", armoryTextStyle("secondary", "textMuted", true))
      .setOrigin(1, 0.5);
    this.wardrobeDetailPaper = this.add.graphics();
    this.wardrobeSetPaper = this.add.graphics();
    this.wardrobeDetailArt = this.add.image(0, 0, "__WHITE").setVisible(false);
    this.wardrobePreviewSurface = new WardrobeCharacterPreview(this);
    root.add([
      this.wardrobeChrome,
      this.wardrobeTitle,
      this.wardrobeStats,
      this.wardrobePreviewSurface.root,
      this.wardrobeDetailPaper,
      this.wardrobeDetailArt,
      this.wardrobeInspector,
      this.wardrobeSetPaper,
      this.wardrobeCollections,
      this.wardrobeFooter,
      this.wardrobeSearchText,
      this.wardrobeResultText,
    ]);

    for (const [index, slot] of GEAR_SLOTS.entries()) {
      const chip = this.makeMenuChip(slot === "facialHair" ? "FACE" : slot.toUpperCase(), 100, () => {
        this.selectedGearSlot = slot;
        this.wardrobeFilters.slot = slot;
        this.wardrobeFocus.focus(0);
        this.wardrobeKeyboardFocus = false;
        this.wardrobeHoveredGearId = undefined;
        this.refreshWardrobeWorkspace();
      });
      chip.setData("slot", slot).setData("slotIndex", index);
      root.add(chip);
      this.wardrobeSlotRows.push(chip);
    }
    for (let index = 0; index < 6; index++) {
      const chip = this.makeMenuChip("", 72, () => this.applyWardrobePresetIndex(index), 48);
      root.add(chip);
      this.wardrobePresetRows.push(chip);
    }

    const search = this.makeMenuChip("", 300, () => {
      this.wardrobeSearchFocused = true;
      this.refreshWardrobeWorkspace();
    }, 48);
    (search.getData("text") as Phaser.GameObjects.Text).setVisible(false);
    search.setData("search", true);
    root.add(search);
    this.wardrobeToolbarRows.push(search);
    for (let index = 0; index < 6; index++) {
      const chip = this.makeMenuChip("", 96, () => this.cycleWardrobeFilter(index), 44);
      chip.setData("filterIndex", index);
      root.add(chip);
      this.wardrobeToolbarRows.push(chip);
    }

    this.wardrobeWorldTier = this.makeMenuChip("", 156, () => {
      this.prestigeDrawerOpen = !this.prestigeDrawerOpen;
      this.refreshPrestigeSurface();
      this.refreshWardrobeWorkspace();
    }, 48);
    root.add(this.wardrobeWorldTier);

    this.wardrobePrimary = this.makeMenuChip("", 260, () => this.activateWardrobeFocus(), 52);
    this.wardrobePrimaryText = this.wardrobePrimary.getData("text") as Phaser.GameObjects.Text;
    root.add(this.wardrobePrimary);

    for (let index = 0; index < 15; index++) {
      const tile = this.buildWardrobeTile();
      root.add(tile.root);
      this.wardrobeTiles.push(tile);
    }
    this.wardrobeRoot = root;
    this.buildPrestigeDrawer(root);
    this.prestigeRoot?.setVisible(false);
    this.refreshWardrobeWorkspace();
  }

  private buildWardrobeTile(): WardrobeTileControl {
    const paper = this.add.graphics();
    const art = this.add.image(0, 0, "__WHITE").setVisible(false);
    const icon = this.add.graphics();
    const name = this.add.text(0, 0, "", armoryTextStyle("body"));
    const rarity = this.add.text(0, 0, "", armoryTextStyle("secondary", "textSecondary", true));
    const status = this.add.text(0, 0, "", armoryTextStyle("secondary", "textMuted", true));
    const zone = this.add.rectangle(0, 0, 1, 1, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    const root = this.add.container(0, 0, [paper, art, icon, name, rarity, status, zone]);
    const tile: WardrobeTileControl = { root, paper, art, icon, name, rarity, status, zone };
    zone
      .on("pointerover", () => {
        tile.pointerIntent?.remove(false);
        tile.pointerIntent = this.time.delayedCall(80, () => {
          const id = tile.gearId;
          if (!id) return;
          this.wardrobeHoveredGearId = id;
          this.refreshWardrobeWorkspace();
        });
      })
      .on("pointerout", () => {
        tile.pointerIntent?.remove(false);
        tile.pointerIntent = undefined;
        if (this.wardrobeHoveredGearId === tile.gearId) {
          this.wardrobeHoveredGearId = undefined;
          this.refreshWardrobeWorkspace();
        }
      })
      .on("pointerdown", () => {
        const id = tile.gearId;
        if (!id) return;
        this.wardrobeKeyboardFocus = false;
        this.wardrobeFocusedGearId = id;
        const item = wardrobeCatalogItems(this.metaAccount, this.wardrobeFilters, (gearId) =>
          armoryArtStatusFromNotice(gearClickVisibilityNotice(GEAR_PARTS_MANIFEST, gearId)),
        ).find((row) => row.id === id);
        if (item?.owned) this.activateWardrobeItem(item);
        else this.refreshWardrobeWorkspace();
      });
    return tile;
  }

  private cycleWardrobeFilter(index: number): void {
    const next = <T,>(current: T, values: readonly T[]): T =>
      values[(Math.max(0, values.indexOf(current)) + 1) % values.length] ?? values[0] ?? current;
    if (index === 0)
      this.wardrobeFilters.ownership = next(this.wardrobeFilters.ownership, ["all", "owned", "locked"] as const);
    else if (index === 1)
      this.wardrobeFilters.rarity = next(this.wardrobeFilters.rarity, ["all", "Common", "Uncommon", "Rare", "Really Rare", "Ultimate"] as const);
    else if (index === 2) {
      const sets = ["all", ...wardrobeSetViews(this.metaAccount).map((set) => set.id)];
      this.wardrobeFilters.setId = next(this.wardrobeFilters.setId, sets);
    } else if (index === 3)
      this.wardrobeFilters.gearClass = next(this.wardrobeFilters.gearClass, ["all", "bruiser", "duelist", "caster", "warden", "scoundrel"] as const);
    else if (index === 4)
      this.wardrobeFilters.artStatus = next(this.wardrobeFilters.artStatus, ["all", "ready", "rendering", "unavailable", "artless"] as const);
    else
      this.wardrobeFilters.sort = next(this.wardrobeFilters.sort, ["recommended", "name", "rarity", "set", "owned", "newest"] as const);
    this.wardrobeFocus.focus(0);
    this.refreshWardrobeWorkspace();
  }

  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: retained as dormant Wardrobe key grammar.
  private moveWardrobeSlot(direction: -1 | 1): void {
    const index = GEAR_SLOTS.indexOf(this.selectedGearSlot);
    this.selectedGearSlot = GEAR_SLOTS[(index + direction + GEAR_SLOTS.length) % GEAR_SLOTS.length] ?? "hat";
    this.wardrobeFilters.slot = this.selectedGearSlot;
    this.wardrobeFocus.focus(0);
    this.wardrobeHoveredGearId = undefined;
    this.refreshWardrobeWorkspace();
  }

  private activateWardrobeFocus(): void {
    const rows = wardrobeCatalogItems(this.metaAccount, this.wardrobeFilters, (gearId) =>
      armoryArtStatusFromNotice(gearClickVisibilityNotice(GEAR_PARTS_MANIFEST, gearId)),
    );
    const item = rows[this.wardrobeFocus.focusedIndex] ?? rows.find((row) => row.id === this.wardrobeFocusedGearId);
    if (item) this.activateWardrobeItem(item);
  }

  private activateWardrobeItem(item: WardrobeSlotItemView): void {
    if (!item.owned) {
      this.audio.play("drive:empty");
      return;
    }
    if (item.equipped && item.id !== STARTER_GEAR_LOADOUT[item.def.slot]) {
      const next = unequipWardrobeSlot(this.metaAccount, item.def.slot);
      this.metaAccount = savePetMetaAccount(next);
      const selected = Math.max(1, this.wardrobePresetState.selected);
      this.wardrobePresetState = overwriteWardrobePreset(this.wardrobePresetState, this.metaAccount, selected);
      this.wardrobePresetState = saveWardrobePresetState(this.wardrobePresetState, this.metaAccount);
      this.audio.play("wardrobe:equip");
      this.refreshWardrobeWorkspace();
      return;
    }
    this.equipWardrobe(item.id);
  }

  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: retained as dormant Wardrobe layout code.
  private layoutWardrobeWorkspace(layout: ReturnType<typeof wardrobeViewportLayout>): void {
    if (!this.wardrobeRoot || !this.wardrobeChrome) return;
    this.wardrobeLayout = layout;
    this.wardrobeRoot.setPosition(0, 0).setScale(1);
    const g = this.wardrobeChrome.clear();
    g.fillStyle(ARMORY_COLORS.bg, 0.99).fillRect(0, 0, this.screenW(), this.screenH());
    for (const rect of [
      layout.headerRect,
      layout.slotRailRect,
      layout.heroRect,
      layout.catalogRect,
      layout.detailRect,
      layout.footerRect,
    ])
      drawArmoryPanel(g, rect.x, rect.y, rect.width, rect.height, { major: true });

    this.wardrobeTitle?.setPosition(layout.headerRect.x + 16, layout.headerRect.y + 14).setFontSize(24);
    this.wardrobeFooter?.setPosition(
      layout.footerRect.x + layout.footerRect.width / 2,
      layout.footerRect.y + layout.footerRect.height / 2,
    );
    this.wardrobeWorldTier?.setPosition(
      layout.headerRect.x + layout.headerRect.width - 92,
      layout.headerRect.y + layout.headerRect.height / 2,
    );
    layout.presetChipRects.forEach((rect, index) => {
      const chip = this.wardrobePresetRows[index];
      const bg = chip?.getData("bg") as Phaser.GameObjects.Rectangle | undefined;
      chip?.setPosition(rect.x + rect.width / 2, rect.y + rect.height / 2);
      bg?.setSize(rect.width, rect.height);
    });
    layout.slotRects.forEach((rect, index) => {
      const chip = this.wardrobeSlotRows[index];
      const bg = chip?.getData("bg") as Phaser.GameObjects.Rectangle | undefined;
      chip?.setPosition(rect.x + rect.width / 2, rect.y + rect.height / 2);
      bg?.setSize(rect.width, rect.height);
      const text = chip?.getData("text") as Phaser.GameObjects.Text | undefined;
      text?.setVisible(layout.mode === "wide").setFontSize(14);
      const icon = chip?.getData("icon") as Phaser.GameObjects.Graphics | undefined;
      if (!icon && chip) {
        const graphics = this.add.graphics();
        drawArmoryIcon(graphics, GEAR_SLOTS[index] ?? "hat", 0, 0, ARMORY_COLORS.textSecondary, 0.86);
        chip.add(graphics);
        chip.setData("icon", graphics);
      }
    });

    const base = WARDROBE_LAYOUT.previewArt;
    const target = layout.heroArtRect;
    const previewScale = Math.min(target.width / base.width, target.height / (base.height + 32));
    this.wardrobePreviewSurface?.root
      .setScale(previewScale)
      .setPosition(
        target.x + target.width / 2 - (base.x + base.width / 2) * previewScale,
        target.y + target.height / 2 - (base.y + base.height / 2) * previewScale,
      );
    this.wardrobeStats?.setPosition(
      layout.heroRect.x + layout.heroRect.width / 2,
      layout.companionShelfRect.y - 48,
    );
    this.companionRow?.setPosition(
      layout.companionShelfRect.x + layout.companionShelfRect.width / 2,
      layout.companionShelfRect.y + layout.companionShelfRect.height / 2,
    );
    const companionPanel = this.companionRow?.getData("panel") as Phaser.GameObjects.Rectangle | undefined;
    const companionHeading = this.companionRow?.getData("heading") as Phaser.GameObjects.Text | undefined;
    companionPanel?.setSize(layout.companionShelfRect.width, layout.companionShelfRect.height);
    const compactCompanions = layout.mode !== "wide";
    companionHeading?.setVisible(!compactCompanions);
    this.companionDetail?.setVisible(!compactCompanions);
    this.companionName
      ?.setPosition(compactCompanions ? -layout.companionShelfRect.width / 2 + 10 : -274, compactCompanions ? -44 : -20)
      .setFontSize(compactCompanions ? 14 : 18);
    this.companionChips.forEach((chip, index) =>
      chip.root.setPosition(compactCompanions ? -154 + index * 44 : 12 + index * 52, compactCompanions ? 20 : 0),
    );

    const toolbar = layout.catalogToolbarRect;
    const search = this.wardrobeToolbarRows[0];
    const searchBg = search?.getData("bg") as Phaser.GameObjects.Rectangle | undefined;
    const searchW = Math.max(180, toolbar.width - 132);
    search?.setPosition(toolbar.x + searchW / 2, toolbar.y + 24);
    searchBg?.setSize(searchW, 48);
    this.wardrobeSearchText?.setPosition(toolbar.x + 14, toolbar.y + 14);
    this.wardrobeResultText?.setPosition(toolbar.x + toolbar.width, toolbar.y + 24);
    const chipCols = layout.mode === "wide" ? 6 : 3;
    const chipGap = 8;
    const chipW = (toolbar.width - chipGap * (chipCols - 1)) / chipCols;
    for (let index = 0; index < 6; index++) {
      const chip = this.wardrobeToolbarRows[index + 1];
      const col = index % chipCols;
      const row = Math.floor(index / chipCols);
      const y = toolbar.y + 58 + row * 48;
      chip?.setPosition(toolbar.x + col * (chipW + chipGap) + chipW / 2, y + 22);
      (chip?.getData("bg") as Phaser.GameObjects.Rectangle | undefined)?.setSize(chipW, 44);
    }
    this.wardrobeInspector
      ?.setPosition(layout.detailRect.x + 16, layout.detailRect.y + 16)
      .setWordWrapWidth(layout.detailRect.width - 32);
    this.wardrobeDetailArt?.setPosition(
      layout.detailArtRect.x + layout.detailArtRect.width / 2,
      layout.detailArtRect.y + layout.detailArtRect.height / 2,
    );
    this.wardrobeCollections
      ?.setPosition(layout.collectionsRect.x, layout.collectionsRect.y)
      .setWordWrapWidth(layout.collectionsRect.width);
    this.wardrobePrimary?.setPosition(
      layout.detailRect.x + layout.detailRect.width / 2,
      layout.detailRect.y + layout.detailRect.height - 42,
    );
    (this.wardrobePrimary?.getData("bg") as Phaser.GameObjects.Rectangle | undefined)?.setSize(
      layout.detailRect.width - 32,
      52,
    );
    this.prestigeRoot?.setPosition(
      layout.detailRect.x + layout.detailRect.width / 2,
      layout.detailRect.y + layout.detailRect.height / 2,
    );
    const drawerW = layout.detailRect.width;
    const drawerH = layout.detailRect.height;
    this.prestigePanel?.setSize(drawerW, drawerH);
    this.prestigeTierText
      ?.setPosition(-drawerW / 2 + 16, -drawerH / 2 + 18)
      .setWordWrapWidth(drawerW - 32);
    this.prestigeCostText
      ?.setPosition(-drawerW / 2 + 16, -drawerH / 2 + 118)
      .setWordWrapWidth(drawerW - 32);
    this.prestigeSurvivorText
      ?.setPosition(-drawerW / 2 + 16, -drawerH / 2 + Math.min(350, drawerH * 0.5))
      .setWordWrapWidth(drawerW - 32);
    this.prestigeButtonBg?.setPosition(0, drawerH / 2 - 48).setSize(drawerW - 32, 52);
    this.prestigeButtonText?.setPosition(0, drawerH / 2 - 48);
    const holdTrack = this.prestigeRoot?.list[6] as Phaser.GameObjects.Rectangle | undefined;
    holdTrack?.setPosition(-drawerW / 2 + 16, drawerH / 2 - 16).setSize(drawerW - 32, 6);
    this.prestigeHoldFill
      ?.setPosition(-drawerW / 2 + 16, drawerH / 2 - 16)
      .setSize(drawerW - 32, 6);
  }

  private refreshWardrobeWorkspace(): void {
    if (!this.wardrobeRoot || !this.wardrobeLayout) return;
    this.wardrobeFilters.slot = this.selectedGearSlot;
    const rows = wardrobeCatalogItems(this.metaAccount, this.wardrobeFilters, (gearId) =>
      armoryArtStatusFromNotice(gearClickVisibilityNotice(GEAR_PARTS_MANIFEST, gearId)),
    );
    const layout = this.wardrobeLayout;
    this.wardrobeFocus.configure(
      layout.gridColumns,
      rows.length,
      layout.gridRowHeight,
      layout.catalogViewportRect.height,
    );
    const focusItem = rows[this.wardrobeFocus.focusedIndex];
    if (this.wardrobeKeyboardFocus) this.wardrobeFocusedGearId = focusItem?.id;
    const equippedId = this.metaAccount.equippedGear[this.selectedGearSlot];
    const inspectedId =
      (this.wardrobeKeyboardFocus ? focusItem?.id : this.wardrobeHoveredGearId) ??
      this.wardrobeFocusedGearId ??
      equippedId;
    const inspected = wardrobeSlotItems(this.metaAccount, this.selectedGearSlot).find(
      (item) => item.id === inspectedId,
    );
    const previewId = inspectedId === equippedId ? undefined : inspectedId;
    this.wardrobePreviewSurface?.refresh(
      this.metaAccount.equippedGear,
      this.metaAccount.prestige,
      previewId,
    );
    const preset = wardrobePresetViews(this.wardrobePresetState).find(
      (row) => row.index === this.wardrobePresetState.selected,
    );
    this.wardrobeTitle?.setText(
      `CLOSET  Â·  Editing preset ${this.wardrobePresetState.selected + 1} â€” ${preset?.name ?? "Starter / Reset"}  Â·  SAVED`,
    );
    (this.wardrobeWorldTier?.getData("text") as Phaser.GameObjects.Text | undefined)?.setText(
      `WORLD TIER ${this.metaAccount.prestige}`,
    );
    const allOwned = this.metaAccount.ownedGear.length;
    this.wardrobeResultText?.setText(`${rows.length} results  Â·  ${allOwned}/${GEAR_IDS.length} owned`);
    this.wardrobeSearchText
      ?.setText(
        this.wardrobeFilters.query
          ? `${this.wardrobeSearchFocused ? "|" : ""}${this.wardrobeFilters.query}`
          : this.wardrobeSearchFocused
            ? "| Search closet"
            : "/  Search closet",
      )
      .setColor(this.wardrobeSearchFocused ? ARMORY_CSS_COLORS.accent : ARMORY_CSS_COLORS.textSecondary);
    const filterLabels = [
      `OWN ${this.wardrobeFilters.ownership}`,
      `RAR ${this.wardrobeFilters.rarity}`,
      `SET ${this.wardrobeFilters.setId}`,
      `CLASS ${this.wardrobeFilters.gearClass}`,
      `ART ${this.wardrobeFilters.artStatus}`,
      `SORT ${this.wardrobeFilters.sort}`,
    ];
    filterLabels.forEach((label, index) => {
      const text = this.wardrobeToolbarRows[index + 1]?.getData("text") as Phaser.GameObjects.Text | undefined;
      text?.setText(label.length > 17 ? `${label.slice(0, 16)}â€¦` : label).setFontSize(14);
    });
    const presets = wardrobePresetViews(this.wardrobePresetState);
    this.wardrobePresetRows.forEach((chip, index) => {
      (chip.getData("text") as Phaser.GameObjects.Text)
        .setText(index === 0 && layout.mode === "wide" ? "1 RESET" : String(index + 1))
        .setFontSize(14);
      (chip.getData("bg") as Phaser.GameObjects.Rectangle)
        .setFillStyle(presets[index]?.selected ? ARMORY_COLORS.surface3 : ARMORY_COLORS.surface2, 1)
        .setStrokeStyle(presets[index]?.selected ? 2 : 1, presets[index]?.selected ? ARMORY_COLORS.action : ARMORY_COLORS.border);
    });
    this.wardrobeSlotRows.forEach((chip, index) => {
      const selected = GEAR_SLOTS[index] === this.selectedGearSlot;
      (chip.getData("bg") as Phaser.GameObjects.Rectangle)
        .setFillStyle(selected ? ARMORY_COLORS.surface3 : ARMORY_COLORS.surface2, 1)
        .setStrokeStyle(selected ? 3 : 1, selected ? ARMORY_COLORS.accent : ARMORY_COLORS.border);
    });
    const window = virtualGridWindow({
      itemCount: rows.length,
      columns: layout.gridColumns,
      rowHeight: layout.gridRowHeight,
      viewportHeight: layout.catalogViewportRect.height,
      scrollOffset: this.wardrobeFocus.scrollOffset,
      overscanRows: 1,
    });
    this.wardrobeFocus.scrollOffset = window.scrollOffset;
    this.wardrobeTiles.forEach((tile, poolIndex) => {
      const rowIndex = window.firstIndex + poolIndex;
      const item = rowIndex < window.lastIndexExclusive ? rows[rowIndex] : undefined;
      tile.root.setVisible(!!item && poolIndex < layout.tilePoolSize);
      tile.gearId = item?.id;
      if (!item) return;
      const col = rowIndex % layout.gridColumns;
      const logicalRow = Math.floor(rowIndex / layout.gridColumns);
      const x = layout.catalogViewportRect.x + col * ((layout.catalogViewportRect.width + layout.gridGap) / layout.gridColumns);
      const y = layout.catalogViewportRect.y + logicalRow * layout.gridRowHeight - window.scrollOffset;
      const width = (layout.catalogViewportRect.width - layout.gridGap * (layout.gridColumns - 1)) / layout.gridColumns;
      const height = layout.gridRowHeight - layout.gridGap;
      tile.root.setPosition(x, y);
      tile.paper.clear();
      drawArmoryPanel(tile.paper, 0, 0, width, height, {
        major: false,
        selected: rowIndex === this.wardrobeFocus.focusedIndex && this.wardrobeKeyboardFocus,
        fill: item.equipped ? 0x16251d : ARMORY_COLORS.surface2,
        accent: item.equipped ? ARMORY_COLORS.success : undefined,
      });
      const artHeight = height * 0.57;
      const visibility = gearClickVisibility(GEAR_PARTS_MANIFEST, item.id);
      const manifestItem = GEAR_PARTS_MANIFEST
        ? gearManifestItem(GEAR_PARTS_MANIFEST, item.id)
        : undefined;
      const textureKey = manifestItem ? gearTextureKey(manifestItem) : "";
      const artReady = visibility === "installed" && textureKey && this.textures.exists(textureKey);
      tile.art
        .setVisible(!!artReady)
        .setTexture(artReady ? textureKey : "__WHITE")
        .setPosition(width / 2, artHeight / 2 + 4)
        .setDisplaySize(width * 0.76, artHeight * 0.88)
        .setAlpha(item.owned ? 1 : 0.55);
      tile.icon.clear();
      if (!artReady)
        drawArmoryIcon(
          tile.icon,
          artStatusIcon(item.artStatus ?? "rendering"),
          width / 2,
          artHeight / 2,
          ARMORY_ART_STATUS[item.artStatus ?? "rendering"].color,
          1.5,
        );
      tile.name
        .setText(item.def.name)
        .setPosition(10, artHeight + 8)
        .setWordWrapWidth(width - 20)
        .setColor(item.owned ? ARMORY_CSS_COLORS.textPrimary : ARMORY_CSS_COLORS.textMuted);
      const rarity = rarityToken(item.def.rarity);
      tile.rarity
        .setText(rarityMark(item.def.rarity))
        .setPosition(10, height - 44)
        .setColor(`#${rarity.color.toString(16).padStart(6, "0")}`);
      const artState = ARMORY_ART_STATUS[item.artStatus ?? "rendering"];
      tile.status
        .setText(`${artState.label}${item.equipped ? "  Â·  EQUIPPED" : item.owned ? "  Â·  OWNED" : "  Â·  LOCKED"}`)
        .setPosition(10, height - 23)
        .setColor(`#${artState.color.toString(16).padStart(6, "0")}`);
      tile.zone.setPosition(width / 2, height / 2).setSize(width, height);
    });
    const preview = wardrobePreview(this.metaAccount);
    this.wardrobeStats?.setText(
      `STR ${preview.baseStats.str}  Â·  DEX ${preview.baseStats.dex}  Â·  INT ${preview.baseStats.int}  Â·  CON ${preview.baseStats.con}  Â·  LUK ${preview.baseStats.luk}\n${preview.quirk.name}`,
    );
    this.refreshWardrobeDetail(inspected);
    this.prestigeRoot?.setVisible(this.prestigeDrawerOpen);
    this.refreshPrestigeSurface();
  }

  private refreshWardrobeDetail(item: WardrobeSlotItemView | undefined): void {
    const layout = this.wardrobeLayout;
    if (!layout || !this.wardrobeInspector || !this.wardrobeCollections || !this.wardrobeDetailPaper) return;
    this.wardrobeDetailPaper.clear();
    this.wardrobeSetPaper?.clear();
    if (!item) {
      this.wardrobeInspector.setText("No matches\nClear filters to restore the catalog.");
      this.wardrobeCollections.setText("");
      this.wardrobeDetailArt?.setVisible(false);
      this.wardrobePrimary?.setVisible(false);
      return;
    }
    const artStatus = armoryArtStatusFromNotice(
      gearClickVisibilityNotice(GEAR_PARTS_MANIFEST, item.id),
    );
    const state = ARMORY_ART_STATUS[artStatus];
    const rarity = rarityToken(item.def.rarity);
    const equipped = this.metaAccount.equippedGear[item.def.slot];
    const equippedDef = GEAR_CATALOG[equipped];
    const statLines = Object.entries(item.def.stats)
      .map(([attr, value]) => `${attr.toUpperCase()}  ${Number(value) >= 0 ? "+" : ""}${value}`)
      .join("  Â·  ") || "Flat signature profile";
    this.wardrobeInspector
      .setText(
        `${item.def.name}\n${rarityMark(item.def.rarity)}\n${state.label}\n\nCompared with ${equippedDef.name}\n${statLines}\n${item.def.effectText}\n\n${item.owned ? "Owned" : item.lockedCopy}  Â·  ${item.def.gearClass}`,
      )
      .setColor(ARMORY_CSS_COLORS.textSecondary);
    const manifestItem = GEAR_PARTS_MANIFEST
      ? gearManifestItem(GEAR_PARTS_MANIFEST, item.id)
      : undefined;
    const textureKey = manifestItem ? gearTextureKey(manifestItem) : "";
    const artReady = artStatus === "ready" && textureKey && this.textures.exists(textureKey);
    this.wardrobeDetailArt
      ?.setVisible(!!artReady)
      .setTexture(artReady ? textureKey : "__WHITE")
      .setDisplaySize(layout.detailArtRect.width * 0.82, layout.detailArtRect.height * 0.94);
    if (!artReady) {
      drawArmoryPanel(
        this.wardrobeDetailPaper,
        layout.detailArtRect.x,
        layout.detailArtRect.y,
        layout.detailArtRect.width,
        layout.detailArtRect.height,
        { major: false, fill: ARMORY_COLORS.surface2, accent: state.color },
      );
      drawArmoryIcon(
        this.wardrobeDetailPaper,
        artStatusIcon(artStatus),
        layout.detailArtRect.x + layout.detailArtRect.width / 2,
        layout.detailArtRect.y + layout.detailArtRect.height / 2,
        state.color,
        1.8,
      );
    }
    const sets = wardrobeSetViews(this.metaAccount);
    const selectedSet = sets.find((set) => set.id === item.def.legacySetId);
    const collectionCopy =
      layout.mode === "wide"
        ? sets.map((set) => `${set.name}  ${set.owned}/${set.total}${set.equipped ? `  worn ${set.equipped}` : ""}`).join("\n")
        : selectedSet
          ? `${selectedSet.name}\nOwned ${selectedSet.owned}/${selectedSet.total}  Â·  Equipped ${selectedSet.equipped}/${selectedSet.total}\nMissing: ${selectedSet.missingSlots.join(", ") || "none"}\n\n12 player-completable collections`
          : "No player-completable set\n12 collections tracked";
    this.wardrobeCollections.setText(collectionCopy).setFontSize(14);
    if (selectedSet && this.wardrobeSetPaper) {
      const stitchY = Math.min(
        layout.detailRect.y + layout.detailRect.height - 104,
        layout.collectionsRect.y - 18,
      );
      const stitchW = (layout.detailRect.width - 40) / 8;
      selectedSet.slots.forEach((slot, index) => {
        const x = layout.detailRect.x + 16 + index * stitchW;
        this.wardrobeSetPaper
          ?.lineStyle(2, slot.equipped ? ARMORY_COLORS.accent : slot.owned ? ARMORY_COLORS.success : ARMORY_COLORS.stitch, 1)
          .strokeRoundedRect(x, stitchY, stitchW - 4, 10, 3);
      });
    }
    const action = !item.owned
      ? item.lockedCopy
      : item.equipped && item.id !== STARTER_GEAR_LOADOUT[item.def.slot]
        ? "Unequip to starter"
        : item.equipped
          ? "Starter equipped"
          : `Equip to preset ${Math.max(1, this.wardrobePresetState.selected + 1)}`;
    this.wardrobePrimary?.setVisible(true);
    this.wardrobePrimaryText?.setText(action);
    (this.wardrobePrimary?.getData("bg") as Phaser.GameObjects.Rectangle | undefined)
      ?.setFillStyle(item.owned ? 0x342b1a : ARMORY_COLORS.surface2, 1)
      .setStrokeStyle(2, item.owned ? ARMORY_COLORS.action : ARMORY_COLORS.border);
    this.wardrobePrimaryText?.setColor(
      item.owned ? ARMORY_CSS_COLORS.action : ARMORY_CSS_COLORS.textMuted,
    );
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
    this.refreshWardrobeWorkspace();
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
    this.refreshWardrobeWorkspace();
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
    const artNotice = gearClickVisibilityNotice(GEAR_PARTS_MANIFEST, inspectedId);
    this.setBoundedWardrobeText(
      this.wardrobeInspector,
      `${def.name}\n${def.rarity} · ${gearRarityPips(def)} · ${def.gearClass}\n${def.effectText}\n${dependency}${artNotice ? `\n${artNotice}` : ""}`,
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

  private armoryWorkspaceLayout(): {
    mode: "wide" | "floor";
    header: { x: number; y: number; width: number; height: number };
    footer: { x: number; y: number; width: number; height: number };
    library: { x: number; y: number; width: number; height: number };
    detail: { x: number; y: number; width: number; height: number };
    carry: { x: number; y: number; width: number; height: number };
    columns: number;
    gap: number;
    rowHeight: number;
    viewport: { x: number; y: number; width: number; height: number };
  } {
    const width = this.screenW();
    const height = this.screenH();
    const mode = width >= 1440 ? "wide" : "floor";
    const floor = mode === "floor";
    const margin = floor ? 16 : 24;
    const gap = floor ? 8 : 12;
    const headerH = floor ? 72 : 88;
    const footerH = floor ? 60 : 64;
    const bodyY = floor ? 84 : 100;
    const bodyH = height - bodyY - footerH - (floor ? 0 : gap);
    const libraryW = floor ? 640 : 1016;
    const detailW = floor ? 304 : 432;
    const carryW = floor ? 288 : 400;
    const library = { x: margin, y: bodyY, width: libraryW, height: bodyH };
    const detail = { x: library.x + libraryW + gap, y: bodyY, width: detailW, height: bodyH };
    const carry = { x: detail.x + detailW + gap, y: bodyY, width: carryW, height: bodyH };
    const toolbarH = floor ? 132 : 116;
    return {
      mode,
      header: { x: margin, y: 0, width: width - margin * 2, height: headerH },
      footer: { x: margin, y: height - footerH, width: width - margin * 2, height: footerH },
      library,
      detail,
      carry,
      columns: floor ? 2 : 4,
      gap,
      rowHeight: floor ? 144 : 162,
      viewport: {
        x: library.x + 16,
        y: library.y + 16 + toolbarH,
        width: library.width - 32,
        height: library.height - 32 - toolbarH,
      },
    };
  }

  private buildArmoryWorkspace(): void {
    const root = this.add.container(0, 0).setDepth(10);
    this.armoryChrome = this.add.graphics();
    this.armoryTitle = this.add.text(0, 0, "ARMORY", armoryTextStyle("pageTitle"));
    this.armorySummaryText = this.add
      .text(0, 0, "", { ...armoryTextStyle("secondary", "textSecondary", true), wordWrap: { width: 380 } })
      .setOrigin(0, 0);
    this.armoryCarryText = this.add
      .text(0, 0, "", { ...armoryTextStyle("secondary", "textSecondary", true), wordWrap: { width: 360 } })
      .setOrigin(0, 0);
    this.armoryFooter = this.add
      .text(0, 0, "Arrows navigate Â· Enter stage/remove Â· Q/E zone Â· 1â€“3 active Â· destination commits", {
        ...armoryTextStyle("secondary", "textSecondary", true),
        align: "center",
      })
      .setOrigin(0.5);
    this.armorySearchText = this.add.text(0, 0, "", armoryTextStyle("body", "textSecondary"));
    this.armoryDetailPaper = this.add.graphics();
    this.armoryCarryPaper = this.add.graphics();
    this.armoryDetailArt = this.add.image(0, 0, "__WHITE").setVisible(false);
    root.add([
      this.armoryChrome,
      this.armoryDetailPaper,
      this.armoryCarryPaper,
      this.armoryDetailArt,
      this.armoryTitle,
      this.armorySummaryText,
      this.armoryCarryText,
      this.armoryFooter,
      this.armorySearchText,
    ]);
    const search = this.makeMenuChip("", 400, () => {
      this.armorySearchFocused = true;
      this.refreshArmoryWorkspace();
    }, 48);
    (search.getData("text") as Phaser.GameObjects.Text).setVisible(false);
    root.add(search);
    this.armoryToolbarRows.push(search);
    for (let index = 0; index < 5; index++) {
      const chip = this.makeMenuChip("", 120, () => this.cycleArmoryFilter(index), 44);
      root.add(chip);
      this.armoryToolbarRows.push(chip);
    }
    this.armoryPrimary = this.makeMenuChip("", 280, () => this.activateArmoryFocus(), 52);
    this.armoryPrimaryText = this.armoryPrimary.getData("text") as Phaser.GameObjects.Text;
    root.add(this.armoryPrimary);
    for (let index = 0; index < 30; index++) {
      const card = this.buildArmoryCard();
      root.add(card.root);
      this.armoryCards.push(card);
    }
    this.armoryRoot = root;
  }

  private buildArmoryCard(): ArmoryCardControl {
    const paper = this.add.graphics();
    const art = this.add.image(0, 0, "__WHITE").setVisible(false);
    const name = this.add.text(0, 0, "", armoryTextStyle("body"));
    const meta = this.add.text(0, 0, "", armoryTextStyle("secondary", "textSecondary", true));
    const status = this.add.text(0, 0, "", armoryTextStyle("secondary", "textMuted", true));
    const zone = this.add.rectangle(0, 0, 1, 1, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    const root = this.add.container(0, 0, [paper, art, name, meta, status, zone]);
    const card: ArmoryCardControl = { root, paper, art, name, meta, status, zone };
    zone
      .on("pointerover", () => {
        if (!card.entryId) return;
        this.armoryFocusedEntryId = card.entryId;
        const rows = armoryCatalogEntries(this.metaAccount, this.armoryDraft, this.armoryFilters);
        const index = rows.findIndex((row) => row.entry.entryId === card.entryId);
        if (index >= 0) this.armoryFocus.focus(index);
        this.refreshArmoryWorkspace();
      })
      .on("pointerdown", () => {
        if (!card.entryId) return;
        this.armoryFocusedEntryId = card.entryId;
        this.activateArmoryFocus();
      });
    return card;
  }

  private cycleArmoryFilter(index: number): void {
    const next = <T,>(current: T, values: readonly T[]): T =>
      values[(Math.max(0, values.indexOf(current)) + 1) % values.length] ?? values[0] ?? current;
    const all = armoryEntryViews(this.metaAccount, this.armoryDraft);
    if (index === 0)
      this.armoryFilters.zone = next(this.armoryFilters.zone, ["all", "safe", "staged", "active", "pack", "intake"] as const);
    else if (index === 1)
      this.armoryFilters.weaponClass = next(this.armoryFilters.weaponClass, ["all", ...new Set(all.flatMap((row) => row.weaponClass.split(" / ")))]);
    else if (index === 2)
      this.armoryFilters.rarity = next(this.armoryFilters.rarity, ["all", ...new Set(all.map((row) => row.rarity))]);
    else if (index === 3)
      this.armoryFilters.composition = next(this.armoryFilters.composition, ["all", "single", "pair"] as const);
    else
      this.armoryFilters.sort = next(this.armoryFilters.sort, ["recommended", "name", "rarity", "value", "size", "newest"] as const);
    this.armoryFocus.focus(0);
    this.refreshArmoryWorkspace();
  }

  private activateArmoryFocus(): void {
    const rows = armoryCatalogEntries(this.metaAccount, this.armoryDraft, this.armoryFilters);
    const item = rows[this.armoryFocus.focusedIndex] ?? rows.find((row) => row.entry.entryId === this.armoryFocusedEntryId);
    if (!item || item.source === "intake") {
      this.audio.play("drive:empty");
      return;
    }
    const result = toggleArmoryEntry(this.metaAccount, this.armoryDraft, item.entry.entryId);
    this.armoryDraft = result.draft;
    this.audio.play(result.error ? "drive:empty" : "armory:stage");
    this.refreshArmoryWorkspace();
  }

  private moveArmoryFocusedZone(direction: -1 | 1): void {
    const rows = armoryCatalogEntries(this.metaAccount, this.armoryDraft, this.armoryFilters);
    const item = rows[this.armoryFocus.focusedIndex] ?? rows.find((row) => row.entry.entryId === this.armoryFocusedEntryId);
    if (!item || item.source === "intake") return;
    const result = moveArmoryEntryZone(this.metaAccount, this.armoryDraft, item.entry.entryId, direction);
    this.armoryDraft = result.draft;
    this.audio.play(result.error ? "drive:empty" : "armory:stage");
    this.refreshArmoryWorkspace();
  }

  private layoutArmoryWorkspace(): void {
    if (!this.armoryRoot || !this.armoryChrome) return;
    const layout = this.armoryWorkspaceLayout();
    this.armoryLayoutMode = layout.mode;
    const g = this.armoryChrome.clear();
    g.fillStyle(ARMORY_COLORS.bg, 0.99).fillRect(0, 0, this.screenW(), this.screenH());
    for (const rect of [layout.header, layout.library, layout.detail, layout.carry, layout.footer])
      drawArmoryPanel(g, rect.x, rect.y, rect.width, rect.height);
    this.armoryTitle?.setPosition(layout.header.x + 16, layout.header.y + 14).setFontSize(24);
    this.armoryFooter?.setPosition(
      layout.footer.x + layout.footer.width / 2,
      layout.footer.y + layout.footer.height / 2,
    );
    const search = this.armoryToolbarRows[0];
    const searchW = Math.max(240, layout.library.width * 0.48);
    search?.setPosition(layout.library.x + 16 + searchW / 2, layout.library.y + 40);
    (search?.getData("bg") as Phaser.GameObjects.Rectangle | undefined)?.setSize(searchW, 48);
    this.armorySearchText?.setPosition(layout.library.x + 30, layout.library.y + 30);
    const filterW = (layout.library.width - 32 - 4 * 8) / 5;
    for (let index = 0; index < 5; index++) {
      const chip = this.armoryToolbarRows[index + 1];
      chip?.setPosition(
        layout.library.x + 16 + index * (filterW + 8) + filterW / 2,
        layout.library.y + 88,
      );
      (chip?.getData("bg") as Phaser.GameObjects.Rectangle | undefined)?.setSize(filterW, 44);
    }
    this.armorySummaryText
      ?.setPosition(layout.detail.x + 16, layout.detail.y + 16)
      .setWordWrapWidth(layout.detail.width - 32);
    this.armoryDetailArt?.setPosition(layout.detail.x + layout.detail.width / 2, layout.detail.y + 250);
    this.armoryCarryText
      ?.setPosition(layout.carry.x + 16, layout.carry.y + 16)
      .setWordWrapWidth(layout.carry.width - 32);
    this.armoryPrimary?.setPosition(
      layout.detail.x + layout.detail.width / 2,
      layout.detail.y + layout.detail.height - 42,
    );
    (this.armoryPrimary?.getData("bg") as Phaser.GameObjects.Rectangle | undefined)?.setSize(
      layout.detail.width - 32,
      52,
    );
    this.refreshArmoryWorkspace();
  }

  private refreshArmoryWorkspace(): void {
    if (!this.armoryRoot || !this.armoryChrome) return;
    const layout = this.armoryWorkspaceLayout();
    const rows = armoryCatalogEntries(this.metaAccount, this.armoryDraft, this.armoryFilters);
    this.armoryFocus.configure(layout.columns, rows.length, layout.rowHeight, layout.viewport.height);
    const item = rows[this.armoryFocus.focusedIndex];
    if (item) this.armoryFocusedEntryId = item.entry.entryId;
    const window = virtualGridWindow({
      itemCount: rows.length,
      columns: layout.columns,
      rowHeight: layout.rowHeight,
      viewportHeight: layout.viewport.height,
      scrollOffset: this.armoryFocus.scrollOffset,
      overscanRows: 1,
    });
    this.armoryFocus.scrollOffset = window.scrollOffset;
    this.armoryCards.forEach((card, poolIndex) => {
      const rowIndex = window.firstIndex + poolIndex;
      const view = rowIndex < window.lastIndexExclusive ? rows[rowIndex] : undefined;
      card.root.setVisible(!!view);
      card.entryId = view?.entry.entryId;
      if (!view) return;
      const col = rowIndex % layout.columns;
      const logicalRow = Math.floor(rowIndex / layout.columns);
      const cardW = (layout.viewport.width - layout.gap * (layout.columns - 1)) / layout.columns;
      const cardH = layout.rowHeight - layout.gap;
      card.root.setPosition(
        layout.viewport.x + col * (cardW + layout.gap),
        layout.viewport.y + logicalRow * layout.rowHeight - window.scrollOffset,
      );
      card.paper.clear();
      drawArmoryPanel(card.paper, 0, 0, cardW, cardH, {
        major: false,
        selected: rowIndex === this.armoryFocus.focusedIndex,
        fill: view.placement ? 0x2d2117 : ARMORY_COLORS.surface2,
        accent: view.placement ? ARMORY_COLORS.warning : undefined,
      });
      const lead = weaponEntryInstances(view.entry)[0];
      const artKey = lead ? bakeCardArt(this, lead.weaponId, 212, 296, 14) : "__WHITE";
      card.art
        .setTexture(artKey)
        .setCrop(0, 0, 212, 150)
        .setDisplaySize(cardW * 0.38, cardH - 16)
        .setPosition(cardW * 0.19 + 8, cardH / 2)
        .setVisible(!!lead);
      card.name.setText(view.name).setPosition(cardW * 0.4 + 8, 12).setWordWrapWidth(cardW * 0.58 - 16);
      card.meta
        .setText(`${view.rarity.toUpperCase()}  Â·  ${view.family}\n${view.paired ? "PAIR" : "SINGLE"}  Â·  ${view.physical} ${view.physical === 1 ? "CELL" : "CELLS"}`)
        .setPosition(cardW * 0.4 + 8, 48)
        .setWordWrapWidth(cardW * 0.58 - 16);
      card.status
        .setText(view.zone === "safe" ? "VAULT  Â·  SAFE" : view.zone === "intake" ? "INTAKE  Â·  BLOCKED" : `${view.zone.toUpperCase()}  Â·  AT RISK`)
        .setPosition(cardW * 0.4 + 8, cardH - 28)
        .setColor(view.zone === "safe" ? ARMORY_CSS_COLORS.success : view.zone === "intake" ? ARMORY_CSS_COLORS.danger : ARMORY_CSS_COLORS.warning);
      card.zone.setPosition(cardW / 2, cardH / 2).setSize(cardW, cardH);
    });
    const summary = armorySummary(this.metaAccount, this.armoryDraft);
    this.armoryTitle?.setText(
      `ARMORY  Â·  STASH ${this.metaAccount.weaponBank.stash.length}/72  Â·  ${rows.length} RESULTS`,
    );
    this.armorySearchText
      ?.setText(
        this.armoryFilters.query
          ? `${this.armorySearchFocused ? "|" : ""}${this.armoryFilters.query}`
          : this.armorySearchFocused
            ? "| Search stash"
            : "/  Search stash",
      )
      .setColor(this.armorySearchFocused ? ARMORY_CSS_COLORS.accent : ARMORY_CSS_COLORS.textSecondary);
    const labels = [
      `ZONE ${this.armoryFilters.zone}`,
      `CLASS ${this.armoryFilters.weaponClass}`,
      `RAR ${this.armoryFilters.rarity}`,
      `TYPE ${this.armoryFilters.composition}`,
      `SORT ${this.armoryFilters.sort}`,
    ];
    labels.forEach((label, index) =>
      (this.armoryToolbarRows[index + 1]?.getData("text") as Phaser.GameObjects.Text | undefined)
        ?.setText(label.length > 18 ? `${label.slice(0, 17)}â€¦` : label)
        .setFontSize(14),
    );
    const focused = rows[this.armoryFocus.focusedIndex];
    if (focused) {
      const lead = weaponEntryInstances(focused.entry)[0];
      this.armorySummaryText?.setText(
        `${focused.name}\n${focused.rarity.toUpperCase()}  Â·  ${focused.weaponClass}\n${focused.delivery}  Â·  ${focused.family}\n\n${focused.detail}\nVALUE  â—ˆ${focused.atRiskValue}\nSIZE  ${"â– ".repeat(focused.physical)}${"â–¡".repeat(Math.max(0, 3 - focused.physical))}\nSOURCE  ${focused.provenance}`,
      );
      const artKey = lead ? bakeCardArt(this, lead.weaponId, 212, 296, 14) : "__WHITE";
      this.armoryDetailArt
        ?.setTexture(artKey)
        .setDisplaySize(layout.detail.width - 64, 280)
        .setVisible(!!lead);
      this.armoryPrimary?.setVisible(true);
      const disabled = focused.source === "intake";
      this.armoryPrimaryText?.setText(
        disabled ? "Clear intake before staging" : focused.placement ? "Remove from carry" : "Stage in carry",
      );
      (this.armoryPrimary?.getData("bg") as Phaser.GameObjects.Rectangle | undefined)
        ?.setFillStyle(disabled ? ARMORY_COLORS.surface2 : 0x342b1a, 1)
        .setStrokeStyle(2, disabled ? ARMORY_COLORS.border : ARMORY_COLORS.action);
    } else {
      this.armorySummaryText?.setText("No matches\nClear filters to restore the library.");
      this.armoryDetailArt?.setVisible(false);
      this.armoryPrimary?.setVisible(false);
    }
    const active = this.armoryDraft.placements.filter((placement) => placement.zone === "active");
    const pack = this.armoryDraft.placements.filter((placement) => placement.zone === "pack");
    this.armoryCarryText?.setText(
      `CARRY PLAN\nAT RISK  ${summary.atRiskEntries} ENTRIES  Â·  â—ˆ${summary.atRiskValue}\nREQUIRED WORLD TIER  ${summary.requiredWorldTier}\n\nACTIVE  ${summary.activePhysical}/3 CELLS\n${active.map((placement) => `â–  ${armoryEntryViews(this.metaAccount, this.armoryDraft).find((row) => row.entry.entryId === placement.entryId)?.name ?? "Missing"}`).join("\n") || "â–¡ Empty"}\n\nPACK  ${summary.packPhysical}/${this.armoryDraft.packCapacity} CELLS\n${pack.map((placement) => `â–  ${armoryEntryViews(this.metaAccount, this.armoryDraft).find((row) => row.entry.entryId === placement.entryId)?.name ?? "Missing"}`).join("\n") || "â–¡ Empty"}\n\nSAFE VAULT  ${summary.safeEntries} ENTRIES\n${summary.intakeBlocked ? `INTAKE BLOCKED  Â·  ${this.metaAccount.weaponBank.intake.length} waiting` : "INTAKE CLEAR  Â·  READY"}`,
    );
    this.armoryCarryPaper?.clear();
    const cellY = layout.carry.y + layout.carry.height - 116;
    const cellW = (layout.carry.width - 48) / 3;
    for (let index = 0; index < 3; index++) {
      this.armoryCarryPaper
        ?.lineStyle(2, index < summary.activePhysical ? ARMORY_COLORS.warning : ARMORY_COLORS.stitch, 1)
        .strokeRoundedRect(layout.carry.x + 16 + index * (cellW + 8), cellY, cellW, 58, 6);
    }
    if (summary.intakeBlocked) this.armoryFooter?.setText("INTAKE BLOCKED  Â·  Make Stash room before entering a destination").setColor(ARMORY_CSS_COLORS.danger);
    else this.armoryFooter?.setText("Arrows navigate Â· Enter stage/remove Â· Q/E zone Â· 1â€“3 active Â· destination commits").setColor(ARMORY_CSS_COLORS.textSecondary);
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
        : "Pick a card to HOST a fresh run — players making the same pick can still join you.   (H toggles)",
    );
  }

  /** Pre-ready companion folio. Selection writes the account payload immediately and freezes on launch. */
  private buildCompanionRow(): void {
    const panel = this.add
      .rectangle(0, 0, 580, 112, ARMORY_COLORS.surface1, 0.98)
      .setStrokeStyle(2, ARMORY_COLORS.border, 0.95);
    const heading = this.add
      .text(-274, -45, "COMPANIONS", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: ARMORY_CSS_COLORS.accent,
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5);
    this.companionName = this.add
      .text(-274, -20, "", {
        fontSize: "18px",
        color: TITLE_COLOR,
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5);
    this.companionDetail = this.add
      .text(-274, 4, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#b8b1c4",
        lineSpacing: 4,
      })
      .setOrigin(0, 0);
    this.companionRow = this.add.container(0, 0, [
      panel,
      heading,
      this.companionName,
      this.companionDetail,
    ]).setDepth(20).setData({ panel, heading });

    for (const [i, id] of PET_IDS.entries()) {
      const x = 12 + i * 52;
      const frame = this.add.rectangle(0, 0, 44, 64, ARMORY_COLORS.surface2, 1).setStrokeStyle(1.5, ARMORY_COLORS.border, 1);
      const portrait = this.add
        .image(0, -2, `pet-select:${id}`)
        .setDisplaySize(124, 124)
        .setOrigin(0.5);
      const lock = this.add
        .text(0, 22, "LOCK", {
          fontFamily: "monospace",
          fontSize: "14px",
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
          this.refreshArmoryWorkspace();
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
    const fullScreenWorkspace = menuTabVisibility(this.menuTab).fullScreen;
    this.title
      .setVisible(!fullScreenWorkspace)
      .setPosition(w / 2, titleY)
      .setFontSize(Math.min(52, w / 13));
    this.subtitle.setVisible(!fullScreenWorkspace).setPosition(w / 2, titleY + 40);
    this.tabRow?.setPosition(w / 2, fullScreenWorkspace ? 44 : titleY + 76);
    this.layoutCharacterWorkspace();
    this.layoutArmoryWorkspace();
    this.layoutDestinationsPrestige();
    // §50 finding #1 — the launch-intent selector sits between the subtitle and the card grid.
    this.intentRow?.setPosition(w / 2, titleY + 126);

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
    this.audioRow?.setVisible(!fullScreenWorkspace).setPosition(24, h - 26);
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
            ...menuLaunchSelections(this.selectedCharacterId, account.selectedPetId),
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
