import { z } from 'zod';

export const createTransactionSchema = z.object({
  body: z.object({
    type: z.enum(['expense', 'income', 'transfer']).default('expense'),
    amount: z.coerce.number().positive('Amount must be positive'),
    currency: z.string().default('INR'),
    categoryId: z.string().nullable().optional(),
    merchant: z.string().min(1, 'Merchant or payee name is required'),
    description: z.string().optional(),
    paymentMethod: z.enum(['upi', 'bank', 'cash', 'card', 'wallet', 'other']).default('upi'),
    source: z.enum(['manual', 'email', 'import']).default('manual'),
    externalTransactionId: z.string().optional(),
    refNo: z.string().optional(),
    transactionDate: z.string().or(z.date()).optional(),
    notes: z.string().optional(),
    isRecurring: z.boolean().optional(),
    personId: z.string().nullable().optional(),
    vpa: z.string().nullable().optional(),
  }),
});

export const updateTransactionSchema = z.object({
  body: z.object({
    type: z.enum(['expense', 'income', 'transfer']).optional(),
    amount: z.coerce.number().positive().optional(),
    categoryId: z.string().nullable().optional(),
    merchant: z.string().optional(),
    description: z.string().optional(),
    paymentMethod: z.enum(['upi', 'bank', 'cash', 'card', 'wallet', 'other']).optional(),
    externalTransactionId: z.string().optional(),
    refNo: z.string().optional(),
    transactionDate: z.string().or(z.date()).optional(),
    notes: z.string().optional(),
    personId: z.string().nullable().optional(),
    vpa: z.string().nullable().optional(),
  }),
});
