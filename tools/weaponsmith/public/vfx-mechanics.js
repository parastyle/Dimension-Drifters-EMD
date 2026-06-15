// VFX mechanic registry — the reusable "how it works" layer (§14: ~40 mechanics × art skins).
// Each mechanic declares: id, label, needsHero (does it composite a Codex image?), a params
// schema (auto-rendered as sliders in the editor), and draw(ctx, g, p, opts). The Codex art is
// the HERO layer; engine-native amorphous bits (flash/dust/debris/shake) composite on top.
//   g = {cx,cy,R}   p = cycle phase 0..1   opts = {hero, params, seed}
(() => {
  const TAU = Math.PI * 2;
  const PAL = {
    base: "#4a5159",
    light: "#79838f",
    dark: "#2b3037",
    edge: "#13161a",
    crack: "#0c0e12",
    dust: "#9a917c",
    flash: "#ffcaa0",
  };
  const mulberry = (a) => () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const easeOutBack = (u) => {
    const c1 = 1.70158,
      c3 = c1 + 1;
    return 1 + c3 * (u - 1) ** 3 + c1 * (u - 1) ** 2;
  };
  function amp(p) {
    if (p < 0.1) return Math.max(0, easeOutBack(p / 0.1));
    if (p < 0.6) return 1;
    if (p < 0.86) {
      const u = (p - 0.6) / 0.26;
      return 1 - u * u;
    }
    return 0;
  }
  function shakeEnv(p) {
    return p < 0.13 ? 1 - p / 0.13 : 0;
  }

  function shard(ctx, len, wid, vary) {
    const t = wid / 2;
    ctx.beginPath();
    ctx.moveTo(-t, 0);
    ctx.lineTo(-t * 0.62, -len * (0.96 + vary * 0.06));
    ctx.lineTo(t * 0.58, -len);
    ctx.lineTo(t, 0);
    ctx.closePath();
    ctx.fillStyle = PAL.base;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-t * 0.62, -len * 0.96);
    ctx.lineTo(t * 0.58, -len);
    ctx.lineTo(t * 0.12, -len * 0.5);
    ctx.lineTo(-t * 0.2, -len * 0.55);
    ctx.closePath();
    ctx.fillStyle = PAL.light;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(t, 0);
    ctx.lineTo(t * 0.58, -len);
    ctx.lineTo(t * 0.12, -len * 0.5);
    ctx.lineTo(t * 0.3, 0);
    ctx.closePath();
    ctx.fillStyle = PAL.dark;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-t, 0);
    ctx.lineTo(-t * 0.62, -len * 0.96);
    ctx.lineTo(t * 0.58, -len);
    ctx.lineTo(t, 0);
    ctx.closePath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = PAL.edge;
    ctx.stroke();
  }
  function cracks(ctx, cx, cy, R, a, seed) {
    const r = mulberry(seed);
    ctx.strokeStyle = PAL.crack;
    ctx.lineWidth = 2.4;
    const n = 5;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU + r() * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      let x = cx,
        y = cy;
      for (let s = 0; s < 3; s++) {
        const rr = (R * a * (s + 1)) / 3;
        x = cx + Math.cos(ang) * rr + (r() - 0.5) * 6;
        y = cy + Math.sin(ang) * rr * 0.5 + (r() - 0.5) * 4;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  function dustRing(ctx, cx, cy, R, a, p, amount) {
    if (a <= 0 || amount <= 0) return;
    ctx.save();
    ctx.globalAlpha = 0.32 * amount * (1 - p * 0.4) * a;
    ctx.fillStyle = PAL.dust;
    ctx.beginPath();
    ctx.ellipse(cx, cy, R * 0.9 * (0.5 + a), R * 0.45 * (0.5 + a), 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  function debris(ctx, g, p, count, seed) {
    const r = mulberry(seed);
    for (let i = 0; i < count; i++) {
      const ang = r() * TAU;
      const spd = g.R * (1.4 + r() * 1.4);
      const tp = Math.max(0, p - r() * 0.05);
      if (tp <= 0 || p > 0.8) continue;
      const x = g.cx + Math.cos(ang) * spd * tp;
      const y = g.cy + Math.sin(ang) * spd * tp * 0.6 - g.R * 1.5 * tp + g.R * 3.2 * tp * tp;
      const sz = 3 + r() * 5;
      const al = Math.max(0, 1 - tp / 0.7);
      ctx.save();
      ctx.globalAlpha = al;
      ctx.translate(x, y);
      ctx.rotate(tp * 8 * (r() < 0.5 ? 1 : -1));
      ctx.fillStyle = r() < 0.5 ? PAL.base : PAL.dark;
      ctx.fillRect(-sz / 2, -sz / 2, sz, sz * 0.8);
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = PAL.edge;
      ctx.strokeRect(-sz / 2, -sz / 2, sz, sz * 0.8);
      ctx.restore();
    }
  }
  function flash(ctx, g, p, intensity) {
    if (intensity <= 0) return;
    const fa = Math.max(0, 1 - p / 0.3);
    if (fa <= 0) return;
    const grd = ctx.createRadialGradient(g.cx, g.cy, 2, g.cx, g.cy, g.R * 1.3);
    grd.addColorStop(0, PAL.flash);
    grd.addColorStop(1, "rgba(255,200,160,0)");
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = intensity * fa;
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(g.cx, g.cy, g.R * 1.3, g.R * 0.7, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  function drawHero(ctx, g, scale, alpha, hero) {
    if (!hero?.complete || !hero.naturalWidth) return;
    const w = g.R * 2.6 * scale,
      h = w * (hero.naturalHeight / hero.naturalWidth);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(g.cx, g.cy);
    ctx.scale(1, 0.82);
    ctx.drawImage(hero, -w / 2, -h * 0.62, w, h);
    ctx.restore();
  }

  const P = (key, label, min, max, def, step) => ({
    key,
    label,
    min,
    max,
    def,
    step: step ?? (max - min) / 100,
  });

  const MECHANICS = {
    "quake-erupt": {
      id: "quake-erupt",
      label: "Quake — erupt (Codex hero + engine layers)",
      needsHero: true,
      params: [
        P("radius", "AoE radius", 0.5, 1.5, 1),
        P("flash", "Impact flash", 0, 1, 0.55),
        P("dust", "Dust", 0, 1, 0.7),
        P("debris", "Debris bits", 0, 40, 16, 1),
        P("shake", "Screen shake", 0, 1, 0.5),
      ],
      draw(ctx, g0, p, o) {
        const pr = o.params,
          g = { cx: g0.cx, cy: g0.cy, R: g0.R * pr.radius };
        const a = amp(p),
          sh = shakeEnv(p) * pr.shake;
        ctx.save();
        ctx.translate((o.rnd() - 0.5) * sh * 8, (o.rnd() - 0.5) * sh * 6);
        dustRing(ctx, g.cx, g.cy, g.R, a, p, pr.dust);
        cracks(ctx, g.cx, g.cy, g.R, a, o.seed);
        drawHero(ctx, g, 0.32 + 0.68 * a, Math.min(1, a * 1.4), o.hero);
        debris(ctx, g, p, pr.debris | 0, o.seed + 3);
        flash(ctx, g, p, pr.flash);
        ctx.restore();
      },
    },
    "nova-pulse": {
      id: "nova-pulse",
      label: "Nova — expanding pulse (Codex hero)",
      needsHero: true,
      params: [
        P("rings", "Pulse rings", 1, 3, 2, 1),
        P("flash", "Core flash", 0, 1, 0.5),
        P("spread", "Spread", 0.6, 1.6, 1),
      ],
      draw(ctx, g0, p, o) {
        const pr = o.params,
          g = { cx: g0.cx, cy: g0.cy, R: g0.R * pr.spread };
        for (let k = 0; k < (pr.rings | 0); k++) {
          const pp = (p + k / pr.rings) % 1;
          const a = Math.max(0, 1 - pp);
          drawHero(ctx, g, 0.2 + pp * 1.1, a * 0.9, o.hero);
        }
        flash(ctx, g, p, pr.flash);
      },
    },
    "procedural-slabs": {
      id: "procedural-slabs",
      label: "Procedural slabs (no art — param colour)",
      needsHero: false,
      params: [
        P("slabs", "Slab count", 4, 16, 8, 1),
        P("length", "Slab length", 0.6, 1.6, 1),
        P("dust", "Dust", 0, 1, 0.6),
      ],
      draw(ctx, g, p, o) {
        const pr = o.params,
          a = amp(p),
          r = mulberry(o.seed);
        dustRing(ctx, g.cx, g.cy, g.R, a, p, pr.dust);
        cracks(ctx, g.cx, g.cy, g.R, a, o.seed);
        const N = pr.slabs | 0,
          slabs = [];
        for (let i = 0; i < N; i++) {
          const ang = (i / N) * TAU + 0.2;
          const rad = g.R * (0.32 + 0.55 * a);
          slabs.push({
            ang,
            x: g.cx + Math.cos(ang) * rad,
            y: g.cy + Math.sin(ang) * rad * 0.5,
            len: (34 + r() * 16) * a * pr.length,
            wid: 16 + r() * 8,
            vary: r(),
          });
        }
        slabs.sort((A, B) => A.y - B.y);
        for (const s of slabs) {
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(Math.cos(s.ang) * 0.5);
          shard(ctx, s.len, s.wid, s.vary);
          ctx.restore();
        }
      },
    },
    "voronoi-fracture": {
      id: "voronoi-fracture",
      label: "Voronoi ground-fracture (no art)",
      needsHero: false,
      params: [
        P("density", "Cell density", 7, 15, 11, 1),
        P("spread", "Separation", 0.2, 0.9, 0.5),
      ],
      draw(ctx, g, p, o) {
        const pr = o.params,
          a = amp(p),
          r = mulberry(o.seed),
          rings = [0.4, 0.78, 1.0],
          angs = pr.density | 0,
          cells = [];
        for (let ri = 0; ri < rings.length - 1; ri++)
          for (let ai = 0; ai < angs; ai++) {
            const a0 = (ai / angs) * TAU + r() * 0.12,
              a1 = ((ai + 1) / angs) * TAU + r() * 0.12;
            const r0 = rings[ri] * g.R,
              r1 = rings[ri + 1] * g.R;
            const mid = (a0 + a1) / 2,
              mr = (r0 + r1) / 2;
            const sep = a * pr.spread;
            cells.push({
              pts: [
                [a0, r0],
                [a1, r0],
                [a1, r1],
                [a0, r1],
              ],
              dx: Math.cos(mid) * mr * sep,
              dy: Math.sin(mid) * mr * sep * 0.5,
              lift: a * 8,
              mid,
              mr,
            });
          }
        cells.sort((A, B) => Math.sin(A.mid) * A.mr - Math.sin(B.mid) * B.mr);
        for (const c of cells) {
          ctx.save();
          ctx.translate(g.cx + c.dx, g.cy + c.dy - c.lift);
          ctx.beginPath();
          c.pts.forEach((pt, k) => {
            const x = Math.cos(pt[0]) * pt[1],
              y = Math.sin(pt[0]) * pt[1] * 0.5;
            k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          });
          ctx.closePath();
          ctx.fillStyle = c.mr > g.R * 0.7 ? PAL.base : PAL.dark;
          ctx.fill();
          ctx.lineWidth = 1.6;
          ctx.strokeStyle = PAL.edge;
          ctx.stroke();
          ctx.restore();
        }
      },
    },
  };

  window.VFX = { MECHANICS, amp, PAL, CYCLE: 2.6 };
})();
