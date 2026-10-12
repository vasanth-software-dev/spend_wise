import React from 'react';
import { Sparkles, AlertTriangle, CheckCircle, Calendar } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card.js';
import { SpendingInsight } from '../../utils/financialCalculations.js';

interface SpendingInsightsWidgetProps {
  insights: SpendingInsight[];
  loading?: boolean;
}

export const SpendingInsightsWidget: React.FC<SpendingInsightsWidgetProps> = ({ insights, loading }) => {
  if (loading) {
    return (
      <Card className="p-6">
        <div className="h-6 w-40 bg-slate-800 rounded animate-pulse mb-3" />
        <div className="space-y-3">
          <div className="h-16 bg-slate-800/60 rounded-xl animate-pulse" />
          <div className="h-16 bg-slate-800/60 rounded-xl animate-pulse" />
        </div>
      </Card>
    );
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'positive':
        return <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
      case 'info':
        return <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />;
      default:
        return <Sparkles className="w-4 h-4 text-brand-500 flex-shrink-0" />;
    }
  };

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'positive':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'warning':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'info':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      default:
        return 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20';
    }
  };

  return (
    <Card className="p-5 sm:p-6 flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-sm sm:text-base">Spending Insights</CardTitle>
                <CardDescription>Automated observations from your confirmed ledger</CardDescription>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              Deterministic
            </span>
          </div>
        </CardHeader>

        <div className="mt-3.5 space-y-2.5">
          {insights.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 font-medium">
              Record more transactions to unlock automated spending insights.
            </div>
          ) : (
            insights.map((insight) => (
              <div
                key={insight.id}
                className="p-3.5 rounded-xl bg-slate-50/60 dark:bg-slate-850/60 border border-slate-200/60 dark:border-slate-800/80 flex items-start gap-3 transition-colors hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="mt-0.5">{getInsightIcon(insight.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {insight.title}
                    </span>
                    {insight.metric && (
                      <span
                        className={`text-[10px] font-extrabold font-mono px-1.5 py-0.5 rounded border ${getBadgeStyle(
                          insight.type
                        )}`}
                      >
                        {insight.metric}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {insight.message}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
};
