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
      for (let i = 0; i < 18; i++) { await sleep(700); if (await ev(`!!(window.ddGame&&${SC}.room&&${SC}.room.state.players.size>0)`)) break; }
      // Calm scene: training mode (no swarm), then equip the 2H greatsword to show the sharpest test case.
      if ((await ev(`${SC}.room.state.mode`)) !== "training") await ev(`${SC}.room.send('toggleTraining')`);
      await sleep(800);
      for (let i = 0; i < 4; i++) {
        const w = await ev(`${SC}.room.state.players.get(${SC}.room.sessionId).weapon`);
        if (w === "tombstone-greatsword") break;
        await ev(`${SC}.room.send('cycleWeapon')`); await sleep(400);
      }
      // Zoom the camera in on the player so sprite edges are clearly visible.
      await ev(`(()=>{const s=${SC},r=s.room,me=r.state.players.get(r.sessionId);const cam=s.cameras.main;cam.setZoom(3.2);cam.centerOn(me.x,me.y);return s.scale.gameSize.width+'x'+s.scale.gameSize.height;})()`);
      await sleep(900);
      const shot = await cmd("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync("C:/Projects/Dimension Drifters v2/tools/artkit/out/_presize_check.png", Buffer.from(shot.result.data, "base64"));
      console.log("weapon:", await ev(`${SC}.room.state.players.get(${SC}.room.sessionId).weapon`));
      console.log("rig scale:", await ev(`(()=>{const s=${SC};const rig=s.players&&s.players.get(s.room.sessionId);return rig?rig.scale:'n/a';})()`));
      console.log("saved _presize_check.png");
      ws.close(); process.exit(0);
    });
  });
}).on("error", (e) => { console.log("err", e.message); process.exit(1); });
