import React from 'react';
import { X, Calendar, Tag, Trash2, Edit3, Wallet } from 'lucide-react';
import type { Debt } from '../../types/index.js';
import { formatINR, formatDate } from '../../utils/format.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { CategoryIcon } from '../../components/ui/CategoryIcon.js';
import { DEBT_STATUS_META, DEBT_DIRECTION_META } from './debtUtils.js';
interface Props { debt: Debt | null; isOpen: boolean; onClose: () => void; onRecordPayment: () => void; onEdit: () => void; onDelete: () => void; onSettle: () => void; }
export const DebtDetailsDrawer: React.FC<Props> = ({ debt, isOpen, onClose, onRecordPayment, onEdit, onDelete, onSettle }) => {
React.useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
if (!isOpen || !debt) return null;
const totalPaid = debt.totalPaid ?? 0;
const remaining = debt.remainingAmount ?? Math.max(0, debt.originalAmount - totalPaid);
const status = debt.status ?? 'ACTIVE';
const meta = DEBT_STATUS_META[status];
const dir = DEBT_DIRECTION_META[debt.direction];
const catName = typeof debt.categoryId === 'object' && debt.categoryId !== null ? (debt.categoryId as { name?: string }).name : undefined;
return (<div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-label="Debt details">
<div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
<aside className="relative w-full max-w-md h-full bg-white dark:bg-[#0d1322] border-l border-slate-200 dark:border-white/10 shadow-fintech-lg p-5 sm:p-6 overflow-y-auto animate-in slide-in-from-right duration-200">
<div className="flex items-start justify-between gap-3">
<div><h2 className="text-lg font-extrabold tracking-tight">{debt.personName}</h2><p className="text-xs text-slate-500 mt-0.5">{debt.description || dir.label}</p></div>
<button onClick={onClose} aria-label="Close details" className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
</div>
<div className="flex flex-wrap gap-1.5 mt-3"><Badge variant={meta.variant} dot>{meta.label}</Badge><Badge variant={debt.direction === 'I_OWE' ? 'rose' : 'emerald'}>{dir.label}</Badge>{debt.dueDate && <Badge variant="slate">Due {formatDate(debt.dueDate, 'dd MMM')}</Badge>}</div>
<div className="grid grid-cols-3 gap-2 mt-4">
<div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3"><p className="text-[10px] uppercase font-bold text-slate-400">Original</p><p className="text-sm font-extrabold mt-1">{formatINR(debt.originalAmount)}</p></div>
<div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3"><p className="text-[10px] uppercase font-bold text-slate-400">Paid</p><p className="text-sm font-extrabold mt-1 text-emerald-600">{formatINR(totalPaid)}</p></div>
<div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3"><p className="text-[10px] uppercase font-bold text-slate-400">Remaining</p><p className="text-sm font-extrabold mt-1">{formatINR(remaining)}</p></div>
</div>
<div className="mt-4 space-y-2 text-xs">
<div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2"><span className="text-slate-500 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Due</span><span className="font-semibold">{debt.dueDate ? formatDate(debt.dueDate) : 'No due date'}</span></div>
<div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2"><span className="text-slate-500">Created</span><span className="font-semibold">{formatDate(debt.createdAt)}</span></div>
{catName && <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2"><span className="text-slate-500 flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Category</span><span className="font-semibold flex items-center gap-1.5"><CategoryIcon name={(debt.categoryId as { icon?: string })?.icon} className="w-3.5 h-3.5" />{catName}</span></div>}
{debt.notes && <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-slate-600 dark:text-slate-300">{debt.notes}</div>}
</div>
<div className="mt-5"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Payment History</h3>
{(debt.payments ?? []).length === 0 ? <p className="text-xs text-slate-400">No payments yet.</p> : <div className="space-y-2">{(debt.payments ?? []).map((p) => (<div key={p._id} className="flex justify-between items-center rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs"><span>{formatDate(p.paymentDate, 'dd MMM yyyy')}{p.note ? ` — ${p.note}` : ''}</span><strong>{formatINR(p.amount)}</strong></div>))}</div>}
</div>
<div className="mt-5 grid grid-cols-2 gap-2">
<Button size="sm" variant="primary" onClick={onRecordPayment} disabled={remaining === 0}>Record Payment</Button>
{remaining > 0 && <Button size="sm" variant="success" onClick={onSettle}>Mark Settled</Button>}
<Button size="sm" variant="outline" onClick={onEdit} leftIcon={<Edit3 className="w-3.5 h-3.5" />}>Edit</Button>
<Button size="sm" variant="danger" onClick={onDelete} leftIcon={<Trash2 className="w-3.5 h-3.5" />}>Delete</Button>
</div>
</aside></div>); };
