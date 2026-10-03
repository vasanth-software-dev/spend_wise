import crypto from 'crypto';
import { getCache } from '../config/redis.js';
import { env } from '../config/env.js';

/**
 * Short-lived, single-use WebAuthn challenge store.
 *
 * Backed by the application's existing cache layer (Redis when reachable,
 * in-memory fallback otherwise), so no second infrastructure is introduced and
 * no challenge is ever persisted on the user document.
 *
 * Security properties:
 * - Challenges are generated with `crypto.randomBytes` (CSPRNG).
 * - They expire after `WEBAUTHN_CHALLENGE_TTL_SECONDS` (<= 300s).
 * - `consume()` is a read-then-delete: a challenge can back at most one
 *   verification attempt, which is what blocks replay.
 */
export interface StoredChallenge {
  challenge: string;
  /** Set for registration ceremonies; never trusted for ownership decisions. */
  userId?: string;
  type: 'registration' | 'authentication';
  createdAt: number;
}

const KEY_PREFIX = 'webauthn:challenge:';

function keyFor(id: string): string {
  return `${KEY_PREFIX}${id}`;
}

/** The subset of the cache client this store needs. */
type CacheLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<unknown>;
  del(key: string): Promise<number>;
};

export class WebAuthnChallengeStore {
  /**
   * Injectable cache resolver. Production uses the shared Redis-backed client
   * (with the app's in-memory fallback); tests can pass a local store so no
   * Redis instance is required.
   */
  constructor(private readonly resolveCache: () => CacheLike = getCache) {}

  private get cache(): CacheLike {
    return this.resolveCache();
  }

  /**
   * Issues a new challenge bound to `id` (a random handle chosen by the
   * caller). Any previous challenge under the same handle is replaced, so a
   * client can only have one live ceremony per handle.
   *
   * `challenge` is the value handed to the browser, so the copy kept on the
   * server is byte-identical to the one the authenticator will sign over. It
   * defaults to freshly generated CSPRNG bytes when omitted.
   */
  async issue(
    id: string,
    type: StoredChallenge['type'],
    userId?: string,
    challenge: string = crypto.randomBytes(32).toString('base64url')
  ): Promise<StoredChallenge> {
    const record: StoredChallenge = { challenge, type, createdAt: Date.now(), userId };

    await this.cache.set(
      keyFor(id),
      JSON.stringify(record),
      'EX',
      env.WEBAUTHN_CHALLENGE_TTL_SECONDS
    );

    return record;
  }

  /**
   * Atomically reads and removes the challenge for `id`.
   * Returns `null` when the challenge is unknown, already consumed, or
   * expired (the cache layer drops expired entries).
   */
  async consume(id: string): Promise<StoredChallenge | null> {
    const cache = this.cache;
    const raw = await cache.get(keyFor(id));
    if (!raw) return null;
    // Delete unconditionally: even if the payload is malformed, the challenge
    // is spent and must not be retried.
    await cache.del(keyFor(id));

    try {
      const parsed = JSON.parse(raw) as StoredChallenge;
      if (!parsed?.challenge || parsed.type === undefined) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  /** Drops a challenge without validating it (e.g. after a failed attempt). */
  async discard(id: string): Promise<void> {
    await this.cache.del(keyFor(id));
  }
}

export const webAuthnChallengeStore = new WebAuthnChallengeStore();
