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
        // Equip the quake greatsword (AoE farm) for reliable kills while circling.
        for (let i = 0; i < 4; i++) {
          const w = await ev(`${SC}.room.state.players.get(${SC}.room.sessionId).weapon`);
          if (w === "tombstone-greatsword") break;
          await ev(`${SC}.room.send('cycleWeapon')`);
          await sleep(200);
        }
        let maxLevel = 1,
          maxPower = 1,
          maxProj = 0,
          lastMaxHp = 100,
          leveledShot = -1;
        for (let t = 0; t < 90; t++) {
          const th = t * 0.3;
          await ev(
            `${SC}.room.send('input',{dx:${Math.cos(th).toFixed(3)},dy:${Math.sin(th).toFixed(3)}})`,
          );
          // aim at nearest enemy + attack (quake AoE fires around the player regardless)
          await ev(
            `(()=>{const r=${SC}.room,me=r.state.players.get(r.sessionId);let bx=1,by=0,bd=1e9;r.state.enemies.forEach(e=>{const d=Math.hypot(e.x-me.x,e.y-me.y);if(d<bd){bd=d;bx=e.x-me.x;by=e.y-me.y;}});r.send('attack',{aimX:bx,aimY:by});})()`,
          );
          const s = await ev(
            `(()=>{const r=${SC}.room,me=r.state.players.get(r.sessionId);return {level:me.level,xp:Math.round(me.xp*10)/10,xpToNext:me.xpToNext,power:me.power,maxHp:me.maxHp,hp:Math.round(me.hp),proj:r.state.projectiles.size,enemies:r.state.enemies.size,alive:me.alive};})()`,
          );
          if (s) {
            maxLevel = Math.max(maxLevel, s.level);
            maxPower = Math.max(maxPower, s.power);
            maxProj = Math.max(maxProj, s.proj);
            lastMaxHp = s.maxHp;
            if (s.level >= 2 && leveledShot < 0) {
              await ev(
                `(()=>{const s=${SC},r=s.room,me=r.state.players.get(r.sessionId);s.cameras.main.setZoom(1.3);s.cameras.main.centerOn(me.x,me.y);})()`,
              );
              await sleep(120);
              const shot = await cmd("Page.captureScreenshot", { format: "png" });
              fs.writeFileSync(
                "C:/Projects/Dimension Drifters v2/tools/artkit/out/_leveling_check.png",
                Buffer.from(shot.result.data, "base64"),
              );
              leveledShot = t;
            }
          }
          await sleep(300);
        }
        console.log(
          JSON.stringify({
            maxLevel,
            maxPower,
            maxHp_end: lastMaxHp,
            maxProjectiles: maxProj,
            screenshotAtTick: leveledShot,
          }),
        );
        ws.close();
        process.exit(0);
      });
    });
  })
  .on("error", (e) => {
    console.log("err", e.message);
    process.exit(1);
  });
