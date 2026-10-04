import React, { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/index.js';
import { createDebtThunk, updateDebtThunk } from '../../store/slices/debtSlice.js';
import { fetchCategoriesThunk } from '../../store/slices/categorySlice.js';
import { Modal } from '../../components/ui/Modal.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { CategorySelect } from '../../components/ui/CategorySelect.js';
import { toast } from '../../components/ui/Toast.js';
import { api } from '../../services/api.js';
import type { Debt, DebtDirection, Person } from '../../types/index.js';
import { Users, PenLine, Search, Check, Star } from 'lucide-react';
interface Props { isOpen: boolean; onClose: () => void; debt?: Debt | null; }
const toInput = (v?: string | null) => { if (!v) return ''; const d = new Date(v); return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0]; };
const debtPersonId = (d?: Debt | null): string => { if (!d?.personId) return ''; return typeof d.personId === 'object' ? (d.personId as Person)._id : String(d.personId); };
type SourceMode = 'person' | 'manual';
export const DebtFormModal: React.FC<Props> = ({ isOpen, onClose, debt }) => {
const dispatch = useAppDispatch();
const categories = useAppSelector((s) => s.categories.categories);
const editing = !!debt;
const [mode, setMode] = useState<SourceMode>('person');
const [people, setPeople] = useState<Person[]>([]);
const [peopleLoading, setPeopleLoading] = useState(false);
const [personSearch, setPersonSearch] = useState('');
const [selectedPersonId, setSelectedPersonId] = useState('');
const [manualName, setManualName] = useState('');
const [direction, setDirection] = useState<DebtDirection>('I_OWE');
const [amount, setAmount] = useState('');
const [description, setDescription] = useState('');
const [debtDate, setDebtDate] = useState(new Date().toISOString().split('T')[0]);
const [dueDate, setDueDate] = useState('');
const [categoryId, setCategoryId] = useState('');
const [notes, setNotes] = useState('');
const [error, setError] = useState<string | null>(null);
const [busy, setBusy] = useState(false);
useEffect(() => { if (!isOpen) return; dispatch(fetchCategoriesThunk()); setPeopleLoading(true);
api.get('/people').then((r) => setPeople(r.data?.data?.people ?? [])).catch(() => setPeople([])).finally(() => setPeopleLoading(false));
}, [isOpen, dispatch]);
useEffect(() => { if (!isOpen) return;
if (debt) { const pid = debtPersonId(debt); if (pid) { setMode('person'); setSelectedPersonId(pid); setManualName(''); } else { setMode('manual'); setSelectedPersonId(''); setManualName(debt.personName ?? ''); } setPersonSearch(''); setDirection(debt.direction); setAmount(String(debt.originalAmount)); setDescription(debt.description ?? ''); setDebtDate(toInput(debt.debtDate) || new Date().toISOString().split('T')[0]); setDueDate(toInput(debt.dueDate ?? null)); setCategoryId(typeof debt.categoryId === 'object' && debt.categoryId !== null ? (debt.categoryId as { _id: string })._id : ((debt.categoryId as string) || '')); setNotes(debt.notes ?? ''); setError(null); }
else { setMode('person'); setSelectedPersonId(''); setManualName(''); setPersonSearch(''); setDirection('I_OWE'); setAmount(''); setDescription(''); setDebtDate(new Date().toISOString().split('T')[0]); setDueDate(''); setCategoryId(''); setNotes(''); setError(null); }
}, [isOpen, debt]);
const filteredPeople = useMemo(() => { const q = personSearch.trim().toLowerCase(); if (!q) return people; return people.filter((p) => `${p.name} ${p.vpa ?? ''} ${p.email ?? ''}`.toLowerCase().includes(q)); }, [people, personSearch]);
const submit = async (e: React.FormEvent) => { e.preventDefault();
const n = parseFloat(amount);
if (mode === 'person' && !selectedPersonId) return setError('Select a person from People');
if (mode === 'manual' && !manualName.trim()) return setError('Enter a name (e.g. HDFC Personal Loan)');
if (isNaN(n) || n <= 0) return setError('Amount must be greater than 0');
if (!debtDate || isNaN(new Date(debtDate).getTime())) return setError('Debt date is invalid');
if (dueDate && isNaN(new Date(dueDate).getTime())) return setError('Due date is invalid');
if (editing && debt && n < (debt.totalPaid ?? 0)) return setError('Amount cannot be below already-paid total');
setBusy(true); setError(null);
try { const personPayload = mode === 'person' ? { personId: selectedPersonId } : { personId: null, personName: manualName.trim() };
const payload = { ...personPayload, direction, originalAmount: n, description: description.trim() || undefined, debtDate, dueDate: dueDate || null, categoryId: categoryId || null, notes: notes.trim() || undefined };
if (editing && debt) { await dispatch(updateDebtThunk({ id: debt._id, data: payload })).unwrap(); toast.success('Debt updated'); }
else { await dispatch(createDebtThunk(payload)).unwrap(); toast.success('Debt added'); }
onClose(); } catch (err: any) { const m = typeof err === 'string' ? err : err?.message || 'Failed to save debt'; setError(m); toast.error(m); } finally { setBusy(false); } };
const inp = 'w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm';
return (<Modal isOpen={isOpen} onClose={onClose} title={editing ? 'Edit Debt' : 'Add Debt'} description="Status recalculates automatically from payments.">
<form onSubmit={submit} className="space-y-4">
<div><label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Person / Contact *</label>
<div className="grid grid-cols-2 gap-2 mb-2"><button type="button" onClick={() => setMode('person')} className={`flex items-center gap-2 p-2.5 rounded-xl border text-left ${mode === 'person' ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500' : 'border-slate-200 dark:border-slate-700'}`}><Users className="w-4 h-4" /><span><span className="block text-xs font-bold">From People</span><span className="block text-[11px] text-slate-500">Saved contact</span></span></button><button type="button" onClick={() => setMode('manual')} className={`flex items-center gap-2 p-2.5 rounded-xl border text-left ${mode === 'manual' ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500' : 'border-slate-200 dark:border-slate-700'}`}><PenLine className="w-4 h-4" /><span><span className="block text-xs font-bold">Manual entry</span><span className="block text-[11px] text-slate-500">Bank loan, etc.</span></span></button></div>
{mode === 'person' ? (<div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"><div className="relative border-b border-slate-200 dark:border-slate-700"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input value={personSearch} onChange={(e) => setPersonSearch(e.target.value)} placeholder="Search people..." className="w-full pl-9 pr-3 py-2 text-sm bg-transparent focus:outline-none" /></div><div className="max-h-44 overflow-y-auto">{peopleLoading ? <p className="px-3 py-4 text-xs text-slate-400">Loading people…</p> : filteredPeople.length === 0 ? <p className="px-3 py-4 text-xs text-slate-500">No match. <button type="button" onClick={() => setMode('manual')} className="font-bold text-brand-600 hover:underline">Use manual entry</button></p> : filteredPeople.map((p) => (<button key={p._id} type="button" onClick={() => setSelectedPersonId(p._id)} className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60 ${p._id === selectedPersonId ? 'bg-brand-500/10' : ''}`}><span className="min-w-0"><span className="flex items-center gap-1.5 font-semibold truncate">{p.name}{p.isFavorite && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}</span><span className="block text-[11px] text-slate-400 truncate">{p.vpa || p.email || 'No VPA / email'}</span></span>{p._id === selectedPersonId && <Check className="w-4 h-4 text-brand-600" />}</button>))}</div></div>) : (<><Input label="" placeholder="e.g. HDFC Personal Loan" value={manualName} onChange={(e) => setManualName(e.target.value)} /><p className="text-[11px] text-slate-400 mt-1">Manual names stay only on this debt — not added to People.</p></>)}
</div>
<div>
<label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Direction *</label>
<div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Debt direction">
<button type="button" role="radio" aria-checked={direction === 'I_OWE'} onClick={() => {
  setDirection('I_OWE');
  const cat = categories.find((c) => c._id === categoryId);
  if (cat && cat.type === 'income') setCategoryId('');
}} className={`text-left p-3 rounded-xl border ${direction === 'I_OWE' ? 'border-rose-500 bg-rose-500/10 ring-1 ring-rose-500' : 'border-slate-200 dark:border-slate-700'}`}>
<span className="block text-xs font-bold">I owe this person</span>
<span className="block text-[11px] text-slate-500 mt-0.5">Repayment sends money out</span>
</button>
<button type="button" role="radio" aria-checked={direction === 'OWED_TO_ME'} onClick={() => {
  setDirection('OWED_TO_ME');
  const cat = categories.find((c) => c._id === categoryId);
  if (cat && cat.type === 'expense') setCategoryId('');
}} className={`text-left p-3 rounded-xl border ${direction === 'OWED_TO_ME' ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500' : 'border-slate-200 dark:border-slate-700'}`}>
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
<div><label className="block text-xs font-semibold text-slate-500 mb-1">Category</label><CategorySelect categories={categories} value={categoryId} onChange={setCategoryId} placeholder="No category" grouped typeFilter={direction === 'OWED_TO_ME' ? 'income' : 'expense'} /></div>
<div><label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Extra context" className={`${inp} resize-none`} /></div>
{error && <p role="alert" className="text-xs font-medium text-rose-600 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">{error}</p>}
<div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800"><Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" size="sm" isLoading={busy}>{editing ? 'Save Changes' : 'Add Debt'}</Button></div>
</form></Modal>); };
