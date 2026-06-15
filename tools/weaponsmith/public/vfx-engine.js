// VFX ENGINE — the WYSIWYG Phaser/WebGL renderer (§14). The Weaponsmith preview runs the SAME engine
// the game will, so "what you author = what ships". Real additive blending + camera BLOOM post-FX +
// GPU particle emitters — far beyond the canvas-2D approximation. Driven by the shared per-weapon
// PRESET suite (vfx-layers.js): each enabled layer maps to a Phaser-native renderer here.
//
//   const pv = VFXEngine.makePreview(stageEl);
//   pv.setHero(url); pv.setSuite(suite, rotDeg); pv.replay();
//
// Coverage is rolling: the slash family + sparks/muzzle/area-glows are ported (the visually dominant
// layers). Unported layers are skipped (logged once) until they land — see CODE-8.
window.VFXEngine = (function () {
  const TAU = Math.PI * 2;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const burst = (p, at, w) => { const d = Math.abs(p - at) / w; return d >= 1 ? 0 : 1 - d * d; };
  function lerpHue(h) {
    const stops = [0xff4d3a, 0xff8a2b, 0xd6ff5a, 0x6fd6ff, 0x9cff3b, 0x6f8bff, 0xb07bd6, 0xff4d3a];
    return stops[Math.min(stops.length - 2, Math.floor(h * (stops.length - 1)))];
  }
  const warned = new Set();
  const warnOnce = (id) => { if (!warned.has(id)) { warned.add(id); console.log(`[vfx-engine] layer not ported yet: ${id}`); } };

  // a soft round particle texture (radial alpha falloff) — the building block for glow particles
  function ensureSoft(scene) {
    if (scene.textures.exists("vfx-soft")) return;
    const s = 64, c = document.createElement("canvas"); c.width = c.height = s;
    const x = c.getContext("2d"), g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,0.65)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, s, s);
    scene.textures.addCanvas("vfx-soft", c);
  }
  // a small soft streak (for speed-lines / tracers) — a horizontal capsule
  function ensureStreak(scene) {
    if (scene.textures.exists("vfx-streak")) return;
    const w = 64, h = 16, c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d"), g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.6, "rgba(255,255,255,0.9)"); g.addColorStop(1, "rgba(255,255,255,1)");
    x.fillStyle = g; x.beginPath(); x.ellipse(w / 2, h / 2, w / 2, h / 4, 0, 0, TAU); x.fill();
    scene.textures.addCanvas("vfx-streak", c);
  }

  // ── per-layer Phaser renderers. (S=preview state, g={R} centred at container origin, p=phase, o={params,heroOn}) ──
  // Graphics layers draw into S.gfxAdd each frame (additive, bloomed). Particle layers explode bursts
  // from pooled emitters at their trigger phase (tracked so each fires once per cycle).
  function fillCrescent(gfx, R, head, span, thick, color, sw, segs = 26) {
    for (let i = 0; i < segs; i++) {
      const f0 = i / segs, f1 = (i + 1) / segs;
      const a0 = head - span + span * f0, a1 = head - span + span * f1;
      const w0 = thick * (0.1 + 0.95 * f0), w1 = thick * (0.1 + 0.95 * f1);
      gfx.fillStyle(color, (1 - sw) * (0.06 + 0.6 * f1));
      const ox0 = Math.cos(a0) * (R + w0 / 2), oy0 = Math.sin(a0) * (R + w0 / 2);
      const ix0 = Math.cos(a0) * (R - w0 / 2), iy0 = Math.sin(a0) * (R - w0 / 2);
      const ox1 = Math.cos(a1) * (R + w1 / 2), oy1 = Math.sin(a1) * (R + w1 / 2);
      const ix1 = Math.cos(a1) * (R - w1 / 2), iy1 = Math.sin(a1) * (R - w1 / 2);
      gfx.beginPath(); gfx.moveTo(ox0, oy0); gfx.lineTo(ox1, oy1); gfx.lineTo(ix1, iy1); gfx.lineTo(ix0, iy0); gfx.closePath(); gfx.fillPath();
    }
  }
  function strokeArcG(gfx, R, a0, a1, width, color, alpha) {
    gfx.lineStyle(width, color, alpha); gfx.beginPath(); gfx.arc(0, 0, R, a0, a1, false); gfx.strokePath();
  }

  const R = {
    "hero-skin": null, // handled specially (an Image, not additive graphics)
    "blade-trail": (S, g, p, o) => {
      const sw = clamp01((p - 0.03) / 0.34); if (sw <= 0 || sw >= 1) return;
      const col = lerpHue(o.params.color), Rr = g.R * o.params.reach, span = o.params.sweep;
      const head = -1.05 + sw * 2.1, thick = o.params.thick * g.R;
      const gx = S.gfxAdd;
      fillCrescent(gx, Rr, head, span, thick, col, sw);
      // hot white leading edge + concentric speed-line streaks
      strokeArcG(gx, Rr, head - span * 0.38, head, Math.max(1.5, thick * 0.35), 0xffffff, (1 - sw) * 0.95);
      const n = o.params.lines | 0;
      for (let i = 0; i < n; i++) strokeArcG(gx, Rr + (i - (n - 1) / 2) * thick * 0.55, head - span * 0.72, head - 0.03, 1.1, col, (1 - sw) * 0.35);
    },
    "edge-trail": (S, g, p, o) => {
      const sw = clamp01((p - 0.04) / 0.34); if (sw <= 0 || sw >= 1) return;
      const col = lerpHue(o.params.color), Rr = g.R * o.params.reach, head = -1.4 + sw * 2.8, tail = head - 1.6 * o.params.len;
      for (let i = 0; i < 8; i++) { const f = i / 8; strokeArcG(S.gfxAdd, Rr, tail + (head - tail) * f, tail + (head - tail) * (f + 0.16), 6 * (0.25 + f), col, 0.4 * f * (1 - sw)); }
    },
    "slash-arc": (S, g, p, o) => {
      const sw = clamp01((p - 0.05) / 0.3); if (sw <= 0 || sw >= 1) return;
      const a0 = -1.2 + sw * 2.4; strokeArcG(S.gfxAdd, g.R * o.params.reach, a0, a0 + 1.1, o.params.width, lerpHue(o.params.color), 0.9 * (1 - sw));
    },
    "twin-slash": (S, g, p, o) => {
      const sw = clamp01((p - 0.05) / 0.32); if (sw <= 0 || sw >= 1) return;
      const col = lerpHue(o.params.color), Rr = g.R * o.params.reach;
      const cross = (a0, a1) => { strokeArcG(S.gfxAdd, Rr, a0, a1, 5, col, 0.7 * (1 - sw)); strokeArcG(S.gfxAdd, Rr, a1 - 0.4, a1, 1.5, 0xffffff, 0.9 * (1 - sw)); };
      cross(-1.3 + sw * 2.2, -0.2 + sw * 2.2); cross(1.3 - sw * 2.2, 0.2 - sw * 2.2);
    },
    "thrust-streak": (S, g, p, o) => {
      const tp = clamp01((p - 0.1) / 0.25); if (tp <= 0 || tp >= 1) return;
      const x0 = -g.R * 0.3, x1 = g.R * o.params.reach * 1.4, x = x0 + (x1 - x0) * tp;
      S.gfxAdd.lineStyle(6 * (1 - tp * 0.5), lerpHue(o.params.color), 0.9 * (1 - tp)); S.gfxAdd.beginPath(); S.gfxAdd.moveTo(x - g.R * 0.5, 0); S.gfxAdd.lineTo(x, 0); S.gfxAdd.strokePath();
    },
    "cleave-flash": (S, g, p, o) => {
      const a = burst(p, 0.3, 0.12) * o.params.intensity; if (a <= 0) return;
      S.gfxAdd.lineStyle(4, 0xf6ffff, a); S.gfxAdd.beginPath(); S.gfxAdd.moveTo(-g.R, g.R * 0.4); S.gfxAdd.lineTo(g.R, -g.R * 0.4); S.gfxAdd.strokePath();
    },
    "shockwave-ring": (S, g, p, o) => {
      const a = burst(p, 0.34, 0.4); if (a <= 0) return; const sc = clamp01((p - 0.2) / 0.4);
      const gx = S.gfxAdd; gx.lineStyle(4, lerpHue(o.params.color), (1 - sc) * 0.9); gx.beginPath(); gx.ellipse(0, 0, g.R * (0.3 + sc * 1.4), g.R * (0.3 + sc * 1.4) * 0.55, 0, 0, TAU); gx.strokePath();
    },
    "aura-pulse": (S, g, p, o) => {
      const col = lerpHue(o.params.color), n = o.params.rings | 0;
      for (let i = 0; i < n; i++) { const tp = clamp01((p - i * 0.12) / 0.6); if (tp <= 0) continue; S.gfxAdd.lineStyle(3, col, 0.6 * (1 - tp)); S.gfxAdd.beginPath(); S.gfxAdd.arc(0, 0, g.R * 0.3 + tp * g.R * 1.2, 0, TAU); S.gfxAdd.strokePath(); }
    },
    "sigil-ring": (S, g, p, o) => {
      const a = burst(p, 0.4, 0.35); if (a <= 0) return; const col = lerpHue(o.params.color), rr = g.R * 0.9 * o.params.size, rot = p * 3, gx = S.gfxAdd;
      gx.lineStyle(2, col, a * 0.85); gx.beginPath(); gx.arc(0, 0, rr, 0, TAU); gx.strokePath(); gx.beginPath(); gx.arc(0, 0, rr * 0.7, 0, TAU); gx.strokePath();
      for (let i = 0; i < 6; i++) { const ang = rot + (i / 6) * TAU, c = Math.cos(ang), s = Math.sin(ang); gx.beginPath(); gx.moveTo(c * rr * 0.7, s * rr * 0.7); gx.lineTo(c * rr, s * rr); gx.strokePath(); gx.beginPath(); gx.arc(c * rr, s * rr, rr * 0.08, 0, TAU); gx.strokePath(); }
    },
    "arc-bolt": (S, g, p, o) => {
      const a = burst(p, 0.4, 0.12); if (a <= 0) return; const col = lerpHue(o.params.color), mx = g.R * 0.85, tx = g.R * 1.9, gx = S.gfxAdd;
      let s = (p * 6 | 0) * 2654435761; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
      gx.lineStyle(2.5, col, a); gx.beginPath(); gx.moveTo(mx, 0); let x = mx; while (x < tx) { x += g.R * 0.18; gx.lineTo(x, (rnd() - 0.5) * g.R * o.params.jag * 2); } gx.strokePath();
    },
    "beam": (S, g, p, o) => {
      const a = clamp01((p - 0.3) / 0.1) * (1 - clamp01((p - 0.7) / 0.15)); if (a <= 0) return; const mx = g.R * 0.9, gx = S.gfxAdd;
      gx.lineStyle(o.params.width, lerpHue(o.params.color), a); gx.beginPath(); gx.moveTo(mx, 0); gx.lineTo(g.R * 2, 0); gx.strokePath();
      gx.lineStyle(o.params.width * 0.4, 0xffffff, a); gx.beginPath(); gx.moveTo(mx, 0); gx.lineTo(g.R * 2, 0); gx.strokePath();
    },
    "barrel-spin": (S, g, p, o) => {
      const a = clamp01(p / 0.16) * (1 - clamp01((p - 0.16) / 0.22)); if (a <= 0) return; const col = lerpHue(o.params.color), mx = g.R * 0.4;
      for (let i = 0; i < 3; i++) { const a0 = p * 42 + i * TAU / 3; S.gfxAdd.lineStyle(3, col, a * 0.5); S.gfxAdd.beginPath(); S.gfxAdd.arc(mx, 0, g.R * 0.4, a0, a0 + 1.5); S.gfxAdd.strokePath(); }
    },
    // radial glows — concentric soft fills approximate the gradient, bloom finishes the look
    "impact-flash": (S, g, p, o) => glow(S, 0, 0, g.R * 1.3, burst(p, 0.3, 0.16) * o.params.intensity, 0xffcaa0),
    "fire-burst": (S, g, p, o) => { const a = burst(p, 0.55, 0.3); if (a <= 0) return; const sc = clamp01((p - 0.5) / 0.3); glow(S, 0, 0, g.R * 1.5 * o.params.size * (0.4 + sc), a, lerpHue(o.params.color)); },
    "charge-glow": (S, g, p, o) => { const a = clamp01(p / 0.28) * (1 - clamp01((p - 0.3) / 0.15)); if (a <= 0) return; glow(S, g.R * 0.9, 0, g.R * 0.5 * o.params.size, a, lerpHue(o.params.color)); },
  };
  function glow(S, x, y, r, a, color) {
    if (a <= 0) return; const gx = S.gfxAdd;
    for (let i = 0; i < 4; i++) { const f = 1 - i / 4; gx.fillStyle(i === 0 ? 0xffffff : color, a * 0.22); gx.fillCircle(x, y, r * (0.25 + f * 0.85)); }
  }

  // particle layers: { trigger phase, fire(S,g,o) → explode a burst from a pooled emitter }
  const PARTS = {
    "hit-spark": { at: 0.3, add: true, fire: (S, g, o) => S.emit("spark", lerpHue(o.params.color), o.params.count | 0, 0, 0, { speed: [g.R * 1.2, g.R * 3], scale: [0.06, 0], life: 320 }) },
    "muzzle-flash": { at: 0.16, add: true, fire: (S, g, o) => { glowBurst(S, g.R * 0.95, 0, g.R * 0.6 * o.params.size, lerpHue(o.params.color)); S.emit("spark", lerpHue(o.params.color), 8, g.R * 0.95, 0, { speed: [g.R * 2, g.R * 4.5], angle: [-25, 25], scale: [0.08, 0], life: 240 }); } },
    "tracer": { at: 0.16, add: true, fire: (S, g, o) => S.emitStreak(lerpHue(o.params.color), o.params.count | 0, g.R * 0.95, 0, g.R * 1.6) },
    "pellet-spread": { at: 0.16, add: true, fire: (S, g, o) => S.emit("spark", 0xffd9a0, o.params.count | 0, g.R * 0.9, 0, { speed: [g.R * 1.5, g.R * 3.2], angle: [-o.params.spread * 57, o.params.spread * 57], scale: [0.05, 0], life: 360 }) },
    "blood-mist": { at: 0.32, add: false, fire: (S, g, o) => S.emit("soft", 0xb21f1f, Math.round(18 * o.params.amount), 0, 0, { speed: [g.R * 0.6, g.R * 1.8], angle: [-35, 35], scale: [0.05, 0.02], life: 420, __norm: true }) },
    "drift-petals": { at: 0.2, add: true, fire: (S, g, o) => S.emit("soft", lerpHue(o.params.color), o.params.count | 0, 0, 0, { speed: [g.R * 0.6, g.R * 1.6], scale: [0.04, 0], life: 700, gravity: -g.R * 0.6 }) },
    "ember-rain": { at: 0.3, add: true, fire: (S, g, o) => S.emit("soft", lerpHue(o.params.color), o.params.count | 0, 0, -g.R, { speedX: [-g.R * 0.3, g.R * 0.3], speedY: [g.R * 0.6, g.R * 1.6], scale: [0.04, 0], life: 800, gravity: g.R }) },
    "debris": { at: 0.34, add: false, fire: (S, g, o) => S.emit("soft", 0x3a4049, o.params.count | 0, 0, 0, { speed: [g.R * 1.4, g.R * 2.8], scale: [0.07, 0.03], life: 600, gravity: g.R * 2, __norm: true }) },
    "dust-cloud": { at: 0.36, add: false, fire: (S, g, o) => S.emit("soft", 0x6e7042, Math.round(14 * o.params.amount), 0, 0, { speed: [g.R * 0.3, g.R * 1], scale: [0.18, 0.3], life: 700, alpha: 0.3, __norm: true }) },
    "throw-dust": { at: 0.08, add: false, fire: (S, g, o) => S.emit("soft", 0x8c8576, Math.round(8 * o.params.amount), -g.R * 0.7, 0, { speed: [g.R * 0.2, g.R * 0.8], scale: [0.12, 0.2], life: 500, alpha: 0.3, __norm: true }) },
    "shell-eject": { at: 0.2, add: false, fire: (S, g, o) => S.emit("soft", 0xc9a24a, o.params.count | 0, -g.R * 0.2, 0, { speedX: [g.R * 0.4, g.R], speedY: [-g.R, -g.R * 0.4], scale: [0.04, 0.03], life: 500, gravity: g.R * 2.5, __norm: true }) },
    "saw-sparks": { at: 0.45, add: true, fire: (S, g, o) => S.emit("spark", lerpHue(o.params.color), o.params.count | 0, g.R * 0.6, 0, { speed: [g.R * 0.5, g.R * 1.5], angle: [-50, 50], scale: [0.05, 0], life: 280 }) },
  };
  function glowBurst(S, x, y, r, color) { glow(S, x, y, r, 1, color); }

  function setup(scene, S) {
    ensureSoft(scene); ensureStreak(scene);
    if (!scene.textures.exists("vfx-blank")) { const c = document.createElement("canvas"); c.width = c.height = 2; scene.textures.addCanvas("vfx-blank", c); }
    S.scene = scene;
    S.container = scene.add.container(0, 0);
    S.heroImg = scene.add.image(0, 0, "vfx-blank").setVisible(false); S.container.add(S.heroImg);
    S.gfxAdd = scene.add.graphics(); S.gfxAdd.setBlendMode(Phaser.BlendModes.ADD); S.container.add(S.gfxAdd);
    // pooled emitters: additive sparks/soft (energy) + normal soft (dust/debris) + additive streaks
    const mk = (tex, add) => { const e = scene.add.particles(0, 0, tex, { lifespan: 400, speed: 100, scale: 0.06, emitting: false, blendMode: add ? "ADD" : "NORMAL" }); S.container.add(e); return e; };
    S.eSparkAdd = mk("vfx-soft", true); S.eSoftAdd = mk("vfx-soft", true); S.eSoftNorm = mk("vfx-soft", false); S.eStreak = mk("vfx-streak", true);

    // generic burst (container-local coords). Reconfigure the pooled emitter then explode a one-shot.
    const into = (emitter, color, count, x, y, cfg) => {
      try {
        emitter.setConfig({
          lifespan: cfg.life || 400, emitting: false, blendMode: emitter.blendMode,
          scale: { start: cfg.scale ? cfg.scale[0] : 0.06, end: cfg.scale ? cfg.scale[1] : 0 },
          alpha: { start: cfg.alpha != null ? cfg.alpha : 1, end: 0 },
          speed: cfg.speed ? { min: cfg.speed[0], max: cfg.speed[1] } : undefined,
          speedX: cfg.speedX ? { min: cfg.speedX[0], max: cfg.speedX[1] } : undefined,
          speedY: cfg.speedY ? { min: cfg.speedY[0], max: cfg.speedY[1] } : undefined,
          angle: cfg.angle ? { min: cfg.angle[0], max: cfg.angle[1] } : undefined,
          gravityY: cfg.gravity || 0, tint: color,
        });
        emitter.explode(count, x, y);
      } catch (e) { console.log("[vfx-engine] emit fail: " + e.message); }
    };
    S.emit = (kind, color, count, x, y, cfg) => into(kind === "spark" ? S.eSparkAdd : (cfg && cfg.__norm ? S.eSoftNorm : S.eSoftAdd), color, count, x, y, cfg);
    S.emitStreak = (color, count, x, y, dist) => into(S.eStreak, color, count, x, y, { life: 260, scale: [0.7, 1.1], speed: [dist * 3, dist * 5], angle: [-6, 6] });

    // real post-process GLOW (Phaser 4 Filters) — soft bloom on the bright additive content the
    // canvas-2D preview could only fake. Tuned subtle so it lifts the energy without hazing the art.
    try { scene.cameras.main.filters.internal.addGlow(0xffffff, 3, 0, 1.1); }
    catch (e) { console.log("[vfx-engine] glow filter unavailable: " + e.message); }

    layoutContainer(scene, S);
    scene.scale.on("resize", () => layoutContainer(scene, S));
    S.ready = true;
  }

  function layoutContainer(scene, S) {
    const W = scene.scale.width, H = scene.scale.height;
    S.W = W; S.H = H; S.R = Math.min(W, H) * 0.3;
    S.container.setPosition(W / 2, H * 0.55);
  }

  // Set the DESIRED hero texture. frame() applies it once loaded — so rapid weapon switches never
  // race (no stale art): the latest wantHeroKey wins, shown as soon as its texture is in the cache.
  function loadHero(S, url) {
    if (!url) { S.wantHeroKey = null; return; }
    const key = "hero:" + url;
    S.wantHeroKey = key;
    if (!S.scene || S.scene.textures.exists(key)) return;
    S.scene.load.image(key, url);
    S.scene.load.start(); // safe while already loading — Phaser queues it
  }

  function frame(scene, S, delta) {
    if (!S.ready) return;
    S.t += delta / 1000;
    let p = (S.t - S.startT) / S.cycle; const cyc = Math.floor((S.t - S.startT) / S.cycle); p = ((p % 1) + 1) % 1;
    S.container.setRotation((S.rot || 0) * Math.PI / 180);
    const g = { R: S.R };
    S.gfxAdd.clear();
    // hero — always reflect the latest DESIRED texture once it's loaded (no async-apply race)
    const heroLayer = S.suite["hero-skin"];
    const want = S.wantHeroKey;
    if (heroLayer && heroLayer.on && want && S.heroImg && scene.textures.exists(want)) {
      if (S.heroImg.texture.key !== want) S.heroImg.setTexture(want);
      const a = burst(p, 0.34, 0.6);
      if (a > 0) {
        const grow = heroLayer.params.rise ? 0.4 + 0.6 * clamp01((p - 0.18) / 0.22) : 1;
        const w = g.R * 2.4 * (heroLayer.params.size || 1) * grow;
        const tw = (S.heroImg.texture.getSourceImage() || {}).width || w;
        S.heroImg.setScale(w / tw).setAlpha(Math.min(1, a * 1.4)).setVisible(true);
      } else S.heroImg.setVisible(false);
    } else if (S.heroImg) S.heroImg.setVisible(false);
    // graphics layers
    const order = (window.VFXLAYERS && window.VFXLAYERS.ORDER) || Object.keys(S.suite);
    for (const lid of order) {
      const s = S.suite[lid]; if (!s || !s.on) continue;
      if (lid === "hero-skin") continue;
      const fn = R[lid];
      if (fn) { try { fn(S, g, p, { params: s.params }); } catch (e) { console.log(`[vfx-engine] ${lid} draw error: ${e.message}`); } continue; }
      // particle layer? fire once per cycle at its trigger phase
      const part = PARTS[lid];
      if (part) {
        const fired = S.fired[lid];
        if (cyc !== fired && p >= part.at) {
          S.fired[lid] = cyc;
          try { part.fire(S, g, { params: s.params }); } catch (e) { console.log(`[vfx-engine] ${lid} emit error: ${e.message}`); }
        }
        continue;
      }
      warnOnce(lid);
    }
  }

  function makePreview(parentEl, opts = {}) {
    const S = { suite: {}, rot: 0, t: 0, startT: 0, cycle: (window.VFXLAYERS && window.VFXLAYERS.CYCLE) || 2, ready: false, fired: {}, _heroKey: null };
    const config = {
      type: Phaser.WEBGL, parent: parentEl, transparent: true,
      width: parentEl.clientWidth || 300, height: parentEl.clientHeight || 300,
      scale: { mode: Phaser.Scale.RESIZE, parent: parentEl, width: parentEl.clientWidth || 300, height: parentEl.clientHeight || 300 },
      fps: { forceSetTimeOut: true },
      render: { preserveDrawingBuffer: true, antialias: true }, // preserve → lets us snapshot the canvas
      scene: { create() { setup(this, S); }, update(t, d) { frame(this, S, d); } },
    };
    const game = new Phaser.Game(config);
    return {
      setSuite(suite, rot) { S.suite = suite; S.rot = rot || 0; S.fired = {}; },
      setRot(rot) { S.rot = rot || 0; },
      setHero(url) { if (S.scene) loadHero(S, url); else setTimeout(() => loadHero(S, url), 60); },
      replay() { S.startT = S.t; S.fired = {}; },
      destroy() { try { game.destroy(true); } catch (e) { void e; } },
      refresh() { try { game.scale.refresh(); if (S.scene) layoutContainer(S.scene, S); } catch (e) { void e; } },
      get game() { return game; },
      get scene() { return S.scene; },
    };
  }

  return { makePreview };
})();
