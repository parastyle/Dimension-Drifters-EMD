// Verify §9 gun aiming: the held gun's BARREL points at the cursor, and bullets + muzzle flash leave the
// BARREL TIP (not the body). Equips a gun, aims down-right, fires, and captures pose + firing frames.
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
        await ev("window.location.reload()");
        for (let i = 0; i < 40; i++) {
          await sleep(500);
          if (await ev(`!!(window.ddGame&&${SC}.room&&${SELF}&&${SC}.floorBuilt)`)) break;
        }
        if ((await ev(`${SC}.room.state.mode`)) !== "training") {
          await ev(`${SC}.room.send('toggleTraining')`);
          await sleep(700);
        }
        await ev(`${SC}.room.send('input',{dx:0,dy:0})`);

        // Cycle to the GATLING (fast auto — continuous flashes/bullets are easy to catch on camera).
        let weapon = "";
        for (let i = 0; i < 50; i++) {
          weapon = await ev(`${SELF}.weapon`);
          if (weapon === "x-gun-gatling") break;
          await ev(`${SC}.room.send('cycleWeapon')`);
          await sleep(130);
        }
        const out = { weapon };

        // Aim DOWN-RIGHT: fake the cursor (pointerScreen) so the LOCAL rig aims there, and send the matching
        // server aim so the shot travels the same way.
        const A = await ev(
          `(()=>{const me=${SELF},cam=${SC}.cameras.main;const ax=0.857,ay=0.514;` +
            `${SC}.pointerScreen={set:true,x:me.x-cam.scrollX+ax*260,y:me.y-cam.scrollY+ay*260};` +
            `return {tx:me.x+ax*300,ty:me.y+ay*300,ax,ay};})()`,
        );
        await sleep(400);
        const z0 = await ev(`${SC}.cameras.main.zoom`);
        await ev(`${SC}.cameras.main.setZoom(1.5)`);
        await sleep(300);
        await shot("tmp-gun-pose.png"); // barrel should point down-right at the cursor

        // FIRE continuously (attacking is reset each tick → re-send every ~tick). Catch a mid-burst frame
        // with the muzzle flash + bullets streaming from the BARREL TIP.
        let maxBullets = 0;
        for (let i = 0; i < 20; i++) {
          await ev(`${SC}.room.send('attack',{aimX:${A.ax},aimY:${A.ay},tx:${A.tx},ty:${A.ty}})`);
          await sleep(48);
          const n = await ev(`${SC}.room.state.projectiles.size`);
          maxBullets = Math.max(maxBullets, n ?? 0);
          if (i === 12) await shot("tmp-gun-fire.png");
        }
        out.maxBullets = maxBullets;
        out.aimDir = Math.round((await ev(`${SELF}.aimDir`)) * 100) / 100;

        await ev(`${SC}.cameras.main.setZoom(${z0})`);
        await ev(`${SC}.pointerScreen={set:false,x:0,y:0}`);
        console.log(JSON.stringify(out, null, 1));
        ws.close();
      });
    });
  })
  .on("error", (e) => console.log("CDP connect error:", e.message));
