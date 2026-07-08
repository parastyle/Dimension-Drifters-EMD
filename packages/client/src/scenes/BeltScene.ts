import Phaser from "phaser";
import { CAM_FOLLOW_TAU, DEPTH_MAX } from "@dd/shared";
import { SPRITE_ATLAS, SpriteRig } from "../entities/SpriteRig.js";
import {
  depthRenderScale,
  floorScreenY,
  FRONT,
  HORIZON,
  VIRTUAL_H,
} from "./arena/belt-projection.js";

/**
 * §29 v0.118 BELT SCENE (Stage 1) — the beat-'em-up (TMNT: Shredder's Revenge) view rendered in the REAL
 * Phaser client using the REAL character art (SpriteRig) and the shared belt-projection. Reachable from the
 * menu (a "Belt (beta)" button) or `?belt=1`; ArenaScene (top-down) is left completely untouched.
 *
 * This stage proves the belt transform in-engine: the floor plane is (x = belt, z = DEPTH into a shallow
 * band), the camera belt-scrolls horizontally with a locked vertical, actors are feet-anchored + projected
 * (`screenY = HORIZON + z*DEPTH_SCALE − height`) and DEPTH-SORTED by z, over a parallax sky-carrier
 * backdrop with drifting clouds. Combat, rooms/gates, shop/bag and the server-authoritative belt sim land in
 * the following stages (docs/BEATEMUP_CONVERSION.md); here movement is local so the look/feel is drivable.
 */

const VIRTUAL_W = 1920;
const LEVEL_W = VIRTUAL_W * 6; // ~6 screens of deck to roam
const MOVE_SPEED = 430; // px/s along the belt (virtual units)
const DASH_SPEED = 1180;
const JUMP_V = 1180;
const GRAVITY = 3600;

interface Walker {
  rig: SpriteRig;
  x: number;
  z: number;
  h: number;
  vh: number;
  face: number;
  walkT: number;
  homeX?: number;
  dir?: number;
  spd?: number;
}

export class BeltScene extends Phaser.Scene {
  private player!: Walker;
  private crowd: Walker[] = [];
  private camX = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private clouds: { ts: Phaser.GameObjects.TileSprite; scroll: number; drift: number }[] = [];
  private islands: Phaser.GameObjects.Image[] = [];
  private deck!: Phaser.GameObjects.TileSprite;
  private chevrons!: Phaser.GameObjects.TileSprite;
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super("belt");
  }

  preload(): void {
    // Same atlas ArenaScene uses, so SpriteRig finds the real character/enemy parts.
    if (!this.textures.exists(SPRITE_ATLAS)) {
      this.load.multiatlas(SPRITE_ATLAS, "sprites/dd-sprites.json", "sprites");
    }
  }

  create(): void {
    this.buildTextures();
    const cam = this.cameras.main;
    cam.setOrigin(0, 0);
    cam.setBackgroundColor("#0b1622");
    this.fitCamera();
    this.scale.on("resize", () => this.fitCamera());

    // ── Parallax backdrop (far → near) ──────────────────────────────────────────────────────────
    this.add
      .image(0, 0, "belt-sky")
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-100)
      .setDisplaySize(VIRTUAL_W, VIRTUAL_H);
    for (const spec of [
      { key: "belt-cloud", y: 90, scroll: 0.08, drift: 9, depth: -90, alpha: 0.7 },
      { key: "belt-cloud", y: 240, scroll: 0.16, drift: 15, depth: -80, alpha: 0.95 },
    ]) {
      const ts = this.add
        .tileSprite(0, spec.y, VIRTUAL_W, 220, spec.key)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(spec.depth)
        .setAlpha(spec.alpha);
      this.clouds.push({ ts, scroll: spec.scroll, drift: spec.drift });
    }
    // carrier islands (mid parallax) placed down the deck
    for (let ix = 400; ix < LEVEL_W; ix += VIRTUAL_W * 1.4) {
      this.islands.push(
        this.add
          .image(ix, HORIZON - 30, "belt-island")
          .setOrigin(0.5, 1)
          .setDepth(-60),
      );
    }
    // the deck band (scrolls with camera) + centreline chevrons
    this.deck = this.add
      .tileSprite(0, HORIZON - 24, VIRTUAL_W, FRONT - HORIZON + 80, "belt-deck")
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(0);
    this.chevrons = this.add
      .tileSprite(
        0,
        HORIZON + DEPTH_MAX * 0.5 * ((FRONT - HORIZON) / DEPTH_MAX) - 18,
        VIRTUAL_W,
        36,
        "belt-chevron",
      )
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1);
    // near safety lip (foreground)
    this.add
      .image(0, FRONT + 8, "belt-lip")
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100000)
      .setDisplaySize(VIRTUAL_W, VIRTUAL_H - FRONT - 8);

    // ── Actors ──────────────────────────────────────────────────────────────────────────────────
    this.player = this.makeWalker("drifter", 300, DEPTH_MAX * 0.6, true);
    const kinds = ["critter", "mote-swarm", "critter"];
    for (let i = 0; i < 5; i++) {
      const w = this.makeWalker(kinds[i % kinds.length]!, 900 + i * 520, 60 + (i % 3) * 200, false);
      w.homeX = w.x;
      w.dir = i % 2 ? 1 : -1;
      w.spd = 90 + Math.random() * 60;
      this.crowd.push(w);
    }

    // ── Input + HUD ───────────────────────────────────────────────────────────────────────────
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys("W,A,S,D,SHIFT,SPACE,UP,DOWN,LEFT,RIGHT,ESC") as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    this.hint = this.add
      .text(
        24,
        24,
        "SKY CARRIER · belt (beta)\nWASD walk + step into depth · Space jump · Shift dash · Esc → menu",
        { fontFamily: "monospace", fontSize: "26px", color: "#eaf2ff", lineSpacing: 6 },
      )
      .setScrollFactor(0)
      .setDepth(100002)
      .setShadow(0, 2, "#04101c", 4);
    kb.on("keydown-ESC", () => this.scene.start("menu"));
  }

  private makeWalker(spriteId: string, x: number, z: number, isSelf: boolean): Walker {
    const rig = new SpriteRig(
      this,
      x,
      floorScreenY(z),
      isSelf,
      isSelf ? "self" : `n${x}`,
      spriteId,
    );
    return { rig, x, z, h: 0, vh: 0, face: 1, walkT: 0 };
  }

  /** Fit the belt's virtual height into the render buffer (HD 1080 fills the screen height; width shows more). */
  private fitCamera(): void {
    const cam = this.cameras.main;
    const zoom = this.scale.height / VIRTUAL_H;
    cam.setZoom(zoom);
    cam.setSize(this.scale.width, this.scale.height);
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    const k = this.keys;
    const held = (...ks: string[]) => ks.some((n) => k[n]?.isDown);

    // ── player belt movement (x + depth + jump) ──
    let mx = (held("D", "RIGHT") ? 1 : 0) - (held("A", "LEFT") ? 1 : 0);
    let mz = (held("S", "DOWN") ? 1 : 0) - (held("W", "UP") ? 1 : 0);
    const dashing = held("SHIFT") && (mx !== 0 || mz !== 0);
    const sp = dashing ? DASH_SPEED : MOVE_SPEED;
    const p = this.player;
    if (mx || mz) {
      const l = Math.hypot(mx, mz) || 1;
      mx /= l;
      mz /= l;
      p.x = Phaser.Math.Clamp(p.x + mx * sp * dt, 40, LEVEL_W - 40);
      p.z = Phaser.Math.Clamp(p.z + mz * sp * dt, 12, DEPTH_MAX);
      if (mx) p.face = mx > 0 ? 1 : -1;
      p.walkT += dt;
    }
    if (held("SPACE") && p.h === 0) p.vh = JUMP_V;
    if (p.h > 0 || p.vh !== 0) {
      p.h += p.vh * dt;
      p.vh -= GRAVITY * dt;
      if (p.h <= 0) {
        p.h = 0;
        p.vh = 0;
      }
    }
    const moveMag = mx || mz ? sp : 0;
    this.placeRig(p, moveMag, mx, mz, true);

    // ── ambient crowd patrol (shows depth-sort + the real enemy art in perspective) ──
    for (const c of this.crowd) {
      c.x += (c.dir ?? 1) * (c.spd ?? 90) * dt;
      if (Math.abs(c.x - (c.homeX ?? c.x)) > 260) c.dir = -(c.dir ?? 1);
      c.face = c.dir ?? 1;
      c.walkT += dt;
      this.placeRig(c, c.spd ?? 90, c.dir ?? 1, 0, false);
    }

    // ── belt camera: eased horizontal follow, clamped; vertical locked ──
    const want = Phaser.Math.Clamp(p.x - VIRTUAL_W * 0.42, 0, Math.max(0, LEVEL_W - VIRTUAL_W));
    this.camX += (want - this.camX) * (1 - Math.exp(-dt / CAM_FOLLOW_TAU));
    this.cameras.main.setScroll(this.camX, 0);

    // ── parallax: clouds drift independent of camera; deck/chevrons/islands scroll by camera ──
    for (const cl of this.clouds)
      cl.ts.tilePositionX = this.camX * cl.scroll + _time * 0.001 * cl.drift;
    this.deck.tilePositionX = this.camX;
    this.chevrons.tilePositionX = this.camX;
    for (const im of this.islands) im.x = im.getData("bx") ?? im.x; // static world x (parallax via scrollFactor default 1 → move with world)
  }

  /** Project a walker onto the belt: feet at floor row, jump via setHop, depth-scaled, y-sorted by z. */
  private placeRig(w: Walker, speed: number, mx: number, mz: number, isSelf: boolean): void {
    w.rig.setRigScale(depthRenderScale(w.z));
    w.rig.setPosition(w.x, floorScreenY(w.z));
    w.rig.setHop(w.h); // lift the art; SpriteRig keeps its shadow on the floor
    w.rig.setDepth(100 + w.z); // NEARER (bigger z) draws in front
    w.rig.animate(this.time.now, {
      moveX: mx,
      moveY: mz,
      speed,
      aimX: w.face,
      aimY: 0,
      aimDir: w.face > 0 ? 0 : Math.PI,
      isSelf,
    });
  }

  /** Build the procedural belt textures once (self-contained — no new art assets needed for Stage 1). */
  private buildTextures(): void {
    // sky gradient + sun
    this.makeCanvasTexture("belt-sky", VIRTUAL_W, VIRTUAL_H, (g, w, h) => {
      const sky = g.createLinearGradient(0, 0, 0, FRONT);
      sky.addColorStop(0, "#2b74b8");
      sky.addColorStop(0.55, "#79bce9");
      sky.addColorStop(1, "#cfeaf7");
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h);
      const sun = g.createRadialGradient(w * 0.8, 130, 20, w * 0.8, 130, 340);
      sun.addColorStop(0, "rgba(255,246,214,0.9)");
      sun.addColorStop(1, "rgba(255,246,214,0)");
      g.fillStyle = sun;
      g.fillRect(0, 0, w, HORIZON);
    });
    // a soft cloud tile
    this.makeCanvasTexture("belt-cloud", 520, 220, (g) => {
      for (let i = 0; i < 16; i++) {
        const px = 40 + Math.random() * 440;
        const py = 70 + Math.random() * 90;
        const r = 40 + Math.random() * 60;
        const rg = g.createRadialGradient(px, py - 10, 8, px, py, r);
        rg.addColorStop(0, "rgba(255,255,255,0.9)");
        rg.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = rg;
        g.beginPath();
        g.arc(px, py, r, 0, 7);
        g.fill();
      }
    });
    // carrier island silhouette
    this.makeCanvasTexture("belt-island", 460, 320, (g, w, h) => {
      const st = (x: number, y: number, ww: number, hh: number, a: string, b: string) => {
        const lg = g.createLinearGradient(0, y, 0, y + hh);
        lg.addColorStop(0, a);
        lg.addColorStop(1, b);
        g.fillStyle = lg;
        g.fillRect(x, y, ww, hh);
      };
      st(90, 120, 260, 200, "#5b6b7d", "#39434f");
      st(140, 40, 150, 100, "#6b7d90", "#434f5c");
      g.fillStyle = "#ffe9a8";
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 5; j++) g.fillRect(155 + j * 26, 60 + i * 26, 16, 15);
      st(290, 140, 78, 180, "#6b7d90", "#434f5c");
      g.fillStyle = "#ffd24a";
      g.fillRect(200, 30, 12, 8);
    });
    // deck plating band (tiles horizontally)
    this.makeCanvasTexture("belt-deck", 240, FRONT - HORIZON + 80, (g, w, h) => {
      const dk = g.createLinearGradient(0, 0, 0, h);
      dk.addColorStop(0, "#3c4653");
      dk.addColorStop(0.12, "#40464d");
      dk.addColorStop(1, "#5a616a");
      g.fillStyle = dk;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(18,24,30,0.5)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, 24);
      g.lineTo(0, h);
      g.stroke();
    });
    // yellow warning chevrons (tiles horizontally)
    this.makeCanvasTexture("belt-chevron", 130, 36, (g) => {
      g.fillStyle = "rgba(255,210,74,0.75)";
      g.beginPath();
      g.moveTo(0, 4);
      g.lineTo(26, 18);
      g.lineTo(0, 32);
      g.closePath();
      g.fill();
    });
    // near safety lip
    this.makeCanvasTexture("belt-lip", 40, 40, (g, w, h) => {
      g.fillStyle = "#2a3037";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#ffd24a";
      g.fillRect(0, 0, 22, 4);
    });
  }

  private makeCanvasTexture(
    key: string,
    w: number,
    h: number,
    draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  ): void {
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.createCanvas(key, w, h);
    const g = tex?.getContext();
    if (g) {
      draw(g, w, h);
      tex?.refresh();
    }
  }
}
