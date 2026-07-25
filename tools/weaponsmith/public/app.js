// Weaponsmith Armory Panel - full-catalog production workspace.
// The editor keeps exactly two persistent Phaser/WebGL previews: Engine and Combined.
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const api = async (path, options) => {
  const response = await fetch(path, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
};
const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const pretty = (value) =>
  String(value || "")
    .replaceAll("generated-default", "Generated")
    .replaceAll("bespoke-file", "Bespoke")
    .replaceAll(/[-_/]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const ART_STATUS = {
  ready: { label: "READY", icon: '<path d="M5 12l4 4L19 6" />' },
  rendering: {
    label: "ART RENDERING",
    icon: '<path d="M7 3h10M7 21h10M8 3c0 5 3 5 4 9-1 4-4 4-4 9M16 3c0 5-3 5-4 9 1 4 4 4 4 9" />',
  },
  unavailable: {
    label: "UNAVAILABLE",
    icon: '<path d="M12 3L2.8 20h18.4L12 3zM12 9v5M12 17h.01" />',
  },
  artless: { label: "ARTLESS", icon: '<circle cx="12" cy="12" r="8" />' },
};
const iconSvg = (body) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const statusChipHtml = (status) => {
  const key = ART_STATUS[status] ? status : "artless";
  return `<span class="status-chip ${key}">${iconSvg(ART_STATUS[key].icon)}${ART_STATUS[key].label}</span>`;
};
const assignmentLabel = (assignment) => {
  if (assignment?.status === "bespoke-file") return "Bespoke";
  if (assignment?.status === "generated-default") return "Generated";
  return "None";
};

const state = {
  weapon: null,
  image: null,
  suite: {},
  rot: 0,
  displayLength: 90,
  vfxRadius: 74,
  vfxOrigin: { x: 0, y: 0 },
  spawnAtCursor: false,
  originPlacing: false,
  candidates: [],
  vfxSubject: null,
  weaponArt: null,
  engineOnly: false,
  paintedVfx: false,
  description: "",
  author: { painted: "", engine: "", mechanics: "", edits: {} },
  viewTab: "combined",
  dirtyFields: new Set(),
};

const HAVE_ENGINE = Boolean(window.VFXEngine && window.Phaser);
const engines = {};
function ensureEngine(key, heroEnabled) {
  if (!engines[key]) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:absolute;inset:0";
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
function mountPanelEngine(key, stageSelector, heroEnabled) {
  if (!HAVE_ENGINE) return;
  const { engine, wrap } = ensureEngine(key, heroEnabled);
  const stage = $(stageSelector);
  if (!stage) return;
  stage.appendChild(wrap);
  engine.refresh();
  engine.setHeroEnabled(heroEnabled);
  engine.setSuite(state.suite, state.rot);
  engine.setVfxRadius?.(state.vfxRadius);
  engine.setHero(heroUrl());
  if (key === "combined" && engine.setActors) {
    engine.setActors("/character-sprite/dust-ranger/body.png", "/character-sprite/dummy/body.png");
    engine.setWeaponSprite(state.weaponArt, {
      thrown: Boolean(state.weapon?.thrown),
      displayLength: state.displayLength,
    });
  }
  engine.setScatter?.(state.weapon?.scatter || null);
  engine.replay();
  updateDebug();
}
function pushAllEngines() {
  for (const { engine } of Object.values(engines)) {
    engine.setSuite(state.suite, state.rot);
    engine.setVfxRadius?.(state.vfxRadius);
    engine.setHero(heroUrl());
    engine.replay();
  }
}
function pushHeroAll() {
  for (const { engine } of Object.values(engines)) engine.setHero(heroUrl());
}
function pushRotAll() {
  for (const { engine } of Object.values(engines)) engine.setRot(state.rot);
}
function defaultSuite() {
  const suite = {};
  for (const [layerId, layer] of Object.entries(window.VFXLAYERS?.LAYERS || {})) {
    const params = {};
    for (const parameter of layer.params) params[parameter.key] = parameter.def;
    suite[layerId] = { on: false, params };
  }
  return suite;
}

const FILTER_IDS = [
  ["classFilter", "cls"],
  ["familyFilter", "family"],
  ["deliveryFilter", "delivery"],
  ["gripFilter", "grip"],
  ["elementFilter", "element"],
  ["sourceFilter", "source"],
];
const ROW_HEIGHT = 68;
let allWeapons = [];
let filteredWeapons = [];
let listFocusIndex = 0;
let selectionRequest = 0;
let listRenderFrame = 0;

function populateFilterOptions() {
  for (const [selectId, key] of FILTER_IDS) {
    const select = $(`#${selectId}`);
    const previous = select.value;
    select.replaceChildren(new Option("All", "all"));
    const values = [
      ...new Set(
        allWeapons
          .map((weapon) => weapon[key])
          .filter(Boolean)
          .map(String),
      ),
    ].sort((a, b) => a.localeCompare(b));
    for (const value of values) select.appendChild(new Option(pretty(value), value));
    select.value = values.includes(previous) ? previous : "all";
  }
}
function listMatches(weapon) {
  const query = $("#weaponSearch").value.trim().toLowerCase();
  const queryValues = [
    weapon.name,
    weapon.id,
    weapon.cls,
    weapon.grip,
    weapon.family,
    weapon.delivery,
    weapon.element,
    weapon.source,
    ...(weapon.tags || []),
  ];
  if (
    query &&
    !queryValues.filter(Boolean).some((value) => String(value).toLowerCase().includes(query))
  )
    return false;
  for (const [selectId, key] of FILTER_IDS) {
    const selected = $(`#${selectId}`).value;
    if (selected !== "all" && String(weapon[key]) !== selected) return false;
  }
  const assignment = $("#assignmentFilter").value;
  if (assignment !== "all" && weapon.assignment?.status !== assignment) return false;
  const art = $("#artFilter").value;
  return art === "all" || weapon.artStatus === art;
}
function filterWeapons() {
  filteredWeapons = allWeapons.filter(listMatches);
  const selectedIndex = filteredWeapons.findIndex((weapon) => weapon.id === state.weapon?.id);
  if (selectedIndex >= 0) listFocusIndex = selectedIndex;
  else listFocusIndex = Math.min(listFocusIndex, Math.max(0, filteredWeapons.length - 1));
  $("#listCount").textContent = `${filteredWeapons.length} / ${allWeapons.length}`;
  $("#listViewport").setAttribute("aria-setsize", String(filteredWeapons.length));
}
function scheduleListWindow() {
  cancelAnimationFrame(listRenderFrame);
  listRenderFrame = requestAnimationFrame(renderListWindow);
}
function renderListWindow() {
  const viewport = $("#listViewport");
  const spacer = $("#listSpacer");
  const windowNode = $("#listWindow");
  spacer.style.height = `${Math.max(viewport.clientHeight, filteredWeapons.length * ROW_HEIGHT)}px`;
  windowNode.replaceChildren();
  if (!filteredWeapons.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML =
      "<strong>No matches</strong><span>Clear one or more filters to restore the roster.</span>";
    empty.style.height = `${viewport.clientHeight}px`;
    windowNode.appendChild(empty);
    updateDebug(0);
    return;
  }
  const visibleRows = Math.ceil(viewport.clientHeight / ROW_HEIGHT);
  const start = Math.max(0, Math.floor(viewport.scrollTop / ROW_HEIGHT) - 2);
  const end = Math.min(filteredWeapons.length, start + Math.min(30, visibleRows + 4));
  if (document.activeElement === viewport && (listFocusIndex < start || listFocusIndex >= end)) {
    listFocusIndex = start;
  }
  const fragment = document.createDocumentFragment();
  for (let index = start; index < end; index += 1) {
    const weapon = filteredWeapons[index];
    const row = document.createElement("div");
    row.id = `weapon-option-${weapon.id}`;
    row.className =
      "weapon-option" +
      (weapon.id === state.weapon?.id ? " selected" : "") +
      (index === listFocusIndex ? " focused" : "");
    row.style.top = `${index * ROW_HEIGHT + 2}px`;
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", weapon.id === state.weapon?.id ? "true" : "false");
    row.setAttribute("aria-posinset", String(index + 1));
    row.setAttribute("aria-setsize", String(filteredWeapons.length));
    row.innerHTML = `<div><div class="weapon-name">${escapeHtml(weapon.name)}</div><div class="weapon-meta">${escapeHtml(pretty(weapon.cls))} · ${escapeHtml(pretty(weapon.family))} · ${escapeHtml(pretty(weapon.delivery))}</div></div><div class="option-chips"><span class="assignment-badge ${weapon.assignment?.status || "none"}">${assignmentLabel(weapon.assignment)}</span>${statusChipHtml(weapon.artStatus)}</div>`;
    row.addEventListener("click", () => {
      listFocusIndex = index;
      void selectWeapon(weapon.id);
      viewport.focus();
    });
    fragment.appendChild(row);
  }
  windowNode.appendChild(fragment);
  const focused = filteredWeapons[listFocusIndex];
  if (focused) viewport.setAttribute("aria-activedescendant", `weapon-option-${focused.id}`);
  updateDebug(end - start);
}
function renderList({ ensureSelection = true } = {}) {
  filterWeapons();
  renderListWindow();
  if (
    ensureSelection &&
    filteredWeapons.length &&
    !filteredWeapons.some((weapon) => weapon.id === state.weapon?.id)
  ) {
    void selectWeapon(filteredWeapons[0].id);
  }
}
async function loadList() {
  try {
    allWeapons = await api("/api/weapons");
    populateFilterOptions();
    renderList();
  } catch (error) {
    showStatus(`Catalog error: ${error.message}`);
  }
}
function moveListFocus(nextIndex, select = false) {
  if (!filteredWeapons.length) return;
  listFocusIndex = Math.max(0, Math.min(filteredWeapons.length - 1, nextIndex));
  const viewport = $("#listViewport");
  const top = listFocusIndex * ROW_HEIGHT;
  if (top < viewport.scrollTop) viewport.scrollTop = top;
  else if (top + ROW_HEIGHT > viewport.scrollTop + viewport.clientHeight)
    viewport.scrollTop = top + ROW_HEIGHT - viewport.clientHeight;
  renderListWindow();
  if (select) void selectWeapon(filteredWeapons[listFocusIndex].id);
}

function resetSelectedState(weapon) {
  state.weapon = weapon;
  state.vfxSubject = weapon.vfxSubject;
  state.candidates = weapon.candidates;
  state.weaponArt = weapon.weaponArt;
  state.engineOnly = Boolean(weapon.engineOnly);
  state.paintedVfx = Boolean(weapon.paintedVfx);
  state.displayLength = weapon.displayLength || 90;
  state.vfxRadius = weapon.vfxRadius || 74;
  const assigned = weapon.assigned || {};
  state.vfxOrigin =
    assigned.vfxOrigin && typeof assigned.vfxOrigin.x === "number"
      ? { ...assigned.vfxOrigin }
      : { x: 0, y: 0 };
  state.spawnAtCursor = Boolean(assigned.spawnAtCursor);
  state.originPlacing = false;
  state.image = assigned.image || weapon.candidates[0] || null;
  state.suite = defaultSuite();
  if (assigned.suite) {
    for (const layerId in assigned.suite) {
      if (!state.suite[layerId]) continue;
      state.suite[layerId].on = assigned.suite[layerId].on;
      Object.assign(state.suite[layerId].params, assigned.suite[layerId].params || {});
    }
  }
  if (weapon.paintedVfx && !weapon.scatter && state.suite["hero-skin"])
    state.suite["hero-skin"].on = true;
  state.rot = assigned.rot || 0;
  state.description = assigned.description || "";
  state.author = {
    painted: assigned.author?.painted || "",
    engine: assigned.author?.engine || "",
    mechanics: assigned.author?.mechanics || "",
    edits: assigned.author?.edits || {},
    pending: assigned.author?.pending,
  };
  state.dirtyFields.clear();
  updateDirtyState();
}
async function selectWeapon(id) {
  const request = ++selectionRequest;
  try {
    const weapon = await api(`/api/weapon/${encodeURIComponent(id)}`);
    if (request !== selectionRequest) return;
    resetSelectedState(weapon);
    const index = filteredWeapons.findIndex((candidate) => candidate.id === id);
    if (index >= 0) listFocusIndex = index;
    updateHeader();
    renderWorkspace();
    renderList({ ensureSelection: false });
    mountPanelEngine("engine", "#stageEngine", false);
    mountPanelEngine("combined", "#stageCombined", true);
    setViewTab(state.viewTab);
  } catch (error) {
    showStatus(`Selection error: ${error.message}`);
  }
}

function showStatus(message, timeout = 0) {
  $("#status").textContent = message || "";
  if (timeout) setTimeout(() => $("#status") && ($("#status").textContent = ""), timeout);
}
function updateHeader() {
  const weapon = state.weapon;
  $("#selectedHeader").textContent = weapon
    ? `${weapon.id} · ${ART_STATUS[weapon.artStatus]?.label || "ARTLESS"}`
    : "No selection";
  $("#save").disabled = !weapon;
  $("#launchSelected").disabled = !weapon;
  if (weapon) {
    $("#save").textContent = weapon.assignment?.hasFile ? "Save weapon" : "Create assignment";
    $("#launchSelected").title = `Open ${weapon.name} in Testing Grounds`;
  }
}
function markDirty(field) {
  state.dirtyFields.add(field);
  updateDirtyState();
}
function clearDirty(...fields) {
  for (const field of fields) state.dirtyFields.delete(field);
  updateDirtyState();
}
function updateDirtyState() {
  const node = $("#dirtyState");
  if (!node) return;
  const dirty = state.dirtyFields.size > 0;
  node.className = `dirty-state ${dirty ? "dirty" : "saved"}`;
  node.textContent = dirty ? `${state.dirtyFields.size} unsaved` : "Saved";
}

function paintedView() {
  if (state.engineOnly)
    return '<div class="preview-placeholder">ARTLESS · this engine-only definition intentionally has no Painted VFX asset.</div>';
  if (state.paintedVfx && state.image)
    return `<img id="paintedImg" src="/art/${escapeHtml(state.vfxSubject)}/${escapeHtml(state.image)}" alt="Selected Painted VFX" />`;
  if (state.weapon?.artStatus === "rendering")
    return '<div class="preview-placeholder">ART RENDERING · the requested Painted VFX is still in flight.</div>';
  if (state.weapon?.artStatus === "unavailable")
    return '<div class="preview-placeholder">UNAVAILABLE · a promised Painted VFX asset could not be loaded.</div>';
  return '<div class="preview-placeholder">ARTLESS · no Painted VFX has been requested for this definition.</div>';
}
function renderStudio() {
  const weapon = state.weapon;
  $("#studio").innerHTML = `
    <div class="studio-heading"><div><div class="eyebrow">Dominant live preview</div><h2>${escapeHtml(weapon.name)}</h2></div>${statusChipHtml(weapon.artStatus)}</div>
    <div class="preview-shell">
      <div>
        <div class="view-tabs" role="tablist" aria-label="Preview view">
          ${["weapon", "painted", "engine", "combined"].map((tab) => `<button type="button" class="view-tab" data-view-tab="${tab}" role="tab">${pretty(tab)}</button>`).join("")}
        </div>
        <div class="preview-square">
          <div class="view-surface" data-view-surface="weapon">${state.weaponArt ? `<img src="${escapeHtml(state.weaponArt)}" alt="${escapeHtml(weapon.name)} weapon sprite" />` : '<div class="preview-placeholder">UNAVAILABLE · weapon sprite could not be loaded.</div>'}</div>
          <div class="view-surface" data-view-surface="painted">${paintedView()}</div>
          <div class="view-surface" data-view-surface="engine"><div class="stage" id="stageEngine"></div></div>
          <div class="view-surface" data-view-surface="combined"><div class="stage" id="stageCombined"></div><div id="originOverlay" class="originoverlay"></div><div id="originMark" class="originmark"></div></div>
          <div class="preview-toolbar"><button type="button" class="button" id="replay">Replay · Q</button><button type="button" class="button" id="rotateLeft">Rotate -15°</button><span id="rotVal" class="metric">${state.rot}°</span><button type="button" class="button" id="rotateRight">Rotate +15°</button></div>
        </div>
      </div>
    </div>
    <div class="reference-strip" aria-label="Reference thumbnails">
      <button type="button" class="reference-card" data-reference="weapon"><span class="reference-thumb">${state.weaponArt ? `<img src="${escapeHtml(state.weaponArt)}" alt="" />` : "No art"}</span><span><span class="reference-title">Weapon</span><span class="hint">Installed game sprite</span></span></button>
      <button type="button" class="reference-card" data-reference="painted"><span class="reference-thumb">${state.paintedVfx && state.image ? `<img src="/art/${escapeHtml(state.vfxSubject)}/${escapeHtml(state.image)}" alt="" />` : ART_STATUS[state.weapon.artStatus]?.label || "ARTLESS"}</span><span><span class="reference-title">Painted</span><span class="hint">Selected candidate</span></span></button>
      <button type="button" class="reference-card" data-reference="engine"><span class="reference-thumb">VFX</span><span><span class="reference-title">Engine</span><span class="hint">Persistent live context</span></span></button>
    </div>`;
  wireStudio();
}
function setViewTab(tab) {
  state.viewTab = ["weapon", "painted", "engine", "combined"].includes(tab) ? tab : "combined";
  $$(`[data-view-tab]`).forEach((button) => {
    const active = button.dataset.viewTab === state.viewTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
    button.tabIndex = active ? 0 : -1;
  });
  $$(`[data-view-surface]`).forEach((surface) =>
    surface.classList.toggle("active", surface.dataset.viewSurface === state.viewTab),
  );
  $$(`[data-reference]`).forEach((button) =>
    button.classList.toggle("active", button.dataset.reference === state.viewTab),
  );
  requestAnimationFrame(() => {
    if (state.viewTab === "engine") engines.engine?.engine.refresh();
    if (state.viewTab === "combined") engines.combined?.engine.refresh();
  });
}
function stepRotation(delta) {
  state.rot = (((state.rot + delta) % 360) + 360) % 360;
  $("#rotVal").textContent = `${state.rot}°`;
  $("#rotationValue") && ($("#rotationValue").textContent = `${state.rot}°`);
  pushRotAll();
  markDirty("rotation");
}
function wireStudio() {
  $$(`[data-view-tab]`).forEach(
    (button) => (button.onclick = () => setViewTab(button.dataset.viewTab)),
  );
  $$(`[data-reference]`).forEach(
    (button) => (button.onclick = () => setViewTab(button.dataset.reference)),
  );
  $("#replay").onclick = pushAllEngines;
  $("#rotateLeft").onclick = () => stepRotation(-15);
  $("#rotateRight").onclick = () => stepRotation(15);
}

function renderInspector() {
  const weapon = state.weapon;
  const assignment = weapon.assignment || { status: "none", hasFile: false };
  $("#inspector").innerHTML = `
    <div class="inspector-header"><div class="eyebrow">Selected definition</div><h2>${escapeHtml(weapon.name)}</h2><div class="inspector-id">${escapeHtml(weapon.id)}</div>${statusChipHtml(weapon.artStatus)}</div>
    <details class="accordion" open><summary>Overview</summary><div class="accordion-body"><dl class="facts-list"><dt>Class</dt><dd>${escapeHtml(pretty(weapon.cls))}</dd><dt>Family</dt><dd>${escapeHtml(pretty(weapon.family))}</dd><dt>Delivery</dt><dd>${escapeHtml(pretty(weapon.delivery))}</dd><dt>Grip</dt><dd>${escapeHtml(pretty(weapon.grip))}</dd><dt>Element</dt><dd>${escapeHtml(pretty(weapon.element))}</dd><dt>Source</dt><dd>${escapeHtml(pretty(weapon.source))}</dd><dt>Damage</dt><dd>${weapon.damage ?? "—"}</dd><dt>Cooldown</dt><dd>${weapon.cooldown ?? "—"}s</dd></dl></div></details>
    <details class="accordion" open><summary>Assignment</summary><div class="accordion-body"><div class="control-row"><span id="selectedAssignmentStatus" class="assignment-badge ${assignment.status}">${assignmentLabel(assignment)}</span>${assignment.hasFile ? "" : '<button type="button" id="createAssignment" class="button secondary">Create assignment</button>'}</div><div class="hint">Assignment state and art state are separate. Generated defaults are not bespoke files.</div></div></details>
    <details class="accordion"><summary>Origin / Scale / Thrown</summary><div class="accordion-body">
      <label class="field">Weapon size<div class="control-row"><input id="wsize" type="range" min="40" max="360" step="5" value="${state.displayLength}" /><span id="wsizeVal" class="metric">${state.displayLength}</span></div></label>
      <label class="field">VFX size<div class="control-row"><input id="vfxsize" type="range" min="40" max="240" step="2" value="${state.vfxRadius}" /><span id="vfxsizeVal" class="metric">${state.vfxRadius}</span></div></label>
      <div class="field">Painted rotation<div class="control-row"><button type="button" class="button" id="rotL">-15°</button><span id="rotationValue" class="metric">${state.rot}°</span><button type="button" class="button" id="rotR">+15°</button><button type="button" class="button" id="rot0">Reset</button></div></div>
      <div class="field">VFX origin<div class="control-row"><button type="button" class="button" id="originPick">Place on Combined</button><span id="originVal" class="metric">${state.vfxOrigin.x},${state.vfxOrigin.y}</span><button type="button" class="button" id="originReset">Reset</button></div></div>
      <label class="control-row"><input id="wthrown" type="checkbox" ${weapon.thrown ? "checked" : ""} /> Thrown delivery</label>
      <label class="control-row"><input id="spawnCursor" type="checkbox" ${state.spawnAtCursor ? "checked" : ""} /> Spawn VFX at cursor</label>
    </div></details>
    <details class="accordion"><summary>Prompt</summary><div class="accordion-body">
      <label class="field">Painted VFX prompt<textarea id="aPainted" ${state.engineOnly ? "disabled" : ""} placeholder="Describe the effect to paint, not the weapon.">${escapeHtml(state.author.painted)}</textarea></label>
      <label class="field">Engine VFX prompt<textarea id="aEngine" placeholder="Describe motion, particles, timing, and impact.">${escapeHtml(state.author.engine)}</textarea></label>
      <div class="control-row"><button type="button" id="saveAuthor" class="button primary">Save prompts & request</button><span id="authorStatus" class="hint"></span></div>
      <label class="field">Description<textarea id="aDesc" placeholder="Living description of what this weapon does.">${escapeHtml(state.description)}</textarea></label>
      <div class="control-row"><button type="button" id="saveDesc" class="button secondary">Save description</button><span id="descStatus" class="hint"></span></div>
      <label class="field">Abilities and mechanics request<textarea id="aMech" placeholder="Describe behavior to implement.">${escapeHtml(state.author.mechanics)}</textarea></label>
      <div class="control-row"><button type="button" id="saveMech" class="button primary">Save mechanics & request</button><span id="mechStatus" class="hint"></span></div>
      ${["weapon", "painted", "engine", "combined"].map((key) => `<label class="field">${pretty(key)} review note<textarea data-edit-note="${key}" placeholder="What should change in this view?">${escapeHtml(state.author.edits?.[key] || "")}</textarea><span><button type="button" class="button secondary" data-savepanel="${key}">Save ${pretty(key)} note</button> <span class="hint" data-panelstatus="${key}"></span></span></label>`).join("")}
    </div></details>
    <details class="accordion"><summary>Candidate history</summary><div class="accordion-body"><div id="cands" class="candidate-grid"></div>${state.engineOnly ? '<div class="hint">Painted candidates are intentionally disabled for this engine-only class.</div>' : `<label class="field">Reroll prompt<textarea id="prompt">${escapeHtml(weapon.prompt)}</textarea></label><div class="control-row"><button type="button" id="reroll" class="button primary">Reroll 3 candidates</button><span id="rerollStatus" class="hint"></span></div><pre class="log" id="rerollLog" hidden></pre>`}</div></details>
    <div class="inspector-actions"><button type="button" id="inspectorLaunch" class="button secondary">Open in Testing Grounds</button><button type="button" id="inspectorSave" class="button primary">${assignment.hasFile ? "Save weapon" : "Create assignment"}</button></div>`;
  renderCandidates();
  wireInspector();
}
function renderWorkspace() {
  renderStudio();
  renderInspector();
}

function wireInspector() {
  $("#createAssignment") && ($("#createAssignment").onclick = saveAll);
  $("#inspectorLaunch").onclick = launchSelected;
  $("#inspectorSave").onclick = saveAll;
  $("#rotL").onclick = () => stepRotation(-15);
  $("#rotR").onclick = () => stepRotation(15);
  $("#rot0").onclick = () => {
    state.rot = 0;
    $("#rotationValue").textContent = "0°";
    $("#rotVal").textContent = "0°";
    pushRotAll();
    markDirty("rotation");
  };
  const weaponSize = $("#wsize");
  weaponSize.oninput = (event) => {
    state.displayLength = Number(event.target.value);
    $("#wsizeVal").textContent = state.displayLength;
    engines.combined?.engine.setWeaponSprite(state.weaponArt, {
      thrown: Boolean(state.weapon?.thrown),
      displayLength: state.displayLength,
    });
    markDirty("weapon size");
  };
  weaponSize.onchange = saveSize;
  const vfxSize = $("#vfxsize");
  vfxSize.oninput = (event) => {
    state.vfxRadius = Number(event.target.value);
    $("#vfxsizeVal").textContent = state.vfxRadius;
    for (const { engine } of Object.values(engines)) engine.setVfxRadius?.(state.vfxRadius);
    markDirty("VFX size");
  };
  vfxSize.onchange = saveVfxRadius;
  $("#wthrown").onchange = async (event) => {
    state.weapon.thrown = event.target.checked;
    engines.combined?.engine.setWeaponSprite(state.weaponArt, {
      thrown: Boolean(state.weapon.thrown),
      displayLength: state.displayLength,
    });
    await saveFields({ thrown: event.target.checked });
  };
  wireOrigin();
  $("#aPainted") &&
    ($("#aPainted").oninput = (event) => {
      state.author.painted = event.target.value;
      markDirty("painted prompt");
    });
  $("#aEngine").oninput = (event) => {
    state.author.engine = event.target.value;
    markDirty("engine prompt");
  };
  $("#aDesc").oninput = (event) => {
    state.description = event.target.value;
    markDirty("description");
  };
  $("#aMech").oninput = (event) => {
    state.author.mechanics = event.target.value;
    markDirty("mechanics");
  };
  $("#saveAuthor").onclick = saveAuthor;
  $("#saveDesc").onclick = saveDescription;
  $("#saveMech").onclick = saveMechanics;
  $$(`[data-edit-note]`).forEach((textarea) => {
    textarea.oninput = () => {
      state.author.edits[textarea.dataset.editNote] = textarea.value;
      markDirty(`${textarea.dataset.editNote} note`);
    };
  });
  $$(`[data-savepanel]`).forEach(
    (button) => (button.onclick = () => savePanelNote(button.dataset.savepanel)),
  );
  $("#reroll") && ($("#reroll").onclick = doReroll);
}

async function saveFields(fields) {
  if (!state.weapon) return null;
  const response = await api("/api/save", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ weaponId: state.weapon.id, ...fields }),
  });
  state.weapon.assigned = response.assigned;
  state.weapon.assignment = response.assignment;
  return response;
}
async function saveSize() {
  await saveFields({ displayLength: state.displayLength });
  clearDirty("weapon size");
  showStatus(`Saved weapon size ${state.displayLength}`, 1600);
}
async function saveVfxRadius() {
  await saveFields({ vfxRadius: state.vfxRadius });
  clearDirty("VFX size");
  showStatus(`Saved VFX size ${state.vfxRadius}`, 1600);
}

const ORIGIN_RANGE = 160;
function positionOriginMark() {
  const mark = $("#originMark");
  if (!mark) return;
  mark.style.left = `${50 + (state.vfxOrigin.x / ORIGIN_RANGE) * 50}%`;
  mark.style.top = `${50 + (state.vfxOrigin.y / ORIGIN_RANGE) * 50}%`;
  mark.style.display =
    state.originPlacing || state.vfxOrigin.x !== 0 || state.vfxOrigin.y !== 0 ? "block" : "none";
}
function setOriginPlacing(on) {
  state.originPlacing = on;
  $("#originOverlay")?.classList.toggle("active", on);
  $("#originPick")?.classList.toggle("primary", on);
  positionOriginMark();
}
function wireOrigin() {
  $("#originPick").onclick = () => {
    setViewTab("combined");
    setOriginPlacing(!state.originPlacing);
  };
  $("#originOverlay").onclick = async (event) => {
    if (!state.originPlacing) return;
    const rect = event.currentTarget.getBoundingClientRect();
    state.vfxOrigin = {
      x: Math.round(((event.clientX - rect.left) / rect.width - 0.5) * 2 * ORIGIN_RANGE),
      y: Math.round(((event.clientY - rect.top) / rect.height - 0.5) * 2 * ORIGIN_RANGE),
    };
    $("#originVal").textContent = `${state.vfxOrigin.x},${state.vfxOrigin.y}`;
    setOriginPlacing(false);
    await saveVfxOrigin();
  };
  $("#originReset").onclick = async () => {
    state.vfxOrigin = { x: 0, y: 0 };
    $("#originVal").textContent = "0,0";
    positionOriginMark();
    await saveVfxOrigin();
  };
  $("#spawnCursor").onchange = async (event) => {
    state.spawnAtCursor = event.target.checked;
    await saveVfxOrigin();
  };
  positionOriginMark();
}
async function saveVfxOrigin() {
  await saveFields({ vfxOrigin: state.vfxOrigin, spawnAtCursor: state.spawnAtCursor });
  showStatus(
    `Saved origin ${state.vfxOrigin.x},${state.vfxOrigin.y}${state.spawnAtCursor ? " at cursor" : ""}`,
    1600,
  );
}

function renderCandidates() {
  const container = $("#cands");
  if (!container) return;
  container.replaceChildren();
  if (!state.candidates.length) {
    container.innerHTML = '<div class="hint">No Painted VFX candidates yet.</div>';
    return;
  }
  for (const file of state.candidates) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = `cand${file === state.image ? " sel" : ""}`;
    node.setAttribute(
      "aria-label",
      `${file === state.image ? "Selected" : "Select"} candidate ${file}`,
    );
    node.innerHTML = `<img src="/art/${escapeHtml(state.vfxSubject)}/${escapeHtml(file)}" alt="${escapeHtml(file)}" /><span class="tick">✓</span>`;
    node.onclick = () => {
      state.image = file;
      renderCandidates();
      const painted = $("#paintedImg");
      if (painted) painted.src = `/art/${state.vfxSubject}/${file}`;
      pushHeroAll();
      markDirty("candidate");
    };
    container.appendChild(node);
  }
}
async function doReroll() {
  const button = $("#reroll");
  button.disabled = true;
  $("#rerollStatus").innerHTML = '<span class="spin"></span> requesting candidates';
  $("#rerollLog").hidden = false;
  try {
    const { jobId } = await api("/api/reroll", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        weaponId: state.weapon.id,
        prompt: $("#prompt").value,
        candidates: 3,
      }),
    });
    const poll = setInterval(async () => {
      try {
        const job = await api(`/api/job/${jobId}`);
        $("#rerollLog").textContent = job.log || "";
        if (job.status === "running") return;
        clearInterval(poll);
        button.disabled = false;
        if (job.status === "done") {
          state.candidates = job.candidates;
          state.weapon.artStatus = job.candidates.length ? "ready" : "unavailable";
          if (!state.candidates.includes(state.image)) state.image = state.candidates[0] || null;
          $("#rerollStatus").textContent = `${job.candidates.length} candidates ready`;
          renderWorkspace();
          mountPanelEngine("engine", "#stageEngine", false);
          mountPanelEngine("combined", "#stageCombined", true);
          setViewTab(state.viewTab);
          await loadList();
        } else $("#rerollStatus").textContent = "Generation failed; log retained.";
      } catch (error) {
        clearInterval(poll);
        button.disabled = false;
        $("#rerollStatus").textContent = error.message;
      }
    }, 1500);
  } catch (error) {
    button.disabled = false;
    $("#rerollStatus").textContent = error.message;
  }
}

async function saveAuthorPayload(payload) {
  return api("/api/author", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ weaponId: state.weapon.id, ...payload }),
  });
}
async function saveAuthor() {
  $("#authorStatus").innerHTML = '<span class="spin"></span> saving';
  await saveAuthorPayload({
    painted: state.author.painted,
    engine: state.author.engine,
    pending: true,
  });
  state.author.pending = true;
  clearDirty("painted prompt", "engine prompt");
  $("#authorStatus").textContent = "Saved and requested";
  await loadList();
}
async function saveDescription() {
  $("#descStatus").textContent = "Saving...";
  await saveAuthorPayload({ description: state.description });
  clearDirty("description");
  $("#descStatus").textContent = "Saved";
}
async function saveMechanics() {
  $("#mechStatus").innerHTML = '<span class="spin"></span> saving';
  await saveAuthorPayload({
    mechanics: state.author.mechanics,
    description: state.description,
    pending: true,
  });
  state.author.pending = true;
  clearDirty("mechanics", "description");
  $("#mechStatus").textContent = "Saved and requested";
  await loadList();
}
async function savePanelNote(key) {
  const note = $(`[data-edit-note="${key}"]`).value;
  state.author.edits[key] = note;
  const output = $(`[data-panelstatus="${key}"]`);
  output.textContent = "Saving...";
  await saveAuthorPayload({ edits: { [key]: note }, pending: true });
  clearDirty(`${key} note`);
  output.textContent = "Saved and requested";
  await loadList();
}

async function saveAll() {
  if (!state.weapon) return;
  showStatus("Saving weapon...");
  $("#save").disabled = true;
  try {
    const suite = {};
    for (const layerId in state.suite)
      suite[layerId] = { on: state.suite[layerId].on, params: state.suite[layerId].params };
    const response = await saveFields({
      image: state.image,
      suite,
      rot: state.rot,
      displayLength: state.displayLength,
      vfxRadius: state.vfxRadius,
      thrown: Boolean(state.weapon.thrown),
      vfxOrigin: state.vfxOrigin,
      spawnAtCursor: state.spawnAtCursor,
    });
    await saveAuthorPayload({
      painted: state.author.painted,
      engine: state.author.engine,
      mechanics: state.author.mechanics,
      description: state.description,
      edits: state.author.edits,
    });
    state.weapon.assigned = response.assigned;
    state.weapon.assignment = response.assignment;
    state.dirtyFields.clear();
    updateDirtyState();
    updateHeader();
    showStatus(`Saved ${state.weapon.name}`, 2200);
    renderInspector();
    await loadList();
  } catch (error) {
    showStatus(`Save failed: ${error.message}`);
  } finally {
    $("#save").disabled = false;
  }
}
function launchSelected() {
  if (!state.weapon) return;
  window.open(
    `http://localhost:5180/?dev=weapon:${encodeURIComponent(state.weapon.id)}`,
    "_blank",
    "noopener",
  );
}
function updateDebug(mountedRows = $("#listWindow")?.children.length || 0) {
  window.__WEAPONSMITH_DEBUG__ = {
    total: allWeapons.length,
    filtered: filteredWeapons.length,
    mountedRows,
    selected: state.weapon?.id || null,
    previewContexts: Object.keys(engines).length,
    viewTab: state.viewTab,
    dirty: [...state.dirtyFields],
  };
  document.documentElement.dataset.weaponsmithReady =
    state.weapon && Object.keys(engines).length === 2 ? "true" : "loading";
}

$("#save").onclick = saveAll;
$("#launchSelected").onclick = launchSelected;
for (const [selectId] of FILTER_IDS)
  $(`#${selectId}`).addEventListener("change", () => renderList());
$("#assignmentFilter").addEventListener("change", () => renderList());
$("#artFilter").addEventListener("change", () => renderList());
$("#weaponSearch").addEventListener("input", () => renderList());
$("#refreshList").addEventListener("click", loadList);
$("#clearListFilters").addEventListener("click", () => {
  $("#weaponSearch").value = "";
  for (const [selectId] of FILTER_IDS) $(`#${selectId}`).value = "all";
  $("#assignmentFilter").value = "all";
  $("#artFilter").value = "all";
  renderList();
});
$("#listViewport").addEventListener("scroll", () => scheduleListWindow(), { passive: true });
$("#listViewport").addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") moveListFocus(listFocusIndex + 1);
  else if (event.key === "ArrowUp") moveListFocus(listFocusIndex - 1);
  else if (event.key === "Home") moveListFocus(0);
  else if (event.key === "End") moveListFocus(filteredWeapons.length - 1);
  else if (event.key === "PageDown")
    moveListFocus(
      listFocusIndex + Math.max(1, Math.floor($("#listViewport").clientHeight / ROW_HEIGHT)),
    );
  else if (event.key === "PageUp")
    moveListFocus(
      listFocusIndex - Math.max(1, Math.floor($("#listViewport").clientHeight / ROW_HEIGHT)),
    );
  else if (event.key === "Enter" || event.key === " ") moveListFocus(listFocusIndex, true);
  else return;
  event.preventDefault();
});
document.addEventListener("keydown", (event) => {
  const target = event.target;
  const editing =
    target && (target.matches("input, textarea, select, button") || target.isContentEditable);
  if (editing || event.altKey || event.ctrlKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  if (key === "z") {
    event.preventDefault();
    moveListFocus(listFocusIndex - 1, true);
  } else if (key === "x") {
    event.preventDefault();
    moveListFocus(listFocusIndex + 1, true);
  } else if (key === "q") {
    event.preventDefault();
    pushAllEngines();
  } else if (key === "e") {
    event.preventDefault();
    launchSelected();
  } else if (key === "/") {
    event.preventDefault();
    $("#weaponSearch").focus();
  }
});
new ResizeObserver(() => renderListWindow()).observe($("#listViewport"));
void loadList();
