const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { makeClientURL, resolveClientRequest } = require("../client-paths.cjs");

const desktopRoot = path.resolve(__dirname, "..");
const packageRoot = path.join(desktopRoot, "release", "win-unpacked");
const executable = path.join(packageRoot, "DimensionDrifters.exe");
const clientRoot = path.join(packageRoot, "resources", "client");
const clientIndex = path.join(clientRoot, "index.html");

assert.ok(fs.statSync(executable).isFile(), `Missing packaged executable: ${executable}`);
assert.ok(fs.statSync(clientIndex).isFile(), `Missing packaged client: ${clientIndex}`);

const indexHtml = fs.readFileSync(clientIndex, "utf8");
const references = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
const clientURL = makeClientURL("localhost");
for (const reference of references) {
  if (/^(?:[a-z]+:|#)/i.test(reference)) continue;
  const requestURL = new URL(reference, clientURL).toString();
  const filePath = resolveClientRequest(clientRoot, requestURL, "localhost");
  assert.ok(filePath && fs.statSync(filePath).isFile(), `Unresolved client asset: ${reference}`);
}

// Phaser requests public assets relative to the document (for example sprites/... and belt/...).
// Resolve a real staged sprite through the exact packaged protocol path mapper.
function firstFile(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = firstFile(entryPath);
      if (nested) return nested;
    } else {
      return entryPath;
    }
  }
  return null;
}

const spriteFile = firstFile(path.join(clientRoot, "sprites"));
assert.ok(spriteFile, "Packaged client contains no Phaser sprite asset");
const spriteReference = path.relative(clientRoot, spriteFile).split(path.sep).join("/");
const spritePath = resolveClientRequest(
  clientRoot,
  new URL(spriteReference, clientURL).toString(),
  "localhost",
);
assert.equal(spritePath, spriteFile, `Relative Phaser asset did not resolve: ${spriteReference}`);

console.log(`[desktop] package smoke passed: ${executable}`);
