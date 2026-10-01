import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Aperture, CameraOff, ImagePlus, Loader2, X } from 'lucide-react';
import { Button } from '../../components/ui/Button.js';
import { useCamera } from './useCamera.js';
import { useReceiptDetection } from './useReceiptDetection.js';
import { ScannerOverlay } from './ScannerOverlay.js';
import type { Point } from './receiptDetection.js';

interface Props {
  onCapture: (file: File, quad: Point[] | null) => void;
  onPickFromGallery: () => void;
  onClose: () => void;
  busy: boolean;
}

/**
 * Option B — Live Scanner. Rear camera + overlay + lightweight detection.
 * Auto-captures after ~6 stable READY frames; manual shutter always available.
 * Stops every track on capture/unmount.
 */
export const LiveReceiptScanner: React.FC<Props> = ({ onCapture, onPickFromGallery, onClose, busy }) => {
  const { status, videoRef, streamRef, errorMessage, start, stop } = useCamera();
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const quadRef = useRef<Point[] | null>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;

  const doCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0 || capturing || busyRef.current) return;
    setCapturing(true);
    try {
      const canvas = document.createElement('canvas');
      const vw = video.videoWidth; const vh = video.videoHeight;
      canvas.width = Math.min(vw, 2000);
      canvas.height = Math.round((canvas.width / vw) * vh);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.92));
      canvas.width = 0; canvas.height = 0;
      if (!blob) throw new Error('encode');
      const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const stream = streamRef.current;
      if (stream) for (const t of stream.getTracks()) { try { t.stop(); } catch { /* noop */ } }
      streamRef.current = null;
      onCapture(file, quadRef.current);
    } catch {
      setCapturing(false);
    }
  }, [onCapture, capturing, streamRef, videoRef]);

  const detection = useReceiptDetection(videoRef, status === 'active' && !busy && !capturing, () => {
    if (autoEnabled) void doCapture();
  });

  useEffect(() => { quadRef.current = detection.quad; }, [detection.quad]);
  useEffect(() => { void start(); return () => stop(); }, [start, stop]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-slate-950 text-white" style={{ height: '100dvh' }}>
      <div className="flex items-center justify-between px-3 py-2.5">
        <p className="text-xs font-extrabold tracking-wide">Scan Receipt</p>
        <button type="button" onClick={() => { stop(); onClose(); }} aria-label="Close scanner"
          className="p-1.5 rounded-lg hover:bg-white/10"><X className="w-4 h-4" /></button>
      </div>
      <div className="relative flex-1 overflow-hidden bg-black">
        <video ref={videoRef} playsInline muted autoPlay
          className={`absolute inset-0 h-full w-full object-cover ${status === 'active' ? '' : 'invisible'}`} />
        {status === 'active' && (
          <ScannerOverlay quad={detection.quad} guidance={detection.guidance} ready={detection.ready} />
        )}
        {status === 'requesting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-7 h-7 animate-spin text-white/80" />
            <p className="text-xs font-semibold text-white/80">Starting camera...</p>
          </div>
        )}
        {(status === 'denied' || status === 'unavailable' || status === 'error') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
            <CameraOff className="w-8 h-8 text-white/60" />
            <p className="text-xs font-bold">{errorMessage}</p>
            <Button variant="secondary" size="sm" onClick={onPickFromGallery}
              leftIcon={<ImagePlus className="w-4 h-4" />}>Upload instead</Button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <Button variant="ghost" size="sm" onClick={onPickFromGallery} className="!text-white/80 hover:!bg-white/10"
          leftIcon={<ImagePlus className="w-4 h-4" />}>Gallery</Button>
        <button type="button" onClick={() => void doCapture()} disabled={status !== 'active' || capturing || busy}
          aria-label="Capture receipt"
          className="w-14 h-14 rounded-full border-4 border-white/90 bg-white/10 flex items-center justify-center active:scale-95 transition disabled:opacity-40">
          {capturing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Aperture className="w-6 h-6" />}
        </button>
        <button type="button" onClick={() => setAutoEnabled((v) => !v)}
          className={`text-[10px] font-bold px-2.5 py-1.5 rounded-full ${autoEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/60'}`}>
          AUTO {autoEnabled ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
};
