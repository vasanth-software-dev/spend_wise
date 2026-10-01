import { createOCRError, OCRService, OCRTextResult } from '../types.js';

/**
 * Placeholder for a future vision/AI extraction provider.
 *
 * Deliberately not implemented and not required. When someone later wants
 * vision extraction (better on crumpled thermal paper, handwriting, or regional
 * languages), this is the single seam where a provider gets added. The scanner
 * UI, the review screen and the transaction write path do not change, because
 * they only ever talk to `OCRService`.
 *
 * Two hard rules for any future implementation of this interface:
 *  1. It must be opt-in per user. Receipts contain names, partial card digits
 *     and shop addresses, so nothing leaves the device without explicit consent.
 *  2. It must degrade to the on-device engine on any error or absence of an API
 *     key. The app has to stay fully functional with it switched off.
 */
export class OptionalAIProvider implements OCRService {
  readonly id = 'ai';
  readonly label = 'AI extraction (optional)';

  isAvailable(): boolean {
    return false;
  }

  async recognize(): Promise<OCRTextResult> {
    throw createOCRError(
      'ENGINE_UNAVAILABLE',
      'AI extraction is not enabled. On-device OCR is used instead.'
    );
  }

  async dispose(): Promise<void> {
    // Nothing to release.
  }
}
