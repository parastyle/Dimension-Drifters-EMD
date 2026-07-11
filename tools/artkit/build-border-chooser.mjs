import { readFileSync, writeFileSync } from "node:fs";

const thumbs = JSON.parse(readFileSync("out/border-thumbs.json", "utf8"));

const STYLES = [
  {
    id: "gilded",
    name: "Gilded Filigree",
    vibe: "Ornate gold scrollwork, gem corner bosses. Loot-drama fantasy — Diablo / WoW.",
    accent: "#e0b654",
  },
  {
    id: "techhud",
    name: "Tech HUD",
    vibe: "Angular brushed steel, neon-cyan traces, hex rivets. Sci-fi command deck — Destiny / Halo.",
    accent: "#33e6ff",
  },
  {
    id: "bonegothic",
    name: "Bone Gothic",
    vibe: "Carved bone & blackened iron, skull corners, a red wax seal. Grim ossuary — Darkest Dungeon.",
    accent: "#c65a4e",
  },
  {
    id: "minimal",
    name: "Clean Minimal",
    vibe: "Thin double-line, corner ticks, one accent hairline. Restrained modern roguelite.",
    accent: "#cfd6de",
  },
  {
    id: "arcane",
    name: "Arcane Runic",
    vibe: "Carved obsidian slabs, glowing violet & cyan runes, socketed corner gems. Spellcaster tomes — Hades / Noita.",
    accent: "#9a6aff",
  },
  {
    id: "grungesteel",
    name: "Grunge Steel",
    vibe: "Riveted scrap plate, weld scars, hazard chevrons. Post-apoc industrial — Deep Rock / Broforce.",
    accent: "#e08a3c",
  },
];

const cards = STYLES.map(
  (s) => `
    <article class="card" style="--accent:${s.accent}">
      <div class="frame">
        <div class="content">
          <div class="mock">
            <span class="mock-rar">LEGENDARY</span>
            <span class="mock-name">Tombstone Greatsword</span>
            <div class="mock-bar"><i style="width:82%"></i></div>
            <dl class="mock-stats">
              <div><dt>DMG</dt><dd>34</dd></div>
              <div><dt>REACH</dt><dd>168</dd></div>
              <div><dt>CRIT</dt><dd>15%</dd></div>
            </dl>
          </div>
        </div>
        <img class="border" src="${thumbs[s.id]}" alt="${s.name} frame" />
      </div>
      <div class="meta">
        <h2>${s.name}</h2>
        <p>${s.vibe}</p>
        <button class="pick" data-id="${s.id}" data-name="${s.name}">◈ Use this frame</button>
      </div>
    </article>`,
).join("");

const html = `<style>
  :root{
    --ground:#16181c; --panel:#20242b; --panel-2:#262b33; --line:#333a44;
    --ink:#e8e4d8; --ink-dim:#9aa5b1; --ember:#ff8a2b;
    --display:'Segoe UI',system-ui,-apple-system,sans-serif;
    --mono:ui-monospace,'Cascadia Code',Menlo,Consolas,monospace;
  }
  *{box-sizing:border-box}
  body{margin:0}
  .wrap{
    min-height:100vh; background:
      radial-gradient(120% 80% at 50% -10%, #23272f 0%, var(--ground) 60%);
    color:var(--ink); font-family:var(--display);
    padding:clamp(20px,4vw,56px); display:flex; flex-direction:column; gap:34px;
  }
  header{max-width:1100px; margin:0 auto; width:100%}
  .eyebrow{font-family:var(--mono); font-size:12px; letter-spacing:.34em; text-transform:uppercase;
    color:var(--ember); margin:0 0 10px}
  h1{font-size:clamp(30px,5vw,52px); font-weight:800; letter-spacing:.01em; margin:0; text-wrap:balance;
    text-transform:uppercase}
  .sub{color:var(--ink-dim); font-size:clamp(15px,1.6vw,18px); margin:12px 0 0; max-width:62ch; line-height:1.5}
  .grid{max-width:1100px; margin:0 auto; width:100%;
    display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:clamp(18px,2.4vw,30px)}
  @media (max-width:720px){ .grid{grid-template-columns:1fr} }
  .card{background:linear-gradient(180deg,var(--panel-2),var(--panel)); border:1px solid var(--line);
    border-radius:14px; padding:16px; display:flex; flex-direction:column; gap:14px;
    transition:transform .18s ease, border-color .18s ease, box-shadow .18s ease}
  .card:hover{transform:translateY(-3px); border-color:color-mix(in srgb,var(--accent) 55%, var(--line));
    box-shadow:0 14px 40px -18px color-mix(in srgb,var(--accent) 60%, transparent)}
  .frame{position:relative; aspect-ratio:4/3; border-radius:10px; overflow:hidden;
    background:
      repeating-linear-gradient(45deg,#141619 0 9px,#191c21 9px 18px)}
  .frame .border{position:absolute; inset:0; width:100%; height:100%; object-fit:fill; pointer-events:none;
    filter:drop-shadow(0 6px 14px rgba(0,0,0,.5))}
  .content{position:absolute; inset:13% 12%; display:grid; place-items:center; text-align:center}
  .mock{display:flex; flex-direction:column; gap:10px; align-items:center; width:100%}
  .mock-rar{font-family:var(--mono); font-size:11px; letter-spacing:.24em; color:var(--accent)}
  .mock-name{font-weight:800; font-size:clamp(15px,2.4vw,22px); text-transform:uppercase; line-height:1.05;
    text-wrap:balance; color:var(--ink)}
  .mock-bar{height:6px; width:72%; background:#0d0f12; border-radius:99px; overflow:hidden}
  .mock-bar i{display:block; height:100%; background:linear-gradient(90deg,var(--accent),#fff6)}
  .mock-stats{display:flex; gap:clamp(10px,3vw,26px); margin:2px 0 0}
  .mock-stats div{display:flex; flex-direction:column; gap:2px}
  .mock-stats dt{font-family:var(--mono); font-size:10px; letter-spacing:.16em; color:var(--ink-dim); margin:0}
  .mock-stats dd{margin:0; font-weight:800; font-size:clamp(14px,2vw,18px); font-variant-numeric:tabular-nums}
  .meta{display:flex; flex-direction:column; gap:8px}
  .meta h2{margin:0; font-size:20px; font-weight:800}
  .meta p{margin:0; color:var(--ink-dim); font-size:14px; line-height:1.5; min-height:42px}
  .pick{margin-top:4px; align-self:flex-start; cursor:pointer; font-family:var(--mono); font-size:13px;
    letter-spacing:.08em; color:#12141a; background:var(--accent); border:0; border-radius:8px;
    padding:9px 16px; font-weight:700; transition:filter .15s ease, transform .1s ease}
  .pick:hover{filter:brightness(1.08)}
  .pick:active{transform:translateY(1px)}
  .pick:focus-visible{outline:2px solid var(--ink); outline-offset:2px}
  .card.chosen{border-color:var(--accent); box-shadow:0 0 0 1px var(--accent), 0 18px 50px -20px var(--accent)}
  footer{max-width:1100px; margin:0 auto; width:100%; color:var(--ink-dim); font-size:13px; line-height:1.6;
    border-top:1px solid var(--line); padding-top:20px}
  footer code{font-family:var(--mono); color:var(--ink); background:#0d0f12; padding:1px 6px; border-radius:5px}
  @media (prefers-reduced-motion:reduce){ *{transition:none!important} }
</style>
<div class="wrap">
  <header>
    <p class="eyebrow">Dimension Drifters · UI</p>
    <h1>UI Border Foundry</h1>
    <p class="sub">Six Codex-rendered panel frames, keyed and installed in the game. Each is shown wrapping a
      real weapon card so you can read it in context. Pick the one you want as the game's panel frame — tap
      <em>Use this frame</em> and it messages me your choice.</p>
  </header>
  <div class="grid">${cards}</div>
  <footer>
    All six are already installed at <code>public/ui/border-*.png</code> (transparent, ready to 9-slice). The
    game reads a <code>borderStyle</code> setting — say the word and I'll wire your pick onto the shop, bag, and
    level-up panels.
  </footer>
</div>
<script>
  document.querySelectorAll('.pick').forEach((b)=>{
    b.addEventListener('click',()=>{
      document.querySelectorAll('.card').forEach(c=>c.classList.remove('chosen'));
      b.closest('.card').classList.add('chosen');
      if (typeof sendPrompt === 'function') sendPrompt('Use the '+b.dataset.name+' UI border for the game panels.');
    });
  });
</script>`;

writeFileSync("out/border-chooser.html", html);
console.error("wrote out/border-chooser.html (" + Math.round(html.length / 1024) + "KB)");
