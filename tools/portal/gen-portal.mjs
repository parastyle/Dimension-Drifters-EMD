#!/usr/bin/env node
// tools/portal/gen-portal.mjs — generate the DEV PORTAL: a single hub page cataloging every asset type
// (bosses / weapons / characters / levels), each with a one-click LAUNCH into the running game's Testing
// Grounds (via ?dev= deep-links) plus a per-asset "propose a change" note you can copy straight to Claude.
// Also links out to the other authoring UIs (Weaponsmith, art-review, border chooser).
//
//   node tools/portal/gen-portal.mjs        # → tools/portal/index.html (serve it, open it, play)
//
// Data is read from the built shared package, so the catalog is always in sync with the real game.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const shared = await import(pathToFileURL(resolve(REPO, "packages/shared/dist/index.js")).href);

const {
  BOSSES,
  BOSS_DEF_IDS,
  DIMENSIONS,
  WEAPONS,
  WEAPON_IDS,
  EXPANSION_WEAPON_IDS,
  PLAYABLE_CHARACTERS,
  characterName,
  classForCharacter,
  BELT_LEVELS,
} = shared;

// ── Build the catalog ────────────────────────────────────────────────────────────────────────────────
// Bosses: the bespoke picker defs + each dimension's themed finale (deduped, richer names).
const bossSet = new Map();
for (const id of BOSS_DEF_IDS) bossSet.set(id, { id, name: BOSSES[id]?.name ?? id, tag: "bespoke" });
for (const dim of Object.values(DIMENSIONS)) {
  if (!bossSet.has(dim.boss)) bossSet.set(dim.boss, { id: dim.boss, name: bossNameFor(dim.boss), tag: dim.name });
}
function bossNameFor(kind) {
  // dimension bosses resolve to a bespoke fight; show the themed kind + its fight name if different.
  const def = shared.bossDefFor?.(kind);
  return def && def.kind !== kind ? `${prettyId(kind)} — ${def.name}` : prettyId(kind);
}
const bosses = [...bossSet.values()].sort((a, b) => a.name.localeCompare(b.name));

const weapons = [...WEAPON_IDS, ...EXPANSION_WEAPON_IDS]
  .map((id) => {
    const w = WEAPONS[id];
    const t = w?.tags ?? {};
    const delivery = w?.gun ? "gun" : w?.cast ? "cast" : w?.thrown ? "thrown" : w?.quake ? "quake" : "melee";
    return {
      id,
      name: w?.name ?? prettyId(id),
      cls: t.classPool ?? "?",
      family: t.family ?? "",
      element: t.element ?? "physical",
      delivery,
      base: WEAPON_IDS.includes(id),
    };
  })
  .sort((a, b) => Number(b.base) - Number(a.base) || a.name.localeCompare(b.name));

const characters = PLAYABLE_CHARACTERS.map((id) => ({
  id,
  name: characterName(id),
  cls: classForCharacter(id).name,
  grows: classForCharacter(id).classAttr.toUpperCase(),
})).sort((a, b) => a.name.localeCompare(b.name));

const levels = Object.values(BELT_LEVELS).map((l) => ({
  id: l.id,
  name: l.name,
  blurb: l.blurb ?? "",
  boss: bossNameFor(l.rooms?.find?.((r) => r.boss)?.bossKind ?? DIMENSIONS[l.dimensionId]?.boss ?? ""),
}));

function prettyId(id) {
  return String(id)
    .replace(/^(cc-|x-)/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const CATALOG = { bosses, weapons, characters, levels };

// External tools (started separately; the portal just links to them).
const TOOLS = [
  { name: "Weaponsmith", url: "http://localhost:5050", desc: "Author each weapon's VFX suite (hero skin + layer presets)." },
  { name: "Art Review", url: "http://localhost:8190", desc: "Browse + review generated art candidates." },
  { name: "Border Chooser", url: "http://localhost:5180/border-chooser.html", desc: "The 6 UI panel-frame styles (dev-served)." },
];

// ── Render ───────────────────────────────────────────────────────────────────────────────────────────
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Dimension Drifters — Dev Portal</title>
<style>
  :root{ --bg:#0b0e14; --panel:#151a24; --panel2:#1b2130; --line:#2a3242; --ink:#e8e4d8; --dim:#93a0b4;
    --accent:#33e6ff; --gold:#ffd24a; --mono:ui-monospace,"Cascadia Code",Consolas,monospace;
    --disp:'Segoe UI',system-ui,sans-serif; }
  *{box-sizing:border-box} body{margin:0;background:radial-gradient(120% 90% at 50% -10%,#161c28,var(--bg) 60%);
    color:var(--ink);font-family:var(--disp);min-height:100vh}
  header{position:sticky;top:0;z-index:10;background:rgba(11,14,20,.92);backdrop-filter:blur(8px);
    border-bottom:1px solid var(--line);padding:14px clamp(16px,3vw,40px)}
  h1{margin:0;font-size:22px;letter-spacing:.02em}
  h1 small{color:var(--dim);font-weight:400;font-size:13px;margin-left:10px}
  .bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:10px}
  input[type=search]{flex:1;min-width:200px;background:#0d1017;border:1px solid var(--line);color:var(--ink);
    padding:9px 12px;border-radius:8px;font-size:14px}
  .cfg{font-family:var(--mono);font-size:12px;color:var(--dim)}
  .cfg input{background:#0d1017;border:1px solid var(--line);color:var(--ink);border-radius:6px;padding:5px 8px;
    font-family:var(--mono);width:180px}
  main{padding:clamp(16px,3vw,40px);max-width:1300px;margin:0 auto}
  section{margin:0 0 34px} h2{font-size:15px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);
    border-bottom:1px solid var(--line);padding-bottom:8px}
  .count{color:var(--dim);font-family:var(--mono);font-size:12px;margin-left:8px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin-top:14px}
  .card{background:linear-gradient(180deg,var(--panel2),var(--panel));border:1px solid var(--line);
    border-radius:11px;padding:12px;display:flex;flex-direction:column;gap:8px;transition:border-color .15s,transform .15s}
  .card:hover{border-color:color-mix(in srgb,var(--accent) 50%,var(--line));transform:translateY(-2px)}
  .card .nm{font-weight:700;font-size:14px;line-height:1.2}
  .card .meta{font-family:var(--mono);font-size:11px;color:var(--dim);display:flex;gap:6px;flex-wrap:wrap}
  .chip{background:#0d1017;border:1px solid var(--line);border-radius:99px;padding:1px 7px}
  .chip.base{color:var(--gold);border-color:color-mix(in srgb,var(--gold) 40%,var(--line))}
  .row{display:flex;gap:6px;margin-top:2px}
  .btn{flex:1;text-align:center;cursor:pointer;border:0;border-radius:8px;padding:8px;font-weight:700;
    font-family:var(--mono);font-size:12px;letter-spacing:.04em;text-decoration:none;color:#0b0e14;background:var(--accent)}
  .btn:hover{filter:brightness(1.08)} .btn.ghost{background:#0d1017;color:var(--dim);border:1px solid var(--line)}
  .btn.ghost:hover{color:var(--ink)}
  .note{display:none;flex-direction:column;gap:6px} .note.open{display:flex}
  .note textarea{background:#0d1017;border:1px solid var(--line);color:var(--ink);border-radius:7px;padding:7px;
    font-family:var(--disp);font-size:12px;min-height:52px;resize:vertical}
  .tools .card{flex-direction:row;align-items:center;justify-content:space-between}
  footer{color:var(--dim);font-size:12px;padding:0 clamp(16px,3vw,40px) 40px;max-width:1300px;margin:0 auto;line-height:1.6}
  .hide{display:none!important}
  #toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:var(--accent);color:#0b0e14;
    font-weight:700;padding:9px 16px;border-radius:9px;opacity:0;transition:opacity .2s;pointer-events:none;font-size:13px}
  #toast.show{opacity:1}
</style></head><body>
<header>
  <h1>Dimension Drifters — Dev Portal <small>launch · test · propose · every asset in one place</small></h1>
  <div class="bar">
    <input id="q" type="search" placeholder="filter bosses, weapons, characters… (name or id)"/>
    <span class="cfg">game&nbsp;<input id="gameUrl" value="http://localhost:5180"/></span>
    <button class="btn ghost" style="flex:0 0 auto;padding:8px 12px" onclick="copyAllNotes()">📋 Copy all proposals</button>
  </div>
</header>
<main id="main"></main>
<footer>
  <b>How it works.</b> Each ⚔/Try/Play button opens the game at <code>?dev=…</code> in a new tab and drops you
  into <b>Testing Grounds</b> with that asset applied (spawn the boss, hold the weapon, wear the character).
  Start the game first: <code>pnpm dev</code>. The tool links need their own servers
  (<code>pnpm --filter … weaponsmith</code>, etc.). ✎ opens a note per asset (saved in your browser); “Copy all
  proposals” collects them into one block to paste to Claude. Re-run <code>node tools/portal/gen-portal.mjs</code>
  after adding assets.
</footer>
<div id="toast"></div>
<script>
const CATALOG = ${JSON.stringify(CATALOG)};
const TOOLS = ${JSON.stringify(TOOLS)};
const NKEY = "ddPortalNotes";
const notes = JSON.parse(localStorage.getItem(NKEY) || "{}");
const gameUrl = () => document.getElementById("gameUrl").value.replace(/\\/$/, "");
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function toast(m){ const t=document.getElementById("toast"); t.textContent=m; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),1400); }
function saveNote(type,id,v){ const k=type+":"+id; if(v.trim()) notes[k]=v; else delete notes[k]; localStorage.setItem(NKEY,JSON.stringify(notes)); }
function copyText(t){ navigator.clipboard.writeText(t).then(()=>toast("copied ✓")); }
function copyNote(type,id,name){ const n=notes[type+":"+id]; if(!n){toast("write a note first");return;} copyText('Change proposal — '+type+' "'+name+'" ('+id+'):\\n'+n); }
function copyAllNotes(){ const ks=Object.keys(notes); if(!ks.length){toast("no notes yet");return;}
  copyText("Dev Portal — change proposals:\\n\\n"+ks.map(k=>"• "+k+"\\n  "+notes[k]).join("\\n\\n")); }

function card(type, item, launchHref, metaHtml){
  const k=type+":"+item.id, nv=notes[k]||"";
  return \`<div class="card" data-search="\${esc((item.name+' '+item.id+' '+(item.family||'')).toLowerCase())}" data-cls="\${esc(item.cls||'')}">
    <div class="nm">\${esc(item.name)}</div>
    <div class="meta">\${metaHtml}</div>
    <div class="row">
      <a class="btn" target="_blank" rel="noopener" href="\${launchHref}">\${type==='level'?'▶ Play':type==='char'?'▶ Play':type==='weapon'?'⚔ Try':'⚔ Fight'}</a>
      <button class="btn ghost" style="flex:0 0 auto" onclick="this.closest('.card').querySelector('.note').classList.toggle('open')">✎</button>
    </div>
    <div class="note">
      <textarea placeholder="propose a change to this \${type}…" oninput="saveNote('\${type}','\${item.id}',this.value)">\${esc(nv)}</textarea>
      <button class="btn ghost" onclick="copyNote('\${type}','\${item.id}',\${JSON.stringify(item.name)})">📋 Copy this proposal</button>
    </div>
  </div>\`;
}

function render(){
  const g = gameUrl();
  const S = [];
  S.push(sec("Bosses", CATALOG.bosses.length, CATALOG.bosses.map(b =>
    card("boss", b, g+"/?dev=boss:"+encodeURIComponent(b.id), \`<span class="chip">\${esc(b.tag)}</span><span class="chip">\${esc(b.id)}</span>\`))));
  S.push(sec("Weapons", CATALOG.weapons.length, CATALOG.weapons.map(w =>
    card("weapon", w, g+"/?dev=weapon:"+encodeURIComponent(w.id),
      \`<span class="chip \${w.base?'base':''}">\${w.base?'BASE':'expansion'}</span><span class="chip">\${esc(w.cls)}</span><span class="chip">\${esc(w.delivery)}</span><span class="chip">\${esc(w.element)}</span>\`))));
  S.push(sec("Characters", CATALOG.characters.length, CATALOG.characters.map(c =>
    card("char", c, g+"/?dev=char:"+encodeURIComponent(c.id), \`<span class="chip">\${esc(c.cls)}</span><span class="chip">grows \${esc(c.grows)}</span>\`))));
  S.push(sec("Levels", CATALOG.levels.length, CATALOG.levels.map(l =>
    card("level", l, g+"/?belt="+encodeURIComponent(l.id), \`<span class="chip">\${esc(l.boss)}</span>\`))));
  S.push(\`<section class="tools"><h2>Tools</h2><div class="grid">\${TOOLS.map(t=>
    \`<div class="card"><div><div class="nm">\${esc(t.name)}</div><div class="meta" style="margin-top:4px">\${esc(t.desc)}</div></div>
     <a class="btn" target="_blank" rel="noopener" href="\${esc(t.url)}" style="flex:0 0 auto">Open</a></div>\`).join("")}</div></section>\`);
  document.getElementById("main").innerHTML = S.join("");
  filter();
}
function sec(title,count,cards){ return \`<section><h2>\${title}<span class="count">\${count}</span></h2><div class="grid">\${cards.join("")}</div></section>\`; }
function filter(){ const q=document.getElementById("q").value.toLowerCase().trim();
  document.querySelectorAll(".card[data-search]").forEach(c=>{ c.classList.toggle("hide", q && !c.dataset.search.includes(q)); }); }
document.getElementById("q").addEventListener("input", filter);
document.getElementById("gameUrl").addEventListener("change", render);
render();
</script></body></html>`;

mkdirSync(here, { recursive: true });
writeFileSync(resolve(here, "index.html"), html);
console.log(
  `dev portal → tools/portal/index.html  (bosses ${bosses.length} · weapons ${weapons.length} · characters ${characters.length} · levels ${levels.length})`,
);
