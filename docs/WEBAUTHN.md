# WebAuthn / Passkey Authentication

Biometric (fingerprint, Face ID, Windows Hello, Android biometrics, device PIN) and passkey
sign-in for SpendWise, built on the **W3C Web Authentication standard**.

It is an **additional** authentication method. Google Login is untouched and remains the primary
sign-in path, as does the existing JWT session architecture.

```
Google Login  ──┐
                ├──►  Express  ──►  Access JWT (15m)
Biometric/Passkey ┘                └─► Refresh JWT (7d) in HttpOnly cookie
```

---

## Security model

**What the server stores**

| Field | Purpose |
| --- | --- |
| `credentialId` | Base64URL credential identifier (globally unique, indexed) |
| `publicKey` | COSE-encoded credential **public** key |
| `counter` | Signature counter, used to detect cloned authenticators |
| `credentialType` / `deviceType` / `backedUp` / `transports` / `aaguid` / `attestationFormat` | Authenticator metadata |
| `deviceName`, `createdAt`, `lastUsedAt` | UX and audit data |

**What the server never stores or receives**

- Fingerprints, face images, biometric templates, sensor data
- Credential private keys (they stay inside the authenticator)
- Raw biometrics of any kind — the device/OS performs the actual check

**How sign-in is proved**

Challenge–response. The server issues a cryptographically random challenge
(`crypto.randomBytes(32)`), the authenticator signs it with the private key it never shares, and
the server verifies the signature against the stored public key.

**Identity binding**

Registration and removal both resolve the user from the verified access token produced by the
existing `requireAuth` middleware. No endpoint accepts a `userId` from the client, so a credential
can never be attached to — or removed from — another account. Deletion is additionally scoped by
`userId` in the database predicate.

**Challenge handling**

Challenges live in the application's existing cache layer (Redis when reachable, in-memory
fallback otherwise), expire after `WEBAUTHN_CHALLENGE_TTL_SECONDS` (default 300s, hard-capped at
300), and are read-then-deleted: a challenge backs at most one verification attempt, which is what
blocks replay. Challenges are never written to the user document.

**Verification performed on every ceremony**

`verifyRegistrationResponse()` / `verifyAuthenticationResponse()` from
`@simplewebauthn/server` check challenge, origin, RP ID, signature, and user verification
(`userVerification: "required"`). Registration additionally stores the counter and authenticator
metadata; authentication rejects a counter regression, which indicates a cloned authenticator
replaying a captured assertion.

**Cookie and CORS posture**

The refresh token stays in the existing `HttpOnly` / `Secure` / `SameSite` cookie with the same
rotation logic as before — no `localStorage` was introduced. CORS reflects only known origins
with `credentials: true`; wildcard reflection is no longer accepted for any route.

---

## API

Base path: `/api/v1/auth/webauthn`

All responses use the app's standard envelope: `{ success, data, message, code }`.
Error messages are user-safe; internal cryptographic detail is logged server-side only.

### `POST /register/options`

**Auth:** required (access JWT)
**Body:** `{ deviceName?: string }`
**Response:** `{ challengeId, options }` — `options` is passed straight to
`@simplewebauthn/browser`'s `startRegistration()`.

**Errors:** `401 UNAUTHORIZED`, `400 VALIDATION_ERROR`, `429 WEBAUTHN_RATE_LIMIT_EXCEEDED`

### `POST /register/verify`

**Auth:** required (access JWT)
**Body:** `{ challengeId: string, deviceName?: string, credential: RegistrationResponseJSON }`
**Response (201):** `{ credential: { id, deviceName, deviceType, createdAt } }`

**Errors:** `400 WEBAUTHN_CHALLENGE_MISSING`, `400 WEBAUTHN_CHALLENGE_EXPIRED`,
`400 WEBAUTHN_CHALLENGE_TYPE_MISMATCH`, `403 WEBAUTHN_CHALLENGE_OWNER_MISMATCH`,
`400 WEBAUTHN_ORIGIN_MISMATCH`, `400 WEBAUTHN_RPID_MISMATCH`, `400 WEBAUTHN_CHALLENGE_MISMATCH`,
`400 WEBAUTHN_USER_VERIFICATION_FAILED`, `400 WEBAUTHN_INVALID_SIGNATURE`,
`400 WEBAUTHN_VERIFICATION_FAILED`, `409 WEBAUTHN_CREDENTIAL_EXISTS`

### `POST /login/options`

**Auth:** public (the user is not yet authenticated)
**Body:** `{}`
**Response:** `{ challengeId, options }`

`allowCredentials` is intentionally omitted so the browser may offer any passkey saved for the
site, including synced passkeys. The user is identified only *after* the assertion verifies.

### `POST /login/verify`

**Auth:** public
**Body:** `{ challengeId: string, credential: AuthenticationResponseJSON }`
**Response:** `{ user, accessToken, sessionId }` plus the `spendwise_refresh_token` HttpOnly cookie —
byte-for-byte the same mechanism as Google Login.

**Errors:** `400 WEBAUTHN_CHALLENGE_EXPIRED`, `400 WEBAUTHN_CREDENTIAL_ID_MISSING`,
`401 WEBAUTHN_CREDENTIAL_NOT_FOUND`, `401 WEBAUTHN_ORIGIN_MISMATCH`,
`401 WEBAUTHN_RPID_MISMATCH`, `401 WEBAUTHN_CHALLENGE_MISMATCH`, `401 WEBAUTHN_COUNTER_REGRESSION`,
`401 WEBAUTHN_USER_VERIFICATION_FAILED`, `401 WEBAUTHN_VERIFICATION_FAILED`

### `GET /credentials`

**Auth:** required. Returns only the caller's own credentials:
`{ credentials: [{ id, deviceName, deviceType, backedUp, transports, aaguid, createdAt, lastUsedAt }] }`.
Public keys are not exposed.

### `DELETE /credentials/:credentialId`

**Auth:** required. `credentialId` must match `[A-Za-z0-9_-]+`.
Removes the credential only if it belongs to the caller; a foreign ID returns
`404 WEBAUTHN_CREDENTIAL_NOT_FOUND` and is left untouched.

### `GET /status`

**Auth:** public. `{ available: true, hasCredentials: boolean }` — used by the login page to decide
whether to render the passkey button. Reveals nothing about ownership.

---

## Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `WEBAUTHN_RP_NAME` | `SpendWise` | Display name shown in the native prompt |
| `WEBAUTHN_RP_ID` | `localhost` | Must be the effective domain of the origin, or a parent of it |
| `WEBAUTHN_ORIGINS` | `http://localhost:5173` | Comma-separated exact origins; configured frontend origins are merged in |
| `WEBAUTHN_CHALLENGE_TTL_SECONDS` | `300` | Hard-capped at 300 |

`WEBAUTHN_CHALLENGE_TTL_SECONDS` is validated by the existing Zod env schema and rejected if it
exceeds 300 seconds.

---

## Local development

```bash
npm run dev                      # backend :8080, frontend :5173
cd server && npm run migrate     # create collection + indexes
```

Defaults are already correct for `localhost`. Sign in with Google, then
**Settings → Security → Enable Biometric Authentication**.

**Secure context requirements.** WebAuthn only runs in a secure context. Browsers treat
`http://localhost` and `http://127.0.0.1` as secure, so no certificate is needed. If you use any
other hostname — a LAN IP, `*.local`, or a tunnel domain — you must serve the frontend over HTTPS
with a certificate the browser trusts, and add the exact origin to `WEBAUTHN_ORIGINS`. In Chrome,
`chrome://flags/#unsafely-treat-insecure-origin-as-secure` can be used to trust a local HTTP origin
during development.

**Multi-device testing.** A synced passkey (iCloud Keychain, Google Password Manager, Windows
Hello) works across devices; a device-bound credential does not. Register on a second device to
create a second credential — multiple credentials per account are supported and each is listed
separately under *My Devices*.

---

## Production deployment

1. Serve the frontend over **HTTPS** (WebAuthn will not run otherwise).
2. Set the RP identity to the production domain:

   ```env
   WEBAUTHN_RP_NAME=SpendWise
   WEBAUTHN_RP_ID=yourdomain.com
   WEBAUTHN_ORIGINS=https://yourdomain.com
   ```

   `WEBAUTHN_RP_ID` must be the site's own domain or a registrable parent of it. It cannot be
   changed later without users re-registering.
3. Add every additional deployed origin (e.g. a `www.` variant, a Vercel preview domain) to
   `WEBAUTHN_ORIGINS`. Origins are matched exactly — no wildcards.
4. Run the migration: `cd server && npm run migrate`.
5. Ensure the frontend origin is in the CORS allow-list (`CLIENT_URL` / `CLIENT_URLS`) so the
   HttpOnly refresh cookie is issued correctly.
6. Redis is recommended in production so challenges are shared across instances. Without it the
   app falls back to an in-process cache, which means a challenge issued on one instance will not
   be recognised on another.
7. Verify: sign in with Google → Settings → Security → enable → sign out → use the passkey button.

**Rollback:** `cd server && npm run migrate:rollback` drops the `webauthncredentials` collection,
removing every registered passkey. `npm run migrate:status` lists what has been applied.

---

## Manual verification checklist

1. Google Login still works and is unchanged.
2. Enabling passkeys shows the native device prompt and reports success.
3. Signing out and using *Use Biometric Authentication* signs in and lands on the dashboard.
4. The access token works for API calls; refresh after 15 minutes still works via the cookie.
5. Cancelling the native prompt leaves the login page usable, with no error banner.
6. An unsupported browser shows *Biometric authentication is not available* and Google Login
   still works.
7. Removing a device in Settings removes it from the list and disables passkey sign-in for it.
8. A second device can be added and appears as its own entry.
9. A rejected or stale credential shows a clear message and does not lock the user out of Google
   Login.
