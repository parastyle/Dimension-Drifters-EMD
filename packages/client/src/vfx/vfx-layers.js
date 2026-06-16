// VFX LAYER REGISTRY (§14) — the SINGLE source of truth for the engine-layer palette: each layer's
// id, label, trigger, and tunable params, plus the composite ORDER and the preview CYCLE.
//
// METADATA ONLY. The rendering lives in `vfx-render.js` (one canonical renderer). Loaded by BOTH the
// game (ESM side-effect import) and the Weaponsmith (classic <script> over HTTP); sets `globalThis.VFXLAYERS`.
// To add a layer: add its schema here AND its renderer in vfx-render.js.
(() => {
  const P = (key, label, min, max, def, step) => ({
    key,
    label,
    min,
    max,
    def,
    step: step ?? (max - min) / 100,
  });

  // id → { label, trigger, params }. `params` are the tunable knobs the Weaponsmith exposes and the
  // renderer reads as `o.params.<key>`. `trigger` is when the layer fires (also gates swing-vs-impact).
  const LAYERS = {
    // painted Codex art (the only sprite layer; `grow-in` 0 = snap to size, 1 = scale up from a point)
    "hero-skin": {
      label: "Painted VFX (Codex art)",
      trigger: "impact",
      needsHero: true,
      params: [P("size", "Size", 0.5, 1.6, 1), P("rise", "Grow-in", 0, 1, 0)],
    },
    // melee
    "slash-arc": {
      label: "Slash arc",
      trigger: "swing",
      params: [
        P("reach", "Reach", 0.5, 1.4, 1),
        P("width", "Width", 2, 10, 6, 1),
        P("color", "Hue", 0, 1, 0.55),
      ],
    },
    "twin-slash": {
      label: "Twin slash (X)",
      trigger: "swing",
      params: [P("reach", "Reach", 0.5, 1.4, 0.95), P("color", "Hue", 0, 1, 0.5)],
    },
    "edge-trail": {
      label: "Edge trail (afterglow)",
      trigger: "swing",
      params: [
        P("reach", "Reach", 0.6, 1.6, 1.1),
        P("color", "Hue", 0, 1, 0.55),
        P("len", "Length", 0.4, 1.4, 1),
      ],
    },
    "blade-trail": {
      label: "Blade trail (speed lines)",
      trigger: "swing",
      params: [
        P("reach", "Reach", 0.5, 1.5, 1),
        P("color", "Hue", 0, 1, 0.55),
        P("sweep", "Sweep", 0.6, 2.4, 1.5),
        P("thick", "Thickness", 0.04, 0.4, 0.18),
        P("lines", "Speed lines", 0, 8, 4, 1),
      ],
    },
    "thrust-streak": {
      label: "Thrust streak",
      trigger: "swing",
      params: [P("reach", "Reach", 0.6, 1.6, 1.2), P("color", "Hue", 0, 1, 0.55)],
    },
    "drift-petals": {
      label: "Drift petals / motes",
      trigger: "swing",
      params: [P("count", "Count", 3, 16, 8, 1), P("color", "Hue", 0, 1, 0.6)],
    },
    "cleave-flash": {
      label: "Cleave flash",
      trigger: "hit",
      params: [P("intensity", "Intensity", 0, 1, 0.8)],
    },
    "saw-sparks": {
      label: "Saw sparks (sustained)",
      trigger: "channel",
      params: [P("count", "Sparks", 10, 160, 40, 1), P("color", "Hue", 0, 1, 0.06)],
    },
    // scatter-shot: flings a painted CLUSTER's dissected sprites (e.g. magma balls) outward as distinct
    // projectiles. Needs a scatter spritesheet on the weapon (slice-scatter.mjs) — see vfx-render setScatter.
    "magma-scatter": {
      label: "Scatter shot (painted balls)",
      trigger: "hit",
      needsScatter: true,
      params: [
        P("count", "Balls", 2, 10, 8, 1),
        P("spread", "Spread", 0.1, 1, 0.45),
        P("power", "Power", 0.6, 2.2, 1.3),
      ],
    },
    "hit-spark": {
      label: "Hit sparks",
      trigger: "hit",
      params: [P("count", "Sparks", 6, 90, 24, 1), P("color", "Hue", 0, 1, 0.08)],
    },
    "blood-mist": {
      label: "Blood mist",
      trigger: "hit",
      params: [P("amount", "Amount", 0, 1, 0.7)],
    },
    // ranged (guns)
    "muzzle-flash": {
      label: "Muzzle flash",
      trigger: "fire",
      params: [P("size", "Size", 0.4, 1.8, 1), P("color", "Hue", 0, 1, 0.12)],
    },
    tracer: {
      label: "Bullet tracer",
      trigger: "fire",
      params: [P("count", "Rounds", 1, 8, 3, 1), P("color", "Hue", 0, 1, 0.12)],
    },
    "pellet-spread": {
      label: "Pellet spread",
      trigger: "fire",
      params: [P("count", "Pellets", 4, 16, 9, 1), P("spread", "Spread", 0.1, 0.8, 0.4)],
    },
    "shell-eject": {
      label: "Shell eject",
      trigger: "fire",
      params: [P("count", "Shells", 1, 5, 2, 1)],
    },
    "barrel-spin": {
      label: "Barrel spin-up",
      trigger: "charge",
      params: [P("color", "Hue", 0, 1, 0.08)],
    },
    // launchers
    "lob-arc": {
      label: "Lob arc (projectile)",
      trigger: "flight",
      params: [P("height", "Arc height", 0.4, 1.6, 1), P("color", "Hue", 0, 1, 0.1)],
    },
    "fire-burst": {
      label: "Fire burst (explosion)",
      trigger: "blast",
      params: [P("size", "Size", 0.5, 1.6, 1), P("color", "Hue", 0, 1, 0.06)],
    },
    // caster (staffs)
    "charge-glow": {
      label: "Charge glow",
      trigger: "charge",
      params: [P("size", "Size", 0.3, 1.2, 0.7), P("color", "Hue", 0, 1, 0.6)],
    },
    beam: {
      label: "Beam",
      trigger: "channel",
      params: [P("width", "Width", 2, 16, 7, 1), P("color", "Hue", 0, 1, 0.5)],
    },
    "arc-bolt": {
      label: "Lightning bolt",
      trigger: "cast",
      params: [P("color", "Hue", 0, 1, 0.72), P("jag", "Jag", 0.1, 0.6, 0.3)],
    },
    "sigil-ring": {
      label: "Sigil ring (rune)",
      trigger: "cast",
      params: [P("color", "Hue", 0, 1, 0.62), P("size", "Size", 0.5, 1.4, 1)],
    },
    "aura-pulse": {
      label: "Aura pulse (buff)",
      trigger: "aura",
      params: [P("color", "Hue", 0, 1, 0.3), P("rings", "Rings", 1, 4, 2, 1)],
    },
    "ember-rain": {
      label: "Ember rain",
      trigger: "cast",
      params: [P("count", "Embers", 6, 30, 16, 1), P("color", "Hue", 0, 1, 0.08)],
    },
    // ground / area (shared by slams + launchers)
    "spin-trail": {
      label: "Spin trail (projectile)",
      trigger: "flight",
      params: [P("color", "Hue", 0, 1, 0.1)],
    },
    "throw-dust": {
      label: "Throw dust",
      trigger: "throw",
      params: [P("amount", "Amount", 0, 1, 0.6)],
    },
    "dust-cloud": {
      label: "Dust cloud",
      trigger: "slam",
      params: [P("amount", "Amount", 0, 1, 0.8)],
    },
    debris: { label: "Flung debris", trigger: "slam", params: [P("count", "Count", 4, 40, 18, 1)] },
    "shockwave-ring": {
      label: "Shockwave ring",
      trigger: "slam",
      params: [P("color", "Hue", 0, 1, 0.1)],
    },
    "impact-flash": {
      label: "Impact flash",
      trigger: "impact",
      params: [P("intensity", "Intensity", 0, 1, 0.4)],
    },
  };

  // Composite draw order: ground/area → flight/projectile → swing/beam/cast → motes/hit/spark → painted on top.
  const ORDER = [
    "throw-dust",
    "dust-cloud",
    "fire-burst",
    "shockwave-ring",
    "aura-pulse",
    "debris",
    "ember-rain",
    "lob-arc",
    "spin-trail",
    "tracer",
    "pellet-spread",
    "shell-eject",
    "barrel-spin",
    "edge-trail",
    "blade-trail",
    "slash-arc",
    "twin-slash",
    "thrust-streak",
    "beam",
    "arc-bolt",
    "sigil-ring",
    "drift-petals",
    "saw-sparks",
    "magma-scatter",
    "hit-spark",
    "blood-mist",
    "charge-glow",
    "muzzle-flash",
    "cleave-flash",
    "impact-flash",
    "hero-skin",
  ];

  globalThis.VFXLAYERS = { LAYERS, ORDER, CYCLE: 2.0 };
})();
