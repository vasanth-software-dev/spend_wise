import React from 'react';
import { GUIDANCE_COPY, guidanceTone, GUIDE_RECT, type Point, type DetectionGuidance } from './receiptDetection.js';

interface Props {
  quad: Point[] | null;
  guidance: DetectionGuidance;
  ready: boolean;
}

/** Document frame overlay: guide rect + detected quad + guidance pill. */
export const ScannerOverlay: React.FC<Props> = ({ quad, guidance, ready }) => {
  const tone = guidanceTone(guidance);
  const frameColor = ready || tone === 'good' ? '#10b981' : tone === 'warn' ? '#f59e0b' : 'rgba(255,255,255,0.85)';
  const quadPoints = quad ? quad.map((p) => `${(p.x * 100).toFixed(1)},${(p.y * 100).toFixed(1)}`).join(' ') : null;
  return (
    <div className="pointer-events-none absolute inset-0">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <rect x={GUIDE_RECT.x * 100} y={GUIDE_RECT.y * 100} width={GUIDE_RECT.w * 100} height={GUIDE_RECT.h * 100}
          fill="none" stroke={frameColor} strokeWidth={0.8} rx={2} strokeDasharray={ready ? 'none' : '3 2'} />
        {quadPoints && (
          <polygon points={quadPoints} fill="rgba(16,185,129,0.08)" stroke="#10b981" strokeWidth={0.6} />
        )}
        {[0, 1, 2, 3].map((i) => {
          const cx = (GUIDE_RECT.x + (i % 2) * GUIDE_RECT.w) * 100;
          const cy = (GUIDE_RECT.y + Math.floor(i / 2) * GUIDE_RECT.h) * 100;
          return <circle key={i} cx={cx} cy={cy} r={1.4} fill={frameColor} />;
        })}
      </svg>
      <div className="absolute left-0 right-0 flex justify-center" style={{ top: '78%' }}>
        <span className={`px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-md ${
          ready || tone === 'good'
            ? 'bg-emerald-500/90 text-white'
            : tone === 'warn'
              ? 'bg-amber-500/90 text-white'
              : 'bg-slate-950/70 text-white'
        }`}>
          {ready ? 'Receipt detected — capturing…' : GUIDANCE_COPY[guidance]}
        </span>
      </div>
    </div>
  );
};
