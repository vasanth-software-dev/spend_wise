import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/index.js';
import { fetchDebtsThunk, fetchDebtSummaryThunk } from '../store/slices/debtSlice.js';
import { Button } from '../components/ui/Button.js';
import { toast } from '../components/ui/Toast.js';
import { api } from '../services/api.js';
import type { Debt } from '../types/index.js';
import type { DebtFilterValue as F, DebtSortValue as S } from '../features/debts/debtUtils.js';
import { DebtSummaryCards } from '../features/debts/DebtSummaryCards.js';
import { DebtFilters } from '../features/debts/DebtFilters.js';
import { DebtList } from '../features/debts/DebtList.js';
import { DebtFormModal } from '../features/debts/DebtFormModal.js';
import { RecordPaymentModal } from '../features/debts/RecordPaymentModal.js';
import { DebtDetailsDrawer } from '../features/debts/DebtDetailsDrawer.js';
import { DeleteDebtDialog } from '../features/debts/DeleteDebtDialog.js';
import { filterAndSortDebts, getDebtRemaining } from '../features/debts/debtUtils.js';
import { deleteDebtThunk, recordPaymentThunk } from '../store/slices/debtSlice.js';
const FILTER_KEY = 'spendwise.debts.filter';
const SORT_KEY = 'spendwise.debts.sort';
export const DebtsPage: React.FC = () => {
const dispatch = useAppDispatch();
const { debts, summary, loading } = useAppSelector((s) => s.debts);
const [search, setSearch] = useState('');
const [filter, setFilter] = useState<F>(() => (sessionStorage.getItem(FILTER_KEY) as F) || 'ALL');
const [sort, setSort] = useState<S>(() => (sessionStorage.getItem(SORT_KEY) as S) || 'DUE_DATE');
const [formOpen, setFormOpen] = useState(false);
const [editing, setEditing] = useState<Debt | null>(null);
const [selectedId, setSelectedId] = useState<string | null>(null);
const [payOpen, setPayOpen] = useState(false);
const [deleteOpen, setDeleteOpen] = useState(false);
const [deleting, setDeleting] = useState(false);
const [detail, setDetail] = useState<Debt | null>(null);
useEffect(() => { dispatch(fetchDebtsThunk()); dispatch(fetchDebtSummaryThunk()); }, [dispatch]);
useEffect(() => { sessionStorage.setItem(FILTER_KEY, filter); }, [filter]);
useEffect(() => { sessionStorage.setItem(SORT_KEY, sort); }, [sort]);
const visible = useMemo(() => filterAndSortDebts(debts, { search, filter, sort }), [debts, search, filter, sort]);
const counts = useMemo(() => { const c: Record<string, number> = { ALL: debts.length, I_OWE: 0, OWED_TO_ME: 0, ACTIVE: 0, PARTIALLY_PAID: 0, OVERDUE: 0, SETTLED: 0 };
for (const d of debts) { c[d.direction] = (c[d.direction] ?? 0) + 1; const st = d.status ?? 'ACTIVE'; c[st] = (c[st] ?? 0) + 1; } return c; }, [debts]);
const openDebt = async (d: Debt) => { setSelectedId(d._id); try { const res = await api.get(`/debts/${d._id}`); setDetail(res.data.data.debt); } catch { setDetail(d); } };
const refreshDetail = async (id: string) => { try { const res = await api.get(`/debts/${id}`); setDetail(res.data.data.debt); } catch { /* keep stale */ } };
const closeDetail = () => { setSelectedId(null); setDetail(null); };
const shown = detail ?? debts.find((d) => d._id === selectedId) ?? null;
const doDelete = async () => { if (!shown) return; setDeleting(true);
try { await dispatch(deleteDebtThunk(shown._id)).unwrap(); toast.success('Debt deleted'); setDeleteOpen(false); closeDetail(); }
catch (e: any) { toast.error(typeof e === 'string' ? e : 'Failed to delete debt'); } finally { setDeleting(false); } };
const doSettle = async () => { if (!shown) return; const remaining = getDebtRemaining(shown);
if (remaining <= 0) return; if (!confirm(`Mark debt with ${shown.personName} as settled (${remaining.toLocaleString('en-IN')} remaining)? This records a final payment.`)) return;
try { await dispatch(recordPaymentThunk({ id: shown._id, data: { amount: remaining, paymentDate: new Date().toISOString(), note: 'Marked as settled' } })).unwrap(); toast.success('Debt settled'); const res = await api.get(`/debts/${shown._id}`); setDetail(res.data.data.debt); }
catch (e: any) { toast.error(typeof e === 'string' ? e : 'Failed to settle debt'); } };
return (<div className="space-y-6 max-w-7xl mx-auto pb-12">
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
<div><h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Debts</h1><p className="text-xs sm:text-sm text-slate-500 mt-1">Track money you owe and money owed to you. Payments update balances automatically.</p></div>
<Button size="sm" variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>Add Debt</Button>
</div>
<DebtSummaryCards summary={summary} loading={loading && debts.length === 0} />
<DebtFilters search={search} onSearch={setSearch} filter={filter} onFilter={setFilter} sort={sort} onSort={setSort} counts={counts} />
<DebtList debts={visible} loading={loading && debts.length === 0} onOpen={openDebt} onAdd={() => { setEditing(null); setFormOpen(true); }} />
<DebtFormModal isOpen={formOpen} onClose={() => { setFormOpen(false); setEditing(null); if (selectedId) refreshDetail(selectedId); }} debt={editing} />
<RecordPaymentModal isOpen={payOpen} onClose={() => { setPayOpen(false); if (selectedId) refreshDetail(selectedId); }} debt={shown} />
<DebtDetailsDrawer debt={shown} isOpen={!!selectedId} onClose={closeDetail} onRecordPayment={() => setPayOpen(true)} onEdit={() => { setEditing(shown); setFormOpen(true); }} onDelete={() => setDeleteOpen(true)} onSettle={doSettle} />
<DeleteDebtDialog isOpen={deleteOpen} personName={shown?.personName ?? ''} remaining={shown ? getDebtRemaining(shown) : 0} busy={deleting} onCancel={() => setDeleteOpen(false)} onConfirm={doDelete} />
</div>); };
