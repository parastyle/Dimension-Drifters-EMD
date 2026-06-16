// Quick CDP read: confirm the live room minted + synced the §17 map seeds (server onCreate didn't choke)
// and that the client can reproduce the same map from them. Run: node tools/cdp-seeds.cjs
const http = require("node:http");
const WebSocket = require("C:/Projects/Dimension Drifters v2/node_modules/.pnpm/ws@8.21.0/node_modules/ws");
http.get("http://localhost:9222/json/list", (res) => {
  let d = "";
  res.on("data", (c) => (d += c));
  res.on("end", () => {
    const pg = JSON.parse(d).find((t) => t.type === "page" && /5180/.test(t.url));
    if (!pg) return console.log("no game page");
    const ws = new WebSocket(pg.webSocketDebuggerUrl);
    let id = 0;
    const p = {};
    const cmd = (m, pa) =>
      new Promise((r) => {
        const i = ++id;
        p[i] = r;
        ws.send(JSON.stringify({ id: i, method: m, params: pa }));
      });
    const ev = async (e) =>
      (await cmd("Runtime.evaluate", { expression: e, returnByValue: true })).result?.result?.value;
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
      for (let i = 0; i < 30; i++) {
        await sleep(500);
        if (await ev(`!!(window.ddGame&&${SC}.room&&${SC}.room.state.players.size>0)`)) break;
      }
      const st = await ev(
        `(()=>{const s=${SC}.room.state;const me=s.players.get(${SC}.room.sessionId);return {seedTerrain:s.seedTerrain,seedHazard:s.seedHazard,seedTheme:s.seedTheme,seedDecor:s.seedDecor,spawnX:Math.round(me.x),spawnY:Math.round(me.y),players:s.players.size};})()`,
      );
      console.log(JSON.stringify(st, null, 1));
      ws.close();
    });
  });
});
