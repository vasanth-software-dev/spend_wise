import { describe, it, expect, vi, beforeEach } from 'vitest';
import detectedReducer, {
  confirmAllDetectedThunk,
  rejectAllDetectedThunk,
} from '../detectedTransactionSlice.js';

describe('Bulk Slices Reducers & Thunks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('detectedTransactionSlice bulk actions', () => {
    it('sets bulkConfirmLoading to true on confirmAll pending, false on fulfilled', () => {
      let state = detectedReducer(undefined, { type: 'unknown' });
      expect(state.bulkConfirmLoading).toBe(false);

      state = detectedReducer(state, { type: confirmAllDetectedThunk.pending.type });
      expect(state.bulkConfirmLoading).toBe(true);

      state = detectedReducer(state, {
        type: confirmAllDetectedThunk.fulfilled.type,
        payload: { confirmedCount: 5 },
      });
      expect(state.bulkConfirmLoading).toBe(false);
    });

    it('sets bulkRejectLoading to true on rejectAll pending, false on fulfilled', () => {
      let state = detectedReducer(undefined, { type: 'unknown' });
      expect(state.bulkRejectLoading).toBe(false);

      state = detectedReducer(state, { type: rejectAllDetectedThunk.pending.type });
      expect(state.bulkRejectLoading).toBe(true);

      state = detectedReducer(state, {
        type: rejectAllDetectedThunk.fulfilled.type,
        payload: { count: 5 },
      });
      expect(state.bulkRejectLoading).toBe(false);
    });
  });
});
