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
      for (let i = 0; i < 4; i++) { const w = await ev(`${SC}.room.state.players.get(${SC}.room.sessionId).weapon`); if (w === "tombstone-greatsword") break; await ev(`${SC}.room.send('cycleWeapon')`); await sleep(200); }
      let maxZonesSrv = 0, maxZonesCli = 0, maxTough = 0, shot = false, maxElapsed = 0;
      for (let t = 0; t < 210; t++) {
        const th = t * 0.22;
        await ev(`${SC}.room.send('input',{dx:${Math.cos(th).toFixed(3)},dy:${Math.sin(th).toFixed(3)}})`);
        await ev(`(()=>{const r=${SC}.room,me=r.state.players.get(r.sessionId);let bx=1,by=0,bd=1e9;r.state.enemies.forEach(e=>{const dd=Math.hypot(e.x-me.x,e.y-me.y);if(dd<bd){bd=dd;bx=e.x-me.x;by=e.y-me.y;}});r.send('attack',{aimX:bx,aimY:by});})()`);
        const s = await ev(`(()=>{const sc=${SC},r=sc.room;let tough=0;r.state.enemies.forEach(e=>{if(e.tough)tough++;});return {zonesSrv:r.state.zones.size, zonesCli:sc.zones.size, tough, elapsed:Math.floor(r.state.elapsed)};})()`);
        if (s) {
          maxZonesSrv = Math.max(maxZonesSrv, s.zonesSrv); maxZonesCli = Math.max(maxZonesCli, s.zonesCli); maxTough = Math.max(maxTough, s.tough); maxElapsed = Math.max(maxElapsed, s.elapsed);
          if (s.tough > 0 && !shot) {
            await ev(`(()=>{const sc=${SC},r=sc.room,me=r.state.players.get(r.sessionId);sc.cameras.main.setZoom(0.8);sc.cameras.main.centerOn(me.x,me.y);})()`);
            await sleep(150);
            const sh = await cmd("Page.captureScreenshot", { format: "png" });
            fs.writeFileSync("C:/Projects/Dimension Drifters v2/tools/artkit/out/_variety_check.png", Buffer.from(sh.result.data, "base64"));
            shot = true;
          }
        }
        await sleep(320);
      }
      // fallback screenshot if we never caught both at once
      if (!shot) {
        await ev(`(()=>{const sc=${SC},r=sc.room,me=r.state.players.get(r.sessionId);sc.cameras.main.setZoom(0.8);sc.cameras.main.centerOn(me.x,me.y);})()`);
        await sleep(150);
        const sh = await cmd("Page.captureScreenshot", { format: "png" });
        fs.writeFileSync("C:/Projects/Dimension Drifters v2/tools/artkit/out/_variety_check.png", Buffer.from(sh.result.data, "base64"));
      }
      console.log(JSON.stringify({ maxZones_server: maxZonesSrv, maxZones_client: maxZonesCli, maxTough_concurrent: maxTough, maxElapsed, toughShot: shot }));
      ws.close(); process.exit(0);
    });
  });
}).on("error", (e) => { console.log("err", e.message); process.exit(1); });
