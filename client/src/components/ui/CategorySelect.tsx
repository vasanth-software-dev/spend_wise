import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuCheck, LuChevronDown, LuTag } from 'react-icons/lu';
import {
  CategoryLike,
  CategoryOption,
  buildCategoryOptions,
} from '../../constants/categories.js';
import { getCategoryIcon } from '../../constants/categoryIcons.js';

interface CategorySelectProps {
  categories: CategoryLike[];
  value: string;
  onChange: (value: string) => void;
  /** First entry rendered with an empty value (e.g. "Select Category..."). */
  placeholder?: string;
  /** Use category _id as the option value instead of the category name. */
  valueMode?: 'id' | 'name';
  /** Group options under Income / Expense / Transfer / General sections. */
  grouped?: boolean;
  /** Show the group name next to each option (only for ungrouped lists). */
  showTypeLabels?: boolean;
  /** Wrapper element classes. */
  className?: string;
  /** Trigger button classes (defaults match a standard form control). */
  triggerClassName?: string;
  /** Control size: 'sm' for table cells and filter rows, 'md' for forms. */
  size?: 'sm' | 'md';
  title?: string;
  disabled?: boolean;
}

type GroupKey = keyof ReturnType<typeof buildCategoryOptions>;

const GROUPS: Array<{ key: GroupKey; label: string; typeLabel: string }> = [
  { key: 'income', label: 'Income', typeLabel: 'Income' },
  { key: 'expense', label: 'Expense', typeLabel: 'Expense' },
  { key: 'transfer', label: 'Transfer', typeLabel: 'Transfer' },
  { key: 'general', label: 'General', typeLabel: '' },
];

const DEFAULT_TRIGGER_CLASS =
  'group/trigger w-full flex items-center px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-slate-100 transition-colors hover:border-brand-400 dark:hover:border-brand-500/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:border-brand-500';

const SIZE_CLASSES = {
  sm: {
    gap: 'gap-1.5',
    text: 'text-xs',
    chip: 'w-5 h-5 rounded-md',
    icon: 'w-3 h-3',
    chevron: 'w-3.5 h-3.5',
  },
  md: {
    gap: 'gap-2.5',
    text: 'text-sm',
    chip: 'w-6 h-6 rounded-lg',
    icon: 'w-3.5 h-3.5',
    chevron: 'w-4 h-4',
  },
} as const;

interface FlatOption {
  option: CategoryOption;
  value: string;
}

/**
 * Single category selection surface shared by every picker in the app
 * (import mapping, transaction review center, transactions ledger,
 * budgets and recurring transactions). A custom listbox is used instead of a
 * native <select> so each option can render its react-icons category icon.
 */
export const CategorySelect: React.FC<CategorySelectProps> = ({
  categories,
  value,
  onChange,
  placeholder,
  valueMode = 'id',
  grouped = true,
  showTypeLabels = false,
  className = 'w-full',
  triggerClassName = DEFAULT_TRIGGER_CLASS,
  size = 'md',
  title,
  disabled = false,
}) => {
  const sizeClasses = SIZE_CLASSES[size];
  const instanceId = useId();
  const optionDomId = (index: number) => `${instanceId}-option-${index}`;
  const groups = useMemo(() => buildCategoryOptions(categories), [categories]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    openUp: boolean;
  } | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const optionValue = useCallback(
    (option: CategoryOption) => (valueMode === 'id' ? option._id || option.name : option.name),
    [valueMode]
  );

  const sections = useMemo(() => {
    if (grouped) {
      return GROUPS.map((group) => ({ ...group, options: groups[group.key] })).filter(
        (group) => group.options.length > 0
      );
    }
    return [
      {
        key: 'general' as GroupKey,
        label: '',
        typeLabel: '',
        options: [...groups.income, ...groups.expense, ...groups.transfer, ...groups.general],
      },
    ];
  }, [grouped, groups]);

  const flatOptions: FlatOption[] = useMemo(
    () =>
      sections.flatMap((section) =>
        section.options.map((option) => ({
          option,
          value: optionValue(option),
        }))
      ),
    [sections, optionValue]
  );

  const selectedIndex = flatOptions.findIndex((item) => item.value === value);
  const selected = selectedIndex >= 0 ? flatOptions[selectedIndex] : undefined;
  const SelectedIcon = selected ? getCategoryIcon(selected.option.icon) : LuTag;

  const computePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const gutter = 8;
    const panelWidth = Math.min(Math.max(rect.width, 240), window.innerWidth - gutter * 2);
    const spaceBelow = window.innerHeight - rect.bottom - gutter;
    const spaceAbove = rect.top - gutter;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;

    let left = rect.left;
    if (left + panelWidth > window.innerWidth - gutter) left = Math.max(gutter, rect.right - panelWidth);
    if (left < gutter) left = gutter;

    const top = openUp ? rect.top - 6 : rect.bottom + 6;
    const maxHeight = Math.max(
      160,
      Math.min(320, openUp ? top - gutter : window.innerHeight - top - gutter)
    );

    setPosition({ top, left, width: panelWidth, maxHeight, openUp });
  }, []);

  useLayoutEffect(() => {
    if (isOpen) computePosition();
  }, [isOpen, computePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || rootRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePanel();
    };
    const onViewportChange = () => computePosition();

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [isOpen, computePosition]);

  useEffect(() => {
    if (!isOpen || highlightIndex < 0) return;
    panelRef.current
      ?.querySelector(`[data-index="${highlightIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, highlightIndex]);

  function closePanel() {
    setIsOpen(false);
    setHighlightIndex(-1);
  }

  function openPanel(startIndex?: number) {
    setIsOpen(true);
    setHighlightIndex(startIndex ?? (selectedIndex >= 0 ? selectedIndex : 0));
  }

  function select(nextValue: string) {
    onChange(nextValue);
    closePanel();
    triggerRef.current?.focus();
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;
    const lastIndex = Math.max(flatOptions.length - 1, 0);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (isOpen) setHighlightIndex((index) => (index >= lastIndex ? 0 : index + 1));
        else openPanel(selectedIndex >= 0 ? selectedIndex : 0);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (isOpen) setHighlightIndex((index) => (index <= 0 ? lastIndex : index - 1));
        else openPanel(selectedIndex >= 0 ? selectedIndex : lastIndex);
        break;
      case 'Home':
        if (!isOpen) return;
        event.preventDefault();
        setHighlightIndex(0);
        break;
      case 'End':
        if (!isOpen) return;
        event.preventDefault();
        setHighlightIndex(lastIndex);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (isOpen) {
          const item = flatOptions[highlightIndex];
          if (item) select(item.value);
        } else {
          openPanel();
        }
        break;
      case 'Tab':
        if (isOpen) closePanel();
        break;
      default:
        break;
    }
  };

  let runningIndex = -1;

  return (
    <div ref={rootRef} onKeyDown={handleKeyDown} className={`relative ${className}`}>
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        onClick={() => (isOpen ? closePanel() : openPanel())}
        title={title}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`${triggerClassName} ${sizeClasses.gap} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`flex items-center justify-center flex-shrink-0 ${sizeClasses.chip}`}
          style={{
            backgroundColor: selected?.option.color ? `${selected.option.color}1f` : undefined,
            color: selected?.option.color || 'currentColor',
          }}
        >
          <SelectedIcon className={sizeClasses.icon} />
        </span>
        <span
          className={`truncate min-w-0 flex-1 text-left ${sizeClasses.text} ${
            selected ? '' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {selected ? selected.option.name : placeholder || 'Select Category...'}
        </span>
        <LuChevronDown
          className={`${sizeClasses.chevron} flex-shrink-0 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : 'group-hover/trigger:text-brand-500'
          }`}
        />
      </button>

      {isOpen &&
        position &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            aria-activedescendant={highlightIndex >= 0 ? optionDomId(highlightIndex) : undefined}
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
              transform: position.openUp ? 'translateY(-100%)' : undefined,
            }}
            className="z-[1000] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#0d1322] p-1 shadow-fintech-lg"
          >
            {placeholder !== undefined && (
              <OptionRow
                icon={LuTag}
                label={placeholder}
                typeLabel=""
                isSelected={value === ''}
                isHighlighted={false}
                onSelect={() => select('')}
                muted
              />
            )}

            {sections.map((section, sectionIndex) => (
              <div key={section.key} className={sectionIndex > 0 ? 'mt-1 pt-1 border-t border-slate-100 dark:border-slate-800' : ''}>
                {section.label && (
                  <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {section.label}
                  </p>
                )}
                {section.options.map((option) => {
                  runningIndex += 1;
                  const index = runningIndex;
                  return (
                    <OptionRow
                      key={`${section.key}-${option.name}`}
                      dataIndex={index}
                      optionId={optionDomId(index)}
                      icon={getCategoryIcon(option.icon)}
                      label={option.name}
                      typeLabel={!grouped && showTypeLabels ? section.typeLabel : ''}
                      color={option.color}
                      isSelected={optionValue(option) === value}
                      isHighlighted={highlightIndex === index}
                      onSelect={() => select(optionValue(option))}
                    />
                  );
                })}
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};

interface OptionRowProps {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  typeLabel: string;
  color?: string;
  isSelected: boolean;
  isHighlighted: boolean;
  onSelect: () => void;
  muted?: boolean;
  dataIndex?: number;
  optionId?: string;
}

const OptionRow: React.FC<OptionRowProps> = ({
  icon: Icon,
  label,
  typeLabel,
  color,
  isSelected,
  isHighlighted,
  onSelect,
  muted = false,
  dataIndex,
  optionId,
}) => (
  <button
    type="button"
    role="option"
    id={optionId}
    data-index={dataIndex}
    aria-selected={isSelected}
    onClick={onSelect}
    className={`w-full flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-sm transition-colors ${
      isSelected
        ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300'
        : isHighlighted
        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70'
    } ${muted ? 'text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1 rounded-b-none' : ''}`}
  >
    <span
      className="flex items-center justify-center w-5 h-5 rounded-md flex-shrink-0"
      style={{ backgroundColor: color ? `${color}1f` : undefined, color: color || 'currentColor' }}
    >
      <Icon className="w-3.5 h-3.5" />
    </span>
    <span className="truncate min-w-0 flex-1">{label}</span>
    {typeLabel && <span className="text-[10px] font-semibold text-slate-400 flex-shrink-0">{typeLabel}</span>}
    {isSelected && <LuCheck className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />}
  </button>
);
