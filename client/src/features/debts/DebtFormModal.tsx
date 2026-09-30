import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/index.js';
import { createDebtThunk, updateDebtThunk } from '../../store/slices/debtSlice.js';
import { fetchCategoriesThunk } from '../../store/slices/categorySlice.js';
import { Modal } from '../../components/ui/Modal.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { CategorySelect } from '../../components/ui/CategorySelect.js';
import { toast } from '../../components/ui/Toast.js';
import type { Debt, DebtDirection } from '../../types/index.js';
interface Props { isOpen: boolean; onClose: () => void; debt?: Debt | null; }
const toInput = (v?: string | null) => { if (!v) return ''; const d = new Date(v); return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0]; };
export const DebtFormModal: React.FC<Props> = ({ isOpen, onClose, debt }) => {
const dispatch = useAppDispatch();
const categories = useAppSelector((s) => s.categories.categories);
const editing = !!debt;
const [personName, setPersonName] = useState('');
const [direction, setDirection] = useState<DebtDirection>('I_OWE');
const [amount, setAmount] = useState('');
const [description, setDescription] = useState('');
const [debtDate, setDebtDate] = useState(new Date().toISOString().split('T')[0]);
const [dueDate, setDueDate] = useState('');
const [categoryId, setCategoryId] = useState('');
const [notes, setNotes] = useState('');
const [error, setError] = useState<string | null>(null);
const [busy, setBusy] = useState(false);
useEffect(() => { if (!isOpen) return; dispatch(fetchCategoriesThunk());
if (debt) { setPersonName(debt.personName ?? ''); setDirection(debt.direction); setAmount(String(debt.originalAmount)); setDescription(debt.description ?? ''); setDebtDate(toInput(debt.debtDate) || new Date().toISOString().split('T')[0]); setDueDate(toInput(debt.dueDate ?? null)); setCategoryId(typeof debt.categoryId === 'object' && debt.categoryId !== null ? (debt.categoryId as { _id: string })._id : ((debt.categoryId as string) || '')); setNotes(debt.notes ?? ''); setError(null); }
else { setPersonName(''); setDirection('I_OWE'); setAmount(''); setDescription(''); setDebtDate(new Date().toISOString().split('T')[0]); setDueDate(''); setCategoryId(''); setNotes(''); setError(null); }
}, [isOpen, debt, dispatch]);
const submit = async (e: React.FormEvent) => { e.preventDefault();
const n = parseFloat(amount);
if (!personName.trim()) return setError('Person / contact name is required');
if (isNaN(n) || n <= 0) return setError('Amount must be greater than 0');
if (!debtDate || isNaN(new Date(debtDate).getTime())) return setError('Debt date is invalid');
if (dueDate && isNaN(new Date(dueDate).getTime())) return setError('Due date is invalid');
if (editing && debt && n < (debt.totalPaid ?? 0)) return setError('Amount cannot be below already-paid total');
setBusy(true); setError(null);
try { const payload = { personName: personName.trim(), direction, originalAmount: n, description: description.trim() || undefined, debtDate, dueDate: dueDate || null, categoryId: categoryId || null, notes: notes.trim() || undefined };
if (editing && debt) { await dispatch(updateDebtThunk({ id: debt._id, data: payload })).unwrap(); toast.success('Debt updated'); }
else { await dispatch(createDebtThunk(payload)).unwrap(); toast.success('Debt added'); }
onClose(); } catch (err: any) { const m = typeof err === 'string' ? err : err?.message || 'Failed to save debt'; setError(m); toast.error(m); } finally { setBusy(false); } };
const inp = 'w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm';
return (<Modal isOpen={isOpen} onClose={onClose} title={editing ? 'Edit Debt' : 'Add Debt'} description="Status recalculates automatically from payments.">
<form onSubmit={submit} className="space-y-4">
<Input label="Person / Contact *" placeholder="e.g. Rahul Sharma" value={personName} onChange={(e) => setPersonName(e.target.value)} required />
<div>
<label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Direction *</label>
<div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Debt direction">
<button type="button" role="radio" aria-checked={direction === 'I_OWE'} onClick={() => setDirection('I_OWE')} className={`text-left p-3 rounded-xl border ${direction === 'I_OWE' ? 'border-rose-500 bg-rose-500/10 ring-1 ring-rose-500' : 'border-slate-200 dark:border-slate-700'}`}>
<span className="block text-xs font-bold">I owe this person</span>
<span className="block text-[11px] text-slate-500 mt-0.5">Repayment sends money out</span>
</button>
<button type="button" role="radio" aria-checked={direction === 'OWED_TO_ME'} onClick={() => setDirection('OWED_TO_ME')} className={`text-left p-3 rounded-xl border ${direction === 'OWED_TO_ME' ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500' : 'border-slate-200 dark:border-slate-700'}`}>
<span className="block text-xs font-bold">Owes me</span>
<span className="block text-[11px] text-slate-500 mt-0.5">Repayment brings money in</span>
</button>
</div>
</div>
<Input label="Amount (INR) *" type="number" min="0.01" step="0.01" placeholder="e.g. 2000" value={amount} onChange={(e) => setAmount(e.target.value)} required />
<Input label="Description / Reason" placeholder="e.g. Dinner split, hand loan" value={description} onChange={(e) => setDescription(e.target.value)} />
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
<div><label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Debt Date *</label><input type="date" value={debtDate} onChange={(e) => setDebtDate(e.target.value)} required className={inp} /></div>
<div><label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Due Date</label><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inp} /></div>
</div>
<div><label className="block text-xs font-semibold text-slate-500 mb-1">Category</label><CategorySelect categories={categories} value={categoryId} onChange={setCategoryId} placeholder="No category" grouped /></div>
<div><label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Extra context" className={`${inp} resize-none`} /></div>
{error && <p role="alert" className="text-xs font-medium text-rose-600 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">{error}</p>}
<div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800"><Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" size="sm" isLoading={busy}>{editing ? 'Save Changes' : 'Add Debt'}</Button></div>
</form></Modal>); };
