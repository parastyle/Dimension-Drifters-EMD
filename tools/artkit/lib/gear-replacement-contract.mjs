import { createHash } from "node:crypto";

export const REPLACEMENT_CONTRACT_ID = "GEAR_REPLACEMENT_V2";

export const COMPOSITION_ORDERS = Object.freeze({
  body: Object.freeze(["torso"]),
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
  // OWNER RULING 2026-07-18 (silhouette-character law): torso/head garments may EXCEED the base
  // silhouette by a bounded margin — high collars, hanging props, fur ruffs, plumes are the
  // identity of the ornate sets, and the strict bean-conformity gate was rejecting superior art
  // (the graveside coat). Frames widened (up ~90px, sides ~44px) so the overhang survives the
  // crop; pivots unchanged; purely visual — hitboxes never read these frames.
  // Widened FURTHER on owner order ("widen the margins"): frames now run near the emergency
  // canvas insets — big collars, wide props, tall plumes all legal. Pivots unchanged.
  body: partFrame([268, 180, 488, 544], { x: 512, y: 512 }, [244, 332]),
  head: partFrame([290, 40, 508, 552], { x: 512, y: 300 }, [222, 260]),
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
  replacementCoreCoverage: 0.98,
  torsoCoreCoverage: 0.90,
  baseCoreErosionPx: 4,
  // 12 → 84 → 132 (owner: "widen the margins"): generous overhang for silhouette character;
  // the frame bounds remain the hard stop against truly unbounded shapes.
  torsoSilhouetteTolerancePx: 132,
  emergencyCanvasInsetPx: 24,
  faceSocketRadiusPx: 4,
});

// OWNER RULING 2026-07-20: only catalog items declared `ornate: true` may use this
// flowing-garment torso profile; every unflagged torso remains on the strict thresholds above.
export const ORNATE_TORSO_VALIDATION_THRESHOLDS = Object.freeze({
  torsoCoreCoverage: 0.75,
  torsoSilhouetteTolerancePx: 200,
});

/** Stable IDs whose original hat art is a complete head and must be rendered into the head frame. */
export const FULL_HEAD_REPLACEMENT_IDS = Object.freeze([
  "ash-walker-hat",
  "ashen-crusader-hat",
  "thornwatch-hat",
  "neon-mirage-hat",
  "pressurized-hat",
]);

// Twelve normal torso/head pairs plus five former full-head hats queued after the current fleet.
export const MIGRATION_EXPECTED = Object.freeze({
  setPairs: 12,
  torsoItems: 12,
  headItems: 17,
  rerenderItems: 29,
  renderCalls: 29,
  rerenderComponentParts: 29,
  reusableHeadRenders: 2,
  newHeadRenders: 15,
  byBatch: Object.freeze({
    torso: Object.freeze({ items: 12, calls: 12, componentParts: 12 }),
    head: Object.freeze({ items: 17, calls: 17, componentParts: 17 }),
  }),
});

export function renderRoleForItem(item) {
  switch (item.slot) {
    // `shirt` is accepted only as a transition input while the catalog owner lands the re-slot;
    // callers must normalize its output slot/directory to torso and must never include pants.
    case "torso":
    case "shirt": return "replace-torso";
    case "head": return "replace-head";
    case "gloves": return "replace-hand";
    case "boots": return "replace-foot";
    case "glasses": return "head-accessory";
    case "facialHair": return "head-accessory";
    case "cloak": return "cloak-far";
    case "hat": return "overlay-hat";
    case "pants": throw new Error(`Replacement role: retired pants catalog row ${item.id}`);
    default: throw new Error(`Replacement role: unsupported catalog slot ${item.slot} for ${item.id}`);
  }
}

export function renderVariantsForItem(item) {
  const renderRole = renderRoleForItem(item);
  const componentParts = item.slot === "gloves" || item.slot === "boots" ? 2 : 1;
  return [Object.freeze({
    directory: item.slotDirectory,
    renderRole,
    componentParts,
    creativeRender: renderRole === "replace-torso" || renderRole === "replace-head",
  })];
}

function countBy(items, predicate) {
  return items.reduce((count, item) => count + (predicate(item) ? 1 : 0), 0);
}

function batchCounts(jobs, renderRole) {
  const selected = jobs.filter((job) => job.renderRole === renderRole);
  return {
    items: new Set(selected.map((job) => job.item.id)).size,
    calls: selected.length,
    componentParts: selected.reduce((sum, job) => sum + job.componentParts, 0),
  };
}

export function buildMigrationPlan(items) {
  const roles = items.map((item) => ({ item, renderRole: renderRoleForItem(item), variants: renderVariantsForItem(item) }));
  const creative = roles.flatMap(({ item, variants }) => variants
    .filter((variant) => variant.creativeRender)
    .map((variant) => ({ item, ...variant })));
  const preserved = roles.flatMap(({ item, variants }) => variants
    .filter((variant) => !variant.creativeRender)
    .map((variant) => ({ item, ...variant })));
  const rerenderIds = new Set(creative.map((job) => job.item.id));
  return {
    roles,
    creative,
    preserved,
    counts: {
      rerenderItems: rerenderIds.size,
      renderCalls: creative.length,
      rerenderComponentParts: creative.reduce((sum, job) => sum + job.componentParts, 0),
      preservedOverlayHats: countBy(preserved, (job) => job.renderRole === "overlay-hat"),
      preservedCloaks: countBy(preserved, (job) => job.renderRole === "cloak-far"),
      finalNonblankItems: items.length,
      finalRoleTextures: roles.reduce((sum, row) => sum + row.variants.length, 0),
      finalManifestParts: roles.reduce((sum, row) => sum + row.variants.reduce((partSum, variant) => partSum + variant.componentParts, 0), 0),
      byBatch: {
        torso: batchCounts(creative, "replace-torso"),
        head: batchCounts(creative, "replace-head"),
      },
    },
  };
}

export function assertMigrationPlan(plan) {
  const mismatches = [];
  for (const key of ["rerenderItems", "renderCalls", "rerenderComponentParts"]) {
    if (plan.counts[key] !== MIGRATION_EXPECTED[key]) mismatches.push(`${key}=${plan.counts[key]} expected ${MIGRATION_EXPECTED[key]}`);
  }
  for (const [batch, expected] of Object.entries(MIGRATION_EXPECTED.byBatch)) {
    const actual = plan.counts.byBatch[batch];
    for (const key of ["items", "calls", "componentParts"]) {
      if (actual?.[key] !== expected[key]) mismatches.push(`${batch}.${key}=${actual?.[key]} expected ${expected[key]}`);
    }
  }
  const retiredPatchRole = ["body", "patch"].join("-");
  const retired = plan.roles.filter((row) => row.item.slot === "pants" || row.renderRole === retiredPatchRole);
  if (retired.length > 0) mismatches.push(`retired rows=${retired.map((row) => row.item.id).join(",")}`);
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

function assertDimensions(values, width, height, label) {
  if (values.length !== width * height) throw new Error(`${label}: expected ${width * height} pixels, found ${values.length}`);
}

function circularOffsets(radius) {
  const offsets = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) if (dx * dx + dy * dy <= radius * radius) offsets.push([dx, dy]);
  }
  return offsets;
}

export function erodeMask(mask, width, height, radius = VALIDATION_THRESHOLDS.baseCoreErosionPx) {
  assertDimensions(mask, width, height, "mask erosion input");
  const output = new Uint8Array(mask.length);
  const offsets = circularOffsets(radius);
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

export function dilateMask(mask, width, height, radius = VALIDATION_THRESHOLDS.torsoSilhouetteTolerancePx) {
  assertDimensions(mask, width, height, "mask dilation input");
  if (!Number.isInteger(radius) || radius < 0) throw new Error(`mask dilation radius must be a non-negative integer, got ${radius}`);
  const output = new Uint8Array(mask.length);
  if (radius === 0) {
    for (let index = 0; index < mask.length; index++) output[index] = mask[index] ? 1 : 0;
    return output;
  }

  // Exact squared-Euclidean distance transform. This produces the same circular dilation as
  // enumerating every radius offset, but remains linear in canvas size for the 132px/200px gates.
  const infiniteDistance = width * width + height * height + 1;
  const verticalDistances = new Float64Array(mask.length);
  const maxDimension = Math.max(width, height);
  const input = new Float64Array(maxDimension);
  const transformed = new Float64Array(maxDimension);
  const locations = new Int32Array(maxDimension);
  const boundaries = new Float64Array(maxDimension + 1);
  const transformLine = (length) => {
    let envelopeIndex = 0;
    locations[0] = 0;
    boundaries[0] = Number.NEGATIVE_INFINITY;
    boundaries[1] = Number.POSITIVE_INFINITY;
    for (let position = 1; position < length; position++) {
      let boundary;
      while (true) {
        const location = locations[envelopeIndex];
        boundary = (
          (input[position] + position * position)
          - (input[location] + location * location)
        ) / (2 * position - 2 * location);
        if (boundary > boundaries[envelopeIndex]) break;
        envelopeIndex--;
      }
      envelopeIndex++;
      locations[envelopeIndex] = position;
      boundaries[envelopeIndex] = boundary;
      boundaries[envelopeIndex + 1] = Number.POSITIVE_INFINITY;
    }
    envelopeIndex = 0;
    for (let position = 0; position < length; position++) {
      while (boundaries[envelopeIndex + 1] < position) envelopeIndex++;
      const delta = position - locations[envelopeIndex];
      transformed[position] = delta * delta + input[locations[envelopeIndex]];
    }
  };

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) input[y] = mask[y * width + x] ? 0 : infiniteDistance;
    transformLine(height);
    for (let y = 0; y < height; y++) verticalDistances[y * width + x] = transformed[y];
  }
  const squaredRadius = radius * radius;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) input[x] = verticalDistances[row + x];
    transformLine(width);
    for (let x = 0; x < width; x++) output[row + x] = transformed[x] <= squaredRadius ? 1 : 0;
  }
  return output;
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
  return { removedComponentCount: removedComponents.length, removedPixels, removedComponents };
}

function maskPixelCount(mask) {
  let count = 0;
  for (const value of mask) count += value ? 1 : 0;
  return count;
}

export function validateFullReplacement({
  alpha,
  width,
  height,
  frame,
  coreMask,
  pivot,
  section = "Full replacement coverage",
  minimumCoreCoverage = VALIDATION_THRESHOLDS.replacementCoreCoverage,
}) {
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
    coreCoverage >= minimumCoreCoverage,
    section,
    `base-core coverage ${(coreCoverage * 100).toFixed(3)}% is below ${(minimumCoreCoverage * 100).toFixed(0)}%; uncovered=${uncoveredCorePixels}px bounds=${JSON.stringify(uncoveredCoreBounds)}`,
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

export function validateTorsoReplacement({
  alpha,
  width,
  height,
  frame,
  coreMask,
  allowedMask,
  ornateAllowedMask = allowedMask,
  ornate = false,
  pivot,
  partBox,
  generatedOutlineRadius = 8,
}) {
  const profile = ornate ? ORNATE_TORSO_VALIDATION_THRESHOLDS : VALIDATION_THRESHOLDS;
  const selectedAllowedMask = ornate ? ornateAllowedMask : allowedMask;
  assertDimensions(selectedAllowedMask, width, height, "torso silhouette mask");
  gate(generatedOutlineRadius === 8, "Outline", `replace-torso requires generated radius 8, got ${generatedOutlineRadius}`);
  const report = validateFullReplacement({
    alpha,
    width,
    height,
    frame,
    coreMask,
    pivot,
    section: "Torso replacement",
    minimumCoreCoverage: profile.torsoCoreCoverage,
  });
  let escapedPixels = 0;
  for (let index = 0; index < alpha.length; index++) {
    if (alpha[index] > VALIDATION_THRESHOLDS.visibleAlpha && !selectedAllowedMask[index]) escapedPixels++;
  }
  gate(escapedPixels === 0, "Torso silhouette", `${escapedPixels}px escape the base torso tolerance envelope`);
  gate(
    report.bounds.width <= partBox.width && report.bounds.height <= partBox.height,
    "Torso part-box",
    `replacement bounds ${report.bounds.width}x${report.bounds.height} exceed ${partBox.width}x${partBox.height}`,
  );
  return {
    ...report,
    escapedPixels,
    validationProfile: ornate ? "ornate" : "strict",
    minimumCoreCoverage: profile.torsoCoreCoverage,
    silhouetteTolerancePx: profile.torsoSilhouetteTolerancePx,
    partBox,
  };
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
