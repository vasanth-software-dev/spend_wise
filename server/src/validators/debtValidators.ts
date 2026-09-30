import { z } from 'zod';

export const createDebtSchema = z.object({
  body: z.object({
    personName: z.string().min(1, 'Person / contact name is required'),
    direction: z.enum(['I_OWE', 'OWED_TO_ME'], {
      errorMap: () => ({ message: 'Debt direction is required' }),
    }),
    originalAmount: z.coerce.number().positive('Amount must be greater than 0'),
    description: z.string().optional(),
    debtDate: z.string().or(z.date()).optional(),
    dueDate: z.string().or(z.date()).nullable().optional(),
    categoryId: z.string().nullable().optional(),
    accountId: z.string().nullable().optional(),
    notes: z.string().optional(),
  }),
});

export const updateDebtSchema = z.object({
  body: z.object({
    personName: z.string().min(1, 'Person / contact name is required').optional(),
    direction: z.enum(['I_OWE', 'OWED_TO_ME']).optional(),
    originalAmount: z.coerce.number().positive('Amount must be greater than 0').optional(),
    description: z.string().optional(),
    debtDate: z.string().or(z.date()).optional(),
    dueDate: z.string().or(z.date()).nullable().optional(),
    categoryId: z.string().nullable().optional(),
    accountId: z.string().nullable().optional(),
    notes: z.string().optional(),
  }),
});

export const recordPaymentSchema = z.object({
  body: z.object({
    amount: z.coerce.number().positive('Payment amount must be greater than 0'),
    paymentDate: z.string().or(z.date()).optional(),
    accountId: z.string().nullable().optional(),
    note: z.string().optional(),
  }),
});