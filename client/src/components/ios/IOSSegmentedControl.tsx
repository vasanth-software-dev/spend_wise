interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
}

interface IOSSegmentedControlProps<T extends string | number> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function IOSSegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  className = '',
  size = 'md',
}: IOSSegmentedControlProps<T>) {
  const isSm = size === 'sm';

  return (
    <div
      className={`inline-flex items-center p-0.5 rounded-full bg-slate-200/70 dark:bg-[#1c1c1e] border border-black/5 dark:border-white/10 select-none ${className}`}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative rounded-full font-semibold transition-all duration-200 ease-out ios-press ${
              isSm ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs'
            } ${
              isSelected
                ? 'bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-white shadow-sm font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
