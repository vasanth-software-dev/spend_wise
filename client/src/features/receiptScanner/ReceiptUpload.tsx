import React, { useRef, useState } from 'react';
import { ImagePlus, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/Button.js';
import { ACCEPT_ATTRIBUTE, MAX_IMAGE_BYTES, validateImageFile } from './imageValidation.js';
import { describeScanFailure } from './imageValidation.js';
import type { OCRError } from './types.js';

interface Props {
  onFile: (file: File) => void;
  busy: boolean;
}

/**
 * Option A — Upload Receipt. Gallery picker only (JPG/PNG/WebP):
 * preview + change/retake + confirm into the shared OCR pipeline.
 */
export const ReceiptUpload: React.FC<Props> = ({ onFile, busy }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<File | null>(null);

  const pick = (f: File | null | undefined) => {
    if (!f) return;
    setError(null);
    try {
      const v = validateImageFile(f);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(v.file));
      setName(v.file.name);
      setPending(v.file);
    } catch (e) {
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      setName(null);
      setPending(null);
      setError(describeScanFailure((e as OCRError).code));
    }
  };

  React.useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  return (
    <div className="space-y-3">
      <input ref={inputRef} type="file" accept={ACCEPT_ATTRIBUTE} className="hidden"
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      {!preview ? (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
          className="w-full rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-850/40 p-6 text-center hover:border-brand-400 transition-colors disabled:opacity-60">
          <ImagePlus className="w-8 h-8 mx-auto text-brand-600 dark:text-brand-400" />
          <p className="text-sm font-bold text-slate-900 dark:text-white mt-2">Choose receipt image</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">JPG, JPEG, PNG, WebP · up to {Math.round(MAX_IMAGE_BYTES / 1048576)} MB</p>
        </button>
      ) : (
        <div className="space-y-2.5">
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <img src={preview} alt="Receipt preview" className="w-full max-h-64 object-contain bg-slate-50 dark:bg-slate-900" />
          </div>
          {name && <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate text-center">{name}</p>}
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}
              leftIcon={<RefreshCw className="w-4 h-4" />}>Change</Button>
            <Button variant="primary" size="sm" disabled={busy || !pending}
              isLoading={busy} onClick={() => { if (pending) onFile(pending); }}>
              {busy ? <span className="inline-flex items-center gap-1"><Loader2 className="w-4 h-4 animate-spin" />Scanning…</span> : 'Scan Receipt'}
            </Button>
          </div>
        </div>
      )}
      {error && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 text-center">{error}</p>}
    </div>
  );
};
