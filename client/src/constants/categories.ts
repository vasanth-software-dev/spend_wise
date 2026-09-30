export interface CategoryOption {
  name: string;
  type: 'expense' | 'income' | 'both' | 'transfer';
  icon?: string;
  color?: string;
  _id?: string;
}

export interface CategoryLike {
  name: string;
  type?: string;
  icon?: string;
  color?: string;
  _id?: string;
}

export const SELF_TRANSFER_CATEGORY = 'Self Transfer';

/**
 * Mirrors server/src/repositories/CategoryRepository.ts DEFAULT_SYSTEM_CATEGORIES.
 * Used only as a fallback when the categories API has not resolved yet, so that every
 * category selection surface (import mapping, transaction form, filters) offers the
 * complete set of options instead of a partial hardcoded subset.
 */
export const FALLBACK_CATEGORIES: CategoryOption[] = [
  { name: 'Food & Dining', type: 'expense', icon: 'Utensils', color: '#f97316' },
  { name: 'Groceries', type: 'expense', icon: 'ShoppingBag', color: '#10b981' },
  { name: 'Shopping', type: 'expense', icon: 'ShoppingCart', color: '#ec4899' },
  { name: 'Transport', type: 'expense', icon: 'Car', color: '#3b82f6' },
  { name: 'Fuel', type: 'expense', icon: 'Fuel', color: '#ef4444' },
  { name: 'Bills & Utilities', type: 'expense', icon: 'Zap', color: '#eab308' },
  { name: 'Rent', type: 'expense', icon: 'Home', color: '#8b5cf6' },
  { name: 'Entertainment', type: 'expense', icon: 'Film', color: '#a855f7' },
  { name: 'Health & Medical', type: 'expense', icon: 'HeartPulse', color: '#14b8a6' },
  { name: 'Education', type: 'expense', icon: 'GraduationCap', color: '#6366f1' },
  { name: 'Travel', type: 'expense', icon: 'Plane', color: '#06b6d4' },
  { name: 'Subscriptions', type: 'expense', icon: 'CreditCard', color: '#f43f5e' },
  { name: 'Salon & Grooming', type: 'expense', icon: 'Scissors', color: '#d946ef' },
  { name: 'ATM & Cash', type: 'expense', icon: 'Banknote', color: '#059669' },
  { name: 'Salary', type: 'income', icon: 'Briefcase', color: '#22c55e' },
  { name: 'Investments', type: 'income', icon: 'TrendingUp', color: '#0284c7' },
  { name: 'Friends & Family', type: 'both', icon: 'Users', color: '#8b5cf6' },
  { name: SELF_TRANSFER_CATEGORY, type: 'both', icon: 'ArrowLeftRight', color: '#0ea5e9' },
  { name: 'Other', type: 'both', icon: 'MoreHorizontal', color: '#64748b' },
];

const TRANSFER_CATEGORY_NAMES = new Set([
  'self transfer',
  'transfer',
  'transfers',
  'account transfer',
]);

const GENERAL_CATEGORY_NAMES = new Set(['other', 'uncategorized', 'none']);

const BOTH_TYPE_GROUPS: Record<string, CategoryOption['type']> = {
  'friends & family': 'both',
  'self transfer': 'transfer',
  'other': 'both',
};

export function isTransferCategoryName(name?: string | null): boolean {
  if (!name) return false;
  return TRANSFER_CATEGORY_NAMES.has(name.trim().toLowerCase());
}

export interface GroupedCategoryOptions {
  income: CategoryOption[];
  expense: CategoryOption[];
  transfer: CategoryOption[];
  general: CategoryOption[];
}

/**
 * Builds a de-duplicated, fully grouped category option list for <select> surfaces.
 * Every known category is always rendered somewhere, including 'both' categories
 * such as Friends & Family, Self Transfer and Other.
 */
export function buildCategoryOptions(categories?: CategoryLike[] | null): GroupedCategoryOptions {
  const source: CategoryLike[] =
    categories && categories.length > 0 ? categories : FALLBACK_CATEGORIES;

  const income: CategoryOption[] = [];
  const expense: CategoryOption[] = [];
  const transfer: CategoryOption[] = [];
  const general: CategoryOption[] = [];
  const seen = new Set<string>();

  for (const category of source) {
    const name = (category.name || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const option: CategoryOption = {
      name,
      icon: category.icon,
      color: category.color,
      _id: category._id,
      type: 'both',
    };

    if (isTransferCategoryName(key) || category.type === 'transfer') {
      transfer.push({ ...option, type: 'transfer' });
      continue;
    }

    if (category.type === 'income') {
      income.push({ ...option, type: 'income' });
      continue;
    }

    if (category.type === 'expense') {
      expense.push({ ...option, type: 'expense' });
      continue;
    }

    if (GENERAL_CATEGORY_NAMES.has(key)) {
      general.push({ ...option, type: 'both' });
      continue;
    }

    const bothGroup = BOTH_TYPE_GROUPS[key] || 'both';
    if (bothGroup === 'transfer') transfer.push({ ...option, type: 'transfer' });
    else if (bothGroup === 'income') income.push({ ...option, type: 'income' });
    else if (bothGroup === 'expense') expense.push({ ...option, type: 'expense' });
    else general.push({ ...option, type: 'both' });
  }

  return { income, expense, transfer, general };
}