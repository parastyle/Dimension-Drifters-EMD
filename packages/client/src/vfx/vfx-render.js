// vfx-render.js — CANONICAL VFX layer renderer (§14, CODE-8). The SINGLE source of truth for HOW each
// engine layer draws. Loaded by BOTH the live game (ArenaScene's VfxPlayer — ESM side-effect import)
// AND the Weaponsmith preview (vfx-engine.js — classic <script> served over HTTP). "What you author in
// the smith = what ships in the game", because both run this exact code.
//
// Pure rendering math — NO Phaser class references (operates on a `scene` + a host-built `S` surface).
// The HOST owns the loop (synthetic 0→1 clock in the smith / real swing time in the game) and the
// container transform; this module just draws the enabled suite at the surface's current transform.
//
// No imports/exports on purpose: as a classic <script> it sets `window.VFXRENDER`; imported as ESM it
// runs the same side effect (`globalThis.VFXRENDER = …`). Reads the layer registry from `globalThis.VFXLAYERS`.
(() => {
  const TAU = Math.PI * 2;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const burst = (p, at, w) => {
    const d = Math.abs(p - at) / w;
    return d >= 1 ? 0 : 1 - d * d;
  };
  function lerpHue(h) {
    const stops = [0xff4d3a, 0xff8a2b, 0xd6ff5a, 0x6fd6ff, 0x9cff3b, 0x6f8bff, 0xb07bd6, 0xff4d3a];
    return stops[Math.min(stops.length - 2, Math.floor(h * (stops.length - 1)))];
  }
  // rgb lerp between two 0xRRGGBB colors
  function blend(a, b, t) {
    const ar = (a >> 16) & 255,
      ag = (a >> 8) & 255,
      ab = a & 255;
    const br = (b >> 16) & 255,
      bg = (b >> 8) & 255,
      bb = b & 255;
    return (
      (Math.round(ar + (br - ar) * t) << 16) |
      (Math.round(ag + (bg - ag) * t) << 8) |
      Math.round(ab + (bb - ab) * t)
    );
  }
  // a hot fire/ember color RAMP a particle cools through over its life, anchored on the layer's authored
  // hue: white-hot core → bright tint → base → ember → near-black. This is what makes sparks read as fire.
  function hotRamp(base) {
    return [
      0xffffff,
      blend(base, 0xffffff, 0.62),
      base,
      blend(base, 0x000000, 0.5),
      blend(base, 0x000000, 0.86),
    ];
  }
  const warned = new Set();
  const warnOnce = (id) => {
    if (!warned.has(id)) {
      warned.add(id);
      console.log(`[vfx-render] layer not ported yet: ${id}`);
    }
  };

  // a soft round particle texture (radial alpha falloff) — the building block for glow particles
  function ensureSoft(scene) {
    if (scene.textures.exists("vfx-soft")) return;
    const s = 64,
      c = document.createElement("canvas");
    c.width = c.height = s;
    const x = c.getContext("2d"),
      g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.65)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
    scene.textures.addCanvas("vfx-soft", c);
  }
  // a small soft streak (for speed-lines / tracers) — a horizontal capsule
  function ensureStreak(scene) {
    if (scene.textures.exists("vfx-streak")) return;
    const w = 64,
      h = 16,
      c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d"),
      g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.6, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,1)");
    x.fillStyle = g;
    x.beginPath();
    x.ellipse(w / 2, h / 2, w / 2, h / 4, 0, 0, TAU);
    x.fill();
    scene.textures.addCanvas("vfx-streak", c);
  }
  // a SHARP HOT spark — a bright streak with a white-hot core (sharper falloff than vfx-streak). Stretched
  // along velocity + color-ramped at runtime so it reads as a real fiery spark, not a soft blob.
  function ensureSpark(scene) {
    if (scene.textures.exists("vfx-spark")) return;
    const w = 48,
      h = 14,
      c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,0.55)");
    g.addColorStop(0.82, "rgba(255,255,255,1)"); // hot core toward the leading end
    g.addColorStop(1, "rgba(255,255,255,1)");
    x.fillStyle = g;
    x.beginPath();
    x.ellipse(w / 2, h / 2, w / 2, h / 3.4, 0, 0, TAU);
    x.fill();
    const rg = x.createRadialGradient(w * 0.78, h / 2, 0, w * 0.78, h / 2, h * 0.75);
    rg.addColorStop(0, "rgba(255,255,255,1)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = rg;
    x.beginPath();
    x.arc(w * 0.78, h / 2, h * 0.75, 0, TAU);
    x.fill();
    scene.textures.addCanvas("vfx-spark", c);
  }
  function ensureTextures(scene) {
    ensureSoft(scene);
    ensureStreak(scene);
    ensureSpark(scene);
    if (!scene.textures.exists("vfx-blank")) {
      const c = document.createElement("canvas");
      c.width = c.height = 2;
      scene.textures.addCanvas("vfx-blank", c);
    }
  }

  // ── per-layer renderers. (S=surface, g={R} centred at container origin, p=phase, o={params}) ──
  // Graphics layers draw into S.gfxAdd each frame (additive). Particle layers explode bursts from pooled
  // emitters at their trigger phase (tracked via S.fired so each fires once per cycle).
  // Painted Edge Ribbon (PER). Numeric paint ids are deliberately stable because this canonical renderer
  // is also loaded as a standalone classic script by Weaponsmith. The pinned cells were audited for a
  // predominantly horizontal long axis and never change during a swing, so the paint cannot shimmer.
  const PER_PAINTS = [
    { id: "steel", color: 0xd6dde6, wisp: 7, bolt: 0 },
    { id: "fire", color: 0xff6a2a, wisp: 4, bolt: 0 },
    { id: "frost", color: 0x6fd6ff, wisp: 6, bolt: 5 },
    { id: "shock", color: 0xffe24a, wisp: 9, bolt: 0 },
    { id: "holy", color: 0xffe6a0, wisp: 4, bolt: 6 },
    { id: "toxic", color: 0x9cff3b, wisp: 6, bolt: 7 },
    { id: "void", color: 0xb14bff, wisp: 1, bolt: 6 },
    { id: "arcane", color: 0x8f6aff, wisp: 0, bolt: 2 },
  ];
  // Optional loose sheets for the four Driftblade-model adopters. The combo variant is already carried by
  // the enriched swing descriptor, so both local prediction and remote observation resolve the same art.
  // Every sheet is 10 equal 96x96 cells; frame 0 is the canonical phase and the remaining cells are safe
  // phase variants for tooling/future use. Driftblade itself deliberately has no entry and keeps PER_PAINTS.
  const PER_WISP_ART = {
    "nodachi-coldcourt": {
      key: "per-wisp-gravechill",
      url: "particles/per-wisp-gravechill.png",
      frame: 0,
    },
    "nodachi-petalfall": {
      key: "per-wisp-stormpetal",
      url: "particles/per-wisp-stormpetal.png",
      frame: 0,
    },
    "katana-threehails": {
      key: "per-wisp-hailwidow",
      url: "particles/per-wisp-hailwidow.png",
      frame: 0,
    },
    "katana-thunderlag": {
      key: "per-wisp-voltfang",
      url: "particles/per-wisp-voltfang.png",
      frame: 0,
    },
  };
  const PER_WISP_LOADS = new WeakMap();
  const PER_SIZE = {
    S: { body: 14, lip: 4, history: 0.16, cap: 0.35 },
    M: { body: 22, lip: 6, history: 0.22, cap: 0.5 },
    L: { body: 30, lip: 8, history: 0.28, cap: 0.7 },
    XL: { body: 38, lip: 9, history: 0.34, cap: 0.85 },
  };
  const PER_EMPTY = Object.freeze({});
  // Devil's-advocate guardrail: inspect `VFXRENDER.debug.perDraws` in either host.
  const PER_DEBUG = { perDraws: 0, ropeStrips: 0, fallbackDraws: 0 };

  const finite = (v, fallback) => (Number.isFinite(v) ? v : fallback);
  const bounded = (v, fallback, lo, hi) => Math.max(lo, Math.min(hi, finite(v, fallback)));
  const smooth01 = (v) => {
    const t = clamp01(v);
    return t * t * (3 - 2 * t);
  };
  function perPaint(params, meta) {
    return PER_PAINTS[Math.round(bounded(params.paint, meta.paint || 0, 0, 7))] || PER_PAINTS[0];
  }
  function requestPerTexture(S, paint, shape) {
    const key = `ptcl:${paint.id}-${shape}`;
    if (S.scene?.textures?.exists(key)) return true;
    if (!S.scene?.load?.spritesheet) return false;
    if (!S.perLoading[key]) {
      S.perLoading[key] = true;
      // Live play boot-preloads these keys. Optional hosts can serve the same public particle path lazily.
      S.scene.load.spritesheet(key, `particles/${paint.id}-${shape}.png`, {
        frameWidth: 96,
        frameHeight: 96,
      });
      S.scene.load.start();
    }
    return false;
  }
  function requestPerWispArt(S, art) {
    const scene = S.scene;
    if (scene?.textures?.exists(art.key)) return true;
    if (!scene?.load?.spritesheet) return false;
    let state = PER_WISP_LOADS.get(scene);
    if (!state) {
      state = { pending: Object.create(null), failed: Object.create(null) };
      PER_WISP_LOADS.set(scene, state);
    }
    if (state.failed[art.key]) return false;
    if (!state.pending[art.key]) {
      state.pending[art.key] = true;
      // Optional expansion-style loose art: queue only when this adopter first swings. Until COMPLETE,
      // resolvePerTexture below returns the shipped element wisp rather than dropping to canvas fallback.
      scene.load.spritesheet(art.key, art.url, { frameWidth: 96, frameHeight: 96 });
      if (typeof scene.load.once === "function") {
        scene.load.once("complete", () => {
          delete state.pending[art.key];
          if (!scene.textures?.exists(art.key)) {
            state.failed[art.key] = true;
            console.warn(`[vfx-render] optional PER wisp failed to lazy-load: ${art.key}`);
          }
        });
      }
      scene.load.start();
    }
    return false;
  }
  function resolvePerTexture(S, meta, paint, shape) {
    if (shape === "wisp") {
      const art = PER_WISP_ART[meta.swing?.comboVariant];
      if (art && requestPerWispArt(S, art)) return { key: art.key, frame: art.frame, ready: true };
    }
    const key = `ptcl:${paint.id}-${shape}`;
    return {
      key,
      frame: shape === "wisp" ? paint.wisp : paint.bolt,
      ready: requestPerTexture(S, paint, shape),
    };
  }
  function hidePer(S) {
    S.perBody?.setVisible(false);
    S.perLip?.setVisible(false);
  }
  function perPointBank() {
    const bank = {};
    for (const n of [4, 8, 12]) {
      const points = new Array(n);
      for (let i = 0; i < n; i++) points[i] = { x: 0, y: 0 };
      bank[n] = points;
    }
    return bank;
  }
  function makePerRope(scene) {
    const bank = perPointBank();
    const rope = scene.add.rope(0, 0, "vfx-blank", 0, bank[12], true);
    rope.setBlendMode(1 /* Phaser.BlendModes.ADD */).setVisible(false);
    rope.perPointBank = bank;
    rope.perQuality = 12;
    rope.perTextureKey = "vfx-blank";
    rope.perTextureFrame = 0;
    rope.perPatches = 1;
    return rope;
  }
  function patchPerUvs(rope, patches) {
    const total = rope.points.length;
    const frame = rope.frame;
    const du = frame.u1 - frame.u0;
    for (let i = 0; i < total; i++) {
      const progress = (i / (total - 1)) * patches;
      const patch = Math.min(patches - 1, Math.floor(progress));
      const local = progress - patch;
      const along = patch % 2 === 0 ? local : 1 - local;
      const u = frame.u0 + du * along;
      const j = i * 4;
      rope.uv[j] = u;
      rope.uv[j + 1] = frame.v0;
      rope.uv[j + 2] = u;
      rope.uv[j + 3] = frame.v1;
    }
  }
  function preparePerRope(rope, key, frame, quality, width, pathLength, tintMode) {
    let uvDirty = false;
    if (rope.perTextureKey !== key || rope.perTextureFrame !== frame) {
      rope.setTexture(key, frame);
      rope.perTextureKey = key;
      rope.perTextureFrame = frame;
      uvDirty = true;
    }
    if (rope.perQuality !== quality) {
      rope.setPoints(rope.perPointBank[quality]);
      rope.perQuality = quality;
      uvDirty = true;
    }
    const patches = Math.max(1, Math.min(3, Math.ceil(pathLength / Math.max(1, width * 2.2))));
    if (rope.perPatches !== patches) {
      rope.perPatches = patches;
      uvDirty = true;
    }
    if (uvDirty) patchPerUvs(rope, patches);
    rope.setTintMode(tintMode);
    rope.setScale(width / 96);
    return width / 96;
  }
  function writePerVertex(rope, i, alpha, color) {
    const j = i * 2;
    rope.alphas[j] = alpha;
    rope.alphas[j + 1] = alpha;
    rope.colors[j] = color;
    rope.colors[j + 1] = color;
  }
  function updateArcRope(
    rope,
    key,
    textureFrame,
    quality,
    reach,
    width,
    arc,
    startAngle,
    headQ,
    historyAngle,
    radiusOffset,
    alpha,
    color,
    tintMode,
    endStyle,
  ) {
    if (alpha <= 0 || width <= 0 || reach <= 0) return false;
    const absArc = Math.max(0.0001, Math.abs(arc));
    const historyQ = Math.min(1, historyAngle / absArc);
    const tailQ = Math.max(0, headQ - historyQ);
    const headAngle = startAngle + arc * headQ;
    let tailAngle = startAngle + arc * tailQ;
    if (Math.abs(headAngle - tailAngle) < 0.003)
      tailAngle = headAngle - (arc < 0 ? -0.003 : 0.003);
    const radius = Math.max(width / 2, reach - width / 2 + radiusOffset);
    const pathLength = Math.max(width, radius * Math.abs(headAngle - tailAngle));
    const scale = preparePerRope(
      rope,
      key,
      textureFrame,
      quality,
      width,
      pathLength,
      tintMode,
    );
    const points = rope.points;
    for (let i = 0; i < points.length; i++) {
      const f = i / (points.length - 1);
      const angle = tailAngle + (headAngle - tailAngle) * f;
      // §50 Driftblade-model panel: authored per-step head treatment. No `endStyle` (every legacy caller)
      // is byte-identical to the shipped f² ramp; every treatment stays AT or UNDER the `alpha` ceiling.
      let r = radius;
      let a = alpha * (endStyle === "open" ? f : f * f); // "open": the arc bleeds past the tear-off
      if (endStyle === "squared" && f >= 0.9) a = alpha; // flat bright cut, no tip taper
      else if (endStyle === "torn" && f >= 0.8) a *= i % 2 === 0 ? 0.45 : 1; // jagged dying edge
      else if (endStyle === "hooked" && f >= 0.85) r -= width * 0.55 * ((f - 0.85) / 0.15); // inward curl
      points[i].x = (Math.cos(angle) * r) / scale;
      points[i].y = (Math.sin(angle) * r) / scale;
      writePerVertex(rope, i, a, color);
    }
    rope.setDirty().setVisible(true);
    return true;
  }
  function updateRadialRope(
    rope,
    key,
    textureFrame,
    quality,
    reach,
    clearance,
    width,
    angle,
    alpha,
    color,
  ) {
    if (alpha <= 0 || width <= 0 || reach <= clearance) return false;
    // Three mirrored patches cap source stretch. Shortening the decorative inner extent is truthful;
    // the bright endpoint remains exactly on authoritative reach.
    const end = Math.sqrt(Math.max(0, reach * reach - (width * width) / 4));
    const start = Math.max(clearance, reach * 0.45, end - width * 6.6);
    const pathLength = Math.max(width, end - start);
    const scale = preparePerRope(rope, key, textureFrame, quality, width, pathLength, 1 /* FILL */);
    const points = rope.points;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    for (let i = 0; i < points.length; i++) {
      const f = i / (points.length - 1);
      const radius = start + (end - start) * f;
      const radial = f < 0.55 ? (0.65 * f) / 0.55 : 0.65 + (0.35 * (f - 0.55)) / 0.45;
      points[i].x = (c * radius) / scale;
      points[i].y = (s * radius) / scale;
      writePerVertex(rope, i, alpha * radial, color);
    }
    rope.setDirty().setVisible(true);
    return true;
  }
  /** Shared retained linear PER strip. BeamRenderer and the swing renderer use the same point banks,
   * texture/UV patching, vertex tinting, and dirty-update path—there is no second Rope implementation. */
  function updateLinearRope(
    rope,
    key,
    textureFrame,
    quality,
    x0,
    y0,
    x1,
    y1,
    width,
    alpha,
    color,
    phase = 0,
    normalWobble = 0,
  ) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const pathLength = Math.hypot(dx, dy);
    if (alpha <= 0 || width <= 0 || pathLength <= 1) {
      rope.setVisible(false);
      return false;
    }
    const scale = preparePerRope(
      rope,
      key,
      textureFrame,
      quality,
      width,
      pathLength,
      1 /* FILL */,
    );
    const nx = -dy / pathLength;
    const ny = dx / pathLength;
    const points = rope.points;
    for (let i = 0; i < points.length; i++) {
      const f = i / (points.length - 1);
      const envelope = Math.sin(Math.PI * f);
      const wobble = Math.sin((f * 2.2 + phase) * TAU) * normalWobble * envelope;
      points[i].x = (x0 + dx * f + nx * wobble) / scale;
      points[i].y = (y0 + dy * f + ny * wobble) / scale;
      writePerVertex(rope, i, alpha * (0.72 + 0.28 * envelope), color);
    }
    rope.setPosition(0, 0).setDirty().setVisible(true);
    return true;
  }
  function samplePerClock(S, p, params, profile, out) {
    const meta = S.per || PER_EMPTY;
    const swing = meta.swing;
    const D = Math.max(0.0001, finite(swing?.poseSeconds, 1));
    const A = Math.max(0, finite(swing?.activeStartSeconds, profile === "thrust" ? 0.14 : 0.16));
    const B = Math.max(A, finite(swing?.activeEndSeconds, profile === "thrust" ? 0.58 : 0.74));
    const I = finite(swing?.impactSeconds, 0.52);
    const e = clamp01(p) * D;
    const activeSeconds = Math.max(0, B - A);
    const follow = Math.min(
      Math.max(0, D - B),
      Math.max(0.035, Math.min(0.09, activeSeconds * 0.22)),
    );
    const family = String(meta.family || "").toLowerCase();
    const style = swing?.style || meta.style || (profile === "thrust" ? "thrust" : "arc");
    const energy = /energy|plasma|laser|beam|photon|volt|light|neon/.test(family);
    const blunt = /mace|maul|warhammer|hammer|gauntlet|fist|knuckle/.test(family);
    const bodyMax = bounded(params.bodyAlpha, energy ? 0.52 : style === "chop" || blunt ? 0.78 : 0.72, 0, 0.78);
    const lipMax = bounded(
      params.lipAlpha,
      energy ? 0.72 : style === "chop" || blunt ? 0.36 : profile === "thrust" ? 0.58 : 0.54,
      0,
      0.72,
    );
    out.active = false;
    out.q = 0;
    out.bodyAlpha = 0;
    out.lipAlpha = 0;
    out.historyScale = 0;
    if (e < A) return false;
    if (e < B && activeSeconds > 0) {
      const q =
        typeof meta.edgeProgress === "function"
          ? clamp01(meta.edgeProgress(e))
          : clamp01((e - A) / activeSeconds);
      let mass = bodyMax * smooth01(q / 0.15);
      if (style === "chop" || style === "punch") {
        const crestSeconds = style === "chop" ? 0.03 : 0.02;
        const crest = Math.max(0, 1 - Math.abs(e - I) / crestSeconds);
        mass = Math.min(0.78, mass * (1 + crest * 0.1));
      }
      out.active = true;
      out.q = q;
      out.bodyAlpha = mass;
      out.lipAlpha = lipMax;
      out.historyScale = 1;
      return mass > 0 || lipMax > 0;
    }
    if (follow > 0 && e < B + follow) {
      const fade = clamp01(1 - (e - B) / follow);
      out.q = 1;
      out.bodyAlpha = Math.min(0.3, bodyMax) * fade;
      out.historyScale = fade;
      return out.bodyAlpha > 0;
    }
    return false;
  }
  function drawPerFallbackArc(gfx, reach, width, tail, head, color, alpha, segs, offset, endStyle) {
    const radius = Math.max(width / 2, reach - width / 2 + offset);
    for (let i = 0; i < segs; i++) {
      const f0 = i / segs;
      const f1 = (i + 1) / segs;
      const a0 = tail + (head - tail) * f0;
      const a1 = tail + (head - tail) * f1;
      const w0 = width * (0.18 + 0.82 * f0);
      const w1 = width * (0.18 + 0.82 * f1);
      // Fallback parity with updateArcRope's authored head treatment; ceilings unchanged.
      let segA = Math.min(0.55, alpha) * (endStyle === "open" ? f1 : f1 * f1);
      if (endStyle === "squared" && f1 >= 0.9) segA = Math.min(0.55, alpha);
      else if (endStyle === "torn" && f0 >= 0.8) segA *= i % 2 === 0 ? 0.45 : 1;
      gfx.fillStyle(color, segA);
      gfx.beginPath();
      gfx.moveTo(Math.cos(a0) * (radius + w0 / 2), Math.sin(a0) * (radius + w0 / 2));
      gfx.lineTo(Math.cos(a1) * (radius + w1 / 2), Math.sin(a1) * (radius + w1 / 2));
      gfx.lineTo(Math.cos(a1) * (radius - w1 / 2), Math.sin(a1) * (radius - w1 / 2));
      gfx.lineTo(Math.cos(a0) * (radius - w0 / 2), Math.sin(a0) * (radius - w0 / 2));
      gfx.closePath();
      gfx.fillPath();
    }
  }
  function drawPerFallback(S, frame, profile, color, quality) {
    const gfx = S.gfxAdd;
    // Loose wisp identity is intentionally WebGL-only: canvas remains an honest geometry + paint-color
    // fallback and never claims to sample a texture it cannot draw through Phaser's Rope path.
    // §50 fallback parity: the same authored per-step comboRibbon head treatment the WebGL rope applies
    // (the band/width reshape already arrived pre-folded in frame.bodyWidth). Absent → identical draw.
    const fallbackSwing = S.per ? S.per.swing : undefined;
    const fallbackRibbon = fallbackSwing ? fallbackSwing.comboRibbon : undefined;
    const fallbackEnd = fallbackRibbon ? fallbackRibbon.end : undefined;
    gfx.save();
    gfx.translateCanvas(frame.originX, frame.originY);
    const head = frame.startAngle + frame.arc * frame.q;
    const tail = head - (frame.arc < 0 ? -frame.historyAngle : frame.historyAngle);
    if (profile === "thrust") {
      const start = Math.max(frame.clearance, frame.reach * 0.45);
      const c = Math.cos(head);
      const s = Math.sin(head);
      const nX = -s * frame.bodyWidth * 0.5;
      const nY = c * frame.bodyWidth * 0.5;
      const tip = Math.sqrt(
        Math.max(0, frame.reach * frame.reach - (frame.bodyWidth * frame.bodyWidth) / 4),
      );
      gfx.fillStyle(color, Math.min(0.55, frame.bodyAlpha));
      gfx.fillTriangle(
        c * start,
        s * start,
        c * tip + nX,
        s * tip + nY,
        c * tip - nX,
        s * tip - nY,
      );
    } else if (profile === "twin") {
      const lobeWidth = frame.bodyWidth * 0.58;
      drawPerFallbackArc(gfx, frame.reach, lobeWidth, tail, head, color, frame.bodyAlpha, quality, -frame.bodyWidth * 0.03);
      if (quality > 4 && frame.q > 0.12) {
        const rearQ = frame.q - 0.12;
        const rearHead = frame.startAngle + frame.arc * rearQ;
        const rearTail = rearHead - (frame.arc < 0 ? -frame.historyAngle : frame.historyAngle);
        drawPerFallbackArc(gfx, frame.reach, lobeWidth, rearTail, rearHead, color, frame.bodyAlpha * 0.42, quality, -frame.bodyWidth * 0.39);
      }
    } else {
      drawPerFallbackArc(gfx, frame.reach, frame.bodyWidth, tail, head, color, frame.bodyAlpha, quality, 0, fallbackEnd);
    }
    gfx.restore();
  }
  function renderPer(S, g, p, o, profile) {
    const params = o.params || PER_EMPTY;
    const meta = S.per || PER_EMPTY;
    const paint = perPaint(params, meta);
    const quality = S.perQuality === 4 || S.perQuality === 8 ? S.perQuality : 12;
    const bodyShape = profile === "thrust" ? "bolt" : "wisp";
    const secondShape = profile === "twin" ? "wisp" : "bolt";
    const bodyTexture = resolvePerTexture(S, meta, paint, bodyShape);
    const secondTexture = quality <= 4 ? undefined : resolvePerTexture(S, meta, paint, secondShape);
    const bodyReady = bodyTexture.ready;
    const secondReady = quality <= 4 || secondTexture?.ready;
    const frame = S.perFrame;
    if (!samplePerClock(S, p, params, profile, frame)) return;

    const size = PER_SIZE[meta.size] || PER_SIZE.M;
    const reachScale = bounded(params.reach, 1, 0, 1);
    frame.reach = Math.max(1, finite(meta.reach, g.R) * reachScale);
    frame.clearance = Math.min(28, frame.reach * 0.2);
    frame.arc = finite(meta.swingArc, profile === "thrust" ? 1.1 : 2.1);
    frame.startAngle =
      typeof meta.angleAt === "function" ? finite(meta.angleAt(0), -frame.arc / 2) : -frame.arc / 2;
    frame.originX = finite(meta.originX, 0);
    frame.originY = finite(meta.originY, 0);
    frame.bodyWidth = Math.min(
      96,
      finite(meta.paintedWidthPx, size.body),
      Math.max(2, frame.reach - frame.clearance),
    );
    // §50 Driftblade-model panel: the authored per-step combo ribbon rides the enriched accepted/predicted
    // descriptor (meta.swing.comboRibbon). Geometry only, under the shipped ceilings: widthMultiplier is
    // re-capped at 96px; radialStart clamps the strip inside the outer [radialStart×reach, reach] band (it
    // multiplies reach, so it scales with blade length automatically); widthMultiplier 0 is authored
    // SILENCE (the model's compact beat paints nothing). Absent ribbon → byte-identical legacy render.
    const ribbon = meta.swing ? meta.swing.comboRibbon : undefined;
    frame.ribbonEnd = ribbon ? ribbon.end : undefined;
    if (ribbon) {
      const widthMul = Math.max(0, finite(ribbon.widthMultiplier, 1));
      if (widthMul <= 0) {
        hidePer(S);
        return;
      }
      const band = frame.reach * (1 - bounded(ribbon.radialStart, 0, 0, 0.95));
      frame.bodyWidth = Math.max(2, Math.min(96, frame.bodyWidth * widthMul, band));
    }
    frame.lipWidth = Math.min(18, Math.max(size.lip, frame.bodyWidth * 0.24), frame.bodyWidth);
    const historyMul = bounded(params.history, 1, 0, 1);
    const artCap = (frame.bodyWidth * 6.6) / Math.max(1, frame.reach - frame.bodyWidth / 2);
    frame.historyAngle =
      Math.min(
        Math.abs(frame.arc) * size.history,
        size.cap,
        profile === "thrust" ? 0.18 : Infinity,
        artCap,
      ) *
      historyMul *
      frame.historyScale;

    const textureOk = S.perWebGL && S.perBody && S.perLip && bodyReady && secondReady;
    PER_DEBUG.perDraws++;
    if (!textureOk) {
      drawPerFallback(S, frame, profile, paint.color, quality);
      PER_DEBUG.fallbackDraws++;
      return;
    }

    const bodyKey = bodyTexture.key;
    const bodyTextureFrame = bodyTexture.frame;
    const bodyWidth =
      profile === "thrust"
        ? frame.bodyWidth * 0.72
        : profile === "twin"
          ? frame.bodyWidth * 0.58
          : frame.bodyWidth;
    const leadOffset = profile === "twin" ? -frame.bodyWidth * 0.03 : 0;
    S.perBody.setPosition(frame.originX, frame.originY);
    S.perLip.setPosition(frame.originX, frame.originY);
    let strips = updateArcRope(
      S.perBody,
      bodyKey,
      bodyTextureFrame,
      quality,
      frame.reach,
      bodyWidth,
      frame.arc,
      frame.startAngle,
      frame.q,
      frame.historyAngle,
      leadOffset,
      frame.bodyAlpha,
      0xffffff,
      0,
      frame.ribbonEnd,
    )
      ? 1
      : 0;
    if (quality > 4 && profile === "twin" && frame.q > 0.12) {
      const rearQ = Math.max(0, frame.q - 0.12);
      if (
        updateArcRope(
          S.perLip,
          secondTexture.key,
          secondTexture.frame,
          quality,
          frame.reach,
          bodyWidth,
          frame.arc,
          frame.startAngle,
          rearQ,
          frame.historyAngle,
          -frame.bodyWidth * 0.39,
          frame.bodyAlpha * 0.42,
          0xffffff,
          0,
        )
      )
        strips++;
    } else if (quality > 4 && frame.active && frame.lipAlpha > 0) {
      const head = frame.startAngle + frame.arc * frame.q;
      if (
        updateRadialRope(
          S.perLip,
          secondTexture.key,
          secondTexture.frame,
          quality,
          frame.reach,
          frame.clearance,
          frame.lipWidth,
          head,
          frame.lipAlpha,
          bounded(params.lipColor, paint.color, 0, 0xffffff),
        )
      )
        strips++;
    }
    PER_DEBUG.ropeStrips += strips;
  }

  function strokeArcG(gfx, R, a0, a1, width, color, alpha) {
    gfx.lineStyle(width, color, alpha);
    gfx.beginPath();
    gfx.arc(0, 0, R, a0, a1, false);
    gfx.strokePath();
  }
  function glow(S, x, y, r, a, color) {
    if (a <= 0) return;
    const gx = S.gfxAdd;
    for (let i = 0; i < 4; i++) {
      const f = 1 - i / 4;
      gx.fillStyle(i === 0 ? 0xffffff : color, a * 0.22);
      gx.fillCircle(x, y, r * (0.25 + f * 0.85));
    }
  }
  // A real MUZZLE FLASH (not a soft oval): a sharp asymmetric multi-prong star of caged fire pointing
  // down-barrel (+x), with a white-hot core. `t` = 0..1 intensity (fades over the brief flash window).
  function drawMuzzleFlash(S, x, y, r, color, t) {
    if (t <= 0) return;
    const gx = S.gfxAdd;
    const hot = blend(color, 0xffffff, 0.55);
    // prongs: [angle, length-mult, width-mult] — 1 long down-barrel, diagonals, a few short side/back spikes
    const prongs = [
      [0, 2.5, 0.22],
      [-0.46, 1.6, 0.16],
      [0.46, 1.6, 0.16],
      [-0.95, 0.95, 0.12],
      [0.95, 0.95, 0.12],
      [Math.PI, 0.6, 0.12],
      [Math.PI - 0.7, 0.5, 0.1],
      [Math.PI + 0.7, 0.5, 0.1],
    ];
    for (const [a, lm, wm] of prongs) {
      const len = r * lm * (0.45 + t * 0.65);
      const w = r * wm * t;
      const tx = x + Math.cos(a) * len,
        ty = y + Math.sin(a) * len;
      const n = a + Math.PI / 2;
      gx.fillStyle(color, 0.45 * t);
      gx.fillTriangle(
        x + Math.cos(n) * w,
        y + Math.sin(n) * w,
        x - Math.cos(n) * w,
        y - Math.sin(n) * w,
        tx,
        ty,
      );
      gx.fillStyle(hot, 0.5 * t); // hot inner streak
      gx.fillTriangle(
        x + Math.cos(n) * w * 0.45,
        y + Math.sin(n) * w * 0.45,
        x - Math.cos(n) * w * 0.45,
        y - Math.sin(n) * w * 0.45,
        x + Math.cos(a) * len * 0.7,
        y + Math.sin(a) * len * 0.7,
      );
    }
    gx.fillStyle(hot, 0.85 * t);
    gx.fillCircle(x, y, r * 0.32 * (0.55 + t * 0.5));
    gx.fillStyle(0xffffff, 0.9 * t);
    gx.fillCircle(x, y, r * 0.17 * (0.5 + t * 0.5));
  }

  const R = {
    "hero-skin": null, // handled specially (an Image, not additive graphics)
    "blade-trail": (S, g, p, o) => renderPer(S, g, p, o, "blade"),
    "edge-trail": (S, g, p, o) => {
      const sw = clamp01((p - 0.04) / 0.34);
      if (sw <= 0 || sw >= 1) return;
      const col = lerpHue(o.params.color),
        Rr = g.R * o.params.reach,
        head = -1.4 + sw * 2.8,
        tail = head - 1.6 * o.params.len;
      for (let i = 0; i < 8; i++) {
        const f = i / 8;
        strokeArcG(
          S.gfxAdd,
          Rr,
          tail + (head - tail) * f,
          tail + (head - tail) * (f + 0.16),
          6 * (0.25 + f),
          col,
          0.4 * f * (1 - sw),
        );
      }
    },
    // §50 the LAST raw stroke: slash-arc survived the PER pass and read as the "white streak through the
    // player" on reachy weapons (Drowned Anchor playtest). It now rides the same painted ribbon.
    "slash-arc": (S, g, p, o) => renderPer(S, g, p, o, "blade"),
    "slash-arc-legacy": (S, g, p, o) => {
      const sw = clamp01((p - 0.05) / 0.3);
      if (sw <= 0 || sw >= 1) return;
      const a0 = -1.2 + sw * 2.4;
      strokeArcG(
        S.gfxAdd,
        g.R * o.params.reach,
        a0,
        a0 + 1.1,
        o.params.width,
        lerpHue(o.params.color),
        0.9 * (1 - sw),
      );
    },
    "twin-slash": (S, g, p, o) => renderPer(S, g, p, o, "twin"),
    "thrust-streak": (S, g, p, o) => renderPer(S, g, p, o, "thrust"),
    // §50 Drowned Anchor root cause: the synthesized heavy suite includes this hit-trigger layer and
    // VfxPlayer advances melee suites in "all" mode, so this old diameter stroke fired on every swing.
    // Because unauthored melee surfaces are re-centred on the wielder, the segment below crossed the
    // character exactly. Keep the diagnostic renderer under an explicit legacy id; production cleaves use
    // the same painted edge geometry as every other melee sweep.
    "cleave-flash": (S, g, p, o) => renderPer(S, g, p, o, "blade"),
    "cleave-flash-legacy": (S, g, p, o) => {
      const a = burst(p, 0.3, 0.12) * o.params.intensity;
      if (a <= 0) return;
      S.gfxAdd.lineStyle(4, 0xf6ffff, a);
      S.gfxAdd.beginPath();
      S.gfxAdd.moveTo(-g.R, g.R * 0.4);
      S.gfxAdd.lineTo(g.R, -g.R * 0.4);
      S.gfxAdd.strokePath();
    },
    "shockwave-ring": (S, g, p, o) => {
      const a = burst(p, 0.34, 0.4);
      if (a <= 0) return;
      const sc = clamp01((p - 0.2) / 0.4);
      const gx = S.gfxAdd;
      gx.lineStyle(4, lerpHue(o.params.color), (1 - sc) * 0.9);
      gx.beginPath();
      gx.ellipse(0, 0, g.R * (0.3 + sc * 1.4), g.R * (0.3 + sc * 1.4) * 0.55, 0, 0, TAU);
      gx.strokePath();
    },
    "aura-pulse": (S, g, p, o) => {
      const col = lerpHue(o.params.color),
        n = o.params.rings | 0;
      for (let i = 0; i < n; i++) {
        const tp = clamp01((p - i * 0.12) / 0.6);
        if (tp <= 0) continue;
        S.gfxAdd.lineStyle(3, col, 0.6 * (1 - tp));
        S.gfxAdd.beginPath();
        S.gfxAdd.arc(0, 0, g.R * 0.3 + tp * g.R * 1.2, 0, TAU);
        S.gfxAdd.strokePath();
      }
    },
    "sigil-ring": (S, g, p, o) => {
      const a = burst(p, 0.4, 0.35);
      if (a <= 0) return;
      const col = lerpHue(o.params.color),
        rr = g.R * 0.9 * o.params.size,
        rot = p * 3,
        gx = S.gfxAdd;
      gx.lineStyle(2, col, a * 0.85);
      gx.beginPath();
      gx.arc(0, 0, rr, 0, TAU);
      gx.strokePath();
      gx.beginPath();
      gx.arc(0, 0, rr * 0.7, 0, TAU);
      gx.strokePath();
      for (let i = 0; i < 6; i++) {
        const ang = rot + (i / 6) * TAU,
          c = Math.cos(ang),
          s = Math.sin(ang);
        gx.beginPath();
        gx.moveTo(c * rr * 0.7, s * rr * 0.7);
        gx.lineTo(c * rr, s * rr);
        gx.strokePath();
        gx.beginPath();
        gx.arc(c * rr, s * rr, rr * 0.08, 0, TAU);
        gx.strokePath();
      }
    },
    "arc-bolt": (S, g, p, o) => {
      const a = burst(p, 0.4, 0.12);
      if (a <= 0) return;
      const col = lerpHue(o.params.color),
        mx = g.R * 0.85,
        tx = g.R * 1.9,
        gx = S.gfxAdd;
      let s = ((p * 6) | 0) * 2654435761;
      const rnd = () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
      };
      gx.lineStyle(2.5, col, a);
      gx.beginPath();
      gx.moveTo(mx, 0);
      let x = mx;
      while (x < tx) {
        x += g.R * 0.18;
        gx.lineTo(x, (rnd() - 0.5) * g.R * o.params.jag * 2);
      }
      gx.strokePath();
    },
    beam: (S, g, p, o) => {
      const a = clamp01((p - 0.3) / 0.1) * (1 - clamp01((p - 0.7) / 0.15));
      if (a <= 0) return;
      const mx = g.R * 0.9,
        gx = S.gfxAdd;
      gx.lineStyle(o.params.width, lerpHue(o.params.color), a);
      gx.beginPath();
      gx.moveTo(mx, 0);
      gx.lineTo(g.R * 2, 0);
      gx.strokePath();
      gx.lineStyle(o.params.width * 0.4, 0xffffff, a);
      gx.beginPath();
      gx.moveTo(mx, 0);
      gx.lineTo(g.R * 2, 0);
      gx.strokePath();
    },
    "barrel-spin": (S, g, p, o) => {
      const a = clamp01(p / 0.16) * (1 - clamp01((p - 0.16) / 0.22));
      if (a <= 0) return;
      const col = lerpHue(o.params.color),
        mx = g.R * 0.4;
      for (let i = 0; i < 3; i++) {
        const a0 = p * 42 + (i * TAU) / 3;
        S.gfxAdd.lineStyle(3, col, a * 0.5);
        S.gfxAdd.beginPath();
        S.gfxAdd.arc(mx, 0, g.R * 0.4, a0, a0 + 1.5);
        S.gfxAdd.strokePath();
      }
    },
    // MUZZLE FLASH (graphics star pointing down-barrel +x) + a one-shot burst of hot sparks + smoke.
    "muzzle-flash": (S, g, p, o) => {
      const mx = g.R * 0.95,
        col = lerpHue(o.params.color),
        sz = o.params.size;
      drawMuzzleFlash(S, mx, 0, g.R * 0.85 * sz, col, burst(p, 0.17, 0.075));
      if (S._mzP === undefined || p < S._mzP) S._mzFired = false; // cycle/play restart → re-arm
      S._mzP = p;
      if (!S._mzFired && p >= 0.14) {
        S._mzFired = true;
        S.emit("spark", blend(col, 0xffffff, 0.5), 8, mx, 0, {
          speed: [g.R * 3, g.R * 6],
          angle: [-34, 34],
          scale: [0.12 * sz, 0],
          life: 150,
        });
        S.emit("spark", col, 5, mx, 0, {
          speed: [g.R * 1.4, g.R * 2.6],
          angle: [60, 300],
          scale: [0.07 * sz, 0],
          life: 130,
        });
        S.emit("soft", 0x564d44, 7, mx, 0, {
          speed: [g.R * 0.5, g.R * 1.4],
          angle: [-24, 24],
          scale: [0.14 * sz, 0.26 * sz],
          life: 520,
          alpha: 0.26,
          __norm: true,
        });
      }
    },
    // IMPACT (bullet/hit): a hot flash core + radial spark streaks bursting outward + a lingering scorch.
    "impact-flash": (S, g, p, o) => {
      const t = burst(p, 0.3, 0.18) * o.params.intensity;
      const gx = S.gfxAdd,
        r = g.R;
      if (t > 0) {
        glow(S, 0, 0, r * 0.55, t * 1.3, 0xfff0d0);
        const exp = clamp01((p - 0.28) / 0.22),
          n = 9;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + i * 0.6;
          gx.lineStyle(Math.max(1, r * 0.05 * (1 - exp)), 0xffd9a0, t * (1 - exp * 0.5));
          gx.beginPath();
          gx.moveTo(Math.cos(a) * r * 0.18 * exp, Math.sin(a) * r * 0.18 * exp);
          gx.lineTo(Math.cos(a) * r * (0.45 + 0.95 * exp), Math.sin(a) * r * (0.45 + 0.95 * exp));
          gx.strokePath();
        }
      }
      if (S._imP === undefined || p < S._imP) S._imFired = false;
      S._imP = p;
      if (!S._imFired && p >= 0.3) {
        S._imFired = true; // a few dark static smudges = the lingering bullet scorch
        S.emit("soft", 0x1a1410, 3, 0, 0, {
          speed: [0, r * 0.15],
          scale: [0.18, 0.16],
          life: 900,
          alpha: 0.5,
          __norm: true,
        });
      }
    },
    "fire-burst": (S, g, p, o) => {
      const a = burst(p, 0.55, 0.3);
      if (a <= 0) return;
      const sc = clamp01((p - 0.5) / 0.3);
      glow(S, 0, 0, g.R * 1.5 * o.params.size * (0.4 + sc), a, lerpHue(o.params.color));
    },
    "charge-glow": (S, g, p, o) => {
      const a = clamp01(p / 0.28) * (1 - clamp01((p - 0.3) / 0.15));
      if (a <= 0) return;
      glow(S, g.R * 0.9, 0, g.R * 0.5 * o.params.size, a, lerpHue(o.params.color));
    },
  };

  // particle layers: { trigger phase, fire(S,g,o) → explode a burst from a pooled emitter }
  const PARTS = {
    "hit-spark": {
      at: 0.3,
      add: true,
      fire: (S, g, o) =>
        S.emit("spark", lerpHue(o.params.color), o.params.count | 0, 0, 0, {
          speed: [g.R * 1.2, g.R * 3],
          scale: [0.06, 0],
          life: 320,
        }),
    },
    // (muzzle-flash is now a GRAPHICS layer in R — a shaped star + sparks + smoke, not a soft oval.)
    tracer: {
      at: 0.14,
      add: true,
      // Hot bullet rounds — fast velocity-aligned hot-core sparks streaking down-barrel (a bright head
      // with a stretched trail), not soft capsules. Reads as real tracer fire.
      fire: (S, g, o) =>
        S.emit(
          "spark",
          blend(lerpHue(o.params.color), 0xffffff, 0.45),
          o.params.count | 0,
          g.R * 0.95,
          0,
          {
            speed: [g.R * 6, g.R * 9.5],
            angle: [-3.5, 3.5],
            scale: [0.16, 0.05],
            life: 220,
          },
        ),
    },
    "pellet-spread": {
      at: 0.16,
      add: true,
      fire: (S, g, o) =>
        S.emit("spark", 0xffd9a0, o.params.count | 0, g.R * 0.9, 0, {
          speed: [g.R * 1.5, g.R * 3.2],
          angle: [-o.params.spread * 57, o.params.spread * 57],
          scale: [0.05, 0],
          life: 360,
        }),
    },
    "blood-mist": {
      at: 0.32,
      add: false,
      fire: (S, g, o) =>
        S.emit("soft", 0xb21f1f, Math.round(18 * o.params.amount), 0, 0, {
          speed: [g.R * 0.6, g.R * 1.8],
          angle: [-35, 35],
          scale: [0.05, 0.02],
          life: 420,
          __norm: true,
        }),
    },
    "drift-petals": {
      at: 0.2,
      add: true,
      fire: (S, g, o) =>
        S.emit("soft", lerpHue(o.params.color), o.params.count | 0, 0, 0, {
          speed: [g.R * 0.6, g.R * 1.6],
          scale: [0.04, 0],
          life: 700,
          gravity: -g.R * 0.6,
        }),
    },
    "ember-rain": {
      at: 0.3,
      add: true,
      fire: (S, g, o) =>
        S.emit("soft", lerpHue(o.params.color), o.params.count | 0, 0, -g.R, {
          speedX: [-g.R * 0.3, g.R * 0.3],
          speedY: [g.R * 0.6, g.R * 1.6],
          scale: [0.04, 0],
          life: 800,
          gravity: g.R,
        }),
    },
    debris: {
      at: 0.34,
      add: false,
      fire: (S, g, o) =>
        S.emit("soft", 0x3a4049, o.params.count | 0, 0, 0, {
          speed: [g.R * 1.4, g.R * 2.8],
          scale: [0.07, 0.03],
          life: 600,
          gravity: g.R * 2,
          __norm: true,
        }),
    },
    "dust-cloud": {
      at: 0.36,
      add: false,
      fire: (S, g, o) =>
        S.emit("soft", 0x6e7042, Math.round(14 * o.params.amount), 0, 0, {
          speed: [g.R * 0.3, g.R * 1],
          scale: [0.18, 0.3],
          life: 700,
          alpha: 0.3,
          __norm: true,
        }),
    },
    "throw-dust": {
      at: 0.08,
      add: false,
      fire: (S, g, o) =>
        S.emit("soft", 0x8c8576, Math.round(8 * o.params.amount), -g.R * 0.7, 0, {
          speed: [g.R * 0.2, g.R * 0.8],
          scale: [0.12, 0.2],
          life: 500,
          alpha: 0.3,
          __norm: true,
        }),
    },
    "shell-eject": {
      at: 0.2,
      add: false,
      fire: (S, g, o) =>
        S.emit("soft", 0xc9a24a, o.params.count | 0, -g.R * 0.2, 0, {
          speedX: [g.R * 0.4, g.R],
          speedY: [-g.R, -g.R * 0.4],
          scale: [0.04, 0.03],
          life: 500,
          gravity: g.R * 2.5,
          __norm: true,
        }),
    },
    "saw-sparks": {
      at: 0.45,
      add: true,
      fire: (S, g, o) =>
        S.emit("spark", lerpHue(o.params.color), o.params.count | 0, g.R * 0.6, 0, {
          speed: [g.R * 0.5, g.R * 1.5],
          angle: [-50, 50],
          scale: [0.05, 0],
          life: 280,
        }),
    },
    // CODE-14: fling the dissected painted balls outward as distinct projectiles (forward cone + gravity
    // + tumble), each a different frame of the scatter spritesheet, NO tint (keep the painted colours).
    "magma-scatter": {
      at: 0.36,
      add: false,
      fire: (S, g, o) => {
        if (!S.eScatter || !S.scatterMeta) return;
        const m = S.scatterMeta,
          n = Math.min(o.params.count | 0, m.count),
          pw = o.params.power || 1.3;
        const sc = (g.R * 0.5) / m.frameWidth;
        S.eScatter.setConfig({
          lifespan: 780,
          emitting: false,
          frame: Array.from({ length: m.count }, (_, i) => i),
          scale: { start: sc, end: sc * 0.8 },
          alpha: { start: 1, end: 0.35 },
          speed: { min: g.R * 1.4 * pw, max: g.R * 3.2 * pw },
          angle: { min: -o.params.spread * 57, max: o.params.spread * 57 },
          gravityY: g.R * 2.4,
          rotate: { min: -200, max: 200 },
          tint: 0xffffff,
        });
        if (n > 0) S.perLongTailFired = true;
        S.eScatter.explode(n, g.R * 0.3, -g.R * 0.1);
      },
    },
  };

  // Build the additive Graphics + pooled particle emitters into S.container (host sets S.scene + S.container first).
  function attachSurface(scene, S) {
    S.perLoading = Object.create(null);
    S.perFrame = {};
    S.renderGeom = { R: S.R };
    S.renderOpts = { params: null };
    S.perWebGL = !!scene.sys?.game?.renderer?.gl && typeof scene.add.rope === "function";
    S.gfxAdd = scene.add.graphics();
    S.gfxAdd.setBlendMode(1 /* Phaser.BlendModes.ADD */);
    S.container.add(S.gfxAdd);
    if (S.perWebGL) {
      // Exactly two adjacent Rope objects are pooled with the surface and shared by all three PER ids.
      S.perBody = makePerRope(scene);
      S.perLip = makePerRope(scene);
      S.container.add([S.perBody, S.perLip]);
    }
    // Weaponsmith pauses dispatch between attack windows; reset at scene-frame start to prevent leakage.
    S.perReset = () => hidePer(S);
    scene.events.on("preupdate", S.perReset);
    const mk = (tex, add) => {
      const e = scene.add.particles(0, 0, tex, {
        lifespan: 400,
        speed: 100,
        scale: 0.06,
        emitting: false,
        blendMode: add ? "ADD" : "NORMAL",
      });
      S.container.add(e);
      return e;
    };
    S.eSpark = mk("vfx-spark", true); // sharp hot streaks (the fiery spark path)
    S.eEmber = mk("vfx-soft", true); // warm rising embers that ride with sparks
    S.eSoftAdd = mk("vfx-soft", true);
    S.eSoftNorm = mk("vfx-soft", false);
    S.eStreak = mk("vfx-streak", true);
    const into = (emitter, color, count, x, y, cfg) => {
      try {
        emitter.setConfig({
          lifespan: cfg.life || 400,
          emitting: false,
          blendMode: emitter.blendMode,
          scale: { start: cfg.scale ? cfg.scale[0] : 0.06, end: cfg.scale ? cfg.scale[1] : 0 },
          alpha: { start: cfg.alpha != null ? cfg.alpha : 1, end: 0 },
          speed: cfg.speed ? { min: cfg.speed[0], max: cfg.speed[1] } : undefined,
          speedX: cfg.speedX ? { min: cfg.speedX[0], max: cfg.speedX[1] } : undefined,
          speedY: cfg.speedY ? { min: cfg.speedY[0], max: cfg.speedY[1] } : undefined,
          angle: cfg.angle ? { min: cfg.angle[0], max: cfg.angle[1] } : undefined,
          gravityY: cfg.gravity || 0,
          color: null, // ensure a prior ramp doesn't leak onto a tinted softs burst
          tint: color,
        });
        if (count > 0) S.perLongTailFired = true;
        emitter.explode(count, x, y);
      } catch (e) {
        console.log(`[vfx-render] emit fail: ${e.message}`);
      }
    };
    // FIERY spark burst — sharp hot streaks oriented to velocity, cooling through a fire ramp, arcing
    // under gravity, denser than before, with a few rising embers. The real "spark + fire" look.
    S.emitSpark = (base, count, x, y, cfg) => {
      try {
        const R = S.R || 80;
        const sp = cfg.speed || [R * 1.2, R * 3];
        const sc = cfg.scale || [0.06, 0];
        S.eSpark.setConfig({
          lifespan: cfg.life
            ? { min: cfg.life * 0.5, max: cfg.life * 1.4 }
            : { min: 200, max: 560 },
          emitting: false,
          blendMode: "ADD",
          scaleX: { start: sc[0] * 3, end: 0 }, // long
          scaleY: { start: Math.max(0.03, sc[0] * 1.4), end: 0 }, // thin → streak
          alpha: { start: 1, end: 0 },
          color: hotRamp(base),
          colorEase: "quad.out",
          speed: { min: sp[0] * 0.55, max: sp[1] * 1.5 },
          angle: cfg.angle ? { min: cfg.angle[0], max: cfg.angle[1] } : { min: 0, max: 360 },
          gravityY: cfg.gravity != null ? cfg.gravity : R * 3.4, // sparks arc + fall
          rotate: { onUpdate: (p) => Math.atan2(p.velocityY || 0, p.velocityX || 0) * 57.29578 }, // align to motion
        });
        if (count > 0) S.perLongTailFired = true;
        S.eSpark.explode(Math.round((count | 0) * 2.5), x, y); // much denser than the old burst
        S.eEmber.setConfig({
          lifespan: { min: 420, max: 880 },
          emitting: false,
          blendMode: "ADD",
          scale: { start: sc[0] * 1.1, end: 0 },
          alpha: { start: 0.85, end: 0 },
          speed: { min: sp[0] * 0.15, max: sp[1] * 0.5 },
          angle: { min: 205, max: 335 }, // upward-biased
          gravityY: -R * 0.9, // embers RISE
          color: [blend(base, 0xffffff, 0.45), blend(base, 0x000000, 0.35)],
          colorEase: "quad.out",
        });
        S.eEmber.explode(Math.max(4, Math.round((count | 0) * 0.6)), x, y);
      } catch (e) {
        console.log(`[vfx-render] spark fail: ${e.message}`);
      }
    };
    S.emit = (kind, color, count, x, y, cfg) => {
      if (kind === "spark") return S.emitSpark(color, count, x, y, cfg);
      return into(cfg?.__norm ? S.eSoftNorm : S.eSoftAdd, color, count, x, y, cfg);
    };
    S.emitStreak = (color, count, x, y, dist) =>
      into(S.eStreak, color, count, x, y, {
        life: 260,
        scale: [0.7, 1.1],
        speed: [dist * 3, dist * 5],
        angle: [-6, 6],
      });
  }

  // Scatter-shot source (CODE-14): a SPRITESHEET of the dissected painted cluster. Loaded as a multi-frame
  // texture so `magma-scatter` can fling each ball as a distinct projectile (host sets S.scene + S.container).
  function loadScatter(S, url, frameW, frameH, count) {
    if (!url || !S.scene) {
      S.scatterMeta = null;
      return;
    }
    S.scatterMeta = { frameWidth: frameW, frameHeight: frameH, count };
    const key = `scatter:${url}`;
    const build = () => {
      if (!S.scene.textures.exists(key)) return;
      if (S.eScatter) {
        try {
          S.eScatter.destroy();
        } catch (e) {
          void e;
        }
      }
      S.eScatter = S.scene.add.particles(0, 0, key, { lifespan: 760, emitting: false });
      S.container.add(S.eScatter);
    };
    if (S.scene.textures.exists(key)) {
      build();
      return;
    }
    S.scene.load.spritesheet(key, url, { frameWidth: frameW, frameHeight: frameH });
    S.scene.load.once("complete", build);
    S.scene.load.start();
  }

  // Render the enabled suite's graphics + particle layers at the container's CURRENT transform.
  //   mode "swing"  → ONLY swing-trigger graphics (sweep along the blade during the swing)
  //   mode "impact" → everything EXCEPT swing-trigger (hit/cast/channel/area, post-impact)
  //   mode "all"    → everything (the standalone non-attack preview)
  function renderLayers(S, p, mode, cyc) {
    hidePer(S);
    const g = S.renderGeom;
    g.R = S.R;
    const opts = S.renderOpts;
    const reg = globalThis.VFXLAYERS || {};
    const order = reg.ORDER || Object.keys(S.suite);
    const LAYERS = reg.LAYERS || {};
    for (const lid of order) {
      const s = S.suite[lid];
      if (!s?.on || lid === "hero-skin") continue;
      const isSwing = !!(LAYERS[lid] && LAYERS[lid].trigger === "swing");
      if (mode === "swing" ? !isSwing : mode === "impact" && isSwing) continue;
      const fn = R[lid];
      if (fn) {
        try {
          opts.params = s.params;
          fn(S, g, p, opts);
        } catch (e) {
          console.log(`[vfx-render] ${lid} draw error: ${e.message}`);
        }
        continue;
      }
      if (mode === "swing") continue; // particle layers fire only in the impact / all window
      const part = PARTS[lid];
      if (part) {
        if (S.perQuality === 4) continue;
        if (cyc !== S.fired[lid] && p >= part.at) {
          S.fired[lid] = cyc;
          try {
            opts.params = s.params;
            part.fire(S, g, opts);
          } catch (e) {
            console.log(`[vfx-render] ${lid} emit error: ${e.message}`);
          }
        }
        continue;
      }
      warnOnce(lid);
    }
  }

  // Painted hero skin (an Image on S.heroImg). Shown post-impact (attack) / across the cycle (standalone).
  // `S.heroEnabled === false` hides it. `S.wantHeroKey` is the desired texture key (set once loaded).
  function renderHero(scene, S, p) {
    const heroLayer = S.suite["hero-skin"];
    const want = S.wantHeroKey;
    if (
      S.heroEnabled !== false &&
      heroLayer &&
      heroLayer.on &&
      want &&
      S.heroImg &&
      scene.textures.exists(want)
    ) {
      if (S.heroImg.texture.key !== want) S.heroImg.setTexture(want);
      const a = burst(p, 0.34, 0.6);
      if (a > 0) {
        const grow = heroLayer.params.rise ? 0.4 + 0.6 * clamp01((p - 0.18) / 0.22) : 1;
        const w = S.R * 2.4 * (heroLayer.params.size || 1) * grow;
        const tw = S.heroImg.texture.getSourceImage()?.width || w;
        S.heroImg
          .setScale(w / tw)
          .setAlpha(Math.min(1, a * 1.4))
          .setVisible(true);
      } else S.heroImg.setVisible(false);
    } else if (S.heroImg) S.heroImg.setVisible(false);
  }

  globalThis.VFXRENDER = {
    ensureTextures,
    attachSurface,
    loadScatter,
    renderLayers,
    renderHero,
    R,
    PARTS,
    clamp01,
    burst,
    lerpHue,
    makePerRope,
    updateLinearRope,
    debug: PER_DEBUG,
  };
})();
