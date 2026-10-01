import { z } from 'zod';

export const calendarMonthQuerySchema = z.object({
  query: z.object({
    year: z.coerce.number().int().min(1970).max(9999),
    month: z.coerce.number().int().min(1).max(12),
  }),
});

export const calendarDayQuerySchema = z.object({
  query: z.object({
    date: z
      .string()
      .refine((value) => !isNaN(new Date(value).getTime()), 'A valid date is required'),
  }),
});

export const calendarUpcomingQuerySchema = z.object({
  query: z.object({
    days: z.coerce.number().int().min(1).max(365).default(30),
  }),
});
