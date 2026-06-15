import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type ArenaState,
  DEFAULT_PORT,
  DEFAULT_WEAPON,
  ENEMY_KINDS,
  EXTRACT_RADIUS,
  LEVELUP_WINDOW_SECONDS,
  PARRY_COOLDOWN,
  type PlayerState,
  QUAKE_REACH,
  ROOM_NAME,
  TOUGH_SCALE,
  WEAPON_IDS,
  WEAPONS,
  type WeaponDef,
  weaponDamageMult,
} from "@dd/shared";
import { Client, type Room } from "colyseus.js";
import Phaser from "phaser";
import { SpriteRig } from "../entities/SpriteRig.js";
import { SPRITES } from "../sprites/manifest.js";

/** Which sprite manifest the player renders as (§23: melee class, one character for M0). */
const PLAYER_SPRITE = "drifter";

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
  private readonly prevPos = new Map<string, { x: number; y: number }>();
  private readonly enemyPrev = new Map<string, { x: number; y: number }>();
  private keys!: Record<"W" | "A" | "S" | "D" | "R" | "Q" | "T" | "B", Phaser.Input.Keyboard.Key>;
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
  private readonly equipped = new Map<string, string>();
  private readonly pickups = new Map<string, Phaser.GameObjects.Container>();
  /** Rendered enemy projectiles (§15 spit), dead-reckoned from server (x,y,vx,vy). */
  private readonly projectiles = new Map<string, Phaser.GameObjects.Container>();
  /** Rendered zoner puddles (§15 area denial). */
  private readonly zones = new Map<string, Phaser.GameObjects.Container>();
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
  // §9 bottom-center card carousel — a fanned hand; held card centered/enlarged with full stats.
  private carousel: {
    id: string;
    container: Phaser.GameObjects.Container;
    readout: Phaser.GameObjects.Text;
    eq: Phaser.GameObjects.Text; // live damage equation: base + bonus = total
    badge: Phaser.GameObjects.Text; // live charges in the corner badge
  }[] = [];
  /** Per-weapon accent colour for card frames (rarity tinting lands with the loot system). */
  private static readonly WEAPON_ACCENT: Record<string, number> = {
    "rusty-cleaver": 0xff8a2b,
    "tombstone-greatsword": 0x9cff3b,
    "twin-bowie-fangs": 0x6fd6ff,
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
    // Weapon card art (§14 two-pass / §28.5) for the §9 carousel — one per arsenal weapon.
    for (const id of WEAPON_IDS) this.load.image(`card-${id}`, `cards/${id}.png`);
  }

  create(): void {
    this.drawArena();

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Keyboard input unavailable");
    this.keys = keyboard.addKeys("W,A,S,D,R,Q,T,B") as Record<
      "W" | "A" | "S" | "D" | "R" | "Q" | "T" | "B",
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

    // RESIZE scale mode: keep the camera viewport equal to the canvas, else the camera
    // renders into only part of the canvas (the "game stuck in a corner" bug).
    this.scale.on("resize", (size: Phaser.Structs.Size) => {
      this.cameras.main.setSize(size.width, size.height);
    });

    this.buildHud();
    this.buildCarousel();
    void this.connect();
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
      .text(0, 0, "DOWNED — respawning…\n(press R to restart the run)", {
        fontSize: "26px",
        color: "#FF5D5D",
        fontStyle: "bold",
        align: "center",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100002)
      .setVisible(false);

    // Playtest control: restart the run (also bound to the R key). Top-right corner.
    this.restartBtn = this.add
      .text(0, 0, "⟳ Restart Run (R)", {
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

  /** Render weapon pickups lying in the Testing Grounds (weapon sprite + name, bobbing). */
  private syncPickups(): void {
    if (!this.room) return;
    const state = this.room.state.pickups;
    state.forEach((pk, id) => {
      if (this.pickups.has(id)) return;
      const manifest = SPRITES[pk.weapon as keyof typeof SPRITES];
      const part = manifest?.parts[0];
      const def = WEAPONS[pk.weapon];
      const ring = this.add
        .ellipse(0, 14, 78, 30, 0x33e6ff, 0.16)
        .setStrokeStyle(2, 0x33e6ff, 0.55);
      const img = part
        ? this.add.image(0, 0, `${pk.weapon}:${part.role}`).setScale(64 / part.w)
        : this.add.rectangle(0, 0, 50, 12, 0xffffff);
      const label = this.add
        .text(0, 30, def?.name ?? pk.weapon, {
          fontSize: "12px",
          color: "#e8e4d8",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      const container = this.add.container(pk.x, pk.y, [ring, img, label]).setDepth(2);
      this.tweens.add({
        targets: img,
        y: -12,
        duration: 850,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
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

    // Ground bed — dusty dark earth.
    this.add.rectangle(cx, cy, ARENA_WIDTH, ARENA_HEIGHT, 0x2a2620);
    // Low-contrast earthy grid so movement reads without stealing focus from the neon VFX.
    this.add.grid(cx, cy, ARENA_WIDTH, ARENA_HEIGHT, 128, 128, 0x2a2620, 1, 0x342d22, 0.5);

    // Deterministic scatter (mulberry32) so the dressing is stable frame-to-frame.
    let seed = 0x5eed1e;
    const rng = (): number => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const between = (a: number, b: number): number => a + rng() * (b - a);

    // Faint tan dust drifts — big, soft, low-alpha so the floor isn't flat.
    for (let i = 0; i < 40; i++) {
      this.add
        .ellipse(
          rng() * ARENA_WIDTH,
          rng() * ARENA_HEIGHT,
          between(160, 360),
          between(110, 240),
          0xc49a5a,
        )
        .setAlpha(between(0.03, 0.07));
    }
    // Scrub/cacti (olive) and rocks (gunmetal/steel) — readable ground litter.
    for (let i = 0; i < 90; i++) {
      const x = between(60, ARENA_WIDTH - 60);
      const y = between(60, ARENA_HEIGHT - 60);
      if (rng() < 0.4) {
        // Cactus/scrub: a stubby olive lump.
        const r = between(10, 20);
        this.add.ellipse(x, y, r * 1.4, r * 2.1, 0x6e7042).setStrokeStyle(3, 0x22251b);
      } else {
        // Rock: gunmetal with a darker rim and a small shadow patch.
        const r = between(12, 30);
        this.add.ellipse(x, y + r * 0.4, r * 1.7, r * 0.7, 0x1f1c17).setAlpha(0.5);
        this.add
          .ellipse(x, y, r * 1.5, r, rng() < 0.5 ? 0x3a4049 : 0x5a6472)
          .setStrokeStyle(3, 0x22252b);
      }
    }

    // Arena boundary — a rusted rail.
    this.add.rectangle(cx, cy, ARENA_WIDTH, ARENA_HEIGHT).setStrokeStyle(6, 0xa8482e);
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
    this.blobs.set(id, new SpriteRig(this, player.x, player.y, isSelf, id, PLAYER_SPRITE));
    this.prevPos.set(id, { x: player.x, y: player.y });
    if (isSelf) this.cameras.main.centerOn(player.x, player.y);
  }

  private removeBlob(id: string): void {
    this.blobs.get(id)?.destroy();
    this.blobs.delete(id);
    this.prevPos.delete(id);
    this.equipped.delete(id);
  }

  override update(_time: number, deltaMs: number): void {
    if (!this.room) return;

    this.deltaSec = deltaMs / 1000;
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.room?.send("restart");
    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) this.room?.send("cycleWeapon");
    if (Phaser.Input.Keyboard.JustDown(this.keys.T)) this.room?.send("toggleTraining");
    if (Phaser.Input.Keyboard.JustDown(this.keys.B)) this.room?.send("spawnBoss");

    this.sendInput();
    this.syncBlobs();
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
        this.enemies.set(id, rig);
        this.enemyPrev.set(id, { x: enemy.x, y: enemy.y });
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
      rig.animate(this.time.now, { moveX: mx, moveY: my, aimX: 0, aimY: 0, isSelf: false });
      rig.setDepth(rig.y);
    }
  }

  /** Reconcile rendered projectiles vs authoritative state; splat on removal (hit/expire). */
  private syncProjectiles(): void {
    if (!this.room) return;
    const state = this.room.state.projectiles;
    state.forEach((pr, id) => {
      if (this.projectiles.has(id)) return;
      const container = pr.kind === "cleaver" ? this.makeThrownCleaver(pr) : this.makeSpit(pr);
      container.setData("kind", pr.kind);
      this.projectiles.set(id, container);
    });
    for (const id of [...this.projectiles.keys()]) {
      if (!state.has(id)) {
        const c = this.projectiles.get(id);
        if (c) this.spawnSplat(c.x, c.y, c.getData("kind"));
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
    const cam = this.cameras.main;
    // Locate the boss (if any) and total its max HP from the roster.
    let boss: { hp: number } | undefined;
    this.room.state.enemies.forEach((e) => {
      if (e.kind === "old-rust") boss = e;
    });
    const bossMax = ENEMY_KINDS["old-rust"]?.hp ?? 420;
    const present = !!boss;
    if (present && boss) {
      this.bossBarBg.setPosition(cam.width / 2, 40).setVisible(true);
      this.bossBarFill.setPosition(cam.width / 2 - 258, 48).setVisible(true);
      this.bossBarFill.width = 516 * Math.max(0, Math.min(1, boss.hp / bossMax));
      this.bossText.setPosition(cam.width / 2, 38).setVisible(true);
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
    if (won) this.victoryText.setPosition(cam.width / 2, cam.height / 2);
  }

  /** A big transient centered banner that fades (boss approach, etc.). */
  private flashBanner(msg: string, color: string): void {
    const cam = this.cameras.main;
    const t = this.add
      .text(cam.width / 2, cam.height / 2 - 80, msg, { fontSize: "32px", color, fontStyle: "bold" })
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
      dex: { name: "DEX", desc: "+ attack speed", color: 0x6fd6ff },
      int: { name: "INT", desc: "+ spell / signature power", color: 0xb07bd6 },
      con: { name: "CON", desc: "+ max HP & regen", color: 0x9cff3b },
      luk: { name: "LUK", desc: "+ luck & rarity", color: 0xffd479 },
    };

  /** Build the dim overlay + 5 attribute buttons for the §12 flex-point pick. */
  private buildLevelWindow(self: PlayerState): void {
    const cam = this.cameras.main;
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    const dim = this.add
      .rectangle(cx, cy, cam.width, cam.height, 0x05040a, 0.66)
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
    if (self) this.cameras.main.centerOn(self.x, self.y);
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

      const isSelf = id === selfId;
      blob.animate(this.time.now, {
        moveX: mx,
        moveY: my,
        aimX: isSelf ? aimX : 0,
        aimY: isSelf ? aimY : 0,
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
    if (!self || !self.alive || self.flexPending > 0) return;
    if (!this.input.activePointer.rightButtonDown() || this.localAtkCd > 0) return;
    const weapon = WEAPONS[self.weapon] ?? WEAPONS[DEFAULT_WEAPON];
    // Thrown weapons need a charge — don't animate/fire when empty (server gates it too, §10).
    if (weapon?.thrown && self.charges <= 0) return;
    this.localAtkCd = weapon?.cooldown ?? 0.3;
    const rig = this.blobs.get(selfId);
    rig?.triggerSwing(this.time.now);
    // Cursor world position (for slam-at-cursor weapons).
    const cam = this.cameras.main;
    const px = this.pointerScreen.set ? this.pointerScreen.x : this.input.activePointer.x;
    const py = this.pointerScreen.set ? this.pointerScreen.y : this.input.activePointer.y;
    const cwx = px + cam.scrollX;
    const cwy = py + cam.scrollY;
    if (weapon?.quake) {
      // Epicenter = cursor, clamped to QUAKE_REACH from the character (matches the server).
      const sx = rig?.x ?? self.x;
      const sy = rig?.y ?? self.y;
      let ex = cwx;
      let ey = cwy;
      const dx = ex - sx;
      const dy = ey - sy;
      const dd = Math.hypot(dx, dy);
      if (dd > QUAKE_REACH) {
        ex = sx + (dx / dd) * QUAKE_REACH;
        ey = sy + (dy / dd) * QUAKE_REACH;
      }
      this.spawnQuake(ex, ey, weapon.quake);
      this.hitStop(130);
    } else if (weapon && !weapon.thrown) {
      // Plain melee swing (e.g. the dual Bowie Fangs) → a slash-arc VFX (§14).
      this.spawnSlash(rig?.x ?? self.x, rig?.y ?? self.y, this.selfAim, weapon);
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
    if (!self || !self.alive || self.flexPending > 0) return;
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
      .text(cam.width / 2, cam.height / 2 - 120, "LEVEL UP!", {
        fontSize: "30px",
        color: "#ffd479",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100003);
    this.tweens.add({
      targets: toast,
      y: cam.height / 2 - 150,
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
    const cam = this.cameras.main;
    const selfId = this.room?.sessionId;
    const self = selfId ? this.room?.state.players.get(selfId) : undefined;

    const barX = 20;
    const barY = cam.height - 24;
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

    this.restartBtn.setPosition(cam.width - 14, 14);
    // Weapon name + (for thrown weapons) a charge readout — filled/empty pips, or "reloading…".
    let charges = "";
    if (self && self.maxCharges > 0) {
      charges =
        self.charges > 0
          ? `   ${"◆".repeat(self.charges)}${"◇".repeat(Math.max(0, self.maxCharges - self.charges))}`
          : "   ⟳ reloading…";
    }
    this.weaponText
      .setPosition(barX, xpY - 24)
      .setText(
        self ? `⚔ ${WEAPONS[self.weapon]?.name ?? self.weapon}${charges}   ·   Q to cycle` : "",
      );

    const training = this.room?.state.mode === "training";
    this.modeText
      .setPosition(cam.width / 2, 12)
      .setText(
        training
          ? "⛶ TESTING GROUNDS — walk onto a weapon to equip · swing at the dummies · T to exit"
          : "Survive until OLD RUST, then extract · B: summon boss now · T: Testing Grounds",
      )
      .setColor(training ? "#33e6ff" : "#5a6472");

    const downed = !!self && !self.alive;
    this.deathText.setVisible(downed);
    if (downed) this.deathText.setPosition(cam.width / 2, cam.height / 2);
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

  /** The bottom ICON stat row for a weapon — iconography, no words (§9/§10). */
  private weaponStatRows(def?: WeaponDef): { icon: string; value: string }[] {
    if (!def) return [];
    const r: { icon: string; value: string }[] = [];
    if (def.thrown) {
      r.push({ icon: "reach", value: String(def.thrown.range) });
      r.push({ icon: "speed", value: `${def.cooldown}s` });
      r.push({ icon: "pierce", value: String(def.thrown.pierce) });
    } else {
      r.push({ icon: "reach", value: String(def.range) });
      r.push({ icon: "speed", value: `${def.cooldown}s` });
      if (def.quake) r.push({ icon: "aoe", value: String(def.quake.radius) });
    }
    return r.slice(0, 3);
  }

  /** Draw a small vector stat icon into `g` at (x,y), radius ~s (matches the card mock). */
  private drawStatIcon(
    g: Phaser.GameObjects.Graphics,
    kind: string,
    x: number,
    y: number,
    s: number,
    color: number,
  ): void {
    g.lineStyle(1.6, color, 1);
    if (kind === "reach") {
      g.lineBetween(x - s, y, x + s, y);
      g.lineBetween(x - s, y, x - s + s * 0.4, y - s * 0.4);
      g.lineBetween(x - s, y, x - s + s * 0.4, y + s * 0.4);
      g.lineBetween(x + s, y, x + s - s * 0.4, y - s * 0.4);
      g.lineBetween(x + s, y, x + s - s * 0.4, y + s * 0.4);
    } else if (kind === "speed") {
      g.strokeCircle(x, y + s * 0.1, s * 0.8);
      g.lineBetween(x, y + s * 0.1, x, y - s * 0.35);
      g.lineBetween(x, y + s * 0.1, x + s * 0.45, y + s * 0.1);
    } else if (kind === "aoe") {
      g.fillStyle(color, 0.3).fillCircle(x, y, s * 0.35);
      g.lineStyle(1.6, color, 0.6).strokeCircle(x, y, s * 0.78);
    } else if (kind === "pierce") {
      g.lineBetween(x - s, y, x + s, y);
      g.lineBetween(x + s, y, x + s - s * 0.5, y - s * 0.4);
      g.lineBetween(x + s, y, x + s - s * 0.5, y + s * 0.4);
    } else {
      // damage dagger
      g.fillStyle(color, 0.25).fillTriangle(x, y - s, x + s * 0.34, y + s * 0.5, x - s * 0.34, y + s * 0.5);
      g.lineBetween(x, y + s * 0.5, x, y + s);
      g.lineBetween(x - s * 0.45, y + s * 0.62, x + s * 0.45, y + s * 0.62);
    }
  }

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
    } else {
      ctx.fillStyle = "#15120d";
      ctx.fillRect(0, 0, W, H);
    }
    this.textures.addCanvas(key, canvas);
    return key;
  }

  /** Build one card: full-bleed art + overlaid info panel (name, subtitle, damage EQUATION, scaling
   *  grade chips, icon stat row), a corner CHARGES badge + grip pill. Matches the redesign mock. */
  private buildCard(id: string): {
    id: string;
    container: Phaser.GameObjects.Container;
    readout: Phaser.GameObjects.Text;
    eq: Phaser.GameObjects.Text;
    badge: Phaser.GameObjects.Text;
  } {
    const def = WEAPONS[id];
    const W = 212;
    const H = 296;
    const R = 14;
    const accent = ArenaScene.WEAPON_ACCENT[id] ?? 0xb9975b;
    const accentHex = `#${accent.toString(16).padStart(6, "0")}`;
    const o: Phaser.GameObjects.GameObject[] = [];
    const L = -W / 2;
    const T = -H / 2;

    // Full-bleed art (baked rounded texture) + a bottom gradient panel for legibility.
    o.push(this.add.image(0, 0, this.bakeCardArt(id, W, H, R)));
    const panel = this.add.graphics();
    panel
      .fillGradientStyle(0x0a0805, 0x0a0805, 0x070503, 0x070503, 0, 0, 0.92, 0.97)
      .fillRect(L, T + H * 0.44, W, H * 0.56);
    o.push(panel);

    // Border.
    const frame = this.add.graphics();
    frame.lineStyle(3, accent, 0.92).strokeRoundedRect(L + 1.5, T + 1.5, W - 3, H - 3, R);
    frame.lineStyle(1, 0x000000, 0.4).strokeRoundedRect(L + 5, T + 5, W - 10, H - 10, R - 4);
    o.push(frame);

    // Top-left CHARGES badge (live on the held card; static max otherwise; hidden if no charges).
    const hasCharges = !!def?.thrown;
    const badgeBg = this.add.graphics();
    if (hasCharges) {
      badgeBg.fillStyle(0x0c0a07, 0.82).fillCircle(L + 24, T + 24, 16);
      badgeBg.lineStyle(2, accent, 1).strokeCircle(L + 24, T + 24, 16);
    }
    o.push(badgeBg);
    const badge = this.add
      .text(L + 24, T + 24, hasCharges ? String(def?.thrown?.charges ?? "") : "", {
        fontSize: "15px",
        color: "#f0ead8",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    o.push(badge);

    // Top-right grip pill.
    const grip = def?.dual ? "DUAL" : def?.twoHanded ? "2-HAND" : "1H";
    const pillBg = this.add.graphics();
    pillBg.fillStyle(0x0c0a07, 0.8).fillRoundedRect(W / 2 - 64, T + 12, 52, 20, 10);
    pillBg.lineStyle(1, accent, 0.6).strokeRoundedRect(W / 2 - 64, T + 12, 52, 20, 10);
    o.push(pillBg);
    o.push(
      this.add
        .text(W / 2 - 38, T + 22, grip, { fontSize: "10px", color: accentHex, fontStyle: "bold" })
        .setOrigin(0.5),
    );

    // Name + subtitle.
    const nameY = T + H * 0.6;
    o.push(
      this.add
        .text(L + 12, nameY, def?.name ?? id, { fontSize: "18px", color: "#f6efe0", fontStyle: "bold" })
        .setOrigin(0, 0),
    );
    const sub = def ? `${def.tags.family} · ${def.tags.element}`.toUpperCase() : "";
    o.push(this.add.text(L + 12, nameY + 22, sub, { fontSize: "10px", color: "#b9b3a3" }).setOrigin(0, 0));
    const div = this.add.graphics();
    div.lineStyle(1, accent, 0.35).lineBetween(L + 12, nameY + 38, W / 2 - 12, nameY + 38);
    o.push(div);

    // Damage EQUATION (live): a dagger icon + "base + bonus = total".
    const eqIcon = this.add.graphics();
    this.drawStatIcon(eqIcon, "dmg", L + 22, nameY + 58, 9, 0xff8a2b);
    o.push(eqIcon);
    const eq = this.add
      .text(L + 38, nameY + 49, "", { fontSize: "17px", color: "#ffd479", fontStyle: "bold" })
      .setOrigin(0, 0);
    o.push(eq);

    // Scaling grade chips (static).
    const grades = def?.scalingGrades ?? { str: "B" };
    let cx = L + 12;
    const chipY = H / 2 - 80;
    for (const [attr, g] of Object.entries(grades) as [string, string][]) {
      const col = ArenaScene.GRADE_COL[g] ?? 0x9a9484;
      const cw = 48;
      const chip = this.add.graphics();
      chip.fillStyle(0x000000, 0.45).fillRoundedRect(cx, chipY, cw, 19, 5);
      chip.lineStyle(1, col, 0.7).strokeRoundedRect(cx, chipY, cw, 19, 5);
      o.push(chip);
      o.push(
        this.add
          .text(cx + 7, chipY + 9.5, attr.toUpperCase(), { fontSize: "10px", color: "#cfc6ae" })
          .setOrigin(0, 0.5),
      );
      o.push(
        this.add
          .text(cx + cw - 7, chipY + 9.5, g, {
            fontSize: "12px",
            color: `#${col.toString(16).padStart(6, "0")}`,
            fontStyle: "bold",
          })
          .setOrigin(1, 0.5),
      );
      cx += cw + 7;
    }

    // Icon stat row (static).
    const stats = this.weaponStatRows(def);
    const colW = W / Math.max(1, stats.length);
    const rowY = H / 2 - 38;
    const icons = this.add.graphics();
    for (let i = 0; i < stats.length; i++) {
      const st = stats[i];
      if (!st) continue;
      const sx = L + colW * (i + 0.5);
      this.drawStatIcon(icons, st.icon, sx, rowY, 9, 0xcfc6ae);
      o.push(
        this.add
          .text(sx, rowY + 20, st.value, { fontSize: "13px", color: "#f0ead8", fontStyle: "bold" })
          .setOrigin(0.5, 0),
      );
    }
    o.push(icons);

    // Live charge/ready readout (held card only) — small, bottom edge.
    const readout = this.add
      .text(0, H / 2 - 16, "", { fontSize: "11px", color: accentHex, fontStyle: "bold" })
      .setOrigin(0.5, 0);
    o.push(readout);

    // Crisp text — Phaser Text defaults to resolution 1, which blurs on high-DPI displays and when
    // the carousel scales cards. Render the text atlases at device resolution (min 2×).
    const res = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
    for (const obj of o) if (obj instanceof Phaser.GameObjects.Text) obj.setResolution(res);

    const container = this.add.container(0, 0, o).setScrollFactor(0).setDepth(100000);
    return { id, container, readout, eq, badge };
  }

  /** Fan the hand at the bottom: held card centered/upright/big with live charges; others smaller,
   *  rotated, fanned to the sides (prev left / next right, §9). */
  private updateCarousel(): void {
    if (!this.room || this.carousel.length === 0) return;
    const cam = this.cameras.main;
    const self = this.room.state.players.get(this.room.sessionId);
    const ids = WEAPON_IDS;
    const n = ids.length;
    const si = Math.max(0, ids.indexOf(self?.weapon ?? ids[0] ?? ""));
    const cx = cam.width / 2;
    const selY = cam.height - 170;
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
      // Live damage EQUATION off the player's real attributes (§10 base × scaling grades).
      if (def && self) {
        const base = def.thrown ? def.thrown.damage : def.damage;
        const mult = weaponDamageMult(def, {
          str: self.str,
          dex: self.dex,
          int: self.int,
          con: self.con,
          luk: self.luk,
        });
        const total = Math.round(base * mult);
        card.eq.setText(`${base} + ${total - base} = ${total}`);
      }
      // Corner charges badge: live remaining on the held card, static max otherwise.
      if (def?.thrown) {
        card.badge.setText(String(isSel && self ? self.charges : def.thrown.charges));
      }
      // Ready/reload readout (held card only).
      let txt = "";
      if (isSel && self) {
        if (self.maxCharges > 0) {
          txt = self.charges > 0 ? "● READY" : "⟳ RELOADING";
        } else txt = "● READY";
      }
      card.readout.setText(txt).setVisible(isSel);
    }
  }

  /** Melee swing slash (§14): a bright crescent sweeping through the swing arc (dual = two). */
  private spawnSlash(x: number, y: number, aim: { x: number; y: number }, weapon: WeaponDef): void {
    const ang = Math.atan2(aim.y, aim.x);
    const r = (weapon.range ?? 100) * 0.7;
    const arcs = weapon.dual ? [-0.35, 0.35] : [0];
    for (const off of arcs) {
      const a0 = Phaser.Math.RadToDeg(ang - weapon.halfArc + off);
      const a1 = Phaser.Math.RadToDeg(ang + weapon.halfArc + off);
      const slash = this.add
        .arc(x, y, r, a0, a1, false)
        .setClosePath(false)
        .setStrokeStyle(5, 0xeafcff, 0.92)
        .setDepth(99000);
      this.tweens.add({
        targets: slash,
        scale: 1.18,
        alpha: 0,
        duration: 170,
        ease: "Cubic.easeOut",
        onComplete: () => slash.destroy(),
      });
    }
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
