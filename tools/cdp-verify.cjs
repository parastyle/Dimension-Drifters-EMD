// One-off visual verification (CDP → Electron :9222): capture the redesigned cards + the parry brace.
const http = require("node:http");
const fs = require("node:fs");
const WebSocket = require("C:/Projects/Dimension Drifters v2/node_modules/.pnpm/ws@8.21.0/node_modules/ws");
const OUT = "C:/Projects/Dimension Drifters v2";
http.get("http://localhost:9222/json/list", (res) => {
  let d = ""; res.on("data", (c) => (d += c)); res.on("end", async () => {
    const page = JSON.parse(d).find((t) => t.type === "page" && /5180/.test(t.url));
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0; const p = {};
    const cmd = (m, pa) => new Promise((r) => { const i = ++id; p[i] = r; ws.send(JSON.stringify({ id: i, method: m, params: pa })); });
    const ev = async (e) => (await cmd("Runtime.evaluate", { expression: e, returnByValue: true })).result?.result?.value;
    const shot = async (name) => { const s = await cmd("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(`${OUT}/${name}`, Buffer.from(s.result.data, "base64")); };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    ws.on("message", (m) => { const o = JSON.parse(m); if (o.id && p[o.id]) { p[o.id](o); delete p[o.id]; } });
    ws.on("open", async () => {
      const SC = "window.ddGame.scene.scenes[0]";
      await cmd("Page.enable", {});
      for (let i = 0; i < 25; i++) { await sleep(600); if (await ev(`!!(window.ddGame&&${SC}.room&&${SC}.room.state.players.size>0&&${SC}.carousel&&${SC}.carousel.length)`)) break; }
      const ready = await ev(`!!(window.ddGame&&${SC}.carousel&&${SC}.carousel.length)`);
      if (!ready) { console.log(JSON.stringify({ error: "game/carousel not ready" })); ws.close(); return; }

      // Cycle to the greatsword (2H melee) so the brace clearly raises the blade.
      for (let i = 0; i < 6; i++) { const w = await ev(`${SC}.room.state.players.get(${SC}.room.sessionId).weapon`); if (w === "tombstone-greatsword") break; await ev(`${SC}.room.send('cycleWeapon')`); await sleep(250); }
      // Stop moving + aim right so the pose is clean.
      await ev(`${SC}.room.send('input',{dx:0,dy:0})`);
      await sleep(500);

      // (1) cards + character at rest (full screen)
      await shot("tmp-cards.png");

      // Zoom the camera onto the player for a clear pose read, and quiet nearby enemies.
      await ev(`${SC}.cameras.main.setZoom(3.2)`);
      await ev(`${SC}.room.send('input',{dx:0,dy:0})`);
      await sleep(700);
      await shot("tmp-rest.png"); // rest pose (weapon upright)

      // (2) PARRY BRACE — trigger on the local rig + send the server parry, capture mid-brace.
      const braced = await ev(`(()=>{const rig=${SC}.blobs.get(${SC}.room.sessionId);if(!rig||!rig.triggerBrace)return false;${SC}.room.send('parry');rig.triggerBrace(${SC}.time.now);return true;})()`);
      await sleep(140);
      await shot("tmp-brace.png");
      await ev(`${SC}.cameras.main.setZoom(1)`);

      const snap = await ev(`(()=>{const r=${SC}.room,me=r.state.players.get(r.sessionId);const card=${SC}.carousel.find(c=>c.id===me.weapon);return {weapon:me.weapon,attrs:[me.str,me.dex,me.int,me.con,me.luk].join('/'),eq:card&&card.eq.text,canvas:(document.querySelector('canvas')||{}).width+'x'+(document.querySelector('canvas')||{}).height,fps:Math.round(${SC}.game.loop.actualFps)};})()`);
      console.log(JSON.stringify({ braced, snap }, null, 1));
      ws.close();
    });
  });
}).on("error", (e) => console.log("CDP connect error:", e.message));
