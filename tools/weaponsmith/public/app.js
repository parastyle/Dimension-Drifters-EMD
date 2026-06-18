// Weaponsmith V2 — the painted-vs-engine authoring pipeline.
// Per weapon, a 4-up showcase: [weapon sprite] · [painted Codex VFX] · [engine VFX] · [combined attack].
// You author TWO prompts (what to PAINT, what the ENGINE does); they save to a file; you ping Claude,
// who audits the painted prompt against the art rules + generates it, and builds the engine VFX from
// the other. Each panel has an ✎ edit button → notes → saved for a redo. Guns + casters = engine-only.
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
const esc = (s) => (s || "").replace(/</g, "&lt;");

const state = {
  weapon: null,
  image: null,
  suite: {},
  rot: 0,
  displayLength: 90,
  vfxRadius: 74,
  vfxOrigin: { x: 0, y: 0 }, // §14 authored VFX spawn offset (game px) from the weapon anchor
  spawnAtCursor: false, // §14 spawn the VFX at the in-game cursor (greatsword-quake style) instead
  originPlacing: false, // UI: "click the preview to place the origin" mode is active
  candidates: [],
  vfxSubject: null,
  weaponArt: null,
  engineOnly: false,
  paintedVfx: false,
  description: "", // living "what it does" doc (Claude-maintained, user-editable)
  author: { painted: "", engine: "", mechanics: "", edits: {} },
};

// ---- WYSIWYG engines (Phaser/WebGL). TWO persistent instances — one for the ENGINE-only panel
// (painted hero suppressed) and one for the COMBINED panel (painted + engine). Canvases are
// re-parented into their panels each render so we never leak WebGL contexts. ----
const HAVE_ENGINE = !!(window.VFXEngine && window.Phaser);
const engines = {}; // key -> { engine, wrap }
function ensureEngine(key, heroEnabled) {
  if (!engines[key]) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:absolute;inset:0";
    // The Combined panel runs the ATTACK scene (drifter swings the weapon into an enemy; VFX on hit).
    const engine = window.VFXEngine.makePreview(wrap, key === "combined" ? { attack: true } : {});
    engine.setHeroEnabled(heroEnabled);
    engines[key] = { engine, wrap };
  }
  return engines[key];
}
const heroUrl = () =>
  state.suite["hero-skin"]?.on && state.image && state.paintedVfx
    ? `/art/${state.vfxSubject}/${state.image}`
    : null;
function mountPanelEngine(key, stageSel, heroEnabled) {
  if (!HAVE_ENGINE) return;
  const { engine, wrap } = ensureEngine(key, heroEnabled);
  const stage = $(stageSel);
  if (!stage) return;
  stage.appendChild(wrap);
  engine.refresh();
  engine.setHeroEnabled(heroEnabled);
  engine.setSuite(state.suite, state.rot);
  if (engine.setVfxRadius) engine.setVfxRadius(state.vfxRadius); // §14 fixed VFX size
  engine.setHero(heroUrl());
  if (key === "combined" && engine.setActors) {
    engine.setActors("/art/drifter/candidate-1.keyed.png", "/art/critter/candidate-1.keyed.png");
    engine.setWeaponSprite(state.weaponArt, {
      thrown: !!state.weapon?.thrown,
      displayLength: state.displayLength,
    });
  }
  if (engine.setScatter) engine.setScatter(state.weapon?.scatter || null); // CODE-14 scatter-shot source
  engine.replay();
}
function pushAllEngines() {
  for (const key of Object.keys(engines)) {
    const { engine } = engines[key];
    engine.setSuite(state.suite, state.rot);
    if (engine.setVfxRadius) engine.setVfxRadius(state.vfxRadius);
    engine.setHero(heroUrl());
    engine.replay();
  }
}
function pushHeroAll() {
  for (const key of Object.keys(engines)) engines[key].engine.setHero(heroUrl());
}
function pushRotAll() {
  for (const key of Object.keys(engines)) engines[key].engine.setRot(state.rot);
}

// Auto-presets are STRIPPED (V1 rethink): a weapon starts with NOTHING. Engine VFX exists only once
// authored (Claude builds the suite from your engine prompt; saved into assignments.json).
function defaultSuite() {
  const suite = {};
  for (const [lid, layer] of Object.entries(window.VFXLAYERS.LAYERS)) {
    const params = {};
    for (const pp of layer.params) params[pp.key] = pp.def;
    suite[lid] = { on: false, params };
  }
  return suite;
}

// ---- weapon list (grouped by class) ----
const CLASS_LABEL = {
  sword: "⚔ Swords",
  gun: "▤ Guns",
  launcher: "◎ Launchers",
  staff: "✦ Staffs",
  melee: "⚒ Melee",
  ranged: "➹ Ranged",
  caster: "✷ Casters",
  weapon: "Weapons",
};
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
    const tags = [w.grip, w.family].filter(Boolean).join(" · ");
    const node = el(`<div class="wp" data-id="${w.id}">
      ${w.candidateCount ? `<span class="dot">${w.candidateCount}</span>` : ""}
      <b>${w.name}</b><small>${tags}${w.assigned?.author?.pending ? " · ⏳" : w.assigned?.suite ? " · ✓" : ""}</small></div>`);
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
  state.weaponArt = w.weaponArt;
  state.engineOnly = !!w.engineOnly;
  state.paintedVfx = !!w.paintedVfx;
  state.displayLength = w.displayLength || 90;
  state.vfxRadius = w.vfxRadius || 74;
  const a = w.assigned || {};
  state.vfxOrigin =
    a.vfxOrigin && typeof a.vfxOrigin.x === "number" ? { ...a.vfxOrigin } : { x: 0, y: 0 };
  state.spawnAtCursor = !!a.spawnAtCursor;
  state.originPlacing = false;
  state.image = a.image || w.candidates[0] || null;
  state.suite = defaultSuite();
  if (a.suite) {
    for (const lid in a.suite) {
      if (state.suite[lid]) {
        state.suite[lid].on = a.suite[lid].on;
        Object.assign(state.suite[lid].params, a.suite[lid].params || {});
      }
    }
  }
  // Painted weapons always show their painting in the Combined panel; engine layers come from the
  // saved suite (or Claude's authoring). (Guns/casters have no painted hero.)
  // Painted weapons show their painting in Combined — EXCEPT a scatter-cluster (CODE-14): that art is
  // dissected into flung balls by the `magma-scatter` layer, so showing it whole as a static hero is wrong.
  if (w.paintedVfx && !w.scatter) state.suite["hero-skin"].on = true;
  state.rot = a.rot || 0;
  state.description = a.description || "";
  state.author = {
    painted: a.author?.painted || "",
    engine: a.author?.engine || "",
    mechanics: a.author?.mechanics || "",
    edits: a.author?.edits || {},
    pending: a.author?.pending,
  };
  renderMain(w);
  mountPanelEngine("engine", "#stageEngine", false);
  mountPanelEngine("combined", "#stageCombined", true);
}

function renderMain(w) {
  const eo = state.engineOnly;
  const paintedPanel = eo
    ? `<div class="ph">Engine-only class<br><span class="muted">(${w.cls} — no painted VFX for now)</span></div>`
    : state.paintedVfx && state.image
      ? `<img id="paintedImg" src="/art/${state.vfxSubject}/${state.image}" />`
      : `<div class="ph">No painted VFX yet —<br>write the <b>Painted</b> prompt below + Save, then ping Claude.</div>`;

  $("#main").innerHTML = `
    <div class="row" style="align-items:center;justify-content:space-between">
      <div><h1 style="margin:0;font-size:18px">${w.name} ${eo ? '<span class="muted" style="font-size:12px">· engine-only</span>' : ""}</h1>
        <div class="stats" style="margin-top:6px">
          <span>${w.cls} · ${w.grip}</span><span>dmg <b>${w.damage ?? "—"}</b></span><span>cd <b>${w.cooldown ?? "—"}s</b></span>
          <span class="muted">${state.paintedVfx ? `painted: ${w.vfxSubject}` : "no painted subject"}</span>
          ${state.author.pending ? '<span class="pending">⏳ awaiting Claude</span>' : ""}</div></div>
    </div>

    <div class="showcase3">
      ${panel("weapon", "Weapon", state.weaponArt ? `<img src="${state.weaponArt}" />` : `<div class="ph">no sprite</div>`)}
      ${panel("painted", "Painted VFX", paintedPanel)}
      ${panel("engine", "Engine VFX", `<div class="stage" id="stageEngine"></div>`)}
    </div>

    <div class="abox ${eo ? "disabled" : ""}" style="margin-top:10px">
      <h3>① Painted VFX — your words</h3>
      <div class="hint">${eo ? "Disabled for this class (engine-only)." : "Describe the EFFECT to paint (not the weapon). Claude audits it against the art rules (faces right · no baked particles/glow · simple flat-cel · uses the weapon as reference · doesn't draw the weapon) before generating."}</div>
      <textarea id="aPainted" ${eo ? "disabled" : ""} placeholder="e.g. a short, brutal rusty cleave-gash arc, chunky, a few orange sparks…">${esc(state.author.painted)}</textarea>
    </div>

    <div class="enginework">
      <div class="ework-left panel">
        <div class="ptitle"><span>Combined · attack</span><span class="sp"></span><button data-edit="combined">✎ edit</button></div>
        <div class="pbody" id="combinedBody"><div class="stage" id="stageCombined"></div>
          <div id="originOverlay" class="originoverlay"></div>
          <div id="originMark" class="originmark"></div></div>
        <div class="pedit" data-pedit="combined">
          <textarea placeholder="What's wrong with the combined attack?">${esc(state.author.edits?.combined || "")}</textarea>
          <div class="erow"><button data-savepanel="combined" class="primary">Save note</button><span class="muted" data-panelstatus="combined"></span></div>
        </div>
        <div class="rotrow" style="padding:7px 9px 2px">
          <button id="replay">↻ Replay</button>
          <span class="muted" style="margin-left:6px">Rotate painted:</span>
          <button id="rotL">⟲</button><span id="rotVal" class="rotval">${state.rot}°</span><button id="rotR">⟳</button><button id="rot0">0</button>
        </div>
        <div class="rotrow" style="padding:0 9px 4px">
          <span class="muted" title="§10 displayLength — the weapon's in-game on-screen size">Weapon size:</span>
          <input id="wsize" type="range" min="40" max="360" step="5" value="${state.displayLength}" style="flex:1;accent-color:var(--rust)"/>
          <span id="wsizeVal" class="rotval">${state.displayLength}</span>
          <label class="muted" title="§10 delivery — RMB hurls a spinning projectile instead of a melee swing" style="display:flex;align-items:center;gap:4px;margin-left:10px">
            <input id="wthrown" type="checkbox" ${state.weapon?.thrown ? "checked" : ""}/>Thrown</label>
        </div>
        <div class="rotrow" style="padding:0 9px 8px">
          <span class="muted" title="§14 fixed VFX/AoE size (px) — static per weapon, NEVER scaled by level/stat/augment">VFX size:</span>
          <input id="vfxsize" type="range" min="40" max="200" step="2" value="${state.vfxRadius}" style="flex:1;accent-color:var(--gold)"/>
          <span id="vfxsizeVal" class="rotval">${state.vfxRadius}</span>
        </div>
        <div class="rotrow" style="padding:0 9px 8px;flex-wrap:wrap">
          <span class="muted" title="§14 where this weapon's VFX spawns — click ⌖ then click the preview to place the origin">VFX origin:</span>
          <button id="originPick" type="button">⌖ place</button>
          <span id="originVal" class="rotval" style="min-width:64px">${state.vfxOrigin.x},${state.vfxOrigin.y}</span>
          <button id="originReset" type="button">reset</button>
          <label class="muted" title="§14 spawn the VFX at the IN-GAME cursor (like the greatsword quake) instead of at the weapon" style="display:flex;align-items:center;gap:4px;margin-left:8px">
            <input id="spawnCursor" type="checkbox" ${state.spawnAtCursor ? "checked" : ""}/>at cursor</label>
        </div>
      </div>
      <div class="ework-right">
        <div class="abox">
          <h3>② Engine VFX — your words</h3>
          <div class="hint">Describe the engine MOTION (sparks, dust, muzzle flash, bullets, impact, glow, how it enters/exits). Claude turns your words into the in-world VFX.</div>
          <textarea id="aEngine" placeholder="e.g. on hit, a burst of orange sparks + a quick dust puff + a small white flash, no grow-in…">${esc(state.author.engine)}</textarea>
          <div style="margin-top:8px"><button id="saveAuthor" class="primary">Save &amp; request Claude</button> <span id="authorStatus" class="muted"></span></div>
        </div>
        <div class="abox" style="margin-top:12px">
          <h3>③ Abilities &amp; Mechanics</h3>
          <div class="hint">What the weapon DOES (not how it looks). Claude keeps the description current as it builds behavior; tell it what to make happen and it implements the mechanic (server + VFX). Per §14, abilities scale DAMAGE but never size/AoE.</div>
          <label class="alabel">Description — what it does <span class="muted">(editable · Claude keeps this in sync)</span></label>
          <textarea id="aDesc" placeholder="(empty — Claude fills this in as the weapon's behavior is built)">${esc(state.description)}</textarea>
          <div style="margin:6px 0 12px"><button id="saveDesc">💾 Save description</button> <span id="descStatus" class="muted"></span></div>
          <label class="alabel">Make it happen — notes for Claude</label>
          <textarea id="aMech" placeholder="e.g. the meteors from Wyrmtooth need to explode on impact — small fiery AoE that also damages nearby enemies…">${esc(state.author.mechanics || "")}</textarea>
          <div style="margin-top:8px"><button id="saveMech" class="primary">Save &amp; request Claude</button> <span id="mechStatus" class="muted"></span></div>
        </div>
      </div>
    </div>

    <details class="adv">
      <summary>Painted candidates / reroll ${eo ? "(n/a)" : ""}</summary>
      <div class="cands" id="cands" style="margin-top:8px"></div>
      <div class="reroll" ${eo ? 'style="display:none"' : ""}>
        <div class="muted" style="margin-bottom:6px">Reroll the painted candidates (Codex):</div>
        <textarea id="prompt" rows="2">${esc(w.prompt)}</textarea>
        <div style="margin-top:8px"><button id="reroll" class="primary">⟳ Reroll 3</button> <span id="rerollStatus" class="muted"></span></div>
        <pre class="log" id="rerollLog"></pre>
      </div>
    </details>
  `;

  if (!eo) renderCandidates();
  wirePanelEdits();
  $("#replay").onclick = () => pushAllEngines();
  $("#rotL").onclick = () => stepRot(-15);
  $("#rotR").onclick = () => stepRot(15);
  $("#rot0").onclick = () => {
    state.rot = 0;
    $("#rotVal").textContent = "0°";
    pushRotAll();
  };
  const ws = $("#wsize");
  if (ws) {
    ws.oninput = (e) => {
      state.displayLength = +e.target.value;
      $("#wsizeVal").textContent = state.displayLength;
      engines.combined?.engine?.setWeaponSprite(state.weaponArt, {
        thrown: !!state.weapon?.thrown,
        displayLength: state.displayLength,
      });
    };
    ws.onchange = saveSize; // persist on release
  }
  const wt = $("#wthrown");
  if (wt) {
    wt.onchange = (e) => {
      state.weapon.thrown = e.target.checked;
      engines.combined?.engine?.setWeaponSprite(state.weaponArt, {
        thrown: !!state.weapon.thrown,
        displayLength: state.displayLength,
      });
      api("/api/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ weaponId: state.weapon.id, thrown: e.target.checked }),
      });
    };
  }
  const vs = $("#vfxsize");
  if (vs) {
    vs.oninput = (e) => {
      state.vfxRadius = +e.target.value;
      $("#vfxsizeVal").textContent = state.vfxRadius;
      for (const k of Object.keys(engines)) engines[k].engine.setVfxRadius?.(state.vfxRadius);
    };
    vs.onchange = saveVfxRadius; // persist on release
  }
  wireOrigin(); // §14 VFX-origin picker (click-to-place + at-cursor)
  const aPainted = $("#aPainted");
  if (aPainted) aPainted.oninput = (e) => (state.author.painted = e.target.value);
  $("#aEngine").oninput = (e) => (state.author.engine = e.target.value);
  $("#saveAuthor").onclick = saveAuthor;
  $("#aDesc").oninput = (e) => (state.description = e.target.value);
  $("#aMech").oninput = (e) => (state.author.mechanics = e.target.value);
  $("#saveDesc").onclick = saveDescription;
  $("#saveMech").onclick = saveMechanics;
  const rr = $("#reroll");
  if (rr) rr.onclick = doReroll;
}

function panel(key, title, inner) {
  return `<div class="panel" data-panel="${key}">
    <div class="ptitle"><span>${title}</span><span class="sp"></span><button data-edit="${key}">✎ edit</button></div>
    <div class="pbody">${inner}</div>
    <div class="pedit" data-pedit="${key}">
      <textarea placeholder="What's wrong / what to change for the ${title.toLowerCase()}?">${esc(state.author.edits?.[key] || "")}</textarea>
      <div class="erow"><button data-savepanel="${key}" class="primary">Save note</button><span class="muted" data-panelstatus="${key}"></span></div>
    </div>
  </div>`;
}

function wirePanelEdits() {
  for (const b of document.querySelectorAll("[data-edit]")) {
    b.onclick = () => $(`[data-pedit="${b.dataset.edit}"]`).classList.toggle("open");
  }
  for (const b of document.querySelectorAll("[data-savepanel]")) {
    b.onclick = async () => {
      const key = b.dataset.savepanel;
      const txt = $(`[data-pedit="${key}"] textarea`).value;
      state.author.edits[key] = txt;
      const st = $(`[data-panelstatus="${key}"]`);
      st.textContent = "saving…";
      await api("/api/author", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weaponId: state.weapon.id, edits: { [key]: txt }, pending: true }),
      });
      st.textContent = "✓ saved — ping Claude";
      loadList();
    };
  }
}

async function saveAuthor() {
  if (!state.weapon) return;
  $("#authorStatus").innerHTML = `<span class="spin"></span> saving…`;
  await api("/api/author", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      weaponId: state.weapon.id,
      painted: state.author.painted,
      engine: state.author.engine,
      pending: true,
    }),
  });
  state.author.pending = true;
  $("#authorStatus").textContent = "✓ saved — now tell Claude to process it";
  loadList();
}

// Persist the living description (no pending flag — a plain doc edit, not a behavior request).
async function saveDescription() {
  if (!state.weapon) return;
  $("#descStatus").textContent = "saving…";
  await api("/api/author", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ weaponId: state.weapon.id, description: state.description }),
  });
  $("#descStatus").textContent = "✓ saved";
  setTimeout(() => {
    const s = $("#descStatus");
    if (s) s.textContent = "";
  }, 1500);
}

// Save the abilities/mechanics REQUEST + the current description, and flag it pending so Claude knows
// to implement it (weapons.ts behavior block + server resolve + VFX), then update the description.
async function saveMechanics() {
  if (!state.weapon) return;
  $("#mechStatus").innerHTML = `<span class="spin"></span> saving…`;
  await api("/api/author", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      weaponId: state.weapon.id,
      mechanics: state.author.mechanics,
      description: state.description,
      pending: true,
    }),
  });
  state.author.pending = true;
  $("#mechStatus").textContent = "✓ saved — now tell Claude to make it happen";
  loadList();
}

const stepRot = (d) => {
  state.rot = (((state.rot + d) % 360) + 360) % 360;
  $("#rotVal").textContent = `${state.rot}°`;
  pushRotAll();
};

// Persist the weapon size (§10 displayLength). Canonical for coded weapons lives in weapons.ts; this
// stores the tool's authored value (ping Claude to sync it into weapons.ts when you're happy).
async function saveSize() {
  if (!state.weapon) return;
  await api("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ weaponId: state.weapon.id, displayLength: state.displayLength }),
  });
  status(`✓ size ${state.displayLength}`);
  setTimeout(() => status(""), 1500);
}

// Persist the FIXED VFX size (§14 vfxRadius, px). Static per weapon — never scaled by level/stat/augment.
// Reaches the game after re-running `node tools/artkit/build-weapon-vfx.mjs` (bakes it into the client).
async function saveVfxRadius() {
  if (!state.weapon) return;
  await api("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ weaponId: state.weapon.id, vfxRadius: state.vfxRadius }),
  });
  status(`✓ VFX size ${state.vfxRadius}`);
  setTimeout(() => status(""), 1500);
}

// §14 VFX-origin picker. The Combined preview maps to ±ORIGIN_RANGE game px across its half-width, so a
// click anywhere in the preview becomes a game-px offset from the weapon anchor (eyeballed; tune in-game).
const ORIGIN_RANGE = 160;
function positionOriginMark() {
  const m = $("#originMark");
  if (!m) return;
  const leftPct = 50 + (state.vfxOrigin.x / ORIGIN_RANGE) * 50;
  const topPct = 50 + (state.vfxOrigin.y / ORIGIN_RANGE) * 50;
  m.style.left = `${leftPct}%`;
  m.style.top = `${topPct}%`;
  const show = state.originPlacing || state.vfxOrigin.x !== 0 || state.vfxOrigin.y !== 0;
  m.style.display = show ? "block" : "none";
}
function setOriginPlacing(on) {
  state.originPlacing = on;
  const ov = $("#originOverlay");
  if (ov) ov.classList.toggle("active", on);
  const btn = $("#originPick");
  if (btn) btn.classList.toggle("primary", on);
  positionOriginMark();
}
function wireOrigin() {
  const ov = $("#originOverlay");
  const pick = $("#originPick");
  const reset = $("#originReset");
  const cur = $("#spawnCursor");
  if (pick) pick.onclick = () => setOriginPlacing(!state.originPlacing);
  if (ov)
    ov.onclick = (e) => {
      if (!state.originPlacing) return;
      const r = ov.getBoundingClientRect();
      const fx = (e.clientX - r.left) / r.width - 0.5; // [-0.5, 0.5]
      const fy = (e.clientY - r.top) / r.height - 0.5;
      state.vfxOrigin = {
        x: Math.round(fx * 2 * ORIGIN_RANGE),
        y: Math.round(fy * 2 * ORIGIN_RANGE),
      };
      $("#originVal").textContent = `${state.vfxOrigin.x},${state.vfxOrigin.y}`;
      setOriginPlacing(false);
      saveVfxOrigin();
    };
  if (reset)
    reset.onclick = () => {
      state.vfxOrigin = { x: 0, y: 0 };
      $("#originVal").textContent = "0,0";
      positionOriginMark();
      saveVfxOrigin();
    };
  if (cur)
    cur.onchange = (e) => {
      state.spawnAtCursor = e.target.checked;
      saveVfxOrigin();
    };
  positionOriginMark();
}

// Persist the authored VFX origin + spawn-at-cursor flag. Reaches the game after re-running
// `node tools/artkit/build-weapon-vfx.mjs` (bakes them into weapon-vfx.generated.ts).
async function saveVfxOrigin() {
  if (!state.weapon) return;
  await api("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      weaponId: state.weapon.id,
      vfxOrigin: state.vfxOrigin,
      spawnAtCursor: state.spawnAtCursor,
    }),
  });
  status(
    `✓ origin ${state.vfxOrigin.x},${state.vfxOrigin.y}${state.spawnAtCursor ? " · at cursor" : ""}`,
  );
  setTimeout(() => status(""), 1500);
}

function renderCandidates() {
  const c = $("#cands");
  if (!c) return;
  c.innerHTML = "";
  if (!state.candidates.length) {
    c.innerHTML = `<div class="muted">No painted candidates yet.</div>`;
    return;
  }
  for (const file of state.candidates) {
    const node = el(
      `<div class="cand ${file === state.image ? "sel" : ""}"><img src="/art/${state.vfxSubject}/${file}" /><span class="tick">✓</span></div>`,
    );
    node.onclick = () => {
      state.image = file;
      renderCandidates();
      const pi = $("#paintedImg");
      if (pi) pi.src = `/art/${state.vfxSubject}/${file}`;
      pushHeroAll();
    };
    c.appendChild(node);
  }
}

// ---- reroll painted candidates ----
async function doReroll() {
  const btn = $("#reroll");
  btn.disabled = true;
  const prompt = $("#prompt").value;
  $("#rerollStatus").innerHTML = `<span class="spin"></span> Codex…`;
  $("#rerollLog").style.display = "block";
  const { jobId, error } = await api("/api/reroll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ weaponId: state.weapon.id, prompt, candidates: 3 }),
  });
  if (error) {
    $("#rerollStatus").textContent = `error: ${error}`;
    btn.disabled = false;
    return;
  }
  const poll = setInterval(async () => {
    const j = await api(`/api/job/${jobId}`);
    $("#rerollLog").textContent = j.log || "";
    if (j.status === "running") {
      $("#rerollStatus").innerHTML = `<span class="spin"></span> generating…`;
      return;
    }
    clearInterval(poll);
    btn.disabled = false;
    if (j.status === "done") {
      state.candidates = j.candidates;
      if (!state.candidates.includes(state.image)) state.image = state.candidates[0] || null;
      $("#rerollStatus").textContent = `✓ ${j.candidates.length} candidates`;
      renderCandidates();
      const pi = $("#paintedImg");
      if (pi && state.image) pi.src = `/art/${state.vfxSubject}/${state.image}`;
      pushHeroAll();
      loadList();
    } else $("#rerollStatus").textContent = "failed — see log";
  }, 1500);
}

// ---- save the engine suite + rotation (the authored result) ----
$("#save").onclick = async () => {
  if (!state.weapon) return;
  status(`<span class="spin"></span> saving…`);
  const suite = {};
  for (const lid in state.suite)
    suite[lid] = { on: state.suite[lid].on, params: state.suite[lid].params };
  const r = await api("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      weaponId: state.weapon.id,
      image: state.image,
      suite,
      rot: state.rot,
      displayLength: state.displayLength,
      vfxRadius: state.vfxRadius,
    }),
  });
  status(r.ok ? `✓ saved ${state.weapon.name}` : "save failed");
  loadList();
  setTimeout(() => status(""), 2500);
};

loadList();
