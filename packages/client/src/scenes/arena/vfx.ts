import type { WeaponDef } from "@dd/shared";
import Phaser from "phaser";
import { elementPack, particleBurst } from "../../vfx/particles.js";
import { blendHex } from "./draw-util.js";
import { gunFx } from "./projectile-factory.js";

/**
 * Transient combat VFX factories, extracted from ArenaScene. Each is a pure spawner: it takes the scene
 * (GameObject factory + tween manager + camera) and world coords, draws a short-lived effect, and tweens
 * it out (self-destructing). No scene private state — the scene's sync/combat loops just call these. The
 * level-up celebration stays in the scene (it reads screen-space HUD dimensions).
 */

/** §7 v0.105 de-clunk (adversarial-verify fix): route a camera shake through ArenaScene's PRIORITIZED
 *  `shakeCam` so it participates in the same force/priority arbitration as every other shake site — a raw
 *  `cameras.main.shake()` here (no `force`) is silently dropped whenever another shake is running, AND it
 *  never updates the scene's shake bookkeeping, so a later weaker shake would stomp it. Falls back to a
 *  forced raw shake if the host scene isn't an ArenaScene (defensive — e.g. a different scene reusing these). */
function shakeVia(scene: Phaser.Scene, duration: number, intensity: number): void {
  const s = scene as unknown as { shakeCam?: (d: number, i: number) => void };
  if (typeof s.shakeCam === "function") s.shakeCam(duration, intensity);
  else scene.cameras.main.shake(duration, intensity, true);
}

/** §9 per-gun MUZZLE FLASH — the shaped 8-prong caged-fire star (the same geometry as the engine
 *  `drawMuzzleFlash`) drawn at the barrel, sized + tinted per gun, with a hot core + white centre, then
 *  faded out fast. Cheap (one Graphics + a tween) so it survives the gatling's fire rate. */
export function spawnMuzzleFlash(
  scene: Phaser.Scene,
  x: number,
  y: number,
  ang: number,
  size: number,
  color: number,
  style = "heavy",
): void {
  const hot = blendHex(color, 0xffffff, 0.55);
  const TAU = Math.PI * 2;
  const g = scene.add.graphics().setDepth(99500).setBlendMode(Phaser.BlendModes.ADD);
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
    const smoke = scene.add
      .circle(
        x + Math.cos(ang) * size * 0.5,
        y + Math.sin(ang) * size * 0.5,
        size * 0.5,
        0x2a2018,
        0.4,
      )
      .setDepth(99450);
    scene.tweens.add({
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
  scene.tweens.add({
    targets: g,
    alpha: 0,
    scaleX: grow,
    scaleY: grow,
    duration: style === "rapid" ? 70 : style === "boom" ? 135 : 105,
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
    if (style === "heavy" || style === "boom") {
      particleBurst(scene, "steel-wisp", x + Math.cos(ang) * size * 0.6, y + Math.sin(ang) * size * 0.6, {
        count: 1,
        dirRad: ang - Math.PI / 2 + (Math.random() - 0.5) * 0.6, // curls upward off the barrel
        spread: 0.2,
        speed: 40,
        scale: 0.5,
        lifeMs: 700,
      });
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
  const fx = gunFx(kind);
  // §41 PAINTED element burst on top of the procedural impact — the ":element" bullet-kind suffix picks the
  // pack (fire embers, frost shards, arcane motes for the caster orb…); physical bullets throw steel motes.
  {
    const ci = kind.indexOf(":");
    const el = ci < 0 ? undefined : kind.slice(ci + 1);
    const shape = kind.startsWith("orb") ? "mote" : "shard";
    particleBurst(scene, elementPack(el, shape), x, y, {
      count: 3,
      dirRad: ang + Math.PI, // spray back against the flight direction
      spread: 0.8,
      speed: 160,
      scale: 0.34,
      lifeMs: 300,
      additive: shape === "mote",
      sink: 8,
    });
  }
  const ADD = Phaser.BlendModes.ADD;
  const flash = (r: number, sc: number, dur: number) => {
    const f = scene.add.circle(x, y, r, 0xfff0d0, 0.9).setBlendMode(ADD).setDepth(99400);
    scene.tweens.add({
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
    const dart = scene.add.rectangle(x, y, 9, 2, 0xd6dde6, 0.95).setRotation(ang).setDepth(98500);
    scene.tweens.add({ targets: dart, alpha: 0, duration: 420, onComplete: () => dart.destroy() });
    return;
  }
  if (kind === "ricochet") {
    flash(6, 2, 130);
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = scene.add
        .rectangle(x, y, 12, 1.6, 0x5dd6ff, 0.95)
        .setRotation(a)
        .setBlendMode(ADD)
        .setDepth(99400);
      scene.tweens.add({
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
    const dust = scene.add
      .circle(x, y, 5, 0x6b5a44, 0)
      .setStrokeStyle(2, 0x6b5a44, 0.5)
      .setDepth(98200);
    scene.tweens.add({
      targets: dust,
      scale: 3,
      alpha: 0,
      duration: 280,
      onComplete: () => dust.destroy(),
    });
  }
  for (let i = 0; i < 3; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = scene.add
      .rectangle(x, y, 11, 2, fx.color, 0.9)
      .setRotation(a)
      .setBlendMode(ADD)
      .setDepth(99400);
    scene.tweens.add({
      targets: s,
      x: x + Math.cos(a) * 16,
      y: y + Math.sin(a) * 16,
      alpha: 0,
      duration: 170,
      onComplete: () => s.destroy(),
    });
  }
  const scorch = scene.add.circle(x, y, 4, 0x161009, 0.5).setDepth(98000);
  scene.tweens.add({
    targets: scorch,
    alpha: 0,
    duration: 1100,
    onComplete: () => scorch.destroy(),
  });
}

/** §41 element accent colours for the explosion composite (flash/ring/disc tint). Fire is the default. */
const FIRE_TINT = { hot: 0xffe6b0, mid: 0xff8a2b };
const EXPLODE_TINT: Record<string, { hot: number; mid: number }> = {
  fire: FIRE_TINT,
  frost: { hot: 0xe8fbff, mid: 0x6fd6ff },
  shock: { hot: 0xfffbe0, mid: 0xffe24a },
  holy: { hot: 0xfff8e8, mid: 0xffe6a0 },
  toxic: { hot: 0xeaffd0, mid: 0x9cff3b },
  void: { hot: 0xe8d0ff, mid: 0xb14bff },
  arcane: { hot: 0xe6dcff, mid: 0x8f6aff },
};

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
  element = "fire",
): void {
  const tint = EXPLODE_TINT[element] ?? FIRE_TINT;
  // PAINTED eruption (§41): element shards blasted out past the rim, embers/motes inside, smoke wisps
  // rising and lingering, plus ONE painted ring frame punched up as the halo. All degrade to no-ops
  // pre-load; the procedural composite below always renders.
  particleBurst(scene, elementPack(element, "shard"), x, y, {
    count: Math.round(6 + radius / 22),
    speed: radius * 2.6,
    scale: 0.55,
    lifeMs: 420,
    sink: 14,
  });
  particleBurst(scene, elementPack(element, "mote"), x, y, {
    count: 6,
    speed: radius * 1.4,
    scale: 0.4,
    lifeMs: 360,
    additive: true,
  });
  particleBurst(scene, elementPack(element, "wisp"), x, y, {
    count: 3,
    dirRad: -Math.PI / 2, // smoke drifts UP
    spread: 0.5,
    speed: 55,
    scale: 0.7,
    lifeMs: 900,
  });
  particleBurst(scene, elementPack(element, "ring"), x, y, {
    count: 1,
    speed: 0,
    scale: radius / 60,
    lifeMs: 340,
    additive: true,
  });
  // Lingering scorch footprint (reads as the blast having HAPPENED, after the light fades).
  const scorch = scene.add.circle(x, y, radius * 0.55, 0x120c08, 0.4).setDepth(2);
  scene.tweens.add({ targets: scorch, alpha: 0, duration: 2600, onComplete: () => scorch.destroy() });
  // Radius-scaled kick through the scene's prioritized shake.
  shakeVia(scene, 200, Math.min(0.02, 0.006 + radius / 9000));
  spawnExplosionCore(scene, x, y, radius, tint);
}

/** The procedural explosion composite (flash + shockwave + footprint + sparks), element-tinted. */
function spawnExplosionCore(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  tint: { hot: number; mid: number },
): void {
  const flash = scene.add
    .circle(x, y, radius * 0.5, tint.hot, 0.9)
    .setDepth(99002)
    .setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: flash,
    scale: 1.6,
    alpha: 0,
    duration: 220,
    ease: "Quad.easeOut",
    onComplete: () => flash.destroy(),
  });
  const ring = scene.add
    .circle(x, y, radius)
    .setStrokeStyle(4, tint.mid, 0.95)
    .setScale(0.2)
    .setDepth(99002)
    .setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: ring,
    scale: 1,
    alpha: 0,
    duration: 300,
    ease: "Quad.easeOut",
    onComplete: () => ring.destroy(),
  });
  const disc = scene.add
    .circle(x, y, radius, tint.mid, 0.3)
    .setDepth(99001)
    .setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: disc,
    alpha: 0,
    scale: 1.05,
    duration: 260,
    ease: "Quad.easeOut",
    onComplete: () => disc.destroy(),
  });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
    const spark = scene.add
      .circle(x, y, 2.5, tint.hot, 0.9)
      .setDepth(99002)
      .setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
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

/** Small impact splat where a projectile hit or expired (green spit / amber cleaver). */
export function spawnSplat(scene: Phaser.Scene, x: number, y: number, kind?: string): void {
  const color = kind === "cleaver" ? 0xffb23b : 0xc9ff5e;
  const ring = scene.add.circle(x, y, 7, color, 0.7).setDepth(99001);
  scene.tweens.add({
    targets: ring,
    scale: 2.2,
    alpha: 0,
    duration: 230,
    ease: "Quad.easeOut",
    onComplete: () => ring.destroy(),
  });
}

/** Earthquake VFX (§14): the Codex hero skin (authored in the Weaponsmith) if the weapon carries
 *  one, else the procedural fallback. Both composite engine dust/debris/flash/shake. */
export function spawnQuake(
  scene: Phaser.Scene,
  x: number,
  y: number,
  quake: NonNullable<WeaponDef["quake"]>,
): void {
  if (quake.vfx && scene.textures.exists(quake.vfx.image)) {
    spawnQuakeHero(scene, x, y, quake.radius, quake.vfx);
  } else {
    spawnQuakeProcedural(scene, x, y, quake.radius);
  }
}

/** Hero-skin quake: the Codex slab eruption (candidate-8) erupting up + engine overlays. The
 *  `vfx` params (radius/flash/dust/debris/shake) were dialed in the Weaponsmith and baked here. */
export function spawnQuakeHero(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  vfx: NonNullable<NonNullable<WeaponDef["quake"]>["vfx"]>,
): void {
  // Hero sprite scaled so its width spans the AoE diameter × the authored visual radius.
  // UNIFORM scale (no foreshortening squish) — the hand-drawn art keeps its painted aspect (§28.4).
  const src = scene.textures.get(vfx.image).getSourceImage();
  const full = (radius * 2 * vfx.radius) / src.width;
  // Low ground depth so the character (depth = y) always renders OVER the eruption.
  const hero = scene.add.image(x, y, vfx.image).setOrigin(0.5, 0.5).setDepth(6);
  hero.setScale(full * 0.32).setAlpha(0);
  scene.tweens.add({
    targets: hero,
    scale: full,
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

  // Engine dust kicked up (param 0..1).
  if (vfx.dust > 0) {
    const dust = scene.add
      .ellipse(x, y, radius * 1.8, radius, 0x6e7042, 0.36 * vfx.dust)
      .setScale(0.4)
      .setDepth(4);
    scene.tweens.add({
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
    const bit = scene.add
      .rectangle(x, y, sz, sz * 0.8, Math.random() < 0.5 ? 0x4a5159 : 0x2b3037)
      .setStrokeStyle(1.5, 0x13161a)
      .setDepth(8);
    scene.tweens.add({
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
    const flash = scene.add
      .ellipse(x, y, radius * 2.2, radius * 1.2, 0xffcaa0, 0.7 * vfx.flash)
      .setBlendMode(Phaser.BlendModes.SCREEN)
      .setDepth(5);
    scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.25,
      duration: 240,
      ease: "Cubic.easeOut",
      onComplete: () => flash.destroy(),
    });
  }

  shakeVia(scene, 220, 0.02 * vfx.shake);
}

/** Procedural quake fallback (golden ground shockwave) for quake weapons without a VFX skin. */
export function spawnQuakeProcedural(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
): void {
  const ring = scene.add.ellipse(x, y, 44, 26).setStrokeStyle(5, 0xffb23b, 0.9).setDepth(99998);
  scene.tweens.add({
    targets: ring,
    scaleX: (radius * 2) / 44,
    scaleY: ((radius * 2) / 44) * 0.62,
    alpha: 0,
    duration: 400,
    ease: "Cubic.easeOut",
    onComplete: () => ring.destroy(),
  });
  const dust = scene.add.ellipse(x, y, 34, 20, 0x6e7042, 0.4).setDepth(99997);
  scene.tweens.add({
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
    const p = scene.add.circle(x, y, 6, 0x8a6a3a, 0.75).setDepth(99999);
    scene.tweens.add({
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
  shakeVia(scene, 220, 0.012);
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
