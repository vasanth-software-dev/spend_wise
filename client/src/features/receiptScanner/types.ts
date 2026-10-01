import type { PaymentMethod } from '../../types/index.js';

/**
 * Field-level confidence for a scanned receipt, expressed 0-100.
 *
 * These scores are the safety mechanism for the whole feature: the review screen
 * uses them to decide which fields must be typed by the user rather than
 * pre-filled. A missing or low-confidence field is shown empty instead of being
 * guessed, because an invented amount, date or merchant is worse than no value.
 */
export interface ReceiptFieldConfidence {
  merchant: number;
  amount: number;
  date: number;
  category: number;
}

/**
 * A single OCR attempt's result. This structure is intentionally transient: it
 * lives in component state for the duration of the review screen and is
 * discarded when the user confirms, cancels or scans again. It is never sent to
 * the server and never persisted.
 */
export interface ExtractedReceiptData {
  merchant: string | null;
  amount: number | null;
  /** ISO `YYYY-MM-DD` date, or null when no date could be read. */
  date: string | null;
  /** 24h `HH:mm`, or null. */
  time: string | null;
  category: string | null;
  description: string | null;
  currency: string | null;
  paymentMethod: PaymentMethod | null;
  ticketNumber: string | null;
  location: string | null;
  confidence: ReceiptFieldConfidence;
}

/** Raw text plus layout hints coming out of an OCR engine. */
export interface OCRTextResult {
  text: string;
  /** Mean engine confidence 0-100, when the engine reports one. */
  confidence: number | null;
  /** Rotation the engine believes the page needs, in degrees. */
  rotationDegrees: number | null;
}

export interface OCRProgress {
  /** 0-100 where known, otherwise null for indeterminate progress. */
  percent: number | null;
  status: string;
}

export interface OCRError extends Error {
  /** Stable code so the UI can pick the right message and recovery action. */
  code?: OCRFailureCode;
}

export type OCRFailureCode =
  | 'UNSUPPORTED_FILE'
  | 'FILE_TOO_LARGE'
  | 'EMPTY_IMAGE'
  | 'NO_TEXT_FOUND'
  | 'PREPROCESS_FAILED'
  | 'ENGINE_UNAVAILABLE'
  | 'ENGINE_FAILED'
  | 'NETWORK_ERROR'
  | 'CANCELLED';

/** Thrown for any expected, user-recoverable scanning failure. */
export function createOCRError(code: OCRFailureCode, message: string): OCRError {
  const error = new Error(message) as OCRError;
  error.code = code;
  return error;
}

/**
 * The provider-agnostic contract the scanner UI depends on.
 *
 * The rest of the feature (preprocessing, extraction, review, transaction
 * creation) is written against this interface only, so swapping Tesseract.js for
 * a server engine or a future vision provider is a one-file change.
 */
export interface OCRService {
  readonly id: string;
  readonly label: string;
  /**
   * Whether this provider is usable right now. Used to hide providers that are
   * unavailable so the scanner degrades to the ones that work instead of
   * failing.
   */
  isAvailable(): boolean;
  /**
   * Runs OCR on a preprocessed image. Must not persist the image, and must not
   * send it to a third party unless the provider is explicitly opt-in.
   */
  recognize(
    image: Blob,
    onProgress?: (progress: OCRProgress) => void,
    signal?: AbortSignal
  ): Promise<OCRTextResult>;
  /** Releases any worker/engine resources. Safe to call more than once. */
  dispose(): Promise<void>;
}
