import React from 'react';
import { Camera, ImagePlus } from 'lucide-react';

export type ScannerMode = 'upload' | 'live';

interface Props {
  mode: ScannerMode;
  onChange: (mode: ScannerMode) => void;
  disabled?: boolean;
}

/** Two clearly visible input options: Upload vs Live Scan. */
export const ScannerModeSelector: React.FC<Props> = ({ mode, onChange, disabled }) => (
  <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80">
    <button type="button" disabled={disabled} onClick={() => onChange('upload')}
      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
        mode === 'upload'
          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
      } disabled:opacity-60`}>
      <ImagePlus className="w-4 h-4" /> Upload Receipt
    </button>
    <button type="button" disabled={disabled} onClick={() => onChange('live')}
      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
        mode === 'live'
          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
      } disabled:opacity-60`}>
      <Camera className="w-4 h-4" /> Live Scan
    </button>
  </div>
);
