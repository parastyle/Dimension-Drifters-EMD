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
      const shoot = async (_name, file) => {
        const s = await cmd("Page.captureScreenshot", { format: "png" });
        fs.writeFileSync(
          `C:/Projects/Dimension Drifters v2/tools/artkit/out/${file}`,
          Buffer.from(s.result.data, "base64"),
        );
      };
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
        await ev(`${SC}.room.send('spawnBoss')`);
        let bossSeen = false,
          bossHpMin = 9999,
          portalOpened = false,
          victory = false,
          bossShot = false,
          winShot = false;
        for (let t = 0; t < 150 && !victory; t++) {
          const s = await ev(
            `(()=>{const sc=${SC},r=sc.room,me=r.state.players.get(r.sessionId);let boss=null;r.state.enemies.forEach(e=>{if(e.kind==='old-rust')boss={x:e.x,y:e.y,hp:e.hp};});const st=r.state;return {me:{x:me.x,y:me.y,alive:me.alive,hp:Math.round(me.hp)},boss,portalOpen:st.portalOpen,portal:{x:st.portalX,y:st.portalY},outcome:st.outcome,enemies:st.enemies.size};})()`,
          );
          if (!s) {
            await sleep(250);
            continue;
          }
          if (s.outcome === "victory") {
            victory = true;
            if (!winShot) {
              await ev(
                `(()=>{const sc=${SC},r=sc.room,me=r.state.players.get(r.sessionId);sc.cameras.main.setZoom(1);sc.cameras.main.centerOn(me.x,me.y);})()`,
              );
              await sleep(150);
              await shoot("victory", "_boss_victory.png");
              winShot = true;
            }
            break;
          }
          let tx = s.me.x,
            ty = s.me.y;
          if (s.boss) {
            bossSeen = true;
            bossHpMin = Math.min(bossHpMin, s.boss.hp);
            tx = s.boss.x;
            ty = s.boss.y;
          } else if (s.portalOpen) {
            portalOpened = true;
            tx = s.portal.x;
            ty = s.portal.y;
          }
          const dx = tx - s.me.x,
            dy = ty - s.me.y,
            len = Math.hypot(dx, dy) || 1;
          await ev(
            `${SC}.room.send('input',{dx:${(dx / len).toFixed(3)},dy:${(dy / len).toFixed(3)}})`,
          );
          if (s.boss)
            await ev(
              `${SC}.room.send('attack',{aimX:${(dx / len).toFixed(3)},aimY:${(dy / len).toFixed(3)}})`,
            );
          if (s.boss && s.boss.hp < 380 && !bossShot) {
            await ev(
              `(()=>{const sc=${SC},r=sc.room,me=r.state.players.get(r.sessionId);sc.cameras.main.setZoom(0.85);sc.cameras.main.centerOn(me.x,me.y);})()`,
            );
            await sleep(150);
            await shoot("boss", "_boss_fight.png");
            bossShot = true;
          }
          await sleep(260);
        }
        console.log(
          JSON.stringify({
            bossSeen,
            bossHpMin: bossHpMin === 9999 ? null : bossHpMin,
            portalOpened,
            victory,
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
