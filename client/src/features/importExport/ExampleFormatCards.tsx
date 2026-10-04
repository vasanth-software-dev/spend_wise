import React, { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  Download,
  Play,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle2,
  Table,
} from 'lucide-react';
import {
  ExampleFormat,
  EXAMPLE_FORMATS_META,
  EXAMPLE_TRANSACTIONS,
  getExampleStatementFile,
  downloadExampleStatementFile,
} from '../../utils/exampleStatements.js';
import { formatINR } from '../../utils/format.js';

interface ExampleFormatCardsProps {
  onSelectExample: (file: File) => void;
  isLoading?: boolean;
}

export const ExampleFormatCards: React.FC<ExampleFormatCardsProps> = ({
  onSelectExample,
  isLoading = false,
}) => {
  const [showSpecs, setShowSpecs] = useState(false);
  const [activeSpecTab, setActiveSpecTab] = useState<ExampleFormat>('pdf');
  const [downloadingFormat, setDownloadingFormat] = useState<ExampleFormat | null>(null);

  const handleTryExample = (format: ExampleFormat) => {
    if (isLoading) return;
    const sampleFile = getExampleStatementFile(format);
    onSelectExample(sampleFile);
  };

  const handleDownload = (format: ExampleFormat, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingFormat(format);
    downloadExampleStatementFile(format);
    setTimeout(() => setDownloadingFormat(null), 800);
  };

  const getFormatIcon = (format: ExampleFormat, className = 'w-5 h-5') => {
    switch (format) {
      case 'pdf':
        return <FileText className={`${className} text-rose-500`} />;
      case 'xlsx':
        return <FileSpreadsheet className={`${className} text-emerald-500`} />;
      case 'csv':
        return <FileCode className={`${className} text-blue-500`} />;
      case 'txt':
        return <FileText className={`${className} text-amber-500`} />;
    }
  };

  const formatList: ExampleFormat[] = ['pdf', 'xlsx', 'csv', 'txt'];

  return (
    <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/40 p-4 sm:p-5 space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Sparkles className="w-4 h-4" />
            </span>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Example Statements & Format Templates
            </h4>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Test the importer with pre-built data or download templates to format your bank files.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowSpecs((prev) => !prev)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors self-start sm:self-auto px-2.5 py-1 rounded-lg hover:bg-brand-500/10"
        >
          <Info className="w-3.5 h-3.5" />
          <span>{showSpecs ? 'Hide Format Guide' : 'View Format Guide & Columns'}</span>
          {showSpecs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* 4 Format Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {formatList.map((fmtKey) => {
          const meta = EXAMPLE_FORMATS_META[fmtKey];

          return (
            <div
              key={fmtKey}
              className="group relative flex flex-col justify-between p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/90 bg-white dark:bg-slate-900/80 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs hover:shadow-xs transition-all duration-150"
            >
              {/* Card Header */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/90 group-hover:scale-105 transition-transform">
                    {getFormatIcon(fmtKey)}
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider ${
                      fmtKey === 'pdf'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        : fmtKey === 'xlsx'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : fmtKey === 'csv'
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {meta.badge}
                  </span>
                </div>

                <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                  {meta.name}
                </h5>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                  {meta.description}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-3.5 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleTryExample(fmtKey)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white shadow-2xs transition-colors disabled:opacity-50"
                  title={`Load sample ${meta.badge} directly into parser`}
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Try Example</span>
                </button>

                <button
                  type="button"
                  disabled={downloadingFormat === fmtKey}
                  onClick={(e) => handleDownload(fmtKey, e)}
                  className="inline-flex items-center justify-center p-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title={`Download example_${fmtKey === 'xlsx' ? 'statement.xlsx' : fmtKey === 'pdf' ? 'statement.pdf' : fmtKey === 'csv' ? 'statement.csv' : 'statement.txt'}`}
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Format Specifications & Expected Columns Accordion */}
      {showSpecs && (
        <div className="mt-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Format Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2.5">
            {formatList.map((fmtKey) => {
              const meta = EXAMPLE_FORMATS_META[fmtKey];
              const isActive = activeSpecTab === fmtKey;
              return (
                <button
                  key={fmtKey}
                  type="button"
                  onClick={() => setActiveSpecTab(fmtKey)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {getFormatIcon(fmtKey, 'w-3.5 h-3.5')}
                  <span>{meta.name}</span>
                </button>
              );
            })}
          </div>

          {/* Active Tab Details */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  {EXAMPLE_FORMATS_META[activeSpecTab].columnsHelp}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Supported extensions: <code>{EXAMPLE_FORMATS_META[activeSpecTab].extension}</code>
                </p>
              </div>

              <button
                type="button"
                onClick={(e) => handleDownload(activeSpecTab, e)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors self-start sm:self-auto"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download {EXAMPLE_FORMATS_META[activeSpecTab].name} Template</span>
              </button>
            </div>

            {/* Feature highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {EXAMPLE_FORMATS_META[activeSpecTab].features.map((feature, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-[11px] text-slate-700 dark:text-slate-300"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            {/* Sample Table Preview */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Table className="w-3.5 h-3.5" />
                  Pre-configured sample data ({EXAMPLE_TRANSACTIONS.length} entries):
                </span>
                <span className="text-[11px] text-slate-400">All reference numbers & dates are pre-validated</span>
              </div>

              <div className="overflow-x-auto max-h-48 border border-slate-200 dark:border-slate-800 rounded-xl custom-scrollbar">
                <table className="w-full text-left text-[11px] text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-100/90 dark:bg-slate-800/80 text-slate-500 font-semibold sticky top-0">
                    <tr>
                      <th className="p-2">Date</th>
                      <th className="p-2">Narration / Particulars</th>
                      <th className="p-2">Ref / UTR</th>
                      <th className="p-2 text-right">Withdrawal (Dr)</th>
                      <th className="p-2 text-right">Deposit (Cr)</th>
                      <th className="p-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {EXAMPLE_TRANSACTIONS.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="p-2 font-mono whitespace-nowrap">{row.date}</td>
                        <td className="p-2 truncate max-w-[200px]" title={row.narration}>
                          {row.narration}
                        </td>
                        <td className="p-2 font-mono text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {row.refNo}
                        </td>
                        <td className="p-2 text-right font-mono text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          {row.withdrawal ? formatINR(Number(row.withdrawal)) : '-'}
                        </td>
                        <td className="p-2 text-right font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {row.deposit ? formatINR(Number(row.deposit)) : '-'}
                        </td>
                        <td className="p-2 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatINR(Number(row.balance))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

