import {
  thrownProjectileRotationPolicy,
  thrownProjectileSpriteId,
  thrownProjectileWeaponId,
  WEAPONS,
} from "@dd/shared";
import Phaser from "phaser";
import { partTexture } from "../../entities/SpriteRig.js";
import { SPRITES } from "../../sprites/manifest.js";
import { PROJECTILE_SPRITES } from "../../sprites/projectile-manifest.js";
import {
  GUN_GENERATED_PROJECTILES,
  GUN_PROJECTILE_ART_PACKS,
  GUN_SPRITE_PROJECTILES,
  THROWN_GENERATED_PROJECTILES,
} from "../../vfx/gun-projectile-art.js";
import { PARTICLE_PACKS } from "../../vfx/particle-manifest.js";
import { elementPack } from "../../vfx/particles.js";
import type { WeaponEffectRecipe } from "../../vfx/weapon-effect-recipes.js";
import { WEAPON_VFX } from "../../vfx/weapon-vfx.generated.js";
import { blendHex } from "./draw-util.js";
import { projectileColorSuffix, projectileElementColor } from "./projectile-color.js";
import { projectileArtTransform } from "./projectile-facing.js";

/** §9/§14/§15 projectile FACTORY — builds the in-flight render container for every projectile kind
 *  (enemy spit, own-sprite thrown implements, magma scatter ball, gun bullets). Pure factories: each takes the scene
 *  (for the GameObject factory + tween manager) and the synced projectile snapshot, and returns a
 *  Container at depth 99000. Extracted from ArenaScene so `syncProjectiles` stays a thin reconciler. */

export type GunFx = { color: number; size: number; style: string; trail: number; trailW: number };

/** §9 per-bullet-kind visual config — colour + muzzle-flash size + trail style. Each gun's `bulletKind`
 *  (server-synced on `ProjectileState.kind`) keys this, so each gun looks distinct without extra sync. */
export const GUN_FX: Record<string, GunFx> = {
  "fire-plume": { color: 0xff6a22, size: 31, style: "boom", trail: 46, trailW: 18 },
  slug: { color: 0xffb24a, size: 23, style: "heavy", trail: 26, trailW: 9 }, // revolver: fat hot slug
  pellet: { color: 0xff6a2a, size: 19, style: "boom", trail: 16, trailW: 6 }, // shotgun: red-hot buckshot
  tracer: { color: 0xfff0a0, size: 13, style: "rapid", trail: 44, trailW: 5 }, // gatling: pale tracer streak
  nail: { color: 0xd6dde6, size: 14, style: "punch", trail: 26, trailW: 3 }, // nailgun: metallic dart
  ricochet: { color: 0x5dd6ff, size: 16, style: "spark", trail: 20, trailW: 6 }, // pistol: cyan electric
  spark: { color: 0xb14bff, size: 18, style: "spark", trail: 32, trailW: 7 }, // Faradayer: crackling bolt
  laser: { color: 0xb14bff, size: 18, style: "spark", trail: 76, trailW: 7 }, // discrete magazine-fed laser pulse
  orb: { color: 0x8f6aff, size: 22, style: "arcane", trail: 30, trailW: 11 }, // §38 caster: soft arcane sphere
  grenade: { color: 0xffb24a, size: 24, style: "boom", trail: 22, trailW: 8 }, // §41 mortar: fat lobbed shell
};

/** §35/V3G3 projectile tint: the server encodes an element or authored #RRGGBB suffix onto the bullet
 *  kind. The suffix only overrides colour; shape, trail, and size still come from the base kind. */
/** The base bullet-kind with any ":<element>" suffix stripped — for sprite/sound lookups keyed on the kind. */
export function baseKind(kind: string): string {
  const i = kind.indexOf(":");
  return i < 0 ? kind : kind.slice(0, i);
}

/** Resolve a bullet-kind's visual config, with a safe default for any unmapped kind. An element suffix
 *  (":fire" etc.) recolours the bullet to its element. */
export function gunFx(kind: string): GunFx {
  const i = kind.indexOf(":");
  const base = i < 0 ? kind : kind.slice(0, i);
  const fx = GUN_FX[base] ?? { color: 0xffb24a, size: 20, style: "heavy", trail: 24, trailW: 7 };
  const color = projectileColorSuffix(kind);
  return color !== undefined ? { ...fx, color } : fx;
}

/** Enemy spit — full NEON so it reads as a THREAT against the olive scrub/dust (§28.7). */
export function makeSpit(
  scene: Phaser.Scene,
  pr: { x: number; y: number; vx: number; vy: number },
): Phaser.GameObjects.Container {
  const ang = Math.atan2(pr.vy, pr.vx);
  const trail = scene.add
    .ellipse(-Math.cos(ang) * 14, -Math.sin(ang) * 14, 34, 9, 0x9bff2e, 0.35)
    .setRotation(ang);
  const glow = scene.add.circle(0, 0, 12, 0x9bff2e, 0.5);
  const ring = scene.add.circle(0, 0, 8).setStrokeStyle(2, 0xd6ff7a, 0.9);
  const core = scene.add.circle(0, 0, 4.5, 0xf4ffd0);
  const c = scene.add.container(pr.x, pr.y, [trail, glow, ring, core]).setDepth(99000);
  scene.tweens.add({
    targets: glow,
    scale: 1.4,
    duration: 200,
    yoyo: true,
    repeat: -1,
    ease: "Sine.inOut",
  });
  return c;
}

/** G4 thrown truth — resolve the launched weapon through the exact held-art seam, then spin that sprite. */
export function makeThrownWeapon(
  scene: Phaser.Scene,
  pr: { x: number; y: number; vx: number; vy: number; kind: string },
): Phaser.GameObjects.Container {
  const weaponId = thrownProjectileWeaponId(pr.kind);
  const weapon = weaponId ? WEAPONS[weaponId] : undefined;
  const spriteId = thrownProjectileSpriteId(pr.kind);
  const part = spriteId ? SPRITES[spriteId as keyof typeof SPRITES]?.parts[0] : undefined;
  const tx = part && spriteId ? partTexture(scene, spriteId, part.role) : null;
  const generated = weaponId ? THROWN_GENERATED_PROJECTILES[weaponId] : undefined;
  const generatedSprite = generated ? PROJECTILE_SPRITES[generated.spriteId] : undefined;
  // Missing or rolling-client art keeps a visible payload, but never substitutes another weapon sprite.
  const blade =
    generated &&
    generatedSprite &&
    weaponId &&
    scene.textures.exists(`thrown-generated:${weaponId}`)
      ? scene.add
          .image(0, 0, `thrown-generated:${weaponId}`)
          .setScale(generated.displayLength / generatedSprite.width)
      : part && tx
        ? scene.add
            .image(0, 0, tx.key, tx.frame)
            .setScale((weapon?.displayLength ?? part.w) / part.w)
        : scene.add.rectangle(0, 0, 80, 30, 0xcfc6ae);
  // No blanket amber/yellow halo: thrown payload identity art must stand on its own.
  const payload = scene.add
    .container(0, 0, [blade])
    .setData("barrelRollBlade", blade)
    .setData("barrelRollBaseScaleX", blade.scaleX)
    .setData("barrelRollBaseScaleY", blade.scaleY)
    .setData("barrelRollElapsedSeconds", 0);
  const rotationPolicy = thrownProjectileRotationPolicy(pr.kind);
  if (rotationPolicy === "point-forward" || rotationPolicy === "barrel-roll")
    payload.setRotation(Math.atan2(pr.vy, pr.vx));
  return scene.add
    .container(pr.x, pr.y, [payload])
    .setDepth(99000)
    .setData("spriteId", spriteId ?? "")
    .setData("projectileSprite", generated?.spriteId ?? "")
    .setData("arcPayload", payload);
}

/** Scatter ball (§14 WYSIWYG) — a real damaging projectile that explodes on impact, rendered as PAINTED
 *  art so the projectile you see IS the painted ball: fire/physical use the authored magma-ball sheet;
 *  §41 an ":<element>" kind suffix (the frost Hailshard etc.) swaps in a painted element-orb frame and
 *  tints the glow/trail — a frost caster must NOT shoot lava. Tumbles; falls back to a tinted ember. */
export function makeMagma(
  scene: Phaser.Scene,
  pr: { x: number; y: number; vx: number; vy: number; kind: string },
  recipe?: WeaponEffectRecipe,
): Phaser.GameObjects.Container {
  const i = pr.kind.indexOf(":");
  const element = i < 0 ? "fire" : pr.kind.slice(i + 1);
  const molten = element === "fire"; // the classic magma look (also the bare-"magma" Wyrmtooth)
  const tint = molten ? 0xff6a22 : (projectileElementColor(element) ?? 0xff6a22);
  const ang = Math.atan2(pr.vy, pr.vx);
  const trail = scene.add
    .ellipse(-Math.cos(ang) * 18, -Math.sin(ang) * 18, 46, 13, molten ? 0xff5a1e : tint, 0.4)
    .setRotation(ang)
    .setBlendMode(Phaser.BlendModes.ADD);
  const glow = scene.add.circle(0, 0, 17, tint, 0.5).setBlendMode(Phaser.BlendModes.ADD);
  // The painted ball: the authored magma sheet for the molten look, else a painted element-orb frame.
  const sc = molten ? WEAPON_VFX["x-sword-bone"]?.scatter : null;
  const packId =
    recipe?.projectile === "crystal-shard-orb" ? "arcane-shard" : elementPack(element, "orb");
  const pack = molten ? null : PARTICLE_PACKS[packId];
  const key = sc ? `scatter:${sc.url}` : pack ? `ptcl:${packId}` : null;
  let ball: Phaser.GameObjects.GameObject;
  if (key && scene.textures.exists(key)) {
    const frame = Math.floor(Math.random() * (sc?.count ?? pack?.count ?? 1));
    const paintedSize = recipe?.projectile === "crystal-shard-orb" ? 44 : 36;
    const img = scene.add
      .image(0, 0, key, frame)
      .setScale(paintedSize / (sc?.frameWidth ?? pack?.frameWidth ?? 249));
    scene.tweens.add({
      targets: img,
      angle: 360,
      duration: 900 + Math.random() * 500,
      repeat: -1,
      ease: "Linear",
    });
    ball = img;
  } else {
    ball = scene.add.circle(0, 0, 7, molten ? 0xff8a2b : tint); // fallback ember
  }
  const c = scene.add.container(pr.x, pr.y, [trail, glow, ball]).setDepth(99000);
  scene.tweens.add({
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

/** B31 recovered Emberleaf art. The replicated scale is also the server collision scale; no procedural
 * glow/trail layer is added over the recovered fireball. */
export function makeEmberleafFireball(
  scene: Phaser.Scene,
  pr: { x: number; y: number; visualScale: number },
): Phaser.GameObjects.Container {
  const scale = Math.max(0.01, pr.visualScale || 1);
  const image = scene.add
    .image(0, 0, "recovered:emberleaf-fireball")
    .setDisplaySize(56 * scale, 56 * scale);
  return scene.add.container(pr.x, pr.y, [image]).setDepth(99000);
}

/** B66 Rimechoir art. Its 2.5:1 display matches the authoritative charged capsule. */
export function makeRimechoirPressureWedge(
  scene: Phaser.Scene,
  pr: { x: number; y: number; vx: number; vy: number; visualScale: number },
): Phaser.GameObjects.Container {
  const scale = Math.max(0.01, pr.visualScale || 1);
  const angle = Math.atan2(pr.vy, pr.vx);
  const image = scene.add
    .image(0, 0, "projectile:rimechoir-pressure-wedge")
    .setDisplaySize(90 * scale, 36 * scale)
    .setRotation(angle)
    .setFlipY(pr.vx < 0);
  return scene.add.container(pr.x, pr.y, [image]).setDepth(99000);
}

/** §8 Counterblade parry projectile — a cyan blade-streak (velocity-aligned hot capsule + white core)
 *  so the parry's riposte reads distinct from gun bullets / enemy spit. */
export function makeCounter(
  scene: Phaser.Scene,
  pr: { x: number; y: number; vx: number; vy: number },
): Phaser.GameObjects.Container {
  const ang = Math.atan2(pr.vy, pr.vx);
  const ADD = Phaser.BlendModes.ADD;
  const trail = scene.add
    .ellipse(-Math.cos(ang) * 12, -Math.sin(ang) * 12, 30, 7, 0x6fe6ff, 0.5)
    .setRotation(ang)
    .setBlendMode(ADD);
  const blade = scene.add.rectangle(0, 0, 22, 4, 0x9cf3ff).setRotation(ang).setBlendMode(ADD);
  const core = scene.add.circle(0, 0, 2.4, 0xffffff).setBlendMode(ADD);
  return scene.add.container(pr.x, pr.y, [trail, blade, core]).setDepth(99000);
}

/** §9 GUN bullet — a distinct in-flight look per `bulletKind` (slug/pellet/tracer/nail/ricochet): a
 *  velocity-aligned additive trail + a hot core (or a metallic dart for nails, an electric ring for
 *  ricochets). Server-authoritative (the bullet you see is the bullet that hits, §14 WYSIWYG). */
export function makeBullet(
  scene: Phaser.Scene,
  pr: { x: number; y: number; vx: number; vy: number; kind: string },
  visualScale = 1,
  recipe?: WeaponEffectRecipe,
): Phaser.GameObjects.Container {
  const resolvedFx = gunFx(pr.kind); // handles the ":element" colour suffix
  const fx = recipe?.projectileColor
    ? { ...resolvedFx, color: recipe.projectileColor, style: "electric" }
    : resolvedFx;
  const k = baseKind(pr.kind); // shape switches on the base kind (element-agnostic)
  const ang = Math.atan2(pr.vy, pr.vx);
  const ADD = Phaser.BlendModes.ADD;
  const items: Phaser.GameObjects.GameObject[] = [];
  // §41 best-practice tracers: the trail STRETCHES with velocity (a 900px/s slug streaks ~1×; a slow lobbed
  // shell barely smears) so speed reads directly off the bullet, like every modern 2D shooter.
  const vStretch = Math.min(1.7, Math.max(0.55, Math.hypot(pr.vx, pr.vy) / 900));
  const trailLen = fx.trail * vStretch;
  const trail = scene.add
    .ellipse(
      -Math.cos(ang) * trailLen * 0.5,
      -Math.sin(ang) * trailLen * 0.5,
      trailLen,
      fx.trailW,
      fx.color,
      0.5,
    )
    .setRotation(ang)
    .setBlendMode(ADD);
  items.push(trail);
  if (k === "nail") {
    // metallic dart — a thin steel rectangle aligned to flight + a white tip
    items.push(scene.add.rectangle(0, 0, 18, 2.6, 0xeef2f6).setRotation(ang));
    items.push(scene.add.circle(0, 0, 1.8, 0xffffff));
  } else if (k === "laser") {
    // A discrete semi-auto round whose presentation is a short, rigid beam segment—not a channel row.
    items.push(
      scene.add.rectangle(0, 0, 76, 7, fx.color, 0.82).setRotation(ang).setBlendMode(ADD),
      scene.add.rectangle(5, 0, 68, 2.2, 0xffffff, 0.96).setRotation(ang).setBlendMode(ADD),
    );
  } else if (k === "tracer") {
    // streak of light — a velocity-aligned hot capsule (reads opposite to the stubby pellet)
    items.push(scene.add.rectangle(0, 0, 15, 3, fx.color).setRotation(ang).setBlendMode(ADD));
    items.push(scene.add.circle(0, 0, 2, 0xffffff).setBlendMode(ADD));
  } else if (k === "pellet") {
    // buckshot — a small DENSE lead ball: dark rim under a tight hot core (reads heavy/stubby)
    items.push(scene.add.circle(0, 0, 4, 0x140a06, 0.5));
    items.push(scene.add.circle(0, 0, 3, blendHex(fx.color, 0x806040, 0.45)));
    items.push(scene.add.circle(0, 0, 1.6, 0xffe6c4));
  } else if (k === "orb") {
    // §38 arcane orb — a big soft glowing sphere: outer haze, saturated body, bright white core (reads
    // "spell", not "bullet"). The element tint (via fx.color) recolours the whole orb.
    items.push(scene.add.circle(0, 0, 13, fx.color, 0.3).setBlendMode(ADD));
    items.push(scene.add.circle(0, 0, 8.5, fx.color, 0.6).setBlendMode(ADD));
    items.push(scene.add.circle(0, 0, 3.4, 0xffffff).setBlendMode(ADD));
  } else if (k === "grenade") {
    // §41 mortar shell — a FAT dark tumbling round with a hot fuse glint: reads "payload", not "bullet".
    const shell = scene.add.ellipse(0, 0, 15, 10, 0x2b2622).setStrokeStyle(1.5, 0x14100c);
    const band = scene.add.rectangle(0, 0, 3.5, 10, fx.color, 0.9);
    const fuse = scene.add.circle(6, -3, 2.2, 0xffe6a0, 0.95).setBlendMode(ADD);
    items.push(shell, band, fuse);
    scene.tweens.add({
      targets: [shell, band],
      angle: 360,
      duration: 700,
      repeat: -1,
      ease: "Linear",
    });
    scene.tweens.add({ targets: fuse, alpha: 0.3, duration: 90, yoyo: true, repeat: -1 }); // sputtering fuse
  } else if (k === "fire-plume") {
    // Mauler payload: a dense taper of overlapping flame lobes with an ember-white leading core.
    items.push(
      scene.add.ellipse(-18, 0, 46, 22, 0x8f1e10, 0.56).setRotation(ang).setBlendMode(ADD),
      scene.add.ellipse(-8, 0, 38, 17, fx.color, 0.82).setRotation(ang).setBlendMode(ADD),
      scene.add.ellipse(2, 0, 22, 11, 0xffb23b, 0.94).setRotation(ang).setBlendMode(ADD),
      scene.add.circle(7, 0, 3.2, 0xfff0c4).setBlendMode(ADD),
    );
  } else if (recipe?.projectile === "electric-bolt" || k === "spark") {
    items.push(scene.add.circle(0, 0, 11, fx.color, 0.34).setBlendMode(ADD));
    items.push(scene.add.circle(0, 0, 6, fx.color, 0.82).setBlendMode(ADD));
    items.push(scene.add.rectangle(0, 0, 20, 3, 0xbfe8ff).setRotation(ang).setBlendMode(ADD));
    items.push(scene.add.circle(0, 0, 3, 0xffffff).setBlendMode(ADD));
    items.push(scene.add.circle(0, 0, 10).setStrokeStyle(1.5, 0x64b5ff, 0.9).setBlendMode(ADD));
  } else {
    const big = k === "slug";
    items.push(scene.add.circle(0, 0, big ? 9 : 6, fx.color, 0.5).setBlendMode(ADD));
    items.push(scene.add.circle(0, 0, big ? 3.4 : 2.2, 0xffffff));
    if (k === "ricochet" || k === "spark")
      items.push(scene.add.circle(0, 0, 7).setStrokeStyle(1.5, fx.color, 0.9).setBlendMode(ADD));
    if (k === "spark")
      items.push(scene.add.circle(0, 0, 10).setStrokeStyle(1, 0xffffff, 0.55).setBlendMode(ADD));
  }
  const payload = scene.add.container(0, 0, items);
  return scene.add
    .container(pr.x, pr.y, [payload])
    .setScale(Math.max(0.1, visualScale))
    .setDepth(99000)
    .setData("arcPayload", payload);
}

/** Gun-owned identity art layered over a velocity trail; null keeps the generic bullet renderer. */
export function makeGunIdentityProjectile(
  scene: Phaser.Scene,
  pr: { x: number; y: number; vx: number; vy: number; kind: string },
  weaponId: string,
  visualScale = 1,
): Phaser.GameObjects.Container | null {
  const weapon = WEAPONS[weaponId];
  const art = weapon?.gun?.projectileArt;
  if (!art) return null;
  const fx = gunFx(pr.kind);
  const angle = Math.atan2(pr.vy, pr.vx);
  const trail = scene.add
    .ellipse(-Math.cos(angle) * 13, -Math.sin(angle) * 13, 30, 7, fx.color, 0.4)
    .setRotation(angle)
    .setBlendMode(Phaser.BlendModes.ADD);
  const glow = scene.add
    .ellipse(0, 0, art === "bullet" ? 18 : 28, art === "bullet" ? 9 : 18, fx.color, 0.24)
    .setRotation(angle)
    .setBlendMode(Phaser.BlendModes.ADD);
  const children: Phaser.GameObjects.GameObject[] = [trail, glow];
  if (art === "bullet") {
    const body = scene.add
      .ellipse(0, 0, 16, 5.5, 0x35383d, 1)
      .setStrokeStyle(1, 0xc9b27a, 0.95)
      .setRotation(angle)
      .setData("ballisticCore", true);
    const jacket = scene.add
      .rectangle(-Math.cos(angle) * 4.5, -Math.sin(angle) * 4.5, 3, 5.5, 0xb77a45, 1)
      .setRotation(angle);
    const tip = scene.add
      .circle(Math.cos(angle) * 6.5, Math.sin(angle) * 6.5, 1.8, 0xe8e4d8, 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    children.push(body, jacket, tip);
  } else if (art === "weapon-crop") {
    const recipe = GUN_SPRITE_PROJECTILES[weaponId];
    const manifest = recipe ? SPRITES[recipe.spriteId as keyof typeof SPRITES] : undefined;
    const part = manifest?.parts.find((candidate) => candidate.role === recipe?.partRole);
    if (!recipe || !part) {
      trail.destroy();
      glow.destroy();
      return null;
    }
    const texture = partTexture(scene, recipe.spriteId, recipe.partRole);
    if (!scene.textures.exists(texture.key)) {
      trail.destroy();
      glow.destroy();
      return null;
    }
    const crop = recipe.crop;
    children.push(
      scene.add
        .image(0, 0, texture.key, texture.frame)
        .setCrop(crop.x, crop.y, crop.width, crop.height)
        .setOrigin((crop.x + crop.width * 0.5) / part.w, (crop.y + crop.height * 0.5) / part.h)
        .setScale(recipe.displayLength / crop.width)
        .setRotation(angle),
    );
  } else if (art === "generated") {
    const recipe = GUN_GENERATED_PROJECTILES[weaponId];
    const textureKey = `gun-generated:${weaponId}`;
    const sprite = recipe ? PROJECTILE_SPRITES[recipe.spriteId] : undefined;
    if (!recipe || !sprite || !scene.textures.exists(textureKey)) {
      trail.destroy();
      glow.destroy();
      return null;
    }
    const facing = projectileArtTransform(pr.vx, pr.vy, sprite.facing);
    const projectile = scene.add.image(0, 0, textureKey).setRotation(facing.rotation);
    const spriteScale = recipe.displayLength / Math.max(1, sprite.width);
    projectile.setScale(spriteScale * facing.scaleX, spriteScale);
    children.push(projectile);
  } else {
    const packId = GUN_PROJECTILE_ART_PACKS[art];
    const pack = PARTICLE_PACKS[packId];
    if (!pack || !scene.textures.exists(`ptcl:${packId}`)) {
      trail.destroy();
      glow.destroy();
      return null;
    }
    const displayLength = art === "arrow" ? 38 : art === "cannonball" ? 34 : 40;
    children.push(
      scene.add
        .image(0, 0, `ptcl:${packId}`, 0)
        .setScale(displayLength / pack.frameWidth)
        .setRotation(angle),
    );
  }
  const payload = scene.add.container(0, 0, children);
  return scene.add
    .container(pr.x, pr.y, [payload])
    .setScale(Math.max(0.1, visualScale))
    .setDepth(99000)
    .setData("arcPayload", payload)
    .setData("projectileSprite", GUN_GENERATED_PROJECTILES[weaponId]?.spriteId)
    .setData("projectileArt", art);
}
