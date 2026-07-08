import type { WeaponDef } from "@dd/shared";
import Phaser from "phaser";
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

/** Fiery AoE explosion where a magma ball died — a flash + a shockwave ring expanding to EXACTLY the
 *  blast radius (the server hitbox) + a hot footprint disc + flung sparks. §14 WYSIWYG: visual = hitbox. */
export function spawnExplosion(scene: Phaser.Scene, x: number, y: number, radius: number): void {
  const flash = scene.add
    .circle(x, y, radius * 0.5, 0xffe6b0, 0.9)
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
    .setStrokeStyle(4, 0xff8a2b, 0.95)
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
    .circle(x, y, radius, 0xff5a1e, 0.32)
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
      .circle(x, y, 2.5, 0xffd9a0, 0.9)
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

/** §19 v0.108 floating combat text — MAGNITUDE-DRIVEN so hits read as weak vs crushing. Size + color +
 *  travel scale with the number, and the top band gets a BIG-HIT pop (overshoot-in from 1.6× + a longer
 *  rise + a red-stroked white-hot tint). Purely cosmetic off a number the client already has — no balance
 *  change. A small x-jitter fans rapid hits so they don't stack into an unreadable pillar. */
export function spawnDamageNumber(
  scene: Phaser.Scene,
  x: number,
  y: number,
  amount: number,
  crit = false,
): void {
  const dmg = Math.max(1, Math.round(amount));
  // Bands: chip / normal / heavy / crushing.
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
  // §30 CRIT overrides the band: a bold GOLD number with an amber stroke + a bang, always large — a crit
  // reads instantly as a spike regardless of the raw amount.
  if (crit) {
    size = Math.max(size, 30);
    color = "#ffe27a";
    stroke = "#ff9e2c";
  }
  const big = dmg >= 40 || crit;
  const jx = (Math.random() - 0.5) * 12;
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontSize: `${size}px`,
    color,
    fontStyle: "bold",
  };
  if (stroke) {
    style.stroke = stroke;
    style.strokeThickness = crit ? 4 : 3;
  }
  const text = scene.add
    .text(x + jx, y, crit ? `${dmg}!` : String(dmg), style)
    .setOrigin(0.5)
    .setDepth(100000);
  if (big) text.setScale(crit ? 1.9 : 1.6);
  scene.tweens.add({
    targets: text,
    scale: 1,
    y: y - (big ? 40 : 30),
    duration: big ? 140 : 120,
    ease: "Back.easeOut",
    onComplete: () => {
      scene.tweens.add({
        targets: text,
        y: text.y - 14,
        alpha: 0,
        duration: big ? 620 : 480,
        ease: "Cubic.easeOut",
        onComplete: () => text.destroy(),
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
