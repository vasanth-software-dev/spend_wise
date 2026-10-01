/**
 * Part 1/3: types + paper segmentation.
 * Lightweight receipt detection on downscaled frames (no OCR here).
 * Swap `detectDocumentQuad` for OpenCV.js later without touching callers.
 */

export interface Point { x: number; y: number; }

export type DetectionGuidance =
  | 'NO_RECEIPT' | 'MOVE_CLOSER' | 'MOVE_FARTHER' | 'CENTER_RECEIPT'
  | 'LOW_LIGHT' | 'BLURRY' | 'HOLD_STEADY' | 'READY';

export interface ReceiptDetectionResult {
  quad: Point[] | null;
  coverage: number;
  fillRatio: number;
  brightness: number;
  sharpness: number;
  stability: number;
  insideFrame: boolean;
  guidance: DetectionGuidance;
}

export interface DetectionTuning {
  minCoverage: number; maxCoverage: number; minBrightness: number;
  minSharpness: number; stableThreshold: number;
}

export const DEFAULT_TUNING: DetectionTuning = {
  minCoverage: 0.12, maxCoverage: 0.92, minBrightness: 45,
  minSharpness: 0.02, stableThreshold: 0.92,
};

export const GUIDE_RECT = { x: 0.12, y: 0.14, w: 0.76, h: 0.62 };

function luminanceAt(d: Uint8ClampedArray, i: number): number {
  return (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
}

/** Bright, low-saturation pixels = paper. No ML model needed. */
export function paperMask(data: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  for (let p = 0, i = 0; p < mask.length; p += 1, i += 4) {
    const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
    const lum = luminanceAt(data, i);
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    if (lum > 110 && sat < 60) mask[p] = 1;
  }
  return mask;
}
/** Bounding quad of largest paper blob (axis-aligned approx). Null = no receipt. */
export function detectDocumentQuad(m: Uint8Array, w: number, h: number): Point[] | null {
  let minX = w; let maxX = -1; let minY = h; let maxY = -1; let n = 0;
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    if (!m[y * w + x]) continue; n += 1;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (n / m.length < 0.04) return null;
  if (maxX - minX + 1 < w * 0.15 || maxY - minY + 1 < h * 0.15) return null;
  return [
    { x: minX / w, y: minY / h }, { x: maxX / w, y: minY / h },
    { x: maxX / w, y: maxY / h }, { x: minX / w, y: maxY / h },
  ];
}

function sobelDensity(g: Float32Array, w: number, h: number): number {
  let e = 0; let c = 0;
  for (let y = 1; y < h - 1; y += 2) for (let x = 1; x < w - 1; x += 2) {
    const gx = -g[(y-1)*w+x-1] - 2*g[y*w+x-1] - g[(y+1)*w+x-1]
      + g[(y-1)*w+x+1] + 2*g[y*w+x+1] + g[(y+1)*w+x+1];
    const gy = -g[(y-1)*w+x-1] - 2*g[(y-1)*w+x] - g[(y-1)*w+x+1]
      + g[(y+1)*w+x-1] + 2*g[(y+1)*w+x] + g[(y+1)*w+x+1];
    if (Math.abs(gx) + Math.abs(gy) > 90) e += 1; c += 1;
  }
  return c === 0 ? 0 : e / c;
}

function guideFill(m: Uint8Array, w: number, h: number): number {
  const x0 = Math.floor(GUIDE_RECT.x * w); const y0 = Math.floor(GUIDE_RECT.y * h);
  const x1 = Math.floor((GUIDE_RECT.x + GUIDE_RECT.w) * w);
  const y1 = Math.floor((GUIDE_RECT.y + GUIDE_RECT.h) * h);
  let paper = 0; let total = 0;
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) {
    total += 1; if (m[y * w + x]) paper += 1;
  }
  return total === 0 ? 0 : paper / total;
}

function quadInsideGuide(quad: Point[] | null): boolean {
  if (!quad) return false;
  const tolerance = 0.02;
  return quad.every((point) =>
    point.x >= GUIDE_RECT.x - tolerance &&
    point.x <= GUIDE_RECT.x + GUIDE_RECT.w + tolerance &&
    point.y >= GUIDE_RECT.y - tolerance &&
    point.y <= GUIDE_RECT.y + GUIDE_RECT.h + tolerance
  );
}

export interface FrameAnalysis extends ReceiptDetectionResult { gray: Float32Array; }

export function analyzeFrame(
  data: Uint8ClampedArray, w: number, h: number,
  prev: Float32Array | null, t: DetectionTuning = DEFAULT_TUNING,
): FrameAnalysis {
  const n = w * h; const gray = new Float32Array(n);
  let bright = 0;
  for (let p = 0, i = 0; p < n; p += 1, i += 4) {
    const l = luminanceAt(data, i); gray[p] = l; bright += l;
  }
  bright /= n;
  const mask = paperMask(data, w, h);
  let pp = 0; for (let k = 0; k < n; k += 1) pp += mask[k];
  const coverage = pp / n; const fill = guideFill(mask, w, h);
  const sharp = sobelDensity(gray, w, h);
  let stab = 1;
  if (prev && prev.length === n) {
    let d = 0; for (let p = 0; p < n; p += 4) d += Math.abs(gray[p] - prev[p]);
    stab = Math.max(0, Math.min(1, 1 - (d / (n / 4)) / 28));
  }
  const quad = detectDocumentQuad(mask, w, h);
  const inside = quadInsideGuide(quad) && fill > 0.35 && fill < 0.98;
  let g: DetectionGuidance = 'NO_RECEIPT';
  if (bright < t.minBrightness) g = 'LOW_LIGHT';
  else if (coverage < t.minCoverage || quad === null) g = 'NO_RECEIPT';
  else if (sharp < t.minSharpness) g = 'BLURRY';
  else if (fill < 0.35) g = 'MOVE_CLOSER';
  else if (fill > 0.97 || coverage > t.maxCoverage) g = 'MOVE_FARTHER';
  else if (!inside) g = 'CENTER_RECEIPT';
  else if (stab < t.stableThreshold) g = 'HOLD_STEADY';
  else g = 'READY';
  return { quad, coverage, fillRatio: fill, brightness: bright,
    sharpness: sharp, stability: stab, insideFrame: inside, guidance: g, gray };
}

export const GUIDANCE_COPY: Record<DetectionGuidance, string> = {
  NO_RECEIPT: 'Point at the receipt', MOVE_CLOSER: 'Move closer',
  MOVE_FARTHER: 'Move farther away', CENTER_RECEIPT: 'Center the receipt',
  LOW_LIGHT: 'Too dark — add light', BLURRY: 'Hold still — blurry',
  HOLD_STEADY: 'Hold steady…', READY: 'Receipt detected',
};

export function guidanceTone(g: DetectionGuidance): 'idle' | 'warn' | 'good' {
  if (g === 'READY' || g === 'HOLD_STEADY') return 'good';
  if (g === 'NO_RECEIPT') return 'idle'; return 'warn';
}
