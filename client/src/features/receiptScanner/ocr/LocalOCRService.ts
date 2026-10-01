import { createOCRError, OCRService, OCRError, OCRProgress, OCRTextResult } from '../types.js';

/**
 * Browser-side OCR via Tesseract.js (Apache-2.0, runs fully in a Web Worker).
 *
 * This is the default and only required provider: no API key, no per-scan cost,
 * and the image bytes never leave the device. The wasm core and the `eng`
 * language model are fetched once and cached by the browser, so there is no
 * hosting cost either.
 */
export class LocalOCRService implements OCRService {
  readonly id = 'local';
  readonly label = 'On-device OCR (Tesseract.js)';

  private worker: any = null;
  private workerPromise: Promise<any> | null = null;
  private disposed = false;

  isAvailable(): boolean {
    return !this.disposed && typeof window !== 'undefined' && typeof Worker !== 'undefined';
  }

  /**
   * Lazily creates the worker. Tesseract.js is imported dynamically so its wasm
   * and language data are only downloaded when the user actually scans, keeping
   * the initial bundle small.
   */
  private async getWorker(onProgress?: (progress: OCRProgress) => void): Promise<any> {
    if (this.worker) return this.worker;
    if (this.disposed) throw createOCRError('ENGINE_UNAVAILABLE', 'The scanner was closed.');

    if (!this.workerPromise) {
      this.workerPromise = (async () => {
        try {
          const Tesseract = await import('tesseract.js');
          const worker = await Tesseract.createWorker('eng', undefined, {
            logger: (message: { status: string; progress: number }) => {
              onProgress?.({ percent: Math.round(message.progress * 100), status: message.status });
            },
            errorHandler: (error: unknown) => {
              // Engine-level faults are re-thrown from recognize(); this only
              // keeps them from being silently swallowed.
              onProgress?.({
                percent: null,
                status: error instanceof Error ? error.message : 'Engine error',
              });
            },
          });

          // A single dense text block matches small paper receipts and tickets
          // far better than Tesseract's default page segmentation.
          // Tesseract expects its PSM enum, not the raw string, and the
          // `.d.ts` shipped with v7 types this field as a const enum that is not
          // structurally assignable from a string literal.
          const SINGLE_BLOCK = 6;
          await worker.setParameters({
            tessedit_pageseg_mode: SINGLE_BLOCK as any,
            preserve_interword_spaces: '1',
          });

          this.worker = worker;
          return worker;
        } catch (error) {
          this.workerPromise = null;
          const message = error instanceof Error ? error.message : 'Unknown error';
          throw createOCRError('ENGINE_UNAVAILABLE', `On-device OCR could not start: ${message}`);
        }
      })();
    }

    return this.workerPromise;
  }

  async recognize(
    image: Blob,
    onProgress?: (progress: OCRProgress) => void,
    signal?: AbortSignal
  ): Promise<OCRTextResult> {
    let worker: any;
    try {
      worker = await this.getWorker(onProgress);
    } catch (error) {
      throw error as OCRError;
    }

    if (signal?.aborted) {
      throw createOCRError('CANCELLED', 'Scan cancelled.');
    }

    try {
      onProgress?.({ percent: null, status: 'Reading text' });

      // `rotateAuto` corrects sideways phone photos on-device before layout
      // analysis, which is what makes handheld captures usable.
      const result = await worker.recognize(image, {}, { text: true });
      onProgress?.({ percent: 100, status: 'Reading text' });

      const data = result?.data || {};
      const text = typeof data.text === 'string' ? data.text : '';
      const confidence = typeof data.confidence === 'number' ? data.confidence : null;

      return { text, confidence, rotationDegrees: readRotation(data) };
    } catch (error) {
      if (signal?.aborted) {
        throw createOCRError('CANCELLED', 'Scan cancelled.');
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw createOCRError('ENGINE_FAILED', `On-device OCR failed: ${message}`);
    }
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    const worker = this.worker;
    this.worker = null;
    this.workerPromise = null;
    if (worker && typeof worker.terminate === 'function') {
      try {
        await worker.terminate();
      } catch {
        // Terminating an already-dead worker is not an error worth surfacing.
      }
    }
  }
}

/**
 * Tesseract reports the rotation it needed as radians. This is a hint used to
 * straighten the image during preprocessing, never applied after OCR.
 */
function readRotation(data: any): number | null {
  if (typeof data?.rotateRadians !== 'number' || !Number.isFinite(data.rotateRadians)) {
    return null;
  }
  const degrees = Math.round((data.rotateRadians * 180) / Math.PI);
  const normalized = ((degrees % 360) + 360) % 360;
  return normalized === 0 ? null : normalized;
}
