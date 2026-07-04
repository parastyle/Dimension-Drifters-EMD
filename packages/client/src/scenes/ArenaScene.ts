import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type ArenaMap,
  type ArenaState,
  type Attr,
  AUGMENTS,
  BOSS_SLAM_RADIUS,
  bossSpawnAt,
  CHAIN_MAX_RANGE,
  type ChainCandidate,
  characterName,
  characterScale,
  clampQuakeEpicenter,
  DEBUG_SPAWN_MAX,
  DEFAULT_DIMENSION,
  DEFAULT_PORT,
  DEFAULT_WEAPON,
  damageMultFromGrades,
  EMBERGUARD_HALF_ARC,
  EMBERGUARD_RANGE,
  ENEMY_KINDS,
  type EnemyKind,
  EXTRACT_RADIUS,
  effectiveMelee,
  FISTS_WEAPON,
  generateArena,
  getDimension,
  gunMuzzleReach,
  hasAugment,
  inMeleeArc,
  isPitAtPx,
  LEVELUP_WINDOW_SECONDS,
  PARRY_CHAIN_CD,
  PARRY_COOLDOWN,
  PARRY_IFRAMES,
  PICKUP_RADIUS,
  type PlayerState,
  QUAKE_REACH,
  ROOM_NAME,
  requirementPenalty,
  SALVAGE_HOLD_SECONDS,
  SCHEMA_VERSION,
  selectChainTargets,
  TOUGH_SCALE,
  VFX_RADIUS_DEFAULT,
  WEAPON_IDS,
  WEAPONS,
  type WeaponDef,
} from "@dd/shared";
import { Client, type Room } from "colyseus.js";
import Phaser from "phaser";
import { partTexture, SPRITE_ATLAS, SpriteRig } from "../entities/SpriteRig.js";
import { RENDER_DPR } from "../render-dpr.js";
import { CARD_ART_IDS } from "../sprites/card-manifest.js";
import { DECAL_IDS } from "../sprites/decal-manifest.js";
import { SPRITES } from "../sprites/manifest.js";
import { POI_IDS } from "../sprites/poi-manifest.js";
import { VfxPlayer } from "../vfx/VfxPlayer.js";
import { buildCard, type Card, drawIcon, WEAPON_ACCENT } from "./arena/card-art.js";
import { boltPoints, strokeBolt } from "./arena/draw-util.js";
import { buildArenaFloor, buildPois, drawArena, type PoiSprite } from "./arena/floor-renderer.js";
import {
  GUN_FX,
  makeBullet,
  makeCounter,
  makeMagma,
  makeSpit,
  makeThrownCleaver,
} from "./arena/projectile-factory.js";
import {
  spawnBulletImpact,
  spawnDamageNumber,
  spawnExplosion,
  spawnFallStreak,
  spawnMuzzleFlash,
  spawnPoof,
  spawnQuake,
  spawnSplat,
} from "./arena/vfx.js";

/** Which sprite manifest the player renders as (§23: melee class, one character for M0). */
const PLAYER_SPRITE = "drifter";

/** §17 stand-in sprite per archetype — used when a themed-dimension enemy's BESPOKE art hasn't been
 *  harvest-installed yet (its manifest id isn't in SPRITES). Keeps every new dimension playable on day one
 *  with an archetype-matched Wild-West rig (the same POC pattern as old-rust/ronin/gatlin → boothill); once
 *  the real sprite lands in the manifest, `resolveEnemySprite` picks it automatically. All targets are
 *  always-installed base sprites. */
const ENEMY_FALLBACK_SPRITE: Record<string, string> = {
  rusher: "critter",
  swarm: "mote-swarm",
  zoner: "pricklepulp",
  spitter: "boothill",
  duelist: "boothill",
  tough: "boothill",
  boss: "boothill",
  dummy: "pricklepulp",
};

/** Resolve the sprite manifest id to render for an enemy kind: the bespoke sprite if its art is installed,
 *  else the archetype stand-in (so an un-rendered themed enemy doesn't crash SpriteRig). */
function resolveEnemySprite(kind: EnemyKind | undefined, rawKind: string): string {
  const want = kind?.sprite ?? rawKind;
  if (SPRITES[want as keyof typeof SPRITES]) return want;
  return ENEMY_FALLBACK_SPRITE[kind?.archetype ?? "rusher"] ?? "critter";
}

/**
 * Player-core scene (build order §27.3 step 3, building on step 2's netcode).
 *
 * Connects to the Colyseus room, renders every Tier-1 player as a procedural limbless
 * character (§18), interpolates each toward its server-authoritative position, sends WASD
 * input, and aims the local player at the cursor (§9). Body collision is resolved
 * server-side (§5); the camera free-roams on the local player (§5 independent cameras).
 */
export class ArenaScene extends Phaser.Scene {
  private room?: Room<ArenaState>;
  private readonly blobs = new Map<string, SpriteRig>();
  private readonly enemies = new Map<string, SpriteRig>();
  /** Plays each weapon's authored VFX suite (§14 CODE-8) on its swing via the shared renderer. */
  private vfxPlayer!: VfxPlayer;
  /** §8 white-tell telegraph layer (Stage C) — redrawn each frame from enemies' synced `windup`. */
  private telegraphGfx!: Phaser.GameObjects.Graphics;
  /** H10 §20 parry-state ring under the LOCAL drifter — active i-frame flash + cooldown-recovery arc. */
  private parryGfx!: Phaser.GameObjects.Graphics;
  /** H10 `time.now` of the last parry press, so the ring can flash bright through the i-frame window. */
  private lastParryPress = -9999;
  /** §17 v0.102 placed landmark sprites — faded when the local player walks behind one (see-through cover). */
  private poiSprites: PoiSprite[] = [];
  /** §17 v0.102 off-screen extraction-portal locator (a 4800² arena needs a pointer, not just copy). */
  private portalArrow: Phaser.GameObjects.Container | null = null;
  /** §6 v0.103 the matching violet locator for the DEEPER rift. */
  private riftArrow: Phaser.GameObjects.Container | null = null;
  /** §8 last-seen `parriedSeq` per player, to fire the white parry flash on a successful parry. */
  private readonly lastParried = new Map<string, number>();
  /** §6 last-seen `revivedSeq` per player, to fire the green revive pop when a rez brings them back. */
  private readonly lastRevived = new Map<string, number>();
  /** §16 last-seen boss punch-slam telegraph progress, to fire the impact burst when it lands. */
  private lastBossSlamT = 0;
  private readonly prevPos = new Map<string, { x: number; y: number }>();
  private readonly enemyPrev = new Map<string, { x: number; y: number }>();
  private keys!: Record<
    "W" | "A" | "S" | "D" | "R" | "Q" | "E" | "T" | "B" | "C" | "TAB" | "SPACE",
    Phaser.Input.Keyboard.Key
  >;
  private lastSent = { dx: Number.NaN, dy: Number.NaN };
  private selfAim = { x: 1, y: 0 };
  /** Pointer position read straight off the DOM (robust aim — bypasses Phaser's input pipeline,
   *  which was dropping mouse movement that began while a key was held). */
  private readonly pointerScreen = { x: 0, y: 0, set: false };
  private pointerMoves = 0;
  private prevSelfHp = -1;
  private lastHurt = 0;
  private localAtkCd = 0;
  private localParryCd = 0;
  private frozenUntil = 0;
  /** H3 hit-stop throttle — kills crunch at most this often so a horde-clearing AoE can't lock the screen. */
  private lastKillStop = 0;
  private deltaSec = 0;
  private readonly enemyHp = new Map<string, number>();
  /** Last-seen duelist `atkSeq` per enemy — trigger a swing animation when it increments. */
  private readonly enemyAtk = new Map<string, number>();
  private readonly equipped = new Map<string, string>();
  /** §7 last-rendered character skin per player — recreate the rig when it changes (C-key swap). */
  private readonly charOf = new Map<string, string>();
  private readonly pickups = new Map<string, Phaser.GameObjects.Container>();
  /** Rendered enemy projectiles (§15 spit), dead-reckoned from server (x,y,vx,vy). */
  private readonly projectiles = new Map<string, Phaser.GameObjects.Container>();
  /** Rendered zoner puddles (§15 area denial). */
  private readonly zones = new Map<string, Phaser.GameObjects.Container>();
  /** §17 the procgen arena, regenerated client-side from the synced seeds (identical to the server's), +
   *  the baked floor graphics. Built once the seeds arrive. */
  private arenaMap?: ArenaMap;
  /** §6 chain (v0.103): the seed+dimension fingerprint the CURRENT floor was baked from — when the synced
   *  values diverge (rift descent / run restart re-mints the map), the floor is torn down and rebuilt. */
  private lastSeedKey = "";
  /** Every game object the floor bake created, so a rebuild can destroy the lot. */
  private floorObjs: Phaser.GameObjects.GameObject[] = [];
  /** §6 v0.103: until this clock, enemy-REMOVAL VFX are muted — a rift descent bulk-clears the old
   *  dimension's horde and the removals must read as "left behind", not a mass death celebration. */
  private removalFxMuteUntil = 0;
  /** §17 Codex tile textures (gen-tiles.mjs) that failed to load (absent on disk) — fall back to flat fill. */
  private readonly tilesMissing = new Set<string>();
  /** §17 last-seen `fellSeq` per player — fire the fall VFX (dust poof + a local red flash) when it ticks. */
  private readonly lastFell = new Map<string, number>();
  private weaponText!: Phaser.GameObjects.Text;
  private augmentText!: Phaser.GameObjects.Text;
  private modeText!: Phaser.GameObjects.Text;
  private hpBarBg!: Phaser.GameObjects.Rectangle;
  private hpBarFill!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;
  private xpBarBg!: Phaser.GameObjects.Rectangle;
  private xpBarFill!: Phaser.GameObjects.Rectangle;
  private levelText!: Phaser.GameObjects.Text;
  private prevLevel = -1;
  // §16 boss/extraction run loop.
  private bossBarBg!: Phaser.GameObjects.Rectangle;
  private bossBarFill!: Phaser.GameObjects.Rectangle;
  private bossText!: Phaser.GameObjects.Text;
  private victoryText!: Phaser.GameObjects.Text;
  private portal?: Phaser.GameObjects.Container;
  /** §6 chain (v0.103): the violet DEEPER rift — the other half of the extract-vs-push decision. */
  private rift?: Phaser.GameObjects.Container;
  private bannerShownFor = "";
  private prevBossPresent = false;
  /** §20/§28 4K-widescreen UI: last-applied HUD scale factor (-1 = not yet applied). The HUD is authored at
   *  a 1× baseline and `applyHudScale` grows every element on big viewports so it stays proportionate; we
   *  only re-apply when `uiScale()` actually changes (a resize), not every frame. */
  private hudScale = -1;
  // §12 level-up window (attribute allocation).
  private levelWinObjects: Phaser.GameObjects.GameObject[] = [];
  private levelWinKey = "";
  private levelWinTimerBar?: Phaser.GameObjects.Rectangle;
  private deathText!: Phaser.GameObjects.Text;
  private restartBtn!: Phaser.GameObjects.Text;
  // §21 Testing-Grounds Tab summon menu (dev): pick a monster kind + a multiplier to conjure it.
  private summonObjects: Phaser.GameObjects.GameObject[] = [];
  private summonOpen = false;
  private summonCount = 1; // the multiplier (× this many per spawn click)
  private summonTough = false;
  // §9/§13 drop & salvage (R): tap = drop the held weapon, HOLD = salvage it. `rHold` = seconds R has
  // been down; `rSalvaged` guards the one-shot salvage so a long hold doesn't fire it every frame.
  private rHold = 0;
  private rSalvaged = false;
  private dropBar?: Phaser.GameObjects.Graphics;
  private dropBarLabel?: Phaser.GameObjects.Text;
  // §9 card carousel — held card big with full stats. Each card holds its LIVE elements (one equation
  // line per §14 damage source, the requirement tokens, the charges/durability readout), recomputed
  // from the player's current attributes every frame so the numbers track levelling.
  private carousel: Card[] = [];
  private readonly debugEl = document.getElementById("debug");

  constructor() {
    super("arena");
  }

  /** §17 the dimension chosen at the menu (MenuScene → `scene.start("arena", { dimensionId })`). Passed to
   *  the room as a join option — only the room CREATOR's pick takes effect; joiners inherit the host's
   *  synced `dimensionId`. Defaults to Wild West when the arena is launched directly (no menu). */
  private selectedDimension: string = DEFAULT_DIMENSION;

  init(data?: { dimensionId?: string }): void {
    if (data?.dimensionId) this.selectedDimension = data.dimensionId;
  }

  /** Load the sprite art. §28: ONE packed multiatlas (tools/artkit/pack-atlas.mjs) holds every non-expansion
   *  part as the frame "<id>/<role>", so the WebGL batcher binds a single texture for a whole screen of rigs
   *  instead of one per part (the genre's standard horde-render fix). SpriteRig reads frames via `partTexture`. */
  preload(): void {
    this.load.multiatlas(SPRITE_ATLAS, "sprites/dd-sprites.json", "sprites");
    for (const manifest of Object.values(SPRITES)) {
      // §13 the +300 EXPANSION weapons (id `x2-…`) are held OUT of the atlas + gated: not boot-loaded (they'd
      // bloat VRAM). Only a CURATED one (expansion flag cleared) boot-loads its loose parts — SpriteRig then
      // falls back to the per-part texture since it isn't in the atlas. Everything non-expansion is in the atlas.
      if (!manifest.id.startsWith("x2-") || WEAPONS[manifest.id]?.expansion) continue;
      for (const part of manifest.parts) {
        this.load.image(`${manifest.id}:${part.role}`, `sprites/${manifest.id}/${part.file}`);
      }
    }
    // Weapon VFX hero skins (§14 Codex art, authored in the Weaponsmith). Game-res, pre-sized.
    this.load.image("vfx-quake-tombstone", "vfx/quake-tombstone.png");
    // Weapon card art (§14 two-pass / §28.5) for the §9 carousel — ONLY ids with bespoke art on disk
    // (CARD_ART_IDS, regenerated by gen-card-manifest). Others fall back to the sprite/icon card, so we
    // never queue 404s that flood the console and bury real errors. Expansion cards also load on-demand.
    for (const id of CARD_ART_IDS) {
      if (WEAPONS[id]?.expansion) continue;
      this.load.image(`card-${id}`, `cards/${id}.png`);
    }
    // Authored per-weapon VFX assets — painted hero skins + scatter sheets (§14 CODE-8).
    VfxPlayer.preloadAssets(this);
    // §17 Codex SEAMLESS terrain tiles (tools/artkit/gen-tiles.mjs). Optional — if a file is absent the
    // dev server returns index.html, which fails to decode; `loaderror` flags it so the floor falls back
    // to the flat fill instead of TileSpriting a broken stub.
    this.load.image("tile-ground", "tiles/ground.jpg");
    // §17 P4 Codex prop-packs (gen-decals.mjs): DECAL ground litter + POI landmark structures.
    for (const id of DECAL_IDS) this.load.image(id, `decals/${id}.png`);
    for (const id of POI_IDS) this.load.image(id, `pois/${id}.png`);
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      if (/^(tile|decal|poi)-/.test(file.key)) this.tilesMissing.add(file.key);
    });
  }

  /** §17 a Codex tile texture is usable only if it loaded AND isn't a missing-file stub. */
  private hasTile(key: string): boolean {
    if (this.tilesMissing.has(key) || !this.textures.exists(key)) return false;
    const w = this.textures.get(key).getSourceImage()?.width ?? 0;
    return w > 8;
  }

  create(): void {
    // The themed floor (bed/grid/rail + pits/rim) is drawn in `maybeBuildFloor` once the server's seeds +
    // `dimensionId` sync — so it uses the ACTIVE §17 dimension's palette, not a guessed default.
    this.poiSprites = []; // scene-restart safety: never keep handles to destroyed landmark sprites
    this.portalArrow = null;
    this.riftArrow = null;
    this.floorObjs = [];
    this.lastSeedKey = "";
    this.vfxPlayer = new VfxPlayer(this);
    // §8 white-tell layer (Stage C): one Graphics redrawn each frame with every telegraphing enemy's
    // shrinking white parry ring + glow. High depth so the cue reads over the bodies.
    this.telegraphGfx = this.add.graphics().setDepth(99990);
    // H10: the local player's parry-state ring. Just under the white-tell layer + above the bodies, so the
    // "ready vs recovering vs i-frames-up" read sits right on your own drifter.
    this.parryGfx = this.add.graphics().setDepth(99989);

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Keyboard input unavailable");
    this.keys = keyboard.addKeys("W,A,S,D,R,Q,E,T,B,C,TAB,SPACE") as Record<
      "W" | "A" | "S" | "D" | "R" | "Q" | "E" | "T" | "B" | "C" | "TAB" | "SPACE",
      Phaser.Input.Keyboard.Key
    >;
    // Tab would otherwise move browser focus off the canvas — capture it so the summon menu owns it.
    keyboard.addCapture("TAB");
    this.input.setDefaultCursor("crosshair");

    // Read the cursor straight from the DOM for aiming. Phaser's pointer pipeline was dropping
    // mouse movement that *started* while a movement key was held; raw window listeners don't.
    const onMove = (e: MouseEvent): void => {
      const rect = this.game.canvas.getBoundingClientRect();
      this.pointerScreen.x = e.clientX - rect.left;
      this.pointerScreen.y = e.clientY - rect.top;
      this.pointerScreen.set = true;
      this.pointerMoves++;
    };
    // Capture phase so we see the event before Phaser's own canvas handler can consume it.
    window.addEventListener("pointermove", onMove, { passive: true, capture: true });
    window.addEventListener("mousemove", onMove, { passive: true, capture: true });
    // RMB fires the weapon (§9) — suppress the browser context menu on the canvas.
    this.game.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    this.cameras.main.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    this.cameras.main.setBackgroundColor("#17140f"); // dark earth beyond the arena
    // §28 hi-DPI: the camera viewport == the DPR-scaled drawing buffer; zooming by RENDER_DPR keeps the
    // visible world area identical (worldView stays the CSS size) but renders it at device resolution.
    // origin (0,0) so screen-space UI maps 1:1 to CSS coords (no centre-pivot shift); UI uses screenW/H.
    this.cameras.main.setZoom(RENDER_DPR).setOrigin(0, 0);

    // Keep the camera viewport == the canvas buffer as it resizes, re-applying the hi-DPI zoom.
    this.scale.on("resize", (size: Phaser.Structs.Size) => {
      this.cameras.main.setSize(size.width, size.height);
      this.cameras.main.setZoom(RENDER_DPR).setOrigin(0, 0);
    });

    this.buildHud();
    this.buildCarousel();
    void this.connect();
  }

  /** Screen-space UI width/height in CSS px (§28 hi-DPI). The camera viewport is the DPR-scaled buffer,
   *  so UI anchored to the screen edges must use `viewport / RENDER_DPR` — i.e. the visible CSS size. */
  private screenW(): number {
    return this.cameras.main.width / RENDER_DPR;
  }
  private screenH(): number {
    return this.cameras.main.height / RENDER_DPR;
  }

  /** §28 4K-widescreen UI scale. The HUD is authored at a 1× baseline (≈1600px wide); on bigger viewports it
   *  grows so fixed-px bars/text don't read tiny on a 4K/ultrawide panel, clamped to [1, 2.1] so a laptop
   *  keeps the baseline and a 4K never balloons. Drives `applyHudScale` (sizes) + the per-frame HUD layout. */
  private uiScale(): number {
    return Math.max(1, Math.min(2.1, this.screenW() / 1600));
  }

  /** Grow every HUD element to the current `uiScale` — bar sizes + font sizes. Called only when the scale
   *  actually changes (a resize), so per-frame `updateHud` stays cheap. Fill widths are re-derived each
   *  frame from the ratio × scaled base, so setting them here is just the initial full-width state. */
  private applyHudScale(s: number): void {
    this.hpBarBg.setSize(240 * s, 18 * s);
    this.hpBarFill.setSize(236 * s, 12 * s);
    this.xpBarBg.setSize(240 * s, 8 * s);
    this.xpBarFill.setSize(236 * s, 4 * s);
    this.bossBarBg.setSize(520 * s, 16 * s);
    this.bossBarFill.setSize(516 * s, 12 * s);
    this.hpText.setFontSize(12 * s);
    this.levelText.setFontSize(13 * s);
    this.weaponText.setFontSize(13 * s);
    this.augmentText.setFontSize(12 * s);
    this.modeText.setFontSize(15 * s);
    this.bossText.setFontSize(14 * s);
    this.restartBtn.setFontSize(14 * s);
    this.deathText.setFontSize(26 * s);
    this.victoryText.setFontSize(28 * s);
  }

  /** Screen-space HUD: HP bar + downed overlay (§20). Fixed to the camera (scrollFactor 0). */
  private buildHud(): void {
    this.hpBarBg = this.add
      .rectangle(0, 0, 240, 18, 0x22252b, 0.85)
      .setScrollFactor(0)
      .setOrigin(0, 0.5)
      .setStrokeStyle(2, 0x000000)
      .setDepth(100000);
    this.hpBarFill = this.add
      .rectangle(0, 0, 236, 12, 0x9cff3b)
      .setScrollFactor(0)
      .setOrigin(0, 0.5)
      .setDepth(100001);
    this.hpText = this.add
      .text(0, 0, "", { fontSize: "12px", color: "#E8E4D8", fontStyle: "bold" })
      .setScrollFactor(0)
      .setOrigin(0, 0.5)
      .setDepth(100002);

    // XP bar (thin, sits above the HP bar) + level badge (§12).
    this.xpBarBg = this.add
      .rectangle(0, 0, 240, 8, 0x1c2230, 0.85)
      .setScrollFactor(0)
      .setOrigin(0, 0.5)
      .setStrokeStyle(2, 0x000000)
      .setDepth(100000);
    this.xpBarFill = this.add
      .rectangle(0, 0, 236, 4, 0x6fd6ff)
      .setScrollFactor(0)
      .setOrigin(0, 0.5)
      .setDepth(100001);
    this.levelText = this.add
      .text(0, 0, "", { fontSize: "13px", color: "#ffd479", fontStyle: "bold" })
      .setScrollFactor(0)
      .setOrigin(0, 1)
      .setDepth(100002);
    this.deathText = this.add
      .text(0, 0, "DOWNED — respawning…\n(click Restart Run, top-right)", {
        fontSize: "26px",
        color: "#FF5D5D",
        fontStyle: "bold",
        align: "center",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100002)
      .setVisible(false);

    // Playtest control: restart the run. Top-right corner (R is now drop/salvage, §9/§13).
    this.restartBtn = this.add
      .text(0, 0, "⟳ Restart Run", {
        fontSize: "14px",
        color: "#E8E4D8",
        backgroundColor: "#3a4049",
        padding: { x: 9, y: 6 },
      })
      .setScrollFactor(0)
      .setOrigin(1, 0)
      .setDepth(100002)
      .setInteractive({ useHandCursor: true });
    this.restartBtn.on("pointerdown", () => this.room?.send("restart"));

    // §9/§13 drop/salvage hold bar — fills while R is held; release before full = drop, full = salvage.
    this.dropBar = this.add.graphics().setScrollFactor(0).setDepth(100003).setVisible(false);
    this.dropBarLabel = this.add
      .text(0, 0, "", { fontSize: "12px", color: "#ffe7a8", fontStyle: "bold", align: "center" })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100003)
      .setVisible(false);

    // Equipped-weapon readout (sits just above the HP bar).
    this.weaponText = this.add
      .text(0, 0, "", { fontSize: "13px", color: "#9cff3b", fontStyle: "bold" })
      .setScrollFactor(0)
      .setOrigin(0, 1)
      .setDepth(100002);

    // §8 owned parry-augment readout (sits just above the weapon readout).
    this.augmentText = this.add
      .text(0, 0, "", { fontSize: "12px", color: "#b07bd6", fontStyle: "bold" })
      .setScrollFactor(0)
      .setOrigin(0, 1)
      .setDepth(100002);

    // Mode banner (top-center) — shows the Testing Grounds hint, and "T" toggle either way.
    this.modeText = this.add
      .text(0, 0, "", { fontSize: "15px", color: "#33e6ff", fontStyle: "bold", align: "center" })
      .setScrollFactor(0)
      .setOrigin(0.5, 0)
      .setDepth(100002);

    // Boss health bar (§16) — a wide bar under a name plate at the top, shown only during the fight.
    this.bossBarBg = this.add
      .rectangle(0, 0, 520, 16, 0x2a1414, 0.9)
      .setScrollFactor(0)
      .setOrigin(0.5, 0)
      .setStrokeStyle(2, 0x000000)
      .setDepth(100001)
      .setVisible(false);
    this.bossBarFill = this.add
      .rectangle(0, 0, 516, 12, 0xff5d3b)
      .setScrollFactor(0)
      .setOrigin(0, 0.5)
      .setDepth(100002)
      .setVisible(false);
    this.bossText = this.add
      .text(0, 0, "OLD RUST", { fontSize: "14px", color: "#ffb23b", fontStyle: "bold" })
      .setScrollFactor(0)
      .setOrigin(0.5, 1)
      .setDepth(100002)
      .setVisible(false);

    // Victory banner (§16) — shown once a player extracts. §6 v0.103: the LIVE text (depth reached +
    // total banked) is set in updateRunState; this is just the placeholder styling.
    this.victoryText = this.add
      .text(0, 0, "", {
        fontSize: "28px",
        color: "#ffd479",
        fontStyle: "bold",
        align: "center",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100003)
      .setVisible(false);
  }

  /** Render weapon pickups — a FANCY faux-3D display: the weapon spins on its vertical axis (scaleX
   *  through 0 = a 3D-ish turn), floats with a rarity-tinted glow + light beam + ground halo, and throws
   *  a bright SHINE glint each time it rotates to face the player. (True polygonal 3D would need a
   *  separate renderer + clash with the flat art; this reads as the fancy-shiny pickup Mike wants.) */
  private syncPickups(): void {
    if (!this.room) return;
    const TAU = Math.PI * 2;
    const ADD = Phaser.BlendModes.ADD;
    const state = this.room.state.pickups;
    state.forEach((pk, id) => {
      if (this.pickups.has(id)) return;
      const manifest = SPRITES[pk.weapon as keyof typeof SPRITES];
      const part = manifest?.parts[0];
      const def = WEAPONS[pk.weapon];
      const accent = WEAPON_ACCENT[pk.weapon] ?? 0xffd479;
      const accentHex = `#${accent.toString(16).padStart(6, "0")}`;
      const baseScale = part ? 72 / part.w : 1;

      const beam = this.add.rectangle(0, -10, 34, 104, accent, 0.08).setBlendMode(ADD); // pedestal light
      const halo = this.add.ellipse(0, 30, 100, 34, accent, 0.22).setBlendMode(ADD); // ground glow
      const glow = this.add.ellipse(0, 0, 78, 78, accent, 0.32).setBlendMode(ADD);
      const tx = part ? partTexture(this, pk.weapon, part.role) : null;
      const img =
        part && tx
          ? this.add.image(0, 0, tx.key, tx.frame).setScale(baseScale)
          : this.add.rectangle(0, 0, 50, 12, accent);
      const shine =
        part && tx
          ? this.add
              .image(0, 0, tx.key, tx.frame)
              .setScale(baseScale)
              .setTint(0xffffff)
              .setTintMode(Phaser.TintModes.FILL)
              .setBlendMode(ADD)
              .setAlpha(0)
          : null;
      const label = this.add
        .text(0, 42, def?.name ?? pk.weapon, {
          fontSize: "11px",
          color: accentHex,
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      const spinner = this.add.container(0, 0, shine ? [glow, img, shine] : [glow, img]);
      const container = this.add.container(pk.x, pk.y, [beam, halo, spinner, label]).setDepth(2);

      this.tweens.add({
        targets: spinner,
        y: -14,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
      this.tweens.add({
        targets: halo,
        scaleX: 1.14,
        scaleY: 1.14,
        alpha: 0.34,
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
      this.tweens.addCounter({
        from: 0,
        to: TAU,
        duration: 1700,
        repeat: -1,
        onUpdate: (tw) => {
          const c = Math.cos(tw.getValue() ?? 0);
          img.scaleX = baseScale * c; // faux-3D Y-axis spin (squashes through edge-on)
          glow.setScale(0.85 + 0.2 * Math.abs(c), 1);
          if (shine) {
            shine.scaleX = baseScale * c;
            shine.setAlpha(Math.max(0, c) ** 5 * 0.75); // bright glint as it turns to face you
          }
        },
      });
      this.pickups.set(id, container);
    });
    for (const id of [...this.pickups.keys()]) {
      if (!state.has(id)) {
        this.pickups.get(id)?.destroy();
        this.pickups.delete(id);
      }
    }
  }

  /** Make each player rig hold the weapon its authoritative state says it has (re-equip on change). */
  private equipWeapons(): void {
    if (!this.room) return;
    this.room.state.players.forEach((player, id) => {
      const rig = this.blobs.get(id);
      if (!rig) return;
      if (this.equipped.get(id) === player.weapon) return;
      const def = WEAPONS[player.weapon];
      // §6 a weapon may borrow another's sprite as placeholder art (e.g. the Gravedigger's Spade) via `sprite`.
      const spriteId = def?.sprite ?? player.weapon;
      const manifest = SPRITES[spriteId as keyof typeof SPRITES];
      if (def && manifest) {
        rig.equipWeapon(spriteId, def, manifest);
        this.equipped.set(id, player.weapon);
      } else if (def) {
        rig.unequip(def); // §9 fists / any weapon with no held sprite → empty hands
        this.equipped.set(id, player.weapon);
      }
    });
  }

  /** §17 once the server's seeds arrive, regenerate the IDENTICAL map client-side + bake the floor. §6
   *  chain (v0.103): the seeds/dimension CHANGE mid-run on a rift descent (and on run restart) — tear the
   *  old floor down and rebuild for the new dimension, with a violet flash to sell the transition. */
  private maybeBuildFloor(): void {
    if (!this.room) return;
    const s = this.room.state;
    if (!s.seedTerrain) return; // seeds not synced yet (0 = "no map")
    const seedKey = `${s.seedTerrain}:${s.seedHazard}:${s.seedTheme}:${s.seedDecor}:${s.dimensionId}`;
    if (seedKey === this.lastSeedKey) return; // current floor is the right one
    const descending = this.lastSeedKey !== ""; // not the first build → a rift descent / restart
    for (const o of this.floorObjs) o.destroy();
    this.floorObjs = [];
    this.poiSprites = [];
    this.arenaMap = generateArena({
      seedTerrain: s.seedTerrain,
      seedHazard: s.seedHazard,
      seedTheme: s.seedTheme,
      seedDecor: s.seedDecor,
    });
    // §17 the active dimension's floor palette (re-skin of "Dust & The Drop"); unknown id → Wild West.
    const palette = getDimension(s.dimensionId).palette;
    this.floorObjs.push(...drawArena(this, (k) => this.hasTile(k), palette));
    this.floorObjs.push(...buildArenaFloor(this, this.arenaMap, palette));
    const pois = buildPois(this, this.arenaMap);
    this.poiSprites = pois.sprites;
    this.floorObjs.push(...pois.objs);
    this.lastSeedKey = seedKey;
    if (descending) {
      this.cameras.main.flash(500, 96, 48, 160); // violet wash sells any mid-session terrain swap
      // Mute the enemy-REMOVAL VFX briefly: the server just bulk-cleared the old dimension's horde, and
      // without this every cleared enemy death-pops at old-map coordinates on the new floor (corpse storm).
      this.removalFxMuteUntil = this.time.now + 900;
      // The descent banner is only true copy for an actual rift descent (depth ≥ 2) — a run RESTART also
      // re-mints the map (fresh terrain each run) but starts back at depth 1.
      if (s.depth > 1) {
        this.flashBanner(
          `⇓  DEPTH ${s.depth} — ${getDimension(s.dimensionId).name.toUpperCase()}  ⇓`,
          "#b478ff",
        );
      }
    }
  }

  /** §17 fire the fall VFX when a player's synced `fellSeq` ticks: a dust poof at the landing tile, plus a
   *  brief red flash + shake for the LOCAL player so the chip-damage fall has weight. */
  private checkFalls(): void {
    const st = this.room?.state;
    if (!st) return;
    const selfId = this.room?.sessionId;
    st.players.forEach((player, id) => {
      const prev = this.lastFell.get(id);
      this.lastFell.set(id, player.fellSeq);
      if (prev === undefined || prev === player.fellSeq) return;
      spawnFallStreak(this, player.x, player.y);
      if (id === selfId) {
        this.cameras.main.flash(170, 90, 16, 16);
        this.cameras.main.shake(150, 0.006);
      }
    });
  }

  private async connect(): Promise<void> {
    const status = document.getElementById("status");
    const client = new Client(`ws://${location.hostname}:${DEFAULT_PORT}`);

    // Retry with backoff: on a cold `pnpm dev`, the Vite client is ready seconds before
    // the Colyseus server finishes starting. Without retry, the first load throws and
    // shows no player until a manual refresh. This self-heals as soon as the server is up.
    const maxAttempts = 30;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // §17 pass the menu's dimension pick as a join option (the room creator scopes the run to it; a
        // joiner inherits the host's synced dimension — `getDimension` server-side rejects an unknown id).
        this.room = await client.joinOrCreate<ArenaState>(ROOM_NAME, {
          dimensionId: this.selectedDimension,
        });
        // §4 schema handshake (audit): if the server's schema version ≠ ours, our compiled state schema is
        // stale → Colyseus would decode patches with corrupted field offsets. Detect on the first state and
        // tell the player to hard-reload instead of silently rendering garbage.
        this.room.onStateChange.once((state) => {
          const sv = state.schemaVersion;
          if (sv && sv !== SCHEMA_VERSION) {
            const msg = `⚠ version mismatch (server schema ${sv} ≠ client ${SCHEMA_VERSION}) — hard-reload this page (Ctrl+Shift+R)`;
            if (status) status.textContent = msg;
            console.error(`[client] ${msg}`);
          }
        });
        if (status) status.textContent = `connected · you are ${this.room.sessionId.slice(0, 4)}`;
        return;
      } catch (err) {
        console.warn(`[client] join attempt ${attempt}/${maxAttempts} failed, retrying…`, err);
        if (status) status.textContent = `connecting… (waiting for server, attempt ${attempt})`;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (status) status.textContent = "connection failed — is the server running? (pnpm dev:server)";
  }

  private addBlob(player: PlayerState, id: string): void {
    const isSelf = id === this.room?.sessionId;
    const charId =
      player.character && SPRITES[player.character as keyof typeof SPRITES]
        ? player.character
        : PLAYER_SPRITE;
    const rig = new SpriteRig(this, player.x, player.y, isSelf, id, charId);
    rig.setRigScale(characterScale(charId)); // §7 bump small-footprint skins so none read as tiny
    this.blobs.set(id, rig);
    this.charOf.set(id, player.character);
    this.prevPos.set(id, { x: player.x, y: player.y });
    if (isSelf) this.centerCam(player.x, player.y);
  }

  private removeBlob(id: string): void {
    this.blobs.get(id)?.destroy();
    this.blobs.delete(id);
    this.prevPos.delete(id);
    this.equipped.delete(id);
    this.charOf.delete(id);
  }

  override update(_time: number, deltaMs: number): void {
    if (!this.room) return;

    this.deltaSec = deltaMs / 1000;
    // §9/§13 R — context-sensitive: if a dropped weapon is within reach, TAP = GRAB it (equip). Otherwise,
    // with a weapon held, TAP = drop it on the floor and HOLD = salvage it into the bag. Spacebar = jump.
    // (Restart the run is now the on-screen button, top-right.)
    const selfP = this.room.state.players.get(this.room.sessionId);
    const alive = !!selfP && selfP.alive;
    const holdingWeapon = !!selfP && selfP.weapon !== FISTS_WEAPON;
    // Is a grabbable pickup within arm's reach? (Then R means "grab", not "drop/salvage".)
    let nearPickup = false;
    if (selfP && alive) {
      const r2 = PICKUP_RADIUS * PICKUP_RADIUS;
      this.room.state.pickups.forEach((pk) => {
        const dx = pk.x - selfP.x;
        const dy = pk.y - selfP.y;
        if (dx * dx + dy * dy <= r2) nearPickup = true;
      });
    }
    const canSalvage = alive && holdingWeapon && !nearPickup; // hold-to-salvage only when not grabbing
    if (this.keys.R.isDown && canSalvage) {
      this.rHold += this.deltaSec;
      if (this.rHold >= SALVAGE_HOLD_SECONDS && !this.rSalvaged) {
        this.room.send("salvageWeapon");
        this.rSalvaged = true;
      }
    }
    if (Phaser.Input.Keyboard.JustUp(this.keys.R)) {
      if (alive && nearPickup) {
        this.room.send("grabWeapon"); // standing on a dropped weapon: pick it up
      } else if (
        !this.rSalvaged &&
        this.rHold > 0.02 &&
        this.rHold < SALVAGE_HOLD_SECONDS &&
        holdingWeapon
      ) {
        this.room.send("dropWeapon"); // a quick tap = drop
      }
      this.rHold = 0;
      this.rSalvaged = false;
    }
    this.updateDropBar(canSalvage);
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE) && alive) this.room.send("jump"); // §5 traversal hop
    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) this.room?.send("cycleWeapon", { dir: 1 });
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.room?.send("cycleWeapon", { dir: -1 });
    if (Phaser.Input.Keyboard.JustDown(this.keys.T)) this.room?.send("toggleTraining");
    if (Phaser.Input.Keyboard.JustDown(this.keys.B)) this.room?.send("spawnBoss");
    // §21 Tab toggles the dev summon menu — Testing Grounds only (the server rejects it elsewhere anyway).
    if (Phaser.Input.Keyboard.JustDown(this.keys.TAB)) {
      const training = this.room?.state.mode === "training";
      if (training && !this.summonOpen) this.openSummonMenu();
      else this.closeSummonMenu();
    }
    if (this.summonOpen && this.room?.state.mode !== "training") this.closeSummonMenu();
    if (Phaser.Input.Keyboard.JustDown(this.keys.C)) this.room?.send("cycleCharacter"); // §7 swap skin

    this.maybeBuildFloor(); // §17 bake the procgen floor once the seeds arrive
    this.sendInput();
    this.syncBlobs();
    this.checkFalls(); // §17 fall VFX (after blobs so the landing poof lands right)
    this.equipWeapons();
    this.syncEnemies();
    this.syncPickups();
    this.syncProjectiles();
    this.syncZones();
    this.syncPortal();
    // Hit-stop (§20): briefly freeze the visuals on impactful events for weight. Input/sync keep
    // running so it doesn't feel laggy; positions/poses catch up when the freeze lifts.
    if (this.time.now >= this.frozenUntil) {
      this.interpolate(deltaMs);
      this.interpolateEnemies(deltaMs);
      this.moveProjectiles(this.deltaSec);
      this.animateBlobs();
      this.animateEnemies();
      this.renderProjectileTells(); // M2: parry tell on incoming hostile shots (drawn on the white-tell layer)
    }
    this.followSelf();
    this.sendAttack();
    this.sendParry();
    this.renderParryState();
    this.updatePoiOcclusion(); // §17 v0.102 fade a landmark the local player is hidden behind
    this.updatePortalArrow(); // §17 v0.102 edge-of-screen pointer to an off-screen open portal
    this.updateCombatFx();
    this.updateHud();
    this.updateRunState();
    this.updateLevelWindow();
    this.updateCarousel();
    this.updateDebug();
  }

  /** Reconcile rendered enemies against authoritative state (same race-proof pattern as blobs). */
  private syncEnemies(): void {
    if (!this.room) return;
    const enemies = this.room.state.enemies;
    enemies.forEach((enemy, id) => {
      if (!this.enemies.has(id)) {
        const kind = ENEMY_KINDS[enemy.kind];
        const rig = new SpriteRig(
          this,
          enemy.x,
          enemy.y,
          false,
          id,
          resolveEnemySprite(kind, enemy.kind),
        );
        // Bosses use their own scale; tough kin scale up + glow (§15/§28.6 bigger not detailed).
        if (kind?.renderScale) rig.setRigScale(kind.renderScale);
        else if (enemy.tough) rig.setRigScale(TOUGH_SCALE);
        if (enemy.tough) rig.addGlow(0xff5d3b);
        // §15 duelist (ronin): visibly WIELD its sword (held-sprite on the enemy rig).
        if (kind?.wieldsWeapon) {
          const wdef = WEAPONS[kind.wieldsWeapon];
          const wman = SPRITES[kind.wieldsWeapon as keyof typeof SPRITES];
          if (wdef && wman) rig.equipWeapon(kind.wieldsWeapon, wdef, wman);
        }
        this.enemies.set(id, rig);
        this.enemyPrev.set(id, { x: enemy.x, y: enemy.y });
        this.enemyAtk.set(id, enemy.atkSeq);
      }
      // Trigger a swing animation each time the server bumps the duelist's atkSeq (combo hit).
      if (enemy.atkSeq !== this.enemyAtk.get(id)) {
        this.enemyAtk.set(id, enemy.atkSeq);
        this.enemies.get(id)?.triggerSwing(this.time.now);
      }
    });
    for (const id of [...this.enemies.keys()]) {
      if (!enemies.has(id)) {
        // Enemy gone from authoritative state → it died (or left view). Detach it from the animated set
        // FIRST, then either fall into the void (§17 pit) or get the §20 DEATH-POP (launch + tumble).
        const rig = this.enemies.get(id);
        this.enemies.delete(id);
        this.enemyPrev.delete(id);
        this.enemyHp.delete(id);
        this.enemyAtk.delete(id);
        if (rig) {
          // §6 v0.103: a rift descent bulk-clears the horde — those removals are "left behind", not
          // kills. During the mute window they vanish silently (no pop/poof/hit-stop celebration).
          if (this.time.now < this.removalFxMuteUntil) {
            rig.destroy();
            continue;
          }
          if (this.arenaMap && isPitAtPx(this.arenaMap, rig.x, rig.y)) {
            spawnFallStreak(this, rig.x, rig.y); // fell over a pit → sinks into the void, no pop
            rig.destroy();
          } else {
            spawnPoof(this, rig.x, rig.y); // dust at the kill point
            // §20 death-pop: fling the corpse AWAY from the nearest living player (≈ the killer) + up.
            let ax = Math.random() - 0.5;
            let ay = Math.random() - 0.5;
            let best = Number.POSITIVE_INFINITY;
            this.room?.state.players.forEach((p) => {
              if (!p.alive) return;
              const d = Math.hypot(rig.x - p.x, rig.y - p.y);
              if (d < best) {
                best = d;
                ax = rig.x - p.x;
                ay = rig.y - p.y;
              }
            });
            const al = Math.hypot(ax, ay) || 1;
            const dist = 70 + Math.random() * 60;
            rig.deathPop((ax / al) * dist, (ay / al) * dist);
            // H3 §20 hit-stop: a brief crunch when a kill lands near YOU (≈ your kill). Throttled so a
            // horde-clearing AoE can't chain freezes into lag; parry/quake stops override via Math.max.
            const selfId = this.room?.sessionId;
            const me = selfId ? this.room?.state.players.get(selfId) : undefined;
            if (
              me?.alive &&
              Math.hypot(rig.x - me.x, rig.y - me.y) < 420 &&
              this.time.now - this.lastKillStop >= 110
            ) {
              this.lastKillStop = this.time.now;
              this.hitStop(45);
            }
          }
        }
      }
    }
  }

  private interpolateEnemies(deltaMs: number): void {
    if (!this.room) return;
    const t = 1 - 0.0015 ** (deltaMs / 1000);
    this.room.state.enemies.forEach((enemy, id) => {
      const rig = this.enemies.get(id);
      if (!rig) return;
      rig.setPosition(Phaser.Math.Linear(rig.x, enemy.x, t), Phaser.Math.Linear(rig.y, enemy.y, t));
    });
  }

  /** Drive each enemy's procedural animation from its render-velocity (faces its travel dir). */
  private animateEnemies(): void {
    this.telegraphGfx.clear(); // §8 redraw the white-tell layer fresh each frame
    for (const [id, rig] of this.enemies) {
      const prev = this.enemyPrev.get(id) ?? { x: rig.x, y: rig.y };
      let mx = rig.x - prev.x;
      let my = rig.y - prev.y;
      const ml = Math.hypot(mx, my);
      if (ml > 0.001) {
        mx /= ml;
        my /= ml;
      } else {
        mx = 0;
        my = 0;
      }
      this.enemyPrev.set(id, { x: rig.x, y: rig.y });
      rig.animate(this.time.now, {
        moveX: mx,
        moveY: my,
        aimX: 0,
        aimY: 0,
        aimDir: 0,
        isSelf: false,
      });
      const es = this.room?.state.enemies.get(id);
      // §8 Brand tint — and §16 OLD RUST glows the same heat-orange at P3 ENRAGE (overheating).
      const enraged = es?.kind === "old-rust" && (this.room?.state.bossPhase ?? 0) >= 3;
      rig.setBranded((es?.branded ?? 0) > 0 || enraged);
      // §8 white-tell (Stage C): a glowing-white disc + a rhythm ring that SHRINKS to the body as the
      // windup peaks — the §8 "white = parryable" cue. Parry as the ring tightens to negate the swing.
      const w = es?.windup ?? 0;
      if (w > 0.01) {
        const g = this.telegraphGfx;
        // §20 "white gradient leading flash": a directional cone toward the targeted player showing EXACTLY
        // where the strike lands (the enemy's real melee range/arc) — WYSIWYG danger, brightening as it peaks.
        // M1: read effectiveMelee (not raw .melee) so the DERIVED lunges (rusher/swarm/zoner) draw the same
        // cone as the Ronin's explicit combo — every telegraphing enemy now shows where its jump lands.
        const mel = effectiveMelee(ENEMY_KINDS[es?.kind ?? ""]);
        if (mel) {
          let nx = 1;
          let ny = 0;
          let bestD = Number.POSITIVE_INFINITY;
          this.room?.state.players.forEach((p) => {
            if (!p.alive) return;
            const d = (p.x - rig.x) ** 2 + (p.y - rig.y) ** 2;
            if (d < bestD) {
              bestD = d;
              nx = p.x - rig.x;
              ny = p.y - rig.y;
            }
          });
          const ang = Math.atan2(ny, nx);
          g.fillStyle(0xffffff, 0.06 + 0.22 * w);
          g.beginPath();
          g.moveTo(rig.x, rig.y);
          g.arc(rig.x, rig.y, mel.range, ang - mel.halfArc, ang + mel.halfArc);
          g.closePath();
          g.fillPath();
        }
        g.fillStyle(0xffffff, w * 0.4);
        g.fillCircle(rig.x, rig.y, 24);
        g.lineStyle(2.5 + 2 * w, 0xffffff, 0.55 + 0.45 * w);
        g.strokeCircle(rig.x, rig.y, 52 - 30 * w);
      }
      rig.setDepth(rig.y);
    }
    this.renderBossSlam();
  }

  /** §16 P2 punch-slam: draw the RED warning ring at the synced epicentre (the danger fills to the hit
   *  radius as the telegraph peaks), and burst + shake when it lands (bossSlamT drops high → 0). */
  private renderBossSlam(): void {
    const st = this.room?.state;
    if (!st) return;
    const t = st.bossSlamT;
    if (t > 0.001) {
      const g = this.telegraphGfx;
      g.fillStyle(0xff3b2f, 0.1 + 0.24 * t);
      g.fillCircle(st.bossSlamX, st.bossSlamY, BOSS_SLAM_RADIUS * t); // danger grows to the edge at impact
      g.lineStyle(3, 0xff5d3b, 0.5 + 0.5 * t);
      g.strokeCircle(st.bossSlamX, st.bossSlamY, BOSS_SLAM_RADIUS);
    }
    // A high telegraph snapping to 0 = the slam fired this frame → impact ring + a hard shake.
    if (this.lastBossSlamT > 0.6 && t < 0.001) {
      spawnExplosion(this, st.bossSlamX, st.bossSlamY, BOSS_SLAM_RADIUS);
      this.cameras.main.shake(200, 0.014);
    }
    this.lastBossSlamT = t;
  }

  /** Reconcile rendered projectiles vs authoritative state; splat on removal (hit/expire). */
  private syncProjectiles(): void {
    if (!this.room) return;
    const state = this.room.state.projectiles;
    const flashedShooters = new Set<string>(); // one muzzle flash per shooter per frame (= per shot)
    state.forEach((pr, id) => {
      if (this.projectiles.has(id)) return;
      const fx = GUN_FX[pr.kind];
      const container = fx
        ? makeBullet(this, pr)
        : pr.kind === "cleaver"
          ? makeThrownCleaver(this, pr)
          : pr.kind === "magma"
            ? makeMagma(this, pr)
            : pr.kind === "counter"
              ? makeCounter(this, pr) // §8 Counterblade parry projectile
              : makeSpit(this, pr);
      container.setData("kind", pr.kind);
      container.setData("explodeR", pr.explodeR); // §14 WYSIWYG: render the blast at the real radius
      if (fx) container.setData("ang", Math.atan2(pr.vy, pr.vx)); // flight angle for the oriented impact
      this.projectiles.set(id, container);
      // Muzzle flash a freshly-fired gun bullet at the SHOOTER's barrel (nearest player), one per shot.
      if (fx && this.room) {
        let shooter: string | null = null;
        let best = 140;
        this.room.state.players.forEach((p, pid) => {
          const d = Math.hypot(p.x - pr.x, p.y - pr.y);
          if (d < best) {
            best = d;
            shooter = pid;
          }
        });
        if (shooter && !flashedShooters.has(shooter)) {
          flashedShooters.add(shooter);
          const p = this.room.state.players.get(shooter);
          if (p) {
            const ang = Math.atan2(pr.vy, pr.vx);
            // Flash at the shooter's BARREL TIP (per-gun reach × the holder's rig scale), matching where the
            // server spawned the shot (both call the same shared reach with the same character scale).
            const reach = gunMuzzleReach(
              WEAPONS[p.weapon] ?? WEAPONS[DEFAULT_WEAPON],
              characterScale(p.character),
            );
            spawnMuzzleFlash(
              this,
              p.x + Math.cos(ang) * reach,
              p.y + Math.sin(ang) * reach,
              ang,
              fx.size,
              fx.color,
              fx.style,
            );
          }
        }
      }
    });
    for (const id of [...this.projectiles.keys()]) {
      if (!state.has(id)) {
        const c = this.projectiles.get(id);
        if (c) {
          const k = c.getData("kind") as string;
          const er = (c.getData("explodeR") as number) ?? 0;
          if (k === "magma" && er > 0) spawnExplosion(this, c.x, c.y, er);
          else if (GUN_FX[k])
            spawnBulletImpact(this, c.x, c.y, k, (c.getData("ang") as number) ?? 0);
          else spawnSplat(this, c.x, c.y, k);
        }
        c?.destroy();
        this.projectiles.delete(id);
      }
    }
  }

  /** Dead-reckon each projectile along its velocity, gently corrected toward the server position
   *  (straight-line bullets look crisper extrapolated than lerped between 20Hz snapshots). */
  private moveProjectiles(dtSec: number): void {
    if (!this.room) return;
    this.room.state.projectiles.forEach((pr, id) => {
      const c = this.projectiles.get(id);
      if (!c) return;
      const px = c.x + pr.vx * dtSec;
      const py = c.y + pr.vy * dtSec;
      c.setPosition(Phaser.Math.Linear(px, pr.x, 0.18), Phaser.Math.Linear(py, pr.y, 0.18));
      if (pr.kind === "cleaver") c.rotation += dtSec * 22; // spin the blade
    });
  }

  /** Reconcile rendered zoner puddles (§15 area denial) — a corrosive acid pool on the ground. */
  private syncZones(): void {
    if (!this.room) return;
    const state = this.room.state.zones;
    state.forEach((zone, id) => {
      if (this.zones.has(id)) return;
      const rx = zone.radius;
      const ry = zone.radius * 0.62; // top-down squish
      // §8/§15: UNPARRYABLE zones speak RED/ORANGE danger (never white/neon-friendly). Reads as a
      // poison pool against the dust (§28.7).
      const fill = this.add.ellipse(0, 0, rx * 2, ry * 2, 0x8f2d18, 0.44);
      const inner = this.add.ellipse(0, 0, rx * 1.25, ry * 1.25, 0xff5d2e, 0.32);
      const rim = this.add.ellipse(0, 0, rx * 2, ry * 2).setStrokeStyle(4, 0xff7a3a, 0.95);
      const c = this.add.container(zone.x, zone.y, [fill, inner, rim]).setDepth(1);
      // Fade in, then bubble; the server owns the actual lifetime/expiry.
      c.setAlpha(0);
      this.tweens.add({ targets: c, alpha: 1, duration: 220 });
      this.tweens.add({
        targets: inner,
        scale: 1.25,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
      this.zones.set(id, c);
    });
    for (const id of [...this.zones.keys()]) {
      if (!state.has(id)) {
        this.zones.get(id)?.destroy();
        this.zones.delete(id);
      }
    }
  }

  /** Build one pulsing gate marker (shared by the extraction portal + the §6 deeper rift). */
  private buildGate(
    x: number,
    y: number,
    ring: number,
    core: number,
    text: string,
    textColor: string,
  ): Phaser.GameObjects.Container {
    const outer = this.add.circle(0, 0, EXTRACT_RADIUS, ring, 0.16).setStrokeStyle(3, ring, 0.7);
    const inner = this.add
      .circle(0, 0, EXTRACT_RADIUS * 0.5, core, 0.22)
      .setStrokeStyle(2, core, 0.9);
    const label = this.add
      .text(0, -EXTRACT_RADIUS - 16, text, {
        fontSize: "16px",
        color: textColor,
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const c = this.add.container(x, y, [outer, inner, label]).setDepth(1);
    this.tweens.add({
      targets: inner,
      scale: 1.35,
      duration: 760,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
    return c;
  }

  /** Show/hide BOTH gates of the §6 greed decision at their authoritative positions: the amber EXTRACT
   *  portal (bank & end) and the violet DEEPER rift (v0.103 — descend to the next dimension, harder). */
  private syncPortal(): void {
    if (!this.room) return;
    const st = this.room.state;
    if (st.portalOpen && !this.portal) {
      this.portal = this.buildGate(
        st.portalX,
        st.portalY,
        0x6fd6ff,
        0xffd479,
        "▼ EXTRACT — bank salvage & end run",
        "#ffd479",
      );
    }
    if (!st.portalOpen && this.portal) {
      this.portal.destroy();
      this.portal = undefined;
    }
    if (st.riftOpen && !this.rift) {
      this.rift = this.buildGate(
        st.riftX,
        st.riftY,
        0xb478ff,
        0x8a4dff,
        "⇓ RIFT — push deeper (harder, richer)",
        "#b478ff",
      );
    }
    if (!st.riftOpen && this.rift) {
      this.rift.destroy();
      this.rift = undefined;
    }
  }

  /** Boss health bar + approach banner + victory screen (§16). */
  private updateRunState(): void {
    if (!this.room) return;
    // Locate the boss (if any) — §17 ANY dimension's boss (archetype "boss"), not just OLD RUST — and total
    // its max HP from the roster. The nameplate + approach toast read the active dimension's name.
    let boss: { hp: number; kind: string } | undefined;
    this.room.state.enemies.forEach((e) => {
      if (ENEMY_KINDS[e.kind]?.archetype === "boss") boss = e;
    });
    const s = this.uiScale();
    const bossMax = boss ? (ENEMY_KINDS[boss.kind]?.hp ?? 420) : 420;
    const dimName = getDimension(this.room.state.dimensionId).name;
    const present = !!boss;
    if (present && boss) {
      this.bossBarBg.setPosition(this.screenW() / 2, 40 * s).setVisible(true);
      this.bossBarFill.setPosition(this.screenW() / 2 - 258 * s, 48 * s).setVisible(true);
      this.bossBarFill.width = 516 * s * Math.max(0, Math.min(1, boss.hp / bossMax));
      this.bossText
        .setPosition(this.screenW() / 2, 38 * s)
        .setText(`${dimName.toUpperCase()} BOSS`)
        .setVisible(true);
    } else {
      this.bossBarBg.setVisible(false);
      this.bossBarFill.setVisible(false);
      this.bossText.setVisible(false);
    }
    // Boss-approach toast on first appearance.
    if (present && !this.prevBossPresent && this.bannerShownFor !== "boss") {
      this.bannerShownFor = "boss";
      this.flashBanner(`⚠  THE ${dimName.toUpperCase()} BOSS APPROACHES  ⚠`, "#ff5d3b");
    }
    if (!present) this.bannerShownFor = "";
    this.prevBossPresent = present;

    // Victory screen — §6 v0.103: report the extraction's REAL payload (depth reached + total banked).
    const won = this.room.state.outcome === "victory";
    this.victoryText.setVisible(won);
    if (won) {
      this.victoryText
        .setText(
          `EXTRACTED at depth ${this.room.state.depth} ✦ ${this.room.state.bankedSalvage} salvage banked\n(Restart Run — top-right)`,
        )
        .setPosition(this.screenW() / 2, this.screenH() / 2);
    }
  }

  /** A big transient centered banner that fades (boss approach, etc.). */
  private flashBanner(msg: string, color: string): void {
    const cam = this.cameras.main;
    const t = this.add
      .text(this.screenW() / 2, this.screenH() / 2 - 80, msg, {
        fontSize: "32px",
        color,
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100003);
    this.tweens.add({
      targets: t,
      alpha: 0,
      duration: 2200,
      ease: "Cubic.easeIn",
      onComplete: () => t.destroy(),
    });
    cam.shake(180, 0.006);
  }

  /** §12/§8 level-up window: while the local player owes a FLEX stat point, show the attribute pick; once
   *  that's spent but a SIGNATURE pick is still owed, show the §8 augment draft. Both freeze the player. */
  private updateLevelWindow(): void {
    if (!this.room) return;
    const self = this.room.state.players.get(this.room.sessionId);
    const flex = !!self && self.flexPending > 0;
    const sig = !!self && self.sigPending > 0 && !flex; // the augment pick follows the stat pick
    const open = flex || sig;
    const key =
      open && self
        ? `${self.level}:${flex ? "F" : "S"}:${self.flexPending}:${self.sigPending}:${self.sigOffer}`
        : "";
    if (key !== this.levelWinKey) {
      this.levelWinKey = key;
      for (const o of this.levelWinObjects) o.destroy();
      this.levelWinObjects = [];
      this.levelWinTimerBar = undefined;
      if (self && flex) this.buildLevelWindow(self);
      else if (self && sig) this.buildAugmentWindow(self);
    }
    if (open && self && this.levelWinTimerBar) {
      this.levelWinTimerBar.width =
        380 * Math.max(0, Math.min(1, self.flexTimer / LEVELUP_WINDOW_SECONDS));
    }
  }

  /** The five attributes (§11) — name, effect, accent colour (§28.2). */
  private static readonly ATTR_INFO: Record<string, { name: string; desc: string; color: number }> =
    {
      str: { name: "STR", desc: "+ melee damage", color: 0xff8a2b },
      dex: { name: "DEX", desc: "+ finesse/ranged dmg", color: 0x6fd6ff },
      int: { name: "INT", desc: "+ spell / signature power", color: 0xb07bd6 },
      con: { name: "CON", desc: "+ max HP & regen", color: 0x9cff3b },
      luk: { name: "LUK", desc: "+ luck & rarity", color: 0xffd479 },
    };

  /** §8 augment flavor-tag → accent colour (riposte STR-orange · aegis CON-green · hex INT-purple). */
  private static readonly AUG_TAG_COL: Record<string, number> = {
    riposte: 0xff8a2b,
    aegis: 0x9cff3b,
    hex: 0xb07bd6,
  };

  /** The shared dim overlay + title + subtitle + countdown bar for either level-window mode. */
  private buildLevelShell(self: PlayerState, sub: string): { cx: number; cy: number } {
    const cx = this.screenW() / 2;
    const cy = this.screenH() / 2;
    const dim = this.add
      .rectangle(cx, cy, this.screenW(), this.screenH(), 0x05040a, 0.66)
      .setScrollFactor(0)
      .setDepth(100010)
      .setInteractive();
    const title = this.add
      .text(cx, cy - 170, `LEVEL ${self.level}`, {
        fontSize: "30px",
        color: "#ffd479",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100011);
    const subT = this.add
      .text(cx, cy - 138, sub, { fontSize: "15px", color: "#cfc8b6" })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100011);
    const barBg = this.add
      .rectangle(cx, cy - 112, 380, 6, 0x2a2620)
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100011);
    this.levelWinTimerBar = this.add
      .rectangle(cx - 190, cy - 112, 380, 6, 0xffd479)
      .setScrollFactor(0)
      .setOrigin(0, 0.5)
      .setDepth(100012);
    this.levelWinObjects.push(dim, title, subT, barBg, this.levelWinTimerBar);
    return { cx, cy };
  }

  /** §8 build the dim overlay + 3 augment cards for the signature draft (every 5th level). */
  private buildAugmentWindow(self: PlayerState): void {
    const { cx, cy } = this.buildLevelShell(self, "SIGNATURE — pick a parry augment (§8)");
    const offer = self.sigOffer.split(",").filter(Boolean);
    const W = 196;
    const H = 214;
    const gap = 22;
    const startX = cx - (offer.length * (W + gap) - gap) / 2 + W / 2;
    offer.forEach((id, i) => {
      const def = AUGMENTS[id];
      if (!def) return;
      const col = ArenaScene.AUG_TAG_COL[def.tag] ?? 0xb9975b;
      const x = startX + i * (W + gap);
      const card = this.add
        .rectangle(x, cy + 30, W, H, 0x1b1812, 0.98)
        .setScrollFactor(0)
        .setStrokeStyle(3, col)
        .setDepth(100011)
        .setInteractive({ useHandCursor: true });
      const icon = this.add.graphics().setScrollFactor(0).setDepth(100012);
      drawIcon(icon, def.icon, x, cy - 46, 13, col);
      const name = this.add
        .text(x, cy - 8, def.name, { fontSize: "20px", color: "#f0ead8", fontStyle: "bold" })
        .setScrollFactor(0)
        .setOrigin(0.5)
        .setDepth(100012);
      const tag = this.add
        .text(x, cy + 16, def.tag.toUpperCase(), {
          fontSize: "12px",
          color: `#${col.toString(16).padStart(6, "0")}`,
          fontStyle: "bold",
        })
        .setScrollFactor(0)
        .setOrigin(0.5)
        .setDepth(100012);
      const desc = this.add
        .text(x, cy + 58, def.desc, {
          fontSize: "13px",
          color: "#cfc8b6",
          align: "center",
          wordWrap: { width: W - 26 },
        })
        .setScrollFactor(0)
        .setOrigin(0.5)
        .setDepth(100012);
      card.on("pointerover", () => card.setScale(1.05));
      card.on("pointerout", () => card.setScale(1));
      card.on("pointerdown", () => this.room?.send("chooseAugment", { id }));
      this.levelWinObjects.push(card, icon, name, tag, desc);
    });
  }

  /** Build the dim overlay + 5 attribute buttons for the §12 flex-point pick. */
  private buildLevelWindow(self: PlayerState): void {
    const { cx, cy } = this.buildLevelShell(self, "+1 STR  +1 CON (auto) · spend your FLEX point");
    const attrs: Attr[] = ["str", "dex", "int", "con", "luk"];
    const W = 150;
    const H = 200;
    const gap = 16;
    const startX = cx - (attrs.length * (W + gap) - gap) / 2 + W / 2;
    attrs.forEach((attr, i) => {
      const info = ArenaScene.ATTR_INFO[attr];
      if (!info) return;
      const cur = self[attr]; // PlayerState[Attr] → number (no cast needed)
      const x = startX + i * (W + gap);
      const card = this.add
        .rectangle(x, cy + 30, W, H, 0x1b1812, 0.98)
        .setScrollFactor(0)
        .setStrokeStyle(3, info.color)
        .setDepth(100011)
        .setInteractive({ useHandCursor: true });
      const name = this.add
        .text(x, cy - 34, info.name, { fontSize: "26px", color: "#f0ead8", fontStyle: "bold" })
        .setScrollFactor(0)
        .setOrigin(0.5)
        .setDepth(100012);
      const val = this.add
        .text(x, cy + 4, `${cur} → ${cur + 1}`, {
          fontSize: "16px",
          color: `#${info.color.toString(16).padStart(6, "0")}`,
          fontStyle: "bold",
        })
        .setScrollFactor(0)
        .setOrigin(0.5)
        .setDepth(100012);
      const desc = this.add
        .text(x, cy + 48, info.desc, {
          fontSize: "13px",
          color: "#cfc8b6",
          align: "center",
          wordWrap: { width: W - 22 },
        })
        .setScrollFactor(0)
        .setOrigin(0.5)
        .setDepth(100012);
      card.on("pointerover", () => card.setScale(1.05));
      card.on("pointerout", () => card.setScale(1));
      card.on("pointerdown", () => this.room?.send("chooseAttribute", { attr }));
      this.levelWinObjects.push(card, name, val, desc);
    });
  }

  /** §21 Testing-Grounds Tab menu — the summonable roster (boss + dummy excluded; tough is a toggle). */
  private static readonly SUMMON_KINDS: { id: string; label: string }[] = [
    { id: "critter", label: "Critter (rusher)" },
    { id: "mote-swarm", label: "Mote (swarm)" },
    { id: "pricklepulp", label: "Pricklepulp (zoner)" },
    { id: "boothill", label: "Boothill (spitter)" },
    { id: "gatlin", label: "Gatlin (scatter)" },
    { id: "ronin", label: "Ronin (duelist)" },
    { id: "old-rust", label: "OLD RUST (boss)" },
  ];

  /** Tear down the summon overlay. */
  private closeSummonMenu(): void {
    for (const o of this.summonObjects) o.destroy();
    this.summonObjects = [];
    this.summonOpen = false;
  }

  /** Open (or rebuild) the dev summon menu: a multiplier row + a Tough toggle + one button per kind.
   *  Clicking a kind sends `debugSpawn` and leaves the menu up so you can keep conjuring. */
  private openSummonMenu(): void {
    this.closeSummonMenu();
    this.summonOpen = true;
    const cx = this.screenW() / 2;
    const cy = this.screenH() / 2;
    const dim = this.add
      .rectangle(cx, cy, this.screenW(), this.screenH(), 0x05040a, 0.55)
      .setScrollFactor(0)
      .setDepth(100020)
      .setInteractive();
    const title = this.add
      .text(cx, cy - 196, "SUMMON — Testing Grounds", {
        fontSize: "26px",
        color: "#33e6ff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100021);
    const hint = this.add
      .text(cx, cy - 166, "click a monster to spawn · Tab to close", {
        fontSize: "13px",
        color: "#cfc8b6",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100021);
    this.summonObjects.push(dim, title, hint);

    // Multiplier row (×1 … ×DEBUG_SPAWN_MAX) + a Tough toggle on the right.
    const mults = [1, 5, 10, DEBUG_SPAWN_MAX].filter((n, i, a) => a.indexOf(n) === i);
    const chipW = 58;
    const chipGap = 10;
    const rowW = mults.length * (chipW + chipGap) - chipGap;
    const mStartX = cx - rowW / 2 + chipW / 2 - 70;
    const my = cy - 122;
    const mLabel = this.add
      .text(mStartX - chipW / 2 - 14, my, "×", { fontSize: "18px", color: "#9a9486" })
      .setScrollFactor(0)
      .setOrigin(1, 0.5)
      .setDepth(100021);
    this.summonObjects.push(mLabel);
    mults.forEach((n, i) => {
      const x = mStartX + i * (chipW + chipGap);
      const on = this.summonCount === n;
      const chip = this.add
        .rectangle(x, my, chipW, 30, on ? 0x1f6b78 : 0x1b1812, 0.98)
        .setScrollFactor(0)
        .setStrokeStyle(2, on ? 0x33e6ff : 0x4a443a)
        .setDepth(100021)
        .setInteractive({ useHandCursor: true });
      const t = this.add
        .text(x, my, `${n}`, {
          fontSize: "16px",
          color: on ? "#bdf6ff" : "#cfc8b6",
          fontStyle: "bold",
        })
        .setScrollFactor(0)
        .setOrigin(0.5)
        .setDepth(100022);
      chip.on("pointerdown", () => {
        this.summonCount = n;
        this.openSummonMenu(); // rebuild to refresh the selected highlight
      });
      this.summonObjects.push(chip, t);
    });
    // Tough toggle.
    const tx = mStartX + mults.length * (chipW + chipGap) + 40;
    const tough = this.add
      .rectangle(tx, my, 96, 30, this.summonTough ? 0x6b4a1f : 0x1b1812, 0.98)
      .setScrollFactor(0)
      .setStrokeStyle(2, this.summonTough ? 0xffb24a : 0x4a443a)
      .setDepth(100021)
      .setInteractive({ useHandCursor: true });
    const toughT = this.add
      .text(tx, my, this.summonTough ? "TOUGH ✓" : "tough", {
        fontSize: "14px",
        color: this.summonTough ? "#ffd9a8" : "#9a9486",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100022);
    tough.on("pointerdown", () => {
      this.summonTough = !this.summonTough;
      this.openSummonMenu();
    });
    this.summonObjects.push(tough, toughT);

    // Monster buttons — a centered grid (4 per row).
    const kinds = ArenaScene.SUMMON_KINDS;
    const W = 196;
    const H = 52;
    const gap = 14;
    const perRow = 4;
    kinds.forEach((k, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const rowCount = Math.min(perRow, kinds.length - row * perRow);
      const rowWidth = rowCount * (W + gap) - gap;
      const x = cx - rowWidth / 2 + W / 2 + col * (W + gap);
      const y = cy - 56 + row * (H + gap);
      const btn = this.add
        .rectangle(x, y, W, H, 0x1b1812, 0.98)
        .setScrollFactor(0)
        .setStrokeStyle(2, 0x33e6ff)
        .setDepth(100021)
        .setInteractive({ useHandCursor: true });
      const t = this.add
        .text(x, y, k.label, { fontSize: "14px", color: "#e6f8ff", align: "center" })
        .setScrollFactor(0)
        .setOrigin(0.5)
        .setDepth(100022);
      btn.on("pointerover", () => btn.setFillStyle(0x26221a, 1));
      btn.on("pointerout", () => btn.setFillStyle(0x1b1812, 0.98));
      btn.on("pointerdown", () =>
        this.room?.send("debugSpawn", {
          kind: k.id,
          count: this.summonCount,
          tough: this.summonTough,
        }),
      );
      this.summonObjects.push(btn, t);
    });
  }

  /**
   * Reconcile rendered blobs against authoritative state every frame: create a blob for
   * any player that lacks one, destroy any blob whose player has left. Race-proof — does
   * not depend on onAdd/onRemove firing at the right moment on a cold connect.
   */
  private syncBlobs(): void {
    if (!this.room) return;
    const players = this.room.state.players;
    players.forEach((player, id) => {
      if (!this.blobs.has(id)) this.addBlob(player, id);
      // §7 character swap (C key) — rebuild the rig with the new skin (re-equips next frame).
      else if (this.charOf.get(id) !== player.character) {
        this.removeBlob(id);
        this.addBlob(player, id);
      }
    });
    for (const id of [...this.blobs.keys()]) {
      if (!players.has(id)) this.removeBlob(id);
    }
  }

  private interpolate(deltaMs: number): void {
    if (!this.room) return;
    // Frame-rate-independent smoothing toward the authoritative position.
    const t = 1 - 0.0015 ** (deltaMs / 1000);
    this.room.state.players.forEach((player, id) => {
      const blob = this.blobs.get(id);
      if (!blob) return;
      blob.setPosition(
        Phaser.Math.Linear(blob.x, player.x, t),
        Phaser.Math.Linear(blob.y, player.y, t),
      );
    });
  }

  /** Keep the camera locked on the local player every frame (robust vs startFollow drift). */
  private followSelf(): void {
    const id = this.room?.sessionId;
    if (!id) return;
    // §6 spectate-follow: while DOWNED, the camera trails a living squadmate (you watch the squad until a
    // teammate with a rez weapon revives you). Falls back to your own downed body if nobody's up.
    const me = this.room?.state.players.get(id);
    if (me && !me.alive) {
      let target: SpriteRig | undefined;
      this.room?.state.players.forEach((p, pid) => {
        if (!target && p.alive && pid !== id) target = this.blobs.get(pid);
      });
      if (target) {
        this.centerCam(target.x, target.y);
        return;
      }
    }
    const self = this.blobs.get(id);
    if (self) this.centerCam(self.x, self.y);
  }

  /** Center the camera on (x,y) — ZOOM-AWARE + arena-clamped. Phaser's `centerOn` divides by the
   *  viewport not the zoom, so under the §28 hi-DPI camera zoom it offsets the player by a fraction of
   *  the screen; we scroll by the visible WORLD half-extent (`width / zoom / 2`) instead. */
  private centerCam(x: number, y: number): void {
    const cam = this.cameras.main;
    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;
    // Follow + arena-clamp, but on a viewport LARGER than the arena (4K / ultrawide) the clamp would pin
    // the arena to a corner — instead CENTRE it (a negative scroll), so the playfield sits middle-screen
    // and the painted ground margin fills the surround.
    const axis = (target: number, view: number, world: number): number =>
      view >= world ? (world - view) / 2 : Math.max(0, Math.min(world - view, target));
    cam.setScroll(
      axis(x - viewW / 2, viewW, ARENA_WIDTH),
      axis(y - viewH / 2, viewH, ARENA_HEIGHT),
    );
  }

  /** Drive each character's procedural animation from its render-velocity + the cursor aim. */
  private animateBlobs(): void {
    const selfId = this.room?.sessionId;
    const cam = this.cameras.main;
    const pointer = this.input.activePointer;

    let aimX = 0;
    let aimY = 0;
    const self = selfId ? this.blobs.get(selfId) : undefined;
    if (self) {
      const px = this.pointerScreen.set ? this.pointerScreen.x : pointer.x;
      const py = this.pointerScreen.set ? this.pointerScreen.y : pointer.y;
      const ax = px + cam.scrollX - self.x;
      const ay = py + cam.scrollY - self.y;
      const len = Math.hypot(ax, ay);
      if (len > 0.001) {
        aimX = ax / len;
        aimY = ay / len;
        this.selfAim = { x: aimX, y: aimY }; // remembered for the attack message
      }
    }

    for (const [id, blob] of this.blobs) {
      const prev = this.prevPos.get(id) ?? { x: blob.x, y: blob.y };
      let mx = blob.x - prev.x;
      let my = blob.y - prev.y;
      const ml = Math.hypot(mx, my);
      if (ml > 0.001) {
        mx /= ml;
        my /= ml;
      } else {
        mx = 0;
        my = 0;
      }
      this.prevPos.set(id, { x: blob.x, y: blob.y });

      // §5/§20 (Stage B): lift the rig by the synced HEIGHT (a real gravity arc, server-integrated) — the
      // jump, and later the §8 parry-launch, just raise this value; the client renders whatever height is.
      const pl = this.room?.state.players.get(id);
      blob.setHop(pl?.height ?? 0);

      // §6 DOWNED look + revive pop. A downed body greys out + fades; a rez (revivedSeq tick) pops it green.
      const alive = pl?.alive ?? true;
      blob.setDowned(!alive);
      const rs = pl?.revivedSeq ?? 0;
      if (this.lastRevived.get(id) !== rs) {
        if (this.lastRevived.has(id) && alive) blob.flash(170, 0x9cff3b);
        this.lastRevived.set(id, rs);
      }

      const isSelf = id === selfId;
      blob.animate(this.time.now, {
        moveX: mx,
        moveY: my,
        aimX: isSelf ? aimX : 0,
        aimY: isSelf ? aimY : 0,
        aimDir: pl?.aimDir ?? 0, // §9 remote gun pose tracks the synced aim
        isSelf,
        recoilX: pl?.vx ?? 0, // §20 momentum flinch (gun recoil / hit knockback)
        recoilY: pl?.vy ?? 0,
      });
      blob.setDepth(blob.y);
    }
  }

  /** RMB held → fire the equipped weapon toward the cursor (§9). Server gates damage by cooldown;
   *  the client mirrors the cooldown locally to fire the swing animation in sync (cosmetic). */
  private sendAttack(): void {
    if (!this.room) return;
    this.localAtkCd = Math.max(0, this.localAtkCd - this.deltaSec);
    const selfId = this.room.sessionId;
    const self = this.room.state.players.get(selfId);
    if (!self?.alive || self.flexPending > 0) return;
    if (!this.input.activePointer.rightButtonDown() || this.localAtkCd > 0) return;
    const weapon = WEAPONS[self.weapon] ?? WEAPONS[DEFAULT_WEAPON];
    // Thrown weapons + guns need ammo — don't animate/fire when empty/reloading (server gates it too).
    if ((weapon?.thrown || weapon?.gun) && self.charges <= 0) return;
    this.localAtkCd = weapon?.gun?.fireRate ?? weapon?.cooldown ?? 0.3;
    const rig = this.blobs.get(selfId);
    // §20 WYSIWYG: freeze the aim at swing-start so the blade sweeps the SAME arc the server's swept hitbox
    // uses. Guns don't melee-swing — the shot is the muzzle flash.
    if (!weapon?.gun) rig?.triggerSwing(this.time.now, Math.atan2(this.selfAim.y, this.selfAim.x));
    // Cursor world position (for slam-at-cursor weapons).
    const cam = this.cameras.main;
    const px = this.pointerScreen.set ? this.pointerScreen.x : this.input.activePointer.x;
    const py = this.pointerScreen.set ? this.pointerScreen.y : this.input.activePointer.y;
    const cwx = px + cam.scrollX;
    const cwy = py + cam.scrollY;
    if (weapon?.quake) {
      // Epicenter = cursor, clamped to QUAKE_REACH from the character — the SAME shared clamp the
      // server uses, so the VFX lands exactly on the damage AoE.
      const ep = clampQuakeEpicenter(
        { x: rig?.x ?? self.x, y: rig?.y ?? self.y },
        { x: cwx, y: cwy },
        QUAKE_REACH,
      );
      spawnQuake(this, ep.x, ep.y, weapon.quake);
      this.hitStop(130);
    } else if (weapon?.gun) {
      // Gun recoil — a per-gun camera kick (heavy slug THUMPS, gatling barely buzzes). The shake duration
      // is capped to the fire-rate so a fast auto's kicks decay before the next shot (no jitter stacking).
      // The muzzle flash + bullet render off the server-spawned projectile (syncProjectiles).
      this.cameras.main.shake(Math.min(70, weapon.gun.fireRate * 700), weapon.gun.recoil ?? 0.0017);
    } else if (weapon && !weapon.thrown) {
      // Plain melee swing → the weapon's authored swing VFX (§14). If the weapon is authored "spawn at
      // cursor" (Weaponsmith), the VFX erupts at the clamped cursor (greatsword-quake style) instead.
      const rx = rig?.x ?? self.x;
      const ry = rig?.y ?? self.y;
      if (this.vfxPlayer.spawnsAtCursor(weapon.id)) {
        const ep = clampQuakeEpicenter({ x: rx, y: ry }, { x: cwx, y: cwy }, QUAKE_REACH);
        this.spawnSlash(ep.x, ep.y, this.selfAim, weapon, true);
      } else {
        this.spawnSlash(rx, ry, this.selfAim, weapon);
      }
      // Chain-lightning on-hit proc (§10) — teal bolt leaps to the nearest enemies (server owns the damage).
      if (weapon.chainLightning) this.spawnChain(rx, ry, this.selfAim, weapon);
    }
    this.room.send("attack", { aimX: this.selfAim.x, aimY: this.selfAim.y, tx: cwx, ty: cwy });
  }

  /** LMB → the melee Parry signature (§7/§8). Server grants i-frames + knockback. NO VFX yet — the
   *  parry reads purely as a BLOCK/BRACE stance (weapon raised, hands guarding, slight crouch) until
   *  level-up augments add on-parry effects. Mirrors the server cooldown so the brace fires in sync. */
  private sendParry(): void {
    if (!this.room) return;
    this.localParryCd = Math.max(0, this.localParryCd - this.deltaSec);
    const selfId = this.room.sessionId;
    const self = this.room.state.players.get(selfId);
    if (!self?.alive || self.flexPending > 0 || self.sigPending > 0) return;
    if (!this.input.activePointer.leftButtonDown() || this.localParryCd > 0) return;
    this.localParryCd = PARRY_COOLDOWN;
    this.lastParryPress = this.time.now; // H10: open the i-frame-window flash on the parry ring
    this.room.send("parry");
    const rig = this.blobs.get(selfId);
    rig?.triggerBrace(this.time.now);
    // §8 local-player parry-augment VFX (server owns the damage; this reads the owned set + live aim).
    if (rig && self.augments) this.spawnParryFx(rig.x, rig.y, self.augments);
  }

  /** H10 §20 parry-state ring under the LOCAL drifter so the timing is learnable: a bright flash through the
   *  active i-frame window after a press (you're invulnerable NOW), a dim arc sweeping back to a full ring as
   *  the cooldown drains after a whiff, and a faint "ready" ring at rest. Mirrors the press + the shared
   *  PARRY_IFRAMES / PARRY_COOLDOWN (the server owns the real i-frames). */
  private renderParryState(): void {
    const g = this.parryGfx;
    g.clear();
    const selfId = this.room?.sessionId;
    const self = selfId ? this.room?.state.players.get(selfId) : undefined;
    const rig = selfId ? this.blobs.get(selfId) : undefined;
    if (!self?.alive || !rig || self.flexPending > 0 || self.sigPending > 0) return; // hide mid-pick
    const x = rig.x;
    const y = rig.y;
    const R = 30;
    const sinceParry = (this.time.now - this.lastParryPress) / 1000;
    if (sinceParry < PARRY_IFRAMES) {
      // ACTIVE i-frame window — a bright white ring that fades as the window closes.
      const k = 1 - sinceParry / PARRY_IFRAMES;
      g.lineStyle(3.5, 0xffffff, 0.35 + 0.5 * k);
      g.strokeCircle(x, y, R);
    } else if (this.localParryCd > 0) {
      // RECOVERING — a dim arc filling clockwise from the top back to a full ring as the cooldown drains.
      const frac = 1 - this.localParryCd / PARRY_COOLDOWN; // 0 = just whiffed, 1 = ready
      g.lineStyle(3, 0x3aa0c0, 0.5);
      g.beginPath();
      g.arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      g.strokePath();
    } else {
      // READY — a faint full ring (parry available).
      g.lineStyle(2, 0x8fdcff, 0.28);
      g.strokeCircle(x, y, R);
    }
  }

  /** M2 §15/§16 ranged parry tell: a bright core + a ring that tightens onto each HOSTILE projectile (enemy
   *  spit + the boss bullet-wall — both kind "spit") as it closes on a player. Teaches "ranged = parryable,
   *  not just dodge." Constant velocity makes the timing honest. Drawn on the white-tell layer (same
   *  language as the melee windup ring); the parry itself already flashes the player's white spark via
   *  parriedSeq. */
  private renderProjectileTells(): void {
    if (!this.room) return;
    const g = this.telegraphGfx;
    const TELL = 150; // begin the cue ~150px out — a readable beat at bullet speed
    this.room.state.projectiles.forEach((pr, id) => {
      if (pr.kind !== "spit") return; // friendly gun/cleaver/magma/counter shots aren't a threat to parry
      const c = this.projectiles.get(id);
      const px = c?.x ?? pr.x;
      const py = c?.y ?? pr.y;
      let best = TELL;
      this.room?.state.players.forEach((p) => {
        if (!p.alive) return;
        const d = Math.hypot(p.x - px, p.y - py);
        if (d < best) best = d;
      });
      if (best >= TELL) return; // not near anyone yet — no cue
      const k = 1 - best / TELL; // 0 far → 1 right on the player (parry NOW)
      g.fillStyle(0xffffff, 0.22 + 0.5 * k);
      g.fillCircle(px, py, 4 + 3 * k);
      g.lineStyle(2 + 1.5 * k, 0xffffff, 0.35 + 0.5 * k);
      g.strokeCircle(px, py, 22 - 13 * k); // ring tightens onto the slug as it arrives
    });
    // §6 v0.103 rift CHANNEL readout: the descent is a hold, not a tripwire — draw the synced 0→1 charge
    // as a violet arc filling clockwise around the rift while someone stands in it.
    const st = this.room.state;
    if (st.riftOpen && st.riftCharge > 0) {
      g.lineStyle(7, 0xb478ff, 0.95);
      g.beginPath();
      g.arc(
        st.riftX,
        st.riftY,
        EXTRACT_RADIUS + 10,
        -Math.PI / 2,
        -Math.PI / 2 + st.riftCharge * Math.PI * 2,
      );
      g.strokePath();
    }
  }

  /** §17 v0.102 landmark occlusion fade: an L/XL structure is taller than the viewport, so when the LOCAL
   *  player walks behind one (inside the sprite's bounds, above its base), it eases to ~45% alpha — cover
   *  you can see yourself behind, the standard top-down-action treatment. Eases back to opaque when clear. */
  private updatePoiOcclusion(): void {
    const selfId = this.room?.sessionId;
    const self = selfId ? this.room?.state.players.get(selfId) : undefined;
    for (const p of this.poiSprites) {
      let target = 1;
      if (self?.alive) {
        const halfW = p.img.displayWidth / 2;
        const top = p.y - p.img.displayHeight;
        // "Behind" = horizontally within the sprite and standing between its top and its base line.
        if (self.y < p.y && self.y > top && Math.abs(self.x - p.x) < halfW) target = 0.45;
      }
      p.img.alpha = Phaser.Math.Linear(p.img.alpha, target, 0.18);
    }
  }

  /** One edge-of-screen locator chevron: pinned to the viewport edge along the bearing to (tx,ty), with
   *  a distance readout. Created lazily into `slot`, hidden when the target is on-screen/absent. */
  private updateEdgeArrow(
    slot: "portalArrow" | "riftArrow",
    open: boolean,
    tx: number,
    ty: number,
    color: number,
    colorCss: string,
    word: string,
  ): void {
    const selfId = this.room?.sessionId;
    const self = selfId ? this.room?.state.players.get(selfId) : undefined;
    const cam = this.cameras.main;
    const onScreen =
      open &&
      tx > cam.worldView.x &&
      tx < cam.worldView.right &&
      ty > cam.worldView.y &&
      ty < cam.worldView.bottom;
    if (!open || onScreen || !self?.alive) {
      this[slot]?.setVisible(false);
      return;
    }
    if (!this[slot]) {
      const tri = this.add.triangle(0, 0, 0, -13, 11, 9, -11, 9, color, 0.95);
      const label = this.add
        .text(0, 26, "", { fontSize: "13px", color: colorCss, fontStyle: "bold" })
        .setOrigin(0.5);
      this[slot] = this.add.container(0, 0, [tri, label]).setDepth(99997).setScrollFactor(0);
    }
    const arrow = this[slot] as Phaser.GameObjects.Container;
    const dx = tx - self.x;
    const dy = ty - self.y;
    const ang = Math.atan2(dy, dx);
    // Pin to the screen edge along the bearing (padded), rotate the chevron to point at the target.
    const pad = 46;
    const w = this.screenW();
    const h = this.screenH();
    const cx = w / 2;
    const cy = h / 2;
    const t = Math.min(
      Math.abs((dx >= 0 ? w - pad - cx : pad - cx) / (Math.cos(ang) || 1e-6)),
      Math.abs((dy >= 0 ? h - pad - cy : pad - cy) / (Math.sin(ang) || 1e-6)),
    );
    arrow.setVisible(true).setPosition(cx + Math.cos(ang) * t, cy + Math.sin(ang) * t);
    (arrow.list[0] as Phaser.GameObjects.Triangle).setRotation(ang + Math.PI / 2);
    (arrow.list[1] as Phaser.GameObjects.Text).setText(
      `${word} ${Math.round(Math.hypot(dx, dy) / 100) / 10}k`,
    );
  }

  /** §17/§6 off-screen locators: the amber EXTRACT portal + the violet DEEPER rift each get an edge
   *  chevron when open + out of view, so the greed decision has directions, not just copy. */
  private updatePortalArrow(): void {
    const st = this.room?.state;
    if (!st) return;
    this.updateEdgeArrow(
      "portalArrow",
      st.portalOpen,
      st.portalX,
      st.portalY,
      0xffd479,
      "#ffd479",
      "bank",
    );
    this.updateEdgeArrow("riftArrow", st.riftOpen, st.riftX, st.riftY, 0xb478ff, "#b478ff", "rift");
  }

  /** §8 cosmetic on-parry VFX for the augments that read at the parrier: Bulwark's absorb ring + Emberguard's
   *  fire-wave cone (toward the live cursor aim). Counterblade's blades + the damage are server-spawned. */
  private spawnParryFx(x: number, y: number, owned: string): void {
    if (hasAugment(owned, "bulwark")) {
      const ring = this.add.circle(x, y, 30).setStrokeStyle(4, 0x6fe6ff, 0.9).setDepth(99996);
      this.tweens.add({
        targets: ring,
        scale: 1.7,
        alpha: 0,
        duration: 380,
        ease: "Quad.easeOut",
        onComplete: () => ring.destroy(),
      });
    }
    if (hasAugment(owned, "emberguard")) {
      const ang = Math.atan2(this.selfAim.y, this.selfAim.x);
      const ADD = Phaser.BlendModes.ADD;
      const base = this.add
        .ellipse(x, y, EMBERGUARD_RANGE, EMBERGUARD_RANGE * 0.55, 0xff5a1e, 0.18)
        .setRotation(ang)
        .setBlendMode(ADD)
        .setDepth(99994);
      this.tweens.add({
        targets: base,
        alpha: 0,
        scale: 1.2,
        duration: 240,
        onComplete: () => base.destroy(),
      });
      for (let i = 0; i < 7; i++) {
        const a = ang + (i / 6 - 0.5) * EMBERGUARD_HALF_ARC * 2;
        const ember = this.add.circle(x, y, 7, 0xff7a2a, 0.9).setBlendMode(ADD).setDepth(99995);
        this.tweens.add({
          targets: ember,
          x: x + Math.cos(a) * EMBERGUARD_RANGE,
          y: y + Math.sin(a) * EMBERGUARD_RANGE,
          alpha: 0,
          scale: 2,
          duration: 280 + Math.random() * 80,
          ease: "Quad.easeOut",
          onComplete: () => ember.destroy(),
        });
      }
    }
  }

  /** Hit-stop (§20): hold the visuals for `ms` on impactful events. */
  private hitStop(ms: number): void {
    this.frozenUntil = Math.max(this.frozenUntil, this.time.now + ms);
  }

  /** Hit feedback driven off authoritative state diffs: enemy hp drops → flash + damage number;
   *  local player hp drops → flash + screen shake (§20 game-feel from day one). */
  private updateCombatFx(): void {
    if (!this.room) return;
    this.room.state.enemies.forEach((enemy, id) => {
      const prev = this.enemyHp.get(id);
      if (prev !== undefined && enemy.hp < prev) {
        const rig = this.enemies.get(id);
        if (rig) {
          rig.flash();
          spawnDamageNumber(this, rig.x, rig.y - 26, prev - enemy.hp, "#FFE08A");
        }
      }
      this.enemyHp.set(id, enemy.hp);
    });

    // §8 successful-parry flash (Stage C): a white burst when ANY player parries a telegraphed attack;
    // the LOCAL player's parry cooldown refreshes (§8 flow) so they can immediately parry the next swing.
    this.room.state.players.forEach((p, id) => {
      const prev = this.lastParried.get(id);
      this.lastParried.set(id, p.parriedSeq);
      if (prev !== undefined && prev !== p.parriedSeq) {
        this.spawnParrySpark(p.x, p.y);
        if (id === this.room?.sessionId) {
          this.localParryCd = Math.min(this.localParryCd, PARRY_CHAIN_CD);
          this.hitStop(100); // H3 §20: the parry is the skill beat — freeze a touch longer than a kill
        }
      }
    });

    const selfId = this.room.sessionId;
    const self = selfId ? this.room.state.players.get(selfId) : undefined;
    if (self) {
      if (
        this.prevSelfHp >= 0 &&
        self.hp < this.prevSelfHp - 0.01 &&
        this.time.now - this.lastHurt > 180
      ) {
        this.blobs.get(selfId)?.flash();
        this.cameras.main.shake(100, 0.005);
        this.lastHurt = this.time.now;
      }
      this.prevSelfHp = self.hp;

      // Level-up celebration (§12): gold burst on the drifter + a screen toast.
      if (this.prevLevel >= 0 && self.level > this.prevLevel) {
        const rig = this.blobs.get(selfId);
        if (rig) this.spawnLevelUp(rig.x, rig.y);
      }
      this.prevLevel = self.level;
    }
  }

  /** §8 successful-parry flash (Stage C) — a crisp WHITE ring burst + sparks where a player parried a
   *  telegraphed attack (the §8 white parry-language: white = the parry connected). */
  private spawnParrySpark(x: number, y: number): void {
    const ADD = Phaser.BlendModes.ADD;
    const ring = this.add
      .circle(x, y, 16)
      .setStrokeStyle(4, 0xffffff, 0.95)
      .setBlendMode(ADD)
      .setDepth(99996);
    this.tweens.add({
      targets: ring,
      scale: 2.6,
      alpha: 0,
      duration: 260,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy(),
    });
    const flash = this.add.circle(x, y, 22, 0xffffff, 0.5).setBlendMode(ADD).setDepth(99995);
    this.tweens.add({
      targets: flash,
      scale: 1.4,
      alpha: 0,
      duration: 160,
      onComplete: () => flash.destroy(),
    });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const s = this.add
        .rectangle(x, y, 13, 2.4, 0xffffff, 0.95)
        .setRotation(a)
        .setBlendMode(ADD)
        .setDepth(99996);
      this.tweens.add({
        targets: s,
        x: x + Math.cos(a) * 34,
        y: y + Math.sin(a) * 34,
        alpha: 0,
        duration: 200,
        ease: "Quad.easeOut",
        onComplete: () => s.destroy(),
      });
    }
  }

  /** Level-up VFX: an expanding gold ring on the player + a brief "LEVEL N" toast. */
  private spawnLevelUp(x: number, y: number): void {
    const ring = this.add.circle(x, y, 24).setStrokeStyle(5, 0xffd479, 0.95).setDepth(99997);
    this.tweens.add({
      targets: ring,
      scale: 4,
      alpha: 0,
      duration: 520,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spark = this.add.circle(x, y, 4, 0xffe9a8).setDepth(99999);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(a) * 70,
        y: y + Math.sin(a) * 70 - 20,
        alpha: 0,
        duration: 480,
        ease: "Quad.easeOut",
        onComplete: () => spark.destroy(),
      });
    }
    const cam = this.cameras.main;
    const toast = this.add
      .text(this.screenW() / 2, this.screenH() / 2 - 120, "LEVEL UP!", {
        fontSize: "30px",
        color: "#ffd479",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100003);
    this.tweens.add({
      targets: toast,
      y: this.screenH() / 2 - 150,
      alpha: 0,
      duration: 900,
      ease: "Cubic.easeOut",
      onComplete: () => toast.destroy(),
    });
    cam.shake(120, 0.004);
  }

  /** HP bar + downed overlay, repositioned each frame against the live viewport size. */
  private updateHud(): void {
    const selfId = this.room?.sessionId;
    const self = selfId ? this.room?.state.players.get(selfId) : undefined;

    // §28 4K-widescreen UI: grow the whole HUD on big viewports (only re-sizing elements when the scale
    // actually changes — a resize — to keep the per-frame path cheap).
    const s = this.uiScale();
    if (s !== this.hudScale) {
      this.hudScale = s;
      this.applyHudScale(s);
    }

    const barX = 20 * s;
    const barY = this.screenH() - 24 * s;
    const xpY = barY - 15 * s;
    this.hpBarBg.setPosition(barX, barY);
    this.hpBarFill.setPosition(barX + 2 * s, barY);
    this.hpText.setPosition(barX + 8 * s, barY);

    const hp = self ? Math.max(0, self.hp) : 0;
    const maxHp = self ? self.maxHp : 100;
    const ratio = maxHp > 0 ? hp / maxHp : 0;
    this.hpBarFill.width = 236 * s * ratio;
    // Green → amber → red as it drains.
    this.hpBarFill.fillColor = ratio > 0.5 ? 0x9cff3b : ratio > 0.25 ? 0xff8a2b : 0xff5d5d;
    this.hpText.setText(`${Math.ceil(hp)} / ${maxHp}`);

    // XP bar + level badge (§12).
    this.xpBarBg.setPosition(barX, xpY);
    this.xpBarFill.setPosition(barX + 2 * s, xpY);
    const xpRatio = self && self.xpToNext > 0 ? Math.min(1, self.xp / self.xpToNext) : 0;
    this.xpBarFill.width = 236 * s * xpRatio;
    this.levelText
      .setPosition(barX, xpY - 9 * s)
      .setText(
        self
          ? `Lv ${self.level}   STR ${self.str} · DEX ${self.dex} · INT ${self.int} · CON ${self.con} · LUK ${self.luk}`
          : "",
      );

    this.restartBtn.setPosition(this.screenW() - 14 * s, 14 * s);
    // Weapon name + an ammo readout: filled/empty pips for small mags (thrown/revolver), a numeric
    // "loaded/mag" for big-magazine guns (gatling/nailgun), or "reloading…" while empty.
    let charges = "";
    if (self && self.maxCharges > 0) {
      if (self.charges <= 0) charges = "   ⟳ reloading…";
      else if (self.maxCharges > 10) charges = `   ▮ ${self.charges}/${self.maxCharges}`;
      else
        charges = `   ${"◆".repeat(self.charges)}${"◇".repeat(Math.max(0, self.maxCharges - self.charges))}`;
    }
    this.weaponText
      .setPosition(barX, xpY - 24 * s)
      .setText(
        self ? `⚔ ${WEAPONS[self.weapon]?.name ?? self.weapon}${charges}   ·   Q to cycle` : "",
      );
    // Ammo-state colour so you reload proactively: red while reloading, amber on the last ~25%, else green.
    if (self && self.maxCharges > 0) {
      const lowAt = Math.max(1, Math.ceil(self.maxCharges * 0.25));
      this.weaponText.setColor(
        self.charges <= 0 ? "#ff5d5d" : self.charges <= lowAt ? "#ff8a2b" : "#9cff3b",
      );
    } else {
      this.weaponText.setColor("#9cff3b");
    }

    // §8 owned parry augments — a compact "name ×count" summary above the weapon readout.
    if (self?.augments) {
      const counts = new Map<string, number>();
      for (const a of self.augments.split(",").filter(Boolean))
        counts.set(a, (counts.get(a) ?? 0) + 1);
      const parts = [...counts].map(([id, n]) => {
        const name = AUGMENTS[id]?.name ?? id;
        return n > 1 ? `${name} ×${n}` : name;
      });
      this.augmentText
        .setPosition(barX, xpY - 42 * s)
        .setText(`✦ ${parts.join(" · ")}`)
        .setVisible(true);
    } else {
      this.augmentText.setVisible(false);
    }

    const training = this.room?.state.mode === "training";
    const who = self ? ` · C: swap character (${characterName(self.character)})` : "";
    const dimName = getDimension(this.room?.state.dimensionId).name;
    // M19 §6 greed loop: surface the time-gated objective from the synced clock — a boss countdown, then the
    // fight, then what stepping into the portal actually DOES (bank + end). H9: the two core verbs (RMB fire,
    // LMB parry) ride on the always-on line so there's a path to learning the controls.
    const st = this.room?.state;
    const elapsed = st?.elapsed ?? 0;
    const depth = st?.depth ?? 1;
    const bossActive = (st?.bossPhase ?? 0) >= 1;
    let objective: string;
    if (st?.portalOpen) {
      objective = "▼ bank & end · ⇓ rift: push deeper";
    } else if (bossActive) {
      objective = "⚠ BOSS — defeat it to open the gates";
    } else {
      const left = Math.max(0, bossSpawnAt(depth) - elapsed);
      const mmss = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}`;
      objective = `survive — boss in ${mmss}`;
    }
    // §6 chain HUD: depth + the carried (at-risk) vs banked salvage — the stakes of the greed decision.
    let carried = 0;
    st?.players.forEach((p) => {
      carried += p.salvaged;
    });
    const stakes = `⛏ ${carried} carried · ${st?.bankedSalvage ?? 0} banked`;
    this.modeText
      .setPosition(this.screenW() / 2, 12 * s)
      .setText(
        training
          ? `⛶ TESTING GROUNDS — Tab: summon monsters · R: grab weapon (hold: salvage) · Space: jump · T to exit${who}`
          : `${dimName} · depth ${depth} · ${objective} · ${stakes} · RMB fire · LMB parry${who}`,
      )
      .setColor(training ? "#33e6ff" : "#5a6472");

    // §6 rez-or-dead: a downed player waits for a rez (no respawn); a full wipe ends the run.
    const downed = !!self && !self.alive;
    this.deathText.setVisible(downed);
    if (downed) {
      const wiped = this.room?.state.outcome === "defeat";
      this.deathText
        .setText(
          wiped
            ? "DEFEATED — the squad is down\n(click Restart Run, top-right)"
            : "DOWNED — a squadmate with a rez weapon\n(Gravedigger's Spade) can revive you",
        )
        .setColor(wiped ? "#ff5d5d" : "#ffd479")
        .setPosition(this.screenW() / 2, this.screenH() / 2);
    }
  }

  /** §9 card carousel: one full infographic card per arsenal weapon (art + stats), fanned at the
   *  bottom; the held card is centered, upright, enlarged + readable. */
  private buildCarousel(): void {
    for (const id of WEAPON_IDS) this.carousel.push(buildCard(this, id));
  }

  /** §9/§13 draw the drop/salvage HOLD bar while R is held — a bar above the card carousel filling
   *  0→1 over SALVAGE_HOLD_SECONDS. Release before full = DROP the weapon; hold to full = SALVAGE it. */
  private updateDropBar(canDrop: boolean): void {
    const bar = this.dropBar;
    const label = this.dropBarLabel;
    if (!bar || !label) return;
    const holding = canDrop && this.keys.R.isDown && this.rHold > 0.02;
    if (!holding) {
      bar.setVisible(false);
      label.setVisible(false);
      return;
    }
    const frac = Math.min(1, this.rHold / SALVAGE_HOLD_SECONDS);
    const w = 180;
    const h = 12;
    const x = this.screenW() / 2 - w / 2;
    const y = this.screenH() - 132;
    const done = frac >= 1;
    bar.clear();
    bar.fillStyle(0x000000, 0.55).fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 5);
    bar.fillStyle(0x2a2a2a, 1).fillRoundedRect(x, y, w, h, 4);
    bar.fillStyle(done ? 0xff5a4a : 0xffb24a, 1).fillRoundedRect(x, y, w * frac, h, 4);
    bar.setVisible(true);
    label
      .setText(done ? "SALVAGED" : "hold: SALVAGE · release: DROP")
      .setColor(done ? "#ff8a5a" : "#ffe7a8")
      .setPosition(this.screenW() / 2, y - 12)
      .setVisible(true);
  }

  /** Fan the hand at the bottom: held card centered/upright/big with live charges; others smaller,
   *  rotated, fanned to the sides (prev left / next right, §9). */
  private updateCarousel(): void {
    if (!this.room || this.carousel.length === 0) return;
    const self = this.room.state.players.get(this.room.sessionId);
    const ids = WEAPON_IDS;
    const n = ids.length;
    const si = Math.max(0, ids.indexOf(self?.weapon ?? ids[0] ?? ""));
    const cx = this.screenW() / 2;
    const selY = this.screenH() - 170;
    const arcR = 700;
    const step = 0.26;
    for (const card of this.carousel) {
      let off = ids.indexOf(card.id) - si;
      if (off > n / 2) off -= n;
      if (off < -n / 2) off += n;
      const isSel = off === 0;
      const ang = off * step;
      card.container.setPosition(
        cx + Math.sin(ang) * arcR,
        selY + arcR * (1 - Math.cos(ang)) - (isSel ? 24 : 0),
      );
      card.container.setRotation(isSel ? 0 : ang);
      card.container.setScale(isSel ? 1.0 : 0.62);
      card.container.setAlpha(isSel ? 1 : 0.82);
      card.container.setDepth(100000 + (isSel ? 100 : 30 - Math.abs(off)));

      const def = WEAPONS[card.id];
      const attrs: Record<Attr, number> = {
        str: self?.str ?? 1,
        dex: self?.dex ?? 1,
        int: self?.int ?? 1,
        con: self?.con ?? 1,
        luk: self?.luk ?? 1,
      };
      // Show REAL (sub-integer) damage so every stat point visibly moves the number (§12). Each §14
      // source scales off ITS OWN grades — so pumping INT grows Wyrmtooth's magma but not its blade.
      const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
      // §11 unmet requirements PENALISE every source's damage (the enforcement rule) — fold it into the
      // shown total so the card is WYSIWYG, and tint the equation amber when the weapon is under-statted.
      const pen = def ? requirementPenalty(def, attrs) : 1;
      for (const s of card.sources) {
        const mult = damageMultFromGrades(s.src.grades, attrs) * pen;
        const total = s.src.base * mult;
        s.text.setText(`${fmt(s.src.base)} + ${fmt(total - s.src.base)} = ${fmt(total)}`);
        s.text.setColor(pen < 1 ? "#ffb24a" : "#ffd479");
      }
      // Requirements: green when met by the player's live attributes, red when unmet.
      for (const tk of card.reqTokens) {
        tk.text.setColor((attrs[tk.attr] ?? 1) >= tk.need ? "#9cff3b" : "#ff5a4a");
      }
      // Resource value (the icon conveys charges-vs-durability): live charges, or the durability number.
      if (def?.thrown) {
        const cur = isSel && self ? self.charges : def.thrown.charges;
        card.resource.setText(`${cur} / ${def.thrown.charges}`);
      } else if (def?.durability) {
        card.resource.setText(String(def.durability));
      } else {
        card.resource.setText("");
      }
    }
  }

  /** Chain-lightning VFX (§10 on-hit proc, §14 client-predicted): a jagged teal bolt from the weapon
   *  through the struck enemy and on to the nearest unhit enemies — mirroring the server's chain so the
   *  visual matches the damage. Cosmetic only; the server (`weapon.chainLightning`) owns all damage. */
  private spawnChain(
    sx: number,
    sy: number,
    aim: { x: number; y: number },
    weapon: WeaponDef,
  ): void {
    const cl = weapon.chainLightning;
    if (!cl || !this.room) return;
    const vfx = cl.vfx ?? { color: 0.5, jag: 0.3, life: 180 };
    const VR = (globalThis as { VFXRENDER?: { lerpHue?: (h: number) => number } }).VFXRENDER;
    const col = VR?.lerpHue ? VR.lerpHue(vfx.color) : 0x6fd6ff; // 0.5 → teal (sword accent)
    const enemies = this.room.state.enemies;
    const posOf = (id: string, ex: number, ey: number) => {
      const rig = this.enemies.get(id); // smoothed render position if present
      return { x: rig?.x ?? ex, y: rig?.y ?? ey };
    };
    // Build candidates + find the SEED (nearest arc-hit enemy); mark every arc-hit so the chain leaps to
    // OTHERS. Target selection uses the SAME shared `selectChainTargets` the server runs (no divergence).
    const candidates: ChainCandidate[] = [];
    const used = new Set<string>();
    let seedX = sx;
    let seedY = sy;
    let seedFound = false;
    let seedBestD = Infinity;
    enemies.forEach((e, id) => {
      const p = posOf(id, e.x, e.y);
      candidates.push({ id, x: p.x, y: p.y });
      if (inMeleeArc({ x: sx, y: sy }, aim.x, aim.y, p, weapon.range, weapon.halfArc)) {
        used.add(id);
        const d = (p.x - sx) ** 2 + (p.y - sy) ** 2;
        if (d < seedBestD) {
          seedBestD = d;
          seedX = p.x;
          seedY = p.y;
          seedFound = true;
        }
      }
    });
    if (!seedFound) return; // nothing struck → no chain bolt (the swing's own electric layer still plays)

    const links = selectChainTargets(
      { x: seedX, y: seedY },
      candidates,
      cl.jumps,
      Math.min(cl.range, CHAIN_MAX_RANGE),
      used,
    );

    // weapon → struck target → each chain link. Re-jagged every frame = a crackling bolt; bloom glows it.
    const nodes = [
      { x: sx, y: sy },
      { x: seedX, y: seedY },
      ...links.map((l) => ({ x: l.x, y: l.y })),
    ];
    const g = this.add.graphics();
    this.vfxPlayer.bloomRoot.add(g);
    const t0 = this.time.now;
    this.tweens.addCounter({
      from: 1,
      to: 0,
      duration: vfx.life,
      onUpdate: (tw) => {
        const a = tw.getValue() ?? 0;
        const flick = 0.55 + 0.45 * Math.sin((this.time.now - t0) * 0.09);
        g.clear();
        for (let i = 0; i < nodes.length - 1; i++) {
          const a0 = nodes[i];
          const b0 = nodes[i + 1];
          if (!a0 || !b0) continue;
          const pts = boltPoints(a0.x, a0.y, b0.x, b0.y, vfx.jag);
          g.lineStyle(3, col, a * flick);
          strokeBolt(g, pts);
          g.lineStyle(1, 0xffffff, a * flick * 0.9); // hot white core
          strokeBolt(g, pts);
        }
      },
      onComplete: () => g.destroy(),
    });
  }

  /** Melee swing VFX (§14, CODE-8): play the weapon's AUTHORED suite (painted hero + engine layers) via
   *  the shared renderer at the strike point, oriented to aim. Un-authored weapons get a default slash.
   *  The effect sits at ~60% of the swing reach so the arc reads where the weapon connects. */
  private spawnSlash(
    x: number,
    y: number,
    aim: { x: number; y: number },
    weapon: WeaponDef,
    exact = false,
  ): void {
    const ang = Math.atan2(aim.y, aim.x);
    // §14 `exact` (cursor-spawn) places the VFX right at (x,y); otherwise it sits ~60% along the swing reach.
    const reach = exact ? 0 : (weapon.range ?? 100) * 0.6;
    const sx = x + Math.cos(ang) * reach;
    const sy = y + Math.sin(ang) * reach;
    // SIZE: the weapon's authored fixed vfxRadius (resolved in VfxPlayer); this is only the fallback for
    // weapons with no baked VFX entry. Fixed per §14 — never derived from range/level/stat.
    this.vfxPlayer.playSwing(weapon.id, sx, sy, ang, VFX_RADIUS_DEFAULT);
  }

  /** Live on-screen readout so the game loop's health is visible without a dev console. */
  private updateDebug(): void {
    if (!this.debugEl) return;
    const players = this.room ? this.room.state.players.size : 0;
    const enemies = this.room ? this.room.state.enemies.size : 0;
    const elapsed = this.room ? Math.floor(this.room.state.elapsed) : 0;
    const fps = Math.round(this.game.loop.actualFps);
    this.debugEl.textContent = `run ${elapsed}s · fps ${fps} · players ${players} · enemies ${enemies} · mouseMoves ${this.pointerMoves}`;
  }

  private sendInput(): void {
    const dx = (this.keys.D.isDown ? 1 : 0) - (this.keys.A.isDown ? 1 : 0);
    const dy = (this.keys.S.isDown ? 1 : 0) - (this.keys.W.isDown ? 1 : 0);
    // Send only on change — the server holds the last input until told otherwise.
    if (dx !== this.lastSent.dx || dy !== this.lastSent.dy) {
      this.room?.send("input", { dx, dy });
      this.lastSent = { dx, dy };
    }
  }
}
