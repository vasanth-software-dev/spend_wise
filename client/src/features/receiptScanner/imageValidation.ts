import { createOCRError, OCRFailureCode } from './types.js';

/** Hard ceiling on the bytes accepted from the device. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Only the supported raster formats are allowed through. Anything else (SVG,
 * PDF, video, archives, executables) is rejected before it reaches the canvas.
 */
export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const ACCEPT_ATTRIBUTE = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

export interface ValidatedImage {
  file: File;
  type: string;
  size: number;
}

export function validateImageFile(file: unknown): ValidatedImage {
  if (!(file instanceof File) && !(file instanceof Blob)) {
    throw createOCRError('UNSUPPORTED_FILE', 'No image was selected.');
  }

  const candidate = file as File;
  const type = (candidate.type || '').toLowerCase();

  if (!type.startsWith('image/')) {
    throw createOCRError('UNSUPPORTED_FILE', 'Please choose an image file (JPG, PNG or WebP).');
  }

  const isKnownType =
    (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type) ||
    type === 'image/jpg';

  if (!isKnownType) {
    throw createOCRError('UNSUPPORTED_FILE', 'This image format is not supported. Use JPG, PNG or WebP.');
  }

  if (candidate.size > MAX_IMAGE_BYTES) {
    throw createOCRError('FILE_TOO_LARGE', 'That image is too large. Please pick a smaller photo.');
  }

  if (candidate.size === 0) {
    throw createOCRError('EMPTY_IMAGE', 'That image appears to be empty.');
  }

  return { file: candidate, type, size: candidate.size };
}

const MAGIC_BYTES: Array<{ type: string; bytes: number[]; offset?: number }> = [
  { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
];

function matches(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * Confirms the declared MIME type matches the actual file header.
 *
 * The browser-supplied `type` is only a hint; this closes the gap where a
 * non-image is renamed to `.jpg` to slip past the type check.
 */
export function looksLikeImage(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  if (MAGIC_BYTES.some((signature) => matches(bytes, signature.bytes))) return true;
  // RIFF....WEBP
  if (matches(bytes, [0x52, 0x49, 0x46, 0x46]) && matches(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return true;
  }
  // ISO-BMFF container used by HEIC/HEIF ("ftyp" at offset 4).
  if (matches(bytes, [0x66, 0x74, 0x79, 0x70], 4)) return true;
  return false;
}

export function describeScanFailure(code?: OCRFailureCode): string {
  switch (code) {
    case 'UNSUPPORTED_FILE':
      return 'We could not read this ticket clearly.';
    case 'FILE_TOO_LARGE':
      return 'This photo is too large to scan.';
    case 'EMPTY_IMAGE':
      return 'This photo appears to be empty.';
    case 'PREPROCESS_FAILED':
      return 'This photo could not be prepared for scanning.';
    case 'ENGINE_UNAVAILABLE':
    case 'ENGINE_FAILED':
      return 'On-device scanning is unavailable right now.';
    case 'NETWORK_ERROR':
      return 'We could not reach the scanner. Check your connection and try again.';
    case 'CANCELLED':
      return 'Scan cancelled.';
    case 'NO_TEXT_FOUND':
    default:
      return "We couldn't read this ticket clearly.";
  }
}
