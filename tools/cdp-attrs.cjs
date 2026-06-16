const http = require("node:http");
const fs = require("node:fs");
const WebSocket = require("C:/Projects/Dimension Drifters v2/node_modules/.pnpm/ws@8.21.0/node_modules/ws");
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
        await cmd("Page.enable", {});
        await ev("location.reload()");
        for (let i = 0; i < 20; i++) {
          await sleep(700);
          if (await ev(`!!(window.ddGame&&${SC}.room&&${SC}.room.state.players.size>0)`)) break;
        }
        if ((await ev(`${SC}.room.state.mode`)) !== "arena")
          await ev(`${SC}.room.send('toggleTraining')`);
        await ev(`${SC}.room.send('restart')`);
        for (let i = 0; i < 4; i++) {
          const w = await ev(`${SC}.room.state.players.get(${SC}.room.sessionId).weapon`);
          if (w === "tombstone-greatsword") break;
          await ev(`${SC}.room.send('cycleWeapon')`);
          await sleep(200);
        }
        const snap = `(()=>{const r=${SC}.room,me=r.state.players.get(r.sessionId);return {level:me.level,flexPending:me.flexPending,flexTimer:Math.round(me.flexTimer*10)/10,str:me.str,dex:me.dex,int:me.int,con:me.con,luk:me.luk,maxHp:me.maxHp,winObjs:${SC}.levelWinObjects.length};})()`;
        // farm until a flex window opens
        let atFlex = null;
        for (let t = 0; t < 120 && !atFlex; t++) {
          const th = t * 0.3;
          await ev(
            `${SC}.room.send('input',{dx:${Math.cos(th).toFixed(3)},dy:${Math.sin(th).toFixed(3)}})`,
          );
          await ev(
            `(()=>{const r=${SC}.room,me=r.state.players.get(r.sessionId);let bx=1,by=0,bd=1e9;r.state.enemies.forEach(e=>{const dd=Math.hypot(e.x-me.x,e.y-me.y);if(dd<bd){bd=dd;bx=e.x-me.x;by=e.y-me.y;}});r.send('attack',{aimX:bx,aimY:by});})()`,
          );
          const s = await ev(snap);
          if (s && s.flexPending > 0) atFlex = s;
          await sleep(300);
        }
        const out = {
          reachedWindow: !!atFlex,
          autoAtLevelUp: atFlex && {
            level: atFlex.level,
            str: atFlex.str,
            con: atFlex.con,
            others: `${atFlex.dex}/${atFlex.int}/${atFlex.luk}`,
            maxHp: atFlex.maxHp,
            flexPending: atFlex.flexPending,
            winObjs: atFlex.winObjs,
          },
        };
        if (atFlex) {
          await sleep(250);
          const sh = await cmd("Page.captureScreenshot", { format: "png" });
          fs.writeFileSync(
            "C:/Projects/Dimension Drifters v2/tools/artkit/out/_attr_window.png",
            Buffer.from(sh.result.data, "base64"),
          );
          // pick CON via the message
          await ev(`${SC}.room.send('chooseAttribute',{attr:'con'})`);
          await sleep(400);
          out.afterPickCon = await ev(snap);
          // now trigger the 5s auto-resolve: farm to next level, then WAIT without picking
          for (let t = 0; t < 60; t++) {
            const th = t * 0.4;
            await ev(
              `${SC}.room.send('input',{dx:${Math.cos(th).toFixed(3)},dy:${Math.sin(th).toFixed(3)}})`,
            );
            await ev(
              `(()=>{const r=${SC}.room,me=r.state.players.get(r.sessionId);let bx=1,by=0,bd=1e9;r.state.enemies.forEach(e=>{const dd=Math.hypot(e.x-me.x,e.y-me.y);if(dd<bd){bd=dd;bx=e.x-me.x;by=e.y-me.y;}});r.send('attack',{aimX:bx,aimY:by});})()`,
            );
            const s = await ev(snap);
            if (s && s.flexPending > 0) {
              out.beforeTimeout = s;
              break;
            }
            await sleep(280);
          }
          if (out.beforeTimeout) {
            await sleep(6000);
            out.afterTimeout = await ev(snap);
          }
        }
        console.log(JSON.stringify(out, null, 1));
        ws.close();
        process.exit(0);
      });
    });
  })
  .on("error", (e) => {
    console.log("err", e.message);
    process.exit(1);
  });
