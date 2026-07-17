import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import sharp from "sharp";

const clampByte = (value) => Math.max(0, Math.min(255, Math.round(value)));

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
