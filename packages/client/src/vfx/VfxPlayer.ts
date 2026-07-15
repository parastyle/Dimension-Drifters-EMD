// VfxPlayer — plays a weapon's authored VFX suite in the LIVE game on a real swing (§14, CODE-8). Runs
// the CANONICAL renderer (vfx-render.js — the exact module the Weaponsmith preview uses), so a suite
// authored in the smith renders identically in-world. Suites are baked by build-weapon-vfx.mjs.
//
// Each play spins up a pooled "surface" (a container + additive graphics + pooled emitters) at the
// strike point, oriented to the aim, and drives the suite over one 0→1 sweep (swing trail → impact
// burst → painted hero), then releases the surface. Weapons with no authored suite get a default slash.
import { WEAPONS, type WeaponDef } from "@dd/shared";
import type Phaser from "phaser";
import { RENDER_DPR } from "../render-dpr.js";
import "./vfx-render.js"; // sets globalThis.VFXRENDER
import "./vfx-layers.js"; // sets globalThis.VFXLAYERS
import { WEAPON_VFX, type WeaponVfx } from "./weapon-vfx.generated.js";

const DEG = Math.PI / 180;
const DURATION = 470; // ms — one swing's VFX window (matches the smith's IMPACT+VFX_DUR feel)

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

/** Build a weapon's fallback suite from its element + physical archetype (grip/size/rangeBand/family). */
function buildWeaponSuite(element: string, tags?: WeaponDef["tags"]): Suite {
  const h = ELEMENT_HUE[element] ?? 0.55;
  const heavy = tags?.grip === "2H" && (tags?.size === "L" || tags?.size === "XL");
  // Only a "long" reach band is a true polearm/spear/whip THRUST; "mid" is an ordinary sword (→ default arc).
  const reachy = tags?.rangeBand === "long";
  const dual = tags?.grip === "dual";
  const fast = tags?.size === "S"; // daggers / knives / light blades → snappy speed-lines
  const energy = /energy|plasma|laser|beam|photon|volt|light|neon/.test((tags?.family ?? "").toLowerCase());
  let base: Suite;
  // §41 NOTE: the old fallbacks also layered "edge-trail" (a thin trailing arc line) on most swings — it
  // read as "a weird narrow white line" (user), so it's dropped from every fallback. Authored suites keep it.
  if (dual) {
    // twin blades → an X twin-slash
    base = {
      "twin-slash": { on: true, params: { reach: 1, color: h } },
    };
  } else if (reachy) {
    // spear / polearm → a long forward THRUST streak
    base = {
      "thrust-streak": { on: true, params: { reach: 1.35, color: h } },
    };
  } else if (heavy) {
    // greatsword / maul → a WIDE cleave with a ground shockwave
    base = {
      "slash-arc": { on: true, params: { reach: 1.2, width: 10, color: h } },
      "cleave-flash": { on: true, params: { intensity: 0.85 } },
      "shockwave-ring": { on: true, params: { color: h } },
    };
  } else if (fast) {
    // dagger / light blade → a crisp crescent + speed-line blade-trail
    base = {
      "slash-arc": { on: true, params: { reach: 0.95, width: 5, color: h } },
      "blade-trail": { on: true, params: { reach: 1, color: h, lines: 4 } },
    };
  } else {
    // ordinary sword — the clean crescent alone (the safe default for everything unclassified)
    base = {
      "slash-arc": { on: true, params: { reach: 1, width: 6, color: h } },
    };
  }
  if (energy) base["impact-flash"] = { on: true, params: { intensity: 0.6 } }; // plasma/laser glow pop
  return { ...base, ...elementFlourish(element, h) };
}

/** Memoized per-weapon fallback suites (built once per weapon id; element-only if the id is unknown). */
const FALLBACK_CACHE = new Map<string, Suite>();
function fallbackSuiteFor(weaponId: string, element: string): Suite {
  const key = weaponId || `el:${element}`;
  let s = FALLBACK_CACHE.get(key);
  if (!s) {
    s = buildWeaponSuite(element, WEAPONS[weaponId]?.tags);
    FALLBACK_CACHE.set(key, s);
  }
  return s;
}

interface Surface {
  container: Phaser.GameObjects.Container;
  S: VfxSurface;
  busy: boolean;
  scatterKey?: string;
}

export class VfxPlayer {
  private readonly scene: Phaser.Scene;
  private readonly pool: Surface[] = [];
  private readonly cap = 12;
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

  private acquire(): Surface {
    let surf = this.pool.find((p) => !p.busy);
    if (!surf) {
      if (this.pool.length >= this.cap) {
        surf = this.pool[0] as Surface; // under pressure, steal the oldest (it just overdraws a frame)
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
        surf = { container, S, busy: false };
        this.pool.push(surf);
      }
    }
    return surf;
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
    element = "physical",
  ): void {
    const VR = globalThis.VFXRENDER;
    if (!VR) return;
    const vfx: WeaponVfx | undefined = WEAPON_VFX[weaponId];
    const surf = this.acquire();
    surf.busy = true;
    const S = surf.S;
    // Authored suite wins; else a synthesized ELEMENT + ARCHETYPE fallback (§35/§36) so every un-authored
    // expansion weapon reads unique by both its element AND its physical shape (thrust / cleave / twin / fast).
    S.suite =
      vfx?.suite && Object.keys(vfx.suite).length > 0
        ? vfx.suite
        : fallbackSuiteFor(weaponId, element);
    S.fired = {};
    S.R = vfx?.vfxRadius ?? radius; // authored fixed size wins
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
    const o = vfx?.vfxOrigin;
    if (o && (o.x || o.y)) {
      const c = Math.cos(aimRad);
      const s = Math.sin(aimRad);
      ox = x + o.x * c - o.y * s;
      oy = y + o.x * s + o.y * c;
    }
    surf.container
      .setPosition(ox, oy)
      .setRotation(aimRad + (vfx?.rot ?? 0) * DEG)
      .setVisible(true);
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: DURATION,
      onUpdate: (tw) => {
        const p = tw.getValue() ?? 0;
        S.gfxAdd?.clear();
        VR.renderHero(this.scene, S, p);
        VR.renderLayers(S, p, "all", 1);
      },
      onComplete: () => {
        S.gfxAdd?.clear();
        (S.heroImg as Phaser.GameObjects.Image | undefined)?.setVisible(false);
        surf.container.setVisible(false);
        surf.busy = false;
      },
    });
  }
}
