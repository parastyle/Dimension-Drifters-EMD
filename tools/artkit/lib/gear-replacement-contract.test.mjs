import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPOSITION_ORDERS,
  MIGRATION_EXPECTED,
  PART_FRAMES,
  VALIDATION_THRESHOLDS,
  assertMigrationPlan,
  buildMigrationPlan,
  dilateMask,
  erodeMask,
  renderRoleForItem,
  scrubSmallAlphaComponents,
  validateFullReplacement,
  validatePairedReplacements,
  validateTorsoReplacement,
} from "./gear-replacement-contract.mjs";

function alphaForMask(mask) {
  const alpha = new Uint8Array(mask.length);
  for (let index = 0; index < mask.length; index++) if (mask[index]) alpha[index] = 255;
  return alpha;
}

test("replace-torso is one full object inside the base silhouette tolerance", () => {
  const width = 80;
  const height = 60;
  const base = new Uint8Array(width * height);
  for (let y = 10; y <= 49; y++) for (let x = 20; x <= 59; x++) base[y * width + x] = 1;
  const core = erodeMask(base, width, height, 2);
  const allowed = dilateMask(base, width, height, 3);
  const fixture = {
    alpha: alphaForMask(base),
    width,
    height,
    frame: [14, 4, 52, 52],
    coreMask: core,
    allowedMask: allowed,
    pivot: { x: 40, y: 30 },
    partBox: { width: 44, height: 44 },
    generatedOutlineRadius: 8,
  };
  const passing = validateTorsoReplacement(fixture);
  assert.equal(passing.coreCoverage, 1);
  assert.equal(passing.primaryIslandCount, 1);
  assert.equal(passing.escapedPixels, 0);
  assert.equal(passing.silhouetteTolerancePx, VALIDATION_THRESHOLDS.torsoSilhouetteTolerancePx);
  assert.deepEqual(COMPOSITION_ORDERS.body, ["torso"]);

  const incomplete = new Uint8Array(fixture.alpha);
  for (let y = 10; y <= 15; y++) for (let x = 20; x <= 59; x++) incomplete[y * width + x] = 0;
  assert.throws(
    () => validateTorsoReplacement({ ...fixture, alpha: incomplete }),
    /88\.889% is below 90%/,
  );

  const escaped = new Uint8Array(fixture.alpha);
  for (let x = 60; x <= 64; x++) escaped[30 * width + x] = 255;
  assert.throws(
    () => validateTorsoReplacement({ ...fixture, alpha: escaped }),
    /Torso silhouette: \d+px escape the base torso tolerance envelope/,
  );

  const extraIsland = new Uint8Array(fixture.alpha);
  extraIsland[6 * width + 16] = 255;
  assert.throws(
    () => validateTorsoReplacement({ ...fixture, alpha: extraIsland }),
    /expected one connected primary island, found 2/,
  );

  assert.throws(
    () => validateTorsoReplacement({ ...fixture, generatedOutlineRadius: 0 }),
    /replace-torso requires generated radius 8/,
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

test("post-resize speck scrub removes only sub-64px ringing before strict paired validation", () => {
  const width = 40;
  const height = 20;
  const alpha = new Uint8Array(width * height);
  const leftCore = new Uint8Array(alpha.length);
  const rightCore = new Uint8Array(alpha.length);
  for (let y = 4; y < 14; y++) {
    for (let x = 2; x < 10; x++) {
      alpha[y * width + x] = 255;
      leftCore[y * width + x] = 1;
    }
    for (let x = 30; x < 38; x++) {
      alpha[y * width + x] = 255;
      rightCore[y * width + x] = 1;
    }
  }
  for (const [x, y, value] of [[0, 0, 1], [19, 0, 9], [39, 19, 9]]) alpha[y * width + x] = value;
  const parts = [
    { id: "left", frame: [0, 0, 20, 20], coreMask: leftCore, pivot: { x: 5, y: 8 } },
    { id: "right", frame: [20, 0, 20, 20], coreMask: rightCore, pivot: { x: 34, y: 8 } },
  ];

  assert.throws(
    () => validatePairedReplacements({ alpha, width, height, parts, splitX: 20 }),
    /expected exactly two separated components, found 4/,
  );
  const report = scrubSmallAlphaComponents(alpha, width, height, 64, 0);
  assert.equal(report.removedComponentCount, 3);
  assert.equal(report.removedPixels, 3);
  assert.equal(validatePairedReplacements({ alpha, width, height, parts, splitX: 20 }).componentCount, 2);

  const honestThirdPart = new Uint8Array(alpha);
  for (let y = 0; y < 8; y++) for (let x = 16; x < 24; x++) honestThirdPart[y * width + x] = 255;
  assert.equal(scrubSmallAlphaComponents(honestThirdPart, width, height).removedComponentCount, 0);
  assert.throws(
    () => validatePairedReplacements({ alpha: honestThirdPart, width, height, parts, splitX: 20 }),
    /expected exactly two separated components, found 3/,
  );
});

test("migration plan is twelve catalog pairs plus five queued full-head cowls", () => {
  const pairItems = [];
  for (let index = 1; index <= 12; index++) {
    pairItems.push({ id: `set-${index}-shirt`, slot: "torso", slotDirectory: "torso" });
    pairItems.push({ id: `set-${index}-head`, slot: "head", slotDirectory: "heads" });
    pairItems.push({ id: `set-${index}-hat`, slot: "hat", slotDirectory: "hats" });
  }
  for (let index = 1; index <= 5; index++) {
    const hatIndex = pairItems.findIndex((item) => item.id === `set-${index}-hat`);
    pairItems[hatIndex] = {
      id: `set-${index}-cowl`,
      slot: "head",
      slotDirectory: "heads",
    };
  }
  const plan = assertMigrationPlan(buildMigrationPlan(pairItems));
  assert.equal(plan.counts.rerenderItems, 29);
  assert.equal(plan.counts.renderCalls, 29);
  assert.equal(plan.counts.rerenderComponentParts, 29);
  assert.deepEqual(plan.counts.byBatch, MIGRATION_EXPECTED.byBatch);
  assert.equal(plan.preserved.filter((job) => job.renderRole === "overlay-hat").length, 7);
  assert.equal(renderRoleForItem(pairItems.find((item) => item.id === "set-1-shirt")), "replace-torso");
  assert.equal(renderRoleForItem(pairItems.find((item) => item.id === "set-1-head")), "replace-head");
  assert.equal(renderRoleForItem(pairItems.find((item) => item.id === "set-1-cowl")), "replace-head");
  assert.equal(renderRoleForItem(pairItems.find((item) => item.id === "set-6-hat")), "overlay-hat");
  assert.throws(() => renderRoleForItem({ id: "retired-pants", slot: "pants" }), /retired pants catalog row/);
  assert.deepEqual(Object.fromEntries(Object.entries(PART_FRAMES).map(([id, frame]) => [id, frame.crop])), {
    // Widened 2026-07-18 per the silhouette-character law (owner ruling, then "widen the
    // margins"): near-inset frames for collars/props/plumes; pivots unchanged.
    body: [268, 180, 488, 544],
    head: [290, 40, 508, 552],
    "hand-l": [294, 432, 180, 180],
    "hand-r": [550, 432, 180, 180],
    "foot-l": [353, 641, 190, 190],
    "foot-r": [481, 641, 190, 190],
  });
  assert.deepEqual(COMPOSITION_ORDERS.head, ["head", "facialHair", "glasses"]);
});
