import { IWebAuthnCredential } from '../../src/types/index.js';

/**
 * In-memory stand-in for the WebAuthn credential repository, used by the test
 * suite so the crypto and authorization logic can be exercised without MongoDB.
 *
 * It deliberately reproduces the two authorization-relevant behaviours of the
 * real repository:
 *  - `credentialId` is globally unique (one authenticator, one account).
 *  - `deleteOwned` filters on `userId` and only reports success when a document
 *    belonging to that user was actually removed.
 */
export class InMemoryWebAuthnCredentialRepository {
  private readonly byId = new Map<string, IWebAuthnCredential>();
  private sequence = 0;

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
    if (this.byId.has(data.credentialId)) {
      throw Object.assign(new Error('E11000 duplicate key error'), { code: 11000 });
    }
    const now = new Date();
    const record = {
      _id: `mem-${++this.sequence}`,
      userId: data.userId,
      credentialId: data.credentialId,
      publicKey: data.publicKey,
      counter: data.counter,
      credentialType: data.credentialType,
      deviceType: data.deviceType,
      backedUp: data.backedUp,
      transports: data.transports,
      aaguid: data.aaguid,
      attestationFormat: data.attestationFormat,
      deviceName: data.deviceName ?? '',
      lastUsedAt: null as Date | null,
      createdAt: now,
      updatedAt: now,
    } as IWebAuthnCredential;
    this.byId.set(data.credentialId, record);
    return record;
  }

  async findByCredentialId(credentialId: string): Promise<IWebAuthnCredential | null> {
    return this.byId.get(credentialId) ?? null;
  }

  async findByUserId(userId: string): Promise<IWebAuthnCredential[]> {
    return [...this.byId.values()]
      .filter((c) => String(c.userId) === String(userId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateAfterAuthentication(
    credentialId: string,
    newCounter: number,
    lastUsedAt: Date
  ): Promise<void> {
    const record = this.byId.get(credentialId);
    if (record) {
      record.counter = newCounter;
      record.lastUsedAt = lastUsedAt;
    }
  }

  async deleteOwned(userId: string, credentialId: string): Promise<boolean> {
    const record = this.byId.get(credentialId);
    if (!record || String(record.userId) !== String(userId)) return false;
    this.byId.delete(credentialId);
    return true;
  }

  async countAll(): Promise<number> {
    return this.byId.size;
  }

  /** Test helper: seed a credential without running a ceremony. */
  seed(partial: Partial<IWebAuthnCredential> & { credentialId: string; userId: string }): IWebAuthnCredential {
    const now = new Date();
    const record = {
      _id: `mem-${++this.sequence}`,
      publicKey: Buffer.alloc(0),
      counter: 0,
      credentialType: 'public-key',
      deviceType: 'singleDevice',
      backedUp: false,
      transports: [],
      aaguid: '',
      attestationFormat: 'none',
      deviceName: '',
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
      ...partial,
    } as IWebAuthnCredential;
    this.byId.set(record.credentialId, record);
    return record;
  }
}
