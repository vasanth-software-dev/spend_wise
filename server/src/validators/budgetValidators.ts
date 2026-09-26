import { z } from 'zod';

export const createBudgetSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Budget name is required'),
    amount: z.coerce.number().positive('Budget amount must be positive'),
    categoryId: z.string().nullable().optional(),
    period: z.enum(['monthly', 'yearly']).default('monthly'),
    startDate: z.string().or(z.date()).optional(),
    endDate: z.string().or(z.date()).optional(),
    notificationThreshold: z.coerce.number().min(1).max(100).default(80),
  }),
});

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Category name is required'),
    type: z.enum(['expense', 'income', 'both']).default('expense'),
    icon: z.string().default('Tag'),
    color: z.string().default('#64748b'),
  }),
});

export const createRecurringSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    amount: z.coerce.number().positive('Amount must be positive'),
    currency: z.string().default('INR'),
    type: z.enum(['expense', 'income', 'transfer']).default('expense'),
    categoryId: z.string().nullable().optional(),
    merchant: z.string().min(1, 'Merchant is required'),
    paymentMethod: z.enum(['upi', 'bank', 'cash', 'card', 'wallet', 'other']).default('upi'),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).default('monthly'),
    startDate: z.string().or(z.date()),
    endDate: z.string().or(z.date()).nullable().optional(),
  }),
});
