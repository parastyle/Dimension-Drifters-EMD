import { createHash } from "node:crypto";

export const REPLACEMENT_CONTRACT_ID = "GEAR_REPLACEMENT_V1";

export const REPLACEMENT_HEAD_IDS = Object.freeze([
  "demon-mask-hat",
  "unbending-hat",
]);

const replacementHeadIdSet = new Set(REPLACEMENT_HEAD_IDS);

export const COMPOSITION_ORDERS = Object.freeze({
  body: Object.freeze(["body", "pants", "shirt"]),
  head: Object.freeze(["head", "facialHair", "glasses"]),
});

function partFrame(crop, pivotSource, originNumerator) {
  const [, , width, height] = crop;
  return Object.freeze({
    crop: Object.freeze(crop),
    pivotSource: Object.freeze(pivotSource),
    outputOrigin: Object.freeze({
      x: originNumerator[0] / width,
      y: originNumerator[1] / height,
      numerator: Object.freeze(originNumerator),
      denominator: Object.freeze([width, height]),
    }),
  });
}

export const PART_FRAMES = Object.freeze({
  body: partFrame([344, 324, 336, 376], { x: 512, y: 512 }, [168, 188]),
  head: partFrame([352, 112, 384, 456], { x: 512, y: 300 }, [160, 188]),
  "hand-l": partFrame([294, 432, 180, 180], { x: 384, y: 522 }, [90, 90]),
  "hand-r": partFrame([550, 432, 180, 180], { x: 640, y: 522 }, [90, 90]),
  "foot-l": partFrame([353, 641, 190, 190], { x: 448, y: 736 }, [95, 95]),
  "foot-r": partFrame([481, 641, 190, 190], { x: 576, y: 736 }, [95, 95]),
});

export const FACE_ENVELOPES = Object.freeze({
  eyes: Object.freeze({ left: 472, top: 304, width: 248, height: 128 }),
  mouthJaw: Object.freeze({ left: 472, top: 350, width: 248, height: 198 }),
});

export const VALIDATION_THRESHOLDS = Object.freeze({
  visibleAlpha: 8,
  stockAlpha: 64,
  requiredOpaqueAlpha: 240,
  requiredCoverage: 0.995,
  replacementCoreCoverage: 0.98,
  baseCoreErosionPx: 4,
  maximumRequiredHolePixels: 4,
  emergencyCanvasInsetPx: 24,
  faceSocketRadiusPx: 4,
});

export const MIGRATION_EXPECTED = Object.freeze({
  rerenderItems: 83,
  renderCalls: 85,
  rerenderComponentParts: 112,
  preservedOverlayHats: 10,
  preservedCloaks: 12,
  finalNonblankItems: 105,
  finalRoleTextures: 107,
  finalManifestParts: 134,
  byBatch: Object.freeze({
    shirt: Object.freeze({ items: 15, calls: 15, componentParts: 15 }),
    pants: Object.freeze({ items: 12, calls: 12, componentParts: 12 }),
    gloves: Object.freeze({ items: 15, calls: 15, componentParts: 30 }),
    boots: Object.freeze({ items: 12, calls: 12, componentParts: 24 }),
    glasses: Object.freeze({ items: 15, calls: 15, componentParts: 15 }),
    facialHair: Object.freeze({ items: 12, calls: 12, componentParts: 12 }),
    replacementHead: Object.freeze({ items: 2, calls: 2, componentParts: 2 }),
    prestigeCap: Object.freeze({ items: 2, calls: 2, componentParts: 2 }),
  }),
});

export function renderRoleForItem(item) {
  switch (item.slot) {
    case "shirt": return "body-patch";
    case "pants": return "body-patch";
    case "gloves": return "replace-hand";
    case "boots": return "replace-foot";
    case "glasses": return "head-accessory";
    case "facialHair": return "head-accessory";
    case "cloak": return "cloak-far";
    case "hat": return replacementHeadIdSet.has(item.id) ? "replace-head" : "overlay-hat";
    default: throw new Error(`Replacement role: unsupported catalog slot ${item.slot} for ${item.id}`);
  }
}

export function renderVariantsForItem(item) {
  const role = renderRoleForItem(item);
  if (role === "replace-head") {
    return [
      Object.freeze({ directory: "heads", renderRole: "replace-head", componentParts: 1, creativeRender: true }),
      Object.freeze({ directory: "hats", renderRole: "prestige-cap", componentParts: 1, creativeRender: true }),
    ];
  }
  const componentParts = item.slot === "gloves" || item.slot === "boots" ? 2 : 1;
  return [Object.freeze({
    directory: item.slotDirectory,
    renderRole: role,
    componentParts,
    creativeRender: role !== "overlay-hat" && role !== "cloak-far",
  })];
}

function countBy(items, predicate) {
  return items.reduce((count, item) => count + (predicate(item) ? 1 : 0), 0);
}

export function buildMigrationPlan(items) {
  const roles = items.map((item) => ({ item, renderRole: renderRoleForItem(item), variants: renderVariantsForItem(item) }));
  const creative = roles.flatMap(({ item, variants }) => variants.filter((variant) => variant.creativeRender).map((variant) => ({ item, ...variant })));
  const preserved = roles.flatMap(({ item, variants }) => variants.filter((variant) => !variant.creativeRender).map((variant) => ({ item, ...variant })));
  const rerenderIds = new Set(creative.map((job) => job.item.id));
  const counts = {
    rerenderItems: rerenderIds.size,
    renderCalls: creative.length,
    rerenderComponentParts: creative.reduce((sum, job) => sum + job.componentParts, 0),
    preservedOverlayHats: countBy(preserved, (job) => job.renderRole === "overlay-hat"),
    preservedCloaks: countBy(preserved, (job) => job.renderRole === "cloak-far"),
    finalNonblankItems: items.length,
    finalRoleTextures: roles.reduce((sum, row) => sum + row.variants.length, 0),
    finalManifestParts: roles.reduce((sum, row) => sum + row.variants.reduce((partSum, variant) => partSum + variant.componentParts, 0), 0),
    byBatch: {
      shirt: batchCounts(creative, "body-patch", "shirt"),
      pants: batchCounts(creative, "body-patch", "pants"),
      gloves: batchCounts(creative, "replace-hand"),
      boots: batchCounts(creative, "replace-foot"),
      glasses: batchCounts(creative, "head-accessory", "glasses"),
      facialHair: batchCounts(creative, "head-accessory", "facialHair"),
      replacementHead: batchCounts(creative, "replace-head"),
      prestigeCap: batchCounts(creative, "prestige-cap"),
    },
  };
  return { roles, creative, preserved, counts };
}

function batchCounts(jobs, renderRole, slot = null) {
  const selected = jobs.filter((job) => job.renderRole === renderRole && (slot == null || job.item.slot === slot));
  return {
    items: new Set(selected.map((job) => job.item.id)).size,
    calls: selected.length,
    componentParts: selected.reduce((sum, job) => sum + job.componentParts, 0),
  };
}

export function assertMigrationPlan(plan) {
  const mismatches = [];
  for (const key of [
    "rerenderItems",
    "renderCalls",
    "rerenderComponentParts",
    "preservedOverlayHats",
    "preservedCloaks",
    "finalNonblankItems",
    "finalRoleTextures",
    "finalManifestParts",
  ]) {
    if (plan.counts[key] !== MIGRATION_EXPECTED[key]) mismatches.push(`${key}=${plan.counts[key]} expected ${MIGRATION_EXPECTED[key]}`);
  }
  for (const [batch, expected] of Object.entries(MIGRATION_EXPECTED.byBatch)) {
    const actual = plan.counts.byBatch[batch];
    for (const key of ["items", "calls", "componentParts"]) {
      if (actual?.[key] !== expected[key]) mismatches.push(`${batch}.${key}=${actual?.[key]} expected ${expected[key]}`);
    }
  }
  const overlayIds = plan.roles.filter((row) => row.renderRole === "overlay-hat").map((row) => row.item.id);
  const replacementIds = plan.roles.filter((row) => row.renderRole === "replace-head").map((row) => row.item.id).sort();
  if (overlayIds.length !== 10 || replacementIds.join("\0") !== [...REPLACEMENT_HEAD_IDS].sort().join("\0")) {
    mismatches.push(`hat roles overlay=${overlayIds.length} replacement=${replacementIds.join(",")}`);
  }
  if (mismatches.length > 0) throw new Error(`Gear replacement migration drift: ${mismatches.join("; ")}`);
  return plan;
}

export function rgbaAlpha(rgba) {
  const alpha = new Uint8Array(rgba.length / 4);
  for (let source = 3, target = 0; source < rgba.length; source += 4, target++) alpha[target] = rgba[source];
  return alpha;
}

export function maskFromAlpha(alpha, threshold = VALIDATION_THRESHOLDS.stockAlpha) {
  const mask = new Uint8Array(alpha.length);
  for (let index = 0; index < alpha.length; index++) mask[index] = alpha[index] >= threshold ? 1 : 0;
  return mask;
}

export function hashBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function hashJson(value) {
  return hashBytes(Buffer.from(JSON.stringify(value)));
}

export function describeMask(mask) {
  let pixelCount = 0;
  for (const value of mask) pixelCount += value ? 1 : 0;
  return { sha256: hashBytes(mask), pixelCount };
}

export function buildCanonicalBodyMasks(preOutlineAlpha, width = 1024, height = 1024) {
  assertDimensions(preOutlineAlpha, width, height, "canonical body alpha");
  const bodyFill = maskFromAlpha(preOutlineAlpha, VALIDATION_THRESHOLDS.stockAlpha);
  const shirtRequired = new Uint8Array(bodyFill.length);
  const shirtAllowed = new Uint8Array(bodyFill.length);
  const pantsRequired = new Uint8Array(bodyFill.length);
  const pantsAllowed = new Uint8Array(bodyFill.length);
  const [left, top, frameWidth, frameHeight] = PART_FRAMES.body.crop;
  for (let y = top; y < top + frameHeight; y++) {
    const v = (y - 324) / 375;
    for (let x = left; x < left + frameWidth; x++) {
      const index = y * width + x;
      if (!bodyFill[index]) continue;
      if (v <= 0.62) shirtRequired[index] = 1;
      if (v <= 0.72) shirtAllowed[index] = 1;
      if (v >= 0.60) pantsRequired[index] = 1;
      if (v >= 0.52) pantsAllowed[index] = 1;
    }
  }
  return { bodyFill, shirtRequired, shirtAllowed, pantsRequired, pantsAllowed };
}

export function erodeMask(mask, width, height, radius = VALIDATION_THRESHOLDS.baseCoreErosionPx) {
  assertDimensions(mask, width, height, "mask erosion input");
  const output = new Uint8Array(mask.length);
  const offsets = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) if (dx * dx + dy * dy <= radius * radius) offsets.push([dx, dy]);
  }
  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      const index = y * width + x;
      if (!mask[index]) continue;
      let keep = true;
      for (const [dx, dy] of offsets) {
        if (!mask[(y + dy) * width + x + dx]) { keep = false; break; }
      }
      output[index] = keep ? 1 : 0;
    }
  }
  return output;
}

function assertDimensions(values, width, height, label) {
  if (values.length !== width * height) throw new Error(`${label}: expected ${width * height} pixels, found ${values.length}`);
}

function gate(condition, section, message) {
  if (!condition) throw new Error(`${section}: ${message}`);
}

function rectBounds(rect) {
  const [left, top, width, height] = Array.isArray(rect) ? rect : [rect.left, rect.top, rect.width, rect.height];
  return { left, top, width, height, right: left + width - 1, bottom: top + height - 1 };
}

function contains(rect, x, y) {
  const bounds = rectBounds(rect);
  return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
}

export function validateAlphaInsideFrame(alpha, width, height, frame, section = "File/frame") {
  assertDimensions(alpha, width, height, `${section} alpha`);
  let visiblePixels = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = alpha[y * width + x];
      if (value <= VALIDATION_THRESHOLDS.visibleAlpha) continue;
      visiblePixels++;
      gate(contains(frame, x, y), section, `alpha escapes allowed frame at (${x},${y})`);
    }
  }
  gate(visiblePixels > 0, section, "no visible pixels");
  return { visiblePixels };
}

function transparentHoleSizes(alpha, requiredMask, width, height) {
  const seen = new Uint8Array(alpha.length);
  const sizes = [];
  for (let start = 0; start < alpha.length; start++) {
    if (seen[start] || !requiredMask[start] || alpha[start] > VALIDATION_THRESHOLDS.visibleAlpha) continue;
    let size = 0;
    const queue = [start];
    seen[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const index = queue[cursor];
      size++;
      const x = index % width;
      const y = Math.floor(index / width);
      for (const next of [index - 1, index + 1, index - width, index + width]) {
        if (next < 0 || next >= alpha.length || seen[next] || !requiredMask[next]) continue;
        const nextX = next % width;
        const nextY = Math.floor(next / width);
        if (Math.abs(nextX - x) + Math.abs(nextY - y) !== 1) continue;
        if (alpha[next] <= VALIDATION_THRESHOLDS.visibleAlpha) { seen[next] = 1; queue.push(next); }
      }
    }
    sizes.push(size);
  }
  return sizes;
}

export function validateTorsoPatch({
  alpha,
  width,
  height,
  slot,
  masks,
  baseSilhouette,
  generatedOutlineRadius = 0,
}) {
  assertDimensions(alpha, width, height, `${slot} alpha`);
  gate(slot === "shirt" || slot === "pants", "Role", `torso patch slot must be shirt or pants, got ${slot}`);
  gate(generatedOutlineRadius === 0, "Outline", `torso patches must have zero generated rim, got radius ${generatedOutlineRadius}`);
  const allowed = slot === "shirt" ? masks.shirtAllowed : masks.pantsAllowed;
  const required = slot === "shirt" ? masks.shirtRequired : masks.pantsRequired;
  let visiblePixels = 0;
  let requiredPixels = 0;
  let requiredOpaquePixels = 0;
  for (let index = 0; index < alpha.length; index++) {
    if (alpha[index] > VALIDATION_THRESHOLDS.visibleAlpha) {
      visiblePixels++;
      gate(allowed[index] === 1, "Torso containment", `alpha pixel ${index} lies outside ${slot}Allowed`);
    }
    if (required[index]) {
      requiredPixels++;
      if (alpha[index] >= VALIDATION_THRESHOLDS.requiredOpaqueAlpha) requiredOpaquePixels++;
    }
  }
  gate(visiblePixels > 0, "File/frame", `${slot} patch has no visible pixels`);
  const requiredCoverage = requiredPixels === 0 ? 0 : requiredOpaquePixels / requiredPixels;
  gate(requiredCoverage >= VALIDATION_THRESHOLDS.requiredCoverage, "Torso containment", `${slot} required coverage ${(requiredCoverage * 100).toFixed(3)}% is below 99.5%`);
  const holes = transparentHoleSizes(alpha, required, width, height);
  const largestTransparentHole = holes.length > 0 ? Math.max(...holes) : 0;
  gate(largestTransparentHole <= VALIDATION_THRESHOLDS.maximumRequiredHolePixels, "Torso containment", `${slot} required mask has a ${largestTransparentHole}px transparent hole`);
  let silhouetteXorPixels = 0;
  for (let index = 0; index < alpha.length; index++) {
    const before = baseSilhouette[index] ? 1 : 0;
    const after = before || alpha[index] > VALIDATION_THRESHOLDS.visibleAlpha ? 1 : 0;
    if (before !== after) silhouetteXorPixels++;
  }
  gate(silhouetteXorPixels === 0, "Torso containment", `composite alpha-support XOR changed ${silhouetteXorPixels} pixels`);
  return { visiblePixels, requiredPixels, requiredOpaquePixels, requiredCoverage, largestTransparentHole, silhouetteXorPixels };
}

export function connectedAlphaComponents(alpha, width, height, threshold = VALIDATION_THRESHOLDS.visibleAlpha) {
  assertDimensions(alpha, width, height, "connected component alpha");
  const labels = new Int32Array(alpha.length);
  const components = [];
  for (let start = 0; start < alpha.length; start++) {
    if (labels[start] || alpha[start] <= threshold) continue;
    const label = components.length + 1;
    const queue = [start];
    labels[start] = label;
    let pixels = 0;
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;
    let sumX = 0;
    let sumY = 0;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const index = queue[cursor];
      const x = index % width;
      const y = Math.floor(index / width);
      pixels++;
      sumX += x;
      sumY += y;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
      for (const next of [index - 1, index + 1, index - width, index + width]) {
        if (next < 0 || next >= alpha.length || labels[next] || alpha[next] <= threshold) continue;
        const nextX = next % width;
        const nextY = Math.floor(next / width);
        if (Math.abs(nextX - x) + Math.abs(nextY - y) !== 1) continue;
        labels[next] = label;
        queue.push(next);
      }
    }
    components.push({ label, pixels, left, top, right, bottom, width: right - left + 1, height: bottom - top + 1, centroid: { x: sumX / pixels, y: sumY / pixels } });
  }
  return { labels, components };
}

export function scrubSmallAlphaComponents(
  alpha,
  width,
  height,
  minimumPixels = 64,
  threshold = VALIDATION_THRESHOLDS.visibleAlpha,
) {
  assertDimensions(alpha, width, height, "alpha speck scrub input");
  const { labels, components } = connectedAlphaComponents(alpha, width, height, threshold);
  const removedComponents = components.filter((component) => component.pixels < minimumPixels);
  const removedLabels = new Set(removedComponents.map((component) => component.label));
  let removedPixels = 0;
  if (removedLabels.size > 0) {
    for (let index = 0; index < alpha.length; index++) {
      if (!removedLabels.has(labels[index])) continue;
      alpha[index] = 0;
      removedPixels++;
    }
  }
  return {
    removedComponentCount: removedComponents.length,
    removedPixels,
    removedComponents,
  };
}

function maskPixelCount(mask) {
  let count = 0;
  for (const value of mask) count += value ? 1 : 0;
  return count;
}

export function validateFullReplacement({ alpha, width, height, frame, coreMask, pivot, section = "Full replacement coverage" }) {
  validateAlphaInsideFrame(alpha, width, height, frame, section);
  const corePixels = maskPixelCount(coreMask);
  gate(corePixels > 0, section, "base core mask is empty");
  let coveredCorePixels = 0;
  let uncoveredLeft = width;
  let uncoveredTop = height;
  let uncoveredRight = -1;
  let uncoveredBottom = -1;
  for (let index = 0; index < coreMask.length; index++) {
    if (!coreMask[index]) continue;
    if (alpha[index] >= VALIDATION_THRESHOLDS.stockAlpha) {
      coveredCorePixels++;
      continue;
    }
    const x = index % width;
    const y = Math.floor(index / width);
    uncoveredLeft = Math.min(uncoveredLeft, x);
    uncoveredTop = Math.min(uncoveredTop, y);
    uncoveredRight = Math.max(uncoveredRight, x);
    uncoveredBottom = Math.max(uncoveredBottom, y);
  }
  const coreCoverage = coveredCorePixels / corePixels;
  const uncoveredCorePixels = corePixels - coveredCorePixels;
  const uncoveredCoreBounds = uncoveredRight < uncoveredLeft ? null : {
    left: uncoveredLeft,
    top: uncoveredTop,
    right: uncoveredRight,
    bottom: uncoveredBottom,
    width: uncoveredRight - uncoveredLeft + 1,
    height: uncoveredBottom - uncoveredTop + 1,
  };
  gate(
    coreCoverage >= VALIDATION_THRESHOLDS.replacementCoreCoverage,
    section,
    `base-core coverage ${(coreCoverage * 100).toFixed(3)}% is below 98%; uncovered=${uncoveredCorePixels}px bounds=${JSON.stringify(uncoveredCoreBounds)}`,
  );
  const { components } = connectedAlphaComponents(alpha, width, height);
  gate(components.length === 1, section, `expected one connected primary island, found ${components.length}`);
  const pivotIndex = Math.round(pivot.y) * width + Math.round(pivot.x);
  gate(alpha[pivotIndex] >= VALIDATION_THRESHOLDS.stockAlpha, "File/frame", `pivot (${pivot.x},${pivot.y}) lacks opaque stock`);
  const bounds = components[0];
  const envelope = rectBounds(frame);
  gate(bounds.width <= envelope.width && bounds.height <= envelope.height, section, `replacement bounds ${bounds.width}x${bounds.height} exceed role envelope ${envelope.width}x${envelope.height}`);
  gate(contains(frame, bounds.centroid.x, bounds.centroid.y), section, "replacement centroid escapes role envelope");
  return { corePixels, coveredCorePixels, uncoveredCorePixels, uncoveredCoreBounds, coreCoverage, primaryIslandCount: components.length, bounds };
}

export function validatePairedReplacements({ alpha, width, height, parts, splitX }) {
  assertDimensions(alpha, width, height, "paired replacement alpha");
  const connected = connectedAlphaComponents(alpha, width, height);
  gate(connected.components.length === 2, "Paired parts", `expected exactly two separated components, found ${connected.components.length}`);
  const reports = [];
  const labels = new Set();
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    const pivotIndex = Math.round(part.pivot.y) * width + Math.round(part.pivot.x);
    const label = connected.labels[pivotIndex];
    gate(label > 0, "Paired parts", `${part.id} pivot is not in a component`);
    gate(!labels.has(label), "Paired parts", `${part.id} shares its component with its sibling`);
    labels.add(label);
    const isolated = new Uint8Array(alpha.length);
    for (let pixel = 0; pixel < alpha.length; pixel++) if (connected.labels[pixel] === label) isolated[pixel] = alpha[pixel];
    const report = validateFullReplacement({ alpha: isolated, width, height, frame: part.frame, coreMask: part.coreMask, pivot: part.pivot });
    const wrongSide = index === 0 ? report.bounds.right >= splitX : report.bounds.left < splitX;
    gate(!wrongSide, "Paired parts", `${part.id} crosses the sibling component clip at x=${splitX}`);
    reports.push({ id: part.id, componentLabel: label, ...report });
  }
  return { componentCount: connected.components.length, splitX, parts: reports };
}

function opaqueWithinRadius(alpha, width, height, pivot, radius) {
  let opaquePixels = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let y = Math.max(0, Math.round(pivot.y) - radius); y <= Math.min(height - 1, Math.round(pivot.y) + radius); y++) {
    for (let x = Math.max(0, Math.round(pivot.x) - radius); x <= Math.min(width - 1, Math.round(pivot.x) + radius); x++) {
      const distance = Math.hypot(x - pivot.x, y - pivot.y);
      if (distance > radius || alpha[y * width + x] < VALIDATION_THRESHOLDS.stockAlpha) continue;
      opaquePixels++;
      nearestDistance = Math.min(nearestDistance, distance);
    }
  }
  return { opaquePixels, nearestDistance: Number.isFinite(nearestDistance) ? nearestDistance : null };
}

export function validateReplacementHeadSockets({ alpha, width, height, eyesPivot, mouthPivot, hatMount }) {
  const radius = VALIDATION_THRESHOLDS.faceSocketRadiusPx;
  const eyes = opaqueWithinRadius(alpha, width, height, eyesPivot, radius);
  const mouth = opaqueWithinRadius(alpha, width, height, mouthPivot, radius);
  const hat = opaqueWithinRadius(alpha, width, height, hatMount, radius);
  gate(eyes.opaquePixels > 0, "Face compatibility", "replacement head lacks support beneath face.eyes");
  gate(mouth.opaquePixels > 0, "Face compatibility", "replacement head lacks support beneath face.mouth");
  gate(hat.nearestDistance != null && hat.nearestDistance <= radius, "Face compatibility", "replacement head does not preserve the canonical hat mount within 4px");
  return { eyes, mouth, hatMount: hat };
}

export function validateHeadAccessory({ alpha, width, height, envelope, pivot, label }) {
  const frameReport = validateAlphaInsideFrame(alpha, width, height, PART_FRAMES.head.crop, "File/frame");
  validateAlphaInsideFrame(alpha, width, height, envelope, "Face compatibility");
  const pivotIndex = Math.round(pivot.y) * width + Math.round(pivot.x);
  gate(alpha[pivotIndex] >= VALIDATION_THRESHOLDS.stockAlpha, "Face compatibility", `${label} does not cover its canonical face pivot`);
  const { components } = connectedAlphaComponents(alpha, width, height);
  gate(components.length === 1, "Face compatibility", `${label} must be one near-side attachment, found ${components.length} islands`);
  return { ...frameReport, primaryIslandCount: components.length, bounds: components[0] };
}

export function validateHatReadability({ alpha, width, height, scales = [1, 0.82, 0.24] }) {
  const { components } = connectedAlphaComponents(alpha, width, height);
  gate(components.length > 0, "Hat/readability", "hat has no readable opaque stock");
  const bounds = components.reduce((combined, component) => ({
    left: Math.min(combined.left, component.left),
    top: Math.min(combined.top, component.top),
    right: Math.max(combined.right, component.right),
    bottom: Math.max(combined.bottom, component.bottom),
    pixels: combined.pixels + component.pixels,
  }), { left: width, top: height, right: -1, bottom: -1, pixels: 0 });
  bounds.width = bounds.right - bounds.left + 1;
  bounds.height = bounds.bottom - bounds.top + 1;
  const checks = scales.map((scale) => {
    const projectedWidth = Math.max(1, Math.round(bounds.width * scale));
    const projectedHeight = Math.max(1, Math.round(bounds.height * scale));
    const projectedOpaquePixels = Math.max(1, Math.round(bounds.pixels * scale * scale));
    const verified = projectedWidth >= 4 && projectedHeight >= 4 && projectedOpaquePixels >= 24;
    gate(verified, "Hat/readability", `hat loses readable stock at stack scale ${scale}`);
    return { scale, projectedWidth, projectedHeight, projectedOpaquePixels, verified };
  });
  return { verified: true, islandCount: components.length, checks };
}

export function hashRgbaCrop(rgba, width, height, crop) {
  if (rgba.length !== width * height * 4) throw new Error(`crop hash: expected ${width * height * 4} RGBA bytes, found ${rgba.length}`);
  const bounds = rectBounds(crop);
  gate(bounds.left >= 0 && bounds.top >= 0 && bounds.right < width && bounds.bottom < height, "File/frame", `crop ${JSON.stringify(crop)} escapes ${width}x${height}`);
  const bytes = Buffer.alloc(bounds.width * bounds.height * 4);
  for (let y = 0; y < bounds.height; y++) {
    const sourceStart = (((bounds.top + y) * width) + bounds.left) * 4;
    const targetStart = y * bounds.width * 4;
    Buffer.from(rgba).copy(bytes, targetStart, sourceStart, sourceStart + bounds.width * 4);
  }
  return hashBytes(bytes);
}
