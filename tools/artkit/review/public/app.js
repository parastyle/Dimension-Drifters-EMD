"use strict";
const $ = (s, r = document) => r.querySelector(s);
const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };

const STATUSES = [
  { k: "all", label: "All" },
  { k: "needpick", label: "Needs pick" },
  { k: "locked", label: "Locked" },
  { k: "pending", label: "Pending" },
];
const CAT_COLOR = {
  Characters: "#33e6ff", Enemies: "#ff6b7d", Bosses: "#ff8a2b", Mobs: "#9cff3b",
  Swords: "#e9e5db", Guns: "#b14bff", Staffs: "#ff3bd4", Launchers: "#5fd17a", Weapons: "#c49a5a", Other: "#9a8fb0",
};

const saved = JSON.parse(localStorage.getItem("ddreview") || "{}");
const state = {
  assets: [],
  q: "",
  cat: saved.cat || "All",
  status: saved.status || "all",
  sort: saved.sort || "cat",
  view: [], // ordered ids currently shown (for modal prev/next)
};
let modalId = null;

function persist() {
  localStorage.setItem("ddreview", JSON.stringify({ cat: state.cat, status: state.status, sort: state.sort }));
}

async function api(path, body) {
  const r = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
  return r.json();
}
async function load(keepModal) {
  const r = await api("/api/assets");
  state.assets = r.assets || [];
  render();
  if (keepModal && modalId) openModal(modalId, true);
}

const statusOf = (a) => (a.locked ? "locked" : a.candidates.length ? "needpick" : "pending");
function matches(a) {
  if (state.cat !== "All" && a.category !== state.cat) return false;
  if (state.status !== "all" && statusOf(a) !== state.status) return false;
  if (state.q && !(a.name + " " + a.id + " " + a.tags.join(" ")).toLowerCase().includes(state.q)) return false;
  return true;
}
function sortList(list) {
  const byName = (x, y) => x.name.localeCompare(y.name);
  if (state.sort === "name") return [...list].sort(byName);
  if (state.sort === "status") {
    const rank = { needpick: 0, pending: 1, locked: 2 };
    return [...list].sort((x, y) => rank[statusOf(x)] - rank[statusOf(y)] || byName(x, y));
  }
  return [...list].sort((x, y) => x.category.localeCompare(y.category) || byName(x, y));
}
const thumb = (a) => (a.promoted ? `/img/${a.id}/${a.promoted}` : a.candidates.length ? `/img/${a.id}/${a.candidates[0]}` : "");

function render() {
  // progress
  const locked = state.assets.filter((a) => a.locked).length;
  $("#progress").innerHTML = `<b>${locked}</b> / ${state.assets.length} locked`;

  // status filters
  const sf = $("#statusFilters"); sf.innerHTML = "";
  for (const s of STATUSES) {
    const n = state.assets.filter((a) => s.k === "all" || statusOf(a) === s.k).length;
    const b = el("button", state.status === s.k ? "active" : "", `<span>${s.label}</span><span class="n">${n}</span>`);
    b.onclick = () => { state.status = s.k; persist(); render(); };
    sf.appendChild(b);
  }

  // category tree
  const counts = {};
  for (const a of state.assets) counts[a.category] = (counts[a.category] || 0) + 1;
  const tree = $("#catTree"); tree.innerHTML = "";
  const mkCat = (name, n) => {
    const b = el("button", state.cat === name ? "active" : "");
    b.innerHTML = `<span class="dot" style="background:${CAT_COLOR[name] || "#9a8fb0"}"></span><span>${name}</span><span class="n">${n}</span>`;
    b.onclick = () => { state.cat = name; persist(); render(); closeSidebarMobile(); };
    return b;
  };
  tree.appendChild(mkCat("All", state.assets.length));
  for (const c of Object.keys(counts).sort()) tree.appendChild(mkCat(c, counts[c]));

  // toolbar
  $("#crumbs").innerHTML = `${state.cat}${state.status !== "all" ? ` <span class="muted">· ${STATUSES.find((s) => s.k === state.status).label}</span>` : ""}`;

  // grid
  const list = sortList(state.assets.filter(matches));
  state.view = list.map((a) => a.id);
  $("#count").textContent = `${list.length} asset${list.length === 1 ? "" : "s"}`;
  const grid = $("#grid"); grid.innerHTML = "";
  $("#empty").hidden = list.length > 0;
  if (!list.length) $("#empty").textContent = "No assets match. Adjust filters or hit ⟳ — generation may still be running.";

  let lastCat = null;
  for (const a of list) {
    if (state.sort === "cat" && a.category !== lastCat) { grid.appendChild(el("div", "group-h", a.category)); lastCat = a.category; }
    grid.appendChild(card(a));
  }
}

function card(a) {
  const c = el("div", "card");
  c.tabIndex = 0;
  const t = thumb(a);
  const st = statusOf(a);
  const badge = st === "locked" ? `<span class="badge locked">✓ #${a.promoted ?? ""}</span>`
    : st === "needpick" ? `<span class="badge cand">${a.candidates.length} candidates</span>`
    : `<span class="badge pending">pending</span>`;
  c.innerHTML = `<div class="thumb${t ? "" : " empty"}" style="${t ? `background-image:url('${t}')` : ""}"></div>
    <div class="meta"><div class="name">${a.name}</div><div class="sub">${a.category} ${badge}</div></div>`;
  const open = () => openModal(a.id);
  c.onclick = open;
  c.onkeydown = (e) => { if (e.key === "Enter") open(); };
  return c;
}

/* ── modal ── */
function openModal(id, silent) {
  const a = state.assets.find((x) => x.id === id);
  if (!a) return;
  modalId = id;
  $("#mTitle").textContent = a.name;
  $("#mCat").textContent = a.category;
  $("#mTags").textContent = a.tags.join(" · ");
  if (!silent) { $("#mPrompt").value = a.prompt; $("#mStatus").textContent = ""; }
  $("#mOpen").href = a.locked ? `/ref/${a.id}` : "#";
  $("#mOpen").style.display = a.locked ? "" : "none";
  const wrap = $("#mCandidates"); wrap.innerHTML = "";
  if (!a.candidates.length) wrap.innerHTML = `<div class="status">No candidates yet — generation may still be running.</div>`;
  for (const n of a.candidates) {
    const picked = String(a.promoted) === String(n);
    const cell = el("div", "cand-cell" + (picked ? " picked" : ""));
    cell.innerHTML = `<img loading="lazy" src="/img/${a.id}/${n}" alt="${a.name} candidate ${n}" />
      <div class="crow"><span class="cnum">#${n}</span><button class="pick ${picked ? "is" : ""}">${picked ? "✓ picked" : "Pick"}</button></div>`;
    cell.querySelector("img").onclick = () => lightbox(`/img/${a.id}/${n}`);
    cell.querySelector(".pick").onclick = () => promote(a.id, n);
    wrap.appendChild(cell);
  }
  $("#modal").hidden = false;
}
function closeModal() { $("#modal").hidden = true; modalId = null; }
function stepModal(d) {
  if (!modalId) return;
  const i = state.view.indexOf(modalId);
  const j = i + d;
  if (j >= 0 && j < state.view.length) openModal(state.view[j]);
}

async function promote(id, n) {
  $("#mStatus").textContent = "Promoting…";
  const r = await api("/api/promote", { id, candidate: n });
  if (r.ok) {
    const a = state.assets.find((x) => x.id === id); a.locked = true; a.promoted = String(n);
    toast(`Locked ${a.name} #${n} as the anchor`, "ok");
    openModal(id, true); render();
  } else { $("#mStatus").textContent = "Error: " + (r.error || "failed"); toast("Promote failed", "err"); }
}
async function savePrompt() {
  const a = state.assets.find((x) => x.id === modalId); if (!a) return;
  const r = await api("/api/prompt", { id: a.id, prompt: $("#mPrompt").value });
  a.prompt = $("#mPrompt").value;
  $("#mStatus").textContent = r.ok ? "Prompt saved." : "Error";
  toast(r.ok ? "Prompt saved" : "Save failed", r.ok ? "ok" : "err");
}
async function reroll() {
  const id = modalId; if (!id) return;
  $("#mStatus").textContent = "Re-roll queued… (~5 min)";
  toast("Re-roll started (~5 min)", "ok");
  await api("/api/reroll", { id });
  const poll = setInterval(async () => {
    const jobs = await api("/api/jobs"); const j = jobs[id];
    if (!j) return;
    $("#mStatus").textContent = `Re-roll: ${j.status}`;
    if (j.status === "done" || j.status === "failed") {
      clearInterval(poll);
      toast(`Re-roll ${j.status} for ${id}`, j.status === "done" ? "ok" : "err");
      await load(true);
    }
  }, 4000);
}

/* ── lightbox + toasts ── */
function lightbox(src) { $("#lbImg").src = src; $("#lightbox").hidden = false; }
function toast(msg, kind) {
  const t = el("div", "toast " + (kind || ""), msg);
  $("#toasts").appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
function closeSidebarMobile() { $("#sidebar").classList.remove("open"); }

/* ── wiring ── */
$("#search").oninput = (e) => { state.q = e.target.value.toLowerCase().trim(); render(); };
$("#refresh").onclick = () => load(true);
$("#sort").value = state.sort;
$("#sort").onchange = (e) => { state.sort = e.target.value; persist(); render(); };
$("#menuBtn").onclick = () => $("#sidebar").classList.toggle("open");
$("#mClose").onclick = closeModal;
$("#mPrev").onclick = () => stepModal(-1);
$("#mNext").onclick = () => stepModal(1);
$("#mSave").onclick = savePrompt;
$("#mReroll").onclick = reroll;
$("#modal").onclick = (e) => { if (e.target.id === "modal") closeModal(); };
$("#lightbox").onclick = () => ($("#lightbox").hidden = true);

document.addEventListener("keydown", (e) => {
  if (!$("#lightbox").hidden && e.key === "Escape") return ($("#lightbox").hidden = true);
  const inField = /input|textarea|select/i.test(document.activeElement.tagName);
  if (!$("#modal").hidden) {
    if (e.key === "Escape") return closeModal();
    if (inField) return;
    if (e.key === "ArrowLeft") return stepModal(-1);
    if (e.key === "ArrowRight") return stepModal(1);
    if (e.key.toLowerCase() === "r") return reroll();
    if (/^[1-9]$/.test(e.key)) { const a = state.assets.find((x) => x.id === modalId); if (a && a.candidates.includes(+e.key)) promote(a.id, +e.key); return; }
  } else {
    if (inField) return;
    if (e.key === "/") { e.preventDefault(); $("#search").focus(); }
    if (e.key.toLowerCase() === "r") load(true);
  }
});

load();
setInterval(() => load(!$("#modal").hidden), 30000);
