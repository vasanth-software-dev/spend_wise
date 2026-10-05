import { Transaction, Budget, RecurringTransaction } from '../types/index.js';

export interface MonthSummary {
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number;
  transactionCount: number;
}

export interface CategoryComparison {
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
  categoryColor?: string;
  currentAmount: number;
  previousAmount: number;
  changePercentage: number; // positive = increased spending
  isIncreased: boolean;
}

export interface MonthlyComparisonResult {
  currentMonth: {
    name: string;
    income: number;
    expenses: number;
    savings: number;
    savingsRate: number;
  };
  previousMonth: {
    name: string;
    income: number;
    expenses: number;
    savings: number;
    savingsRate: number;
  };
  changes: {
    incomeChangePercent: number;
    expensesChangePercent: number;
    savingsChangePercent: number;
  };
  categories: CategoryComparison[];
}

export interface SafeToSpendResult {
  safeToSpend: number;
  dailyRecommended: number;
  daysRemaining: number;
  totalDaysInMonth: number;
  currentBalance: number;
  upcomingObligations: number;
  plannedObligationsCount: number;
  cashBuffer: number;
  explanation: string;
}

export interface FinancialHealthFactor {
  name: string;
  score: number;
  maxScore: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
  description: string;
  recommendation: string;
}

export interface FinancialHealthScore {
  totalScore: number;
  grade: 'Excellent' | 'Good' | 'Fair' | 'Needs Attention';
  gradeColor: string;
  summary: string;
  factors: FinancialHealthFactor[];
}

export interface SpendingInsight {
  id: string;
  type: 'positive' | 'warning' | 'neutral' | 'info';
  title: string;
  message: string;
  metric?: string;
}

export interface MerchantMetrics {
  merchant: string;
  totalAmount: number;
  count: number;
  previousAmount: number;
  changePercentage: number;
}

export interface BudgetPacing {
  budget: Budget;
  spent: number;
  remaining: number;
  percentageUsed: number;
  projectedSpend: number;
  projectedDifference: number; // >0 means over budget
  isPaceExceeding: boolean;
  paceStatus: 'on-track' | 'warning' | 'critical' | 'exceeded';
  paceMessage: string;
}

/**
 * Precision-safe money addition to avoid floating-point errors.
 */
export function addMoney(a: number, b: number): number {
  return Math.round((a + b) * 100) / 100;
}

/**
 * Precision-safe money subtraction.
 */
export function subtractMoney(a: number, b: number): number {
  return Math.round((a - b) * 100) / 100;
}

/**
 * Precision-safe percentage change calculation.
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  const change = ((current - previous) / Math.abs(previous)) * 100;
  return Math.round(change * 10) / 10;
}

/**
 * Calculate Monthly Income from transactions.
 */
export function calculateMonthlyIncome(transactions: Transaction[], date = new Date()): number {
  const month = date.getMonth();
  const year = date.getFullYear();

  const total = transactions
    .filter((tx) => {
      if (tx.type !== 'income' || tx.status === 'ignored') return false;
      const d = new Date(tx.transactionDate);
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .reduce((sum, tx) => addMoney(sum, tx.amount), 0);

  return Math.round(total * 100) / 100;
}

/**
 * Calculate Monthly Expenses from transactions.
 */
export function calculateMonthlyExpenses(transactions: Transaction[], date = new Date()): number {
  const month = date.getMonth();
  const year = date.getFullYear();

  const total = transactions
    .filter((tx) => {
      if (tx.type !== 'expense' || tx.status === 'ignored') return false;
      const d = new Date(tx.transactionDate);
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .reduce((sum, tx) => addMoney(sum, tx.amount), 0);

  return Math.round(total * 100) / 100;
}

/**
 * Calculate Savings for a month (Income - Expenses).
 * Never confuses total balance with monthly savings.
 */
export function calculateSavings(income: number, expenses: number): number {
  return subtractMoney(income, expenses);
}

/**
 * Calculate Savings Rate as a percentage (Savings / Income * 100).
 */
export function calculateSavingsRate(income: number, expenses: number): number {
  if (income <= 0) return 0;
  const savings = calculateSavings(income, expenses);
  if (savings <= 0) return 0;
  return Math.round((savings / income) * 100);
}

/**
 * Calculate Net Cash Flow (Inflows - Outflows).
 */
export function calculateNetCashFlow(income: number, expenses: number): number {
  return subtractMoney(income, expenses);
}

/**
 * Calculate "Safe to Spend" Discretionary Budget:
 * Safe To Spend = Current Available Balance - Upcoming Bills - Planned Obligations - Buffer
 */
export function calculateSafeToSpend(params: {
  currentBalance: number;
  upcomingBills: { amount: number; nextDueDate?: string; type?: string }[];
  plannedDebts?: { remainingAmount?: number; originalAmount: number; dueDate?: string | null; direction?: string }[];
  cashBuffer?: number;
  now?: Date;
}): SafeToSpendResult {
  const now = params.now || new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysRemaining = Math.max(1, totalDaysInMonth - currentDay + 1);

  // Sum upcoming bills falling in the remaining period of this month
  let upcomingObligationsTotal = 0;
  let plannedCount = 0;

  for (const bill of params.upcomingBills) {
    if (bill.type === 'expense' || !bill.type) {
      upcomingObligationsTotal = addMoney(upcomingObligationsTotal, bill.amount);
      plannedCount++;
    }
  }

  if (params.plannedDebts) {
    for (const debt of params.plannedDebts) {
      if (debt.direction === 'I_OWE') {
        const amt = debt.remainingAmount !== undefined ? debt.remainingAmount : debt.originalAmount;
        if (amt > 0) {
          upcomingObligationsTotal = addMoney(upcomingObligationsTotal, amt);
          plannedCount++;
        }
      }
    }
  }

  // Recommended minimum cash buffer (default 10% of balance or ₹5,000, whichever is smaller)
  const cashBuffer = params.cashBuffer !== undefined ? params.cashBuffer : Math.min(5000, Math.max(0, params.currentBalance * 0.1));

  const totalDeductions = addMoney(upcomingObligationsTotal, cashBuffer);
  const rawSafeToSpend = subtractMoney(params.currentBalance, totalDeductions);
  const safeToSpend = Math.max(0, rawSafeToSpend);
  const dailyRecommended = Math.round(safeToSpend / daysRemaining);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[month];
  const lastDay = totalDaysInMonth;

  const explanation = safeToSpend > 0
    ? `You have an estimated ₹${safeToSpend.toLocaleString('en-IN')} available for discretionary spending until ${monthName} ${lastDay}.`
    : `Discretionary funds are tight for the rest of ${monthName} due to upcoming commitments. Consider pausing non-essential spends.`;

  return {
    safeToSpend,
    dailyRecommended,
    daysRemaining,
    totalDaysInMonth,
    currentBalance: params.currentBalance,
    upcomingObligations: upcomingObligationsTotal,
    plannedObligationsCount: plannedCount,
    cashBuffer,
    explanation,
  };
}

/**
 * Compare current month against previous month with category breakdown.
 */
export function calculateMonthlyComparison(
  transactions: Transaction[],
  categoriesList: { _id: string; name: string; icon?: string; color?: string }[] = [],
  now = new Date()
): MonthlyComparisonResult {
  const currentMonthIdx = now.getMonth();
  const currentYear = now.getFullYear();

  const prevDate = new Date(currentYear, currentMonthIdx - 1, 1);
  const prevMonthIdx = prevDate.getMonth();
  const prevYear = prevDate.getFullYear();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  let curIncome = 0;
  let curExpense = 0;
  let prevIncome = 0;
  let prevExpense = 0;

  const curCatMap = new Map<string, number>();
  const prevCatMap = new Map<string, number>();

  for (const tx of transactions) {
    if (tx.status === 'ignored') continue;
    const d = new Date(tx.transactionDate);
    const m = d.getMonth();
    const y = d.getFullYear();

    const catId = typeof tx.categoryId === 'object' && tx.categoryId ? tx.categoryId._id : (tx.categoryId as string) || 'uncategorized';

    if (m === currentMonthIdx && y === currentYear) {
      if (tx.type === 'income') curIncome = addMoney(curIncome, tx.amount);
      if (tx.type === 'expense') {
        curExpense = addMoney(curExpense, tx.amount);
        curCatMap.set(catId, addMoney(curCatMap.get(catId) || 0, tx.amount));
      }
    } else if (m === prevMonthIdx && y === prevYear) {
      if (tx.type === 'income') prevIncome = addMoney(prevIncome, tx.amount);
      if (tx.type === 'expense') {
        prevExpense = addMoney(prevExpense, tx.amount);
        prevCatMap.set(catId, addMoney(prevCatMap.get(catId) || 0, tx.amount));
      }
    }
  }

  const curSavings = calculateSavings(curIncome, curExpense);
  const prevSavings = calculateSavings(prevIncome, prevExpense);

  const curSavingsRate = calculateSavingsRate(curIncome, curExpense);
  const prevSavingsRate = calculateSavingsRate(prevIncome, prevExpense);

  const incomeChange = calculatePercentageChange(curIncome, prevIncome);
  const expensesChange = calculatePercentageChange(curExpense, prevExpense);
  const savingsChange = calculatePercentageChange(curSavings, prevSavings);

  // Category comparisons
  const allCatIds = new Set([...curCatMap.keys(), ...prevCatMap.keys()]);
  const categoryResults: CategoryComparison[] = [];

  for (const catId of allCatIds) {
    const currentAmount = curCatMap.get(catId) || 0;
    const previousAmount = prevCatMap.get(catId) || 0;
    if (currentAmount === 0 && previousAmount === 0) continue;

    const matchedCat = categoriesList.find((c) => c._id === catId);
    const categoryName = matchedCat?.name || (catId === 'uncategorized' ? 'Other' : 'Uncategorized');
    const changePercentage = calculatePercentageChange(currentAmount, previousAmount);

    categoryResults.push({
      categoryId: catId,
      categoryName,
      categoryIcon: matchedCat?.icon || 'Tag',
      categoryColor: matchedCat?.color || '#64748b',
      currentAmount,
      previousAmount,
      changePercentage,
      isIncreased: currentAmount > previousAmount,
    });
  }

  // Sort by highest current spend
  categoryResults.sort((a, b) => b.currentAmount - a.currentAmount);

  return {
    currentMonth: {
      name: monthNames[currentMonthIdx],
      income: curIncome,
      expenses: curExpense,
      savings: curSavings,
      savingsRate: curSavingsRate,
    },
    previousMonth: {
      name: monthNames[prevMonthIdx],
      income: prevIncome,
      expenses: prevExpense,
      savings: prevSavings,
      savingsRate: prevSavingsRate,
    },
    changes: {
      incomeChangePercent: incomeChange,
      expensesChangePercent: expensesChange,
      savingsChangePercent: savingsChange,
    },
    categories: categoryResults,
  };
}

/**
 * Calculate Budget Pacing:
 * Determines if user is spending too fast for the current day of the month.
 */
export function calculateBudgetPacing(
  budget: Budget,
  transactions: Transaction[],
  now = new Date()
): BudgetPacing {
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();
  const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Find confirmed expenses for this budget category this month
  const targetCatId = typeof budget.categoryId === 'object' && budget.categoryId ? budget.categoryId._id : (budget.categoryId as string);

  const spent = transactions
    .filter((tx) => {
      if (tx.type !== 'expense' || tx.status === 'ignored') return false;
      const d = new Date(tx.transactionDate);
      if (d.getMonth() !== currentMonth || d.getFullYear() !== currentYear) return false;
      if (!targetCatId) return true; // overall budget if no category
      const txCatId = typeof tx.categoryId === 'object' && tx.categoryId ? tx.categoryId._id : (tx.categoryId as string);
      return txCatId === targetCatId;
    })
    .reduce((sum, tx) => addMoney(sum, tx.amount), 0);

  const remaining = subtractMoney(budget.amount, spent);
  const percentageUsed = budget.amount > 0 ? Math.round((spent / budget.amount) * 1000) / 10 : 0;

  // Pace estimation: only project when at least 3 days have passed in the month
  const daysPassed = Math.max(1, currentDay);
  const dailyRate = spent / daysPassed;
  const projectedSpend = Math.round(dailyRate * totalDays);
  const projectedDifference = subtractMoney(projectedSpend, budget.amount);

  const isPaceExceeding = currentDay >= 3 && projectedDifference > 0 && spent < budget.amount;

  let paceStatus: 'on-track' | 'warning' | 'critical' | 'exceeded' = 'on-track';
  let paceMessage = 'Spending is on pace with your budget.';

  if (spent >= budget.amount) {
    paceStatus = 'exceeded';
    paceMessage = `Budget exceeded by ₹${Math.abs(remaining).toLocaleString('en-IN')}.`;
  } else if (percentageUsed >= 90) {
    paceStatus = 'critical';
    paceMessage = `${percentageUsed}% used. Only ₹${remaining.toLocaleString('en-IN')} remaining.`;
  } else if (isPaceExceeding) {
    paceStatus = 'warning';
    paceMessage = `At your current pace, this budget may be exceeded by ₹${projectedDifference.toLocaleString('en-IN')}.`;
  } else if (percentageUsed >= (budget.notificationThreshold || 80)) {
    paceStatus = 'warning';
    paceMessage = `${percentageUsed}% of budget used.`;
  }

  return {
    budget,
    spent,
    remaining,
    percentageUsed,
    projectedSpend,
    projectedDifference,
    isPaceExceeding,
    paceStatus,
    paceMessage,
  };
}

/**
 * Deterministic Financial Health Score (0 - 100).
 * Explainable, transparent, and non-misleading.
 */
export function calculateFinancialHealthScore(params: {
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  budgets: Budget[];
  transactions: Transaction[];
  upcomingObligations: number;
  currentBalance: number;
}): FinancialHealthScore {
  const { monthlyIncome, monthlyExpenses, savingsRate, budgets, transactions, upcomingObligations, currentBalance } = params;

  // 1. Savings Rate Score (Max 25 points)
  let savingsScore = 0;
  let savingsStatus: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
  let savingsDesc = 'Savings rate is low or negative.';
  let savingsRec = 'Aim to save at least 20% of your total monthly income.';

  if (savingsRate >= 30) {
    savingsScore = 25;
    savingsStatus = 'excellent';
    savingsDesc = `Outstanding savings rate of ${savingsRate}%.`;
    savingsRec = 'Maintain this exceptional rate by continuing your disciplined investments.';
  } else if (savingsRate >= 20) {
    savingsScore = 20;
    savingsStatus = 'good';
    savingsDesc = `Healthy savings rate of ${savingsRate}%.`;
    savingsRec = 'Consider automating an extra 5% allocation toward high-yield savings or mutual funds.';
  } else if (savingsRate >= 10) {
    savingsScore = 14;
    savingsStatus = 'fair';
    savingsDesc = `Moderate savings rate of ${savingsRate}%.`;
    savingsRec = 'Try cutting discretionary spends to push your savings above 20%.';
  } else if (savingsRate > 0) {
    savingsScore = 8;
    savingsStatus = 'poor';
    savingsDesc = `Savings rate is only ${savingsRate}%.`;
    savingsRec = 'Review monthly subscriptions and dining out to establish a stronger cushion.';
  }

  // 2. Expense to Income Ratio Score (Max 25 points)
  let expenseScore = 0;
  let expenseStatus: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
  let expenseDesc = 'Expenses consume almost all or exceed your income.';
  let expenseRec = 'Prioritize reducing top discretionary expenses immediately.';

  const expenseRatio = monthlyIncome > 0 ? (monthlyExpenses / monthlyIncome) * 100 : 100;
  if (monthlyIncome === 0 && monthlyExpenses === 0) {
    expenseScore = 18;
    expenseStatus = 'good';
    expenseDesc = 'No recorded cash outflow this month.';
    expenseRec = 'Record incoming salary and living expenses to establish baseline.';
  } else if (expenseRatio <= 50) {
    expenseScore = 25;
    expenseStatus = 'excellent';
    expenseDesc = `Low expense-to-income ratio (${Math.round(expenseRatio)}%).`;
    expenseRec = 'Excellent cash flow efficiency. Continue tracking living expenses.';
  } else if (expenseRatio <= 70) {
    expenseScore = 20;
    expenseStatus = 'good';
    expenseDesc = `Reasonable expense-to-income ratio (${Math.round(expenseRatio)}%).`;
    expenseRec = 'Keep essential living expenses under 70% of total earnings.';
  } else if (expenseRatio <= 85) {
    expenseScore = 12;
    expenseStatus = 'fair';
    expenseDesc = `Elevated expense-to-income ratio (${Math.round(expenseRatio)}%).`;
    expenseRec = 'A minor unexpected bill could cause a monthly deficit. Trim non-essentials.';
  } else {
    expenseScore = 5;
    expenseStatus = 'poor';
    expenseDesc = `High expense ratio (${Math.round(expenseRatio)}%). Expenses exceed safe bounds.`;
    expenseRec = 'Implement a strict 50-30-20 budget to avoid depleting emergency reserves.';
  }

  // 3. Budget Adherence Score (Max 20 points)
  let budgetScore = 20;
  let budgetStatus: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
  let budgetDesc = 'All active budgets are well within limits.';
  let budgetRec = 'Keep monitoring category pace as the month concludes.';

  if (budgets.length === 0) {
    budgetScore = 14;
    budgetStatus = 'good';
    budgetDesc = 'No category budgets created yet.';
    budgetRec = 'Set up budgets for Food, Groceries, and Shopping to boost your score.';
  } else {
    let exceededCount = 0;
    let warningCount = 0;
    for (const b of budgets) {
      const pacing = calculateBudgetPacing(b, transactions);
      if (pacing.spent >= b.amount) exceededCount++;
      else if (pacing.isPaceExceeding || pacing.percentageUsed >= 80) warningCount++;
    }

    if (exceededCount > 0) {
      budgetScore = Math.max(4, 20 - exceededCount * 8 - warningCount * 3);
      budgetStatus = exceededCount >= 2 ? 'poor' : 'fair';
      budgetDesc = `${exceededCount} budget(s) have been exceeded this month.`;
      budgetRec = 'Reallocate discretionary funds or increase limits if essential.';
    } else if (warningCount > 0) {
      budgetScore = Math.max(12, 20 - warningCount * 3);
      budgetStatus = 'good';
      budgetDesc = `${warningCount} budget(s) nearing limit or pacing fast.`;
      budgetRec = 'Slow down purchases in warning categories for the next few days.';
    }
  }

  // 4. Recurring Obligation Coverage (Max 15 points)
  let obligationScore = 15;
  let obligationStatus: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
  let obligationDesc = 'Upcoming recurring bills are well covered by available balance.';
  let obligationRec = 'Keep bills on auto-pay with sufficient buffer.';

  if (upcomingObligations > 0) {
    const obligationRatio = currentBalance > 0 ? (upcomingObligations / currentBalance) * 100 : 200;
    if (obligationRatio <= 30) {
      obligationScore = 15;
      obligationStatus = 'excellent';
      obligationDesc = `Upcoming bills represent only ${Math.round(obligationRatio)}% of available balance.`;
      obligationRec = 'Your liquid funds easily absorb all commitments this month.';
    } else if (obligationRatio <= 60) {
      obligationScore = 11;
      obligationStatus = 'good';
      obligationDesc = `Upcoming commitments take up ${Math.round(obligationRatio)}% of available funds.`;
      obligationRec = 'Ensure funds stay liquid in your primary bank account before due dates.';
    } else if (obligationRatio <= 90) {
      obligationScore = 7;
      obligationStatus = 'fair';
      obligationDesc = `High commitment load (${Math.round(obligationRatio)}% of available balance).`;
      obligationRec = 'Delay discretionary shopping until all fixed obligations clear.';
    } else {
      obligationScore = 3;
      obligationStatus = 'poor';
      obligationDesc = 'Upcoming bills exceed or nearly exhaust your current balance.';
      obligationRec = 'Review upcoming dues immediately to avoid missed payments or penalties.';
    }
  }

  // 5. Cash Buffer & Stability (Max 15 points)
  let bufferScore = 15;
  let bufferStatus: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
  let bufferDesc = 'Solid cash balance covering upcoming commitments.';
  let bufferRec = 'Continue channeling surplus into high-yield deposits or emergency funds.';

  if (currentBalance <= 0) {
    bufferScore = 2;
    bufferStatus = 'poor';
    bufferDesc = 'Available balance is zero or in deficit.';
    bufferRec = 'Focus on restoring a positive operating balance before adding new investments.';
  } else if (currentBalance < upcomingObligations) {
    bufferScore = 5;
    bufferStatus = 'poor';
    bufferDesc = 'Balance is lower than pending commitments this month.';
    bufferRec = 'Deposit incoming cash into primary account to cover upcoming payments.';
  } else if (currentBalance < monthlyExpenses * 0.5) {
    bufferScore = 9;
    bufferStatus = 'fair';
    bufferDesc = 'Buffer covers less than 15 days of typical spending.';
    bufferRec = 'Aim to build at least 1 month of living expenses in liquid cash.';
  } else {
    bufferScore = 15;
    bufferStatus = 'excellent';
    bufferDesc = 'Comfortable cash cushion over recurring and living expenses.';
    bufferRec = 'Maintain 3–6 months in emergency reserves.';
  }

  const totalScore = Math.min(100, Math.max(0, savingsScore + expenseScore + budgetScore + obligationScore + bufferScore));

  let grade: 'Excellent' | 'Good' | 'Fair' | 'Needs Attention' = 'Needs Attention';
  let gradeColor = 'text-rose-500';

  if (totalScore >= 80) {
    grade = 'Excellent';
    gradeColor = 'text-emerald-500';
  } else if (totalScore >= 65) {
    grade = 'Good';
    gradeColor = 'text-blue-500';
  } else if (totalScore >= 50) {
    grade = 'Fair';
    gradeColor = 'text-amber-500';
  }

  const summary = `Overall financial wellness is ${grade.toLowerCase()} (${totalScore}/100) based on savings discipline, cash buffer, and budget adherence.`;

  return {
    totalScore,
    grade,
    gradeColor,
    summary,
    factors: [
      {
        name: 'Savings Discipline',
        score: savingsScore,
        maxScore: 25,
        status: savingsStatus,
        description: savingsDesc,
        recommendation: savingsRec,
      },
      {
        name: 'Expense to Income Efficiency',
        score: expenseScore,
        maxScore: 25,
        status: expenseStatus,
        description: expenseDesc,
        recommendation: expenseRec,
      },
      {
        name: 'Budget Adherence',
        score: budgetScore,
        maxScore: 20,
        status: budgetStatus,
        description: budgetDesc,
        recommendation: budgetRec,
      },
      {
        name: 'Obligation Coverage',
        score: obligationScore,
        maxScore: 15,
        status: obligationStatus,
        description: obligationDesc,
        recommendation: obligationRec,
      },
      {
        name: 'Liquid Cash Buffer',
        score: bufferScore,
        maxScore: 15,
        status: bufferStatus,
        description: bufferDesc,
        recommendation: bufferRec,
      },
    ],
  };
}

/**
 * Generate Real, Deterministic Financial Insights from actual user data.
 * No fake AI placeholders.
 */
export function generateSpendingInsights(params: {
  monthlyComparison: MonthlyComparisonResult;
  budgets: Budget[];
  transactions: Transaction[];
  upcomingBills: RecurringTransaction[];
  safeToSpend: SafeToSpendResult;
}): SpendingInsight[] {
  const { monthlyComparison, budgets, transactions, safeToSpend } = params;
  const insights: SpendingInsight[] = [];

  const { currentMonth, previousMonth, changes, categories } = monthlyComparison;

  // 1. Overall spending change vs previous month
  if (previousMonth.expenses > 0) {
    const diff = Math.abs(currentMonth.expenses - previousMonth.expenses);
    if (changes.expensesChangePercent < 0) {
      insights.push({
        id: 'spending-decreased',
        type: 'positive',
        title: 'Spending Discipline',
        message: `You spent ₹${diff.toLocaleString('en-IN')} less than in ${previousMonth.name} (${Math.abs(changes.expensesChangePercent)}% reduction).`,
        metric: `-${Math.abs(changes.expensesChangePercent)}%`,
      });
    } else if (changes.expensesChangePercent > 5) {
      insights.push({
        id: 'spending-increased',
        type: 'warning',
        title: 'Spending Alert',
        message: `Spending is up ₹${diff.toLocaleString('en-IN')} compared to ${previousMonth.name} (+${changes.expensesChangePercent}%).`,
        metric: `+${changes.expensesChangePercent}%`,
      });
    }
  }

  // 2. Category specific insights
  const topIncreased = categories.find((c) => c.isIncreased && c.previousAmount > 0 && c.changePercentage >= 15);
  if (topIncreased) {
    insights.push({
      id: `cat-up-${topIncreased.categoryId}`,
      type: 'warning',
      title: `${topIncreased.categoryName} Spike`,
      message: `${topIncreased.categoryName} spending is ${topIncreased.changePercentage}% higher than last month (₹${topIncreased.currentAmount.toLocaleString('en-IN')}).`,
      metric: `+${topIncreased.changePercentage}%`,
    });
  }

  const topDecreased = categories.find((c) => !c.isIncreased && c.previousAmount > 0 && Math.abs(c.changePercentage) >= 15);
  if (topDecreased) {
    insights.push({
      id: `cat-down-${topDecreased.categoryId}`,
      type: 'positive',
      title: `${topDecreased.categoryName} Savings`,
      message: `${topDecreased.categoryName} spending decreased by ${Math.abs(topDecreased.changePercentage)}% compared to last month.`,
      metric: `${topDecreased.changePercentage}%`,
    });
  }

  // 3. Upcoming Obligations
  if (safeToSpend.upcomingObligations > 0) {
    insights.push({
      id: 'upcoming-commitments',
      type: 'info',
      title: 'Upcoming Commitments',
      message: `You have ₹${safeToSpend.upcomingObligations.toLocaleString('en-IN')} in upcoming recurring obligations this month.`,
      metric: `₹${safeToSpend.upcomingObligations.toLocaleString('en-IN')}`,
    });
  }

  // 4. Budget Pacing / Critical alerts
  for (const b of budgets) {
    const pacing = calculateBudgetPacing(b, transactions);
    if (pacing.isPaceExceeding && pacing.projectedDifference > 0) {
      insights.push({
        id: `budget-pace-${b._id}`,
        type: 'warning',
        title: `${b.name} Pace`,
        message: pacing.paceMessage,
        metric: `+₹${pacing.projectedDifference.toLocaleString('en-IN')}`,
      });
      break; // Show at most 1 budget pace insight to avoid clutter
    }
  }

  // 5. Savings Projection
  if (currentMonth.income > 0) {
    if (currentMonth.savings > 0) {
      insights.push({
        id: 'savings-trajectory',
        type: 'positive',
        title: 'Savings Trajectory',
        message: `You are on track to save approximately ₹${currentMonth.savings.toLocaleString('en-IN')} this month (${currentMonth.savingsRate}% rate).`,
        metric: `${currentMonth.savingsRate}%`,
      });
    } else {
      insights.push({
        id: 'savings-deficit',
        type: 'warning',
        title: 'Monthly Deficit Warning',
        message: `Expenditures exceed income by ₹${Math.abs(currentMonth.savings).toLocaleString('en-IN')}. Reduce discretionary outflows.`,
        metric: `Deficit`,
      });
    }
  }

  // Fallback if no specific insights generated
  if (insights.length === 0) {
    insights.push({
      id: 'welcome-tracking',
      type: 'info',
      title: 'Real-Time Financial Intelligence',
      message: 'SpendWise automatically calculates pacing, savings rate, and category shifts as transactions are recorded.',
    });
  }

  return insights.slice(0, 5);
}

/**
 * Top Merchants Aggregation with Previous Month Comparison.
 */
export function calculateMerchantTotals(
  transactions: Transaction[],
  limit = 5,
  now = new Date()
): MerchantMetrics[] {
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const prevDate = new Date(currentYear, currentMonth - 1, 1);
  const prevMonth = prevDate.getMonth();
  const prevYear = prevDate.getFullYear();

  const curMerchantMap = new Map<string, { total: number; count: number }>();
  const prevMerchantMap = new Map<string, number>();

  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.status === 'ignored' || !tx.merchant) continue;
    const d = new Date(tx.transactionDate);
    const m = d.getMonth();
    const y = d.getFullYear();
    const merchant = tx.merchant.trim();

    if (m === currentMonth && y === currentYear) {
      const existing = curMerchantMap.get(merchant) || { total: 0, count: 0 };
      curMerchantMap.set(merchant, {
        total: addMoney(existing.total, tx.amount),
        count: existing.count + 1,
      });
    } else if (m === prevMonth && y === prevYear) {
      prevMerchantMap.set(merchant, addMoney(prevMerchantMap.get(merchant) || 0, tx.amount));
    }
  }

  const results: MerchantMetrics[] = [];
  for (const [merchant, data] of curMerchantMap.entries()) {
    const prevAmt = prevMerchantMap.get(merchant) || 0;
    const change = calculatePercentageChange(data.total, prevAmt);
    results.push({
      merchant,
      totalAmount: data.total,
      count: data.count,
      previousAmount: prevAmt,
      changePercentage: change,
    });
  }

  results.sort((a, b) => b.totalAmount - a.totalAmount);
  return results.slice(0, limit);
}
