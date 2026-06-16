// VFX ENGINE (Weaponsmith preview HOST) — §14. The WYSIWYG Phaser/WebGL preview. The actual layer
// rendering lives in the CANONICAL `vfx-render.js` (window.VFXRENDER), the SAME module the live game
// runs — so "what you author = what ships" (CODE-8). This file only owns the PREVIEW host: a phase
// clock, the combined "attack" scene (drifter swings the weapon into an enemy), and the makePreview API.
//
//   const pv = VFXEngine.makePreview(stageEl);
//   pv.setHero(url); pv.setSuite(suite, rotDeg); pv.replay();
window.VFXEngine = (() => {
  const VR = () => globalThis.VFXRENDER; // resolved at call-time (script load-order safe)
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function setup(scene, S) {
    VR().ensureTextures(scene);
    S.scene = scene;
    S.container = scene.add.container(0, 0);
    S.heroImg = scene.add.image(0, 0, "vfx-blank").setVisible(false);
    S.container.add(S.heroImg);
    VR().attachSurface(scene, S); // additive graphics + pooled emitters + S.emit/emitStreak

    // Attack-scene actors (drifter / enemy / weapon) — render BEHIND the VFX container so the effect
    // lands on top of the enemy at impact. Created here, textured + posed each frame in runAttack().
    if (S.attack) {
      S.aEnemy = scene.add.image(0, 0, "vfx-blank").setVisible(false).setDepth(1);
      S.aWeapon = scene.add.image(0, 0, "vfx-blank").setVisible(false).setDepth(2);
      S.aChar = scene.add.image(0, 0, "vfx-blank").setVisible(false).setDepth(3);
      S.container.setDepth(10);
    }

    // real post-process GLOW (Phaser 4 Filters) — subtle bloom on the bright additive content.
    try {
      scene.cameras.main.filters.internal.addGlow(0xffffff, 3, 0, 1.1);
    } catch (e) {
      console.log(`[vfx-engine] glow filter unavailable: ${e.message}`);
    }

    layoutContainer(scene, S);
    scene.scale.on("resize", () => layoutContainer(scene, S));
    S.ready = true;
  }

  function layoutContainer(scene, S) {
    const W = scene.scale.width,
      H = scene.scale.height,
      u = Math.min(W, H);
    S.W = W;
    S.H = H;
    // §14 fixed VFX size: an authored vfxRadius (px) maps to stage units via the smith's char height
    // (u*0.34) over the in-game body (84px), so the slider is WYSIWYG (74px → u*0.30, the legacy default).
    S.R = S.vfxRadius ? (S.vfxRadius * u * 0.34) / 84 : u * 0.3;
    S.container.setPosition(W / 2, H * 0.55);
  }

  // Set the DESIRED hero texture. renderHero applies it once loaded — so rapid weapon switches never
  // race (no stale art): the latest wantHeroKey wins, shown as soon as its texture is in the cache.
  function loadHero(S, url) {
    if (!url) {
      S.wantHeroKey = null;
      return;
    }
    const key = `hero:${url}`;
    S.wantHeroKey = key;
    if (!S.scene || S.scene.textures.exists(key)) return;
    S.scene.load.image(key, url);
    S.scene.load.start(); // safe while already loading — Phaser queues it
  }

  // Load an actor texture (char/enemy/weapon) for the attack scene; applied in frame once cached.
  function loadActor(S, slot, url) {
    if (!url) {
      S[`${slot}Want`] = null;
      return;
    }
    const key = `${slot}:${url}`;
    S[`${slot}Want`] = key;
    if (!S.scene || S.scene.textures.exists(key)) return;
    S.scene.load.image(key, url);
    S.scene.load.start();
  }
  function applyActor(scene, img, wantKey) {
    if (!img || !wantKey || !scene.textures.exists(wantKey)) {
      if (img) img.setVisible(false);
      return false;
    }
    if (img.texture.key !== wantKey) img.setTexture(wantKey);
    return true;
  }

  // The COMBINED "attack" scene: a drifter swings/throws the weapon into an enemy; the VFX fires on the
  // HIT. Returns whether the VFX should render this frame, its phase, the impact point + the swing pose.
  const IMPACT = 0.42,
    VFX_DUR = 0.46;
  function runAttack(scene, S, ap) {
    const W = S.W,
      H = S.H,
      u = Math.min(W, H);
    const charX = W * 0.26,
      charY = H * 0.62;
    const enemyX = W * 0.74,
      enemyY = H * 0.56;
    const handX = charX + u * 0.12,
      handY = charY - u * 0.06;
    const ix = enemyX - u * 0.06,
      iy = enemyY; // impact point (on the enemy, weapon-side)

    if (applyActor(scene, S.aChar, S.charWant)) {
      const t = scene.textures.get(S.charWant).getSourceImage();
      const lean = ap > 0.3 && ap < 0.5 ? 0.12 : 0;
      S.aChar
        .setScale((u * 0.34) / (t.height || 1))
        .setPosition(charX, charY)
        .setRotation(lean)
        .setVisible(true);
    }
    if (applyActor(scene, S.aEnemy, S.enemyWant)) {
      const t = scene.textures.get(S.enemyWant).getSourceImage();
      const hit = ap >= IMPACT && ap < IMPACT + 0.12;
      S.aEnemy
        .setScale((u * 0.26) / (t.height || 1))
        .setPosition(enemyX + (hit ? u * 0.02 : 0), enemyY)
        .setFlipX(true)
        .setVisible(true);
      if (hit) S.aEnemy.setTintFill(0xffffff);
      else S.aEnemy.clearTint();
    }
    if (applyActor(scene, S.aWeapon, S.weaponWant)) {
      const t = scene.textures.get(S.weaponWant).getSourceImage();
      const charH = u * 0.34;
      const wl = Math.max(u * 0.08, Math.min(u * 1.5, ((S.weaponLen || 90) / 84) * charH));
      const sc = wl / (t.width || 1);
      S.aWeapon.setScale(sc).setOrigin(0.15, 0.5).setVisible(true);
      if (S.weaponThrown) {
        const f = clamp01((ap - 0.18) / (IMPACT - 0.18));
        S.aWeapon
          .setPosition(handX + (ix - handX) * f, handY + (iy - handY) * f)
          .setRotation(ap * 22);
        if (ap > IMPACT) S.aWeapon.setVisible(false);
      } else {
        const REST = -1.45;
        let ang = REST;
        if (ap < 0.15) ang = REST;
        else if (ap < 0.3) ang = REST - 0.75 * ((ap - 0.15) / 0.15);
        else if (ap <= IMPACT)
          ang = REST - 0.75 + (1.65 + 0.75) * (1 - (1 - (ap - 0.3) / (IMPACT - 0.3)) ** 2);
        else ang = 0.2 + (REST - 0.2) * clamp01((ap - IMPACT) / 0.3);
        S.aWeapon.setPosition(handX, handY).setRotation(ang);
      }
    }
    // Motion window (CODE-13): swing-trigger VFX sweep ALONG the blade during the windup→chop.
    const swinging = !S.weaponThrown && ap > 0.06 && ap < IMPACT;
    const sp = clamp01((ap - 0.14) / (IMPACT - 0.14));
    const aimAng = Math.atan2(iy - handY, ix - handX);
    return {
      vfx: ap >= IMPACT,
      p: clamp01((ap - IMPACT) / VFX_DUR),
      ix,
      iy,
      swinging,
      sp,
      wx: handX,
      wy: handY,
      aimAng,
    };
  }

  function frame(scene, S, delta) {
    if (!S.ready || !VR()) return;
    S.t += delta / 1000;
    let p = (S.t - S.startT) / S.cycle;
    const cyc = Math.floor((S.t - S.startT) / S.cycle);
    p = ((p % 1) + 1) % 1;
    if (S.attack) {
      const r = runAttack(scene, S, p);
      if (r.swinging) {
        // CODE-13: swing-trigger VFX sweep along the blade (hand → enemy), timed to the swing.
        S.container.setPosition(r.wx, r.wy).setRotation(r.aimAng);
        S.gfxAdd.clear();
        if (S.heroImg) S.heroImg.setVisible(false);
        VR().renderLayers(S, r.sp, "swing", cyc);
        return;
      }
      S.container.setPosition(r.ix, r.iy).setRotation(((S.rot || 0) * Math.PI) / 180);
      if (!r.vfx) {
        S.gfxAdd.clear();
        if (S.heroImg) S.heroImg.setVisible(false);
        return;
      }
      p = r.p; // impact VFX plays from the moment of impact
    } else {
      S.container.setRotation(((S.rot || 0) * Math.PI) / 180);
    }
    S.gfxAdd.clear();
    VR().renderHero(scene, S, p);
    VR().renderLayers(S, p, S.attack ? "impact" : "all", cyc);
  }

  function makePreview(parentEl, opts = {}) {
    const S = {
      suite: {},
      rot: 0,
      t: 0,
      startT: 0,
      cycle: globalThis.VFXLAYERS?.CYCLE || 2,
      ready: false,
      fired: {},
      attack: !!opts.attack,
    };
    const config = {
      type: Phaser.WEBGL,
      parent: parentEl,
      transparent: true,
      width: parentEl.clientWidth || 300,
      height: parentEl.clientHeight || 300,
      scale: {
        mode: Phaser.Scale.RESIZE,
        parent: parentEl,
        width: parentEl.clientWidth || 300,
        height: parentEl.clientHeight || 300,
      },
      fps: { forceSetTimeOut: true },
      render: { preserveDrawingBuffer: true, antialias: true },
      scene: {
        create() {
          setup(this, S);
        },
        update(_t, d) {
          frame(this, S, d);
        },
      },
    };
    const game = new Phaser.Game(config);
    return {
      setSuite(suite, rot) {
        S.suite = suite;
        S.rot = rot || 0;
        S.fired = {};
      },
      setRot(rot) {
        S.rot = rot || 0;
      },
      setVfxRadius(px) {
        S.vfxRadius = px || 0;
        if (S.scene) layoutContainer(S.scene, S);
      }, // §14 fixed VFX size
      setHeroEnabled(on) {
        S.heroEnabled = on !== false;
      },
      setHero(url) {
        if (S.scene) loadHero(S, url);
        else setTimeout(() => loadHero(S, url), 60);
      },
      setActors(charUrl, enemyUrl) {
        const f = () => {
          loadActor(S, "char", charUrl);
          loadActor(S, "enemy", enemyUrl);
        };
        if (S.scene) f();
        else setTimeout(f, 60);
      },
      setWeaponSprite(url, o) {
        S.weaponThrown = !!o?.thrown;
        S.weaponLen = o?.displayLength || 90;
        const f = () => loadActor(S, "weapon", url);
        if (S.scene) f();
        else setTimeout(f, 60);
      },
      setScatter(spec) {
        const f = () =>
          VR().loadScatter(S, spec?.url, spec?.frameWidth, spec?.frameHeight, spec?.count);
        if (S.scene) f();
        else setTimeout(f, 60);
      },
      replay() {
        S.startT = S.t;
        S.fired = {};
      },
      setPhase(ap) {
        S.startT = S.t - (ap || 0) * S.cycle;
        S.fired = {};
      }, // debug: jump to a cycle phase
      destroy() {
        try {
          game.destroy(true);
        } catch (e) {
          void e;
        }
      },
      refresh() {
        try {
          game.scale.refresh();
          if (S.scene) layoutContainer(S.scene, S);
        } catch (e) {
          void e;
        }
      },
      get game() {
        return game;
      },
      get scene() {
        return S.scene;
      },
    };
  }

  return { makePreview };
})();
