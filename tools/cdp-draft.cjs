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
        const statsExpr = `(()=>{const r=${SC}.room,me=r.state.players.get(r.sessionId);return {level:me.level,pending:me.pendingUpgrades,maxHp:me.maxHp,power:me.power,speedMul:me.speedMul,regenBonus:me.regenBonus,haste:me.haste,xpMul:me.xpMul,draftCards:${SC}.draftObjects.length};})()`;
        let result = { reached: false };
        for (let t = 0; t < 120; t++) {
          const th = t * 0.3;
          await ev(
            `${SC}.room.send('input',{dx:${Math.cos(th).toFixed(3)},dy:${Math.sin(th).toFixed(3)}})`,
          );
          await ev(
            `(()=>{const r=${SC}.room,me=r.state.players.get(r.sessionId);let bx=1,by=0,bd=1e9;r.state.enemies.forEach(e=>{const dd=Math.hypot(e.x-me.x,e.y-me.y);if(dd<bd){bd=dd;bx=e.x-me.x;by=e.y-me.y;}});r.send('attack',{aimX:bx,aimY:by});})()`,
          );
          const s = await ev(statsExpr);
          if (s?.pending) {
            await sleep(250); // let the overlay render
            const before = await ev(statsExpr);
            const sh = await cmd("Page.captureScreenshot", { format: "png" });
            fs.writeFileSync(
              "C:/Projects/Dimension Drifters v2/tools/artkit/out/_draft_overlay.png",
              Buffer.from(sh.result.data, "base64"),
            );
            const offered = before.pending.split(",");
            const pick = offered[0];
            await ev(`${SC}.room.send('chooseUpgrade',{id:'${pick}'})`);
            await sleep(400);
            const after = await ev(statsExpr);
            result = {
              reached: true,
              offered,
              picked: pick,
              draftCardsWhileOpen: before.draftCards,
              before: {
                maxHp: before.maxHp,
                power: before.power,
                speedMul: before.speedMul,
                regenBonus: before.regenBonus,
                haste: before.haste,
                xpMul: before.xpMul,
              },
              after: {
                maxHp: after.maxHp,
                power: after.power,
                speedMul: after.speedMul,
                regenBonus: after.regenBonus,
                haste: after.haste,
                xpMul: after.xpMul,
              },
              pendingClearedOrNext: after.pending,
              draftCardsAfter: after.draftCards,
            };
            break;
          }
          await sleep(300);
        }
        console.log(JSON.stringify(result, null, 1));
        ws.close();
        process.exit(0);
      });
    });
  })
  .on("error", (e) => {
    console.log("err", e.message);
    process.exit(1);
  });
