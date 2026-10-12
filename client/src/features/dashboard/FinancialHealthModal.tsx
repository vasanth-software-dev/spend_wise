import React from 'react';
import { X, CheckCircle2, AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react';
import { FinancialHealthScore } from '../../utils/financialCalculations.js';

interface FinancialHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  healthScore: FinancialHealthScore;
}

export const FinancialHealthModal: React.FC<FinancialHealthModalProps> = ({
  isOpen,
  onClose,
  healthScore,
}) => {
  if (!isOpen) return null;

  const getStatusIcon = (status: 'excellent' | 'good' | 'fair' | 'poor') => {
    switch (status) {
      case 'excellent':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'good':
        return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
      case 'fair':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'poor':
        return <AlertCircle className="w-4 h-4 text-rose-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white dark:bg-[#0c121e] border border-slate-200 dark:border-white/10 rounded-2xl shadow-fintech-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
              <HelpCircle className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Financial Health Score Methodology
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Transparent & deterministic budgeting wellness index
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
          {/* Overview Banner */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Current Health Rating
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className={`text-2xl font-black ${healthScore.gradeColor}`}>
                  {healthScore.totalScore}
                  <span className="text-sm font-semibold text-slate-400">/100</span>
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${healthScore.gradeColor} bg-slate-200/50 dark:bg-slate-800`}>
                  {healthScore.grade}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs text-right">
              {healthScore.summary}
            </p>
          </div>

          {/* Factor Breakdown */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Scoring Factors Breakdown
            </h4>

            {healthScore.factors.map((factor) => {
              const pct = Math.round((factor.score / factor.maxScore) * 100);
              return (
                <div
                  key={factor.name}
                  className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-850/50 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(factor.status)}
                      <span className="text-slate-800 dark:text-slate-200">{factor.name}</span>
                    </div>
                    <span className="font-mono text-slate-900 dark:text-white">
                      {factor.score} / {factor.maxScore} pts
                    </span>
                  </div>

                  {/* Progress meter */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {factor.description}
                  </p>
                  <p className="text-[11px] font-medium text-brand-600 dark:text-brand-400 bg-brand-500/5 dark:bg-brand-500/10 p-2 rounded-lg">
                    💡 Tip: {factor.recommendation}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Legal / Non-credit Score Disclaimer */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
            <strong>Notice:</strong> SpendWise Financial Health is a personalized personal budgeting metric calculated strictly from your entered data, savings rates, and budget pacing. It is not an official credit bureau score (such as CIBIL, Equifax, or Experian) and does not represent creditworthiness.
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
