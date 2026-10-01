import { createOCRError, OCRService, OCRError, OCRTextResult } from '../types.js';
import { LocalOCRService } from './LocalOCRService.js';
import { ServerOCRService } from './ServerOCRService.js';
import { OptionalAIProvider } from './OptionalAIProvider.js';

/**
 * Registry and fallback chain for OCR providers.
 *
 * This is the only module the scanner UI knows about. It hands back an ordered
 * list of providers, and `recognizeWithFallback` walks it until one succeeds.
 * With nothing configured the chain is just the on-device engine, so the
 * feature works at zero cost and the app never depends on an external service
 * being reachable.
 */
export interface OCRProviderConfig {
  /** Optional self-hosted server OCR path, e.g. '/receipt-scan/ocr'. */
  serverEndpoint?: string | null;
}

export function createOCRProviders(config: OCRProviderConfig = {}): OCRService[] {
  return [
    new LocalOCRService(),
    new ServerOCRService(config.serverEndpoint ?? null),
    new OptionalAIProvider(),
  ];
}

/** The first available provider, which is the one the scanner uses by default. */
export function getDefaultOCRService(config: OCRProviderConfig = {}): OCRService {
  const provider = createOCRProviders(config).find((service) => service.isAvailable());
  if (!provider) {
    throw createOCRError('ENGINE_UNAVAILABLE', 'No OCR engine is available on this device.');
  }
  return provider;
}

export interface RecognizeWithFallbackOptions {
  onProgress?: (progress: { percent: number | null; status: string }) => void;
  signal?: AbortSignal;
}

/**
 * Tries each provider in order and returns the first successful result.
 *
 * A provider only fails the chain on an engine problem. `CANCELLED` propagates
 * immediately, because a user cancelling should not fall through to another
 * engine and keep burning CPU.
 */
export async function recognizeWithFallback(
  providers: OCRService[],
  image: Blob,
  options: RecognizeWithFallbackOptions = {}
): Promise<{ provider: OCRService; result: OCRTextResult }> {
  const available = providers.filter((provider) => provider.isAvailable());

  if (available.length === 0) {
    throw createOCRError('ENGINE_UNAVAILABLE', 'No OCR engine is available on this device.');
  }

  let lastError: OCRError | null = null;

  for (const provider of available) {
    if (options.signal?.aborted) {
      throw createOCRError('CANCELLED', 'Scan cancelled.');
    }

    try {
      const result = await provider.recognize(image, options.onProgress, options.signal);
      if (result.text.trim().length > 0) {
        return { provider, result };
      }
      lastError = createOCRError('NO_TEXT_FOUND', "We couldn't read this ticket clearly.");
    } catch (error) {
      const ocrError = error as OCRError;
      if (ocrError.code === 'CANCELLED') {
        throw ocrError;
      }
      lastError = ocrError;
    }
  }

  throw lastError || createOCRError('NO_TEXT_FOUND', "We couldn't read this ticket clearly.");
}

/** Releases every provider's engine resources. */
export async function disposeOCRProviders(providers: OCRService[]): Promise<void> {
  await Promise.all(
    providers.map(async (provider) => {
      try {
        await provider.dispose();
      } catch {
        // Disposal is best-effort cleanup and must never surface to the user.
      }
    })
  );
}

export { LocalOCRService, ServerOCRService, OptionalAIProvider };
