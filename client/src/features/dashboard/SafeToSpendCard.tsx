import React, { useState } from 'react';
import { ShieldCheck, Calendar, Info, TrendingUp, ChevronRight } from 'lucide-react';
import { Card } from '../../components/ui/Card.js';
import { formatINR } from '../../utils/format.js';
import { SafeToSpendResult } from '../../utils/financialCalculations.js';
import { Link } from 'react-router-dom';

interface SafeToSpendCardProps {
  safeToSpendData: SafeToSpendResult;
  loading?: boolean;
}

export const SafeToSpendCard: React.FC<SafeToSpendCardProps> = ({ safeToSpendData, loading }) => {
  const [showExplanation, setShowExplanation] = useState(false);

  if (loading) {
    return (
      <Card className="p-6 relative overflow-hidden bg-slate-900 border-slate-800 animate-pulse">
        <div className="h-6 w-36 bg-slate-800 rounded mb-4" />
        <div className="h-10 w-48 bg-slate-800 rounded mb-2" />
        <div className="h-4 w-72 bg-slate-800 rounded" />
      </Card>
    );
  }

  const {
    safeToSpend,
    dailyRecommended,
    daysRemaining,
    currentBalance,
    upcomingObligations,
    cashBuffer,
    explanation,
  } = safeToSpendData;

  return (
    <Card className="relative overflow-hidden border border-emerald-500/20 dark:border-emerald-500/20 bg-gradient-to-br from-emerald-950/20 via-slate-900 to-slate-900/90 shadow-glow-emerald/20 p-5 sm:p-6 transition-all duration-200">
      {/* Decorative background glow */}
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3 flex-1">
          {/* Header Tag */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Discretionary Budget
            </span>
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="text-slate-400 hover:text-slate-200 transition-colors p-1"
              title="How is this calculated?"
              aria-label="How is Safe to Spend calculated?"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Safe to Spend Main Figure */}
          <div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-financial">
                {formatINR(safeToSpend)}
              </h2>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Safe to Spend
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-xl leading-relaxed">
              {explanation}
            </p>
          </div>

          {/* Collapsible Formula Breakdown */}
          {showExplanation && (
            <div className="mt-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-2 animate-in fade-in duration-150">
              <p className="font-semibold text-white">How Safe to Spend is Calculated:</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Total Balance</span>
                  <span className="font-bold text-white">{formatINR(currentBalance)}</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">- Upcoming Dues</span>
                  <span className="font-bold text-rose-400">{formatINR(upcomingObligations)}</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">- Cash Buffer</span>
                  <span className="font-bold text-amber-400">{formatINR(cashBuffer)}</span>
                </div>
                <div className="bg-emerald-950/40 p-2 rounded-lg border border-emerald-800/40">
                  <span className="text-emerald-400 block text-[10px]">= Discretionary</span>
                  <span className="font-bold text-emerald-400">{formatINR(safeToSpend)}</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                This is a dynamic budgeting guideline calculated strictly from your recorded balances, recurring commitments, and cash reserves. It is not financial advice.
              </p>
            </div>
          )}
        </div>

        {/* Right side actionable metric badges */}
        <div className="flex flex-row md:flex-col gap-3 flex-shrink-0">
          {/* Daily Recommended */}
          <div className="bg-white/80 dark:bg-slate-850/90 border border-slate-200/80 dark:border-white/10 rounded-xl p-3.5 shadow-2xs flex-1 md:flex-initial min-w-[140px]">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-semibold mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              Daily Recommended
            </div>
            <div className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tabular-financial">
              {formatINR(dailyRecommended)}
              <span className="text-[11px] font-medium text-slate-400">/day</span>
            </div>
          </div>

          {/* Days Remaining & Bills Considered */}
          <div className="bg-white/80 dark:bg-slate-850/90 border border-slate-200/80 dark:border-white/10 rounded-xl p-3.5 shadow-2xs flex-1 md:flex-initial min-w-[140px]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-semibold mb-0.5">
                  <Calendar className="w-3.5 h-3.5 text-brand-500" />
                  Remaining
                </div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {daysRemaining} days left
                </div>
              </div>
              <Link
                to="/recurring"
                className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-0.5"
                title="View recurring obligations"
              >
                <span>Bills</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
