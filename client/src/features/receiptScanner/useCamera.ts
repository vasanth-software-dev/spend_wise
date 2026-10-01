import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable' | 'error';

export interface UseCamera {
  status: CameraStatus;
  videoRef: React.RefObject<HTMLVideoElement>;
  streamRef: React.MutableRefObject<MediaStream | null>;
  errorMessage: string | null;
  hasCamera: boolean;
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * Owns the MediaStream lifecycle. Camera is only requested when `start()`
 * is called (user tapped Live Scan) and fully stopped on `stop()`/unmount.
 */
export function useCamera(): UseCamera {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestIdRef = useRef(0);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState(true);

  const stop = useCallback(() => {
    requestIdRef.current += 1;
    stopCameraStream(streamRef, videoRef);
    setStatus((s) => (s === 'active' || s === 'requesting' ? 'idle' : s));
  }, []);

  const start = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    stopCameraStream(streamRef, videoRef);
    if (!navigator.mediaDevices?.getUserMedia) {
      setHasCamera(false);
      setStatus('unavailable');
      setErrorMessage('This device or browser has no camera. Please use Upload instead.');
      return;
    }
    setStatus('requesting');
    setErrorMessage(null);
    try {
      // Prefer rear camera on mobile; desktop falls back to default.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      if (requestId !== requestIdRef.current) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stopCameraStream(streamRef, videoRef);
        setStatus('error');
        setErrorMessage('The camera preview could not be started. Please try again or use Upload.');
        return;
      }
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.muted = true;
      await video.play();
      if (requestId !== requestIdRef.current) {
        stopCameraStream(streamRef, videoRef);
        return;
      }
      setStatus('active');
    } catch (err: unknown) {
      if (requestId !== requestIdRef.current) return;
      stopCameraStream(streamRef, videoRef);
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setStatus('denied');
        setErrorMessage('Camera access was denied. Allow camera permission in your browser settings, or use Upload instead.');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setStatus('unavailable');
        setHasCamera(false);
        setErrorMessage('No camera was found on this device. Please use Upload instead.');
      } else {
        setStatus('error');
        setErrorMessage('The camera preview could not be started. Please try again or use Upload.');
      }
    }
  }, []);

  useEffect(() => () => {
    requestIdRef.current += 1;
    stopCameraStream(streamRef, videoRef);
  }, []);

  return { status, videoRef, streamRef, errorMessage, hasCamera, start, stop };
}

function stopCameraStream(
  streamRef: React.MutableRefObject<MediaStream | null>,
  videoRef: React.RefObject<HTMLVideoElement>
): void {
  const stream = streamRef.current;
  if (stream) {
    for (const track of stream.getTracks()) {
      try { track.stop(); } catch { /* already stopped */ }
    }
    streamRef.current = null;
  }
  const video = videoRef.current;
  if (video) {
    try { video.pause(); } catch { /* already stopped */ }
    video.srcObject = null;
  }
}
