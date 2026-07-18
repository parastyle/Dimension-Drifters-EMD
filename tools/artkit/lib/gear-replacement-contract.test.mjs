import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readGearCatalog } from "./gear-catalog.mjs";
import {
  COMPOSITION_ORDERS,
  MIGRATION_EXPECTED,
  PART_FRAMES,
  assertMigrationPlan,
  buildCanonicalBodyMasks,
  buildMigrationPlan,
  renderRoleForItem,
  validateFullReplacement,
  validateTorsoPatch,
} from "./gear-replacement-contract.mjs";

const WIDTH = 1024;
const HEIGHT = 1024;

function rectangularBodyAlpha() {
  const alpha = new Uint8Array(WIDTH * HEIGHT);
  for (let y = 350; y <= 680; y++) {
    for (let x = 400; x <= 600; x++) alpha[y * WIDTH + x] = 255;
  }
  return alpha;
}

function alphaForMask(mask) {
  const alpha = new Uint8Array(mask.length);
  for (let index = 0; index < mask.length; index++) if (mask[index]) alpha[index] = 255;
  return alpha;
}

test("synthetic torso masks enforce containment, coverage, overlap order, holes, and silhouette equality", () => {
  const preOutline = rectangularBodyAlpha();
  const masks = buildCanonicalBodyMasks(preOutline, WIDTH, HEIGHT);
  const baseSilhouette = new Uint8Array(masks.bodyFill);
  const shirt = alphaForMask(masks.shirtRequired);
  const pants = alphaForMask(masks.pantsRequired);

  const shirtReport = validateTorsoPatch({ alpha: shirt, width: WIDTH, height: HEIGHT, slot: "shirt", masks, baseSilhouette });
  const pantsReport = validateTorsoPatch({ alpha: pants, width: WIDTH, height: HEIGHT, slot: "pants", masks, baseSilhouette });
  assert.equal(shirtReport.requiredCoverage, 1);
  assert.equal(pantsReport.requiredCoverage, 1);
  assert.equal(shirtReport.silhouetteXorPixels, 0);
  assert.equal(pantsReport.silhouetteXorPixels, 0);
  assert.deepEqual(COMPOSITION_ORDERS.body, ["body", "pants", "shirt"]);

  const overlapIndex = 556 * WIDTH + 500;
  assert.equal(masks.shirtRequired[overlapIndex], 1);
  assert.equal(masks.pantsRequired[overlapIndex], 1);
  const composedMarker = ["body", "pants", "shirt"].reduce((winner, layer) => layer === "body" || (layer === "pants" && pants[overlapIndex]) || (layer === "shirt" && shirt[overlapIndex]) ? layer : winner, "none");
  assert.equal(composedMarker, "shirt");

  const escaped = new Uint8Array(shirt);
  escaped[670 * WIDTH + 500] = 255;
  assert.throws(
    () => validateTorsoPatch({ alpha: escaped, width: WIDTH, height: HEIGHT, slot: "shirt", masks, baseSilhouette }),
    /Torso containment: alpha pixel .* outside shirtAllowed/,
  );

  const undercovered = new Uint8Array(shirt);
  undercovered.fill(0);
  undercovered[450 * WIDTH + 500] = 255;
  assert.throws(
    () => validateTorsoPatch({ alpha: undercovered, width: WIDTH, height: HEIGHT, slot: "shirt", masks, baseSilhouette }),
    /required coverage/,
  );

  const holed = new Uint8Array(shirt);
  for (let x = 480; x < 485; x++) holed[450 * WIDTH + x] = 0;
  assert.throws(
    () => validateTorsoPatch({ alpha: holed, width: WIDTH, height: HEIGHT, slot: "shirt", masks, baseSilhouette }),
    /5px transparent hole/,
  );

  assert.throws(
    () => validateTorsoPatch({ alpha: shirt, width: WIDTH, height: HEIGHT, slot: "shirt", masks, baseSilhouette, generatedOutlineRadius: 8 }),
    /torso patches must have zero generated rim/,
  );
});

function replacementFixture() {
  const width = 50;
  const height = 30;
  const coreMask = new Uint8Array(width * height);
  for (let y = 0; y < 25; y++) for (let x = 0; x < 40; x++) coreMask[y * width + x] = 1;
  const alpha = alphaForMask(coreMask);
  return { width, height, coreMask, alpha, frame: [0, 0, 50, 30], pivot: { x: 10, y: 10 } };
}

test("full replacements reject 97.9% coverage, frame escape, extra island, and wrong pivot", () => {
  const fixture = replacementFixture();
  const passing = validateFullReplacement(fixture);
  assert.equal(passing.coreCoverage, 1);
  assert.equal(passing.primaryIslandCount, 1);

  const short = new Uint8Array(fixture.alpha.length);
  let retained = 0;
  for (let index = 0; index < fixture.coreMask.length && retained < 979; index++) {
    if (!fixture.coreMask[index]) continue;
    short[index] = 255;
    retained++;
  }
  assert.throws(() => validateFullReplacement({ ...fixture, alpha: short }), /97\.900% is below 98%/);

  const escaped = new Uint8Array(fixture.alpha);
  escaped[20 * fixture.width + 49] = 255;
  assert.throws(
    () => validateFullReplacement({ ...fixture, alpha: escaped, frame: [0, 0, 49, 30] }),
    /alpha escapes allowed frame/,
  );

  const extraIsland = new Uint8Array(fixture.alpha);
  extraIsland[29 * fixture.width + 49] = 255;
  assert.throws(() => validateFullReplacement({ ...fixture, alpha: extraIsland }), /expected one connected primary island, found 2/);

  assert.throws(
    () => validateFullReplacement({ ...fixture, pivot: { x: 48, y: 10 } }),
    /pivot \(48,10\) lacks opaque stock/,
  );
});

test("catalog-derived migration plan pins exact roles, calls, and component totals", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const repo = resolve(here, "../../..");
  const directoryBySlot = new Map([
    ["boots", "boots"], ["gloves", "gloves"], ["shirt", "shirt"], ["pants", "pants"],
    ["cloak", "cloak"], ["glasses", "glasses"], ["facialHair", "facial-hair"], ["hat", "hats"],
  ]);
  const items = readGearCatalog(resolve(repo, "packages/shared/src/gear.ts"))
    .filter((item) => !item.id.startsWith("blank-drifter-"))
    .map((item) => ({ ...item, slotDirectory: directoryBySlot.get(item.slot) }));
  const plan = assertMigrationPlan(buildMigrationPlan(items));

  assert.equal(plan.counts.rerenderItems, 83);
  assert.equal(plan.counts.renderCalls, 85);
  assert.equal(plan.counts.rerenderComponentParts, 112);
  assert.equal(plan.counts.finalNonblankItems, 105);
  assert.equal(plan.counts.finalRoleTextures, 107);
  assert.equal(plan.counts.finalManifestParts, 134);
  assert.deepEqual(plan.counts.byBatch, MIGRATION_EXPECTED.byBatch);
  assert.equal(plan.roles.filter((row) => row.renderRole === "overlay-hat").length, 10);
  assert.equal(plan.roles.filter((row) => row.renderRole === "replace-head").length, 2);
  assert.equal(plan.preserved.filter((job) => job.renderRole === "cloak-far").length, 12);
  assert.equal(plan.preserved.every((job) => job.creativeRender === false), true);
  assert.equal(renderRoleForItem(items.find((item) => item.id === "demon-mask-hat")), "replace-head");
  assert.deepEqual(Object.fromEntries(Object.entries(PART_FRAMES).map(([id, frame]) => [id, frame.crop])), {
    body: [344, 324, 336, 376],
    head: [352, 112, 384, 456],
    "hand-l": [294, 432, 180, 180],
    "hand-r": [550, 432, 180, 180],
    "foot-l": [353, 641, 190, 190],
    "foot-r": [481, 641, 190, 190],
  });
  assert.deepEqual(COMPOSITION_ORDERS.head, ["head", "facialHair", "glasses"]);
});
