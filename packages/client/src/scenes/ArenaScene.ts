import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type ArenaMap,
  type ArenaState,
  type Attr,
  CHAIN_MAX_RANGE,
  type ChainCandidate,
  characterName,
  characterScale,
  clampQuakeEpicenter,
  classifyPitRegions,
  type DamageSource,
  DEFAULT_PORT,
  DEFAULT_WEAPON,
  damageMultFromGrades,
  ENEMY_KINDS,
  EXTRACT_RADIUS,
  FISTS_WEAPON,
  generateArena,
  gunMuzzleReach,
  inMeleeArc,
  isPitAtPx,
  JUMP_AIRTIME,
  JUMP_HOP_HEIGHT,
  LEVELUP_WINDOW_SECONDS,
  MAP_SPAWN_CLEAR_TILES,
  makeRng,
  mixSeeds,
  PARRY_COOLDOWN,
  PICKUP_RADIUS,
  type PlayerState,
  QUAKE_REACH,
  ROOM_NAME,
  requirementPenalty,
  SALVAGE_HOLD_SECONDS,
  selectChainTargets,
  TILE_PIT,
  TOUGH_SCALE,
  VFX_RADIUS_DEFAULT,
  WEAPON_IDS,
  WEAPONS,
  type WeaponDef,
  weaponDamageSources,
} from "@dd/shared";
import { Client, type Room } from "colyseus.js";
import Phaser from "phaser";
import { SpriteRig } from "../entities/SpriteRig.js";
import { RENDER_DPR } from "../render-dpr.js";
import { CARD_ART_IDS } from "../sprites/card-manifest.js";
import { SPRITES } from "../sprites/manifest.js";
import { VfxPlayer } from "../vfx/VfxPlayer.js";
import { WEAPON_VFX } from "../vfx/weapon-vfx.generated.js";

/** Which sprite manifest the player renders as (§23: melee class, one character for M0). */
const PLAYER_SPRITE = "drifter";

/** Blend two 0xRRGGBB colours by `t` (0 = c1, 1 = c2). Used for the muzzle-flash hot inner streak. */
function blendHex(c1: number, c2: number, t: number): number {
  const r = Math.round(((c1 >> 16) & 0xff) * (1 - t) + ((c2 >> 16) & 0xff) * t);
  const g = Math.round(((c1 >> 8) & 0xff) * (1 - t) + ((c2 >> 8) & 0xff) * t);
  const b = Math.round((c1 & 0xff) * (1 - t) + (c2 & 0xff) * t);
  return (r << 16) | (g << 8) | b;
}

/** Jagged polyline between two WORLD points — the world-space twin of vfx-render's local arc-bolt jag.
 *  Walks along the segment, offsetting each interior node perpendicular by ±(segLen × jag). */
function boltPoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  jag: number,
): Array<{ x: number; y: number }> {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len; // perpendicular unit
  const py = dx / len;
  const steps = Math.max(4, (len / 22) | 0); // ~22px segments
  const pts: Array<{ x: number; y: number }> = [{ x: x0, y: y0 }];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const off = (Math.random() - 0.5) * len * jag * 0.4;
    pts.push({ x: x0 + dx * t + px * off, y: y0 + dy * t + py * off });
  }
  pts.push({ x: x1, y: y1 });
  return pts;
}
function strokeBolt(g: Phaser.GameObjects.Graphics, pts: Array<{ x: number; y: number }>): void {
  if (pts.length === 0) return;
  g.beginPath();
  let started = false;
  for (const p of pts) {
    if (started) g.lineTo(p.x, p.y);
    else {
      g.moveTo(p.x, p.y);
      started = true;
    }
  }
  g.strokePath();
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
  private readonly prevPos = new Map<string, { x: number; y: number }>();
  private readonly enemyPrev = new Map<string, { x: number; y: number }>();
  private keys!: Record<
    "W" | "A" | "S" | "D" | "R" | "Q" | "T" | "B" | "C" | "SPACE",
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
  private floorBuilt = false;
  /** §17 Codex tile textures (gen-tiles.mjs) that failed to load (absent on disk) — fall back to flat fill. */
  private readonly tilesMissing = new Set<string>();
  /** §17 last-seen `fellSeq` per player — fire the fall VFX (dust poof + a local red flash) when it ticks. */
  private readonly lastFell = new Map<string, number>();
  private weaponText!: Phaser.GameObjects.Text;
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
  private bannerShownFor = "";
  private prevBossPresent = false;
  // §12 level-up window (attribute allocation).
  private levelWinObjects: Phaser.GameObjects.GameObject[] = [];
  private levelWinKey = "";
  private levelWinTimerBar?: Phaser.GameObjects.Rectangle;
  private deathText!: Phaser.GameObjects.Text;
  private restartBtn!: Phaser.GameObjects.Text;
  // §9/§13 drop & salvage (R): tap = drop the held weapon, HOLD = salvage it. `rHold` = seconds R has
  // been down; `rSalvaged` guards the one-shot salvage so a long hold doesn't fire it every frame.
  private rHold = 0;
  private rSalvaged = false;
  private dropBar?: Phaser.GameObjects.Graphics;
  private dropBarLabel?: Phaser.GameObjects.Text;
  // §9 card carousel — held card big with full stats. Each card holds its LIVE elements (one equation
  // line per §14 damage source, the requirement tokens, the charges/durability readout), recomputed
  // from the player's current attributes every frame so the numbers track levelling.
  private carousel: {
    id: string;
    container: Phaser.GameObjects.Container;
    /** One live "base + bonus = total" line per damage source (blade / magma / quake / …). */
    sources: { text: Phaser.GameObjects.Text; src: DamageSource }[];
    /** Min-requirement tokens, recoloured green/red vs the player's live attributes. */
    reqTokens: { text: Phaser.GameObjects.Text; attr: Attr; need: number }[];
    /** Charges (thrown, live) or durability (melee, static for now) readout. */
    resource: Phaser.GameObjects.Text;
  }[] = [];
  /** Per-weapon accent colour for card frames (rarity tinting lands with the loot system). */
  private static readonly WEAPON_ACCENT: Record<string, number> = {
    "rusty-cleaver": 0xff8a2b,
    "tombstone-greatsword": 0x9cff3b,
    "twin-bowie-fangs": 0x6fd6ff,
    driftblade: 0x6f8bff,
    "x-sword-neon-katana": 0x5dcaa5,
    "x-sword-bone": 0xff7a3c,
    "x-gun-revolver-cannon": 0xffb24a,
    "x-gun-coffin-shotgun": 0xff8a3c,
    "x-gun-gatling": 0xfff0a0,
    "x-gun-nailgun": 0xd6dde6,
    "x-gun-ricochet-pistol": 0x5dd6ff,
  };
  /** §9 per-bullet-kind visual config — colour + muzzle-flash size + trail style. Each gun's `bulletKind`
   *  (server-synced on `ProjectileState.kind`) keys this, so each gun looks distinct without extra sync. */
  private static readonly GUN_FX: Record<
    string,
    { color: number; size: number; style: string; trail: number; trailW: number }
  > = {
    slug: { color: 0xffb24a, size: 23, style: "heavy", trail: 26, trailW: 9 }, // revolver: fat hot slug
    pellet: { color: 0xff6a2a, size: 19, style: "boom", trail: 16, trailW: 6 }, // shotgun: red-hot buckshot
    tracer: { color: 0xfff0a0, size: 13, style: "rapid", trail: 44, trailW: 5 }, // gatling: pale tracer streak
    nail: { color: 0xd6dde6, size: 14, style: "punch", trail: 26, trailW: 3 }, // nailgun: metallic dart
    ricochet: { color: 0x5dd6ff, size: 16, style: "spark", trail: 20, trailW: 6 }, // pistol: cyan electric
  };
  private readonly debugEl = document.getElementById("debug");

  constructor() {
    super("arena");
  }

  /** Load every installed sprite's harvest-sliced parts (served from public/sprites/<id>/). */
  preload(): void {
    for (const manifest of Object.values(SPRITES)) {
      for (const part of manifest.parts) {
        this.load.image(`${manifest.id}:${part.role}`, `sprites/${manifest.id}/${part.file}`);
      }
    }
    // Weapon VFX hero skins (§14 Codex art, authored in the Weaponsmith). Game-res, pre-sized.
    this.load.image("vfx-quake-tombstone", "vfx/quake-tombstone.png");
    // Weapon card art (§14 two-pass / §28.5) for the §9 carousel — ONLY ids with bespoke art on disk
    // (CARD_ART_IDS, regenerated by gen-card-manifest). Others fall back to the sprite/icon card, so we
    // never queue 404s that flood the console and bury real errors.
    for (const id of CARD_ART_IDS) this.load.image(`card-${id}`, `cards/${id}.png`);
    // Authored per-weapon VFX assets — painted hero skins + scatter sheets (§14 CODE-8).
    VfxPlayer.preloadAssets(this);
    // §17 Codex SEAMLESS terrain tiles (tools/artkit/gen-tiles.mjs). Optional — if a file is absent the
    // dev server returns index.html, which fails to decode; `loaderror` flags it so the floor falls back
    // to the flat fill instead of TileSpriting a broken stub.
    this.load.image("tile-ground", "tiles/ground.jpg");
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      if (file.key.startsWith("tile-")) this.tilesMissing.add(file.key);
    });
  }

  /** §17 a Codex tile texture is usable only if it loaded AND isn't a missing-file stub. */
  private hasTile(key: string): boolean {
    if (this.tilesMissing.has(key) || !this.textures.exists(key)) return false;
    const w = this.textures.get(key).getSourceImage()?.width ?? 0;
    return w > 8;
  }

  create(): void {
    this.drawArena();
    this.vfxPlayer = new VfxPlayer(this);

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Keyboard input unavailable");
    this.keys = keyboard.addKeys("W,A,S,D,R,Q,T,B,C,SPACE") as Record<
      "W" | "A" | "S" | "D" | "R" | "Q" | "T" | "B" | "C" | "SPACE",
      Phaser.Input.Keyboard.Key
    >;
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

    // Victory banner (§16) — shown once a player extracts.
    // §6: no "win" screen — extraction BANKS your salvage and ends this run; the greed loop is
    // "bank now vs push deeper." (Deeper-dimension continue + real salvage land with §13.)
    this.victoryText = this.add
      .text(0, 0, "EXTRACTED ✦ salvage banked\n(press R for another run)", {
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
      const accent = ArenaScene.WEAPON_ACCENT[pk.weapon] ?? 0xffd479;
      const accentHex = `#${accent.toString(16).padStart(6, "0")}`;
      const baseScale = part ? 72 / part.w : 1;

      const beam = this.add.rectangle(0, -10, 34, 104, accent, 0.08).setBlendMode(ADD); // pedestal light
      const halo = this.add.ellipse(0, 30, 100, 34, accent, 0.22).setBlendMode(ADD); // ground glow
      const glow = this.add.ellipse(0, 0, 78, 78, accent, 0.32).setBlendMode(ADD);
      const img = part
        ? this.add.image(0, 0, `${pk.weapon}:${part.role}`).setScale(baseScale)
        : this.add.rectangle(0, 0, 50, 12, accent);
      const shine = part
        ? this.add
            .image(0, 0, `${pk.weapon}:${part.role}`)
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
      const manifest = SPRITES[player.weapon as keyof typeof SPRITES];
      if (def && manifest) {
        rig.equipWeapon(player.weapon, def, manifest);
        this.equipped.set(id, player.weapon);
      } else if (def) {
        rig.unequip(def); // §9 fists / any weapon with no held sprite → empty hands
        this.equipped.set(id, player.weapon);
      }
    });
  }

  /**
   * Wild West arena (§17 "one big themed room", §28.7 West palette: dusty tan/rust/olive on
   * charcoal). Dust-mesa ground + seeded scatter of rocks/scrub/cacti for visual texture and
   * spatial reference. The scatter is decorative for now; server-seeded procedural arenas with
   * collidable obstacles/POIs come later (§17/§4) — this fixed client seed is a placeholder.
   */
  private drawArena(): void {
    const cx = ARENA_WIDTH / 2;
    const cy = ARENA_HEIGHT / 2;
    // Base ground bed + low-contrast grid (map-independent). The §17 procedural PITS, the rim telegraph,
    // the spawn safe-ring + seeded decor are baked in `buildArenaFloor` once the server's map seeds sync.
    // The whole floor stack lives at NEGATIVE depths so it always renders behind the entities (which use
    // depth = world Y, ≥ 0). Stack, back→front: bed(-20) · grid(-19) · dust(-16) · litter(-15) · pits+rim
    // (-14, so the telegraph stays visible over litter) · rail(-12).
    this.add.rectangle(cx, cy, ARENA_WIDTH, ARENA_HEIGHT, 0x2a2620).setDepth(-20);
    if (this.hasTile("tile-ground")) {
      // §17 PAINTED ground — a SEAMLESS Codex dust tile (gen-tiles.mjs), GPU-tiled across the arena PLUS a
      // wide margin so 4K/ultrawide viewports always show ground, never the void. One draw, scrolls free.
      const margin = 3200;
      const ts = this.add
        .tileSprite(cx, cy, ARENA_WIDTH + margin * 2, ARENA_HEIGHT + margin * 2, "tile-ground")
        .setDepth(-19);
      ts.tileScaleX = 0.5;
      ts.tileScaleY = 0.5;
    } else {
      // Fallback (no tile art installed yet): the low-contrast earthy grid.
      this.add
        .grid(cx, cy, ARENA_WIDTH, ARENA_HEIGHT, 128, 128, 0x2a2620, 1, 0x342d22, 0.5)
        .setDepth(-19);
    }
    // Arena boundary — a rusted rail (marks the playable bound; the ground extends past it on big screens).
    this.add.rectangle(cx, cy, ARENA_WIDTH, ARENA_HEIGHT).setStrokeStyle(6, 0xa8482e).setDepth(-12);
  }

  /** §17 once the server's seeds arrive, regenerate the IDENTICAL map client-side + bake the floor once. */
  private maybeBuildFloor(): void {
    if (this.floorBuilt || !this.room) return;
    const s = this.room.state;
    if (!s.seedTerrain) return; // seeds not synced yet (0 = "no map")
    this.arenaMap = generateArena({
      seedTerrain: s.seedTerrain,
      seedHazard: s.seedHazard,
      seedTheme: s.seedTheme,
      seedDecor: s.seedDecor,
    });
    this.buildArenaFloor(this.arenaMap);
    this.floorBuilt = true;
  }

  /**
   * §17 "Dust & The Drop" floor bake (the panel-winning look): warm-black PIT voids, a rust band + hot
   * amber lip on every pit edge with inward CHEVRON teeth on the wide (go-around) runs and a clean solid
   * lip on the narrow (hoppable) gaps, and a cyan SPAWN safe-ring. All static geometry in ONE Graphics
   * (drawn once, scrolled by the camera for free) at a low depth under the entities.
   */
  private buildArenaFloor(map: ArenaMap): void {
    const T = map.tileSize;
    const cls = classifyPitRegions(map);
    const ground = (gx: number, gy: number): boolean =>
      gx >= 0 &&
      gy >= 0 &&
      gx < map.cols &&
      gy < map.rows &&
      map.tiles[gy * map.cols + gx] !== TILE_PIT;

    // PIT FILL — the warm-black void (the §17 "absence" read). The painted GROUND tile fills the floor;
    // pits stay a clean flat void — it reads better than a busy texture, and a near-black pit tile is
    // visually indistinguishable from this anyway.
    const g = this.add.graphics().setDepth(-14); // pit void + rim + spawn, above the ground + the litter
    g.fillStyle(0x0d0a10, 1);
    for (let y = 0; y < map.rows; y++)
      for (let x = 0; x < map.cols; x++)
        if (map.tiles[y * map.cols + x] === TILE_PIT) g.fillRect(x * T, y * T, T, T);

    // Pit-edge segments (a pit-cell side bordering ground) + whether the run is hoppable.
    const seg: Array<{
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      nx: number;
      ny: number;
      hop: boolean;
    }> = [];
    for (let y = 0; y < map.rows; y++)
      for (let x = 0; x < map.cols; x++) {
        if (map.tiles[y * map.cols + x] !== TILE_PIT) continue;
        const hop = cls.hoppable[cls.regionOf[y * map.cols + x] ?? -1] ?? false;
        const ox = x * T;
        const oy = y * T;
        if (ground(x, y - 1)) seg.push({ x1: ox, y1: oy, x2: ox + T, y2: oy, nx: 0, ny: 1, hop });
        if (ground(x, y + 1))
          seg.push({ x1: ox, y1: oy + T, x2: ox + T, y2: oy + T, nx: 0, ny: -1, hop });
        if (ground(x - 1, y)) seg.push({ x1: ox, y1: oy, x2: ox, y2: oy + T, nx: 1, ny: 0, hop });
        if (ground(x + 1, y))
          seg.push({ x1: ox + T, y1: oy, x2: ox + T, y2: oy + T, nx: -1, ny: 0, hop });
      }
    // Rust band (under) then hot amber lip (over) — opaque + static, so it reads as TERRAIN under the neon.
    g.lineStyle(T * 0.11, 0xa8482e, 1);
    for (const s of seg) g.lineBetween(s.x1, s.y1, s.x2, s.y2);
    g.lineStyle(T * 0.045, 0xf0a73c, 1);
    for (const s of seg) g.lineBetween(s.x1, s.y1, s.x2, s.y2);
    // Inward chevron teeth on the wide runs ("go around"); narrow gaps keep the clean lip ("hop me").
    g.fillStyle(0xf0a73c, 1);
    for (const s of seg) {
      if (s.hop) continue;
      const mx = (s.x1 + s.x2) / 2;
      const my = (s.y1 + s.y2) / 2;
      const ex = -s.ny; // edge direction (perpendicular to the inward normal)
      const ey = s.nx;
      g.fillTriangle(
        mx + s.nx * T * 0.2,
        my + s.ny * T * 0.2,
        mx + ex * T * 0.1,
        my + ey * T * 0.1,
        mx - ex * T * 0.1,
        my - ey * T * 0.1,
      );
    }
    // Cyan SPAWN safe-ring (cool = safe — the opposite semaphore to the hot pit lip).
    const sr = MAP_SPAWN_CLEAR_TILES * T;
    g.fillStyle(0x33e6ff, 0.06);
    g.fillCircle(map.spawnX, map.spawnY, sr);
    g.lineStyle(3, 0x33e6ff, 0.85);
    g.strokeCircle(map.spawnX, map.spawnY, sr);

    this.scatterDecor(map);
  }

  /** Seeded ground litter (dust drifts + rocks/scrub), kept OFF the pits. Seeded from the map so every
   *  client dresses the floor identically. Low depth — players + enemies render over it. */
  private scatterDecor(map: ArenaMap): void {
    const rng = makeRng(mixSeeds(map.seeds.seedDecor, 0xdec0));
    const between = (a: number, b: number): number => a + rng.next() * (b - a);
    for (let i = 0; i < 40; i++) {
      // Draw the full RNG sequence first (fixed cadence → deterministic across clients), THEN decide.
      const dx = rng.next() * ARENA_WIDTH;
      const dy = rng.next() * ARENA_HEIGHT;
      const w = between(160, 360);
      const h = between(110, 240);
      const a = between(0.03, 0.07);
      if (isPitAtPx(map, dx, dy)) continue; // keep the haze centre off the void (matches "kept OFF the pits")
      this.add.ellipse(dx, dy, w, h, 0xc49a5a).setAlpha(a).setDepth(-16);
    }
    for (let i = 0; i < 90; i++) {
      const x = between(60, ARENA_WIDTH - 60);
      const y = between(60, ARENA_HEIGHT - 60);
      if (isPitAtPx(map, x, y)) continue; // no litter floating in a pit
      if (rng.next() < 0.4) {
        const r = between(10, 20);
        this.add
          .ellipse(x, y, r * 1.4, r * 2.1, 0x6e7042)
          .setStrokeStyle(3, 0x22251b)
          .setDepth(-15);
      } else {
        const r = between(12, 30);
        this.add
          .ellipse(x, y + r * 0.4, r * 1.7, r * 0.7, 0x1f1c17)
          .setAlpha(0.5)
          .setDepth(-15);
        this.add
          .ellipse(x, y, r * 1.5, r, rng.next() < 0.5 ? 0x3a4049 : 0x5a6472)
          .setStrokeStyle(3, 0x22252b)
          .setDepth(-15);
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
      this.spawnPoof(player.x, player.y);
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
        this.room = await client.joinOrCreate<ArenaState>(ROOM_NAME);
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
    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) this.room?.send("cycleWeapon");
    if (Phaser.Input.Keyboard.JustDown(this.keys.T)) this.room?.send("toggleTraining");
    if (Phaser.Input.Keyboard.JustDown(this.keys.B)) this.room?.send("spawnBoss");
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
    }
    this.followSelf();
    this.sendAttack();
    this.sendParry();
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
        const rig = new SpriteRig(this, enemy.x, enemy.y, false, id, kind?.sprite ?? enemy.kind);
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
        // Enemy gone from authoritative state → it died (or left view): puff + clean up.
        const rig = this.enemies.get(id);
        if (rig) this.spawnPoof(rig.x, rig.y);
        rig?.destroy();
        this.enemies.delete(id);
        this.enemyPrev.delete(id);
        this.enemyHp.delete(id);
        this.enemyAtk.delete(id);
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
      rig.setDepth(rig.y);
    }
  }

  /** Reconcile rendered projectiles vs authoritative state; splat on removal (hit/expire). */
  private syncProjectiles(): void {
    if (!this.room) return;
    const state = this.room.state.projectiles;
    const flashedShooters = new Set<string>(); // one muzzle flash per shooter per frame (= per shot)
    state.forEach((pr, id) => {
      if (this.projectiles.has(id)) return;
      const fx = ArenaScene.GUN_FX[pr.kind];
      const container = fx
        ? this.makeBullet(pr)
        : pr.kind === "cleaver"
          ? this.makeThrownCleaver(pr)
          : pr.kind === "magma"
            ? this.makeMagma(pr)
            : this.makeSpit(pr);
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
            // Flash at the shooter's BARREL TIP (per-gun reach), matching where the server spawned the shot.
            const reach = gunMuzzleReach(WEAPONS[p.weapon] ?? WEAPONS[DEFAULT_WEAPON]);
            this.spawnMuzzleFlash(
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
          if (k === "magma" && er > 0) this.spawnExplosion(c.x, c.y, er);
          else if (ArenaScene.GUN_FX[k])
            this.spawnBulletImpact(c.x, c.y, k, (c.getData("ang") as number) ?? 0);
          else this.spawnSplat(c.x, c.y, k);
        }
        c?.destroy();
        this.projectiles.delete(id);
      }
    }
  }

  /** Enemy spit — full NEON so it reads as a THREAT against the olive scrub/dust (§28.7). */
  private makeSpit(pr: {
    x: number;
    y: number;
    vx: number;
    vy: number;
  }): Phaser.GameObjects.Container {
    const ang = Math.atan2(pr.vy, pr.vx);
    const trail = this.add
      .ellipse(-Math.cos(ang) * 14, -Math.sin(ang) * 14, 34, 9, 0x9bff2e, 0.35)
      .setRotation(ang);
    const glow = this.add.circle(0, 0, 12, 0x9bff2e, 0.5);
    const ring = this.add.circle(0, 0, 8).setStrokeStyle(2, 0xd6ff7a, 0.9);
    const core = this.add.circle(0, 0, 4.5, 0xf4ffd0);
    const c = this.add.container(pr.x, pr.y, [trail, glow, ring, core]).setDepth(99000);
    this.tweens.add({
      targets: glow,
      scale: 1.4,
      duration: 200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
    return c;
  }

  /** Thrown cleaver — the actual weapon sprite spinning through the air (§10 thrown delivery). */
  private makeThrownCleaver(pr: { x: number; y: number }): Phaser.GameObjects.Container {
    const part = SPRITES["rusty-cleaver"]?.parts[0];
    const blade = part
      ? this.add.image(0, 0, "rusty-cleaver:part-1").setScale(108 / part.w)
      : this.add.rectangle(0, 0, 80, 30, 0xcfc6ae);
    const glow = this.add.ellipse(0, 0, 76, 76, 0xffb23b, 0.18);
    return this.add.container(pr.x, pr.y, [glow, blade]).setDepth(99000);
  }

  /** Magma scatter ball (§14 WYSIWYG) — a real damaging projectile that explodes on impact, rendered
   *  with the AUTHORED PAINTED magma-ball art (a random frame of the scatter sheet) so the projectile you
   *  see IS the painted ball. A hot additive glow + motion-blur trail sell the molten flight; the ball
   *  tumbles. Falls back to a procedural ember only if the scatter texture isn't loaded. */
  private makeMagma(pr: {
    x: number;
    y: number;
    vx: number;
    vy: number;
  }): Phaser.GameObjects.Container {
    const ang = Math.atan2(pr.vy, pr.vx);
    const trail = this.add
      .ellipse(-Math.cos(ang) * 18, -Math.sin(ang) * 18, 46, 13, 0xff5a1e, 0.4)
      .setRotation(ang)
      .setBlendMode(Phaser.BlendModes.ADD);
    const glow = this.add.circle(0, 0, 17, 0xff6a22, 0.5).setBlendMode(Phaser.BlendModes.ADD);
    // The painted magma ball (the authored scatter art) — the real projectile rendered as its own art.
    const sc = WEAPON_VFX["x-sword-bone"]?.scatter;
    const key = sc ? `scatter:${sc.url}` : null;
    let ball: Phaser.GameObjects.GameObject;
    if (key && this.textures.exists(key)) {
      const frame = Math.floor(Math.random() * (sc?.count ?? 1));
      const img = this.add.image(0, 0, key, frame).setScale(36 / (sc?.frameWidth ?? 249));
      this.tweens.add({
        targets: img,
        angle: 360,
        duration: 900 + Math.random() * 500,
        repeat: -1,
        ease: "Linear",
      });
      ball = img;
    } else {
      ball = this.add.circle(0, 0, 7, 0xff8a2b); // fallback ember
    }
    const c = this.add.container(pr.x, pr.y, [trail, glow, ball]).setDepth(99000);
    this.tweens.add({
      targets: glow,
      scale: 1.4,
      alpha: 0.28,
      duration: 140,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
    return c;
  }

  /** Resolve a bullet-kind's visual config, with a safe default for any unmapped kind. */
  private gunFx(kind: string): {
    color: number;
    size: number;
    style: string;
    trail: number;
    trailW: number;
  } {
    return (
      ArenaScene.GUN_FX[kind] ?? { color: 0xffb24a, size: 20, style: "heavy", trail: 24, trailW: 7 }
    );
  }

  /** §9 GUN bullet — a distinct in-flight look per `bulletKind` (slug/pellet/tracer/nail/ricochet): a
   *  velocity-aligned additive trail + a hot core (or a metallic dart for nails, an electric ring for
   *  ricochets). Server-authoritative (the bullet you see is the bullet that hits, §14 WYSIWYG). */
  private makeBullet(pr: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    kind: string;
  }): Phaser.GameObjects.Container {
    const fx = this.gunFx(pr.kind);
    const ang = Math.atan2(pr.vy, pr.vx);
    const ADD = Phaser.BlendModes.ADD;
    const items: Phaser.GameObjects.GameObject[] = [];
    const trail = this.add
      .ellipse(
        -Math.cos(ang) * fx.trail * 0.5,
        -Math.sin(ang) * fx.trail * 0.5,
        fx.trail,
        fx.trailW,
        fx.color,
        0.5,
      )
      .setRotation(ang)
      .setBlendMode(ADD);
    items.push(trail);
    if (pr.kind === "nail") {
      // metallic dart — a thin steel rectangle aligned to flight + a white tip
      items.push(this.add.rectangle(0, 0, 18, 2.6, 0xeef2f6).setRotation(ang));
      items.push(this.add.circle(0, 0, 1.8, 0xffffff));
    } else if (pr.kind === "tracer") {
      // streak of light — a velocity-aligned hot capsule (reads opposite to the stubby pellet)
      items.push(this.add.rectangle(0, 0, 15, 3, fx.color).setRotation(ang).setBlendMode(ADD));
      items.push(this.add.circle(0, 0, 2, 0xffffff).setBlendMode(ADD));
    } else if (pr.kind === "pellet") {
      // buckshot — a small DENSE lead ball: dark rim under a tight hot core (reads heavy/stubby)
      items.push(this.add.circle(0, 0, 4, 0x140a06, 0.5));
      items.push(this.add.circle(0, 0, 3, blendHex(fx.color, 0x806040, 0.45)));
      items.push(this.add.circle(0, 0, 1.6, 0xffe6c4));
    } else {
      const big = pr.kind === "slug";
      items.push(this.add.circle(0, 0, big ? 9 : 6, fx.color, 0.5).setBlendMode(ADD));
      items.push(this.add.circle(0, 0, big ? 3.4 : 2.2, 0xffffff));
      if (pr.kind === "ricochet")
        items.push(this.add.circle(0, 0, 7).setStrokeStyle(1.5, fx.color, 0.9).setBlendMode(ADD));
    }
    return this.add.container(pr.x, pr.y, items).setDepth(99000);
  }

  /** §9 per-gun MUZZLE FLASH — the shaped 8-prong caged-fire star (the same geometry as the engine
   *  `drawMuzzleFlash`) drawn at the barrel, sized + tinted per gun, with a hot core + white centre, then
   *  faded out fast. Cheap (one Graphics + a tween) so it survives the gatling's fire rate. */
  private spawnMuzzleFlash(
    x: number,
    y: number,
    ang: number,
    size: number,
    color: number,
    style = "heavy",
  ): void {
    const hot = blendHex(color, 0xffffff, 0.55);
    const TAU = Math.PI * 2;
    const g = this.add.graphics().setDepth(99500).setBlendMode(Phaser.BlendModes.ADD);
    // "boom" (shotgun) splays the side prongs into a fat cone over a big soft blast disc; "punch" stays tight.
    if (style === "boom") g.fillStyle(color, 0.26).fillCircle(0, 0, size * 1.15);
    const side = style === "boom" ? 1.45 : 0.95;
    const prongs: [number, number, number][] = [
      [0, style === "punch" ? 2.9 : 2.5, 0.22],
      [-0.46, 1.6, 0.16],
      [0.46, 1.6, 0.16],
      [-side, 0.95, 0.12],
      [side, 0.95, 0.12],
      [Math.PI, 0.6, 0.12],
      [Math.PI - 0.7, 0.5, 0.1],
      [Math.PI + 0.7, 0.5, 0.1],
    ];
    for (const [a, lm, wm] of prongs) {
      const len = size * lm;
      const w = size * wm;
      const tx = Math.cos(a) * len;
      const ty = Math.sin(a) * len;
      const n = a + Math.PI / 2;
      g.fillStyle(color, 0.5);
      g.fillTriangle(Math.cos(n) * w, Math.sin(n) * w, -Math.cos(n) * w, -Math.sin(n) * w, tx, ty);
      g.fillStyle(hot, 0.55);
      g.fillTriangle(
        Math.cos(n) * w * 0.45,
        Math.sin(n) * w * 0.45,
        -Math.cos(n) * w * 0.45,
        -Math.sin(n) * w * 0.45,
        Math.cos(a) * len * 0.7,
        Math.sin(a) * len * 0.7,
      );
    }
    g.fillStyle(hot, 0.9).fillCircle(0, 0, size * 0.32);
    g.fillStyle(0xffffff, 0.95).fillCircle(0, 0, size * 0.17);
    // "spark" (ricochet) — a few thin electric streaks crackle out from the muzzle.
    if (style === "spark") {
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * TAU;
        const L = size * (0.8 + Math.random() * 0.9);
        g.lineStyle(1.4, color, 0.85);
        g.beginPath();
        g.moveTo(Math.cos(a) * size * 0.3, Math.sin(a) * size * 0.3);
        g.lineTo(Math.cos(a) * L, Math.sin(a) * L);
        g.strokePath();
      }
    }
    // "rapid" (gatling) — small per-shot rotation jitter so a held stream flickers instead of stacking.
    const jitter = style === "rapid" ? (Math.random() - 0.5) * 0.5 : 0;
    g.setPosition(x, y).setRotation(ang + jitter);
    // "heavy" (revolver) — a dark recoil-smoke puff drifts up-barrel under the flash.
    if (style === "heavy") {
      const smoke = this.add
        .circle(
          x + Math.cos(ang) * size * 0.5,
          y + Math.sin(ang) * size * 0.5,
          size * 0.5,
          0x2a2018,
          0.4,
        )
        .setDepth(99450);
      this.tweens.add({
        targets: smoke,
        scale: 2,
        alpha: 0,
        x: smoke.x + Math.cos(ang) * 16,
        y: smoke.y + Math.sin(ang) * 16 - 6,
        duration: 340,
        onComplete: () => smoke.destroy(),
      });
    }
    const grow = style === "boom" ? 1.55 : 1.3;
    this.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: grow,
      scaleY: grow,
      duration: style === "rapid" ? 70 : style === "boom" ? 135 : 105,
      ease: "Quad.out",
      onComplete: () => g.destroy(),
    });
  }

  /** §9 bullet IMPACT — a per-gun hit effect where a bullet died (hit / wall / max range): the slug
   *  THUMPS with a dust ring, buckshot is a cheap flash, nails STICK + ping, ricochets crackle cyan,
   *  tracers spark + scorch. `ang` = the bullet's travel angle (for oriented effects). */
  private spawnBulletImpact(x: number, y: number, kind: string, ang = 0): void {
    const fx = this.gunFx(kind);
    const ADD = Phaser.BlendModes.ADD;
    const flash = (r: number, sc: number, dur: number) => {
      const f = this.add.circle(x, y, r, 0xfff0d0, 0.9).setBlendMode(ADD).setDepth(99400);
      this.tweens.add({
        targets: f,
        scale: sc,
        alpha: 0,
        duration: dur,
        onComplete: () => f.destroy(),
      });
    };
    if (kind === "pellet") {
      flash(5, 1.8, 120); // cheap — a 7-pellet volley shouldn't spawn 35 objects
      return;
    }
    if (kind === "nail") {
      flash(5, 1.6, 110);
      const dart = this.add.rectangle(x, y, 9, 2, 0xd6dde6, 0.95).setRotation(ang).setDepth(98500);
      this.tweens.add({ targets: dart, alpha: 0, duration: 420, onComplete: () => dart.destroy() });
      return;
    }
    if (kind === "ricochet") {
      flash(6, 2, 130);
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = this.add
          .rectangle(x, y, 12, 1.6, 0x5dd6ff, 0.95)
          .setRotation(a)
          .setBlendMode(ADD)
          .setDepth(99400);
        this.tweens.add({
          targets: s,
          x: x + Math.cos(a) * 18,
          y: y + Math.sin(a) * 18,
          alpha: 0,
          duration: 150,
          onComplete: () => s.destroy(),
        });
      }
      return;
    }
    // slug (heavy thump + dust ring) and default (tracer): flash + radial sparks + lingering scorch.
    const heavy = kind === "slug";
    flash(heavy ? 9 : 7, heavy ? 2.8 : 2.1, 160);
    if (heavy) {
      const dust = this.add
        .circle(x, y, 5, 0x6b5a44, 0)
        .setStrokeStyle(2, 0x6b5a44, 0.5)
        .setDepth(98200);
      this.tweens.add({
        targets: dust,
        scale: 3,
        alpha: 0,
        duration: 280,
        onComplete: () => dust.destroy(),
      });
    }
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = this.add
        .rectangle(x, y, 11, 2, fx.color, 0.9)
        .setRotation(a)
        .setBlendMode(ADD)
        .setDepth(99400);
      this.tweens.add({
        targets: s,
        x: x + Math.cos(a) * 16,
        y: y + Math.sin(a) * 16,
        alpha: 0,
        duration: 170,
        onComplete: () => s.destroy(),
      });
    }
    const scorch = this.add.circle(x, y, 4, 0x161009, 0.5).setDepth(98000);
    this.tweens.add({
      targets: scorch,
      alpha: 0,
      duration: 1100,
      onComplete: () => scorch.destroy(),
    });
  }

  /** Fiery AoE explosion where a magma ball died — a flash + a shockwave ring expanding to EXACTLY the
   *  blast radius (the server hitbox) + a hot footprint disc + flung sparks. §14 WYSIWYG: visual = hitbox. */
  private spawnExplosion(x: number, y: number, radius: number): void {
    const flash = this.add
      .circle(x, y, radius * 0.5, 0xffe6b0, 0.9)
      .setDepth(99002)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: flash,
      scale: 1.6,
      alpha: 0,
      duration: 220,
      ease: "Quad.easeOut",
      onComplete: () => flash.destroy(),
    });
    const ring = this.add
      .circle(x, y, radius)
      .setStrokeStyle(4, 0xff8a2b, 0.95)
      .setScale(0.2)
      .setDepth(99002)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: ring,
      scale: 1,
      alpha: 0,
      duration: 300,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy(),
    });
    const disc = this.add
      .circle(x, y, radius, 0xff5a1e, 0.32)
      .setDepth(99001)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: disc,
      alpha: 0,
      scale: 1.05,
      duration: 260,
      ease: "Quad.easeOut",
      onComplete: () => disc.destroy(),
    });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
      const spark = this.add
        .circle(x, y, 2.5, 0xffd9a0, 0.9)
        .setDepth(99002)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(a) * radius * 1.1,
        y: y + Math.sin(a) * radius * 1.1,
        alpha: 0,
        duration: 240 + Math.random() * 120,
        ease: "Quad.easeOut",
        onComplete: () => spark.destroy(),
      });
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

  /** Small impact splat where a projectile hit or expired (green spit / amber cleaver). */
  private spawnSplat(x: number, y: number, kind?: string): void {
    const color = kind === "cleaver" ? 0xffb23b : 0xc9ff5e;
    const ring = this.add.circle(x, y, 7, color, 0.7).setDepth(99001);
    this.tweens.add({
      targets: ring,
      scale: 2.2,
      alpha: 0,
      duration: 230,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy(),
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

  /** Show/hide the extraction portal (§16) at its authoritative position when it's open. */
  private syncPortal(): void {
    if (!this.room) return;
    const st = this.room.state;
    if (st.portalOpen && !this.portal) {
      const outer = this.add
        .circle(0, 0, EXTRACT_RADIUS, 0x6fd6ff, 0.16)
        .setStrokeStyle(3, 0x6fd6ff, 0.7);
      const inner = this.add
        .circle(0, 0, EXTRACT_RADIUS * 0.5, 0xffd479, 0.22)
        .setStrokeStyle(2, 0xffd479, 0.9);
      const label = this.add
        .text(0, -EXTRACT_RADIUS - 16, "▼ EXTRACT", {
          fontSize: "16px",
          color: "#ffd479",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.portal = this.add.container(st.portalX, st.portalY, [outer, inner, label]).setDepth(1);
      this.tweens.add({
        targets: inner,
        scale: 1.35,
        duration: 760,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
    }
    if (!st.portalOpen && this.portal) {
      this.portal.destroy();
      this.portal = undefined;
    }
  }

  /** Boss health bar + approach banner + victory screen (§16). */
  private updateRunState(): void {
    if (!this.room) return;
    // Locate the boss (if any) and total its max HP from the roster.
    let boss: { hp: number } | undefined;
    this.room.state.enemies.forEach((e) => {
      if (e.kind === "old-rust") boss = e;
    });
    const bossMax = ENEMY_KINDS["old-rust"]?.hp ?? 420;
    const present = !!boss;
    if (present && boss) {
      this.bossBarBg.setPosition(this.screenW() / 2, 40).setVisible(true);
      this.bossBarFill.setPosition(this.screenW() / 2 - 258, 48).setVisible(true);
      this.bossBarFill.width = 516 * Math.max(0, Math.min(1, boss.hp / bossMax));
      this.bossText.setPosition(this.screenW() / 2, 38).setVisible(true);
    } else {
      this.bossBarBg.setVisible(false);
      this.bossBarFill.setVisible(false);
      this.bossText.setVisible(false);
    }
    // Boss-approach toast on first appearance.
    if (present && !this.prevBossPresent && this.bannerShownFor !== "boss") {
      this.bannerShownFor = "boss";
      this.flashBanner("⚠  OLD RUST APPROACHES  ⚠", "#ff5d3b");
    }
    if (!present) this.bannerShownFor = "";
    this.prevBossPresent = present;

    // Victory screen.
    const won = this.room.state.outcome === "victory";
    this.victoryText.setVisible(won);
    if (won) this.victoryText.setPosition(this.screenW() / 2, this.screenH() / 2);
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

  /** §12 level-up window: when the local player has a flex point pending, show the attribute pick. */
  private updateLevelWindow(): void {
    if (!this.room) return;
    const self = this.room.state.players.get(this.room.sessionId);
    const open = !!self && self.flexPending > 0;
    const key = open ? `${self.level}:${self.flexPending}` : "";
    if (key !== this.levelWinKey) {
      this.levelWinKey = key;
      for (const o of this.levelWinObjects) o.destroy();
      this.levelWinObjects = [];
      this.levelWinTimerBar = undefined;
      if (open && self) this.buildLevelWindow(self);
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

  /** Build the dim overlay + 5 attribute buttons for the §12 flex-point pick. */
  private buildLevelWindow(self: PlayerState): void {
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
    const sub = this.add
      .text(cx, cy - 138, "+1 STR  +1 CON (auto) · spend your FLEX point", {
        fontSize: "15px",
        color: "#cfc8b6",
      })
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
    this.levelWinObjects.push(dim, title, sub, barBg, this.levelWinTimerBar);

    const attrs = ["str", "dex", "int", "con", "luk"];
    const W = 150;
    const H = 200;
    const gap = 16;
    const startX = cx - (attrs.length * (W + gap) - gap) / 2 + W / 2;
    attrs.forEach((attr, i) => {
      const info = ArenaScene.ATTR_INFO[attr];
      if (!info) return;
      const cur = (self as unknown as Record<string, number>)[attr] ?? 1;
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

      // §5 jump hop: drive the rig's lift from the synced airborne timer (counts down from JUMP_AIRTIME).
      // A sine arc → 0 at launch, peak at apex, 0 on landing.
      const pl = this.room?.state.players.get(id);
      const airborne = pl?.airborne ?? 0;
      blob.setHop(
        airborne > 0 ? Math.sin((1 - airborne / JUMP_AIRTIME) * Math.PI) * JUMP_HOP_HEIGHT : 0,
      );

      const isSelf = id === selfId;
      blob.animate(this.time.now, {
        moveX: mx,
        moveY: my,
        aimX: isSelf ? aimX : 0,
        aimY: isSelf ? aimY : 0,
        aimDir: pl?.aimDir ?? 0, // §9 remote gun pose tracks the synced aim
        isSelf,
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
    if (!weapon?.gun) rig?.triggerSwing(this.time.now); // guns don't melee-swing — the shot is the muzzle flash
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
      this.spawnQuake(ep.x, ep.y, weapon.quake);
      this.hitStop(130);
    } else if (weapon?.gun) {
      // Gun recoil — a per-gun camera kick (heavy slug THUMPS, gatling barely buzzes). The shake duration
      // is capped to the fire-rate so a fast auto's kicks decay before the next shot (no jitter stacking).
      // The muzzle flash + bullet render off the server-spawned projectile (syncProjectiles).
      this.cameras.main.shake(Math.min(70, weapon.gun.fireRate * 700), weapon.gun.recoil ?? 0.0017);
    } else if (weapon && !weapon.thrown) {
      // Plain melee swing → the weapon's authored swing VFX (§14).
      this.spawnSlash(rig?.x ?? self.x, rig?.y ?? self.y, this.selfAim, weapon);
      // Chain-lightning on-hit proc (§10) — teal bolt leaps to the nearest enemies (server owns the damage).
      if (weapon.chainLightning)
        this.spawnChain(rig?.x ?? self.x, rig?.y ?? self.y, this.selfAim, weapon);
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
    if (!self?.alive || self.flexPending > 0) return;
    if (!this.input.activePointer.leftButtonDown() || this.localParryCd > 0) return;
    this.localParryCd = PARRY_COOLDOWN;
    this.room.send("parry");
    this.blobs.get(selfId)?.triggerBrace(this.time.now);
  }

  /** Hit-stop (§20): hold the visuals for `ms` on impactful events. */
  private hitStop(ms: number): void {
    this.frozenUntil = Math.max(this.frozenUntil, this.time.now + ms);
  }

  /** Earthquake VFX (§14): the Codex hero skin (authored in the Weaponsmith) if the weapon carries
   *  one, else the procedural fallback. Both composite engine dust/debris/flash/shake. */
  private spawnQuake(x: number, y: number, quake: NonNullable<WeaponDef["quake"]>): void {
    if (quake.vfx && this.textures.exists(quake.vfx.image)) {
      this.spawnQuakeHero(x, y, quake.radius, quake.vfx);
    } else {
      this.spawnQuakeProcedural(x, y, quake.radius);
    }
  }

  /** Hero-skin quake: the Codex slab eruption (candidate-8) erupting up + engine overlays. The
   *  `vfx` params (radius/flash/dust/debris/shake) were dialed in the Weaponsmith and baked here. */
  private spawnQuakeHero(
    x: number,
    y: number,
    radius: number,
    vfx: NonNullable<NonNullable<WeaponDef["quake"]>["vfx"]>,
  ): void {
    // Hero sprite scaled so its width spans the AoE diameter × the authored visual radius.
    // UNIFORM scale (no foreshortening squish) — the hand-drawn art keeps its painted aspect (§28.4).
    const src = this.textures.get(vfx.image).getSourceImage();
    const full = (radius * 2 * vfx.radius) / src.width;
    // Low ground depth so the character (depth = y) always renders OVER the eruption.
    const hero = this.add.image(x, y, vfx.image).setOrigin(0.5, 0.5).setDepth(6);
    hero.setScale(full * 0.32).setAlpha(0);
    this.tweens.add({
      targets: hero,
      scale: full,
      alpha: 1,
      duration: 200,
      ease: "Back.easeOut",
    });
    this.tweens.add({
      targets: hero,
      alpha: 0,
      delay: 520,
      duration: 320,
      ease: "Cubic.easeIn",
      onComplete: () => hero.destroy(),
    });

    // Engine dust kicked up (param 0..1).
    if (vfx.dust > 0) {
      const dust = this.add
        .ellipse(x, y, radius * 1.8, radius, 0x6e7042, 0.36 * vfx.dust)
        .setScale(0.4)
        .setDepth(4);
      this.tweens.add({
        targets: dust,
        scale: 1.1,
        alpha: 0,
        duration: 500,
        ease: "Quad.easeOut",
        onComplete: () => dust.destroy(),
      });
    }

    // Engine debris bits flung outward with gravity arcs (param = count).
    const n = Math.round(vfx.debris);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const dist = radius * (0.5 + Math.random() * 0.55);
      const sz = 4 + Math.random() * 6;
      const bit = this.add
        .rectangle(x, y, sz, sz * 0.8, Math.random() < 0.5 ? 0x4a5159 : 0x2b3037)
        .setStrokeStyle(1.5, 0x13161a)
        .setDepth(8);
      this.tweens.add({
        targets: bit,
        x: x + Math.cos(a) * dist,
        y: y + Math.sin(a) * dist * 0.55 - (18 + Math.random() * 34),
        angle: Math.random() * 360,
        alpha: 0,
        scale: 0.4,
        duration: 380 + Math.random() * 220,
        ease: "Quad.easeOut",
        onComplete: () => bit.destroy(),
      });
    }

    // Engine impact flash (param 0..1) — kept subtle per the authored value.
    if (vfx.flash > 0) {
      const flash = this.add
        .ellipse(x, y, radius * 2.2, radius * 1.2, 0xffcaa0, 0.7 * vfx.flash)
        .setBlendMode(Phaser.BlendModes.SCREEN)
        .setDepth(5);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        scale: 1.25,
        duration: 240,
        ease: "Cubic.easeOut",
        onComplete: () => flash.destroy(),
      });
    }

    this.cameras.main.shake(220, 0.02 * vfx.shake);
  }

  /** Procedural quake fallback (golden ground shockwave) for quake weapons without a VFX skin. */
  private spawnQuakeProcedural(x: number, y: number, radius: number): void {
    const ring = this.add.ellipse(x, y, 44, 26).setStrokeStyle(5, 0xffb23b, 0.9).setDepth(99998);
    this.tweens.add({
      targets: ring,
      scaleX: (radius * 2) / 44,
      scaleY: ((radius * 2) / 44) * 0.62,
      alpha: 0,
      duration: 400,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
    const dust = this.add.ellipse(x, y, 34, 20, 0x6e7042, 0.4).setDepth(99997);
    this.tweens.add({
      targets: dust,
      scaleX: (radius * 1.5) / 34,
      scaleY: (radius * 1.5) / 34,
      alpha: 0,
      duration: 340,
      ease: "Quad.easeOut",
      onComplete: () => dust.destroy(),
    });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const p = this.add.circle(x, y, 6, 0x8a6a3a, 0.75).setDepth(99999);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * radius * 0.72,
        y: y + Math.sin(a) * radius * 0.42 - 18,
        alpha: 0,
        scale: 0.3,
        duration: 380,
        ease: "Quad.easeOut",
        onComplete: () => p.destroy(),
      });
    }
    this.cameras.main.shake(220, 0.012);
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
          this.spawnDamageNumber(rig.x, rig.y - 26, prev - enemy.hp, "#FFE08A");
        }
      }
      this.enemyHp.set(id, enemy.hp);
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

  /** Floating combat text that rises and fades (world-space, over the target). */
  private spawnDamageNumber(x: number, y: number, amount: number, color: string): void {
    const text = this.add
      .text(x, y, String(Math.max(1, Math.round(amount))), {
        fontSize: "16px",
        color,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(100000);
    this.tweens.add({
      targets: text,
      y: y - 30,
      alpha: 0,
      duration: 550,
      ease: "Cubic.easeOut",
      onComplete: () => text.destroy(),
    });
  }

  /** Quick dust puff where an enemy died. */
  private spawnPoof(x: number, y: number): void {
    const ring = this.add.circle(x, y, 8, 0xcfc6ae, 0.5).setDepth(99999);
    this.tweens.add({
      targets: ring,
      scale: 3,
      alpha: 0,
      duration: 260,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  /** HP bar + downed overlay, repositioned each frame against the live viewport size. */
  private updateHud(): void {
    const selfId = this.room?.sessionId;
    const self = selfId ? this.room?.state.players.get(selfId) : undefined;

    const barX = 20;
    const barY = this.screenH() - 24;
    const xpY = barY - 15;
    this.hpBarBg.setPosition(barX, barY);
    this.hpBarFill.setPosition(barX + 2, barY);
    this.hpText.setPosition(barX + 8, barY);

    const hp = self ? Math.max(0, self.hp) : 0;
    const maxHp = self ? self.maxHp : 100;
    const ratio = maxHp > 0 ? hp / maxHp : 0;
    this.hpBarFill.width = 236 * ratio;
    // Green → amber → red as it drains.
    this.hpBarFill.fillColor = ratio > 0.5 ? 0x9cff3b : ratio > 0.25 ? 0xff8a2b : 0xff5d5d;
    this.hpText.setText(`${Math.ceil(hp)} / ${maxHp}`);

    // XP bar + level badge (§12).
    this.xpBarBg.setPosition(barX, xpY);
    this.xpBarFill.setPosition(barX + 2, xpY);
    const xpRatio = self && self.xpToNext > 0 ? Math.min(1, self.xp / self.xpToNext) : 0;
    this.xpBarFill.width = 236 * xpRatio;
    this.levelText
      .setPosition(barX, xpY - 9)
      .setText(
        self
          ? `Lv ${self.level}   STR ${self.str} · DEX ${self.dex} · INT ${self.int} · CON ${self.con} · LUK ${self.luk}`
          : "",
      );

    this.restartBtn.setPosition(this.screenW() - 14, 14);
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
      .setPosition(barX, xpY - 24)
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

    const training = this.room?.state.mode === "training";
    const who = self ? ` · C: swap character (${characterName(self.character)})` : "";
    this.modeText
      .setPosition(this.screenW() / 2, 12)
      .setText(
        training
          ? `⛶ TESTING GROUNDS — R: grab a weapon (hold: salvage) · Space: jump · swing at the dummies · T to exit${who}`
          : `Survive until OLD RUST, then extract · Space: jump · B: boss · T: Testing Grounds${who}`,
      )
      .setColor(training ? "#33e6ff" : "#5a6472");

    const downed = !!self && !self.alive;
    this.deathText.setVisible(downed);
    if (downed) this.deathText.setPosition(this.screenW() / 2, this.screenH() / 2);
  }

  /** §9 card carousel: one full infographic card per arsenal weapon (art + stats), fanned at the
   *  bottom; the held card is centered, upright, enlarged + readable. */
  private buildCarousel(): void {
    for (const id of WEAPON_IDS) this.carousel.push(this.buildCard(id));
  }

  /** Grade → chip colour (§10 S/A/B/C/D/E). */
  private static readonly GRADE_COL: Record<string, number> = {
    S: 0xffd479,
    A: 0xff8a2b,
    B: 0x9cff3b,
    C: 0x6fd6ff,
    D: 0x6f8bff,
    E: 0x9a9484,
  };

  /** Bake the FULL-BLEED card art (cover-fit + rounded clip) into a per-card texture so it transforms
   *  cleanly with the carousel (masks don't follow container transforms). Returns the texture key. */
  private bakeCardArt(id: string, W: number, H: number, R: number): string {
    const key = `cardbg-${id}`;
    if (this.textures.exists(key)) return key;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return key;
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, R);
    ctx.clip();
    const tex = this.textures.exists(`card-${id}`) ? `card-${id}` : null;
    if (tex) {
      const src = this.textures.get(tex).getSourceImage() as CanvasImageSource & {
        width: number;
        height: number;
      };
      const sc = Math.max(W / src.width, H / src.height);
      const dw = src.width * sc;
      const dh = src.height * sc;
      ctx.drawImage(src, (W - dw) / 2, Math.min(0, (H - dh) * 0.12), dw, dh); // bias to the top
    } else if (this.textures.exists(`${id}:part-1`)) {
      // No dedicated card art yet → show the installed weapon sprite (contain-fit, upper area) on a
      // dark ground. Keeps newly-wired weapons (explore swords) legible until bespoke card art lands.
      ctx.fillStyle = "#15120d";
      ctx.fillRect(0, 0, W, H);
      const src = this.textures.get(`${id}:part-1`).getSourceImage() as CanvasImageSource & {
        width: number;
        height: number;
      };
      const availW = W * 0.86;
      const availH = H * 0.5;
      const sc = Math.min(availW / src.width, availH / src.height);
      const dw = src.width * sc;
      const dh = src.height * sc;
      ctx.drawImage(src, (W - dw) / 2, H * 0.07 + (availH - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = "#15120d";
      ctx.fillRect(0, 0, W, H);
    }
    this.textures.addCanvas(key, canvas);
    return key;
  }

  /** Tiny vector icons for the §9 card (icon-driven — no word labels, §9). Drawn into `g`, centred at
   *  (x,y), fitting roughly a 2·s box, in the given colour. */
  private drawIcon(
    g: Phaser.GameObjects.Graphics,
    kind: string,
    x: number,
    y: number,
    s: number,
    color: number,
  ): void {
    g.lineStyle(1.7, color, 1).fillStyle(color, 1);
    if (kind === "hit") {
      g.beginPath();
      g.arc(x - s * 0.3, y + s * 0.6, s * 1.5, -Math.PI * 0.58, -Math.PI * 0.04);
      g.strokePath(); // a slash arc
    } else if (kind === "throw") {
      g.beginPath();
      g.arc(x, y, s * 0.95, Math.PI * 0.35, Math.PI * 1.95);
      g.strokePath();
      g.fillTriangle(
        x + s * 0.85,
        y - s * 0.6,
        x + s * 1.35,
        y - s * 0.25,
        x + s * 0.7,
        y + s * 0.05,
      );
    } else if (kind === "shot") {
      // a bullet: a pointed slug with a motion streak (gun damage source)
      g.fillCircle(x + s * 0.55, y, s * 0.5);
      g.fillTriangle(x + s * 1.05, y, x + s * 0.55, y - s * 0.5, x + s * 0.55, y + s * 0.5);
      g.lineStyle(1.6, color, 0.7);
      g.beginPath();
      g.moveTo(x - s, y);
      g.lineTo(x + s * 0.05, y);
      g.strokePath();
    } else if (kind === "quake") {
      for (let i = 1; i <= 3; i++) {
        g.lineStyle(1.5, color, 1 - i * 0.16);
        g.beginPath();
        g.arc(x, y + s * 0.5, s * 0.42 * i, Math.PI * 1.12, Math.PI * 1.88);
        g.strokePath();
      }
    } else if (kind === "chain") {
      g.beginPath();
      g.moveTo(x + s * 0.4, y - s);
      g.lineTo(x - s * 0.35, y);
      g.lineTo(x + s * 0.15, y);
      g.lineTo(x - s * 0.4, y + s);
      g.strokePath(); // lightning bolt
    } else if (kind === "magma") {
      g.fillCircle(x + s * 0.25, y + s * 0.25, s * 0.6); // meteor head
      g.lineStyle(1.5, color, 0.8);
      g.beginPath();
      g.moveTo(x - s * 0.7, y - s * 0.7);
      g.lineTo(x, y);
      g.strokePath(); // trail
    } else if (kind === "blast") {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.beginPath();
        g.moveTo(x + Math.cos(a) * s * 0.38, y + Math.sin(a) * s * 0.38);
        g.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
        g.strokePath();
      }
    } else if (kind === "str") {
      g.beginPath();
      g.moveTo(x - s * 0.75, y + s * 0.15);
      g.lineTo(x, y - s * 0.75);
      g.lineTo(x + s * 0.75, y + s * 0.15);
      g.strokePath();
      g.beginPath();
      g.moveTo(x - s * 0.75, y + s * 0.75);
      g.lineTo(x, y - s * 0.15);
      g.lineTo(x + s * 0.75, y + s * 0.75);
      g.strokePath(); // double up-chevron (power)
    } else if (kind === "dex") {
      g.beginPath();
      g.moveTo(x - s * 0.85, y + s * 0.85);
      g.lineTo(x + s * 0.85, y - s * 0.85);
      g.strokePath();
      g.beginPath();
      g.moveTo(x + s * 0.15, y - s * 0.85);
      g.lineTo(x + s * 0.85, y - s * 0.85);
      g.lineTo(x + s * 0.85, y - s * 0.15);
      g.strokePath(); // slim arrow (finesse)
    } else if (kind === "int") {
      g.fillTriangle(x, y - s, x - s * 0.32, y, x + s * 0.32, y);
      g.fillTriangle(x, y + s, x - s * 0.32, y, x + s * 0.32, y);
      g.fillTriangle(x - s, y, x, y - s * 0.32, x, y + s * 0.32);
      g.fillTriangle(x + s, y, x, y - s * 0.32, x, y + s * 0.32); // 4-point sparkle (arcane)
    } else if (kind === "con" || kind === "durability") {
      g.beginPath();
      g.moveTo(x, y - s);
      g.lineTo(x + s * 0.82, y - s * 0.45);
      g.lineTo(x + s * 0.6, y + s * 0.65);
      g.lineTo(x, y + s);
      g.lineTo(x - s * 0.6, y + s * 0.65);
      g.lineTo(x - s * 0.82, y - s * 0.45);
      g.closePath();
      g.strokePath(); // shield
    } else if (kind === "luk") {
      const p: number[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? s * 0.42 : s;
        p.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      g.beginPath();
      g.moveTo(p[0] as number, p[1] as number);
      for (let i = 2; i < p.length; i += 2) g.lineTo(p[i] as number, p[i + 1] as number);
      g.closePath();
      g.strokePath(); // star (luck)
    } else if (kind === "req") {
      g.strokeRoundedRect(x - s * 0.75, y - s * 0.05, s * 1.5, s, 2);
      g.beginPath();
      g.arc(x, y - s * 0.05, s * 0.48, Math.PI, 0);
      g.strokePath(); // padlock
    } else if (kind === "charges") {
      g.fillTriangle(x, y - s, x + s * 0.7, y, x - s * 0.7, y);
      g.fillTriangle(x, y + s, x + s * 0.7, y, x - s * 0.7, y); // diamond pip
    }
  }

  /** Build one card: full-bleed art + a §5 tooltip slab — name + tag subtitle are the ONLY text; the
   *  damage sources, scaling, requirements and charges/durability are ICON-driven (§9). */
  private buildCard(id: string): {
    id: string;
    container: Phaser.GameObjects.Container;
    sources: { text: Phaser.GameObjects.Text; src: DamageSource }[];
    reqTokens: { text: Phaser.GameObjects.Text; attr: Attr; need: number }[];
    resource: Phaser.GameObjects.Text;
  } {
    const def = WEAPONS[id];
    const W = 212;
    const H = 296;
    const R = 14;
    const ART_FRAC = 0.34; // top third is the painted art; the rest is the §5 tooltip slab
    const accent = ArenaScene.WEAPON_ACCENT[id] ?? 0xb9975b;
    const accentHex = `#${accent.toString(16).padStart(6, "0")}`;
    const o: Phaser.GameObjects.GameObject[] = [];
    const L = -W / 2;
    const T = -H / 2;
    const padL = L + 13;
    const padR = -L - 13;
    const mk = (
      x: number,
      ty: number,
      size: number,
      color: string,
      str: string,
      ox = 0,
      bold = false,
    ): Phaser.GameObjects.Text =>
      this.add
        .text(x, ty, str, { fontSize: `${size}px`, color, fontStyle: bold ? "bold" : "normal" })
        .setOrigin(ox, 0);

    // §5 layout: full-bleed painted art up top, a dark tooltip slab over the lower section.
    o.push(this.add.image(0, 0, this.bakeCardArt(id, W, H, R)));
    const panel = this.add.graphics();
    panel.fillStyle(0x0a0805, 0.93).fillRect(L, T + H * ART_FRAC, W, H * (1 - ART_FRAC));
    o.push(panel);

    // Accent (rarity) frame.
    const frame = this.add.graphics();
    frame.lineStyle(3, accent, 0.92).strokeRoundedRect(L + 1.5, T + 1.5, W - 3, H - 3, R);
    frame.lineStyle(1, 0x000000, 0.4).strokeRoundedRect(L + 5, T + 5, W - 10, H - 10, R - 4);
    o.push(frame);

    let y = T + H * ART_FRAC + 8;

    // Name (rarity-tinted) + subtitle (grip · family · element).
    o.push(mk(padL, y, 17, accentHex, def?.name ?? id, 0, true));
    y += 23;
    const grip = def?.dual ? "dual" : def?.twoHanded ? "2-hand" : "1-hand";
    const sub = def ? `${grip} · ${def.tags.family} · ${def.tags.element}` : "";
    o.push(mk(padL, y, 10, "#b9b3a3", sub));
    y += 15;
    const div = this.add.graphics();
    div.lineStyle(1, accent, 0.3).lineBetween(padL, y, padR, y);
    o.push(div);
    y += 9;

    // ICON-DRIVEN (§9): one damage-type ICON per §14 source + its live "base + bonus = total" — no words.
    const icons = this.add.graphics();
    o.push(icons);
    const sources: { text: Phaser.GameObjects.Text; src: DamageSource }[] = [];
    for (const src of (def ? weaponDamageSources(def) : []).slice(0, 4)) {
      this.drawIcon(icons, src.label, padL + 6, y + 7, 6, accent);
      if (src.count > 1) o.push(mk(padL + 15, y + 1, 10, "#8f897a", `×${src.count}`));
      const eqText = mk(padR, y, 13, "#ffd479", "", 1, true);
      sources.push({ text: eqText, src });
      o.push(eqText);
      y += 18;
    }
    y += 6;

    // Scaling: an ATTRIBUTE ICON + its grade letter (colour = grade) per scaling attribute.
    const grades = def?.scalingGrades ?? { str: "B" };
    let cx = padL;
    for (const [attr, g] of Object.entries(grades) as [Attr, string][]) {
      const col = ArenaScene.GRADE_COL[g] ?? 0x9a9484;
      const cw = 40;
      const chip = this.add.graphics();
      chip.fillStyle(0x000000, 0.4).fillRoundedRect(cx, y, cw, 18, 5);
      chip.lineStyle(1, col, 0.7).strokeRoundedRect(cx, y, cw, 18, 5);
      o.push(chip);
      this.drawIcon(icons, attr, cx + 11, y + 9, 6, 0xcfc6ae);
      o.push(
        this.add
          .text(cx + cw - 7, y + 9, g, {
            fontSize: "13px",
            color: `#${col.toString(16).padStart(6, "0")}`,
            fontStyle: "bold",
          })
          .setOrigin(1, 0.5),
      );
      cx += cw + 6;
    }
    y += 25;

    // Minimum requirements: a PADLOCK + (attribute icon · number) per requirement. The NUMBER recolours
    // green/red met/unmet vs the player's live attributes (updateCarousel).
    const reqTokens: { text: Phaser.GameObjects.Text; attr: Attr; need: number }[] = [];
    const reqEntries = Object.entries(def?.requirements ?? {}) as [Attr, number][];
    if (reqEntries.length > 0) {
      this.drawIcon(icons, "req", padL + 6, y + 6, 6, 0x8f897a);
      let rx = padL + 22;
      for (const [attr, need] of reqEntries) {
        this.drawIcon(icons, attr, rx + 5, y + 6, 6, 0xb9b3a3);
        const tk = mk(rx + 14, y, 12, "#cfc6ae", String(need), 0, true);
        reqTokens.push({ text: tk, attr, need });
        o.push(tk);
        rx += 44;
      }
    }

    // Charges (thrown, live) or durability (melee) — an ICON + a live number, anchored at the card bottom.
    const resY = H / 2 - 22;
    this.drawIcon(icons, def?.thrown ? "charges" : "durability", padL + 6, resY + 6, 6, accent);
    const resource = mk(padL + 17, resY, 12, accentHex, "", 0, true);
    o.push(resource);

    // Crisp text — Phaser Text defaults to resolution 1, which blurs on high-DPI + when scaled.
    const res = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
    for (const obj of o) if (obj instanceof Phaser.GameObjects.Text) obj.setResolution(res);

    const container = this.add.container(0, 0, o).setScrollFactor(0).setDepth(100000);
    return { id, container, sources, reqTokens, resource };
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
  private spawnSlash(x: number, y: number, aim: { x: number; y: number }, weapon: WeaponDef): void {
    const ang = Math.atan2(aim.y, aim.x);
    const reach = (weapon.range ?? 100) * 0.6; // WHERE the effect sits along the swing (placement, not size)
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
