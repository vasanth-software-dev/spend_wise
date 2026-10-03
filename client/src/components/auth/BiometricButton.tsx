import React from 'react';
import { Fingerprint, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button.js';

interface BiometricButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  /** Shown when this browser/device cannot do WebAuthn at all. */
  unsupportedHint?: string;
  className?: string;
}

/**
 * "Use Biometric Authentication" button for the login page.
 *
 * Terminology is intentionally "Biometric / Passkey": WebAuthn may resolve to a
 * fingerprint, Face ID, Windows Hello, an Android biometric, a device PIN, a
 * synced passkey, or a hardware security key, so the UI does not claim any one
 * of them.
 */
export const BiometricButton: React.FC<BiometricButtonProps> = ({
  onClick,
  isLoading = false,
  disabled = false,
  unsupportedHint,
  className = '',
}) => {
  if (unsupportedHint) {
    return (
      <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center leading-relaxed">
        {unsupportedHint}
      </p>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={onClick}
      isLoading={isLoading}
      disabled={disabled}
      leftIcon={
        isLoading ? undefined : <Fingerprint className="w-4 h-4 text-brand-600 dark:text-brand-400" />
      }
      className={`w-full font-bold ${className}`}
    >
      {isLoading ? 'Waiting for your device...' : 'Use Biometric Authentication'}
    </Button>
  );
};

/** Inline spinner used by the settings card while the native prompt is open. */
export const BiometricSpinner: React.FC<{ className?: string }> = ({ className = '' }) => (
  <Loader2 className={`w-4 h-4 animate-spin ${className}`} />
);
