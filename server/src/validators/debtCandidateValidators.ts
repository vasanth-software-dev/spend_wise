import { z } from 'zod';

export const resolveDebtCandidateSchema = z.object({
  body: z.object({
    // Omitting debtId confirms the candidate as a brand new debt.
    debtId: z.string().min(1).nullable().optional(),
    amount: z.coerce.number().positive('Amount must be greater than 0').optional(),
    description: z.string().optional(),
    debtDate: z.string().or(z.date()).optional(),
  }),
});