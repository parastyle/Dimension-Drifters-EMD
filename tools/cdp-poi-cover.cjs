// Smoke-test §17 POI COVER: fire the gatling at a landmark + confirm bullets are ABSORBED at it (don't
// fly through). Reports the POI distance vs the farthest any live bullet reaches from the player.
const http = require("node:http");
const WebSocket = require("C:/Projects/Dimension Drifters v2/node_modules/.pnpm/ws@8.21.0/node_modules/ws");
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
        // Equip the gatling (fast auto).
        for (let i = 0; i < 50; i++) {
          if ((await ev(`${SELF}.weapon`)) === "x-gun-gatling") break;
          await ev(`${SC}.room.send('cycleWeapon')`);
          await sleep(120);
        }
        // Steer to ~300px from the nearest POI.
        const poi = await ev(
          `(()=>{const me=${SELF};let b=null,bd=1e18;for(const p of ${SC}.arenaMap.pois){const dd=(p.x-me.x)**2+(p.y-me.y)**2;if(dd<bd){bd=dd;b={x:p.x,y:p.y};}}return b;})()`,
        );
        for (let i = 0; i < 60 && poi; i++) {
          const st = await ev(
            `(()=>{const me=${SELF};const dx=${poi.x}-me.x,dy=${poi.y}-me.y;const l=Math.hypot(dx,dy)||1;return {l,dx:dx/l,dy:dy/l};})()`,
          );
          if (st.l < 300) break;
          await ev(`${SC}.room.send('input',{dx:${st.dx},dy:${st.dy}})`);
          await sleep(80);
        }
        await ev(`${SC}.room.send('input',{dx:0,dy:0})`);
        const out = {};
        out.poiDist = await ev(
          `(()=>{const me=${SELF};return Math.round(Math.hypot(${poi.x}-me.x,${poi.y}-me.y));})()`,
        );
        // Aim AT the POI + fire continuously; sample the farthest any live bullet gets from the player.
        const A = await ev(
          `(()=>{const me=${SELF},cam=${SC}.cameras.main;const dx=${poi.x}-me.x,dy=${poi.y}-me.y,l=Math.hypot(dx,dy)||1,ax=dx/l,ay=dy/l;${SC}.pointerScreen={set:true,x:me.x-cam.scrollX+ax*260,y:me.y-cam.scrollY+ay*260};return {ax,ay};})()`,
        );
        let maxBullet = 0;
        for (let i = 0; i < 22; i++) {
          await ev(`${SC}.room.send('attack',{aimX:${A.ax},aimY:${A.ay},tx:${poi.x},ty:${poi.y}})`);
          await sleep(48);
          const far = await ev(
            `(()=>{const me=${SELF};let m=0;${SC}.room.state.projectiles.forEach(pr=>{const dd=Math.hypot(pr.x-me.x,pr.y-me.y);if(dd>m)m=dd;});return Math.round(m);})()`,
          );
          maxBullet = Math.max(maxBullet, far ?? 0);
        }
        await ev(`${SC}.room.send('input',{dx:0,dy:0})`);
        await ev(`${SC}.pointerScreen={set:false,x:0,y:0}`);
        out.maxBulletDistFromPlayer = maxBullet;
        out.blocked = maxBullet < out.poiDist + 70; // absorbed at the POI, not flown past toward range 640
        console.log(JSON.stringify(out, null, 1));
        ws.close();
      });
    });
  })
  .on("error", (e) => console.log("CDP connect error:", e.message));
