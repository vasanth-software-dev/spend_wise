import { api } from '../../../services/api.js';
import { createOCRError, OCRService, OCRTextResult } from '../types.js';

/**
 * Optional server-side OCR provider.
 *
 * The client is not wired to any SpendWise image endpoint today, so this
 * provider is intentionally inert: `isAvailable()` returns false and the scanner
 * silently stays on the on-device engine. It exists so the abstraction is proven
 * out ahead of time — if a self-hosted Tesseract or OCR.space endpoint is added
 * later, only this file and the server route need to change, and the scanner UI
 * is untouched.
 *
 * The contract this provider will honour once enabled:
 *  - accepts the preprocessed image, not the user's original file
 *  - the server holds it only in memory for the duration of the request
 *  - nothing is written to disk, object storage or the database
 *  - the request is authenticated and ownership-scoped
 *  - the response contains text only, never the image
 */
export class ServerOCRService implements OCRService {
  readonly id = 'server';
  readonly label = 'Server OCR (optional)';

  private readonly endpoint: string | null;
  private enabled: boolean;

  constructor(endpoint: string | null = null) {
    this.endpoint = endpoint;
    this.enabled = !!endpoint;
  }

  isAvailable(): boolean {
    return this.enabled && !!this.endpoint;
  }

  async recognize(image: Blob, onProgress?: (progress: { percent: number | null; status: string }) => void): Promise<OCRTextResult> {
    if (!this.endpoint) {
      throw createOCRError('ENGINE_UNAVAILABLE', 'Server OCR is not configured.');
    }

    onProgress?.({ percent: null, status: 'Uploading for processing' });

    let response;
    try {
      const form = new FormData();
      // Re-encoded temporary copy, never the original file from the device.
      form.append('image', image, 'receipt-scan.jpg');
      response = await api.post(this.endpoint, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch (error: any) {
      const status = error?.response?.status;
      if (status && status >= 400 && status < 500) {
        throw createOCRError('ENGINE_FAILED', error?.response?.data?.message || 'Server OCR rejected the image.');
      }
      throw createOCRError('NETWORK_ERROR', 'Could not reach server OCR. Try on-device OCR instead.');
    }

    const text = response?.data?.data?.text;
    if (typeof text !== 'string') {
      throw createOCRError('ENGINE_FAILED', 'Server OCR returned an unexpected response.');
    }

    return {
      text,
      confidence:
        typeof response?.data?.data?.confidence === 'number' ? response.data.data.confidence : null,
      rotationDegrees: null,
    };
  }

  async dispose(): Promise<void> {
    // No engine resources held on the client for this provider.
  }
}
