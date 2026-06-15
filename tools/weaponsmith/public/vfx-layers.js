// VFX LAYER PALETTE (§14 reusable mechanics) + per-weapon PRESETS.
// A weapon's VFX = one hero skin (its Codex art, or a bespoke VFX skin) + a stack of toggleable
// engine layers. Each layer is a reusable "mechanic"; a weapon is a PRESET = which layers are on +
// their params (my per-weapon recommendation). The palette spans all four weapon classes — melee
// swords, ranged guns, lobbed launchers, caster staffs — so one shared library skins the whole
// arsenal (§14: ~40 mechanics × art = 200 weapons). Same render code feeds the Weaponsmith preview
// and (later) the game.
//   draw(ctx, g, p, o)   g={cx,cy,R}   p=cycle phase 0..1   o={hero, params, rnd, seed}
//   Convention: weapons face RIGHT — muzzle/tip/head is at +x, grip at -x. Projectiles fly right.
(function () {
  const TAU = Math.PI * 2;
  const mulberry = (a) => () => { a |= 0; a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  // a quick rise→hold→fall envelope centred on `at` with width `w`
  const burst = (p, at, w) => { const d = Math.abs(p - at) / w; return d >= 1 ? 0 : 1 - d * d; };
  const hex = (n) => `#${(n >>> 0).toString(16).padStart(6, "0")}`;
  const P = (key, label, min, max, def, step) => ({ key, label, min, max, def, step: step ?? (max - min) / 100 });

  function strokeArc(ctx, cx, cy, r, a0, a1, width, color, alpha) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke(); ctx.restore();
  }

  // ---- the layer palette -------------------------------------------------------------------
  const LAYERS = {
    "hero-skin": {
      label: "Hero skin (Codex art)", trigger: "impact", needsHero: true,
      params: [P("size", "Size", 0.5, 1.6, 1), P("rise", "Erupt", 0, 1, 1)],
      draw(ctx, g, p, o) {
        if (!o.hero || !o.hero.complete || !o.hero.naturalWidth) return;
        const a = burst(p, 0.34, 0.6); if (a <= 0) return;
        const grow = o.params.rise ? 0.4 + 0.6 * clamp01((p - 0.18) / 0.22) : 1;
        const w = g.R * 2.4 * o.params.size * grow, h = w * (o.hero.naturalHeight / o.hero.naturalWidth);
        ctx.save(); ctx.globalAlpha = Math.min(1, a * 1.4); ctx.drawImage(o.hero, g.cx - w / 2, g.cy - h / 2, w, h); ctx.restore();
      },
    },
    // ---- melee: swings, edges, cleaves ----
    "slash-arc": {
      label: "Slash arc", trigger: "swing",
      params: [P("reach", "Reach", 0.5, 1.4, 1), P("width", "Width", 2, 10, 6, 1), P("color", "Hue", 0, 1, 0.55)],
      draw(ctx, g, p, o) {
        const sw = clamp01((p - 0.05) / 0.3); if (sw <= 0 || sw >= 1) return;
        const a0 = -1.2 + sw * 2.4, r = g.R * o.params.reach;
        const col = hex(lerpHue(o.params.color));
        strokeArc(ctx, g.cx, g.cy, r, a0, a0 + 1.1, o.params.width, col, 0.9 * (1 - sw));
      },
    },
    "twin-slash": {
      label: "Twin slash (X)", trigger: "swing",
      params: [P("reach", "Reach", 0.5, 1.4, 0.95), P("color", "Hue", 0, 1, 0.5)],
      draw(ctx, g, p, o) {
        const sw = clamp01((p - 0.05) / 0.32); if (sw <= 0 || sw >= 1) return;
        const col = hex(lerpHue(o.params.color)), r = g.R * o.params.reach;
        // two crossing crescents, additively glowing with a soft bloom + bright core
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.shadowColor = col; ctx.lineCap = "round";
        const cross = (a0, a1) => {
          ctx.shadowBlur = 14; strokeArc(ctx, g.cx, g.cy, r, a0, a1, 7, col, 0.4 * (1 - sw));
          ctx.shadowBlur = 0; strokeArc(ctx, g.cx, g.cy, r, a0, a1, 3, col, 0.8 * (1 - sw));
          strokeArc(ctx, g.cx, g.cy, r, a1 - 0.4, a1, 1.5, "#ffffff", 0.9 * (1 - sw));
        };
        cross(-1.3 + sw * 2.2, -0.2 + sw * 2.2);
        cross(1.3 - sw * 2.2, 0.2 - sw * 2.2);
        ctx.restore();
      },
    },
    "edge-trail": {
      label: "Edge trail (afterglow)", trigger: "swing",
      params: [P("reach", "Reach", 0.6, 1.6, 1.1), P("color", "Hue", 0, 1, 0.55), P("len", "Length", 0.4, 1.4, 1)],
      draw(ctx, g, p, o) {
        const sw = clamp01((p - 0.04) / 0.34); if (sw <= 0 || sw >= 1) return;
        const r = g.R * o.params.reach, head = -1.4 + sw * 2.8, tail = head - 1.6 * o.params.len, col = hex(lerpHue(o.params.color));
        // additive glow afterglow — each segment brighter toward the head, soft-blurred for bloom
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.shadowColor = col; ctx.lineCap = "round";
        for (let i = 0; i < 8; i++) { const f = i / 8; ctx.shadowBlur = 8 * f; strokeArc(ctx, g.cx, g.cy, r, tail + (head - tail) * f, tail + (head - tail) * (f + 0.16), 6 * (0.25 + f), col, 0.4 * f * (1 - sw)); }
        ctx.restore();
      },
    },
    // ── the sleek "speed-line" slash: a tapered, additively-glowing crescent that sweeps with the
    //    swing, a hot white leading edge, soft bloom underneath, and thin trailing motion streaks.
    //    This is the high-fidelity slash standard (replaces flat hard arcs on cutting weapons).
    "blade-trail": {
      label: "Blade trail (speed lines)", trigger: "swing",
      params: [P("reach", "Reach", 0.5, 1.5, 1), P("color", "Hue", 0, 1, 0.55), P("sweep", "Sweep", 0.6, 2.4, 1.5), P("thick", "Thickness", 0.04, 0.4, 0.18), P("lines", "Speed lines", 0, 8, 4, 1)],
      draw(ctx, g, p, o) {
        const sw = clamp01((p - 0.03) / 0.34); if (sw <= 0 || sw >= 1) return;
        const col = hex(lerpHue(o.params.color)), R = g.R * o.params.reach;
        const head = -1.05 + sw * 2.1, span = o.params.sweep, tail = head - span, segs = 26, cx = g.cx, cy = g.cy;
        const pt = (a, rad) => [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        // two passes: a wide soft bloom underneath, then a crisp tapered crescent on top
        for (const pass of [{ blur: 16, wmul: 1.6, amul: 0.42 }, { blur: 0, wmul: 1, amul: 1 }]) {
          ctx.shadowBlur = pass.blur; ctx.shadowColor = col; ctx.fillStyle = col;
          for (let i = 0; i < segs; i++) {
            const f0 = i / segs, f1 = (i + 1) / segs;
            const a0 = tail + span * f0, a1 = tail + span * f1;
            const w0 = o.params.thick * g.R * (0.1 + 0.95 * f0) * pass.wmul, w1 = o.params.thick * g.R * (0.1 + 0.95 * f1) * pass.wmul;
            ctx.globalAlpha = (1 - sw) * (0.05 + 0.5 * f1) * pass.amul;
            const [ox0, oy0] = pt(a0, R + w0 / 2), [ix0, iy0] = pt(a0, R - w0 / 2);
            const [ox1, oy1] = pt(a1, R + w1 / 2), [ix1, iy1] = pt(a1, R - w1 / 2);
            ctx.beginPath(); ctx.moveTo(ox0, oy0); ctx.lineTo(ox1, oy1); ctx.lineTo(ix1, iy1); ctx.lineTo(ix0, iy0); ctx.closePath(); ctx.fill();
          }
        }
        ctx.shadowBlur = 0;
        // hot white leading edge (the bright cutting line)
        ctx.globalAlpha = (1 - sw) * 0.95; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = Math.max(1.5, o.params.thick * g.R * 0.35); ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(cx, cy, R, head - span * 0.38, head); ctx.stroke();
        // thin concentric trailing streaks = the speed lines
        const n = o.params.lines | 0;
        for (let i = 0; i < n; i++) {
          const rr = R + (i - (n - 1) / 2) * o.params.thick * g.R * 0.55;
          ctx.globalAlpha = (1 - sw) * 0.3; ctx.strokeStyle = col; ctx.lineWidth = 1.1;
          ctx.beginPath(); ctx.arc(cx, cy, rr, head - span * 0.72, head - 0.03); ctx.stroke();
        }
        ctx.restore();
      },
    },
    "thrust-streak": {
      label: "Thrust streak", trigger: "swing",
      params: [P("reach", "Reach", 0.6, 1.6, 1.2), P("color", "Hue", 0, 1, 0.55)],
      draw(ctx, g, p, o) {
        const tp = clamp01((p - 0.1) / 0.25); if (tp <= 0 || tp >= 1) return;
        const col = hex(lerpHue(o.params.color)), x0 = g.cx - g.R * 0.3, x1 = g.cx + g.R * o.params.reach * 1.4;
        const x = x0 + (x1 - x0) * tp;
        ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.globalAlpha = 0.9 * (1 - tp); ctx.strokeStyle = col; ctx.lineWidth = 6 * (1 - tp * 0.5); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x - g.R * 0.5, g.cy); ctx.lineTo(x, g.cy); ctx.stroke(); ctx.restore();
      },
    },
    "drift-petals": {
      label: "Drift petals / motes", trigger: "swing",
      params: [P("count", "Count", 3, 16, 8, 1), P("color", "Hue", 0, 1, 0.6)],
      draw(ctx, g, p, o) {
        const r = mulberry(o.seed + 11), n = o.params.count | 0; ctx.save(); ctx.fillStyle = hex(lerpHue(o.params.color));
        for (let i = 0; i < n; i++) { const a = r() * TAU, sp = g.R * (0.6 + r()); const tp = clamp01(p - r() * 0.1); if (tp <= 0) continue; const x = g.cx + Math.cos(a) * sp * tp, y = g.cy + Math.sin(a) * sp * tp * 0.7 - g.R * 0.4 * tp; ctx.globalAlpha = 0.7 * (1 - tp); ctx.beginPath(); ctx.ellipse(x, y, 3, 1.6, a, 0, TAU); ctx.fill(); } ctx.restore();
      },
    },
    "cleave-flash": {
      label: "Cleave flash", trigger: "hit",
      params: [P("intensity", "Intensity", 0, 1, 0.8)],
      draw(ctx, g, p, o) { const a = burst(p, 0.3, 0.12) * o.params.intensity; if (a <= 0) return; ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = "#f6ffff"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(g.cx - g.R, g.cy + g.R * 0.4); ctx.lineTo(g.cx + g.R, g.cy - g.R * 0.4); ctx.stroke(); ctx.restore(); },
    },
    "saw-sparks": {
      label: "Saw sparks (sustained)", trigger: "channel",
      params: [P("count", "Sparks", 6, 30, 16, 1), P("color", "Hue", 0, 1, 0.12)],
      draw(ctx, g, p, o) { const r = mulberry(o.seed + ((p * 30) | 0) + 66), n = o.params.count | 0, col = hex(lerpHue(o.params.color)), mx = g.cx + g.R * 0.6; ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.strokeStyle = col; ctx.lineWidth = 1.5; for (let i = 0; i < n; i++) { const ang = (r() - 0.5) * 1.6, d = g.R * (0.2 + r() * 0.6); ctx.globalAlpha = 0.5 + r() * 0.5; ctx.beginPath(); ctx.moveTo(mx, g.cy); ctx.lineTo(mx + Math.cos(ang) * d, g.cy + Math.sin(ang) * d); ctx.stroke(); } ctx.restore(); },
    },
    "hit-spark": {
      label: "Hit sparks", trigger: "hit",
      params: [P("count", "Sparks", 4, 24, 12, 1), P("color", "Hue", 0, 1, 0.12)],
      draw(ctx, g, p, o) { const a = burst(p, 0.3, 0.16); if (a <= 0) return; const r = mulberry(o.seed + 5), n = o.params.count | 0; ctx.save(); ctx.strokeStyle = hex(lerpHue(o.params.color)); ctx.lineWidth = 2; for (let i = 0; i < n; i++) { const ang = r() * TAU, d = g.R * (0.3 + r() * 0.7) * a; ctx.globalAlpha = a; ctx.beginPath(); ctx.moveTo(g.cx + Math.cos(ang) * g.R * 0.1, g.cy + Math.sin(ang) * g.R * 0.1); ctx.lineTo(g.cx + Math.cos(ang) * d, g.cy + Math.sin(ang) * d); ctx.stroke(); } ctx.restore(); },
    },
    "blood-mist": {
      label: "Blood mist", trigger: "hit",
      params: [P("amount", "Amount", 0, 1, 0.7)],
      draw(ctx, g, p, o) { const a = burst(p, 0.32, 0.2) * o.params.amount; if (a <= 0) return; const r = mulberry(o.seed + 7); ctx.save(); ctx.fillStyle = "#b21f1f"; for (let i = 0; i < 22; i++) { const ang = -0.6 + r() * 1.2, d = g.R * (0.2 + r() * 0.8) * (0.4 + a); ctx.globalAlpha = a * 0.5 * r(); ctx.beginPath(); ctx.arc(g.cx + Math.cos(ang) * d, g.cy + Math.sin(ang) * d, 1 + r() * 2.5, 0, TAU); ctx.fill(); } ctx.restore(); },
    },
    // ---- ranged: guns ----
    "muzzle-flash": {
      label: "Muzzle flash", trigger: "fire",
      params: [P("size", "Size", 0.4, 1.8, 1), P("color", "Hue", 0, 1, 0.12)],
      draw(ctx, g, p, o) {
        const a = burst(p, 0.16, 0.1); if (a <= 0) return;
        const mx = g.cx + g.R * 0.95, my = g.cy, s = g.R * 0.55 * o.params.size, col = hex(lerpHue(o.params.color));
        ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.globalAlpha = a;
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(mx, my - s * 0.42); ctx.lineTo(mx + s * 1.7, my); ctx.lineTo(mx, my + s * 0.42); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { const ang = (i / 6) * TAU; ctx.globalAlpha = a * 0.8; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(ang) * s * 0.9, my + Math.sin(ang) * s * 0.9); ctx.stroke(); }
        ctx.globalAlpha = a; ctx.fillStyle = "#fff7e6"; ctx.beginPath(); ctx.arc(mx, my, s * 0.3, 0, TAU); ctx.fill(); ctx.restore();
      },
    },
    "tracer": {
      label: "Bullet tracer", trigger: "fire",
      params: [P("count", "Rounds", 1, 8, 3, 1), P("color", "Hue", 0, 1, 0.12)],
      draw(ctx, g, p, o) {
        const col = hex(lerpHue(o.params.color)), n = o.params.count | 0, mx = g.cx + g.R * 0.95;
        ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.strokeStyle = col; ctx.lineCap = "round"; ctx.lineWidth = 2;
        for (let i = 0; i < n; i++) { const tp = clamp01((p - 0.16 - i * 0.05) / 0.4); if (tp <= 0 || tp >= 1) continue; const x = mx + tp * g.R * 1.4, y = g.cy + (i - (n - 1) / 2) * 4; ctx.globalAlpha = 0.85 * (1 - tp); ctx.beginPath(); ctx.moveTo(x - g.R * 0.32, y); ctx.lineTo(x, y); ctx.stroke(); } ctx.restore();
      },
    },
    "pellet-spread": {
      label: "Pellet spread", trigger: "fire",
      params: [P("count", "Pellets", 4, 16, 9, 1), P("spread", "Spread", 0.1, 0.8, 0.4)],
      draw(ctx, g, p, o) {
        const tp = clamp01((p - 0.16) / 0.45); if (tp <= 0) return;
        const r = mulberry(o.seed + 21), n = o.params.count | 0, mx = g.cx + g.R * 0.9;
        ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.fillStyle = "#ffd9a0";
        for (let i = 0; i < n; i++) { const ang = (r() - 0.5) * o.params.spread * 2, d = g.R * (0.4 + r() * 1.1) * tp; ctx.globalAlpha = 0.8 * (1 - tp); ctx.beginPath(); ctx.arc(mx + Math.cos(ang) * d, g.cy + Math.sin(ang) * d, 2 + r() * 1.5, 0, TAU); ctx.fill(); } ctx.restore();
      },
    },
    "shell-eject": {
      label: "Shell eject", trigger: "fire",
      params: [P("count", "Shells", 1, 5, 2, 1)],
      draw(ctx, g, p, o) {
        const r = mulberry(o.seed + 33), n = o.params.count | 0; ctx.save(); ctx.fillStyle = "#c9a24a";
        for (let i = 0; i < n; i++) { const tp = Math.max(0, p - 0.18 - i * 0.08); if (tp <= 0 || tp > 0.6) continue; const x = g.cx - g.R * 0.2 + tp * g.R * 0.8, y = g.cy - g.R * 0.8 * tp + g.R * 2.4 * tp * tp; ctx.globalAlpha = Math.max(0, 1 - tp / 0.6); ctx.save(); ctx.translate(x, y); ctx.rotate(tp * 8); ctx.fillRect(-2, -1.2, 4, 2.4); ctx.restore(); } ctx.restore();
      },
    },
    "barrel-spin": {
      label: "Barrel spin-up", trigger: "charge",
      params: [P("color", "Hue", 0, 1, 0.08)],
      draw(ctx, g, p, o) {
        const a = clamp01(p / 0.16) * (1 - clamp01((p - 0.16) / 0.22)); if (a <= 0) return;
        const mx = g.cx + g.R * 0.4, col = hex(lerpHue(o.params.color));
        ctx.save(); ctx.globalAlpha = a * 0.5; ctx.strokeStyle = col; ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) { const a0 = p * 42 + i * TAU / 3; ctx.beginPath(); ctx.arc(mx, g.cy, g.R * 0.4, a0, a0 + 1.5); ctx.stroke(); } ctx.restore();
      },
    },
    // ---- launchers: lobbed explosives ----
    "lob-arc": {
      label: "Lob arc (projectile)", trigger: "flight",
      params: [P("height", "Arc height", 0.4, 1.6, 1), P("color", "Hue", 0, 1, 0.1)],
      draw(ctx, g, p, o) {
        const x0 = g.cx - g.R * 0.8, x1 = g.cx + g.R * 1.2, h = g.R * 1.3 * o.params.height, col = hex(lerpHue(o.params.color));
        ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = col;
        for (let t = 0; t <= 1; t += 0.08) { const x = x0 + (x1 - x0) * t, y = g.cy - Math.sin(t * Math.PI) * h; ctx.beginPath(); ctx.arc(x, y, 1.5, 0, TAU); ctx.fill(); }
        const tp = clamp01(p / 0.5); const x = x0 + (x1 - x0) * tp, y = g.cy - Math.sin(tp * Math.PI) * h; ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill(); ctx.restore();
      },
    },
    "fire-burst": {
      label: "Fire burst (explosion)", trigger: "blast",
      params: [P("size", "Size", 0.5, 1.6, 1), P("color", "Hue", 0, 1, 0.06)],
      draw(ctx, g, p, o) {
        const a = burst(p, 0.55, 0.3); if (a <= 0) return;
        const sc = clamp01((p - 0.5) / 0.3), col = hex(lerpHue(o.params.color)), rad = g.R * 1.5 * o.params.size * (0.4 + sc);
        const grd = ctx.createRadialGradient(g.cx, g.cy, 2, g.cx, g.cy, rad); grd.addColorStop(0, "#fff2c0"); grd.addColorStop(0.4, col); grd.addColorStop(1, "rgba(0,0,0,0)");
        ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.globalAlpha = a; ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(g.cx, g.cy, rad, 0, TAU); ctx.fill(); ctx.restore();
      },
    },
    // ---- caster: staffs ----
    "charge-glow": {
      label: "Charge glow", trigger: "charge",
      params: [P("size", "Size", 0.3, 1.2, 0.7), P("color", "Hue", 0, 1, 0.6)],
      draw(ctx, g, p, o) {
        const a = clamp01(p / 0.28) * (1 - clamp01((p - 0.3) / 0.15)); if (a <= 0) return;
        const mx = g.cx + g.R * 0.9, pulse = 0.82 + 0.18 * Math.sin(p * 40), s = g.R * 0.5 * o.params.size * pulse, col = hex(lerpHue(o.params.color));
        const grd = ctx.createRadialGradient(mx, g.cy, 1, mx, g.cy, s); grd.addColorStop(0, "#ffffff"); grd.addColorStop(0.5, col); grd.addColorStop(1, "rgba(0,0,0,0)");
        ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.globalAlpha = a; ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(mx, g.cy, s, 0, TAU); ctx.fill(); ctx.restore();
      },
    },
    "beam": {
      label: "Beam", trigger: "channel",
      params: [P("width", "Width", 2, 16, 7, 1), P("color", "Hue", 0, 1, 0.5)],
      draw(ctx, g, p, o) {
        const a = clamp01((p - 0.3) / 0.1) * (1 - clamp01((p - 0.7) / 0.15)); if (a <= 0) return;
        const mx = g.cx + g.R * 0.9, col = hex(lerpHue(o.params.color));
        ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.globalAlpha = a; ctx.lineCap = "round";
        ctx.strokeStyle = col; ctx.lineWidth = o.params.width; ctx.beginPath(); ctx.moveTo(mx, g.cy); ctx.lineTo(g.cx + g.R * 2, g.cy); ctx.stroke();
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = o.params.width * 0.4; ctx.stroke(); ctx.restore();
      },
    },
    "arc-bolt": {
      label: "Lightning bolt", trigger: "cast",
      params: [P("color", "Hue", 0, 1, 0.72), P("jag", "Jag", 0.1, 0.6, 0.3)],
      draw(ctx, g, p, o) {
        const a = burst(p, 0.4, 0.12); if (a <= 0) return;
        const r = mulberry(o.seed + ((p * 6) | 0) + 41), mx = g.cx + g.R * 0.85, tx = g.cx + g.R * 1.9, col = hex(lerpHue(o.params.color));
        ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.lineJoin = "round";
        ctx.beginPath(); ctx.moveTo(mx, g.cy); let x = mx; while (x < tx) { x += g.R * 0.18; ctx.lineTo(x, g.cy + (r() - 0.5) * g.R * o.params.jag * 2); } ctx.stroke();
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
      },
    },
    "sigil-ring": {
      label: "Sigil ring (rune)", trigger: "cast",
      params: [P("color", "Hue", 0, 1, 0.62), P("size", "Size", 0.5, 1.4, 1)],
      draw(ctx, g, p, o) {
        const a = burst(p, 0.4, 0.35); if (a <= 0) return;
        const rr = g.R * 0.9 * o.params.size, col = hex(lerpHue(o.params.color));
        ctx.save(); ctx.translate(g.cx, g.cy); ctx.rotate(p * 3); ctx.globalAlpha = a * 0.85; ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, rr * 0.7, 0, TAU); ctx.stroke();
        for (let i = 0; i < 6; i++) { const ang = (i / 6) * TAU, cx = Math.cos(ang), sy = Math.sin(ang); ctx.beginPath(); ctx.moveTo(cx * rr * 0.7, sy * rr * 0.7); ctx.lineTo(cx * rr, sy * rr); ctx.stroke(); ctx.beginPath(); ctx.arc(cx * rr, sy * rr, rr * 0.08, 0, TAU); ctx.stroke(); } ctx.restore();
      },
    },
    "aura-pulse": {
      label: "Aura pulse (buff)", trigger: "aura",
      params: [P("color", "Hue", 0, 1, 0.3), P("rings", "Rings", 1, 4, 2, 1)],
      draw(ctx, g, p, o) {
        const col = hex(lerpHue(o.params.color)), n = o.params.rings | 0;
        ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.strokeStyle = col; ctx.lineWidth = 3;
        for (let i = 0; i < n; i++) { const tp = clamp01((p - i * 0.12) / 0.6); if (tp <= 0) continue; ctx.globalAlpha = 0.6 * (1 - tp); ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R * 0.3 + tp * g.R * 1.2, 0, TAU); ctx.stroke(); } ctx.restore();
      },
    },
    "ember-rain": {
      label: "Ember rain", trigger: "cast",
      params: [P("count", "Embers", 6, 30, 16, 1), P("color", "Hue", 0, 1, 0.08)],
      draw(ctx, g, p, o) {
        const r = mulberry(o.seed + 55), n = o.params.count | 0, col = hex(lerpHue(o.params.color));
        ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.fillStyle = col;
        for (let i = 0; i < n; i++) { const ox = (r() - 0.5) * g.R * 2.4, delay = r() * 0.5, tp = clamp01(p - delay); if (tp <= 0) continue; const x = g.cx + ox + Math.sin((p + i) * 4) * 4, y = g.cy - g.R + tp * g.R * 2; ctx.globalAlpha = 0.8 * (1 - tp) * (0.5 + r() * 0.5); ctx.beginPath(); ctx.arc(x, y, 1 + r() * 2, 0, TAU); ctx.fill(); } ctx.restore();
      },
    },
    // ---- ground / area (shared by slams + launchers) ----
    "spin-trail": {
      label: "Spin trail (projectile)", trigger: "flight",
      params: [P("color", "Hue", 0, 1, 0.1)],
      draw(ctx, g, p, o) { const col = hex(lerpHue(o.params.color)); ctx.save(); for (let i = 0; i < 5; i++) { const tp = clamp01(p - i * 0.04); const x = g.cx - g.R + tp * g.R * 2; ctx.globalAlpha = 0.25 * (1 - i / 5); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, g.cy, 12, 0, TAU); ctx.stroke(); } ctx.restore(); },
    },
    "throw-dust": {
      label: "Throw dust", trigger: "throw",
      params: [P("amount", "Amount", 0, 1, 0.6)],
      draw(ctx, g, p, o) { const a = burst(p, 0.08, 0.14) * o.params.amount; if (a <= 0) return; ctx.save(); ctx.globalAlpha = a * 0.4; ctx.fillStyle = "#8c8576"; ctx.beginPath(); ctx.ellipse(g.cx - g.R * 0.7, g.cy, g.R * 0.5 * (0.5 + a), g.R * 0.3, 0, 0, TAU); ctx.fill(); ctx.restore(); },
    },
    "dust-cloud": {
      label: "Dust cloud", trigger: "slam",
      params: [P("amount", "Amount", 0, 1, 0.8)],
      draw(ctx, g, p, o) { const a = burst(p, 0.36, 0.4) * o.params.amount; if (a <= 0) return; ctx.save(); ctx.globalAlpha = 0.34 * a; ctx.fillStyle = "#6e7042"; ctx.beginPath(); ctx.ellipse(g.cx, g.cy, g.R * 1.6 * (0.5 + a), g.R * 0.9 * (0.5 + a), 0, 0, TAU); ctx.fill(); ctx.restore(); },
    },
    "debris": {
      label: "Flung debris", trigger: "slam",
      params: [P("count", "Count", 4, 40, 18, 1)],
      draw(ctx, g, p, o) { if (p > 0.7) return; const r = mulberry(o.seed + 3), n = o.params.count | 0; ctx.save(); for (let i = 0; i < n; i++) { const ang = r() * TAU, sp = g.R * (1.4 + r() * 1.4), tp = Math.max(0, p - r() * 0.06); if (tp <= 0) continue; const x = g.cx + Math.cos(ang) * sp * tp, y = g.cy + Math.sin(ang) * sp * tp * 0.6 - g.R * 1.5 * tp + g.R * 3.2 * tp * tp, s = 3 + r() * 4; ctx.globalAlpha = Math.max(0, 1 - tp / 0.7); ctx.fillStyle = r() < 0.5 ? "#4a5159" : "#2b3037"; ctx.fillRect(x - s / 2, y - s / 2, s, s * 0.8); } ctx.restore(); },
    },
    "shockwave-ring": {
      label: "Shockwave ring", trigger: "slam",
      params: [P("color", "Hue", 0, 1, 0.1)],
      draw(ctx, g, p, o) { const a = burst(p, 0.34, 0.4); if (a <= 0) return; const sc = clamp01((p - 0.2) / 0.4); ctx.save(); ctx.globalAlpha = (1 - sc) * 0.9; ctx.strokeStyle = hex(lerpHue(o.params.color)); ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(g.cx, g.cy, g.R * (0.3 + sc * 1.4), g.R * (0.3 + sc * 1.4) * 0.55, 0, 0, TAU); ctx.stroke(); ctx.restore(); },
    },
    "impact-flash": {
      label: "Impact flash", trigger: "impact",
      params: [P("intensity", "Intensity", 0, 1, 0.4)],
      draw(ctx, g, p, o) { const a = burst(p, 0.3, 0.16) * o.params.intensity; if (a <= 0) return; const grd = ctx.createRadialGradient(g.cx, g.cy, 2, g.cx, g.cy, g.R * 1.4); grd.addColorStop(0, "#ffcaa0"); grd.addColorStop(1, "rgba(255,200,160,0)"); ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.globalAlpha = a; ctx.fillStyle = grd; ctx.beginPath(); ctx.ellipse(g.cx, g.cy, g.R * 1.4, g.R * 0.8, 0, 0, TAU); ctx.fill(); ctx.restore(); },
    },
  };

  function lerpHue(h) {
    // 0=red,0.1=orange,0.3=yellow-green,0.5=cyan,0.6=green,0.75=blue,0.85=purple,1=red — quick warm→cool ramp
    const stops = [0xff4d3a, 0xff8a2b, 0xd6ff5a, 0x6fd6ff, 0x9cff3b, 0x6f8bff, 0xb07bd6, 0xff4d3a];
    const i = Math.min(stops.length - 2, Math.floor(h * (stops.length - 1)));
    return stops[i];
  }

  // Draw order: ground/area → flight/projectile → swing/beam/cast → motes/hit/spark → hero on top.
  const ORDER = [
    "throw-dust", "dust-cloud", "fire-burst", "shockwave-ring", "aura-pulse", "debris", "ember-rain",
    "lob-arc", "spin-trail", "tracer", "pellet-spread", "shell-eject", "barrel-spin",
    "edge-trail", "blade-trail", "slash-arc", "twin-slash", "thrust-streak", "beam", "arc-bolt", "sigil-ring",
    "drift-petals", "saw-sparks", "hit-spark", "blood-mist", "charge-glow", "muzzle-flash", "cleave-flash", "impact-flash",
    "hero-skin",
  ];

  // ---- per-weapon PRESETS (my tailored recommendation; user toggles + tunes) ----------------
  // Each: { subject, layers: { <id>: {on, params} } }. `subject` = the art subject feeding the hero
  // candidates (a bespoke vfx-* skin for the first four; the weapon's own sprite for the rest).
  // params override the layer default. Hues: 0.06 fire · 0.1 orange/dust · 0.3 bone · 0.5 cyan/teal ·
  // 0.6 green · 0.72 blue/electric · 0.85 purple/necro.
  const PRESETS = {
    // ===== Wild West roster (subjects.json) =====
    "rusty-cleaver": {
      subject: "vfx-cleave-cleaver",
      layers: {
        "spin-trail": { on: true, params: { color: 0.1 } },
        "throw-dust": { on: true, params: { amount: 0.6 } },
        "hero-skin": { on: true, params: { size: 0.9, rise: 0 } },
        "hit-spark": { on: true, params: { count: 10, color: 0.1 } },
      },
    },
    "coffin-lid": {
      subject: "coffin-lid",
      layers: {
        "dust-cloud": { on: true, params: { amount: 0.7 } },
        "shockwave-ring": { on: true, params: { color: 0.08 } },
        "debris": { on: true, params: { count: 14 } },
        "impact-flash": { on: true, params: { intensity: 0.2 } },
        "hero-skin": { on: true, params: { size: 1, rise: 0 } },
      },
    },
    "lasso-chain": {
      subject: "lasso-chain",
      layers: {
        "edge-trail": { on: true, params: { reach: 1.4, color: 0.08, len: 1.4 } },
        "thrust-streak": { on: true, params: { reach: 1.5, color: 0.1 } },
        "throw-dust": { on: true, params: { amount: 0.5 } },
        "hit-spark": { on: true, params: { count: 8, color: 0.1 } },
        "hero-skin": { on: true, params: { size: 1, rise: 0 } },
      },
    },
    "rattler-sabre": {
      subject: "rattler-sabre",
      layers: {
        "blade-trail": { on: true, params: { reach: 1.2, color: 0.5, sweep: 1.5, thick: 0.15, lines: 4 } },
        "drift-petals": { on: true, params: { count: 7, color: 0.55 } },
        "hit-spark": { on: true, params: { count: 8, color: 0.5 } },
        "hero-skin": { on: true, params: { size: 1, rise: 0 } },
      },
    },
    "prospectors-pickaxe": {
      subject: "prospectors-pickaxe",
      layers: {
        "hit-spark": { on: true, params: { count: 14, color: 0.1 } },
        "debris": { on: true, params: { count: 10 } },
        "impact-flash": { on: true, params: { intensity: 0.3 } },
        "shockwave-ring": { on: true, params: { color: 0.1 } },
        "hero-skin": { on: true, params: { size: 1, rise: 0 } },
      },
    },
    "dynamite-bat": {
      subject: "dynamite-bat",
      layers: {
        "fire-burst": { on: true, params: { size: 1, color: 0.06 } },
        "shockwave-ring": { on: true, params: { color: 0.06 } },
        "dust-cloud": { on: true, params: { amount: 0.6 } },
        "impact-flash": { on: true, params: { intensity: 0.4 } },
        "hero-skin": { on: true, params: { size: 1, rise: 0 } },
      },
    },
    "branding-iron": {
      subject: "branding-iron",
      layers: {
        "charge-glow": { on: true, params: { size: 0.7, color: 0.08 } },
        "thrust-streak": { on: true, params: { reach: 1.2, color: 0.06 } },
        "ember-rain": { on: true, params: { count: 10, color: 0.06 } },
        "impact-flash": { on: true, params: { intensity: 0.3 } },
        "hero-skin": { on: true, params: { size: 1, rise: 0 } },
      },
    },
    "twin-bowie-fangs": {
      subject: "vfx-twinslash-bowie",
      layers: {
        "twin-slash": { on: true, params: { reach: 0.95, color: 0.5 } },
        "edge-trail": { on: true, params: { reach: 1, color: 0.5, len: 0.9 } },
        "hero-skin": { on: true, params: { size: 1, rise: 0 } },
        "blood-mist": { on: true, params: { amount: 0.7 } },
        "hit-spark": { on: true, params: { count: 8, color: 0.5 } },
      },
    },
    "tombstone-greatsword": {
      subject: "vfx-quake-tombstone",
      layers: {
        "hero-skin": { on: true, params: { size: 1.2, rise: 1 } },
        "dust-cloud": { on: true, params: { amount: 1 } },
        "debris": { on: true, params: { count: 28 } },
        "shockwave-ring": { on: true, params: { color: 0.1 } },
        "impact-flash": { on: true, params: { intensity: 0.15 } },
      },
    },
    "gravediggers-spade": {
      subject: "gravediggers-spade",
      layers: {
        "aura-pulse": { on: true, params: { color: 0.52, rings: 2 } },
        "drift-petals": { on: true, params: { count: 9, color: 0.55 } },
        "dust-cloud": { on: true, params: { amount: 0.6 } },
        "shockwave-ring": { on: true, params: { color: 0.5 } },
        "hero-skin": { on: true, params: { size: 1, rise: 0 } },
      },
    },
    driftblade: {
      subject: "vfx-slash-driftblade",
      layers: {
        "blade-trail": { on: true, params: { reach: 1.35, color: 0.52, sweep: 1.9, thick: 0.13, lines: 6 } },
        "hero-skin": { on: true, params: { size: 1.1, rise: 0 } },
        "drift-petals": { on: true, params: { count: 9, color: 0.55 } },
        "cleave-flash": { on: true, params: { intensity: 0.7 } },
      },
    },

    // ===== Swords (subjects.explore.json) =====
    "x-sword-buzzsaw": {
      subject: "x-sword-buzzsaw",
      layers: {
        "saw-sparks": { on: true, params: { count: 18, color: 0.12 } },
        "edge-trail": { on: true, params: { reach: 1.1, color: 0.12, len: 0.8 } },
        "hit-spark": { on: true, params: { count: 14, color: 0.1 } },
        "hero-skin": { on: true, params: { size: 1.1, rise: 0 } },
      },
    },
    "x-sword-coffin": {
      subject: "x-sword-coffin",
      layers: {
        "slash-arc": { on: true, params: { reach: 1.1, width: 7, color: 0.1 } },
        "cleave-flash": { on: true, params: { intensity: 0.8 } },
        "dust-cloud": { on: true, params: { amount: 0.6 } },
        "shockwave-ring": { on: true, params: { color: 0.85 } },
        "hero-skin": { on: true, params: { size: 1.15, rise: 0 } },
      },
    },
    "x-sword-neon-katana": {
      subject: "x-sword-neon-katana",
      layers: {
        "blade-trail": { on: true, params: { reach: 1.2, color: 0.5, sweep: 1.7, thick: 0.12, lines: 6 } },
        "arc-bolt": { on: true, params: { color: 0.55, jag: 0.25 } },
        "cleave-flash": { on: true, params: { intensity: 0.6 } },
        "hero-skin": { on: true, params: { size: 1, rise: 0 } },
      },
    },
    "x-sword-anchor": {
      subject: "x-sword-anchor",
      layers: {
        "slash-arc": { on: true, params: { reach: 1, width: 8, color: 0.1 } },
        "shockwave-ring": { on: true, params: { color: 0.5 } },
        "dust-cloud": { on: true, params: { amount: 0.7 } },
        "debris": { on: true, params: { count: 12 } },
        "hero-skin": { on: true, params: { size: 1.15, rise: 0 } },
      },
    },
    "x-sword-bone": {
      subject: "x-sword-bone",
      layers: {
        "blade-trail": { on: true, params: { reach: 1.1, color: 0.3, sweep: 1.5, thick: 0.2, lines: 3 } },
        "drift-petals": { on: true, params: { count: 7, color: 0.3 } },
        "cleave-flash": { on: true, params: { intensity: 0.7 } },
        "hero-skin": { on: true, params: { size: 1.1, rise: 0 } },
      },
    },
    "x-sword-railspike": {
      subject: "x-sword-railspike",
      layers: {
        "slash-arc": { on: true, params: { reach: 1, width: 7, color: 0.1 } },
        "hit-spark": { on: true, params: { count: 14, color: 0.1 } },
        "shockwave-ring": { on: true, params: { color: 0.1 } },
        "impact-flash": { on: true, params: { intensity: 0.3 } },
        "hero-skin": { on: true, params: { size: 1.1, rise: 0 } },
      },
    },

    // ===== Guns (subjects.explore.json) =====
    "x-gun-revolver-cannon": {
      subject: "x-gun-revolver-cannon",
      layers: {
        "muzzle-flash": { on: true, params: { size: 1.4, color: 0.1 } },
        "tracer": { on: true, params: { count: 1, color: 0.1 } },
        "shell-eject": { on: true, params: { count: 1 } },
        "impact-flash": { on: true, params: { intensity: 0.3 } },
        "hero-skin": { on: true, params: { size: 1, rise: 0 } },
      },
    },
    "x-gun-coffin-shotgun": {
      subject: "x-gun-coffin-shotgun",
      layers: {
        "muzzle-flash": { on: true, params: { size: 1.2, color: 0.1 } },
        "pellet-spread": { on: true, params: { count: 11, spread: 0.5 } },
        "shell-eject": { on: true, params: { count: 2 } },
        "impact-flash": { on: true, params: { intensity: 0.2 } },
        "hero-skin": { on: true, params: { size: 1, rise: 0 } },
      },
    },
    "x-gun-gatling": {
      subject: "x-gun-gatling",
      layers: {
        "barrel-spin": { on: true, params: { color: 0.08 } },
        "muzzle-flash": { on: true, params: { size: 0.8, color: 0.1 } },
        "tracer": { on: true, params: { count: 6, color: 0.12 } },
        "shell-eject": { on: true, params: { count: 4 } },
        "hero-skin": { on: true, params: { size: 1.05, rise: 0 } },
      },
    },
    "x-gun-nailgun": {
      subject: "x-gun-nailgun",
      layers: {
        "muzzle-flash": { on: true, params: { size: 0.5, color: 0.12 } },
        "tracer": { on: true, params: { count: 4, color: 0.12 } },
        "hit-spark": { on: true, params: { count: 6, color: 0.12 } },
        "hero-skin": { on: true, params: { size: 1, rise: 0 } },
      },
    },
    "x-gun-ricochet-pistol": {
      subject: "x-gun-ricochet-pistol",
      layers: {
        "muzzle-flash": { on: true, params: { size: 0.9, color: 0.5 } },
        "tracer": { on: true, params: { count: 2, color: 0.5 } },
        "hit-spark": { on: true, params: { count: 8, color: 0.5 } },
        "shell-eject": { on: true, params: { count: 1 } },
        "hero-skin": { on: true, params: { size: 1, rise: 0 } },
      },
    },

    // ===== Launchers (subjects.explore.json) =====
    "x-launcher-dynamite": {
      subject: "x-launcher-dynamite",
      layers: {
        "lob-arc": { on: true, params: { height: 1, color: 0.06 } },
        "fire-burst": { on: true, params: { size: 1.1, color: 0.06 } },
        "shockwave-ring": { on: true, params: { color: 0.06 } },
        "debris": { on: true, params: { count: 14 } },
        "hero-skin": { on: true, params: { size: 1, rise: 0 } },
      },
    },
    "x-launcher-coffin-mortar": {
      subject: "x-launcher-coffin-mortar",
      layers: {
        "lob-arc": { on: true, params: { height: 1.5, color: 0.08 } },
        "fire-burst": { on: true, params: { size: 1, color: 0.08 } },
        "dust-cloud": { on: true, params: { amount: 0.7 } },
        "shockwave-ring": { on: true, params: { color: 0.08 } },
        "hero-skin": { on: true, params: { size: 1, rise: 0 } },
      },
    },
    "x-launcher-firework": {
      subject: "x-launcher-firework",
      layers: {
        "lob-arc": { on: true, params: { height: 1.1, color: 0.75 } },
        "fire-burst": { on: true, params: { size: 1.1, color: 0.85 } },
        "ember-rain": { on: true, params: { count: 20, color: 0.75 } },
        "muzzle-flash": { on: true, params: { size: 0.8, color: 0.62 } },
        "hero-skin": { on: true, params: { size: 1, rise: 0 } },
      },
    },

    // ===== Staffs (subjects.explore.json) =====
    "x-staff-skull-totem": {
      subject: "x-staff-skull-totem",
      layers: {
        "sigil-ring": { on: true, params: { color: 0.85, size: 1 } },
        "aura-pulse": { on: true, params: { color: 0.85, rings: 2 } },
        "charge-glow": { on: true, params: { size: 0.7, color: 0.85 } },
        "ember-rain": { on: true, params: { count: 12, color: 0.85 } },
        "hero-skin": { on: true, params: { size: 1, rise: 0 } },
      },
    },
    "x-staff-cactus-bloom": {
      subject: "x-staff-cactus-bloom",
      layers: {
        "charge-glow": { on: true, params: { size: 0.7, color: 0.6 } },
        "aura-pulse": { on: true, params: { color: 0.6, rings: 2 } },
        "drift-petals": { on: true, params: { count: 12, color: 0.6 } },
        "sigil-ring": { on: true, params: { color: 0.6, size: 0.9 } },
        "hero-skin": { on: true, params: { size: 1, rise: 0 } },
      },
    },
    "x-staff-lightning-rod": {
      subject: "x-staff-lightning-rod",
      layers: {
        "charge-glow": { on: true, params: { size: 0.7, color: 0.72 } },
        "arc-bolt": { on: true, params: { color: 0.72, jag: 0.35 } },
        "sigil-ring": { on: true, params: { color: 0.72, size: 0.9 } },
        "aura-pulse": { on: true, params: { color: 0.72, rings: 1 } },
        "hero-skin": { on: true, params: { size: 1, rise: 0 } },
      },
    },
    "x-staff-sun-disc": {
      subject: "x-staff-sun-disc",
      layers: {
        "charge-glow": { on: true, params: { size: 0.9, color: 0.1 } },
        "beam": { on: true, params: { width: 8, color: 0.1 } },
        "ember-rain": { on: true, params: { count: 16, color: 0.08 } },
        "sigil-ring": { on: true, params: { color: 0.1, size: 1 } },
        "hero-skin": { on: true, params: { size: 1, rise: 0 } },
      },
    },
    "x-staff-lantern": {
      subject: "x-staff-lantern",
      layers: {
        "charge-glow": { on: true, params: { size: 0.6, color: 0.55 } },
        "drift-petals": { on: true, params: { count: 10, color: 0.55 } },
        "aura-pulse": { on: true, params: { color: 0.5, rings: 2 } },
        "sigil-ring": { on: true, params: { color: 0.5, size: 0.8 } },
        "hero-skin": { on: true, params: { size: 1, rise: 0 } },
      },
    },
  };

  window.VFXLAYERS = { LAYERS, ORDER, PRESETS, CYCLE: 2.0 };
})();
