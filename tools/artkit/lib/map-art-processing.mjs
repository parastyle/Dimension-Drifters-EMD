import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import sharp from "sharp";

const clampByte = (value) => Math.max(0, Math.min(255, Math.round(value)));
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

async function rgbBuffer(file) {
  const { data, info } = await sharp(file)
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function edgeWeight(distance, strip) {
  if (distance >= strip) return 0;
  return 0.5 * (1 + Math.cos((Math.PI * distance) / strip));
}

function compressLuminance(data, targetMean, maxSpread) {
  const pixels = data.length / 3;
  const sourceValues = new Float64Array(pixels);
  let sourceTotal = 0;
  for (let pixel = 0; pixel < pixels; pixel++) {
    const index = pixel * 3;
    const value = luma(data[index], data[index + 1], data[index + 2]);
    sourceValues[pixel] = value;
    sourceTotal += value;
  }
  const sourceMean = sourceTotal / pixels;
  let sourceSpread = 1;
  for (const value of sourceValues) sourceSpread = Math.max(sourceSpread, Math.abs(value - sourceMean));
  const scale = Math.min(1, maxSpread / sourceSpread);
  const low = targetMean - maxSpread;
  const high = targetMean + maxSpread;
  const mappedMean = (offset) => {
    let total = 0;
    for (const value of sourceValues) total += Math.max(low, Math.min(high, targetMean + (value - sourceMean) * scale + offset));
    return total / pixels;
  };
  let lowerOffset = -maxSpread * 2;
  let upperOffset = maxSpread * 2;
  for (let iteration = 0; iteration < 24; iteration++) {
    const middle = (lowerOffset + upperOffset) / 2;
    if (mappedMean(middle) < targetMean) lowerOffset = middle;
    else upperOffset = middle;
  }
  const offset = (lowerOffset + upperOffset) / 2;
  const out = Buffer.from(data);
  for (let pixel = 0; pixel < pixels; pixel++) {
    const index = pixel * 3;
    const source = sourceValues[pixel];
    const target = Math.max(low, Math.min(high, targetMean + (source - sourceMean) * scale + offset));
    const delta = target - source;
    out[index] = clampByte(data[index] + delta);
    out[index + 1] = clampByte(data[index + 1] + delta);
    out[index + 2] = clampByte(data[index + 2] + delta);
  }
  return out;
}

async function quantizedRgb(input, width, height, colours) {
  const palette = await sharp(input)
    .resize(width, height, { fit: "fill" })
    .png({ palette: true, colours, dither: 0 })
    .toBuffer();
  return sharp(palette)
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
}

function parseHexColour(hex) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`invalid fixed cel colour ${hex}`);
  return match.slice(1).map((channel) => Number.parseInt(channel, 16));
}

function isEmberAccent(data, offset) {
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  return r - Math.max(g, b) >= 42 && r >= g * 1.35 && g >= b * 1.2;
}

function fixedCelPalette(source, original, width, paletteHex, accentHex) {
  const palette = paletteHex.map(parseHexColour);
  const accent = parseHexColour(accentHex);
  const colours = new Map();
  for (let offset = 0; offset < source.length; offset += 3) {
    const key = `${source[offset]},${source[offset + 1]},${source[offset + 2]}`;
    const existing = colours.get(key);
    if (existing) existing.count++;
    else {
      colours.set(key, {
        rgb: [source[offset], source[offset + 1], source[offset + 2]],
        count: 1,
      });
    }
  }
  const ranked = [...colours.entries()].sort(
    (left, right) => luma(...left[1].rgb) - luma(...right[1].rgb),
  );
  const mappedIndex = new Map();
  for (let index = 0; index < ranked.length; index++) {
    const paletteIndex =
      ranked.length === 1
        ? Math.floor(palette.length / 2)
        : Math.round((index * (palette.length - 1)) / (ranked.length - 1));
    mappedIndex.set(ranked[index][0], paletteIndex);
  }

  const inkKey = ranked[0][0];
  // The image generator authors at a larger square than the installed tile,
  // so its requested 4px/2px linework would otherwise downsample toward
  // 2px/1px. Extend the darkest source line one pixel south-east: generated
  // 2-3px major joints install at 3-4px, while 1px minor lines install at 2px.
  const pixels = source.length / 3;
  const inkMask = new Uint8Array(pixels);
  for (let pixel = 0; pixel < pixels; pixel++) {
    const offset = pixel * 3;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const left = x > 0 ? offset - 3 : -1;
    const up = y > 0 ? offset - width * 3 : -1;
    const sourceKey = `${source[offset]},${source[offset + 1]},${source[offset + 2]}`;
    const leftKey = left >= 0 ? `${source[left]},${source[left + 1]},${source[left + 2]}` : "";
    const upKey = up >= 0 ? `${source[up]},${source[up + 1]},${source[up + 2]}` : "";
    inkMask[pixel] = sourceKey === inkKey || leftKey === inkKey || upKey === inkKey ? 1 : 0;
  }

  // Alternate the six surface hues by ink-enclosed material region, never by
  // noisy source pixels. This adds bounded hue structure without inventing an
  // un-inked colour boundary or turning cel planes into photographic grain.
  const components = new Int32Array(pixels);
  components.fill(-1);
  const queue = new Int32Array(pixels);
  let component = 0;
  for (let start = 0; start < pixels; start++) {
    if (inkMask[start] || components[start] >= 0) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    components[start] = component;
    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % width;
      const neighbours = [
        x > 0 ? pixel - 1 : -1,
        x + 1 < width ? pixel + 1 : -1,
        pixel >= width ? pixel - width : -1,
        pixel + width < pixels ? pixel + width : -1,
      ];
      for (const neighbour of neighbours) {
        if (neighbour < 0 || inkMask[neighbour] || components[neighbour] >= 0) continue;
        components[neighbour] = component;
        queue[tail++] = neighbour;
      }
    }
    component++;
  }

  const out = Buffer.alloc(source.length);
  for (let pixel = 0; pixel < pixels; pixel++) {
    const offset = pixel * 3;
    const sourceKey = `${source[offset]},${source[offset + 1]},${source[offset + 2]}`;
    let target;
    if (isEmberAccent(original, offset)) {
      // Accent pixels remain visible inside the widest failing-ground gaps.
      target = accent;
    } else if (inkMask[pixel]) {
      target = palette[0];
    } else {
      const baseIndex = mappedIndex.get(sourceKey);
      const alternate = components[pixel] % 2;
      target = palette[Math.max(1, baseIndex - alternate)];
    }
    out[offset] = target[0];
    out[offset + 1] = target[1];
    out[offset + 2] = target[2];
  }
  return out;
}

/**
 * Collapse generated floor shading into a bounded cel palette before the
 * family perimeter fold. The fold remains the final seam operation.
 */
export async function normalizeCelTileValues({
  files,
  targetMeans,
  maxSpread = 10,
  colours = 7,
  fixedPalette,
  accent,
}) {
  if (files.length !== targetMeans.length) throw new Error("tile value target count must match files");
  if ((fixedPalette && !accent) || (!fixedPalette && accent)) {
    throw new Error("fixed cel palettes require both fixedPalette and accent");
  }
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const source = await quantizedRgb(file, 512, 512, colours);
    let celData = source.data;
    if (fixedPalette) {
      const original = await sharp(file)
        .resize(512, 512, { fit: "fill" })
        .removeAlpha()
        .toColourspace("srgb")
        .raw()
        .toBuffer();
      celData = fixedCelPalette(source.data, original, 512, fixedPalette, accent);
    }
    const tileSpread = Array.isArray(maxSpread) ? maxSpread[index] : maxSpread;
    if (!Number.isFinite(tileSpread)) throw new Error(`missing tile value spread at index ${index}`);
    const out = compressLuminance(celData, targetMeans[index], tileSpread);
    await sharp(out, { raw: { width: 512, height: 512, channels: 3 } }).png().toFile(file);
  }
}

function rowMeans(data, width, height) {
  const rows = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let total = 0;
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 3;
      total += luma(data[index], data[index + 1], data[index + 2]);
    }
    rows[y] = total / width;
  }
  return rows;
}

function strongestDarkStep(rows, from, to) {
  let row = from;
  let drop = -Infinity;
  for (let y = Math.max(1, from); y <= Math.min(rows.length - 1, to); y++) {
    const candidate = rows[y - 1] - rows[y];
    if (candidate > drop) {
      drop = candidate;
      row = y;
    }
  }
  return row;
}

async function rimRegion(source, extract, targetHeight, targetMean, maxSpread, colours) {
  const resized = await sharp(source)
    .extract(extract)
    .resize(1024, targetHeight, { fit: "fill" })
    .png({ palette: true, colours, dither: 0 })
    .toBuffer();
  const decoded = await sharp(resized)
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const compressed = compressLuminance(decoded.data, targetMean, maxSpread);
  return sharp(compressed, { raw: { width: 1024, height: targetHeight, channels: 3 } }).png().toBuffer();
}

async function horizontalizeTopBand(input, bandHeight = 72) {
  const decoded = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.from(decoded.data);
  const limit = Math.min(decoded.info.height, bandHeight);
  for (let y = 0; y < limit; y++) {
    const average = [0, 0, 0];
    for (let x = 0; x < decoded.info.width; x++) {
      const index = (y * decoded.info.width + x) * 3;
      average[0] += decoded.data[index];
      average[1] += decoded.data[index + 1];
      average[2] += decoded.data[index + 2];
    }
    for (let channel = 0; channel < 3; channel++) average[channel] = clampByte(average[channel] / decoded.info.width);
    for (let x = 0; x < decoded.info.width; x++) {
      const index = (y * decoded.info.width + x) * 3;
      out[index] = average[0];
      out[index + 1] = average[1];
      out[index + 2] = average[2];
    }
  }
  return sharp(out, {
    raw: { width: decoded.info.width, height: decoded.info.height, channels: 3 },
  })
    .png()
    .toBuffer();
}

/**
 * Recompose a generated rim around the renderer's exact y=128 split. Image
 * generation may place the requested halfway lip a little high or low; detect
 * its two dark steps, then preserve and flatten the authored ground/wall/void
 * regions into the fixed 126/5/93/32 contract.
 */
export async function normalizeCelRim(file) {
  const source = await sharp(file).removeAlpha().toColourspace("srgb").png().toBuffer();
  const decoded = await sharp(source).raw().toBuffer({ resolveWithObject: true });
  const { data, info } = decoded;
  const rows = rowMeans(data, info.width, info.height);
  const lip = strongestDarkStep(rows, Math.floor(info.height * 0.28), Math.floor(info.height * 0.62));
  const voidStart = strongestDarkStep(
    rows,
    lip + Math.floor((info.height - lip) * 0.42),
    info.height - 2,
  );
  if (lip < 16 || voidStart <= lip + 16) {
    throw new Error(`could not detect rim bands in ${file}: lip=${lip}, void=${voidStart}`);
  }

  const groundAuthored = await rimRegion(
    source,
    { left: 0, top: 0, width: info.width, height: lip },
    126,
    90,
    15,
    6,
  );
  const ground = await horizontalizeTopBand(groundAuthored);
  const wall = await rimRegion(
    source,
    { left: 0, top: lip, width: info.width, height: voidStart - lip },
    93,
    45,
    12,
    6,
  );
  const pitVoid = await rimRegion(
    source,
    { left: 0, top: voidStart, width: info.width, height: info.height - voidStart },
    32,
    20,
    4,
    3,
  );
  const lipLine = await sharp({
    create: { width: 1024, height: 5, channels: 3, background: { r: 36, g: 30, b: 32 } },
  })
    .png()
    .toBuffer();
  await sharp({
    create: { width: 1024, height: 256, channels: 3, background: { r: 23, g: 20, b: 22 } },
  })
    .composite([
      { input: ground, left: 0, top: 0 },
      { input: lipLine, left: 0, top: 126 },
      { input: wall, left: 0, top: 131 },
      { input: pitVoid, left: 0, top: 224 },
    ])
    .png()
    .toFile(file);
}

/**
 * Blend every tile perimeter into one toroidally symmetric strip derived from
 * the family's quiet base tile. Outermost opposite pixels become identical,
 * while a cosine falloff keeps the correction out of the tile interior.
 */
export async function normalizeTileFamily({ files, baseFile, strip = 32 }) {
  const base = await rgbBuffer(baseFile);
  if (strip < 1 || strip * 2 >= Math.min(base.width, base.height)) {
    throw new Error(`invalid tile edge strip ${strip} for ${base.width}x${base.height}`);
  }

  for (const file of files) {
    const source = await rgbBuffer(file);
    if (source.width !== base.width || source.height !== base.height) {
      throw new Error(`tile family mismatch: ${file} is ${source.width}x${source.height}, base is ${base.width}x${base.height}`);
    }
    const out = Buffer.from(source.data);
    const { width, height } = source;
    // Generated textures often contain an accidental vignette in their outer
    // pixels. Sample the shared strip from a quiet interior inset instead of
    // copying that defect into every family member.
    const inset = Math.min(strip * 2, Math.floor(Math.min(width, height) / 4));
    for (let y = 0; y < height; y++) {
      const dy = Math.min(y, height - 1 - y);
      const wy = edgeWeight(dy, strip);
      const sy = dy < strip ? inset + dy : dy;
      const oy = height - 1 - sy;
      for (let x = 0; x < width; x++) {
        const dx = Math.min(x, width - 1 - x);
        const wx = edgeWeight(dx, strip);
        const weight = 1 - (1 - wx) * (1 - wy);
        if (weight <= 0) continue;
        const sx = dx < strip ? inset + dx : dx;
        const mirroredX = width - 1 - sx;
        const dst = (y * width + x) * 3;
        const refs = [
          (sy * width + sx) * 3,
          (sy * width + mirroredX) * 3,
          (oy * width + sx) * 3,
          (oy * width + mirroredX) * 3,
        ];
        for (let channel = 0; channel < 3; channel++) {
          let target = 0;
          for (const ref of refs) target += base.data[ref + channel];
          target /= refs.length;
          out[dst + channel] = clampByte(source.data[dst + channel] * (1 - weight) + target * weight);
        }
      }
    }
    mkdirSync(dirname(file), { recursive: true });
    await sharp(out, { raw: { width, height, channels: 3 } }).png().toFile(file);
  }
}

/** Make a horizontally tiled rim deterministic with the same cosine fold. */
export async function normalizeRim(file, strip = 32) {
  const source = await rgbBuffer(file);
  if (strip < 1 || strip * 2 >= source.width) {
    throw new Error(`invalid rim edge strip ${strip} for ${source.width}x${source.height}`);
  }
  const out = Buffer.from(source.data);
  const { width, height } = source;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = Math.min(x, width - 1 - x);
      const weight = edgeWeight(dx, strip);
      if (weight <= 0) continue;
      const left = (y * width + dx) * 3;
      const right = (y * width + (width - 1 - dx)) * 3;
      const dst = (y * width + x) * 3;
      for (let channel = 0; channel < 3; channel++) {
        const target = (source.data[left + channel] + source.data[right + channel]) / 2;
        out[dst + channel] = clampByte(source.data[dst + channel] * (1 - weight) + target * weight);
      }
    }
  }
  await sharp(out, { raw: { width, height, channels: 3 } }).png().toFile(file);
}

export function alphaStats(data, width, height, threshold = 16) {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  let visible = 0;
  let borderVisiblePixels = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= threshold) continue;
      visible++;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) borderVisiblePixels++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const bbox = visible ? { x0, y0, x1, y1 } : null;
  return {
    visible,
    borderVisiblePixels,
    bbox,
    margins: bbox ? [bbox.x0, width - 1 - bbox.x1, bbox.y0, height - 1 - bbox.y1] : [width, width, height, height],
  };
}

export async function validateAlphaFile(file, { threshold = 16, minMargin = 4 } = {}) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const stats = alphaStats(data, info.width, info.height, threshold);
  const pass = stats.visible > 0 && stats.borderVisiblePixels === 0 && stats.margins.every((margin) => margin >= minMargin);
  return { file, width: info.width, height: info.height, ...stats, pass };
}

async function alignContactInCanvas(file, contactX, contactY, margin) {
  const decoded = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = decoded;
  const stats = alphaStats(data, info.width, info.height, 16);
  if (!stats.bbox) throw new Error(`cannot align empty cutout ${file}`);
  const anchorX = Math.round(contactX);
  const anchorY = Math.min(Math.round(contactY), info.height - 1 - margin);
  let nearest = null;
  let bestDistance = Infinity;
  for (let y = Math.max(stats.bbox.y0, stats.bbox.y1 - 12); y <= stats.bbox.y1; y++) {
    for (let x = stats.bbox.x0; x <= stats.bbox.x1; x++) {
      const pixel = (y * info.width + x) * 4;
      if (data[pixel + 3] <= 16) continue;
      const distance = Math.hypot(x - anchorX, y - anchorY);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = { x, y, pixel };
      }
    }
  }
  if (nearest && bestDistance > 3) {
    const steps = Math.ceil(bestDistance);
    for (let step = 1; step <= steps; step++) {
      const x = Math.round(nearest.x + ((anchorX - nearest.x) * step) / steps);
      const y = Math.round(nearest.y + ((anchorY - nearest.y) * step) / steps);
      if (x < margin || x >= info.width - margin || y < margin || y >= info.height - margin) continue;
      const dst = (y * info.width + x) * 4;
      data.copy(data, dst, nearest.pixel, nearest.pixel + 4);
    }
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(file);
  }
  return { distance: bestDistance };
}

function keyedRgba(data, key) {
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const a = out[i + 3];
    if (key === "magenta") {
      const strength = Math.min(r, b) - g;
      if (r > 80 && b > 80 && strength > 25 && Math.abs(r - b) < 100) out[i + 3] = 0;
      else if (r > g + 5 && b > g + 5 && strength > 5) {
        // Anti-aliased key pixels are mixtures of subject and #ff00ff.
        // Contract both red and blue toward green so a keyed edge cannot
        // leave a high-chroma purple halo on moss/foliage cutouts.
        out[i] = Math.round(g + (r - g) * 0.12);
        out[i + 2] = Math.round(g + (b - g) * 0.12);
      }
    } else {
      const strength = g - Math.max(r, b);
      if (g > 125 && strength > 55) out[i + 3] = 0;
      else if (g > r && g > b && strength > 14) {
        const neutral = (r + b) / 2;
        out[i + 1] = Math.round(neutral + (g - neutral) * 0.3);
      }
    }
    if (a === 0) out[i + 3] = 0;
  }
  return out;
}

/**
 * Chroma-key a generated identity edit, trim it, and place the result onto a
 * deterministic canvas. The visible footline is aligned to contactY when one
 * is supplied, so existing renderer metadata remains valid.
 */
export async function installGeneratedCutout({
  raw,
  target,
  width,
  height,
  contactX = width / 2,
  contactY = height - 5,
  key = "green",
  margin = 4,
  alignContact = true,
}) {
  const decoded = await sharp(raw)
    .resize(1536, 1536, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const keyed = keyedRgba(decoded.data, key);
  const sourceStats = alphaStats(keyed, decoded.info.width, decoded.info.height, 16);
  if (!sourceStats.bbox) throw new Error(`no cutout survived chroma key in ${raw}`);
  const box = sourceStats.bbox;
  const cropWidth = box.x1 - box.x0 + 1;
  const cropHeight = box.y1 - box.y0 + 1;
  const cropped = await sharp(keyed, {
    raw: { width: decoded.info.width, height: decoded.info.height, channels: 4 },
  })
    .extract({ left: box.x0, top: box.y0, width: cropWidth, height: cropHeight })
    .png()
    .toBuffer();

  const desiredBottom = Math.min(Math.round(contactY), height - 1 - margin);
  const maxHeight = Math.max(1, desiredBottom - margin + 1);
  const maxWidth = Math.max(1, Math.floor(2 * Math.min(contactX - margin, width - margin - contactX)));
  const resized = await sharp(cropped)
    .resize(maxWidth, maxHeight, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer({ resolveWithObject: true });
  const left = Math.max(margin, Math.min(width - margin - resized.info.width, Math.round(contactX - resized.info.width / 2)));
  const top = desiredBottom - resized.info.height + 1;
  mkdirSync(dirname(target), { recursive: true });
  await sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: resized.data, left, top }])
    .png()
    .toFile(target);
  if (alignContact) await alignContactInCanvas(target, contactX, contactY, margin);
  const validation = await validateAlphaFile(target, { threshold: 16, minMargin: margin });
  if (!validation.pass) {
    throw new Error(`alpha padding failed for ${target}: border=${validation.borderVisiblePixels}, margins=${validation.margins.join("/")}`);
  }
  return validation;
}

/** The work-order's decal extraction contract: max-8 resize, then 4px alpha pad. */
export async function writePaddedCutout({ input, target, maxSize }) {
  mkdirSync(dirname(target), { recursive: true });
  // Materialize first so the deterministic installed-file fallback can use
  // the same path for input and output without Sharp's in-place restriction.
  const source = await sharp(input).ensureAlpha().png().toBuffer();
  await sharp(source)
    .ensureAlpha()
    .resize(maxSize - 8, maxSize - 8, { fit: "inside", withoutEnlargement: true })
    .extend({
      top: 4,
      bottom: 4,
      left: 4,
      right: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(target);
  const validation = await validateAlphaFile(target, { threshold: 16, minMargin: 4 });
  if (!validation.pass) {
    throw new Error(`padded cutout failed ${target}: border=${validation.borderVisiblePixels}, margins=${validation.margins.join("/")}`);
  }
  return validation;
}
