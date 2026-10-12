import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecurringService } from '../src/services/RecurringService.js';
import { RecurringTransactionModel } from '../src/models/RecurringTransaction.js';
import { NotificationModel } from '../src/models/Notification.js';
import { transactionService } from '../src/services/TransactionService.js';
import { recurringRepository } from '../src/repositories/RecurringRepository.js';
import { createRecurringSchema } from '../src/validators/budgetValidators.js';

describe('Recurring Features, Subscriptions, Reminders, and Duplicate Prevention', () => {
  let recurringService: RecurringService;
  const mockUserId = '507f1f77bcf86cd799439011';
  const mockRecurringId = '507f1f77bcf86cd799439022';

  beforeEach(() => {
    recurringService = new RecurringService();
    vi.restoreAllMocks();
  });

  describe('Validation: createRecurringSchema', () => {
    it('accepts valid subscription and reminder configuration', () => {
      const payload = {
        body: {
          name: 'Netflix Premium 4K',
          amount: 649,
          currency: 'INR',
          type: 'expense',
          merchant: 'Netflix',
          frequency: 'monthly',
          startDate: '2026-10-15',
          isSubscription: true,
          reminderDaysBefore: 3,
        },
      };
      const parsed = createRecurringSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.body.isSubscription).toBe(true);
        expect(parsed.data.body.reminderDaysBefore).toBe(3);
      }
    });

    it('rejects negative or out-of-range reminderDaysBefore', () => {
      const payload = {
        body: {
          name: 'Rent',
          amount: 25000,
          merchant: 'Landlord',
          frequency: 'monthly',
          startDate: '2026-10-01',
          reminderDaysBefore: 45, // max is 30
        },
      };
      const parsed = createRecurringSchema.safeParse(payload);
      expect(parsed.success).toBe(false);
    });
  });

  describe('Persistence: Create & Update Subscriptions', () => {
    it('persists isSubscription and reminderDaysBefore correctly', async () => {
      const createSpy = vi.spyOn(recurringRepository, 'create').mockImplementation(async (data: any) => ({
        ...data,
        _id: mockRecurringId,
      }));

      const result = await recurringService.create(mockUserId, {
        name: 'GitHub Copilot',
        amount: 820,
        merchant: 'GitHub',
        frequency: 'monthly',
        startDate: '2026-10-20',
        isSubscription: true,
        reminderDaysBefore: 2,
      });

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'GitHub Copilot',
          amount: 820,
          isSubscription: true,
          reminderDaysBefore: 2,
        })
      );
      expect(result.isSubscription).toBe(true);
      expect(result.reminderDaysBefore).toBe(2);
    });

    it('defaults reminderDaysBefore to 3 if not provided', async () => {
      const createSpy = vi.spyOn(recurringRepository, 'create').mockImplementation(async (data: any) => ({
        ...data,
        _id: mockRecurringId,
      }));

      await recurringService.create(mockUserId, {
        name: 'Apartment Maintenance',
        amount: 3500,
        merchant: 'Society RWA',
        frequency: 'monthly',
        startDate: '2026-10-01',
      });

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reminderDaysBefore: 3,
          isSubscription: false,
        })
      );
    });
  });

  describe('Reminders: Bill & Subscription Notifications', () => {
    it('creates bill_reminder notification when nextDueDate is within reminder window', async () => {
      const today = new Date();
      const inTwoDays = new Date(today);
      inTwoDays.setDate(today.getDate() + 2);

      vi.spyOn(RecurringTransactionModel, 'find').mockResolvedValue([
        {
          _id: mockRecurringId,
          userId: mockUserId,
          name: 'Amazon Prime',
          amount: 1499,
          currency: 'INR',
          nextDueDate: inTwoDays,
          isActive: true,
          isSubscription: true,
          reminderDaysBefore: 3,
          lastReminderSentForDate: null,
        },
      ] as any);

      const notifCreateSpy = vi.spyOn(NotificationModel, 'create').mockResolvedValue({} as any);
      const updateOneSpy = vi.spyOn(RecurringTransactionModel, 'updateOne').mockResolvedValue({} as any);

      const count = await recurringService.syncReminders(mockUserId);

      expect(count).toBe(1);
      expect(notifCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          type: 'bill_reminder',
          title: 'Subscription Reminder: Amazon Prime',
          data: expect.objectContaining({
            recurringId: mockRecurringId,
            isSubscription: true,
          }),
        })
      );
      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: mockRecurringId },
        expect.objectContaining({
          $set: expect.objectContaining({
            lastReminderSentForDate: expect.any(Date),
          }),
        })
      );
    });

    it('does NOT create duplicate reminders if already sent for the same cycle date', async () => {
      const today = new Date();
      const inTwoDays = new Date(today);
      inTwoDays.setDate(today.getDate() + 2);
      inTwoDays.setHours(0, 0, 0, 0);

      vi.spyOn(RecurringTransactionModel, 'find').mockResolvedValue([
        {
          _id: mockRecurringId,
          userId: mockUserId,
          name: 'Amazon Prime',
          amount: 1499,
          currency: 'INR',
          nextDueDate: inTwoDays,
          isActive: true,
          isSubscription: true,
          reminderDaysBefore: 3,
          lastReminderSentForDate: inTwoDays, // Already sent for this cycle!
        },
      ] as any);

      const notifCreateSpy = vi.spyOn(NotificationModel, 'create').mockResolvedValue({} as any);

      const count = await recurringService.syncReminders(mockUserId);

      expect(count).toBe(0);
      expect(notifCreateSpy).not.toHaveBeenCalled();
    });
  });

  describe('Accidental Duplicate Execution Prevention', () => {
    it('successfully processes recurring item on first execution and advances due date', async () => {
      const initialDueDate = new Date('2026-10-15T00:00:00.000Z');
      const mockDoc = {
        _id: mockRecurringId,
        userId: mockUserId,
        name: 'Broadband Fiber',
        amount: 999,
        currency: 'INR',
        type: 'expense',
        frequency: 'monthly',
        nextDueDate: initialDueDate,
        lastProcessedDate: null,
        isActive: true,
        save: vi.fn().mockResolvedValue(true),
        toObject: vi.fn().mockReturnValue({
          _id: mockRecurringId,
          name: 'Broadband Fiber',
          amount: 999,
          nextDueDate: new Date('2026-11-15T00:00:00.000Z'),
        }),
      };

      vi.spyOn(RecurringTransactionModel, 'findOneAndUpdate').mockResolvedValue(mockDoc as any);
      const createTxnSpy = vi.spyOn(transactionService, 'createTransaction').mockResolvedValue({
        _id: 'txn-101',
        amount: 999,
        merchant: 'Broadband Fiber',
      } as any);

      const result = await recurringService.processRecurring(mockRecurringId, mockUserId);

      expect(createTxnSpy).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          amount: 999,
          isRecurring: true,
        })
      );
      expect(mockDoc.save).toHaveBeenCalled();
      expect(result.transaction).toBeDefined();
    });

    it('rejects concurrent duplicate execution within cooldown window with ALREADY_PROCESSED_RECENTLY', async () => {
      // findOneAndUpdate atomic lock query matches nothing when lastProcessedDate was set just seconds ago
      vi.spyOn(RecurringTransactionModel, 'findOneAndUpdate').mockResolvedValue(null);
      vi.spyOn(RecurringTransactionModel, 'findOne').mockResolvedValue({
        _id: mockRecurringId,
        userId: mockUserId,
        name: 'Broadband Fiber',
        lastProcessedDate: new Date(), // recently processed!
      } as any);

      const createTxnSpy = vi.spyOn(transactionService, 'createTransaction');

      await expect(
        recurringService.processRecurring(mockRecurringId, mockUserId)
      ).rejects.toThrow('ALREADY_PROCESSED_RECENTLY');

      // Crucial: no duplicate transaction was created!
      expect(createTxnSpy).not.toHaveBeenCalled();
    });
  });
});
