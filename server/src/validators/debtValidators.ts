import { z } from 'zod';

const debtPersonFields = {
  personId: z.string().min(1).nullable().optional(),
  personName: z.string().min(1, 'Person / contact name is required').optional(),
};

function requirePersonOrManual<T extends { personId?: string | null; personName?: string }>(
  data: T,
  ctx: z.RefinementCtx
) {
  const hasPerson = !!data.personId?.trim?.() && data.personId.trim().length > 0;
  const hasName = !!data.personName?.trim?.() && data.personName.trim().length > 0;
  if (!hasPerson && !hasName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['personName'],
      message: 'Select a person or enter a name manually (e.g. bank loan)',
    });
  }
}

export const createDebtSchema = z.object({
  body: z
    .object({
      ...debtPersonFields,
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
    })
    .superRefine(requirePersonOrManual),
});

export const updateDebtSchema = z.object({
  body: z
    .object({
      ...debtPersonFields,
      direction: z.enum(['I_OWE', 'OWED_TO_ME']).optional(),
      originalAmount: z.coerce.number().positive('Amount must be greater than 0').optional(),
      description: z.string().optional(),
      debtDate: z.string().or(z.date()).optional(),
      dueDate: z.string().or(z.date()).nullable().optional(),
      categoryId: z.string().nullable().optional(),
      accountId: z.string().nullable().optional(),
      notes: z.string().optional(),
    })
    // For updates, allow partial payloads; the service resolves personId -> personName.
    // Only reject an explicitly-empty person selection (both cleared/blank).
    .superRefine((data, ctx) => {
      if (
        ('personId' in data || 'personName' in data) &&
        (data.personId === '' || data.personName === '')
      ) {
        const hasPerson = !!data.personId && String(data.personId).trim().length > 0;
        const hasName = !!data.personName && String(data.personName).trim().length > 0;
        if (!hasPerson && !hasName) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['personName'],
            message: 'Select a person or enter a name manually (e.g. bank loan)',
          });
        }
      }
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