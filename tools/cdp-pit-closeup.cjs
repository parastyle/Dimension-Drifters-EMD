// Close-up capture of a §17 pit edge so the rust+amber rim + chevron teeth read. Run after cdp-pits.cjs.
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
        // Steer until the player sits ~1 tile from the nearest pit edge (a clean framing spot), then zoom in.
        const target = await ev(
          `(()=>{const m=${SC}.arenaMap,me=${SELF};const T=m.tileSize;let best=null,bd=1e18;for(let i=0;i<m.tiles.length;i++){if(m.tiles[i]!==1)continue;const tx=(i%m.cols+0.5)*T,ty=((i/m.cols|0)+0.5)*T;const dx=tx-me.x,dy=ty-me.y,dd=dx*dx+dy*dy;if(dd<bd){bd=dd;best={x:tx,y:ty};}}return best;})()`,
        );
        for (let i = 0; i < 40 && target; i++) {
          const st = await ev(
            `(()=>{const me=${SELF};const dx=${target.x}-me.x,dy=${target.y}-me.y;const l=Math.hypot(dx,dy)||1;return{l,dx:dx/l,dy:dy/l};})()`,
          );
          if (st.l < 120) break;
          await ev(`${SC}.room.send('input',{dx:${st.dx},dy:${st.dy}})`);
          await sleep(90);
        }
        await ev(`${SC}.room.send('input',{dx:0,dy:0})`);
        const z0 = await ev(`${SC}.cameras.main.zoom`); // capture + restore the real zoom (RENDER_DPR), not 1
        await ev(`${SC}.cameras.main.setZoom(1.7)`);
        await sleep(500);
        const s = await cmd("Page.captureScreenshot", { format: "png" });
        fs.writeFileSync(`${OUT}/tmp-pit-closeup.png`, Buffer.from(s.result.data, "base64"));
        await ev(`${SC}.cameras.main.setZoom(${z0})`);
        console.log("captured tmp-pit-closeup.png");
        ws.close();
      });
    });
  })
  .on("error", (e) => console.log("CDP connect error:", e.message));
