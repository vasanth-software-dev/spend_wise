import React from 'react';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import type { Debt } from '../../types/index.js';
import { formatINR, formatDate } from '../../utils/format.js';
import { Badge } from '../../components/ui/Badge.js';
import { Card } from '../../components/ui/Card.js';
import { TableRowSkeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { DEBT_STATUS_META, getDebtRemaining, getDebtStatus } from './debtUtils.js';
import { Coins } from 'lucide-react';
interface Props { debts: Debt[]; loading: boolean; onOpen: (d: Debt) => void; onAdd: () => void; }
export const DebtList: React.FC<Props> = ({ debts, loading, onOpen, onAdd }) => {
if (loading) return (<Card className="p-0 overflow-hidden"><div className="p-2">{[0, 1, 2, 3].map((i) => <TableRowSkeleton key={i} />)}</div></Card>);
if (debts.length === 0) return (<EmptyState icon={<Coins className="w-8 h-8 text-slate-400" />} title="No debts yet" description="Keep track of money you owe and money others owe you. Add your first debt to get started." actionText="+ Add Debt" onAction={onAdd} className="py-16" />);
const row = (d: Debt) => {
const remaining = getDebtRemaining(d); const status = getDebtStatus(d); const meta = DEBT_STATUS_META[status];
const dirOwe = d.direction === 'I_OWE';
return (<button key={d._id} onClick={() => onOpen(d)} className="w-full text-left px-4 py-3.5 border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors last:border-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500/30">
<div className="flex items-center justify-between gap-3">
<div className="flex items-center gap-3 min-w-0">
<div className={`w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0 ${dirOwe ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'}`}>{dirOwe ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}</div>
<div className="min-w-0"><p className="text-sm font-bold truncate">{d.personName}</p><p className="text-[11px] text-slate-400 truncate">{d.description || 'No description'} • Due {d.dueDate ? formatDate(d.dueDate, 'dd MMM') : '—'}</p></div>
</div>
<div className="text-right flex-shrink-0"><p className="text-sm font-extrabold tabular-nums">{formatINR(remaining)}</p><div className="mt-1 flex justify-end gap-1"><Badge variant={meta.variant} size="sm">{meta.label}</Badge><Badge variant={dirOwe ? 'rose' : 'emerald'} size="sm">{dirOwe ? 'I Owe' : 'Owed'}</Badge></div></div>
</div>
<div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className={`h-full rounded-full ${status === 'SETTLED' ? 'bg-emerald-500' : dirOwe ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${d.originalAmount > 0 ? Math.min(100, ((d.totalPaid ?? 0) / d.originalAmount) * 100) : 0}%` }} /></div>
</button>); };
return (<>
<div className="lg:hidden space-y-2.5">{debts.map((d) => { const remaining = getDebtRemaining(d); const status = getDebtStatus(d); const meta = DEBT_STATUS_META[status]; const dirOwe = d.direction === 'I_OWE';
return (<Card key={d._id} interactive className="p-4" onClick={() => onOpen(d)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(d); }} tabIndex={0} role="button" aria-label={`Open debt with ${d.personName}`}>
<div className="flex items-start justify-between gap-2"><div className="flex items-center gap-2.5"><div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${dirOwe ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'}`}>{dirOwe ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}</div><div><p className="text-sm font-bold">{d.personName}</p><p className="text-[11px] text-slate-400">{d.description || 'No description'}</p></div></div><p className="text-sm font-extrabold">{formatINR(remaining)}</p></div>
<div className="mt-3 flex flex-wrap gap-1.5"><Badge variant={meta.variant} size="sm" dot>{meta.label}</Badge><Badge variant={dirOwe ? 'rose' : 'emerald'} size="sm">{dirOwe ? 'I Owe' : 'Owed to Me'}</Badge><Badge variant="slate" size="sm">Due {d.dueDate ? formatDate(d.dueDate, 'dd MMM') : '—'}</Badge></div>
<div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className={`h-full rounded-full ${status === 'SETTLED' ? 'bg-emerald-500' : dirOwe ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${d.originalAmount > 0 ? Math.min(100, ((d.totalPaid ?? 0) / d.originalAmount) * 100) : 0}%` }} /></div>
<p className="mt-2 text-[11px] text-slate-400">Paid {formatINR(d.totalPaid ?? 0)} of {formatINR(d.originalAmount)} • Created {formatDate(d.createdAt, 'dd MMM')}</p>
</Card>); })}</div>
<Card className="p-0 overflow-hidden hidden lg:block"><div className="hidden lg:grid grid-cols-[1.4fr_1.6fr_0.9fr_0.9fr_0.8fr_0.8fr_0.8fr] gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30"><span>Person</span><span>Description</span><span className="text-right">Amount</span><span className="text-right">Remaining</span><span>Direction</span><span>Due</span><span>Status</span></div><div>{debts.map(row)}</div></Card>
</>); };
