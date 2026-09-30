import { emailAccountRepository } from '../repositories/EmailAccountRepository.js';
import { emailSyncService } from '../services/EmailSyncService.js';

export class EmailSyncJob {
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private intervalMs: number;

  constructor(intervalSeconds = 60) {
    // Check every 60 seconds for accounts due for sync
    this.intervalMs = intervalSeconds * 1000;
  }

  start(): void {
    if (this.timer) {
      return;
    }

    console.log(`[AutoSync] Background Email Synchronization Engine started (polling interval: ${this.intervalMs / 1000}s)`);

    // Run first check after 10 seconds to allow server bootstrap to finish cleanly
    setTimeout(() => {
      this.runSyncCycle().catch((err) => {
        console.error('[AutoSync] Error in initial background sync cycle:', err);
      });
    }, 10000);

    this.timer = setInterval(() => {
      this.runSyncCycle().catch((err) => {
        console.error('[AutoSync] Error in background sync cycle:', err);
      });
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[AutoSync] Background Email Synchronization Engine stopped.');
    }
  }

  async runSyncCycle(): Promise<void> {
    if (this.isProcessing) {
      return; // Skip if previous run is still in flight
    }

    this.isProcessing = true;

    try {
      // Find accounts that haven't been synced within their syncFrequencyMinutes (default 3 mins)
      const dueAccounts = await emailAccountRepository.findAccountsDueForSync(3);

      if (dueAccounts.length === 0) {
        return;
      }

      console.log(`[AutoSync] Found ${dueAccounts.length} email account(s) due for automatic background sync.`);

      for (const account of dueAccounts) {
        try {
          const userId = String(account.userId);
          const accountId = String(account._id);

          const result = await emailSyncService.syncAccount(userId, accountId);

          if (result.detected > 0) {
            console.log(
              `[AutoSync] SUCCESS: Automatically synced ${account.email} without opening app. Detected ${result.detected} new transactions (${result.scanned} scanned).`
            );
          }
        } catch (err: any) {
          console.warn(`[AutoSync] Notice: Background sync skipped for ${account.email}: ${err.message}`);
        }
      }
    } catch (err) {
      console.error('[AutoSync] Unexpected error during sync cycle:', err);
    } finally {
      this.isProcessing = false;
    }
  }
}

export const emailSyncJob = new EmailSyncJob(60);
