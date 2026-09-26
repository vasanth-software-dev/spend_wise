import React, { useState } from 'react';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { Modal } from '../../components/ui/Modal.js';
import { Button } from '../../components/ui/Button.js';
import { api } from '../../services/api.js';
import { useAppDispatch } from '../../store/index.js';
import { fetchTransactionsThunk } from '../../store/slices/transactionSlice.js';
import { fetchDashboardThunk } from '../../store/slices/dashboardSlice.js';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CSVImportModal: React.FC<CSVImportModalProps> = ({ isOpen, onClose }) => {
  const dispatch = useAppDispatch();
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ importedCount: number; skippedCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setResult(null);
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.name.endsWith('.csv')) {
      setError('Please choose a valid .csv file');
      return;
    }

    setFile(selected);

    // Read and parse preview lines
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          setError('CSV file is empty or missing data rows');
          return;
        }

        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
        const rows: any[] = [];

        for (let i = 1; i < Math.min(lines.length, 10); i++) {
          const values = lines[i].split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
          const rowObj: Record<string, string> = {};
          headers.forEach((h, idx) => {
            rowObj[h] = values[idx] || '';
          });
          rows.push(rowObj);
        }

        setPreviewRows(rows);
      } catch (err: any) {
        setError(`Failed to read CSV: ${err.message}`);
      }
    };
    reader.readAsText(selected);
  };

  const handleImport = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));

        const allRows: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
          const rowObj: Record<string, string> = {};
          headers.forEach((h, idx) => {
            rowObj[h] = values[idx] || '';
          });

          // Normalize keys
          const normalized = {
            date: rowObj.date || rowObj.transaction_date || new Date().toISOString(),
            amount: parseFloat(rowObj.amount || '0'),
            type: rowObj.type || 'expense',
            merchant: rowObj.merchant || rowObj.payee || rowObj.description || 'Imported Payee',
            category: rowObj.category || undefined,
            payment_method: rowObj.payment_method || rowObj.method || 'upi',
            notes: rowObj.notes || undefined,
          };
          allRows.push(normalized);
        }

        const res = await api.post('/transactions/import', { rows: allRows });
        setResult(res.data.data);
        dispatch(fetchTransactionsThunk(undefined));
        dispatch(fetchDashboardThunk('30d'));
        setIsProcessing(false);
      };
      reader.readAsText(file);
    } catch (err: any) {
      setError(err.response?.data?.message || 'CSV Import failed');
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Transactions via CSV"
      description="Upload a CSV with date, amount, type, category, and merchant columns."
      maxWidth="lg"
    >
      <div className="space-y-5">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result ? (
          <div className="p-6 text-center space-y-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
            <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
            <h4 className="text-base font-bold text-emerald-900 dark:text-emerald-100">
              CSV Import Completed
            </h4>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Successfully imported {result.importedCount} transactions.
              {result.skippedCount > 0 && ` (${result.skippedCount} duplicates/invalid rows skipped)`}
            </p>
            <Button size="sm" variant="primary" onClick={onClose} className="mt-2">
              Done
            </Button>
          </div>
        ) : (
          <>
            {/* File Upload Area */}
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-500 rounded-2xl p-6 text-center bg-slate-50 dark:bg-slate-800/40 cursor-pointer relative transition-colors">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {file ? file.name : 'Click or drag & drop your CSV file here'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supported columns: date, amount, type, category, merchant, payment_method, notes
              </p>
            </div>

            {/* Preview Table */}
            {previewRows.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                  Preview (First {previewRows.length} rows)
                </span>
                <div className="overflow-x-auto max-h-48 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold sticky top-0">
                      <tr>
                        {Object.keys(previewRows[0]).map((h) => (
                          <th key={h} className="p-2 capitalize">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {previewRows.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          {Object.values(r).map((v: any, vIdx) => (
                            <td key={vIdx} className="p-2 truncate max-w-[120px]">
                              {String(v)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!file || previewRows.length === 0}
                isLoading={isProcessing}
                onClick={handleImport}
              >
                Import Transactions
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
