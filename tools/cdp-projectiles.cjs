const http = require("node:http");
const fs = require("node:fs");
const WebSocket = require("C:/Projects/Dimension Drifters v2/node_modules/.pnpm/ws@8.21.0/node_modules/ws");
http.get("http://localhost:9222/json/list", (res) => {
  let d = ""; res.on("data", (c) => (d += c)); res.on("end", async () => {
    const page = JSON.parse(d).find((t) => t.type === "page" && /5180/.test(t.url));
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0; const p = {};
    const cmd = (m, pa) => new Promise((r) => { const i = ++id; p[i] = r; ws.send(JSON.stringify({ id: i, method: m, params: pa })); });
    const ev = async (e) => (await cmd("Runtime.evaluate", { expression: e, returnByValue: true })).result?.result?.value;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    ws.on("message", (m) => { const o = JSON.parse(m); if (o.id && p[o.id]) { p[o.id](o); delete p[o.id]; } });
    ws.on("open", async () => {
      const SC = "window.ddGame.scene.scenes[0]";
      await cmd("Page.enable", {});
      await ev("location.reload()");
      for (let i = 0; i < 20; i++) { await sleep(700); if (await ev(`!!(window.ddGame&&${SC}.room&&${SC}.room.state.players.size>0)`)) break; }
      if ((await ev(`${SC}.room.state.mode`)) !== "arena") await ev(`${SC}.room.send('toggleTraining')`);
      await ev(`${SC}.room.send('restart')`);
      let maxProj = 0, maxBoothill = 0, sawProjClient = 0, shotAt = -1, hits = 0, lastHp = 100, deaths = 0;
      // Drive the player in a wide circle (survive the swarm) + attack, while watching for spit.
      for (let t = 0; t < 80; t++) {
        const th = t * 0.32;
        await ev(`${SC}.room.send('input',{dx:${Math.cos(th).toFixed(3)},dy:${Math.sin(th).toFixed(3)}})`);
        if (t % 2 === 0) await ev(`${SC}.room.send('attack',{aimX:${Math.cos(th).toFixed(3)},aimY:${Math.sin(th).toFixed(3)}})`);
        const snap = await ev(`(()=>{const s=${SC},r=s.room;let boot=0;r.state.enemies.forEach(e=>{if(e.kind==='boothill')boot++;});const me=r.state.players.get(r.sessionId);return {proj:r.state.projectiles.size, boothill:boot, enemies:r.state.enemies.size, clientProj:s.projectiles.size, hp:Math.round(me?me.hp:0), alive:me?me.alive:false};})()`);
        if (snap) {
          maxProj = Math.max(maxProj, snap.proj); maxBoothill = Math.max(maxBoothill, snap.boothill);
          sawProjClient = Math.max(sawProjClient, snap.clientProj);
          if (snap.hp < lastHp - 0.5 && snap.alive) hits++; // took damage while alive
          if (!snap.alive) deaths++;
          lastHp = snap.hp;
          if (snap.proj > 0 && shotAt < 0) {
            await ev(`(()=>{const s=${SC},r=s.room,me=r.state.players.get(r.sessionId);s.cameras.main.setZoom(1.5);s.cameras.main.centerOn(me.x,me.y);return 1;})()`);
            await sleep(150);
            const shot = await cmd("Page.captureScreenshot", { format: "png" });
            fs.writeFileSync("C:/Projects/Dimension Drifters v2/tools/artkit/out/_projectiles_check.png", Buffer.from(shot.result.data, "base64"));
            shotAt = t;
          }
        }
        await sleep(350);
      }
      console.log(JSON.stringify({ maxProjectiles_server: maxProj, maxBoothill, sawProjectiles_client: sawProjClient, damageEvents: hits, deaths, screenshotAtTick: shotAt }));
      ws.close(); process.exit(0);
    });
  });
}).on("error", (e) => { console.log("err", e.message); process.exit(1); });
