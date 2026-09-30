import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Scale, AlertTriangle } from 'lucide-react';
import { StatCard } from '../../components/ui/StatCard.js';
import { StatCardSkeleton } from '../../components/ui/Skeleton.js';
import { formatINR } from '../../utils/format.js';
import type { DebtSummary } from '../../types/index.js';
export const DebtSummaryCards: React.FC<{ summary: DebtSummary | null; loading: boolean }> = ({ summary, loading }) => {
if (loading || !summary) return (<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">{[0, 1, 2, 3].map((i) => <StatCardSkeleton key={i} />)}</div>);
const activeCount = summary.activeDebts + summary.partiallyPaidDebts + summary.overdueDebts;
return (<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
<StatCard title="I Owe" amount={formatINR(summary.totalIOwe)} subtitle={`${activeCount} active debts`} icon={<ArrowUpRight className="w-4 h-4" />} accentColor="rose" />
<StatCard title="Owed to Me" amount={formatINR(summary.totalOwedToMe)} subtitle="Receivable balance" icon={<ArrowDownLeft className="w-4 h-4" />} accentColor="emerald" />
<StatCard title="Net Balance" amount={`${summary.netBalance >= 0 ? '+' : '-'}${formatINR(summary.netBalance)}`} subtitle={summary.netBalance >= 0 ? 'You are net positive' : 'You owe net'} icon={<Scale className="w-4 h-4" />} accentColor="blue" isHero />
<StatCard title="Overdue" amount={String(summary.overdueDebts)} subtitle={`${summary.settledDebts} settled`} icon={<AlertTriangle className="w-4 h-4" />} accentColor="amber" />
</div>); };
