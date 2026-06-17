// Close-up of the player beside a §17 POI landmark (clean money shot). Run after the stack is up.
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
        for (let i = 0; i < 20; i++) {
          await sleep(400);
          if (await ev(`!!(window.ddGame&&${SC}.floorBuilt&&${SELF})`)) break;
        }
        if ((await ev(`${SC}.room.state.mode`)) !== "training") {
          await ev(`${SC}.room.send('toggleTraining')`);
          await sleep(600);
        }
        const poi = await ev(
          `(()=>{const me=${SELF};let best=null,bd=1e18;for(const p of ${SC}.arenaMap.pois){const d=(p.x-me.x)**2+(p.y-me.y)**2;if(d<bd){bd=d;best={x:p.x,y:p.y};}}return best;})()`,
        );
        for (let i = 0; i < 50 && poi; i++) {
          const st = await ev(
            `(()=>{const me=${SELF};const dx=${poi.x}-me.x,dy=${poi.y}-me.y;const l=Math.hypot(dx,dy)||1;return {l,dx:dx/l,dy:dy/l};})()`,
          );
          if (st.l < 150) break;
          await ev(`${SC}.room.send('input',{dx:${st.dx},dy:${st.dy}})`);
          await sleep(80);
        }
        await ev(`${SC}.room.send('input',{dx:0,dy:0})`);
        const z0 = await ev(`${SC}.cameras.main.zoom`);
        await ev(`${SC}.cameras.main.setZoom(1.5)`);
        await sleep(450);
        const s = await cmd("Page.captureScreenshot", { format: "png" });
        fs.writeFileSync(`${OUT}/tmp-poi-closeup.png`, Buffer.from(s.result.data, "base64"));
        await ev(`${SC}.cameras.main.setZoom(${z0})`);
        console.log("captured tmp-poi-closeup.png");
        ws.close();
      });
    });
  })
  .on("error", (e) => console.log("CDP connect error:", e.message));
