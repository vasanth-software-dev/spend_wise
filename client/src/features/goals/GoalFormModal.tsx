import React, { useEffect, useMemo, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { Modal } from '../../components/ui/Modal.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { CategorySelect } from '../../components/ui/CategorySelect.js';
import { useAppDispatch, useAppSelector } from '../../store/index.js';
import { createGoalThunk, updateGoalThunk } from '../../store/slices/goalSlice.js';
import { toast } from '../../components/ui/Toast.js';
import { formatINR } from '../../utils/format.js';
import type { Goal } from '../../types/index.js';
import { DEFAULT_GOAL_COLOR, GOAL_COLORS, GOAL_ICONS } from './goalConstants.js';
import {
  addMonths,
  CUSTOM_DEADLINE,
  DEADLINE_PRESETS,
  matchDeadlinePreset,
  NO_DEADLINE,
  toDateInputValue,
} from './goalUtils.js';

interface GoalFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal?: Goal | null;
  onSaved?: (goal: Goal) => void;
}

interface FormState {
  name: string;
  description: string;
  targetAmount: string;
  currentAmount: string;
  targetDate: string;
  deadlinePreset: string;
  monthlyContribution: string;
  categoryId: string;
  icon: string;
  color: string;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  targetAmount: '',
  currentAmount: '',
  targetDate: '',
  deadlinePreset: NO_DEADLINE,
  monthlyContribution: '',
  categoryId: '',
  icon: GOAL_ICONS[0].name,
  color: DEFAULT_GOAL_COLOR,
};

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};

  if (!form.name.trim()) errors.name = 'Goal name is required';

  const target = parseFloat(form.targetAmount);
  if (!form.targetAmount.trim() || isNaN(target) || target <= 0) {
    errors.targetAmount = 'Target amount must be greater than 0';
  }

  const current = form.currentAmount.trim() === '' ? 0 : parseFloat(form.currentAmount);
  if (form.currentAmount.trim() !== '' && (isNaN(current) || current < 0)) {
    errors.currentAmount = 'Current amount cannot be negative';
  } else if (!isNaN(target) && target > 0 && current > target) {
    errors.currentAmount = 'Current amount cannot exceed target amount';
  }

  if (form.targetDate && isNaN(new Date(form.targetDate).getTime())) {
    errors.targetDate = 'Target date must be a valid date';
  }

  if (form.monthlyContribution.trim() !== '') {
    const monthly = parseFloat(form.monthlyContribution);
    if (isNaN(monthly) || monthly <= 0) {
      errors.monthlyContribution = 'Monthly contribution must be greater than 0';
    }
  }

  return errors;
}

export const GoalFormModal: React.FC<GoalFormModalProps> = ({ isOpen, onClose, goal, onSaved }) => {
  const dispatch = useAppDispatch();
  const categories = useAppSelector((state) => state.categories.categories);
  const submitting = useAppSelector((state) => state.goals.submitting);

  const isEditing = !!goal;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    setFormError(null);
    if (goal) {
      const targetDate = toDateInputValue(goal.targetDate);
      setForm({
        name: goal.name ?? '',
        description: goal.description ?? '',
        targetAmount: String(goal.targetAmount ?? ''),
        currentAmount: String(goal.currentAmount ?? 0),
        targetDate,
        deadlinePreset: matchDeadlinePreset(targetDate),
        monthlyContribution:
          goal.monthlyContribution === null || goal.monthlyContribution === undefined
            ? ''
            : String(goal.monthlyContribution),
        categoryId:
          typeof goal.categoryId === 'object' && goal.categoryId
            ? goal.categoryId._id
            : (goal.categoryId as string) || '',
        icon: goal.icon || GOAL_ICONS[0].name,
        color: goal.color || DEFAULT_GOAL_COLOR,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [isOpen, goal]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  /** Preset choices resolve straight to a date; only `custom` keeps the manual value. */
  const setDeadlinePreset = (preset: string) => {
    if (preset === NO_DEADLINE) {
      setForm((prev) => ({ ...prev, deadlinePreset: preset, targetDate: '' }));
    } else if (preset === CUSTOM_DEADLINE) {
      setForm((prev) => ({ ...prev, deadlinePreset: preset }));
    } else {
      const option = DEADLINE_PRESETS.find((item) => item.value === preset);
      const date = option ? toDateInputValue(addMonths(new Date(), option.months)) : '';
      setForm((prev) => ({ ...prev, deadlinePreset: preset, targetDate: date }));
    }
    setErrors((prev) => ({ ...prev, targetDate: undefined }));
  };

  const previewRemaining = useMemo(() => {
    const target = parseFloat(form.targetAmount);
    const current = form.currentAmount.trim() === '' ? 0 : parseFloat(form.currentAmount);
    if (isNaN(target) || target <= 0 || isNaN(current)) return null;
    return Math.max(0, target - current);
  }, [form.targetAmount, form.currentAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      targetAmount: parseFloat(form.targetAmount),
      currentAmount: form.currentAmount.trim() === '' ? 0 : parseFloat(form.currentAmount),
      targetDate: form.targetDate || null,
      monthlyContribution: form.monthlyContribution.trim() === '' ? null : parseFloat(form.monthlyContribution),
      categoryId: form.categoryId || null,
      icon: form.icon,
      color: form.color,
    };

    setFormError(null);
    try {
      const saved = isEditing && goal
        ? await dispatch(updateGoalThunk({ id: goal._id, data: payload })).unwrap()
        : await dispatch(createGoalThunk(payload)).unwrap();
      toast.success(isEditing ? 'Goal updated successfully' : 'Goal created successfully');
      if (onSaved) onSaved(saved as Goal);
      onClose();
    } catch (err: any) {
      const message = err || 'Failed to save goal';
      setFormError(message);
      toast.error(message);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Goal' : 'Create Goal'}
      description={
        isEditing
          ? 'Update this savings target. Contributions are tracked separately.'
          : 'Set a savings target and track how far you have come.'
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl font-semibold">
            {formError}
          </div>
        )}

        <Input
          label="Goal Name"
          placeholder="e.g. New Laptop, Goa Trip, Emergency Fund"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          error={errors.name}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Target Amount (INR)"
            type="number"
            min="0"
            step="any"
            placeholder="e.g. 75000"
            value={form.targetAmount}
            onChange={(e) => setField('targetAmount', e.target.value)}
            error={errors.targetAmount}
            required
          />
          <Input
            label="Current Saved Amount (INR)"
            type="number"
            min="0"
            step="any"
            placeholder="e.g. 25000"
            value={form.currentAmount}
            onChange={(e) => setField('currentAmount', e.target.value)}
            error={errors.currentAmount}
            helperText={previewRemaining !== null ? `${formatINR(previewRemaining)} to go` : undefined}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="goal-deadline"
              className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
            >
              Deadline (Optional)
            </label>
            <select
              id="goal-deadline"
              value={form.deadlinePreset}
              onChange={(e) => setDeadlinePreset(e.target.value)}
              className="w-full py-2.5 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all shadow-2xs font-medium"
            >
              <option value={NO_DEADLINE}>No deadline</option>
              {DEADLINE_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
              <option value={CUSTOM_DEADLINE}>Custom date</option>
            </select>
          </div>

          {form.deadlinePreset === CUSTOM_DEADLINE && (
            <div>
              <label
                htmlFor="goal-target-date"
                className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
              >
                Deadline Date
              </label>
              <input
                id="goal-target-date"
                type="date"
                value={form.targetDate}
                onChange={(e) => setField('targetDate', e.target.value)}
                className={`w-full py-2.5 px-3 bg-white dark:bg-slate-900 border rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all shadow-2xs ${
                  errors.targetDate
                    ? 'border-rose-300 dark:border-rose-700/80 focus:border-rose-500'
                    : 'border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              />
              {errors.targetDate && (
                <p className="text-xs text-rose-500 dark:text-rose-400 font-medium mt-1.5">
                  {errors.targetDate}
                </p>
              )}
            </div>
          )}
        </div>

        <Input
          label="Monthly Contribution (Optional)"
          type="number"
          min="0"
          step="any"
          placeholder="e.g. 8334"
          value={form.monthlyContribution}
          onChange={(e) => setField('monthlyContribution', e.target.value)}
          error={errors.monthlyContribution}
        />

        <div>
          <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Category
          </label>
          <CategorySelect
            categories={categories}
            value={form.categoryId}
            onChange={(value) => setField('categoryId', value)}
            placeholder="Select Category..."
            grouped
          />
        </div>

        {/* Goal appearance: icon + color, both optional */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Icon
            </span>
            <div className="grid grid-cols-7 gap-1.5">
              {GOAL_ICONS.map((option) => {
                const Icon = option.icon;
                const selected = form.icon === option.name;
                return (
                  <button
                    key={option.name}
                    type="button"
                    title={option.label}
                    aria-label={option.label}
                    aria-pressed={selected}
                    onClick={() => setField('icon', option.name)}
                    className={`aspect-square rounded-xl border flex items-center justify-center transition-all ${
                      selected
                        ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300 ring-1 ring-brand-500'
                        : 'border-slate-200/70 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Color
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {GOAL_COLORS.map((color) => {
                const selected = form.color.toLowerCase() === color.toLowerCase();
                return (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Use color ${color}`}
                    aria-pressed={selected}
                    onClick={() => setField('color', color)}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center border-2 transition-all ${
                      selected ? 'border-slate-900 dark:border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {selected && <Check className="w-4 h-4 text-white stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <label
            htmlFor="goal-description"
            className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
          >
            Description (Optional)
          </label>
          <textarea
            id="goal-description"
            rows={2}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="Why are you saving for this?"
            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all shadow-2xs resize-none"
          />
        </div>

        <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={submitting}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            {isEditing ? 'Save Changes' : 'Create Goal'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
