import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';
import { DetectedTransaction } from '../../types/index.js';
import { fetchTransactionsThunk } from './transactionSlice.js';
import { fetchDashboardThunk } from './dashboardSlice.js';
import { fetchNotificationsThunk } from './notificationSlice.js';

interface DetectedState {
  pendingTransactions: DetectedTransaction[];
  loading: boolean;
  actionLoading: Record<string, boolean>;
  error: string | null;
}

const initialState: DetectedState = {
  pendingTransactions: [],
  loading: false,
  actionLoading: {},
  error: null,
};

export const fetchPendingDetectedThunk = createAsyncThunk(
  'detected/fetchPending',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/detected-transactions/pending');
      return res.data.data.detectedTransactions;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load detected transactions');
    }
  }
);

export const confirmDetectedThunk = createAsyncThunk(
  'detected/confirm',
  async (
    { id, overrides }: { id: string; overrides?: any },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const res = await api.post(`/detected-transactions/${id}/confirm`, overrides || {});
      dispatch(fetchPendingDetectedThunk());
      dispatch(fetchTransactionsThunk(undefined));
      dispatch(fetchDashboardThunk('30d'));
      dispatch(fetchNotificationsThunk());
      return res.data.data.transaction;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to confirm transaction');
    }
  }
);

export const rejectDetectedThunk = createAsyncThunk(
  'detected/reject',
  async (id: string, { dispatch, rejectWithValue }) => {
    try {
      await api.post(`/detected-transactions/${id}/reject`);
      dispatch(fetchPendingDetectedThunk());
      dispatch(fetchNotificationsThunk());
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to reject transaction');
    }
  }
);

export const markDuplicateDetectedThunk = createAsyncThunk(
  'detected/duplicate',
  async (id: string, { dispatch, rejectWithValue }) => {
    try {
      await api.post(`/detected-transactions/${id}/duplicate`);
      dispatch(fetchPendingDetectedThunk());
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to mark duplicate');
    }
  }
);

const detectedTransactionSlice = createSlice({
  name: 'detectedTransactions',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchPendingDetectedThunk.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(fetchPendingDetectedThunk.fulfilled, (state, action) => {
      state.pendingTransactions = action.payload;
      state.loading = false;
    });
    builder.addCase(fetchPendingDetectedThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    builder.addCase(confirmDetectedThunk.pending, (state, action) => {
      state.actionLoading[action.meta.arg.id] = true;
    });
    builder.addCase(confirmDetectedThunk.fulfilled, (state, action) => {
      state.actionLoading[action.meta.arg.id] = false;
    });
    builder.addCase(confirmDetectedThunk.rejected, (state, action) => {
      state.actionLoading[action.meta.arg.id] = false;
    });
  },
});

export default detectedTransactionSlice.reducer;
