// Force a 4K (3840×2160) + an ultrawide (3440×1440) viewport via CDP emulation and screenshot each, to
// prove the painted floor fills the screen + the arena centres (no void gaps / corner-pin / stretching).
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
        for (let i = 0; i < 20; i++) {
          await sleep(400);
          if (await ev(`!!(window.ddGame&&${SC}.floorBuilt)`)) break;
        }
        const grab = async (w, h, name) => {
          await cmd("Emulation.setDeviceMetricsOverride", {
            width: w,
            height: h,
            deviceScaleFactor: 1,
            mobile: false,
          });
          await sleep(150);
          await ev(`window.dispatchEvent(new Event('resize'))`);
          await sleep(500);
          const s = await cmd("Page.captureScreenshot", {
            format: "png",
            clip: { x: 0, y: 0, width: w, height: h, scale: 0.42 },
          });
          fs.writeFileSync(`${OUT}/${name}`, Buffer.from(s.result.data, "base64"));
          const cam = await ev(
            `(()=>{const c=${SC}.cameras.main;return {bufW:c.width,zoom:+c.zoom.toFixed(2),viewWorldW:Math.round(c.width/c.zoom),scrollX:Math.round(c.scrollX)};})()`,
          );
          console.log(name, JSON.stringify(cam));
        };
        await grab(3840, 2160, "tmp-4k.png");
        await grab(3440, 1440, "tmp-ultrawide.png");
        await cmd("Emulation.clearDeviceMetricsOverride", {});
        await ev(`window.dispatchEvent(new Event('resize'))`);
        ws.close();
      });
    });
  })
  .on("error", (e) => console.log("CDP connect error:", e.message));
