import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

export interface MonthYearPickerProps {
  selectedMonth: number; // 1 - 12
  selectedYear: number;
  onChange: (month: number, year: number) => void;
  className?: string;
}

const MONTH_NAMES = [
  { short: 'Jan', full: 'January', value: 1 },
  { short: 'Feb', full: 'February', value: 2 },
  { short: 'Mar', full: 'March', value: 3 },
  { short: 'Apr', full: 'April', value: 4 },
  { short: 'May', full: 'May', value: 5 },
  { short: 'Jun', full: 'June', value: 6 },
  { short: 'Jul', full: 'July', value: 7 },
  { short: 'Aug', full: 'August', value: 8 },
  { short: 'Sep', full: 'September', value: 9 },
  { short: 'Oct', full: 'October', value: 10 },
  { short: 'Nov', full: 'November', value: 11 },
  { short: 'Dec', full: 'December', value: 12 },
];

export const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  selectedMonth,
  selectedYear,
  onChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewingYear, setViewingYear] = useState(selectedYear);
  const containerRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  // Sync viewingYear when selectedYear changes externally
  useEffect(() => {
    setViewingYear(selectedYear);
  }, [selectedYear]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectedMonthObj = MONTH_NAMES.find((m) => m.value === selectedMonth) || MONTH_NAMES[0];
  const isSelectedCurrent = selectedMonth === currentMonth && selectedYear === currentYear;

  const handleSelectMonth = (monthVal: number) => {
    onChange(monthVal, viewingYear);
    setIsOpen(false);
  };

  const handleSelectThisMonth = () => {
    setViewingYear(currentYear);
    onChange(currentMonth, currentYear);
    setIsOpen(false);
  };

  // Quick years around current
  const yearOptions = [
    currentYear - 3,
    currentYear - 2,
    currentYear - 1,
    currentYear,
    currentYear + 1,
  ];

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      {/* Trigger Button - Matches design in reference screenshot */}
      <button
        type="button"
        onClick={() => {
          setViewingYear(selectedYear);
          setIsOpen(!isOpen);
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Select month and year"
        className="group inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-[background-color,border-color,box-shadow] duration-150 ease-out shadow-2xs hover:shadow-xs focus:outline-hidden focus:ring-2 focus:ring-brand-500/20"
      >
        <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors" />
        <span className="tracking-tight text-slate-800 dark:text-slate-200">
          {selectedMonthObj.full} {selectedYear}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-brand-600 dark:text-brand-400' : ''
          }`}
        />
      </button>

      {/* Popover / Dropdown Menu */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Month and year picker modal"
          className="absolute right-0 sm:right-auto sm:left-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-slate-900/10 dark:shadow-black/40 z-50 p-4 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
        >
          {/* Header: Year navigation */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setViewingYear((y) => y - 1)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Previous year"
              aria-label="Previous year"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800 dark:text-white">
              <span>{viewingYear}</span>
              {viewingYear === currentYear && (
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                  Current
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setViewingYear((y) => y + 1)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Next year"
              aria-label="Next year"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Year Jump Chips */}
          <div className="flex items-center justify-between gap-1 py-2.5 overflow-x-auto no-scrollbar">
            {yearOptions.map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setViewingYear(yr)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                  viewingYear === yr
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>

          {/* 12 Months Grid */}
          <div className="grid grid-cols-3 gap-2 py-2">
            {MONTH_NAMES.map((m) => {
              const isSelected = selectedMonth === m.value && selectedYear === viewingYear;
              const isCurrent = currentMonth === m.value && currentYear === viewingYear;

              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => handleSelectMonth(m.value)}
                  className={`relative py-2.5 px-2 rounded-xl text-xs font-semibold transition-all duration-150 flex flex-col items-center justify-center ${
                    isSelected
                      ? 'bg-brand-600 text-white font-bold shadow-sm shadow-brand-600/30 ring-2 ring-brand-500/20'
                      : isCurrent
                      ? 'bg-slate-100 dark:bg-slate-800 text-brand-600 dark:text-brand-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-700'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>{m.short}</span>
                  {isCurrent && !isSelected && (
                    <span className="w-1 h-1 rounded-full bg-brand-500 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer: Quick Reset to Today */}
          <div className="pt-3 mt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleSelectThisMonth}
              disabled={isSelectedCurrent}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                isSelectedCurrent
                  ? 'text-slate-400 dark:text-slate-600 cursor-default'
                  : 'text-brand-600 dark:text-brand-400 hover:bg-brand-500/10'
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              <span>Current Month</span>
            </button>

            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
              {MONTH_NAMES.find((m) => m.value === currentMonth)?.short} {currentYear}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
