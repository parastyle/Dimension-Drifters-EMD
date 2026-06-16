// Live verification (CDP → Electron :9222) of the §17 procgen pitfalls: the client bakes the floor from
// the synced seeds, and a grounded player who walks onto a pit FALLS (chip damage + snap-back + fellSeq).
// Also grabs a zoomed-out screenshot of the rendered floor. Run: node tools/cdp-pits.cjs
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
        // Fresh reload so the scene picks up the new client code + bakes the floor in create()/update().
        await ev("window.location.reload()");
        for (let i = 0; i < 40; i++) {
          await sleep(500);
          if (await ev(`!!(window.ddGame&&${SC}.room&&${SELF}&&${SC}.floorBuilt)`)) break;
        }
        const out = {};
        out.floorBuilt = await ev(`!!${SC}.floorBuilt`);
        out.map = await ev(
          `(()=>{const m=${SC}.arenaMap;if(!m)return null;let pit=0;for(let i=0;i<m.tiles.length;i++)if(m.tiles[i]===1)pit++;return{cols:m.cols,rows:m.rows,tile:m.tileSize,pitTiles:pit};})()`,
        );

        // Clean room for the fall test — Testing Grounds (no enemies), pits still present.
        if ((await ev(`${SC}.room.state.mode`)) !== "training") {
          await ev(`${SC}.room.send('toggleTraining')`);
          await sleep(800);
        }

        // Nearest pit tile centre to the player.
        const target = await ev(
          `(()=>{const m=${SC}.arenaMap,me=${SELF};const T=m.tileSize;let best=null,bd=1e18;` +
            `for(let i=0;i<m.tiles.length;i++){if(m.tiles[i]!==1)continue;const tx=(i%m.cols+0.5)*T,ty=((i/m.cols|0)+0.5)*T;` +
            `const dx=tx-me.x,dy=ty-me.y,dd=dx*dx+dy*dy;if(dd<bd){bd=dd;best={x:tx,y:ty};}}return best;})()`,
        );
        out.nearestPit = target;
        out.hp0 = await ev(`${SELF}.hp`);
        out.fell0 = await ev(`${SELF}.fellSeq`);

        if (target) {
          let minHp = out.hp0;
          // Push toward the pit for a few seconds — each step onto it = a fall (chip + snap-back).
          for (let i = 0; i < 45; i++) {
            const st = await ev(
              `(()=>{const me=${SELF};const dx=${target.x}-me.x,dy=${target.y}-me.y;const l=Math.hypot(dx,dy)||1;return{l,dx:dx/l,dy:dy/l,hp:me.hp};})()`,
            );
            minHp = Math.min(minHp, st.hp);
            if (!st.hp || st.hp <= 0) break; // downed — stop pushing
            await ev(`${SC}.room.send('input',{dx:${st.dx},dy:${st.dy}})`);
            await sleep(90);
          }
          await ev(`${SC}.room.send('input',{dx:0,dy:0})`);
          await sleep(200);
          out.fell1 = await ev(`${SELF}.fellSeq`);
          out.minHp = Math.round(minHp);
          out.repositionedToGround = await ev(
            `(()=>{const m=${SC}.arenaMap,me=${SELF};const tx=Math.floor(me.x/m.tileSize),ty=Math.floor(me.y/m.tileSize);return m.tiles[ty*m.cols+tx]!==1;})()`,
          );
          out.falls = (out.fell1 ?? 0) - (out.fell0 ?? 0);
        }

        // Zoomed-out floor screenshot for visual proof — capture + RESTORE the real zoom (RENDER_DPR),
        // never hardcode 1 (that leaves the live window zoomed out on a hi-DPI display).
        await ev(`${SC}.room.send('input',{dx:0,dy:0})`);
        const z0 = await ev(`${SC}.cameras.main.zoom`);
        await ev(`${SC}.cameras.main.setZoom(0.55)`);
        await sleep(500);
        await shot("tmp-pits.png");
        await ev(`${SC}.cameras.main.setZoom(${z0})`);

        console.log(JSON.stringify(out, null, 1));
        ws.close();
      });
    });
  })
  .on("error", (e) => console.log("CDP connect error:", e.message));
