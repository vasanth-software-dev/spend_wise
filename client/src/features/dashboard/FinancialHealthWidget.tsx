import React, { useState } from 'react';
import { Activity, HelpCircle, ArrowRight } from 'lucide-react';
import { Card } from '../../components/ui/Card.js';
import { FinancialHealthScore } from '../../utils/financialCalculations.js';
import { FinancialHealthModal } from './FinancialHealthModal.js';

interface FinancialHealthWidgetProps {
  healthScore: FinancialHealthScore;
  loading?: boolean;
}

export const FinancialHealthWidget: React.FC<FinancialHealthWidgetProps> = ({
  healthScore,
  loading,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="h-6 w-36 bg-slate-800 rounded animate-pulse mb-3" />
        <div className="h-16 w-32 bg-slate-800 rounded animate-pulse" />
      </Card>
    );
  }

  const { totalScore, grade, gradeColor, summary, factors } = healthScore;

  // Circular gauge calculations
  const strokeDashoffset = 251.2 - (251.2 * totalScore) / 100;

  return (
    <>
      <Card className="p-5 sm:p-6 relative overflow-hidden flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Financial Health
                </h3>
                <p className="text-[11px] text-slate-400">Deterministic wellness index</p>
              </div>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>How is this calculated?</span>
            </button>
          </div>

          {/* Main Score Display with SVG circular ring */}
          <div className="flex items-center gap-5 my-4">
            <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                <circle
                  className="text-slate-100 dark:text-slate-800"
                  strokeWidth="8"
                  stroke="currentColor"
                  fill="transparent"
                  r="40"
                  cx="50"
                  cy="50"
                />
                <circle
                  className={
                    totalScore >= 80
                      ? 'text-emerald-500'
                      : totalScore >= 65
                      ? 'text-blue-500'
                      : totalScore >= 50
                      ? 'text-amber-500'
                      : 'text-rose-500'
                  }
                  strokeWidth="8"
                  strokeDasharray="251.2"
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="40"
                  cx="50"
                  cy="50"
                  style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-xl font-extrabold font-mono ${gradeColor}`}>
                  {totalScore}
                </span>
                <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">
                  / 100
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-extrabold ${gradeColor}`}>{grade}</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="text-xs text-slate-500 font-medium">Fintech Grade</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug line-clamp-2">
                {summary}
              </p>
            </div>
          </div>

          {/* Top Key Factors preview */}
          <div className="space-y-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            {factors.slice(0, 3).map((f) => (
              <div key={f.name} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      f.status === 'excellent'
                        ? 'bg-emerald-500'
                        : f.status === 'good'
                        ? 'bg-blue-500'
                        : f.status === 'fair'
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                  />
                  {f.name}
                </span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {f.score} / {f.maxScore}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center justify-center gap-1 transition-colors w-full"
        >
          View detailed factor analysis
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </Card>

      <FinancialHealthModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        healthScore={healthScore}
      />
    </>
  );
};
