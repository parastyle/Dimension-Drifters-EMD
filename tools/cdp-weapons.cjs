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
    const shoot = async (f) => { const s = await cmd("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(`C:/Projects/Dimension Drifters v2/tools/artkit/out/${f}`, Buffer.from(s.result.data, "base64")); };
    ws.on("message", (m) => { const o = JSON.parse(m); if (o.id && p[o.id]) { p[o.id](o); delete p[o.id]; } });
    ws.on("open", async () => {
      const SC = "window.ddGame.scene.scenes[0]";
      await cmd("Page.enable", {});
      await ev("location.reload()");
      for (let i = 0; i < 20; i++) { await sleep(700); if (await ev(`!!(window.ddGame&&${SC}.room&&${SC}.room.state.players.size>0)`)) break; }
      if ((await ev(`${SC}.room.state.mode`)) !== "arena") await ev(`${SC}.room.send('toggleTraining')`);
      await ev(`${SC}.room.send('restart')`);
      const out = {};
      out.vfxTextureLoaded = await ev(`${SC}.textures.exists('vfx-quake-tombstone')`);

      // ---- PART 1: cleaver throw (default weapon) ----
      let maxCleaverProj = 0, maxClientProj = 0, sawCharges = new Set(), sawReload = false, cleaverShot = false;
      const w0 = await ev(`${SC}.room.state.players.get(${SC}.room.sessionId).weapon`);
      out.startWeapon = w0;
      for (let t = 0; t < 70; t++) {
        const th = t * 0.25;
        await ev(`${SC}.room.send('input',{dx:${Math.cos(th).toFixed(3)},dy:${Math.sin(th).toFixed(3)}})`);
        await ev(`(()=>{const r=${SC}.room,me=r.state.players.get(r.sessionId);let bx=1,by=0,bd=1e9;r.state.enemies.forEach(e=>{const dd=Math.hypot(e.x-me.x,e.y-me.y);if(dd<bd){bd=dd;bx=e.x-me.x;by=e.y-me.y;}});${SC}.selfAim={x:bx/(Math.hypot(bx,by)||1),y:by/(Math.hypot(bx,by)||1)};r.send('attack',{aimX:${SC}.selfAim.x,aimY:${SC}.selfAim.y});})()`);
        const s = await ev(`(()=>{const sc=${SC},r=sc.room,me=r.state.players.get(r.sessionId);let cl=0;r.state.projectiles.forEach(p=>{if(p.kind==='cleaver')cl++;});return {cleaver:cl, clientProj:sc.projectiles.size, charges:me.charges, maxCharges:me.maxCharges};})()`);
        if (s) {
          maxCleaverProj = Math.max(maxCleaverProj, s.cleaver); maxClientProj = Math.max(maxClientProj, s.clientProj);
          sawCharges.add(s.charges); if (s.charges === 0) sawReload = true;
          if (s.cleaver >= 2 && !cleaverShot) { await ev(`(()=>{const sc=${SC},r=sc.room,me=r.state.players.get(r.sessionId);sc.cameras.main.setZoom(1.3);sc.cameras.main.centerOn(me.x,me.y);})()`); await sleep(120); await shoot("_cleaver_throw.png"); cleaverShot = true; }
        }
        await sleep(160);
      }
      out.cleaver = { maxCleaverProjectiles: maxCleaverProj, maxClientProjectiles: maxClientProj, chargesSeen: [...sawCharges].sort(), refilled: sawReload && sawCharges.has(3) };

      // ---- PART 2: greatsword quake hero VFX ----
      for (let i = 0; i < 4; i++) { const w = await ev(`${SC}.room.state.players.get(${SC}.room.sessionId).weapon`); if (w === "tombstone-greatsword") break; await ev(`${SC}.room.send('cycleWeapon')`); await sleep(250); }
      out.gsWeapon = await ev(`${SC}.room.state.players.get(${SC}.room.sessionId).weapon`);
      // fire a quake and screenshot during the eruption
      for (let t = 0; t < 10; t++) {
        await ev(`(()=>{const r=${SC}.room,me=r.state.players.get(r.sessionId);${SC}.selfAim={x:1,y:0};r.send('attack',{aimX:1,aimY:0});})()`);
        // local quake VFX fires in sendAttack on RMB; trigger it directly via the scene for capture:
        await ev(`(()=>{const sc=${SC},r=sc.room,me=r.state.players.get(r.sessionId);const w=window.ddGame&&true; sc.cameras.main.setZoom(1.1); sc.cameras.main.centerOn(me.x,me.y); const wdef=${SC}.room.state.players.get(${SC}.room.sessionId); return 1;})()`);
        await sleep(90);
        if (t === 3) {
          // directly invoke the hero quake at the player for a clean capture
          await ev(`(()=>{const sc=${SC},r=sc.room,me=r.state.players.get(r.sessionId);sc['spawnQuake'](me.x,me.y,{radius:185,damage:8,vfx:{image:'vfx-quake-tombstone',radius:1.46,flash:0.12,dust:1,debris:40,shake:0.13}});return 1;})()`);
          await sleep(110);
          await shoot("_greatsword_quake.png");
        }
        await sleep(120);
      }
      console.log(JSON.stringify(out, null, 1));
      ws.close(); process.exit(0);
    });
  });
}).on("error", (e) => { console.log("err", e.message); process.exit(1); });
