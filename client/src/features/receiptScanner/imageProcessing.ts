import { createOCRError } from './types.js';
import { looksLikeImage } from './imageValidation.js';
import { preprocessImage, type PreprocessedImage } from './imagePreprocessing.js';
import type { Point } from './receiptDetection.js';

/**
 * Capture-time image processing. Reuses `preprocessImage` (EXIF orientation,
 * downscale, contrast) as the single source of truth, adding optional
 * crop-to-guide and quad perspective correction for live captures.
 */

/** Crop the center guide rect out of a captured file (fallback when no quad). */
export async function cropToGuide(file: File): Promise<File> {
  const bitmap = await loadSource(file);
  try {
    const w = dims(bitmap).width; const h = dims(bitmap).height;
    const gx = Math.floor(w * 0.12); const gy = Math.floor(h * 0.14);
    const gw = Math.floor(w * 0.76); const gh = Math.floor(h * 0.62);
    if (gw < 50 || gh < 50) return file;
    const canvas = document.createElement('canvas');
    canvas.width = gw; canvas.height = gh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap as CanvasImageSource, gx, gy, gw, gh, 0, 0, gw, gh);
    const blob = await toBlob(canvas, 0.92);
    return new File([blob], 'receipt-capture.jpg', { type: 'image/jpeg' });
  } finally {
    closeSrc(bitmap);
  }
}

/** Perspective-correct a quad (normalised 0..1) to a straight rectangle. */
export async function perspectiveCorrect(file: File, quad: Point[]): Promise<File> {
  try {
    const bitmap = await loadSource(file);
    try {
      const { width, height } = dims(bitmap);
      const scale = Math.min(1, 2200 / Math.max(width, height));
      const w = Math.max(1, Math.round(width * scale));
      const h = Math.max(1, Math.round(height * scale));
      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = w;
      sourceCanvas.height = h;
      const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
      if (!sourceContext) return file;
      sourceContext.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
      const source = sourceContext.getImageData(0, 0, w, h);

      const pts = quad.map((p) => ({ x: p.x * w, y: p.y * h }));
      const topW = dist(pts[0], pts[1]); const botW = dist(pts[3], pts[2]);
      const leftH = dist(pts[0], pts[3]); const rightH = dist(pts[1], pts[2]);
      const outW = Math.min(1600, Math.max(400, Math.round(Math.max(topW, botW))));
      const outH = Math.min(2200, Math.max(400, Math.round(Math.max(leftH, rightH))));
      const transform = solvePerspectiveTransform(pts);
      const canvas = document.createElement('canvas');
      canvas.width = outW; canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      const output = ctx.createImageData(outW, outH);
      for (let y = 0; y < outH; y += 1) {
        const v = y / (outH - 1);
        for (let x = 0; x < outW; x += 1) {
          const u = x / (outW - 1);
          const denominator = transform.g * u + transform.h * v + 1;
          const sourceX = (transform.a * u + transform.b * v + transform.c) / denominator;
          const sourceY = (transform.d * u + transform.e * v + transform.f) / denominator;
          writeInterpolatedPixel(source.data, w, h, output.data, (y * outW + x) * 4, sourceX, sourceY);
        }
      }
      ctx.putImageData(output, 0, 0);
      const blob = await toBlob(canvas, 0.92);
      return new File([blob], 'receipt-capture.jpg', { type: 'image/jpeg' });
    } finally {
      closeSrc(bitmap);
    }
  } catch {
    return file; // correction is best-effort; original is always usable
  }
}

/** Full capture pipeline: correct -> crop -> existing preprocess. */
export async function processCapturedImage(
  file: File, quad: Point[] | null,
): Promise<{ file: File; preprocessed: PreprocessedImage }> {
  let working = file;
  if (quad) {
    const corrected = await perspectiveCorrect(working, quad);
    if (corrected !== working) working = corrected;
  } else {
    working = await cropToGuide(working);
  }
  const header = new Uint8Array(await working.slice(0, 16).arrayBuffer());
  if (!looksLikeImage(header)) throw createOCRError('PREPROCESS_FAILED', 'The capture could not be read.');
  const preprocessed = await preprocessImage(working, { quality: 0.92 });
  return { file: working, preprocessed };
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function dist(a: Point, b: Point): number { return Math.hypot(b.x - a.x, b.y - a.y); }

interface PerspectiveTransform {
  a: number; b: number; c: number; d: number;
  e: number; f: number; g: number; h: number;
}

function solvePerspectiveTransform(points: Point[]): PerspectiveTransform {
  const destinations = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const matrix: number[][] = [];
  points.forEach((point, index) => {
    const [u, v] = destinations[index];
    matrix.push([u, v, 1, 0, 0, 0, -point.x * u, -point.x * v, point.x]);
    matrix.push([0, 0, 0, u, v, 1, -point.y * u, -point.y * v, point.y]);
  });

  for (let column = 0; column < 8; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 8; row += 1) {
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
    }
    if (Math.abs(matrix[pivot][column]) < 1e-8) throw new Error('Invalid receipt corners.');
    [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
    const divisor = matrix[column][column];
    for (let j = column; j <= 8; j += 1) matrix[column][j] /= divisor;
    for (let row = 0; row < 8; row += 1) {
      if (row === column) continue;
      const factor = matrix[row][column];
      for (let j = column; j <= 8; j += 1) matrix[row][j] -= factor * matrix[column][j];
    }
  }

  const [a, b, c, d, e, f, g, h] = matrix.map((row) => row[8]);
  return { a, b, c, d, e, f, g, h };
}

function writeInterpolatedPixel(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  target: Uint8ClampedArray,
  targetIndex: number,
  x: number,
  y: number,
): void {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= width - 1 || y >= height - 1) {
    target[targetIndex + 3] = 255;
    return;
  }
  const x0 = Math.floor(x); const y0 = Math.floor(y);
  const dx = x - x0; const dy = y - y0;
  const topLeft = (y0 * width + x0) * 4;
  const topRight = topLeft + 4;
  const bottomLeft = topLeft + width * 4;
  const bottomRight = bottomLeft + 4;
  for (let channel = 0; channel < 3; channel += 1) {
    const top = lerp(source[topLeft + channel], source[topRight + channel], dx);
    const bottom = lerp(source[bottomLeft + channel], source[bottomRight + channel], dx);
    target[targetIndex + channel] = lerp(top, bottom, dy);
  }
  target[targetIndex + 3] = 255;
}

async function loadSource(f: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(f, { imageOrientation: 'from-image' }); } catch { /* fallthrough */ }
  }
  const url = URL.createObjectURL(f);
  try {
    return await new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image();
      img.onload = () => res(img); img.onerror = () => rej(new Error('decode'));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function dims(s: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  return 'naturalWidth' in s ? { width: s.naturalWidth, height: s.naturalHeight } : { width: s.width, height: s.height };
}
function closeSrc(s: ImageBitmap | HTMLImageElement): void {
  if ('close' in s && typeof s.close === 'function') s.close();
}
function toBlob(c: HTMLCanvasElement, q: number): Promise<Blob> {
  return new Promise((res, rej) => {
    c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', q);
  });
}
