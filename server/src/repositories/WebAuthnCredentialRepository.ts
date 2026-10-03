import { WebAuthnCredentialModel } from '../models/WebAuthnCredential.js';
import { IWebAuthnCredential } from '../types/index.js';

/** Converts a lean document's binary public key into a real `Buffer`. */
function withBufferKey(credential: IWebAuthnCredential): IWebAuthnCredential {
  const key = credential.publicKey;
  if (Buffer.isBuffer(key)) return credential;
  return { ...credential, publicKey: Buffer.from((key as { buffer: Uint8Array }).buffer) };
}
export class WebAuthnCredentialRepository {
  async create(data: {
    userId: string;
    credentialId: string;
    publicKey: Buffer;
    counter: number;
    credentialType: string;
    deviceType: 'singleDevice' | 'multiDevice';
    backedUp: boolean;
    transports: string[];
    aaguid: string;
    attestationFormat: string;
    deviceName?: string;
  }): Promise<IWebAuthnCredential> {
    const doc = new WebAuthnCredentialModel(data);
    return (await doc.save()).toObject();
  }

  /**
   * Global lookup by credential ID. Used by the WebAuthn login ceremony.
   * `publicKey` is normalized to a Node `Buffer`, because `.lean()` returns
   * Mongoose's `Binary` wrapper which the crypto layer cannot consume directly.
   */
  async findByCredentialId(credentialId: string): Promise<IWebAuthnCredential | null> {
    const doc = await WebAuthnCredentialModel.findOne({ credentialId }).lean();
    return doc ? withBufferKey(doc as unknown as IWebAuthnCredential) : null;
  }

  async findByUserId(userId: string): Promise<IWebAuthnCredential[]> {
    const docs = await WebAuthnCredentialModel.find({ userId })
      .sort({ lastUsedAt: -1, createdAt: -1 })
      .lean();
    return (docs as unknown as IWebAuthnCredential[]).map(withBufferKey);
  }

  async updateAfterAuthentication(
    credentialId: string,
    newCounter: number,
    lastUsedAt: Date
  ): Promise<void> {
    await WebAuthnCredentialModel.findOneAndUpdate(
      { credentialId },
      { $set: { counter: newCounter, lastUsedAt } }
    );
  }

  async countAll(): Promise<number> {
    return WebAuthnCredentialModel.estimatedDocumentCount();
  }

  /**
   * Ownership-scoped delete. The `userId` predicate is what prevents one user
   * from removing another user's credential by guessing an ID.
   */
  async deleteOwned(userId: string, credentialId: string): Promise<boolean> {
    const result = await WebAuthnCredentialModel.deleteOne({ userId, credentialId });
    return result.deletedCount === 1;
  }

  async deleteAllForUser(userId: string): Promise<number> {
    const result = await WebAuthnCredentialModel.deleteMany({ userId });
    return result.deletedCount;
  }
}

export const webAuthnCredentialRepository = new WebAuthnCredentialRepository();
