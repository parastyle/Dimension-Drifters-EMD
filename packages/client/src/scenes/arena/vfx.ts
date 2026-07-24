import { isThrownProjectileKind, type WeaponDef } from "@dd/shared";
import Phaser from "phaser";
import { budgetedCameraShakeIntensity, type CameraShakeSource } from "../../camera-shake.js";
import { type FxPackName, playFxPack } from "../../vfx/fx-composer.js";
import { FX_GRAVE_CALL } from "../../vfx/fx-pack-grave-call.js";
import { FX_HOLY_SMITE } from "../../vfx/fx-pack-holy-smite.js";
import { FX_LIGHTNING_BALL } from "../../vfx/fx-pack-lightning-ball.js";
import { FX_QUAKE_BURST } from "../../vfx/fx-pack-quake-burst.js";
import { FX_TOXIC_BURST } from "../../vfx/fx-pack-toxic-burst.js";
import { FX_VOID_IMPLOSION } from "../../vfx/fx-pack-void-implosion.js";
import { MUZZLE_FLASH_SHEET, muzzleFlashAssignmentFor } from "../../vfx/muzzle-flash-catalog.js";
import {
  elementPack,
  paintedParticleDominance,
  paintedParticlePixels,
  particleBurst,
} from "../../vfx/particles.js";
import { resolveProjectileExplosionVfxRecipe } from "../../vfx/projectile-explosion-vfx-recipes.js";
import { type QuakeVfxRecipe, resolveQuakeVfxRecipe } from "../../vfx/quake-vfx-recipes.js";
import { weaponPaintedQuakeFor } from "../../vfx/weapon-vfx-suite.js";

/**
 * Transient combat VFX factories, extracted from ArenaScene. Each is a pure spawner: it takes the scene
 * (GameObject factory + tween manager + camera) and world coords, draws a short-lived effect, and tweens
 * it out (self-destructing). No scene private state — the scene's sync/combat loops just call these. The
 * screen-space HUD celebration stays in the scene.
 */

const IMPACT_ELEMENTS = [
  "fire",
  "frost",
  "shock",
  "void",
  "holy",
  "toxic",
  "arcane",
  "steel",
] as const;
type ImpactElement = (typeof IMPACT_ELEMENTS)[number];
const IMPACT_FRAME_PX = 256;
const IMPACT_FRAMES = 6;
const IMPACT_DEPTH = 99500;
const missingImpactFlipbooks = new Set<string>();

interface TelegraphForeshadowRecipe {
  texture: string;
  element: string;
  particleShape: string;
  ground: boolean;
  additive?: boolean;
}

/**
 * §TELEGRAPH semantic anticipation ingredients. These are deliberately single audited components from the
 * installed composer packs, never a whole impact pack: cracks/stains live on the ground while cores/rings
 * gather at the source. The numeric tag values mirror the existing wire without extending the schema.
 */
const TELEGRAPH_FORESHADOW_RECIPES: Record<number, TelegraphForeshadowRecipe> = {
  0: {
    texture: FX_QUAKE_BURST[6],
    element: "steel",
    particleShape: "mote",
    ground: true,
  },
  1: {
    texture: FX_TOXIC_BURST[8],
    element: "toxic",
    particleShape: "wisp",
    ground: true,
  },
  2: {
    texture: FX_GRAVE_CALL[8],
    element: "arcane",
    particleShape: "mote",
    ground: true,
  },
  3: {
    texture: FX_LIGHTNING_BALL[2],
    element: "shock",
    particleShape: "mote",
    ground: false,
    additive: true,
  },
  4: {
    texture: FX_LIGHTNING_BALL[2],
    element: "shock",
    particleShape: "spark",
    ground: false,
    additive: true,
  },
  5: {
    texture: FX_VOID_IMPLOSION[3],
    element: "void",
    particleShape: "mote",
    ground: true,
    additive: true,
  },
  6: {
    texture: FX_HOLY_SMITE[6],
    element: "holy",
    particleShape: "spark",
    ground: false,
    additive: true,
  },
  7: {
    texture: FX_QUAKE_BURST[6],
    element: "steel",
    particleShape: "mote",
    ground: true,
  },
};

interface TelegraphForeshadowEntry {
  seenFrame: number;
  kindTag: number;
  milestoneMask: number;
  hash: number;
  terminal: boolean;
  textureUnavailable: boolean;
  image?: Phaser.GameObjects.Image;
}

function stableHash01(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0x100000000;
}

function passedMilestones(t: number): number {
  return (t >= 0.3 ? 1 : 0) | (t >= 0.65 ? 2 : 0) | (t >= 0.9 ? 4 : 0);
}

function newestMilestone(mask: number): number {
  return mask & 4 ? 4 : mask & 2 ? 2 : mask & 1 ? 1 : 0;
}

/**
 * §TELEGRAPH retained, budgeted painted prelude layer. One row owns at most one persistent component and
 * three tiny milestone emissions. Optional/missing art only removes charm; the exact Graphics underlay is
 * independent. Entries are updated in place and generation-pruned without a per-frame live-id Set.
 */
export class TelegraphForeshadowPool {
  private readonly entries = new Map<string, TelegraphForeshadowEntry>();
  private frame = 0;
  private activeImages = 0;
  private particleSpend = 0;
  private static readonly MAX_IMAGES = 12;
  private static readonly MAX_PARTICLES_PER_FRAME = 18;

  constructor(private readonly scene: Phaser.Scene) {}

  beginFrame(): void {
    this.frame++;
    this.particleSpend = 0;
  }

  update(
    id: string,
    shape: number,
    kindTag: number,
    x: number,
    y: number,
    a: number,
    b: number,
    rot: number,
    t: number,
    projectionYScale: number,
  ): void {
    const recipe = TELEGRAPH_FORESHADOW_RECIPES[kindTag] ?? TELEGRAPH_FORESHADOW_RECIPES[0];
    if (!recipe) return;
    let entry = this.entries.get(id);
    if (!entry) {
      const passed = passedMilestones(t);
      entry = {
        seenFrame: this.frame,
        kindTag,
        // A late patch samples the current beat; it never replays every missed anticipation burst.
        milestoneMask: passed & ~newestMilestone(passed),
        hash: stableHash01(id),
        terminal: false,
        textureUnavailable: false,
      };
      this.entries.set(id, entry);
    }
    entry.seenFrame = this.frame;

    // t=1 is either the one-broadcast resolve row or an active beam/ring/dash. Anticipation releases in
    // both cases; the existing ArenaScene removal cache remains the sole payoff/cancellation gate.
    if (t >= 0.999) {
      entry.terminal = true;
      this.releaseImage(entry);
      return;
    }
    if (entry.terminal) return;

    if (
      !entry.image &&
      !entry.textureUnavailable &&
      this.activeImages < TelegraphForeshadowPool.MAX_IMAGES
    ) {
      if (!this.scene.textures.exists(recipe.texture)) {
        entry.textureUnavailable = true;
      } else {
        try {
          entry.image = this.scene.add
            .image(x, y, recipe.texture)
            .setDepth(recipe.ground ? 2 : 99970);
          if (recipe.additive) entry.image.setBlendMode(Phaser.BlendModes.ADD);
          this.activeImages++;
        } catch {
          entry.textureUnavailable = true;
        }
      }
    }

    const projectedRot = Math.atan2(Math.sin(rot) * projectionYScale, Math.cos(rot));
    const sourceOffset = kindTag === 4 ? Math.min(18, Math.max(5, b * 0.28)) : 0;
    const px = x + Math.cos(projectedRot) * sourceOffset;
    const py = y + Math.sin(projectedRot) * sourceOffset;
    const view = this.scene.cameras.main.worldView;
    const margin = Math.max(80, Math.min(420, a));
    const visible =
      px >= view.left - margin &&
      px <= view.right + margin &&
      py >= view.top - margin &&
      py <= view.bottom + margin;

    const image = entry.image;
    if (image) {
      const load = Phaser.Math.Clamp((t - 0.08) / 0.57, 0, 1);
      let diameter: number;
      if (kindTag === 3 || kindTag === 4 || kindTag === 6) {
        diameter = Math.max(30, Math.min(92, kindTag === 4 ? b * 1.7 : a * 0.5));
      } else if (shape === 5) {
        diameter = Math.max(36, Math.min(76, a * 1.5));
      } else {
        diameter = Math.max(52, Math.min(360, a * 1.7));
      }
      const sourceSpan = Math.max(1, image.width, image.height);
      const scale = (diameter / sourceSpan) * (0.72 + load * 0.18);
      image
        .setPosition(px, py)
        .setScale(scale, scale * (recipe.ground ? projectionYScale : 1))
        .setRotation(projectedRot + (entry.hash - 0.5) * (recipe.ground ? 0.7 : 0.16))
        .setAlpha(0.06 + load * (recipe.ground ? 0.2 : 0.3))
        .setVisible(visible);
    }

    this.emitMilestoneParticles(
      entry,
      recipe,
      kindTag,
      x,
      y,
      a,
      t,
      projectionYScale,
      projectedRot,
      visible,
    );
  }

  endFrame(): void {
    for (const [id, entry] of this.entries) {
      if (entry.seenFrame === this.frame) continue;
      this.releaseImage(entry);
      this.entries.delete(id);
    }
  }

  clear(): void {
    for (const entry of this.entries.values()) this.releaseImage(entry);
    this.entries.clear();
    this.activeImages = 0;
  }

  private emitMilestoneParticles(
    entry: TelegraphForeshadowEntry,
    recipe: TelegraphForeshadowRecipe,
    kindTag: number,
    centerX: number,
    centerY: number,
    radius: number,
    t: number,
    projectionYScale: number,
    projectedRot: number,
    visible: boolean,
  ): void {
    const passed = passedMilestones(t);
    const pending = passed & ~entry.milestoneMask;
    if (!pending) return;
    // Only the newest crossed beat plays after a coarse/late patch; older beats are retired silently.
    const bit = newestMilestone(pending);
    entry.milestoneMask |= pending;
    const count = bit === 4 ? 4 : 3;
    if (!visible || this.particleSpend + count > TelegraphForeshadowPool.MAX_PARTICLES_PER_FRAME)
      return;
    this.particleSpend += count;

    const beat = bit === 4 ? 3 : bit === 2 ? 2 : 1;
    let x = centerX;
    let y = centerY;
    let dir = projectedRot;
    if (kindTag === 4) {
      // A lane pulls its painted sparks/dust back toward the captured emitter instead of previewing impact.
      const dist = Math.max(34, Math.min(130, radius * (0.09 + beat * 0.035)));
      x += Math.cos(projectedRot) * dist;
      y += Math.sin(projectedRot) * dist;
      dir = projectedRot + Math.PI;
    } else if (kindTag === 6) {
      const dist = Math.max(16, Math.min(48, radius * 0.22));
      x += Math.cos(projectedRot) * dist;
      y += Math.sin(projectedRot) * dist;
    } else {
      // World tells inhale: spawn inside the authored reach and travel toward the centre/source.
      const ang = entry.hash * Math.PI * 2 + beat * 2.17;
      const dist = Math.max(24, Math.min(140, radius * (0.26 + beat * 0.035)));
      x += Math.cos(ang) * dist;
      y += Math.sin(ang) * dist * projectionYScale;
      dir = Math.atan2(centerY - y, centerX - x);
    }
    particleBurst(this.scene, elementPack(recipe.element, recipe.particleShape), x, y, {
      count,
      dirRad: dir,
      spread: kindTag === 6 ? 0.16 : 0.3,
      speed: bit === 4 ? 150 : 105,
      scaleContract: paintedParticlePixels(bit === 4 ? 28.8 : 23.04),
      lifeMs: bit === 4 ? 390 : 460,
      additive: recipe.additive,
      depth: recipe.ground ? 2.5 : 99971,
    });
  }

  private releaseImage(entry: TelegraphForeshadowEntry): void {
    const image = entry.image;
    if (!image) return;
    if (image.active) image.destroy();
    entry.image = undefined;
    this.activeImages = Math.max(0, this.activeImages - 1);
  }
}

function impactTextureKey(element: ImpactElement): string {
  return `vfx:impact:${element}`;
}

/** Queue the eight optional 6-frame IMPACT strips. Like optional terrain, HTTP-200 HTML stubs take a
 *  silent decode-error path; a missing strip is remembered game-wide and the procedural hit stack survives. */
export function preloadImpactFlipbooks(scene: Phaser.Scene): void {
  if (!scene.textures.exists(MUZZLE_FLASH_SHEET.key))
    scene.load.spritesheet(MUZZLE_FLASH_SHEET.key, MUZZLE_FLASH_SHEET.url, {
      frameWidth: MUZZLE_FLASH_SHEET.frameWidth,
      frameHeight: MUZZLE_FLASH_SHEET.frameHeight,
    });
  scene.load.on("loaderror", (file: Phaser.Loader.File) => {
    if (file.key.startsWith("vfx:impact:")) missingImpactFlipbooks.add(file.key);
  });
  for (const element of IMPACT_ELEMENTS) {
    const key = impactTextureKey(element);
    if (scene.textures.exists(key) || missingImpactFlipbooks.has(key)) continue;
    const file = new Phaser.Loader.FileTypes.SpriteSheetFile(
      scene.load,
      key,
      `vfx/impacts/${element}.png`,
      {
        frameWidth: IMPACT_FRAME_PX,
        frameHeight: IMPACT_FRAME_PX,
        endFrame: IMPACT_FRAMES - 1,
      },
    );
    file.onProcessError = () => {
      missingImpactFlipbooks.add(key);
      file.state = Phaser.Loader.FILE_ERRORED;
      file.loader.fileProcessComplete(file);
    };
    scene.load.addFile(file);
  }
}

/** Play one additive element IMPACT at the damaged body's diameter. Physical/unknown resolves to STEEL,
 *  mirroring `elementPack`; missing optional art is a no-op so every existing hit layer remains underneath. */
export function spawnImpactFlipbook(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  element?: string,
): boolean {
  const resolved: ImpactElement = (IMPACT_ELEMENTS as readonly string[]).includes(element ?? "")
    ? (element as ImpactElement)
    : "steel";
  const textureKey = impactTextureKey(resolved);
  if (!scene.textures.exists(textureKey)) return false;
  const animKey = `${textureKey}:burst`;
  if (!scene.anims.exists(animKey)) {
    scene.anims.create({
      key: animKey,
      frames: scene.anims.generateFrameNumbers(textureKey, {
        start: 0,
        end: IMPACT_FRAMES - 1,
      }),
      duration: 270,
      repeat: 0,
    });
  }
  const sprite = scene.add
    .sprite(x, y, textureKey, 0)
    .setDisplaySize(radius * 2, radius * 2)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(IMPACT_DEPTH);
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.destroy());
  sprite.play(animKey);
  return true;
}

/** §7 v0.105 de-clunk (adversarial-verify fix): route a camera shake through ArenaScene's PRIORITIZED
 *  `shakeCam` so it participates in the same force/priority arbitration as every other shake site — a raw
 *  `cameras.main.shake()` here (no `force`) is silently dropped whenever another shake is running, AND it
 *  never updates the scene's shake bookkeeping, so a later weaker shake would stomp it. Falls back to a
 *  forced raw shake if the host scene isn't an ArenaScene (defensive — e.g. a different scene reusing these). */
function shakeVia(
  scene: Phaser.Scene,
  duration: number,
  intensity: number,
  source: CameraShakeSource,
): void {
  const s = scene as unknown as {
    shakeCam?: (d: number, i: number, source: CameraShakeSource) => void;
  };
  if (typeof s.shakeCam === "function") s.shakeCam(duration, intensity, source);
  else scene.cameras.main.shake(duration, budgetedCameraShakeIntensity(intensity, source), true);
}

/** V6G4 per-gun generated muzzle art, frame-assigned by weapon and rooted at the guarded barrel point. */
export function spawnMuzzleFlash(
  scene: Phaser.Scene,
  x: number,
  y: number,
  ang: number,
  size: number,
  color: number,
  style = "heavy",
  weaponId?: string,
): void {
  const assignment = muzzleFlashAssignmentFor(weaponId, style);
  if (!scene.textures.exists(MUZZLE_FLASH_SHEET.key)) return;
  const g = scene.add
    .sprite(x, y, MUZZLE_FLASH_SHEET.key, assignment.frame)
    .setOrigin(MUZZLE_FLASH_SHEET.originX, 0.5)
    .setDisplaySize(size * 3.7, size * 2.35)
    .setTint(color)
    .setDepth(99500)
    .setBlendMode(Phaser.BlendModes.ADD);
  // Rapid fire gets slight per-shot rotation jitter so a held stream flickers instead of stacking.
  const jitter = style === "rapid" ? (Math.random() - 0.5) * 0.5 : 0;
  g.setRotation(ang + jitter);
  // "heavy" (revolver) — a dark recoil-smoke puff drifts up-barrel under the flash.
  const grow = style === "artillery" ? 2.1 : style === "boom" ? 1.55 : 1.3;
  scene.tweens.add({
    targets: g,
    alpha: 0,
    scaleX: grow,
    scaleY: grow,
    duration: style === "rapid" ? 70 : style === "artillery" ? 185 : style === "boom" ? 135 : 105,
    ease: "Quad.out",
    onComplete: () => g.destroy(),
  });
  // §41 best-practice gunfeel: a BRASS CASING ejects perpendicular to the barrel on every shot — a tiny
  // tumbling rectangle arcing out and dropping (the classic shooter tell that a round was spent) — and the
  // heavy/boom shots leave a lingering painted smoke wisp curling off the muzzle.
  {
    const side = Math.random() < 0.5 ? 1 : -1; // eject to either side
    const ej = ang + (side * Math.PI) / 2 + (Math.random() - 0.5) * 0.4;
    const casing = scene.add
      .rectangle(x - Math.cos(ang) * size * 0.4, y - Math.sin(ang) * size * 0.4, 5, 2.5, 0xd8a94e)
      .setStrokeStyle(0.8, 0x8a6a2a)
      .setDepth(99450);
    scene.tweens.add({
      targets: casing,
      x: casing.x + Math.cos(ej) * (16 + Math.random() * 14),
      y: casing.y + Math.sin(ej) * (10 + Math.random() * 8) + 14, // arcs out, then falls
      angle: (Math.random() - 0.5) * 540, // tumbles
      alpha: 0,
      duration: 330 + Math.random() * 120,
      ease: "Quad.easeIn",
      onComplete: () => casing.destroy(),
    });
    if (style === "heavy" || style === "boom" || style === "artillery") {
      particleBurst(
        scene,
        "steel-wisp",
        x + Math.cos(ang) * size * 0.6,
        y + Math.sin(ang) * size * 0.6,
        {
          count: style === "artillery" ? 6 : 1,
          dirRad: ang - Math.PI / 2 + (Math.random() - 0.5) * 0.6, // curls upward off the barrel
          spread: style === "artillery" ? 0.48 : 0.2,
          speed: style === "artillery" ? 75 : 40,
          scaleContract: paintedParticlePixels(style === "artillery" ? 72 : 48),
          lifeMs: style === "artillery" ? 980 : 700,
        },
      );
    }
  }
}

/** §9 bullet IMPACT — a per-gun hit effect where a bullet died (hit / wall / max range): the slug
 *  THUMPS with a dust ring, buckshot is a cheap flash, nails STICK + ping, ricochets crackle cyan,
 *  tracers spark + scorch. `ang` = the bullet's travel angle (for oriented effects). */
export function spawnBulletImpact(
  scene: Phaser.Scene,
  x: number,
  y: number,
  kind: string,
  ang = 0,
): void {
  const ci = kind.indexOf(":");
  const el = ci < 0 ? undefined : kind.slice(ci + 1);
  const shape = kind.startsWith("orb") ? "mote" : "shard";
  particleBurst(scene, elementPack(el, shape), x, y, {
    count: 3,
    dirRad: ang + Math.PI, // spray back against the flight direction
    spread: 0.8,
    speed: 160,
    scaleContract: paintedParticlePixels(32.64),
    lifeMs: 300,
    additive: shape === "mote",
    sink: 8,
  });
  const flash = (radiusPx: number, scale: number, duration: number) =>
    particleBurst(scene, elementPack(el, "splat"), x, y, {
      count: 1,
      speed: 0,
      scaleContract: paintedParticlePixels(radiusPx * scale * 2),
      lifeMs: duration,
      additive: true,
    });
  if (kind === "pellet") {
    flash(5, 1.8, 120); // cheap — a 7-pellet volley shouldn't spawn 35 objects
    return;
  }
  if (kind === "nail") {
    flash(5, 1.6, 110);
    const dart = scene.add.rectangle(x, y, 9, 2, 0xd6dde6, 0.95).setRotation(ang).setDepth(98500);
    scene.tweens.add({
      targets: dart,
      alpha: 0,
      duration: 420,
      onComplete: () => dart.destroy(),
    });
    return;
  }
  if (kind === "ricochet") {
    flash(6, 2, 130);
    particleBurst(scene, "shock-bolt", x, y, {
      count: 4,
      speed: 105,
      scaleContract: paintedParticlePixels(24),
      lifeMs: 170,
      additive: true,
    });
    return;
  }
  // slug (heavy thump + dust ring) and default (tracer): flash + radial sparks + lingering scorch.
  const heavy = kind === "slug";
  flash(heavy ? 9 : 7, heavy ? 2.8 : 2.1, 160);
  if (heavy) {
    particleBurst(scene, "sand-wisp", x, y, {
      count: 3,
      speed: 58,
      scaleContract: paintedParticlePixels(32),
      lifeMs: 280,
      additive: false,
    });
  }
  particleBurst(scene, "steel-splat", x, y, {
    count: 1,
    speed: 0,
    scaleContract: paintedParticlePixels(18),
    lifeMs: 760,
    additive: false,
  });
}

/** §41 element accent colours for the explosion composite (flash/ring/disc tint). Fire is the default. */
/** §49 blast tier/element dispatch: <100 keeps the established stack; ≥160 is the universal NUKE beat. */
function explosionPack(radius: number, element: string): FxPackName | undefined {
  if (radius < 100) return undefined;
  if (radius >= 160) return "nuke";
  switch (element) {
    case "frost":
      return "frost-nova";
    case "shock":
      return "lightning-ball";
    case "void":
      return "void-implosion";
    case "holy":
      return "holy-smite";
    case "toxic":
      return "toxic-burst";
    default:
      return "ember-eruption"; // fire/physical + forward-compatible unknown elements retain a hot blast
  }
}

/** The tag taxonomy is intentionally broad for legacy/expansion rows (e.g. Buzzcutter is family "sword").
 *  Family remains the primary semantic; stable weapon id/name fills the older rows' missing sub-family. */
function weaponSemantic(weapon: WeaponDef): string {
  return `${weapon.tags.family} ${weapon.id} ${weapon.name}`.toLowerCase();
}

/** Subtle death accent for semantic weapon families. The composer's shared frame gate handles horde kills. */
export function spawnWeaponKillFx(
  scene: Phaser.Scene,
  x: number,
  y: number,
  weapon: WeaponDef | undefined,
): boolean {
  if (!weapon) return false;
  const family = weaponSemantic(weapon);
  let pack: FxPackName | undefined;
  if (weapon.chainLightning || /storm|tesla/.test(family)) pack = "storm-call";
  else if (weapon.tags.classPool === "melee" && /buzzsaw|buzzcutter|sawblade/.test(family))
    pack = "buzzsaw-wake";
  else if (/anchor|tide|harpoon/.test(family)) pack = "tide-crash";
  return pack ? playFxPack(scene, pack, x, y, { intensity: 42 }) : false;
}

/** AoE EXPLOSION where an exploding projectile died (§14 WYSIWYG: the ring expands to EXACTLY the blast
 *  radius = the server hitbox). §41 upgraded to a real eruption in the quake's family: the procedural
 *  flash/shockwave/footprint/sparks now carry PAINTED element debris (shards flung past the rim), rising
 *  smoke WISPS, a painted halo RING punch, a lingering scorch, and a radius-scaled camera shake. Pass the
 *  projectile's element for frost/void/arcane… blasts; omitted = the classic fire look. */
export function spawnExplosion(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  element: string,
  shakeSource: CameraShakeSource,
  weaponId?: string,
): void {
  const recipe = resolveProjectileExplosionVfxRecipe(weaponId);
  const visualElement = recipe?.element ?? element;
  const pack = recipe?.pack ?? explosionPack(radius, visualElement);
  if (pack) playFxPack(scene, pack, x, y, { intensity: radius });
  const painted = recipe?.paintedTexture;
  if (painted && scene.textures.exists(painted.key)) {
    const sprite = scene.add.image(x, y, painted.key).setDepth(99012).setAlpha(0.96);
    sprite.setScale((radius * 2 * painted.diameterMultiplier) / Math.max(1, sprite.width));
    const finalScale = sprite.scaleX;
    sprite.setScale(finalScale * 0.42);
    scene.tweens.add({
      targets: sprite,
      scaleX: finalScale,
      scaleY: finalScale,
      alpha: { from: 0.96, to: 0 },
      ease: "Quad.easeOut",
      duration: painted.lifeMs,
      onComplete: () => sprite.destroy(),
    });
  }
  // PAINTED eruption (§41): element shards blasted out past the rim, embers/motes inside, smoke wisps
  // rising and lingering, plus ONE painted ring frame punched up as the halo. All degrade to no-ops
  // pre-load; the procedural composite below always renders.
  particleBurst(scene, elementPack(visualElement, "shard"), x, y, {
    count: Math.round((6 + radius / 22) * (recipe?.shardCountMultiplier ?? 1)),
    speed: radius * 2.6,
    scaleContract: paintedParticleDominance(radius, 0.66, 40, 76),
    lifeMs: 420,
    sink: 14,
  });
  particleBurst(scene, elementPack(visualElement, "mote"), x, y, {
    count: 6,
    speed: radius * 1.4,
    scaleContract: paintedParticleDominance(radius, 0.48, 30, 58),
    lifeMs: 360,
    additive: true,
  });
  particleBurst(scene, elementPack(visualElement, "wisp"), x, y, {
    count: Math.round(3 * (recipe?.wispCountMultiplier ?? 1)),
    dirRad: -Math.PI / 2, // smoke drifts UP
    spread: 0.5,
    speed: 55,
    scaleContract: paintedParticleDominance(radius, 0.84, 52, 88),
    lifeMs: 900,
  });
  if (recipe?.paintedHalo !== false)
    particleBurst(scene, elementPack(visualElement, "ring"), x, y, {
      count: 1,
      speed: 0,
      scaleContract: paintedParticleDominance(radius, 1.6, 72, 144),
      lifeMs: 340,
      additive: true,
    });
  // The footprint and hot core are painted splats too; no perfect engine disc survives the burst.
  particleBurst(scene, elementPack(visualElement, "splat"), x, y, {
    count: recipe?.footprintCount ?? 2,
    speed: 0,
    scaleContract: paintedParticleDominance(radius, 1.18, 64, 128),
    lifeMs: 1100,
    additive: false,
  });
  // Radius-scaled kick through the scene's prioritized shake.
  shakeVia(scene, 200, Math.min(0.02, 0.006 + radius / 9000), shakeSource);
}

/** Small impact splat where a projectile hit or expired (green spit / amber thrown implement). */
export function spawnSplat(scene: Phaser.Scene, x: number, y: number, kind?: string): void {
  const thrown = kind && isThrownProjectileKind(kind);
  particleBurst(scene, thrown ? "fire-splat" : "toxic-splat", x, y, {
    count: 2,
    speed: 34,
    scaleContract: paintedParticlePixels(28),
    lifeMs: 230,
    additive: false,
  });
}

/** Earthquake VFX (§14): the Codex hero skin (authored in the Weaponsmith) if the weapon carries
 *  one, else the procedural fallback. Both composite engine dust/debris/flash/shake. */
export function spawnQuake(
  scene: Phaser.Scene,
  x: number,
  y: number,
  quake: NonNullable<WeaponDef["quake"]>,
  weapon?: WeaponDef,
  projectionYScale = 1,
): void {
  const paintedQuake = weaponPaintedQuakeFor(weapon?.id);
  if (paintedQuake && scene.textures.exists(paintedQuake.textureKey)) {
    const audit = globalThis as unknown as {
      __ddB10VfxCapture?: boolean;
      __ddB10VfxEvents?: Array<Record<string, unknown>>;
    };
    if (audit.__ddB10VfxCapture) {
      audit.__ddB10VfxEvents ??= [];
      audit.__ddB10VfxEvents.push({
        kind: "painted-quake",
        weaponId: weapon?.id,
        textureKey: paintedQuake.textureKey,
        subjects: paintedQuake.subjects,
        removedSubjects: paintedQuake.removedSubjects,
        displayDiameter: quake.radius * 2 * paintedQuake.diameterMultiplier,
        damageDiameter: quake.radius * 2,
      });
    }
    spawnQuakeHero(
      scene,
      x,
      y,
      quake.radius,
      {
        image: paintedQuake.textureKey,
        radius: paintedQuake.diameterMultiplier,
        flash: 0,
        dust: 0,
        debris: 0,
        shake: quake.vfx?.shake ?? 0.13,
      },
      projectionYScale,
    );
    return;
  }
  // §49 every quake gets the rock pack; gravekeeper/tombstone/grave semantics trade it for bone/soul art.
  const variant = resolveQuakeVfxRecipe(weapon);
  if (variant?.smokeOnly) {
    spawnQuakeDangerPaint(scene, x, y, quake.radius, projectionYScale, variant.element, 520);
    particleBurst(scene, "sand-wisp", x, y, {
      count: 18,
      dirRad: -Math.PI / 2,
      spread: Math.PI * 2,
      speed: quake.radius * 0.72,
      lifeMs: 620,
      scaleContract: paintedParticleDominance(quake.radius, 0.62, 44, 92),
      depth: 99999,
      additive: false,
      sink: -22,
    });
    shakeVia(scene, 220, variant.shake, "player-weapon");
    return;
  }
  const grave = !!weapon && /gravekeeper|tombstone|grave/.test(weaponSemantic(weapon));
  for (let i = 0; i < (variant?.effectCountMultiplier ?? 1); i++)
    playFxPack(scene, variant?.pack ?? (grave ? "grave-call" : "quake-burst"), x, y, {
      intensity: quake.radius,
      tint: variant?.packTint,
    });
  if (quake.vfx && scene.textures.exists(quake.vfx.image)) {
    spawnQuakeHero(scene, x, y, quake.radius, quake.vfx, projectionYScale);
  } else if (variant) {
    spawnQuakeVariant(scene, x, y, quake.radius, variant, projectionYScale);
  } else {
    spawnQuakeProcedural(scene, x, y, quake.radius, projectionYScale);
  }
}

function spawnQuakeVariant(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  recipe: QuakeVfxRecipe,
  projectionYScale: number,
): void {
  const visualElement = recipe.visualElement ?? recipe.element;
  spawnQuakeDangerPaint(
    scene,
    x,
    y,
    radius,
    projectionYScale,
    visualElement,
    recipe.variant === "double-ripple" ? 520 : 400,
  );

  particleBurst(scene, elementPack(visualElement, "splat"), x, y, {
    count: recipe.variant === "double-ripple" ? 2 : 1,
    speed: 0,
    lifeMs: recipe.variant === "double-ripple" ? 540 : 360,
    scaleContract: paintedParticlePixels(
      radius * (recipe.variant === "faultline-crack" ? 1.9 : 1.55),
    ),
    depth: 99997,
    additive: false,
  });

  const burst = (
    shape: QuakeVfxRecipe["primaryShape"] | QuakeVfxRecipe["secondaryShape"],
    delay: number,
  ): void => {
    scene.time.delayedCall(delay, () => {
      particleBurst(scene, elementPack(visualElement, shape), x, y, {
        count:
          (shape === "ring" ? recipe.ringCount : recipe.particleCount) *
          recipe.effectCountMultiplier,
        speed: shape === "ring" ? 0 : radius * 1.2,
        lifeMs: recipe.variant === "aftershock-eruption" ? 620 : 430,
        scaleContract: paintedParticleDominance(
          radius,
          recipe.variant === "hammer-slam" ? 0.9 : recipe.variant === "double-ripple" ? 1.1 : 0.74,
          56,
          112,
        ),
        depth: 99999,
        additive: true,
        sink: recipe.variant === "aftershock-eruption" ? -18 : 4,
      });
    });
  };

  burst(recipe.primaryShape, 0);
  if (recipe.pulseDelayMs > 0) burst(recipe.secondaryShape, recipe.pulseDelayMs);

  if (recipe.variant === "faultline-crack") {
    const crack = scene.add.graphics().setDepth(99999);
    crack.lineStyle(4, recipe.palette.hot, 0.9);
    crack.beginPath();
    crack.moveTo(x - radius * 0.72, y + radius * 0.14 * projectionYScale);
    crack.lineTo(x - radius * 0.25, y - radius * 0.08 * projectionYScale);
    crack.lineTo(x + radius * 0.08, y + radius * 0.1 * projectionYScale);
    crack.lineTo(x + radius * 0.76, y - radius * 0.18 * projectionYScale);
    crack.strokePath();
    scene.tweens.add({
      targets: crack,
      alpha: 0,
      duration: 460,
      onComplete: () => crack.destroy(),
    });
  }

  shakeVia(scene, 220 + recipe.pulseDelayMs, recipe.shake, "player-weapon");
}

/** QK-1: a broken painted rim directly communicates the authoritative radius. */
function spawnQuakeDangerPaint(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  projectionYScale: number,
  element = "steel",
  duration = 400,
): void {
  const key = `ptcl:${elementPack(element, "ring")}`;
  if (!scene.textures.exists(key)) return;
  const ring = scene.add.image(x, y, key, 0).setDepth(99998).setBlendMode(Phaser.BlendModes.ADD);
  const targetScaleX = (radius * 2) / Math.max(1, ring.width);
  const targetScaleY = (radius * 2 * projectionYScale) / Math.max(1, ring.height);
  ring.setScale(targetScaleX * 0.2, targetScaleY * 0.2);
  scene.tweens.add({
    targets: ring,
    scaleX: targetScaleX,
    scaleY: targetScaleY,
    alpha: 0,
    duration,
    ease: "Cubic.easeOut",
    onComplete: () => ring.destroy(),
  });
}

/** Hero-skin quake: the Codex slab eruption (candidate-8) erupting up + engine overlays. The
 *  `vfx` params (radius/flash/dust/debris/shake) were dialed in the Weaponsmith and baked here. */
export function spawnQuakeHero(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  vfx: NonNullable<NonNullable<WeaponDef["quake"]>["vfx"]>,
  projectionYScale = 1,
): void {
  spawnQuakeDangerPaint(scene, x, y, radius, projectionYScale);
  // Hero sprite scaled so its width spans the AoE diameter × the authored visual radius.
  // Ground art follows the same belt projection as its authoritative footprint; it remains decoration.
  const src = scene.textures.get(vfx.image).getSourceImage();
  const full = (radius * 2 * vfx.radius) / src.width;
  // Low ground depth so the character (depth = y) always renders OVER the eruption.
  const hero = scene.add.image(x, y, vfx.image).setOrigin(0.5, 0.5).setDepth(6);
  hero.setScale(full * 0.32, full * 0.32 * projectionYScale).setAlpha(0);
  scene.tweens.add({
    targets: hero,
    scaleX: full,
    scaleY: full * projectionYScale,
    alpha: 1,
    duration: 200,
    ease: "Back.easeOut",
  });
  scene.tweens.add({
    targets: hero,
    alpha: 0,
    delay: 520,
    duration: 320,
    ease: "Cubic.easeIn",
    onComplete: () => hero.destroy(),
  });

  // Painted dust kicked up (param 0..1).
  if (vfx.dust > 0) {
    particleBurst(scene, "sand-wisp", x, y, {
      count: Math.max(2, Math.round(8 * vfx.dust)),
      speed: radius * 0.22,
      lifeMs: 500,
      scaleContract: paintedParticleDominance(radius, 0.5, 28, 62),
      depth: 4,
      additive: false,
      sink: -10,
    });
  }

  // Painted debris shards flung outward (param = count).
  const n = Math.round(vfx.debris);
  if (n > 0) {
    particleBurst(scene, "steel-shard", x, y, {
      count: n,
      speed: radius * 1.05,
      lifeMs: 500,
      scaleContract: paintedParticlePixels(24),
      depth: 8,
      additive: false,
      sink: -30,
    });
  }

  // Painted impact flash (param 0..1), kept subtle per the authored value.
  if (vfx.flash > 0) {
    particleBurst(scene, "fire-splat", x, y, {
      count: 1,
      speed: 0,
      lifeMs: 240,
      scaleContract: paintedParticlePixels(radius * 2.2 * vfx.flash),
      depth: 5,
      additive: true,
    });
  }

  shakeVia(scene, 220, 0.02 * vfx.shake, "player-weapon");
}

/** Procedural quake fallback (golden ground shockwave) for quake weapons without a VFX skin. */
export function spawnQuakeProcedural(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  projectionYScale = 1,
): void {
  spawnQuakeDangerPaint(scene, x, y, radius, projectionYScale);
  particleBurst(scene, "sand-wisp", x, y, {
    count: 9,
    speed: radius * 0.72,
    lifeMs: 380,
    scaleContract: paintedParticleDominance(radius, 0.42, 24, 52),
    depth: 99999,
    additive: false,
    sink: -18,
  });
  shakeVia(scene, 220, 0.012, "player-weapon");
}

interface DamageNumberEntry {
  text: Phaser.GameObjects.Text;
  generation: number;
  amount: number;
  crit: boolean;
}

interface DamageNumberPool {
  free: DamageNumberEntry[];
  frame: number;
  sameFrame: Map<string, DamageNumberEntry>;
}

const DAMAGE_NUMBER_POOLS = new WeakMap<Phaser.Scene, DamageNumberPool>();

function damageNumberPool(scene: Phaser.Scene): DamageNumberPool {
  let pool = DAMAGE_NUMBER_POOLS.get(scene);
  if (pool) return pool;
  pool = { free: [], frame: -1, sameFrame: new Map() };
  DAMAGE_NUMBER_POOLS.set(scene, pool);
  // Phaser reuses Scene instances: never retain destroyed Text from the old display list across a restart.
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => DAMAGE_NUMBER_POOLS.delete(scene));
  return pool;
}

/** Apply the original magnitude/crit bands to a pooled label; returns whether it gets the big-hit pop. */
function styleDamageNumber(text: Phaser.GameObjects.Text, amount: number, crit: boolean): boolean {
  const dmg = Math.max(1, Math.round(amount));
  let size = 13;
  let color = "#d9b45a";
  let stroke: string | undefined;
  if (dmg >= 40) {
    size = 28;
    color = "#fff2c0";
    stroke = "#ff5a3c";
  } else if (dmg >= 20) {
    size = 22;
    color = "#ffab3b";
  } else if (dmg >= 8) {
    size = 17;
    color = "#ffe08a";
  }
  if (crit) {
    size = Math.max(size, 30);
    color = "#ffe27a";
    stroke = "#ff9e2c";
  }
  text
    .setText(crit ? `${dmg}!` : String(dmg))
    .setFontSize(size)
    .setColor(color)
    .setFontStyle("bold")
    .setStroke(stroke ?? color, stroke ? (crit ? 4 : 3) : 0);
  return dmg >= 40 || crit;
}

/** §19 v0.108 floating combat text — same magnitude-driven look, now pooled and same-frame aggregated by
 *  enemy key. `aggregateKey` is optional for non-enemy callers; Arena passes the stable enemy id. */
export function spawnDamageNumber(
  scene: Phaser.Scene,
  x: number,
  y: number,
  amount: number,
  crit = false,
  aggregateKey?: string,
): void {
  const pool = damageNumberPool(scene);
  const frame = scene.game.loop.frame;
  if (pool.frame !== frame) {
    pool.frame = frame;
    pool.sameFrame.clear();
  }
  const existing = aggregateKey ? pool.sameFrame.get(aggregateKey) : undefined;
  if (existing) {
    // Multiple damage sources collapsed into one server patch read as their combined result, never a stack
    // of Text canvases for the same enemy in the same render frame. Crit styling wins if any source crit.
    existing.amount += amount;
    existing.crit ||= crit;
    const big = styleDamageNumber(existing.text, existing.amount, existing.crit);
    if (big) existing.text.setScale(existing.crit ? 1.9 : 1.6);
    return;
  }

  const entry =
    pool.free.pop() ??
    ({
      text: scene.add
        .text(0, 0, "", { fontSize: "13px", fontStyle: "bold" })
        .setOrigin(0.5)
        .setDepth(100000),
      generation: 0,
      amount: 0,
      crit: false,
    } satisfies DamageNumberEntry);
  entry.generation++;
  entry.amount = amount;
  entry.crit = crit;
  if (aggregateKey) pool.sameFrame.set(aggregateKey, entry);
  const generation = entry.generation;
  const text = entry.text;
  const big = styleDamageNumber(text, amount, crit);
  const jx = (Math.random() - 0.5) * 12;
  text
    .setActive(true)
    .setVisible(true)
    .setPosition(x + jx, y)
    .setAlpha(1)
    .setScale(big ? (crit ? 1.9 : 1.6) : 1);
  scene.tweens.add({
    targets: text,
    scale: 1,
    y: y - (big ? 40 : 30),
    duration: big ? 140 : 120,
    ease: "Back.easeOut",
    onComplete: () => {
      if (entry.generation !== generation) return;
      scene.tweens.add({
        targets: text,
        y: text.y - 14,
        alpha: 0,
        duration: big ? 620 : 480,
        ease: "Cubic.easeOut",
        onComplete: () => {
          if (entry.generation !== generation) return;
          text.setActive(false).setVisible(false);
          pool.free.push(entry);
        },
      });
    },
  });
}

/** Quick dust puff where an enemy died. */
export function spawnPoof(scene: Phaser.Scene, x: number, y: number): void {
  const ring = scene.add.circle(x, y, 8, 0xcfc6ae, 0.5).setDepth(99999);
  scene.tweens.add({
    targets: ring,
    scale: 3,
    alpha: 0,
    duration: 260,
    ease: "Quad.easeOut",
    onComplete: () => ring.destroy(),
  });
}

/** Railgun launch signature: one short-lived pressure ring rooted at the accepted barrel lane. */
export function spawnSonicBoomRing(
  scene: Phaser.Scene,
  x: number,
  y: number,
  _angle: number,
  _color = 0xffe6a0,
): void {
  particleBurst(scene, "shock-ring", x, y, {
    count: 1,
    speed: 0,
    lifeMs: 190,
    scaleContract: paintedParticlePixels(68),
    depth: 99999,
    additive: true,
  });
}

/** §17 "fell into the void" VFX — a dark puff that SINKS + a few dust motes that drop DOWNWARD, so a pit
 *  fall (player or enemy) reads as falling, not just a flat poof. Cosmetic, client-local. */
export function spawnFallStreak(scene: Phaser.Scene, x: number, y: number): void {
  const puff = scene.add.circle(x, y, 11, 0x1a140f, 0.6).setDepth(99998);
  scene.tweens.add({
    targets: puff,
    scale: 0.3,
    alpha: 0,
    y: y + 20,
    duration: 340,
    ease: "Quad.easeIn",
    onComplete: () => puff.destroy(),
  });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const mote = scene.add
      .circle(x + Math.cos(a) * 6, y + Math.sin(a) * 4, 2.5, 0xcfc6ae, 0.7)
      .setDepth(99999);
    scene.tweens.add({
      targets: mote,
      x: mote.x + Math.cos(a) * 14,
      y: mote.y + 22 + Math.random() * 12,
      alpha: 0,
      scale: 0.4,
      duration: 300 + Math.random() * 130,
      ease: "Quad.easeIn",
      onComplete: () => mote.destroy(),
    });
  }
}
