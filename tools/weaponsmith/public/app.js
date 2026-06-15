// Weaponsmith UI — per-weapon VFX SUITE: a Codex hero skin + a stack of toggleable engine layers,
// pre-set to my tailored recommendation per weapon (vfx-layers.js PRESETS).
const $ = (s, r = document) => r.querySelector(s);
const el = (h) => {
  const d = document.createElement("div");
  d.innerHTML = h;
  return d.firstElementChild;
};
const api = async (p, opt) => (await fetch(p, opt)).json();
const status = (m) => {
  $("#status").innerHTML = m || "";
};

const state = { weapon: null, image: null, suite: {}, notes: "", hero: null, candidates: [], vfxSubject: null, rot: 0 };

// ---- WYSIWYG preview engine (Phaser/WebGL — same renderer the game uses). A SINGLE persistent
// engine; its canvas is re-parented into the current .stage on each render (never recreated, so we
// don't leak WebGL contexts). Falls back to the canvas-2D loop if Phaser/engine is unavailable.
const USE_ENGINE = !!(window.VFXEngine && window.Phaser);
let engine = null;
let pvWrap = null;
const heroUrl = () => (state.suite["hero-skin"]?.on && state.image ? `/art/${state.vfxSubject}/${state.image}` : null);
function pushHero() { if (engine) engine.setHero(heroUrl()); }
function pushSuite() { if (engine) { engine.setSuite(state.suite, state.rot); pushHero(); engine.replay(); } }
function mountPreview() {
  if (!USE_ENGINE) { startPreview(); return; }
  const stage = $(".stage");
  if (!stage) return;
  if (!pvWrap) {
    pvWrap = document.createElement("div");
    pvWrap.style.cssText = "position:absolute;inset:0";
    engine = window.VFXEngine.makePreview(pvWrap);
  }
  stage.appendChild(pvWrap);
  engine.refresh();
  pushSuite();
}

// Build a weapon's suite: every layer present (on/off + params), defaults from my PRESET.
function defaultSuite(weaponId) {
  const preset = window.VFXLAYERS.PRESETS[weaponId];
  const suite = {};
  for (const [lid, layer] of Object.entries(window.VFXLAYERS.LAYERS)) {
    const pre = preset?.layers?.[lid];
    const params = {};
    for (const pp of layer.params) params[pp.key] = pre?.params?.[pp.key] ?? pp.def;
    suite[lid] = { on: !!pre?.on, params };
  }
  return suite;
}

// ---- weapon list (grouped by class: swords · guns · launchers · staffs · melee) ----
const CLASS_LABEL = { sword: "⚔ Swords", gun: "▤ Guns", launcher: "◎ Launchers", staff: "✦ Staffs", melee: "✦ Melee", weapon: "Weapons" };
async function loadList() {
  const weapons = await api("/api/weapons");
  const list = $("#list");
  list.innerHTML = "";
  let lastCls = null;
  for (const w of weapons) {
    if (w.cls !== lastCls) {
      lastCls = w.cls;
      list.appendChild(el(`<div class="grp">${CLASS_LABEL[w.cls] || w.cls}</div>`));
    }
    const tags = [w.grip, w.family, w.coded && "coded"].filter(Boolean).join(" · ");
    const node = el(`<div class="wp" data-id="${w.id}">
      ${w.candidateCount ? `<span class="dot">${w.candidateCount}</span>` : ""}
      <b>${w.name}</b><small>${tags}${w.assigned?.suite ? " · ✓ suite" : ""}</small></div>`);
    node.onclick = () => selectWeapon(w.id);
    list.appendChild(node);
  }
}

// ---- select a weapon ----
async function selectWeapon(id) {
  for (const n of document.querySelectorAll(".wp")) n.classList.toggle("sel", n.dataset.id === id);
  const w = await api(`/api/weapon/${id}`);
  state.weapon = w;
  state.vfxSubject = w.vfxSubject;
  state.candidates = w.candidates;
  const a = w.assigned || {};
  state.image = a.image || w.candidates[0] || null;
  state.suite = defaultSuite(id);
  if (a.suite) {
    for (const lid in a.suite) {
      if (state.suite[lid]) {
        state.suite[lid].on = a.suite[lid].on;
        Object.assign(state.suite[lid].params, a.suite[lid].params || {});
      }
    }
  }
  state.notes = a.notes || "";
  state.rot = a.rot || 0;
  renderMain(w);
  loadHero();
  mountPreview();
}

function renderMain(w) {
  const m = $("#main");
  m.innerHTML = `
    <div class="row" style="align-items:center;justify-content:space-between">
      <div><h1 style="margin:0;font-size:18px">${w.name}</h1>
        <div class="stats" style="margin-top:6px">
          <span>dmg <b>${w.damage ?? "—"}</b></span><span>range <b>${w.range ?? "—"}</b></span>
          <span>cd <b>${w.cooldown ?? "—"}s</b></span>${w.quake ? "<span><b>quake</b></span>" : ""}${w.thrown ? "<span><b>thrown</b></span>" : ""}${w.dual ? "<span><b>dual</b></span>" : ""}
          <span class="muted">vfx: ${w.vfxSubject}</span></div></div>
    </div>

    <h2>1 · Pick the look <span class="muted" style="text-transform:none;letter-spacing:0">— the Codex hero skin (candidates)</span></h2>
    <div class="cands" id="cands"></div>
    <div class="reroll">
      <div class="muted" style="margin-bottom:6px">Don't like them? Edit the prompt and reroll 4 fresh candidates (Codex, ~few min).</div>
      <textarea id="prompt" rows="3">${(w.prompt || "").replace(/</g, "&lt;")}</textarea>
      <div style="margin-top:8px"><button id="reroll" class="primary">⟳ Reroll 4 candidates</button>
        <span id="rerollStatus" class="muted"></span></div>
      <pre class="log" id="rerollLog"></pre>
    </div>

    <h2>2 · Tailored VFX suite <span class="muted" style="text-transform:none;letter-spacing:0">— my recommendation is pre-set; toggle layers on/off + tune</span></h2>
    <div class="preview-wrap">
      <div><div class="stage"><canvas id="pv"></canvas></div>
        <div class="rotrow" style="margin-top:8px">
          <span class="muted">Rotate VFX:</span>
          <button id="rotL" title="−15°">⟲ −15°</button>
          <span id="rotVal" class="rotval">0°</span>
          <button id="rotR" title="+15°">+15° ⟳</button>
          <button id="rot0" title="reset">0</button>
        </div>
        <div style="margin-top:8px"><button id="replay">↻ Replay</button> <button id="resetSuite">↺ My recommendation</button></div></div>
      <div class="suite" id="suite"></div>
    </div>

    <h2>3 · Notes <span class="muted" style="text-transform:none;letter-spacing:0">— I'll read these when you ask</span></h2>
    <textarea id="notes" rows="3" placeholder="Ideas, tweaks, future weapon-system changes to discuss…">${(state.notes || "").replace(/</g, "&lt;")}</textarea>
  `;
  renderCandidates();
  renderSuite();
  $("#reroll").onclick = doReroll;
  $("#replay").onclick = () => { if (engine) engine.replay(); else preview.start = preview.clock; };
  $("#resetSuite").onclick = () => {
    state.suite = defaultSuite(state.weapon.id);
    renderSuite();
    loadHero();
    pushSuite();
  };
  const showRot = () => ($("#rotVal").textContent = `${state.rot}°`);
  const stepRot = (d) => {
    state.rot = ((((state.rot + d) % 360) + 360) % 360);
    showRot();
    if (engine) engine.setRot(state.rot);
  };
  $("#rotL").onclick = () => stepRot(-15);
  $("#rotR").onclick = () => stepRot(15);
  $("#rot0").onclick = () => {
    state.rot = 0;
    showRot();
  };
  showRot();
  $("#notes").oninput = (e) => (state.notes = e.target.value);
}

function renderCandidates() {
  const c = $("#cands");
  c.innerHTML = "";
  if (!state.candidates.length) {
    c.innerHTML = `<div class="muted">No candidates yet — generating, or write a prompt below and reroll.</div>`;
    return;
  }
  for (const file of state.candidates) {
    const node = el(`<div class="cand ${file === state.image ? "sel" : ""}" data-f="${file}">
      <img src="/art/${state.vfxSubject}/${file}" /><span class="tick">✓</span></div>`);
    node.onclick = () => {
      state.image = file;
      renderCandidates();
      loadHero();
      pushHero();
    };
    c.appendChild(node);
  }
}

// The suite checklist — one row per layer, ordered, with a toggle + (when on) param sliders.
function renderSuite() {
  const box = $("#suite");
  box.innerHTML = "";
  for (const lid of window.VFXLAYERS.ORDER) {
    const layer = window.VFXLAYERS.LAYERS[lid];
    const s = state.suite[lid];
    if (!layer || !s) continue;
    const row = el(`<div class="layer ${s.on ? "on" : ""}">
      <label class="lhead"><input type="checkbox" ${s.on ? "checked" : ""}/> <b>${layer.label}</b>
        <span class="trig">${layer.trigger}</span></label>
      <div class="lparams"></div></div>`);
    const cb = row.querySelector("input");
    cb.onchange = () => {
      s.on = cb.checked;
      row.classList.toggle("on", s.on);
      buildParams();
      loadHero();
      pushHero(); // hero-skin toggle needs the texture; other layers are read live by the engine
    };
    const pbox = row.querySelector(".lparams");
    const buildParams = () => {
      pbox.innerHTML = "";
      if (!s.on) return;
      for (const pp of layer.params) {
        if (s.params[pp.key] === undefined) s.params[pp.key] = pp.def;
        const pr = el(`<div class="lparam"><label>${pp.label}</label>
          <input type="range" min="${pp.min}" max="${pp.max}" step="${pp.step}" value="${s.params[pp.key]}"/>
          <span class="val">${(+s.params[pp.key]).toFixed(pp.step < 1 ? 2 : 0)}</span></div>`);
        const inp = pr.querySelector("input");
        const val = pr.querySelector(".val");
        inp.oninput = () => {
          s.params[pp.key] = +inp.value;
          val.textContent = (+inp.value).toFixed(pp.step < 1 ? 2 : 0);
        };
        pbox.appendChild(pr);
      }
      if (layer.needsHero && !state.image)
        pbox.appendChild(el(`<div class="muted" style="font-size:11px">⚠ pick a hero skin above</div>`));
    };
    buildParams();
    box.appendChild(row);
  }
}

function loadHero() {
  if (!state.suite["hero-skin"]?.on || !state.image) {
    state.hero = null;
    return;
  }
  const img = new Image();
  img.src = `/art/${state.vfxSubject}/${state.image}`;
  state.hero = img;
}

// ---- reroll ----
async function doReroll() {
  const btn = $("#reroll");
  btn.disabled = true;
  const prompt = $("#prompt").value;
  $("#rerollStatus").innerHTML = `<span class="spin"></span> starting Codex…`;
  $("#rerollLog").style.display = "block";
  const { jobId, error } = await api("/api/reroll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ weaponId: state.weapon.id, prompt, candidates: 4 }),
  });
  if (error) {
    $("#rerollStatus").textContent = `error: ${error}`;
    btn.disabled = false;
    return;
  }
  const poll = setInterval(async () => {
    const j = await api(`/api/job/${jobId}`);
    $("#rerollLog").textContent = j.log || "";
    $("#rerollLog").scrollTop = $("#rerollLog").scrollHeight;
    if (j.status === "running") {
      $("#rerollStatus").innerHTML = `<span class="spin"></span> generating 4 candidates…`;
      return;
    }
    clearInterval(poll);
    btn.disabled = false;
    if (j.status === "done") {
      state.candidates = j.candidates;
      if (!state.candidates.includes(state.image)) state.image = state.candidates[0] || null;
      $("#rerollStatus").textContent = `✓ ${j.candidates.length} new candidates`;
      renderCandidates();
      loadHero();
      loadList();
    } else {
      $("#rerollStatus").textContent = "generation failed — see log";
    }
  }, 1500);
}

// ---- live preview loop (composes all enabled layers in order) ----
const preview = { clock: 0, last: 0, start: 0, raf: 0 };
function startPreview() {
  if (preview.raf) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const loop = (ts) => {
    const cv = $("#pv");
    if (!cv) {
      preview.raf = 0;
      return;
    }
    if (!preview.last) preview.last = ts;
    preview.clock += (ts - preview.last) / 1000;
    preview.last = ts;
    const r = cv.getBoundingClientRect();
    if (cv.width !== r.width * dpr) {
      cv.width = r.width * dpr;
      cv.height = r.height * dpr;
    }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = cv.width / dpr;
    const H = cv.height / dpr;
    ctx.clearRect(0, 0, W, H);
    let p = (preview.clock - preview.start) / window.VFXLAYERS.CYCLE;
    p = ((p % 1) + 1) % 1;
    const g = { cx: W / 2, cy: H * 0.55, R: Math.min(W, H) * 0.3 };
    let s2 = (preview.clock * 1000) | 0;
    const rnd = () => {
      s2 = (s2 * 1103515245 + 12345) & 0x7fffffff;
      return s2 / 0x7fffffff;
    };
    // global VFX rotation (15° increments) — rotate the whole composition about its centre
    if (state.rot) {
      ctx.translate(g.cx, g.cy);
      ctx.rotate((state.rot * Math.PI) / 180);
      ctx.translate(-g.cx, -g.cy);
    }
    for (const lid of window.VFXLAYERS.ORDER) {
      const s = state.suite[lid];
      if (!s?.on) continue;
      ctx.save();
      try {
        window.VFXLAYERS.LAYERS[lid].draw(ctx, g, p, { hero: state.hero, params: s.params, seed: 1234, rnd });
      } catch (_e) {}
      ctx.restore();
    }
    preview.raf = requestAnimationFrame(loop);
  };
  preview.raf = requestAnimationFrame(loop);
}

// ---- save ----
$("#save").onclick = async () => {
  if (!state.weapon) return;
  status(`<span class="spin"></span> saving…`);
  // store only on/params (compact)
  const suite = {};
  for (const lid in state.suite) suite[lid] = { on: state.suite[lid].on, params: state.suite[lid].params };
  const r = await api("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ weaponId: state.weapon.id, image: state.image, suite, rot: state.rot, notes: $("#notes")?.value ?? state.notes }),
  });
  status(r.ok ? `✓ saved ${state.weapon.name}` : "save failed");
  loadList();
  setTimeout(() => status(""), 2500);
};

loadList();
