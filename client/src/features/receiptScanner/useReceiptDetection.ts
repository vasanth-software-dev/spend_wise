import { useEffect, useRef, useState } from 'react';
import { analyzeFrame, DEFAULT_TUNING, type DetectionGuidance, type Point } from './receiptDetection.js';

export interface DetectionState {
  guidance: DetectionGuidance;
  quad: Point[] | null;
  ready: boolean;
  stableFrames: number;
}

const INITIAL: DetectionState = { guidance: 'NO_RECEIPT', quad: null, ready: false, stableFrames: 0 };

/**
 * Lightweight detection loop: samples a ~96px-wide frame ~5x/sec,
 * keeps the last gray buffer for stability, and counts consecutive
 * READY frames. No OCR here — that runs once, after capture.
 */
export function useReceiptDetection(
  videoRef: React.RefObject<HTMLVideoElement>,
  active: boolean,
  onReady?: () => void,
): DetectionState {
  const [state, setState] = useState<DetectionState>(INITIAL);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!active) {
      setState(INITIAL);
      return;
    }
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let prev: Float32Array | null = null;
    let readyCount = 0;
    let lastSample = 0;
    let disposed = false;
    const canvas = document.createElement('canvas');
    const W = 96;

    const sample = () => {
      if (disposed) return;
      timer = setTimeout(() => { raf = requestAnimationFrame(sample); }, 200);
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;
      const now = performance.now();
      if (now - lastSample < 180) return;
      lastSample = now;
      const scale = W / video.videoWidth;
      const H = Math.max(1, Math.round(video.videoHeight * scale));
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      try {
        ctx.drawImage(video, 0, 0, W, H);
        const img = ctx.getImageData(0, 0, W, H);
        const r = analyzeFrame(img.data, W, H, prev, DEFAULT_TUNING);
        prev = r.gray;
        if (r.guidance === 'READY') {
          readyCount += 1;
          if (readyCount >= 6 && !stateRef.current.ready) {
            setState({ guidance: 'READY', quad: r.quad, ready: true, stableFrames: readyCount });
            onReadyRef.current?.();
            return;
          }
        } else {
          readyCount = 0;
        }
        const s = stateRef.current;
        if (s.guidance !== r.guidance || s.ready || JSON.stringify(s.quad) !== JSON.stringify(r.quad)) {
          setState({ guidance: r.guidance, quad: r.quad, ready: false, stableFrames: readyCount });
        }
      } catch { /* frame read race — skip */ }
    };
    raf = requestAnimationFrame(sample);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
      prev = null;
      canvas.width = 0; canvas.height = 0;
    };
  }, [active, videoRef]);

  return state;
}
