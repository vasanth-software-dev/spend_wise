import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { CategorySelect } from '../../components/ui/CategorySelect.js';
import { formatINR } from '../../utils/format.js';
import type { Category, PaymentMethod, Transaction } from '../../types/index.js';
import type { ReceiptLineItem } from './receiptBreakdown.js';

export interface ReviewForm {
  merchant: string; amount: string; date: string; time: string;
  categoryId: string; paymentMethod: PaymentMethod; description: string;
  ticketNumber: string; subtotal: string; discount: string;
  cgst: string; sgst: string; igst: string; total: string;
  items: ReceiptLineItem[];
}

interface Props {
  previewUrl: string | null;
  form: ReviewForm;
  onPatch: (patch: Partial<ReviewForm>) => void;
  lowConfidence: Record<string, boolean>;
  unreadCount: number;
  expenseCategories: Category[];
  duplicates: Transaction[];
  formError: string | null;
  isSubmitting: boolean;
  onRetake: () => void;
  onCancel: () => void;
  onSave: () => void;
  onReviewExisting: () => void;
  onSaveAnyway: () => void;
}

const PAYMENT_METHODS: Array<{ id: PaymentMethod; label: string }> = [
  { id: 'cash', label: 'Cash' }, { id: 'upi', label: 'UPI' },
  { id: 'bank', label: 'Net Banking / IMPS' }, { id: 'card', label: 'Debit / Credit Card' },
  { id: 'wallet', label: 'Mobile Wallet' }, { id: 'other', label: 'Other' },
];

export const moneyCls = (warn: boolean) =>
  `w-full py-1.5 px-2.5 bg-white dark:bg-slate-900 border rounded-lg text-xs font-mono tabular-financial text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all ${
    warn ? 'border-amber-400 dark:border-amber-500/60' : 'border-slate-200 dark:border-slate-700/80 focus:border-brand-500'}`;
/** Editable review screen part 1: header + core fields. */
export const ReceiptReview: React.FC<Props> = (p) => {
  const setItem = (idx: number, patch: Partial<ReceiptLineItem>) => {
    p.onPatch({ items: p.form.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });
  };
  const num = (v: number | null) => (v === null ? '' : String(v));
  return (
    <div className="space-y-4">
      {p.previewUrl && (
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850/40">
          <img src={p.previewUrl} alt="Scanned receipt preview" className="w-full max-h-56 object-contain" />
          <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-slate-950/70 text-[10px] font-semibold text-white">
            Temporary · deleted after saving
          </span>
        </div>
      )}
      {p.unreadCount > 0 && (
        <div className="p-3 rounded-xl border border-amber-500/25 bg-amber-500/10 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
          {p.unreadCount === 1 ? 'One field could' : `${p.unreadCount} fields could`} not be read clearly. Please fill {p.unreadCount === 1 ? 'it in' : 'them in'} before saving.
        </div>
      )}
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Receipt Details</p>
      <Input label="Merchant" placeholder="e.g. ABC Supermarket" value={p.form.merchant}
        onChange={(e) => p.onPatch({ merchant: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Date</label>
          <input type="date" value={p.form.date} onChange={(e) => p.onPatch({ date: e.target.value })}
            className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium" />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Time</label>
          <input type="time" value={p.form.time} onChange={(e) => p.onPatch({ time: e.target.value })}
            className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium" />
        </div>
      </div>
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Category</label>
        <CategorySelect categories={p.expenseCategories} value={p.form.categoryId}
          onChange={(v) => p.onPatch({ categoryId: v })} valueMode="id" placeholder="Select category..." />
      </div>
      <ReviewTotals p={p} />
      <ReviewItems p={p} setItem={setItem} num={num} />
      <ReviewFooter p={p} />
    </div>
  );
};
function ReviewTotals({ p }: { p: Props }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div><label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Subtotal</label>
        <input inputMode="decimal" placeholder="1000.00" value={p.form.subtotal} onChange={(e) => p.onPatch({ subtotal: e.target.value })} className={moneyCls(false)} /></div>
      <div><label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Discount</label>
        <input inputMode="decimal" placeholder="50.00" value={p.form.discount} onChange={(e) => p.onPatch({ discount: e.target.value })} className={moneyCls(false)} /></div>
      <div><label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">CGST</label>
        <input inputMode="decimal" placeholder="47.50" value={p.form.cgst} onChange={(e) => p.onPatch({ cgst: e.target.value })} className={moneyCls(false)} /></div>
      <div><label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">SGST</label>
        <input inputMode="decimal" placeholder="47.50" value={p.form.sgst} onChange={(e) => p.onPatch({ sgst: e.target.value })} className={moneyCls(false)} /></div>
      <div className="col-span-2"><label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Total *</label>
        <input inputMode="decimal" placeholder="1045.00" value={p.form.total}
          onChange={(e) => p.onPatch({ total: e.target.value, amount: e.target.value })} className={moneyCls(!!p.lowConfidence.amount)} />
        {p.form.total && <p className="text-[11px] font-bold text-slate-400 mt-1 font-mono">{formatINR(parseFloat(p.form.total) || 0)}</p>}</div>
    </div>
  );
}
function ReviewItems({ p, setItem, num }: { p: Props; setItem: (i: number, patch: Partial<ReceiptLineItem>) => void; num: (v: number | null) => string }) {
  return (
    <>
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Payment Method</label>
        <select value={p.form.paymentMethod} onChange={(e) => p.onPatch({ paymentMethod: e.target.value as PaymentMethod })}
          className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium">
          {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>
      <Input label="Ticket / Receipt No. (Optional)" value={p.form.ticketNumber} onChange={(e) => p.onPatch({ ticketNumber: e.target.value })} />
      <Input label="Description (Optional)" value={p.form.description} onChange={(e) => p.onPatch({ description: e.target.value })} />
      {p.form.items.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Items</p>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {p.form.items.map((it, i) => (
              <div key={i} className="p-2 grid grid-cols-[1fr_52px_64px_72px] gap-1.5 items-center">
                <input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })}
                  className="w-full py-1.5 px-2 bg-transparent text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500/30 rounded-lg" />
                <input value={num(it.quantity)} inputMode="decimal" placeholder="Qty"
                  onChange={(e) => setItem(i, { quantity: e.target.value === '' ? null : parseFloat(e.target.value) || null })}
                  className="w-full py-1.5 px-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-mono text-center" />
                <input value={num(it.unitPrice)} inputMode="decimal" placeholder="Price"
                  onChange={(e) => setItem(i, { unitPrice: e.target.value === '' ? null : parseFloat(e.target.value) || null })}
                  className="w-full py-1.5 px-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-mono text-right" />
                <input value={num(it.lineTotal)} inputMode="decimal" placeholder="Total"
                  onChange={(e) => setItem(i, { lineTotal: e.target.value === '' ? null : parseFloat(e.target.value) || null })}
                  className="w-full py-1.5 px-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-mono text-right font-bold" />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Items are for reference — the Total above is what gets saved.</p>
        </div>
      )}
    </>
  );
}

function ReviewFooter({ p }: { p: Props }) {
  return (
    <>
      {p.duplicates.length > 0 && (
        <div className="p-3.5 rounded-2xl border border-rose-500/25 bg-rose-500/10">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-rose-800 dark:text-rose-300">Possible duplicate expense</p>
              {p.duplicates.map((d) => (
                <p key={d._id} className="text-[11px] text-rose-700/90 dark:text-rose-400/90 mt-1">
                  {d.merchant} · {formatINR(d.amount)} · {new Date(d.transactionDate).toLocaleDateString('en-IN')}
                </p>
              ))}
              <div className="flex flex-wrap gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={p.onReviewExisting}>Review Existing</Button>
                <Button size="sm" variant="danger" isLoading={p.isSubmitting} onClick={p.onSaveAnyway}>Add Anyway</Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {p.formError && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl font-semibold">{p.formError}</div>}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={p.onRetake} leftIcon={<RotateCw className="w-4 h-4" />}>Retake</Button>
          <Button type="button" variant="ghost" size="sm" onClick={p.onCancel}>Cancel</Button>
        </div>
        <Button type="button" variant="primary" size="sm" isLoading={p.isSubmitting} onClick={p.onSave}>Save Expense</Button>
      </div>
    </>
  );
}



