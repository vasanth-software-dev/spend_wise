import React, { useState } from 'react';
import { useAppDispatch } from '../../store/index.js';
import { recordPaymentThunk } from '../../store/slices/debtSlice.js';
import { Modal } from '../../components/ui/Modal.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { toast } from '../../components/ui/Toast.js';
import { formatINR } from '../../utils/format.js';
import type { Debt } from '../../types/index.js';
import { getDebtRemaining } from './debtUtils.js';
interface Props { isOpen: boolean; onClose: () => void; debt: Debt | null; }
export const RecordPaymentModal: React.FC<Props> = ({ isOpen, onClose, debt }) => {
const dispatch = useAppDispatch();
const [amount, setAmount] = useState('');
const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
const [note, setNote] = useState('');
const [error, setError] = useState<string | null>(null);
const [busy, setBusy] = useState(false);
if (!debt) return null;
const remaining = getDebtRemaining(debt);
const numeric = parseFloat(amount);
const after = !isNaN(numeric) ? Math.max(0, remaining - numeric) : remaining;
const submit = async (e: React.FormEvent) => { e.preventDefault();
if (isNaN(numeric) || numeric <= 0) return setError('Payment amount must be greater than 0');
if (numeric > remaining) return setError(`Payment cannot exceed remaining ${formatINR(remaining)}`);
setBusy(true); setError(null);
try { await dispatch(recordPaymentThunk({ id: debt._id, data: { amount: numeric, paymentDate: date, note: note.trim() || undefined } })).unwrap();
toast.success(after === 0 ? 'Payment recorded — debt settled!' : 'Payment recorded');
setAmount(''); setNote(''); onClose(); }
catch (err: any) { const m = typeof err === 'string' ? err : err?.message || 'Failed to record payment'; setError(m); toast.error(m); }
finally { setBusy(false); } };
return (<Modal isOpen={isOpen} onClose={onClose} title="Record Payment" description={`${debt.personName} — remaining ${formatINR(remaining)}`}>
<form onSubmit={submit} className="space-y-4">
<div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3 text-xs flex justify-between"><span>Remaining</span><strong>{formatINR(remaining)}</strong></div>
<Input label="Payment Amount (INR) *" type="number" min="0.01" max={remaining} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
<div><label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Payment Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm" /></div>
<Input label="Note" placeholder="e.g. UPI, cash" value={note} onChange={(e) => setNote(e.target.value)} />
<div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-xs flex justify-between"><span>Remaining after payment</span><strong>{formatINR(after)}</strong></div>
{error && <p role="alert" className="text-xs text-rose-600 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">{error}</p>}
<div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800"><Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" size="sm" isLoading={busy}>Record Payment</Button></div>
</form></Modal>); };
