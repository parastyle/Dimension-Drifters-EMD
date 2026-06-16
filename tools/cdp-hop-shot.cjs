// One-off visual capture (CDP → Electron :9222): the §5 jump HOP arc. Zooms onto the player, sends a
// jump, and grabs frames at launch / apex / descent + a grounded reference. Run: node tools/cdp-hop-shot.cjs
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
        for (let i = 0; i < 30; i++) {
          await sleep(500);
          if (await ev(`!!(window.ddGame&&${SC}.room&&${SELF})`)) break;
        }
        // Calm scene: Testing Grounds, stand still, zoom in on the rig.
        if ((await ev(`${SC}.room.state.mode`)) !== "training") {
          await ev(`${SC}.room.send('toggleTraining')`);
          await sleep(800);
        }
        await ev(`${SC}.room.send('input',{dx:0,dy:0})`);
        const z0 = await ev(`${SC}.cameras.main.zoom`); // capture + restore (RENDER_DPR), never hardcode 1
        await ev(`${SC}.cameras.main.setZoom(3)`);
        await sleep(500);
        await shot("tmp-hop-grounded.png");

        await ev(`${SC}.room.send('jump')`);
        await sleep(70);
        await shot("tmp-hop-launch.png"); // rising
        const a1 = await ev(`${SELF}.airborne`);
        await sleep(150);
        await shot("tmp-hop-apex.png"); // ~apex of the 0.45s arc
        const a2 = await ev(`${SELF}.airborne`);
        await sleep(160);
        await shot("tmp-hop-descent.png"); // falling
        const a3 = await ev(`${SELF}.airborne`);

        await ev(`${SC}.cameras.main.setZoom(${z0})`);
        console.log(JSON.stringify({ airborne: { launch: a1, apex: a2, descent: a3 } }, null, 1));
        ws.close();
      });
    });
  })
  .on("error", (e) => console.log("CDP connect error:", e.message));
