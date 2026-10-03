import { z } from 'zod';

/**
 * The registration/assertion payloads are produced by `@simplewebauthn/browser`
 * and are structurally complex, so they are validated as "non-empty object"
 * here and fully verified cryptographically by `WebAuthnService`. Zod is only
 * used to reject obviously malformed bodies before they reach the verifier.
 */
const credentialResponse = z
  .object({
    id: z.string().min(1).optional(),
    rawId: z.string().min(1).optional(),
    type: z.string().min(1).optional(),
    response: z.record(z.string(), z.unknown()).optional(),
    clientExtensionResults: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const webauthnRegisterOptionsSchema = z.object({
  body: z
    .object({
      deviceName: z.string().max(120).optional(),
    })
    .default({}),
});

export const webauthnRegisterVerifySchema = z.object({
  body: z
    .object({
      challengeId: z.string().min(8, 'challengeId is required'),
      deviceName: z.string().max(120).optional(),
      credential: credentialResponse,
    })
    .passthrough(),
});

export const webauthnLoginOptionsSchema = z.object({
  body: z.object({}).passthrough().default({}),
});

export const webauthnLoginVerifySchema = z.object({
  body: z
    .object({
      challengeId: z.string().min(8, 'challengeId is required'),
      credential: credentialResponse,
    })
    .passthrough(),
});

export const webauthnCredentialIdParamSchema = z.object({
  params: z.object({
    // Base64URL alphabet only; guards against path traversal style payloads.
    credentialId: z
      .string()
      .min(1)
      .max(512)
      .regex(/^[A-Za-z0-9_-]+$/, 'Invalid credential identifier'),
  }),
});
