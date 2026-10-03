import { Schema, model } from 'mongoose';
import { IWebAuthnCredential } from '../types/index.js';

/**
 * WebAuthn / passkey credentials.
 *
 * Security note: this collection stores PUBLIC WebAuthn material only —
 * credential ID, credential public key, signature counter and authenticator
 * metadata. Private keys remain inside the user's authenticator, and no
 * biometric data (fingerprint, face image, or template) is ever received by
 * or persisted on the server.
 */
const webAuthnCredentialSchema = new Schema<IWebAuthnCredential>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    credentialId: { type: String, required: true },
    publicKey: { type: Buffer, required: true },
    counter: { type: Number, required: true, default: 0, min: 0 },
    credentialType: { type: String, required: true, default: 'public-key' },
    deviceType: {
      type: String,
      enum: ['singleDevice', 'multiDevice'],
      default: 'singleDevice',
    },
    backedUp: { type: Boolean, default: false },
    transports: { type: [String], default: [] },
    aaguid: { type: String, default: '' },
    attestationFormat: { type: String, default: 'none' },
    deviceName: { type: String, default: '' },
    lastUsedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// Indexes are declared only here (not inline on the fields) so the names match
// the ones created by the migration in `src/scripts/migrate.ts`; Mongoose
// otherwise warns about duplicate index definitions.
webAuthnCredentialSchema.index({ credentialId: 1 }, { unique: true, name: 'credentialId_unique' });
webAuthnCredentialSchema.index({ userId: 1 }, { name: 'userId_1' });
// Device list in Settings, newest first.
webAuthnCredentialSchema.index({ userId: 1, createdAt: -1 }, { name: 'userId_1_createdAt_-1' });

export const WebAuthnCredentialModel = model<IWebAuthnCredential>(
  'WebAuthnCredential',
  webAuthnCredentialSchema
);
