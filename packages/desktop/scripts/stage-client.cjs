const fs = require("node:fs");
const path = require("node:path");

const desktopRoot = path.resolve(__dirname, "..");
const clientDist = path.resolve(desktopRoot, "../client/dist");
const stagedClient = path.join(desktopRoot, "client-dist");
const clientIndex = path.join(clientDist, "index.html");

if (!fs.existsSync(clientIndex)) {
  throw new Error(
    `Missing ${clientIndex}. Build the client first, or run "pnpm --filter @dd/desktop package".`,
  );
}

fs.rmSync(stagedClient, { recursive: true, force: true });
fs.cpSync(clientDist, stagedClient, { recursive: true });
console.log(`[desktop] staged client at ${stagedClient}`);
