/**
 * Reusable financial calculation utilities with decimal-safe operations and Indian currency formatting.
 */

// Round to 2 decimal places safely without IEEE 754 floating point distortion
export function roundTo2Decimals(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

// Convert monetary value to paise (integer)
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

// Convert paise (integer) back to rupees
export function fromPaise(paise: number): number {
  return roundTo2Decimals(paise / 100);
}

// Safe addition
export function safeAdd(a: number, b: number): number {
  return (toPaise(a) + toPaise(b)) / 100;
}

// Safe subtraction
export function safeSubtract(a: number, b: number): number {
  return (toPaise(a) - toPaise(b)) / 100;
}

// Calculate savings: income - expense
export function calculateSavings(income: number, expense: number): number {
  return safeSubtract(income, expense);
}

// Calculate savings rate: ((income - expense) / income) * 100 safely handles division by zero
export function calculateSavingsRate(income: number, expense: number): number {
  if (income <= 0) return 0;
  const savings = calculateSavings(income, expense);
  const rate = (savings / income) * 100;
  return roundTo2Decimals(rate);
}

// Calculate percentage: (part / total) * 100
export function calculatePercentage(part: number, total: number): number {
  if (total <= 0) return 0;
  const percentage = (part / total) * 100;
  return roundTo2Decimals(percentage);
}

/**
 * Format Indian Currency (Lakhs and Crores formatting)
 * Example: 124500 -> ₹1,24,500
 */
export function formatINR(amount: number, options: { showSymbol?: boolean; showDecimals?: boolean } = {}): string {
  const { showSymbol = true, showDecimals = false } = options;
  const absAmount = Math.abs(amount);
  const isNegative = amount < 0;

  const formattedNumber = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(absAmount);

  const prefix = isNegative ? '-' : '';
  const symbol = showSymbol ? '₹' : '';

  return `${prefix}${symbol}${formattedNumber}`;
}
