"use client";

/**
 * Photo work in the browser: shrinking, resizing and the document scanner
 * (finding the page, straightening it, cleaning it up). Nothing is uploaded.
 */

export type ImageFormat = "jpeg" | "png" | "webp";

export async function decode(file: Blob): Promise<ImageBitmap> {
  // Rotates phone photos the way they were taken (EXIF orientation).
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

export function canvasOf(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function toBlob(canvas: HTMLCanvasElement, format: ImageFormat, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), `image/${format}`, quality));
}

/** Draws the bitmap scaled with good resampling (halving steps avoid aliasing). */
function draw(bitmap: ImageBitmap | HTMLCanvasElement, w: number, h: number, flatten: boolean): HTMLCanvasElement {
  let src: ImageBitmap | HTMLCanvasElement = bitmap;
  let sw = bitmap.width;
  let sh = bitmap.height;
  while (sw / 2 >= w && sh / 2 >= h) {
    const half = canvasOf(sw / 2, sh / 2);
    half.getContext("2d")!.drawImage(src, 0, 0, half.width, half.height);
    src = half;
    sw = half.width;
    sh = half.height;
  }
  const out = canvasOf(w, h);
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  if (flatten) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, out.width, out.height);
  }
  ctx.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

export function formatOf(file: Blob): ImageFormat {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpeg";
}

export const extOf = (f: ImageFormat) => (f === "jpeg" ? "jpg" : f);

/**
 * Re-encodes a photo: at most `maxSide` pixels on the long edge (or exact
 * `width`/`height`), in `format` at `quality`. With `targetBytes`, searches for
 * the best quality (then size) that fits. Location and camera data are dropped.
 */
export async function shrink(
  file: Blob,
  o: { format: ImageFormat; quality: number; maxSide?: number; width?: number; height?: number; targetBytes?: number },
): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await decode(file);
  try {
    let w = bmp.width;
    let h = bmp.height;
    if (o.width || o.height) {
      w = o.width ?? Math.round((bmp.width * o.height!) / bmp.height);
      h = o.height ?? Math.round((bmp.height * o.width!) / bmp.width);
    } else if (o.maxSide && Math.max(w, h) > o.maxSide) {
      const s = o.maxSide / Math.max(w, h);
      w = Math.round(w * s);
      h = Math.round(h * s);
    }
    const flatten = o.format === "jpeg";
    if (!o.targetBytes || o.format === "png") {
      const c = draw(bmp, w, h, flatten);
      return { blob: await toBlob(c, o.format, o.quality), width: c.width, height: c.height };
    }
    // Target size: binary search on quality; if even low quality is too big, scale down and retry.
    let scale = 1;
    for (let round = 0; round < 6; round++) {
      const c = draw(bmp, w * scale, h * scale, flatten);
      let lo = 0.35;
      let hi = 0.92;
      let best: Blob | null = null;
      for (let i = 0; i < 7; i++) {
        const q = (lo + hi) / 2;
        const b = await toBlob(c, o.format, q);
        if (b.size <= o.targetBytes) {
          best = b;
          lo = q;
        } else hi = q;
      }
      if (best) return { blob: best, width: c.width, height: c.height };
      scale *= 0.75;
    }
    const c = draw(bmp, w * scale, h * scale, flatten);
    return { blob: await toBlob(c, o.format, 0.35), width: c.width, height: c.height };
  } finally {
    bmp.close();
  }
}

// ------------------------------------------------------------- scanner

export type Point = { x: number; y: number };
/** Page corners as fractions of the image: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point];
export type ScanFilter = "original" | "enhance" | "gray" | "bw";

export const FULL_QUAD: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

/**
 * Finds the sheet of paper: on a small copy, separates the bright page from
 * the background (Otsu threshold), keeps the largest bright region touching
 * the middle, and takes its four extreme corners.
 */
export function detectPage(source: CanvasImageSource & { width: number; height: number }): Quad {
  const S = 320;
  const k = S / Math.max(source.width, source.height);
  const w = Math.max(8, Math.round(source.width * k));
  const h = Math.max(8, Math.round(source.height * k));
  const c = canvasOf(w, h);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.filter = "blur(2px)";
  ctx.drawImage(source, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const lum = new Uint8Array(w * h);
  const hist = new Array(256).fill(0);
  for (let i = 0; i < w * h; i++) {
    const v = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) | 0;
    lum[i] = v;
    hist[v]++;
  }
  // Otsu's threshold.
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0,
    wB = 0,
    best = 0,
    threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = w * h - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  // Flood fill the bright region from the brightest pixel near the centre.
  const mask = new Uint8Array(w * h);
  let seed = -1;
  for (let r = 0; r < Math.min(w, h) / 2 && seed < 0; r += 2) {
    for (let dy = -r; dy <= r && seed < 0; dy += Math.max(1, r)) {
      for (let dx = -r; dx <= r; dx++) {
        const x = (w >> 1) + dx;
        const y = (h >> 1) + dy;
        if (x >= 0 && y >= 0 && x < w && y < h && lum[y * w + x] > threshold) {
          seed = y * w + x;
          break;
        }
      }
    }
  }
  if (seed < 0) return FULL_QUAD;
  const stack = [seed];
  mask[seed] = 1;
  let count = 0;
  while (stack.length) {
    const i = stack.pop()!;
    count++;
    const x = i % w;
    const y = (i / w) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
      if (j >= 0 && !mask[j] && lum[j] > threshold) {
        mask[j] = 1;
        stack.push(j);
      }
    }
  }
  // Too small or the whole frame: probably not a page on a background.
  if (count < w * h * 0.12 || count > w * h * 0.97) return FULL_QUAD;
  let tl = { s: Infinity, x: 0, y: 0 },
    br = { s: -Infinity, x: 0, y: 0 },
    tr = { s: -Infinity, x: 0, y: 0 },
    bl = { s: Infinity, x: 0, y: 0 };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      const a = x + y;
      const d = x - y;
      if (a < tl.s) tl = { s: a, x, y };
      if (a > br.s) br = { s: a, x, y };
      if (d > tr.s) tr = { s: d, x, y };
      if (d < bl.s) bl = { s: d, x, y };
    }
  // Pull the corners slightly inwards so no background shows along the edges.
  const cx = (tl.x + tr.x + br.x + bl.x) / 4;
  const cy = (tl.y + tr.y + br.y + bl.y) / 4;
  const f = (p: { x: number; y: number }) => {
    const x = p.x + (cx - p.x) * 0.012;
    const y = p.y + (cy - p.y) * 0.012;
    return { x: Math.min(1, Math.max(0, x / (w - 1))), y: Math.min(1, Math.max(0, y / (h - 1))) };
  };
  return [f(tl), f(tr), f(br), f(bl)];
}

/** Solves the 3×3 homography that maps the unit square's corners onto `quad` (in pixels). */
function homography(quad: Point[]): number[] {
  const [p0, p1, p2, p3] = quad;
  const dx1 = p1.x - p2.x,
    dx2 = p3.x - p2.x,
    dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y,
    dy2 = p3.y - p2.y,
    dy3 = p0.y - p1.y + p2.y - p3.y;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / det;
  const hh = (dx1 * dy3 - dx3 * dy1) / det;
  return [p1.x - p0.x + g * p1.x, p3.x - p0.x + hh * p3.x, p0.x, p1.y - p0.y + g * p1.y, p3.y - p0.y + hh * p3.y, p0.y, g, hh, 1];
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Straightens the page inside `quad` into a flat rectangle. */
export function warp(src: HTMLCanvasElement, quad: Quad, maxSide = 2600): HTMLCanvasElement {
  const W = src.width,
    H = src.height;
  const px = quad.map((p) => ({ x: p.x * (W - 1), y: p.y * (H - 1) }));
  let ow = (dist(px[0], px[1]) + dist(px[3], px[2])) / 2;
  let oh = (dist(px[0], px[3]) + dist(px[1], px[2])) / 2;
  const s = Math.min(1, maxSide / Math.max(ow, oh));
  ow = Math.max(1, Math.round(ow * s));
  oh = Math.max(1, Math.round(oh * s));
  const m = homography(px);
  const sctx = src.getContext("2d", { willReadFrequently: true })!;
  const sd = sctx.getImageData(0, 0, W, H).data;
  const out = canvasOf(ow, oh);
  const octx = out.getContext("2d")!;
  const img = octx.createImageData(ow, oh);
  const od = img.data;
  for (let y = 0; y < oh; y++) {
    const v = y / (oh - 1 || 1);
    for (let x = 0; x < ow; x++) {
      const u = x / (ow - 1 || 1);
      const z = m[6] * u + m[7] * v + 1;
      const sx = (m[0] * u + m[1] * v + m[2]) / z;
      const sy = (m[3] * u + m[4] * v + m[5]) / z;
      // Bilinear sampling.
      const x0 = Math.min(W - 2, Math.max(0, sx | 0));
      const y0 = Math.min(H - 2, Math.max(0, sy | 0));
      const fx = Math.min(1, Math.max(0, sx - x0));
      const fy = Math.min(1, Math.max(0, sy - y0));
      const i00 = (y0 * W + x0) * 4,
        i10 = i00 + 4,
        i01 = i00 + W * 4,
        i11 = i01 + 4;
      const o = (y * ow + x) * 4;
      for (let c = 0; c < 3; c++) {
        const top = sd[i00 + c] + (sd[i10 + c] - sd[i00 + c]) * fx;
        const bot = sd[i01 + c] + (sd[i11 + c] - sd[i01 + c]) * fx;
        od[o + c] = top + (bot - top) * fy;
      }
      od[o + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

/** Scanner looks: auto levels (enhance), grayscale, or clean black and white. */
export function applyFilter(canvas: HTMLCanvasElement, filter: ScanFilter): HTMLCanvasElement {
  if (filter === "original") return canvas;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const n = w * h;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) lum[i] = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114;

  if (filter === "bw") {
    // Adaptive threshold against the local mean (integral image), so shadows don't turn black.
    const integral = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) {
        row += lum[y * w + x];
        integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row;
      }
    }
    const r = Math.max(8, Math.round(Math.max(w, h) / 40));
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r),
        y1 = Math.min(h, y + r + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r),
          x1 = Math.min(w, x + r + 1);
        const area = (x1 - x0) * (y1 - y0);
        const mean = (integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0]) / area;
        const v = lum[y * w + x] < mean * 0.86 ? 0 : 255;
        const o = (y * w + x) * 4;
        d[o] = d[o + 1] = d[o + 2] = v;
      }
    }
  } else {
    // Stretch levels between the 1st and 99th percentile, whiten the paper.
    const hist = new Uint32Array(256);
    for (let i = 0; i < n; i++) hist[lum[i] | 0]++;
    let lo = 0,
      hi = 255,
      acc = 0;
    for (let i = 0; i < 256; i++) if ((acc += hist[i]) > n * 0.01) { lo = i; break; }
    acc = 0;
    for (let i = 255; i >= 0; i--) if ((acc += hist[i]) > n * 0.05) { hi = i; break; }
    const span = Math.max(30, hi - lo);
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      if (filter === "gray") {
        const v = Math.min(255, Math.max(0, ((lum[i] - lo) / span) * 255));
        d[o] = d[o + 1] = d[o + 2] = v;
      } else {
        for (let c = 0; c < 3; c++) d[o + c] = Math.min(255, Math.max(0, ((d[o + c] - lo) / span) * 255));
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Draws a bitmap into a canvas at most `maxSide` pixels long. */
export function fit(bitmap: ImageBitmap, maxSide: number, rotation = 0): HTMLCanvasElement {
  const s = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * s);
  const h = Math.round(bitmap.height * s);
  const turned = rotation % 180 !== 0;
  const c = canvasOf(turned ? h : w, turned ? w : h);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
  return c;
}

export function canvasBlob(c: HTMLCanvasElement, type = "image/jpeg", quality = 0.9) {
  return toBlob(c, type === "image/png" ? "png" : "jpeg", quality);
}
