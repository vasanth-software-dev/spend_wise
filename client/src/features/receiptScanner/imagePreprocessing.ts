import { createOCRError } from './types.js';
import { looksLikeImage } from './imageValidation.js';

/**
 * Longest edge handed to OCR. Thermal receipts are small, phone photos are not;
 * beyond this, extra pixels only slow recognition down without improving reads.
 */
export const MAX_OCR_EDGE = 1800;

/** Below this the image is too small to contain a readable receipt. */
const MIN_EDGE = 200;

export interface PreprocessedImage {
  /** Re-encoded JPEG used only for OCR, created in memory. */
  blob: Blob;
  /** Object URL for the temporary preview; caller must revoke it. */
  previewUrl: string;
  width: number;
  height: number;
  /** Rotation actually applied, for diagnostics. */
  appliedRotation: number;
}

/**
 * Loads a file into a bitmap, honouring the EXIF orientation the browser
 * reports so a sideways phone photo is not OCR'd as garbage.
 */
async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // `imageOrientation: 'from-image'` applies EXIF rotation at decode time.
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // HEIC and a few older Safari builds fail here; fall through to <img>.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('The image could not be decoded.'));
      image.src = objectUrl;
    });
  } finally {
    // The decoded <img> no longer needs the file handle once loaded.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}

function getDimensions(source: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  if ('naturalWidth' in source) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.width, height: source.height };
}

function closeSource(source: ImageBitmap | HTMLImageElement): void {
  if ('close' in source && typeof source.close === 'function') {
    source.close();
  }
}

export interface PreprocessOptions {
  /** Rotation hint from a previous OCR pass, in degrees. */
  rotationDegrees?: number | null;
  /** JPEG quality for the temporary OCR copy. */
  quality?: number;
}

/**
 * Produces an OCR-ready copy of the image entirely on the device.
 *
 * Steps: decode with EXIF orientation, downscale large captures, rotate if the
 * engine asked for it, then apply a light grayscale + contrast stretch that
 * measurably helps thermal and faded print. The user's original file is never
 * modified and the result exists only as an in-memory blob plus a preview URL
 * that the caller revokes when the scan ends.
 */
export async function preprocessImage(
  file: File,
  options: PreprocessOptions = {}
): Promise<PreprocessedImage> {
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!looksLikeImage(header)) {
    throw createOCRError('UNSUPPORTED_FILE', 'That file is not a readable image.');
  }

  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await loadBitmap(file);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw createOCRError('PREPROCESS_FAILED', `This photo could not be prepared for scanning: ${message}`);
  }

  try {
    const { width, height } = getDimensions(source);
    if (!width || !height) {
      throw createOCRError('PREPROCESS_FAILED', 'This photo has no readable content.');
    }

    const longestEdge = Math.max(width, height);
    if (longestEdge < MIN_EDGE) {
      throw createOCRError(
        'PREPROCESS_FAILED',
        'This photo is too small to scan. Try again closer to the ticket.'
      );
    }

    const scale = longestEdge > MAX_OCR_EDGE ? MAX_OCR_EDGE / longestEdge : 1;
    const baseWidth = Math.max(1, Math.round(width * scale));
    const baseHeight = Math.max(1, Math.round(height * scale));

    const rotation = normalizeRotation(options.rotationDegrees);
    const swapAxes = rotation === 90 || rotation === 270;

    const canvas = document.createElement('canvas');
    canvas.width = swapAxes ? baseHeight : baseWidth;
    canvas.height = swapAxes ? baseWidth : baseHeight;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw createOCRError('PREPROCESS_FAILED', 'This browser cannot prepare images for scanning.');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Rotate about the canvas centre. After the rotation the scaled image's own
    // axes are swapped for quarter turns, which is handled by drawing it with a
    // vertical flip so the text stays upright.
    context.translate(canvas.width / 2, canvas.height / 2);
    if (rotation !== 0) {
      context.rotate((rotation * Math.PI) / 180);
    }
    if (swapAxes) {
      context.scale(1, -1);
    }
    context.drawImage(
      source as CanvasImageSource,
      -baseWidth / 2,
      -baseHeight / 2,
      baseWidth,
      baseHeight
    );

    const contrastCanvas = document.createElement('canvas');
    contrastCanvas.width = canvas.width;
    contrastCanvas.height = canvas.height;
    const contrastContext = contrastCanvas.getContext('2d', { willReadFrequently: true });
    if (contrastContext) {
      contrastContext.drawImage(canvas, 0, 0);
      applyContrastStretch(contrastContext, contrastCanvas.width, contrastCanvas.height);
    }

    const blob = await canvasToBlob(contrastContext ? contrastCanvas : canvas, options.quality ?? 0.92);

    return {
      blob,
      previewUrl: URL.createObjectURL(blob),
      width: contrastCanvas.width,
      height: contrastCanvas.height,
      appliedRotation: rotation,
    };
  } finally {
    closeSource(source);
  }
}

function normalizeRotation(degrees?: number | null): number {
  if (typeof degrees !== 'number' || !Number.isFinite(degrees)) return 0;
  const normalized = ((Math.round(degrees / 90) * 90) % 360 + 360) % 360;
  // Only true quarter turns are corrected; anything else is left alone because
  // guessing an angle would distort the text more than it helps.
  return normalized === 90 || normalized === 180 || normalized === 270 ? normalized : 0;
}

/**
 * Grayscale plus a gentle contrast stretch.
 *
 * Thermal receipts are low-contrast and faded, and OCR accuracy tracks contrast
 * far more than resolution, so this is the highest-value local improvement.
 */
function applyContrastStretch(
  context: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  try {
    const imageData = context.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    const pixelCount = pixels.length / 4;
    const luminance = new Uint8ClampedArray(pixelCount);

    let min = 255;
    let max = 0;

    for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
      // Rec. 601 luma, matching what the engine sees after its own grayscale
      // pass, so the histogram describes the text rather than the paper tint.
      const value = (pixels[i] * 299 + pixels[i + 1] * 587 + pixels[i + 2] * 114) / 1000;
      luminance[p] = value;
      if (value < min) min = value;
      if (value > max) max = value;
    }

    const range = max - min;
    // Below this spread the image is already high contrast and stretching would
    // only add noise.
    const stretch = range > 40;

    for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
      let value = luminance[p];
      if (stretch) {
        // Pull paper towards white and ink towards black without crushing
        // genuinely mid-tone content.
        value = ((value - min) / range) * 235 + 20;
      }
      const clamped = value < 0 ? 0 : value > 255 ? 255 : value;
      pixels[i] = clamped;
      pixels[i + 1] = clamped;
      pixels[i + 2] = clamped;
    }

    context.putImageData(imageData, 0, 0);
  } catch {
    // A tainted or zero-size canvas just means the enhancement is skipped; the
    // unprocessed image is still perfectly scannable.
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Encoding failed'))),
      'image/jpeg',
      quality
    );
  });
}
