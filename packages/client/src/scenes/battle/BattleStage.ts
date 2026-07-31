import Phaser from "phaser";
import manifest from "./overgrown-ruin.manifest.json" with { type: "json" };

/**
 * Overgrown Ruin V3 — the first battle backdrop of the squad-autobattler direction.
 *
 * This renders the layered scene exactly as its handoff package specifies. `manifest.json` ships
 * alongside the art and is the SOURCE OF TRUTH for placement, pivots, scale and timing — every number
 * below is read from it rather than copied, so re-exporting the art updates the scene for free.
 *
 * Layer order is a contract from the handoff and must not be reordered:
 *   1 deep background (static — never scrolls)
 *   2 parallax bird       (behind the stage plate, so it passes through the plate's openings)
 *   3 stage plate         (has transparent gaps the deep background shows through)
 *   4 battleground ferns  (above the plate, below actors)
 *   5 CHARACTERS + VFX    <- `actorLayer`, where the fight will live
 *   6 foreground lens overlay (above everything)
 *
 * Everything here is presentation only. No gameplay, no simulation, no randomness — when the fight
 * arrives it goes into `actorLayer` and this file should not need to change.
 */

const ASSET_ROOT = "scenes/overgrown-ruin";
const TEXTURE_PREFIX = "ruin:";

/** Authored against a 3840x2160 virtual canvas; every manifest coordinate is in that space. */
const CANVAS_W = manifest.canvas.width;
const CANVAS_H = manifest.canvas.height;

/** The handoff notes preview sway is deliberately exaggerated: "reduce by ~50% for a subtler idle". */
const FERN_SWAY_SCALE = 0.5;

/** The vertical slice that must stay on screen in fill mode — the band the fight is fought in, plus air. */
const MIN_VISIBLE_CANVAS_H = 1560;

type FernPiece = (typeof manifest.battleground_fern_pieces)[number];

interface SwayingFern {
  readonly image: Phaser.GameObjects.Image;
  readonly baseX: number;
  readonly rotationRad: number;
  readonly translationX: number;
  readonly translationY: number;
  readonly periodMs: number;
  /** Advances every frame — each fern keeps its own authored phase so they never sway in lockstep. */
  phaseMs: number;
}

/** Strip the manifest's package-relative path down to a stable texture key. */
function textureKey(path: string): string {
  return TEXTURE_PREFIX + path.replace(/^.*\//, "").replace(/\.png$/i, "");
}

export class BattleStage {
  /** Characters, weapons and VFX belong here — between the ferns and the lens overlay. */
  readonly actorLayer: Phaser.GameObjects.Container;

  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly ferns: SwayingFern[] = [];
  private bird?: Phaser.GameObjects.Image;
  private birdFlapMs = 0;
  private birdFrame: 0 | 1 = 0;
  private birdTravelMs = 0;
  private fillMode = false;

  static preload(scene: Phaser.Scene): void {
    const load = (path: string): void => {
      scene.load.image(textureKey(path), `${ASSET_ROOT}/${path}`);
    };
    for (const path of Object.values(manifest.layers)) {
      // The placement-preview layer is authoring reference, not a runtime layer.
      if (path.includes("placement")) continue;
      load(path);
    }
    for (const fern of manifest.battleground_fern_pieces) load(fern.cropped_path);
    for (const frame of manifest.parallax_bird_actor.flap_animation.normalized_frames) load(frame);
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.root = scene.add.container(0, 0);
    this.actorLayer = scene.add.container(0, 0);

    this.addLayer(manifest.layers["deep-background-static"]);
    this.addBird();
    this.addLayer(manifest.layers["stage-plate-clean"]);
    this.addFerns();
    this.root.add(this.actorLayer); // 5 — characters + VFX
    this.addLayer(manifest.layers["foreground-lens-overlay"]);

    this.fit();
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.fit, this);
  }

  /** Full-canvas layers are placed from the top-left of the virtual canvas. */
  private addLayer(path: string): void {
    this.root.add(this.scene.add.image(0, 0, textureKey(path)).setOrigin(0, 0));
  }

  private addBird(): void {
    const actor = manifest.parallax_bird_actor;
    const [firstFrame] = actor.flap_animation.normalized_frames;
    if (!firstFrame) return;
    const motion = actor.suggested_motion;
    const [fromX = 0, fromY = 0] = motion.from_xy;
    this.bird = this.scene.add
      .image(fromX, fromY, textureKey(firstFrame))
      .setOrigin(0.5, 0.5)
      .setScale(motion.scale);
    this.root.add(this.bird);
  }

  private addFerns(): void {
    for (const fern of manifest.battleground_fern_pieces as readonly FernPiece[]) {
      const place = fern.suggested_stage_placement;
      const anim = fern.suggested_animation;
      // The manifest pivot is in the CROPPED image's own pixel space; convert to a 0..1 origin so the
      // anchor sits at the base of the plant exactly as authored.
      const cropW = fern.source_sheet_bounds_xywh[2] ?? 1;
      const cropH = fern.source_sheet_bounds_xywh[3] ?? 1;
      const [pivotX = 0, pivotY = 0] = fern.pivot_local_xy;
      const [anchorX = 0, anchorY = 0] = place.anchor_world_xy;
      const image = this.scene.add
        .image(anchorX, anchorY, textureKey(fern.cropped_path))
        .setOrigin(pivotX / cropW, pivotY / cropH)
        .setScale(place.scale);
      this.root.add(image);
      this.ferns.push({
        image,
        baseX: anchorX,
        rotationRad: Phaser.Math.DegToRad(anim.rotation_degrees * FERN_SWAY_SCALE),
        translationX: (anim.translation_px[0] ?? 0) * FERN_SWAY_SCALE,
        translationY: (anim.translation_px[1] ?? 0) * FERN_SWAY_SCALE,
        periodMs: anim.period_seconds * 1000,
        phaseMs: anim.phase_seconds * 1000,
      });
    }
    this.ferns.sort(
      (a, b) => a.image.y - b.image.y, // nearer ferns draw later
    );
  }

  /**
   * Fit the 16:9 virtual canvas into whatever viewport we actually have.
   *
   * CONTAIN (default) preserves the whole frame, so a display wider than 16:9 gets pillarbox bars — that is
   * not a bug, it is what showing 16:9 art on a 21:9 screen means. COVER fills the display instead and
   * crops the surplus off the top and bottom.
   *
   * Cropping is safe here because the fight is deliberately confined to a band in the middle of the plate
   * (see the roster's lane comments): at 21:9 cover removes ~260px top and bottom of a 2160 canvas, which
   * is sky and foreground vine, well clear of the ~1040-1820 band the units occupy. `MIN_VISIBLE_CANVAS_H`
   * keeps that true on even wider displays by refusing to crop past it.
   *
   * ONLY `root` is transformed. `actorLayer` is a child of `root` and inherits this for free — scaling it
   * here as well applied the fit twice, rendering the fight at a third of its size in the top-left corner
   * while the backdrop behind it looked perfectly correct.
   */
  private fit(): void {
    const { width, height } = this.scene.scale;
    const contain = Math.min(width / CANVAS_W, height / CANVAS_H);
    const cover = Math.max(width / CANVAS_W, height / CANVAS_H);
    // Never crop so hard that the units' band leaves the screen.
    const maxCrop = height / MIN_VISIBLE_CANVAS_H;
    const scale = this.fillMode ? Math.min(cover, maxCrop) : contain;
    this.root.setScale(scale);
    this.root.setPosition((width - CANVAS_W * scale) / 2, (height - CANVAS_H * scale) / 2);
  }

  /** Fill the display (cropping the frame's margins) instead of showing the whole 16:9 frame. */
  setFillMode(on: boolean): void {
    if (this.fillMode === on) return;
    this.fillMode = on;
    this.fit();
  }

  get filling(): boolean {
    return this.fillMode;
  }

  update(deltaMs: number): void {
    this.stepBird(deltaMs);
    this.stepFerns(deltaMs);
  }

  private stepBird(deltaMs: number): void {
    const bird = this.bird;
    if (!bird) return;
    const actor = manifest.parallax_bird_actor;
    const flap = actor.flap_animation;
    const motion = actor.suggested_motion;

    this.birdFlapMs += deltaMs;
    const frameMs = flap.frame_duration_seconds * 1000;
    while (this.birdFlapMs >= frameMs) {
      this.birdFlapMs -= frameMs;
      this.birdFrame = this.birdFrame === 0 ? 1 : 0;
      const frame = flap.normalized_frames[this.birdFrame];
      if (frame) bird.setTexture(textureKey(frame));
    }

    // Loops across the sky. The handoff is explicit that the deep background never scrolls — only the
    // bird moves, which is what sells the parallax without touching the static plate behind it.
    this.birdTravelMs = (this.birdTravelMs + deltaMs) % (motion.duration_seconds * 1000);
    const t = this.birdTravelMs / (motion.duration_seconds * 1000);
    const bob = Math.sin(t * Math.PI * 2 * 3) * motion.bob_px;
    const [fromX = 0, fromY = 0] = motion.from_xy;
    const [toX = 0, toY = 0] = motion.to_xy;
    bird.setPosition(Phaser.Math.Linear(fromX, toX, t), Phaser.Math.Linear(fromY, toY, t) + bob);
  }

  private stepFerns(deltaMs: number): void {
    for (const fern of this.ferns) {
      fern.phaseMs += deltaMs;
      const t = Math.sin((fern.phaseMs / fern.periodMs) * Math.PI * 2);
      fern.image.setRotation(fern.rotationRad * t);
      fern.image.setX(fern.baseX + fern.translationX * t);
    }
  }

  destroy(): void {
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.fit, this);
    this.root.destroy(true);
  }
}
