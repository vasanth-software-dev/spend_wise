import { z } from 'zod';

const optionalDate = z
  .union([z.string(), z.date()])
  .nullable()
  .optional()
  .refine(
    (value) => value === null || value === undefined || !isNaN(new Date(value as string).getTime()),
    'Target date must be a valid date'
  );

const optionalAmount = z
  .union([z.number(), z.string()])
  .nullable()
  .optional()
  .transform((value) => (value === null || value === undefined || value === '' ? null : Number(value)))
  .refine(
    (value) => value === null || (isFinite(value) && value >= 0),
    'Monthly contribution cannot be negative'
  )
  .refine((value) => value === null || value > 0, 'Monthly contribution must be greater than 0');

export const createGoalSchema = z
  .object({
    body: z.object({
      name: z.string().trim().min(1, 'Goal name is required'),
      description: z.string().trim().max(500).nullable().optional(),
      targetAmount: z.coerce.number().positive('Target amount must be greater than 0'),
      currentAmount: z.coerce.number().min(0, 'Current saved amount cannot be negative').default(0),
      targetDate: optionalDate,
      monthlyContribution: optionalAmount,
      categoryId: z.string().nullable().optional(),
      accountId: z.string().nullable().optional(),
      icon: z.string().trim().max(60).optional(),
      color: z
        .string()
        .trim()
        .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #10b981')
        .optional(),
    }),
  })
  .refine(
    (data) => (data.body.currentAmount ?? 0) <= data.body.targetAmount,
    { message: 'Current saved amount cannot exceed target amount', path: ['body', 'currentAmount'] }
  );

export const updateGoalSchema = z
  .object({
    body: z.object({
      name: z.string().trim().min(1, 'Goal name is required').optional(),
      description: z.string().trim().max(500).nullable().optional(),
      targetAmount: z.coerce.number().positive('Target amount must be greater than 0').optional(),
      currentAmount: z.coerce.number().min(0, 'Current saved amount cannot be negative').optional(),
      targetDate: optionalDate,
      monthlyContribution: optionalAmount,
      categoryId: z.string().nullable().optional(),
      accountId: z.string().nullable().optional(),
      icon: z.string().trim().max(60).optional(),
      color: z
        .string()
        .trim()
        .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #10b981')
        .optional(),
    }),
  })
  .refine((data) => data.body.targetAmount === undefined || data.body.currentAmount === undefined || data.body.currentAmount <= data.body.targetAmount, {
    message: 'Current saved amount cannot exceed target amount',
    path: ['body', 'currentAmount'],
  });

export const addContributionSchema = z.object({
  body: z.object({
    amount: z.coerce.number().positive('Contribution amount must be greater than 0'),
    accountId: z.string().nullable().optional(),
    contributionDate: optionalDate,
    note: z.string().trim().max(280).nullable().optional(),
  }),
});
