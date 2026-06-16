// One-off behaviour verification (CDP → Electron :9222) for the §5/§13 control reallocation:
//   • Spacebar JUMP: sets the synced `airborne` timer, follows an arc back to 0, and is gated by a
//     cooldown (a mid-cooldown re-press is rejected; a post-cooldown press is accepted).
//   • R GRAB: in Testing Grounds, steer onto a ground weapon and confirm `grabWeapon` equips it.
// Run with the stack up (DD_DEBUG_PORT=9222 pnpm dev:desktop):  node tools/cdp-controls.cjs
const http = require("node:http");
const WebSocket = require("C:/Projects/Dimension Drifters v2/node_modules/.pnpm/ws@8.21.0/node_modules/ws");

http
  .get("http://localhost:9222/json/list", (res) => {
    let d = "";
    res.on("data", (c) => (d += c));
    res.on("end", async () => {
      const page = JSON.parse(d).find((t) => t.type === "page" && /5180/.test(t.url));
      if (!page) return console.log(JSON.stringify({ error: "no game page on :5180" }));
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
        for (let i = 0; i < 30; i++) {
          await sleep(500);
          if (await ev(`!!(window.ddGame&&${SC}.room&&${SC}.room.state.players.size>0)`)) break;
        }
        if (!(await ev(`!!(window.ddGame&&${SC}.room&&${SELF})`)))
          return console.log(JSON.stringify({ error: "game/player not ready" })), ws.close();

        const air = () => ev(`${SELF}.airborne`);
        const out = {};

        // Run everything in Testing Grounds — no enemies, so a stationary test player can't die mid-check.
        if ((await ev(`${SC}.room.state.mode`)) !== "training") {
          await ev(`${SC}.room.send('toggleTraining')`);
          await sleep(900); // let the swarm clear + a respawn settle
        }
        out.alive = await ev(`${SELF}.alive`);

        // ---- JUMP ----
        out.airborneAtRest = await air();
        await ev(`${SC}.room.send('jump')`);
        await sleep(150);
        out.airborneAfterJump = await air(); // > 0 = accepted
        await sleep(420);
        out.airborneAfterLanding = await air(); // ~0 = arc completed (AIRTIME 0.45s)
        // Mid-cooldown re-press (still inside JUMP_COOLDOWN 0.7s): must be rejected.
        await ev(`${SC}.room.send('jump')`);
        await sleep(150);
        out.airborneMidCooldownRepress = await air(); // ~0 = correctly rejected
        // Past the cooldown: a fresh press is accepted again.
        await sleep(350);
        await ev(`${SC}.room.send('jump')`);
        await sleep(150);
        out.airborneAfterCooldown = await air(); // > 0 = accepted again
        await sleep(450);

        // ---- DROP → GRAB round-trip (the §13 affordance) ----
        const PICKUP_R = 46;
        // Aim somewhere so the drop lands a step away (not on top of us), then drop the held weapon.
        await ev(`${SC}.selfAim={x:1,y:0}`);
        out.weaponBefore = await ev(`${SELF}.weapon`);
        await ev(`${SC}.room.send('dropWeapon')`);
        await sleep(250);
        out.weaponAfterDrop = await ev(`${SELF}.weapon`); // → "fists"
        out.pickupCountAfterDrop = await ev(`${SC}.room.state.pickups.size`); // ≥ 1
        const target = await ev(
          `(()=>{const me=${SELF};let best=null,bd=1e9;${SC}.room.state.pickups.forEach(pk=>{const d=(pk.x-me.x)**2+(pk.y-me.y)**2;if(d<bd){bd=d;best={x:pk.x,y:pk.y,weapon:pk.weapon};}});return best;})()`,
        );
        out.dropPickup = target;
        await sleep(800); // wait out DROP_GRACE_SECONDS (0.7s) so the drop is re-grabbable
        if (target) {
          // Steer onto it with movement input.
          for (let i = 0; i < 60; i++) {
            const st = await ev(
              `(()=>{const me=${SELF};const dx=${target.x}-me.x,dy=${target.y}-me.y;const l=Math.hypot(dx,dy)||1;return {l,dx:dx/l,dy:dy/l};})()`,
            );
            if (st.l < PICKUP_R * 0.8) break;
            await ev(`${SC}.room.send('input',{dx:${st.dx},dy:${st.dy}})`);
            await sleep(90);
          }
          await ev(`${SC}.room.send('input',{dx:0,dy:0})`);
          await sleep(150);
          out.distAtGrab = await ev(
            `(()=>{const me=${SELF};return Math.round(Math.hypot(${target.x}-me.x,${target.y}-me.y));})()`,
          );
          await ev(`${SC}.room.send('grabWeapon')`);
          await sleep(250);
          out.weaponAfter = await ev(`${SELF}.weapon`);
          out.grabbed = out.weaponAfter === target.weapon;
        }

        console.log(JSON.stringify(out, null, 1));
        ws.close();
      });
    });
  })
  .on("error", (e) => console.log("CDP connect error:", e.message));
