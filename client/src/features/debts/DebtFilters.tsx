import React from 'react';
import { Search } from 'lucide-react';
import type { DebtFilterValue, DebtSortValue } from './debtUtils.js';
interface Props { search: string; onSearch: (v: string) => void; filter: DebtFilterValue; onFilter: (v: DebtFilterValue) => void; sort: DebtSortValue; onSort: (v: DebtSortValue) => void; counts: Record<string, number>; }
const FILTERS: { v: DebtFilterValue; label: string }[] = [{ v: 'ALL', label: 'All' }, { v: 'I_OWE', label: 'I Owe' }, { v: 'OWED_TO_ME', label: 'Owed to Me' }, { v: 'ACTIVE', label: 'Active' }, { v: 'PARTIALLY_PAID', label: 'Partial' }, { v: 'OVERDUE', label: 'Overdue' }, { v: 'SETTLED', label: 'Settled' }];
export const DebtFilters: React.FC<Props> = ({ search, onSearch, filter, onFilter, sort, onSort, counts }) => (
<div className="flex flex-col gap-3">
<div className="flex flex-col sm:flex-row sm:items-center gap-3">
<div className="relative flex-1 max-w-md"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="text" value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search person or description…" aria-label="Search debts" className="w-full pl-9 pr-4 py-2 rounded-xl text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20" /></div>
<div><label className="sr-only" htmlFor="debt-sort">Sort debts</label><select id="debt-sort" value={sort} onChange={(e) => onSort(e.target.value as DebtSortValue)} className="py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold"><option value="DUE_DATE">Sort: Due date</option><option value="AMOUNT">Sort: Amount</option><option value="PERSON">Sort: Person</option><option value="RECENT">Sort: Recent</option></select></div>
</div>
<div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Debt filters">
{FILTERS.map((f) => (<button key={f.v} role="tab" aria-selected={filter === f.v} onClick={() => onFilter(f.v)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${filter === f.v ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'}`}>{f.label}{counts[f.v] !== undefined ? ` (${counts[f.v]})` : ''}</button>))}
</div>
</div>);
