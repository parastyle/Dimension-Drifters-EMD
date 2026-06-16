// Electron main process — hosts the Phaser client in a dedicated window (§3).
//
// Why this exists: a background *browser tab* throttles requestAnimationFrame, which
// froze the game loop during dev (see README "Dev gotcha"). A dedicated Electron window
// with `backgroundThrottling: false` keeps the loop running regardless of focus — this is
// also the production runtime, so dev now matches what ships (environment parity, §26).

const { app, BrowserWindow } = require("electron");

const CLIENT_URL = process.env.DD_CLIENT_URL || "http://localhost:5180";

// Chromium parks a renderer's rAF/timers when its window is occluded, backgrounded, or opened
// without focus (e.g. launched from a background process) — which freezes the Phaser game loop
// even with the BrowserWindow `backgroundThrottling:false` pref. That pref alone is NOT enough;
// these command-line switches are the load-bearing fix. We want the loop to keep simulating and
// drawing regardless of window state (the server is authoritative; an alt-tabbed client should
// keep running). Verified: without these, a background-launched window renders create() once
// then the loop parks (arena shows, no entities, debug stuck at "loop: —").
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");

// Opt-in CDP endpoint for the tools/cdp-*.cjs verification harness (drives the live game via
// window.ddGame). OFF unless DD_DEBUG_PORT is set, so the shipped runtime never exposes a debug port.
if (process.env.DD_DEBUG_PORT) {
  app.commandLine.appendSwitch("remote-debugging-port", process.env.DD_DEBUG_PORT);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#1a1320",
    autoHideMenuBar: true,
    webPreferences: {
      // The fix for the rAF-throttling class of bug: never pause the renderer.
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Force the window foreground on first paint — a background-launched process can otherwise
  // open it unfocused/minimized, which parks the renderer.
  win.once("ready-to-show", () => {
    win.show();
    win.focus();
  });

  const load = () => win.loadURL(CLIENT_URL);
  // The Vite dev server may not be up yet when Electron launches — retry until it is.
  win.webContents.on("did-fail-load", () => {
    setTimeout(load, 1000);
  });
  load();
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
