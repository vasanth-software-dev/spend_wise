import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle,
  Fingerprint,
  Info,
  Laptop,
  Plus,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/Card.js';
import { Button } from '../ui/Button.js';
import { Badge } from '../ui/Badge.js';
import { Modal } from '../ui/Modal.js';
import { toast } from '../ui/Toast.js';
import { formatDate, formatRelativeDate } from '../../utils/format.js';
import {
  BiometricError,
  describeBiometricError,
  fetchPasskeys,
  guessDeviceName,
  hasPlatformAuthenticator,
  isWebAuthnSupported,
  registerPasskey,
  removePasskey,
  type PasskeySummary,
} from '../../services/webauthn.js';

/**
 * Settings → Security → Biometric / Passkey authentication.
 *
 * Enabling runs the browser's native WebAuthn registration ceremony. The
 * server stores only the credential's public data; the private key and any
 * biometric check stay on the device.
 */
export const BiometricSettingsCard: React.FC = () => {
  const [credentials, setCredentials] = useState<PasskeySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<PasskeySummary | null>(null);
  const [supported, setSupported] = useState(true);
  const [platformAvailable, setPlatformAvailable] = useState(false);

  const loadCredentials = useCallback(async () => {
    try {
      setCredentials(await fetchPasskeys());
    } catch {
      // Settings must stay usable even if this fails; the user can retry.
      setCredentials([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setSupported(isWebAuthnSupported());
    hasPlatformAuthenticator().then(setPlatformAvailable).catch(() => setPlatformAvailable(false));
    loadCredentials();
  }, [loadCredentials]);

  const handleEnable = async () => {
    setIsEnrolling(true);
    try {
      await registerPasskey(guessDeviceName());
      toast.success('Biometric authentication enabled successfully.');
      await loadCredentials();
    } catch (err) {
      // A dismissed native prompt is a normal outcome, not a failure banner.
      if (err instanceof BiometricError && err.cancelled) {
        toast.info('Biometric setup cancelled. You can enable it any time from Settings.');
      } else {
        toast.error(describeBiometricError(err));
      }
    } finally {
      setIsEnrolling(false);
    }
  };

  const confirmRemoval = async () => {
    if (!pendingRemoval) return;
    const target = pendingRemoval;
    setPendingRemoval(null);
    setRemovingId(target.id);
    try {
      await removePasskey(target.id);
      toast.success('Biometric authentication removed.');
      await loadCredentials();
    } catch (err) {
      toast.error(describeBiometricError(err));
    } finally {
      setRemovingId(null);
    }
  };

  const isEnabled = credentials.length > 0;

  return (
    <Card variant="elevated" className="p-6 sm:p-7 space-y-5">
      <CardHeader className="pb-4 border-b border-slate-100 dark:border-white/5">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Fingerprint className="w-4.5 h-4.5 text-brand-600 dark:text-brand-400" />
          Biometric Authentication
        </CardTitle>
        <CardDescription className="text-xs">
          Use your device&apos;s secure authentication — fingerprint, Face ID, Windows Hello, device PIN or a
          passkey — to quickly sign in to your expense account. Your biometric data never leaves your device.
        </CardDescription>
      </CardHeader>

      {!supported && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2.5">
          <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Biometric authentication is not available on this device/browser.</p>
            <p className="mt-1 leading-relaxed">
              WebAuthn requires a modern browser over HTTPS (or <code>localhost</code>). You can keep using
              Google Login.
            </p>
          </div>
        </div>
      )}

      {supported && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              {isEnabled ? (
                <Badge variant="emerald" size="sm" dot>
                  ENABLED
                </Badge>
              ) : (
                <Badge variant="slate" size="sm" dot>
                  NOT ENABLED
                </Badge>
              )}
              <span className="text-slate-500 dark:text-slate-400">
                {isEnabled
                  ? `${credentials.length} registered ${credentials.length === 1 ? 'device' : 'devices'}`
                  : 'Sign in with Google, then enable it here for faster access.'}
              </span>
            </div>

            <Button
              size="sm"
              variant={isEnabled ? 'outline' : 'primary'}
              leftIcon={isEnabled ? <Plus className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
              onClick={handleEnable}
              isLoading={isEnrolling}
              disabled={isLoading}
            >
              {isEnabled ? 'Add Another Device' : 'Enable Biometric Authentication'}
            </Button>
          </div>

          {!isEnabled && !platformAvailable && (
            <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-surface-elevated/60 border border-slate-200/80 dark:border-white/5 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" />
              <p className="leading-relaxed">
                No built-in authenticator was detected. You can still register a hardware security key, or set up
                a screen lock on this device first.
              </p>
            </div>
          )}

          {isEnabled && (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {credentials.map((cred) => (
                <div key={cred.id} className="py-4 flex items-center justify-between gap-3 text-xs sm:text-sm">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 flex-shrink-0">
                      <Laptop className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 flex-wrap">
                        {cred.deviceName}
                        {cred.backedUp && (
                          <Badge variant="blue" size="sm">
                            SYNCED
                          </Badge>
                        )}
                      </p>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Added: {formatDate(cred.createdAt)} • Last used:{' '}
                        {cred.lastUsedAt ? formatRelativeDate(cred.lastUsedAt) : 'Never'}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPendingRemoval(cred)}
                    isLoading={removingId === cred.id}
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex-shrink-0"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={pendingRemoval !== null}
        onClose={() => setPendingRemoval(null)}
        title="Remove biometric authentication?"
        description={`This unregisters ${pendingRemoval?.deviceName ?? 'this device'}.`}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
            <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              You will need to use Google Login or another registered authentication method on this device next
              time. Other registered devices are not affected.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/5">
            <Button variant="outline" size="sm" onClick={() => setPendingRemoval(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={confirmRemoval}>
              Remove
            </Button>
          </div>
        </div>
      </Modal>

      <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-start gap-2.5 text-[11px] text-slate-500 dark:text-slate-400">
        <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          SpendWise stores only the public key, credential ID and counter for each registered device. Your private
          key and biometric verification stay on your device at all times.
        </p>
      </div>
    </Card>
  );
};
