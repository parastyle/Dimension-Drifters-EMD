// Verify §17 POI landmarks: painted Codex structures placed in the arena + COLLIDABLE (a player can't
// walk through one). Steers into the nearest POI, confirms it's blocked, + screenshots the landmarks.
const http = require("node:http");
const fs = require("node:fs");
const WebSocket = require("C:/Projects/Dimension Drifters v2/node_modules/.pnpm/ws@8.21.0/node_modules/ws");
const OUT = "C:/Projects/Dimension Drifters v2";

http.get("http://localhost:9222/json/list", (res) => {
  let d = "";
  res.on("data", (c) => (d += c));
  res.on("end", async () => {
    const page = JSON.parse(d).find((t) => t.type === "page" && /5180/.test(t.url));
    if (!page) return console.log(JSON.stringify({ error: "no game page" }));
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const p = {};
    const cmd = (m, pa) => new Promise((r) => { const i = ++id; p[i] = r; ws.send(JSON.stringify({ id: i, method: m, params: pa })); });
    const ev = async (e) => (await cmd("Runtime.evaluate", { expression: e, returnByValue: true })).result?.result?.value;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    ws.on("message", (m) => { const o = JSON.parse(m); if (o.id && p[o.id]) { p[o.id](o); delete p[o.id]; } });
    ws.on("open", async () => {
      const SC = "window.ddGame.scene.scenes[0]";
      const SELF = `${SC}.room.state.players.get(${SC}.room.sessionId)`;
      await cmd("Page.enable", {});
      await ev("window.location.reload()");
      for (let i = 0; i < 40; i++) { await sleep(500); if (await ev(`!!(window.ddGame&&${SC}.floorBuilt&&${SELF})`)) break; }
      if ((await ev(`${SC}.room.state.mode`)) !== "training") { await ev(`${SC}.room.send('toggleTraining')`); await sleep(700); }
      await ev(`${SC}.room.send('input',{dx:0,dy:0})`);

      const out = {};
      out.poiCount = await ev(`${SC}.arenaMap.pois.length`);
      out.poiTexLoaded = await ev(`${SC}.textures.exists('poi-00')?${SC}.textures.get('poi-00').getSourceImage().width:0`);

      // Nearest POI, then steer INTO it + record the closest the player gets to its centre (collision stop).
      const poi = await ev(
        `(()=>{const me=${SELF};let best=null,bd=1e18;for(const p of ${SC}.arenaMap.pois){const d=(p.x-me.x)**2+(p.y-me.y)**2;if(d<bd){bd=d;best={x:p.x,y:p.y};}}return best;})()`,
      );
      out.targetPoi = poi;
      if (poi) {
        let minDist = 1e9;
        for (let i = 0; i < 45; i++) {
          const st = await ev(`(()=>{const me=${SELF};const dx=${poi.x}-me.x,dy=${poi.y}-me.y;const l=Math.hypot(dx,dy)||1;return {l,dx:dx/l,dy:dy/l};})()`);
          minDist = Math.min(minDist, st.l);
          await ev(`${SC}.room.send('input',{dx:${st.dx},dy:${st.dy}})`);
          await sleep(80);
        }
        await ev(`${SC}.room.send('input',{dx:0,dy:0})`);
        out.closestToPoiCenter = Math.round(minDist); // ~POI_RADIUS(52)+PLAYER_RADIUS(24)=76 if blocked
      }

      // Screenshot the landmarks (zoom out; capture + RESTORE the real zoom).
      const z0 = await ev(`${SC}.cameras.main.zoom`);
      await ev(`${SC}.cameras.main.setZoom(0.55)`);
      await sleep(400);
      const s = await cmd("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(`${OUT}/tmp-pois.png`, Buffer.from(s.result.data, "base64"));
      await ev(`${SC}.cameras.main.setZoom(${z0})`);

      console.log(JSON.stringify(out, null, 1));
      ws.close();
    });
  });
}).on("error", (e) => console.log("CDP connect error:", e.message));
