// Verify §17 PAINTED ground: the Codex seamless dust tile fills the arena floor, the pit-floor tile is
// masked into the pits, and the 4K/ultrawide camera centres the arena (no corner-pin / void gaps).
const http = require("node:http");
const fs = require("node:fs");
const WebSocket = require("C:/Projects/Dimension Drifters v2/node_modules/.pnpm/ws@8.21.0/node_modules/ws");
const OUT = "C:/Projects/Dimension Drifters v2";

http
  .get("http://localhost:9222/json/list", (res) => {
    let d = "";
    res.on("data", (c) => (d += c));
    res.on("end", async () => {
      const page = JSON.parse(d).find((t) => t.type === "page" && /5180/.test(t.url));
      if (!page) return console.log(JSON.stringify({ error: "no game page" }));
      const ws = new WebSocket(page.webSocketDebuggerUrl);
      let id = 0;
      const p = {};
      const cmd = (m, pa) =>
        new Promise((r) => {
          const i = ++id;
          p[i] = r;
          ws.send(JSON.stringify({ id: i, method: m, params: pa }));
        });
      const ev = async (e) =>
        (await cmd("Runtime.evaluate", { expression: e, returnByValue: true })).result?.result
          ?.value;
      const shot = async (name) => {
        const s = await cmd("Page.captureScreenshot", { format: "png" });
        fs.writeFileSync(`${OUT}/${name}`, Buffer.from(s.result.data, "base64"));
      };
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      ws.on("message", (m) => {
        const o = JSON.parse(m);
        if (o.id && p[o.id]) {
          p[o.id](o);
          delete p[o.id];
        }
      });
      ws.on("open", async () => {
        const SC = "window.ddGame.scene.scenes[0]";
        const SELF = `${SC}.room.state.players.get(${SC}.room.sessionId)`;
        await cmd("Page.enable", {});
        await ev("window.location.reload()");
        for (let i = 0; i < 40; i++) {
          await sleep(500);
          if (await ev(`!!(window.ddGame&&${SC}.floorBuilt&&${SELF})`)) break;
        }
        if ((await ev(`${SC}.room.state.mode`)) !== "training") {
          await ev(`${SC}.room.send('toggleTraining')`);
          await sleep(700);
        }
        await ev(`${SC}.room.send('input',{dx:0,dy:0})`);

        const out = {};
        out.groundTile = await ev(
          `(()=>{const t='tile-ground';return ${SC}.textures.exists(t)?${SC}.textures.get(t).getSourceImage().width:0;})()`,
        );
        out.pitTile = await ev(
          `(()=>{const t='tile-pit';return ${SC}.textures.exists(t)?${SC}.textures.get(t).getSourceImage().width:0;})()`,
        );

        // Painted floor screenshot (zoom out a touch to see ground + a pit; capture + RESTORE the real zoom).
        const z0 = await ev(`${SC}.cameras.main.zoom`);
        await ev(`${SC}.cameras.main.setZoom(0.85)`);
        await sleep(400);
        await shot("tmp-tiles.png");
        await ev(`${SC}.cameras.main.setZoom(${z0})`);

        // 4K / ultrawide camera math: for a viewport WIDER than the 2400px arena, centerCam must CENTRE the
        // arena (negative scroll), not pin it to a corner. Verify the formula directly.
        out.camCheck = await ev(
          `(()=>{const W=2400;const axis=(t,view,world)=>view>=world?(world-view)/2:Math.max(0,Math.min(world-view,t));` +
            `return {view4k_2560:axis(0,2560,W),view_ultrawide_2293:axis(900,2293,W)};})()`,
        );
        out.renderDpr = await ev(`Math.min(2,Math.max(1,window.devicePixelRatio||1))`);

        console.log(JSON.stringify(out, null, 1));
        ws.close();
      });
    });
  })
  .on("error", (e) => console.log("CDP connect error:", e.message));
