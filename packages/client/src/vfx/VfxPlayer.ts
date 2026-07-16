// VfxPlayer — plays a weapon's authored VFX suite in the LIVE game on a real swing (§14, CODE-8). Runs
// the CANONICAL renderer (vfx-render.js — the exact module the Weaponsmith preview uses), so a suite
// authored in the smith renders identically in-world. Suites are baked by build-weapon-vfx.mjs.
//
// Each play spins up a pooled "surface" (a container + additive graphics + pooled emitters) at the
// strike point, oriented to the aim, and drives the suite over the accepted/predicted swing descriptor's
// 0→1 pose window (swing trail → impact burst → painted hero), then releases the surface.
import {
  bladeAngleAt,
  meleeReach,
  type SwingDescriptor,
  swingEdgeProgress,
  WEAPONS,
  type WeaponDef,
} from "@dd/shared";
import type Phaser from "phaser";
import { RENDER_DPR } from "../render-dpr.js";
import { preloadFxPacks } from "./fx-composer.js";
import { PARTICLE_PACKS } from "./particle-manifest.js";
import "./vfx-render.js"; // sets globalThis.VFXRENDER
import "./vfx-layers.js"; // sets globalThis.VFXLAYERS
import { WEAPON_VFX, type WeaponVfx } from "./weapon-vfx.generated.js";

const DEG = Math.PI / 180;
// Longest canonical emitter life is 900ms (embers top out at 880, scatter at 780). The authored draw
// finishes at the swing pose end, but the surface must stay put + visible until this tail dies naturally.
const PARTICLE_TAIL_MS = 900;

// §35/§36 ELEMENT + ARCHETYPE-DRIVEN fallback VFX: the +300 expansion weapons carry no authored suite, so an
// un-authored swing would otherwise look identical across all of them. Instead we synthesize a suite that
// reflects BOTH the weapon's ELEMENT (hue + a matching flourish — fire embers, shock arcs, holy sigils…) AND
// its physical ARCHETYPE (a rapier/spear THRUSTS, a greatsword CLEAVES with a shockwave, a dual-grip does an
// X twin-slash, a light blade leaves speed-lines) — so every one of the 300 reads unique with zero per-weapon
// authoring. It composes the SAME authored layers the Weaponsmith exposes, so it stays WYSIWYG. Hue (0 red →
// spectrum) feeds the renderer's lerpHue.
type Suite = WeaponVfx["suite"];
const ELEMENT_HUE: Record<string, number> = {
  physical: 0.55,
  fire: 0.03,
  frost: 0.54,
  shock: 0.63,
  holy: 0.13,
  toxic: 0.32,
  void: 0.8,
  arcane: 0.72,
};
const ELEMENT_PAINT: Record<string, number> = {
  physical: 0,
  fire: 1,
  frost: 2,
  shock: 3,
  holy: 4,
  toxic: 5,
  void: 6,
  arcane: 7,
};
const ELEMENT_COLOR: Record<string, number> = {
  physical: 0xd6dde6,
  fire: 0xff6a2a,
  frost: 0x6fd6ff,
  shock: 0xffe24a,
  holy: 0xffe6a0,
  toxic: 0x9cff3b,
  void: 0xb14bff,
  arcane: 0x8f6aff,
};
const PER_PACK_IDS = [
  "steel-wisp",
  "steel-bolt",
  "fire-wisp",
  "fire-bolt",
  "frost-wisp",
  "frost-bolt",
  "shock-wisp",
  "shock-bolt",
  "holy-wisp",
  "holy-bolt",
  "toxic-wisp",
  "toxic-bolt",
  "void-wisp",
  "void-bolt",
  "arcane-wisp",
  "arcane-bolt",
] as const;
const PER_LAYER_IDS = new Set(["blade-trail", "twin-slash", "thrust-streak"]);

/** The element FLOURISH (motion-agnostic sparks/rings/embers) overlaid on top of whatever swing SHAPE the
 *  archetype picked — this is the layer that says "fire" / "holy" / "void" regardless of the weapon's shape. */
function elementFlourish(element: string, h: number): Suite {
  switch (element) {
    case "fire":
      return {
        "ember-rain": { on: true, params: { count: 14, color: h } },
        "impact-flash": { on: true, params: { intensity: 0.6 } },
      };
    case "shock":
      return {
        "arc-bolt": { on: true, params: { color: h } },
        "shockwave-ring": { on: true, params: { color: h } },
      };
    case "frost":
      return {
        "hit-spark": { on: true, params: { count: 16, color: h } },
        "impact-flash": { on: true, params: { intensity: 0.5 } },
      };
    case "holy":
      return {
        "sigil-ring": { on: true, params: { color: h, size: 1 } },
        "impact-flash": { on: true, params: { intensity: 0.65 } },
      };
    case "toxic":
      return {
        "ember-rain": { on: true, params: { count: 12, color: h } },
        "hit-spark": { on: true, params: { count: 10, color: h } },
      };
    case "void":
      return {
        "shockwave-ring": { on: true, params: { color: h } },
        "sigil-ring": { on: true, params: { color: h, size: 1.1 } },
      };
    case "arcane":
      return {
        "sigil-ring": { on: true, params: { color: h, size: 1.2 } },
        "arc-bolt": { on: true, params: { color: h } },
      };
    default:
      return {}; // physical → the steel swing shape carries it, no elemental overlay
  }
}

/** Build a weapon's fallback PER suite from descriptor style, grip, size, and material hints. */
function buildWeaponSuite(
  element: string,
  style: SwingDescriptor["style"],
  tags?: WeaponDef["tags"],
): Suite {
  const h = ELEMENT_HUE[element] ?? 0.55;
  const heavy =
    style === "chop" ||
    (tags?.grip === "2H" && (tags?.size === "L" || tags?.size === "XL"));
  // Only a "long" reach band is a true polearm/spear/whip THRUST; "mid" is an ordinary sword (→ default arc).
  const reachy = style === "thrust";
  const dual = tags?.grip === "dual";
  const fast = tags?.size === "S"; // daggers / knives / light blades → snappy speed-lines
  const energy = /energy|plasma|laser|beam|photon|volt|light|neon/.test((tags?.family ?? "").toLowerCase());
  const blunt = /mace|maul|warhammer|hammer|gauntlet|fist|knuckle/.test(
    (tags?.family ?? "").toLowerCase(),
  );
  const perParams = {
    reach: 1,
    paint: ELEMENT_PAINT[element] ?? 0,
    history: 1,
    bodyAlpha: energy ? 0.52 : heavy || blunt ? 0.78 : 0.72,
    lipAlpha: energy ? 0.72 : heavy || blunt ? 0.36 : reachy ? 0.58 : 0.54,
    lipColor: ELEMENT_COLOR[element] ?? 0xd6dde6,
    color: h,
  };
  let base: Suite;
  // §41 NOTE: the old fallbacks also layered "edge-trail" (a thin trailing arc line) on most swings — it
  // read as "a weird narrow white line" (user), so it's dropped from every fallback. Authored suites keep it.
  if (dual) {
    // twin blades → an X twin-slash
    base = {
      "twin-slash": { on: true, params: perParams },
    };
  } else if (reachy) {
    // spear / polearm → a long forward THRUST streak
    base = {
      "thrust-streak": { on: true, params: perParams },
    };
  } else if (heavy) {
    // greatsword / maul → a WIDE cleave with a ground shockwave
    base = {
      "blade-trail": { on: true, params: perParams },
      "cleave-flash": { on: true, params: { intensity: 0.85 } },
      "shockwave-ring": { on: true, params: { color: h } },
    };
  } else if (fast) {
    // dagger / light blade → a crisp crescent + speed-line blade-trail
    base = {
      "blade-trail": { on: true, params: perParams },
    };
  } else {
    // ordinary sword — the clean crescent alone (the safe default for everything unclassified)
    base = {
      "blade-trail": { on: true, params: perParams },
    };
  }
  if (energy) base["impact-flash"] = { on: true, params: { intensity: 0.6 } }; // plasma/laser glow pop
  return { ...base, ...elementFlourish(element, h) };
}

/** Memoized per-weapon fallback suites (built once per weapon id; element-only if the id is unknown). */
const FALLBACK_CACHE = new Map<string, Suite>();
function fallbackSuiteFor(
  weaponId: string,
  element: string,
  style: SwingDescriptor["style"],
): Suite {
  const key = weaponId || `el:${element}:${style}`;
  let s = FALLBACK_CACHE.get(key);
  if (!s) {
    s = buildWeaponSuite(element, style, WEAPONS[weaponId]?.tags);
    FALLBACK_CACHE.set(key, s);
  }
  return s;
}

interface Surface {
  container: Phaser.GameObjects.Container;
  S: VfxSurface;
  busy: boolean;
  generation: number;
  activeTween?: Phaser.Tweens.Tween;
  releaseEvent?: Phaser.Time.TimerEvent;
  scatterKey?: string;
}

interface PerRuntimeSurface {
  perQuality?: 4 | 8 | 12;
  perLongTailFired?: boolean;
  perBody?: Phaser.GameObjects.Rope;
  perLip?: Phaser.GameObjects.Rope;
  per?: {
    swing: SwingDescriptor;
    reach: number;
    swingArc: number;
    style: SwingDescriptor["style"];
    size?: WeaponDef["tags"]["size"];
    grip?: WeaponDef["tags"]["grip"];
    family?: string;
    paint: number;
    originX: number;
    originY: number;
    edgeProgress(elapsedSeconds: number): number;
    angleAt(progress: number): number;
  };
}

const perRuntime = (S: VfxSurface): PerRuntimeSurface => S as unknown as PerRuntimeSurface;

export class VfxPlayer {
  private readonly scene: Phaser.Scene;
  private readonly pool: Surface[] = [];
  private readonly cap = 12;
  private stealCursor = 0;
  /** All VFX surfaces live under this container so ONE bloom filter glows every effect at once. */
  private readonly root: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    globalThis.VFXRENDER.ensureTextures(scene);
    this.root = scene.add.container(0, 0).setDepth(99000);
    // Per-object BLOOM (Phaser 4 Filters): bright additive sparks/fire glow without hazing the rest of
    // the scene. Degrades gracefully if filters are unavailable in this build/context.
    // §28 hi-DPI: the container FILTER renders through its own framebuffer that doesn't compose under a
    // zoomed/origin-shifted camera — it offsets every VFX. So only enable bloom at RENDER_DPR 1 (no
    // camera zoom); under hi-DPI we drop the glow to keep the VFX aligned to the world. (A camera-level
    // glow that respects the zoom is the proper fix later.)
    if (RENDER_DPR === 1) {
      try {
        const r = this.root as unknown as {
          enableFilters?: () => void;
          filters?: {
            internal?: { addGlow?: (c: number, o: number, i: number, s: number) => void };
          };
        };
        r.enableFilters?.();
        r.filters?.internal?.addGlow?.(0xffe6b0, 4, 0, 1.25);
      } catch {
        /* no bloom — sparks still render, just unbloomed */
      }
    }
  }

  /** The bloom-filtered container every VFX lives under — exposed so other renderers (e.g. ArenaScene's
   *  chain-lightning bolt) can share the same glow root instead of spinning up a second filter. */
  get bloomRoot(): Phaser.GameObjects.Container {
    return this.root;
  }

  /** §14 whether this weapon's authored VFX spawns at the in-game CURSOR (clamped, greatsword-quake style)
   *  rather than at the weapon anchor. The caller picks the spawn point; the offset/origin still applies. */
  spawnsAtCursor(weaponId: string): boolean {
    return !!WEAPON_VFX[weaponId]?.spawnAtCursor;
  }

  /** Preload every authored hero skin + scatter sheet referenced by the baked VFX (call in scene.preload). */
  static preloadAssets(scene: Phaser.Scene): void {
    // §49 the twelve component packs are deliberately all boot-queued: they are small, observed remote
    // weapons can change without warning, and the optional loader/no-op composer absorbs absent files.
    preloadFxPacks(scene);
    // Live play keeps PER's audited wisp/bolt sheets hot. The canonical JS renderer also has a relative
    // lazy-load path for standalone preview hosts and retains its filled Graphics fallback while loading.
    for (const id of PER_PACK_IDS) {
      const pack = PARTICLE_PACKS[id];
      if (pack)
        scene.load.spritesheet(`ptcl:${id}`, pack.url, {
          frameWidth: pack.frameWidth,
          frameHeight: pack.frameWidth,
        });
    }
    for (const [id, vfx] of Object.entries(WEAPON_VFX)) {
      if (vfx.hero) scene.load.image(`vfxhero:${id}`, vfx.hero);
      if (vfx.scatter) {
        scene.load.spritesheet(`scatter:${vfx.scatter.url}`, vfx.scatter.url, {
          frameWidth: vfx.scatter.frameWidth,
          frameHeight: vfx.scatter.frameHeight,
        });
      }
    }
  }

  /** Stop every owner of a surface before reassigning it. Generation checks are still required: Phaser can
   *  already have queued a completion callback in the same tick that a pressure-steal happens. */
  private prepare(surf: Surface): Surface {
    surf.generation++;
    surf.activeTween?.stop();
    surf.activeTween = undefined;
    surf.releaseEvent?.remove(false);
    surf.releaseEvent = undefined;
    surf.S.gfxAdd?.clear();
    const per = perRuntime(surf.S);
    per.perBody?.setVisible(false);
    per.perLip?.setVisible(false);
    per.perLongTailFired = false;
    per.per = undefined;
    (surf.S.heroImg as Phaser.GameObjects.Image | undefined)?.setVisible(false);
    const emitters = surf.S as unknown as Record<string, { killAll(): unknown } | undefined>;
    for (const key of ["eSpark", "eEmber", "eSoftAdd", "eSoftNorm", "eStreak", "eScatter"])
      emitters[key]?.killAll();
    surf.container.setVisible(false);
    surf.busy = true;
    return surf;
  }

  private acquire(): Surface {
    let busy = 0;
    for (const candidate of this.pool) if (candidate.busy) busy++;
    let surf = this.pool.find((p) => !p.busy);
    if (!surf) {
      if (this.pool.length >= this.cap) {
        // Pressure steals rotate through the pool; `prepare` fully cancels the old owner so no old counter
        // can clear the new strike and no live ember/scatter can teleport to its reassigned container.
        surf = this.pool[this.stealCursor % this.pool.length] as Surface;
        this.stealCursor = (this.stealCursor + 1) % this.pool.length;
      } else {
        const container = this.scene.add.container(0, 0);
        this.root.add(container); // under the bloom root
        const S = {
          suite: {},
          fired: {},
          R: 80,
          heroEnabled: true,
          scene: this.scene,
          container,
        } as unknown as VfxSurface;
        const heroImg = this.scene.add.image(0, 0, "vfx-blank").setVisible(false);
        container.add(heroImg);
        S.heroImg = heroImg;
        globalThis.VFXRENDER.attachSurface(this.scene, S);
        surf = { container, S, busy: false, generation: 0 };
        this.pool.push(surf);
      }
    }
    const activeAfterAcquire = busy + (surf.busy ? 0 : 1);
    const acquired = this.prepare(surf);
    perRuntime(acquired.S).perQuality =
      activeAfterAcquire <= 6 ? 12 : activeAfterAcquire <= 9 ? 8 : 4;
    return acquired;
  }

  /** Fire a weapon's swing VFX at world (x,y), pointing toward `aimRad`. The VFX SIZE is the weapon's
   *  authored fixed `vfxRadius` (§14 — never stat/level-scaled); `radius` is only a fallback for weapons
   *  with no baked entry at all. */
  playSwing(
    weaponId: string,
    x: number,
    y: number,
    aimRad: number,
    radius: number,
    swing: SwingDescriptor,
    element = "physical",
  ): void {
    const VR = globalThis.VFXRENDER;
    if (!VR) return;
    const vfx: WeaponVfx | undefined = WEAPON_VFX[weaponId];
    const surf = this.acquire();
    const generation = surf.generation;
    const S = surf.S;
    const weapon = WEAPONS[weaponId];
    const authored = !!(vfx?.suite && Object.keys(vfx.suite).length > 0);
    // Authored suite wins; else a synthesized ELEMENT + ARCHETYPE fallback (§35/§36) so every un-authored
    // expansion weapon reads unique by both its element AND its physical shape (thrust / cleave / twin / fast).
    S.suite = authored ? (vfx?.suite as Suite) : fallbackSuiteFor(weaponId, element, swing.style);
    S.fired = {};
    S.R = vfx?.vfxRadius ?? radius; // authored fixed size wins
    const swingArc = weapon?.swingArc ?? Math.PI * 0.7;
    const perRot = authored ? (vfx?.rot ?? 0) * DEG : 0;
    const perOrigin = authored && !vfx?.spawnAtCursor && weapon;
    const perAnchorX = perOrigin ? -weapon.range * 0.6 - (vfx?.vfxOrigin?.x ?? 0) : 0;
    const perAnchorY = perOrigin ? -(vfx?.vfxOrigin?.y ?? 0) : 0;
    perRuntime(S).per = {
      swing,
      reach: weapon ? meleeReach(weapon) : radius,
      swingArc,
      style: swing.style,
      size: weapon?.tags.size,
      grip: weapon?.tags.grip,
      family: weapon?.tags.family,
      paint: ELEMENT_PAINT[element] ?? 0,
      originX: perAnchorX * Math.cos(perRot) + perAnchorY * Math.sin(perRot),
      originY: -perAnchorX * Math.sin(perRot) + perAnchorY * Math.cos(perRot),
      edgeProgress: (elapsedSeconds) => swingEdgeProgress(swing, elapsedSeconds),
      angleAt: (progress) => bladeAngleAt(-perRot, swingArc, progress),
    };
    S.heroEnabled = true;
    S.wantHeroKey = vfx?.hero ? `vfxhero:${weaponId}` : null;
    if (vfx?.scatter) {
      const key = `scatter:${vfx.scatter.url}`;
      if (surf.scatterKey !== key) {
        VR.loadScatter(
          S,
          vfx.scatter.url,
          vfx.scatter.frameWidth,
          vfx.scatter.frameHeight,
          vfx.scatter.count,
        );
        surf.scatterKey = key;
      }
    } else {
      S.scatterMeta = null;
    }
    // §14 authored VFX ORIGIN: shift the spawn by the placed offset, rotated into the aim frame so the
    // anchor stays consistent whichever way the weapon points (no offset = spawn at the strike point).
    let ox = x;
    let oy = y;
    if (!authored && !vfx?.spawnAtCursor && weapon) {
      // Arena's existing fallback call supplies its historical 60%-reach strike point. Recover the rendered
      // wielder center here so PER and the descriptor's radial blade segment share one origin.
      const strikeOffset = weapon.range * 0.6;
      ox -= Math.cos(aimRad) * strikeOffset;
      oy -= Math.sin(aimRad) * strikeOffset;
    }
    const o = authored ? vfx?.vfxOrigin : undefined;
    if (o && (o.x || o.y)) {
      const c = Math.cos(aimRad);
      const s = Math.sin(aimRad);
      ox = x + o.x * c - o.y * s;
      oy = y + o.x * s + o.y * c;
    }
    surf.container
      .setPosition(ox, oy)
      .setRotation(aimRad + (authored ? (vfx?.rot ?? 0) * DEG : 0))
      .setVisible(true);
    const activeSeconds = Math.max(0, swing.activeEndSeconds - swing.activeStartSeconds);
    const followSeconds = Math.min(
      Math.max(0, swing.poseSeconds - swing.activeEndSeconds),
      Math.max(0.035, Math.min(0.09, activeSeconds * 0.22)),
    );
    const ribbonOnly = Object.entries(S.suite).every(
      ([id, layer]) => !layer.on || PER_LAYER_IDS.has(id),
    );
    const renderSeconds = ribbonOnly
      ? Math.min(swing.poseSeconds, swing.activeEndSeconds + followSeconds)
      : swing.poseSeconds;
    const endPhase = swing.poseSeconds > 0 ? Math.min(1, renderSeconds / swing.poseSeconds) : 1;
    surf.activeTween = this.scene.tweens.addCounter({
      from: 0,
      to: endPhase,
      // §44 authored + fallback suites share the SAME effective-cooldown window as the rig. Layer phase
      // authoring is unchanged; only the tween time base replaces the former fixed 470ms playback.
      duration: Math.max(1, renderSeconds * 1000),
      onUpdate: (tw) => {
        if (surf.generation !== generation) return;
        const p = tw.getValue() ?? 0;
        S.gfxAdd?.clear();
        VR.renderHero(this.scene, S, p);
        VR.renderLayers(S, p, "all", 1);
      },
      onComplete: () => {
        if (surf.generation !== generation) return;
        surf.activeTween = undefined;
        S.gfxAdd?.clear();
        const per = perRuntime(S);
        per.perBody?.setVisible(false);
        per.perLip?.setVisible(false);
        (S.heroImg as Phaser.GameObjects.Image | undefined)?.setVisible(false);
        const release = (): void => {
          if (surf.generation !== generation) return;
          surf.releaseEvent = undefined;
          const emitters = S as unknown as Record<string, { killAll(): unknown } | undefined>;
          for (const key of ["eSpark", "eEmber", "eSoftAdd", "eSoftNorm", "eStreak", "eScatter"])
            emitters[key]?.killAll();
          surf.container.setVisible(false);
          surf.busy = false;
        };
        // A particle-free PER swing returns to the pool at descriptor follow-through. Only an emitter that
        // actually exploded earns the legacy tail delay; pressure steals still cancel either owner safely.
        if (per.perLongTailFired)
          surf.releaseEvent = this.scene.time.delayedCall(PARTICLE_TAIL_MS, release);
        else release();
      },
    });
  }
}
