import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';
import { EmailAccount } from '../../types/index.js';
import { fetchPendingDetectedThunk } from './detectedTransactionSlice.js';
import { fetchNotificationsThunk } from './notificationSlice.js';

interface EmailAccountState {
  accounts: EmailAccount[];
  isSyncing: Record<string, boolean>;
  loading: boolean;
  error: string | null;
}

const initialState: EmailAccountState = {
  accounts: [],
  isSyncing: {},
  loading: false,
  error: null,
};

export const fetchAccountsThunk = createAsyncThunk('emailAccounts/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/email-accounts');
    return res.data.data.accounts;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Failed to load email accounts');
  }
});

export const connectMockThunk = createAsyncThunk(
  'emailAccounts/connectMock',
  async (email: string, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post('/email-accounts/mock/connect', { email });
      dispatch(fetchAccountsThunk());
      dispatch(fetchPendingDetectedThunk());
      dispatch(fetchNotificationsThunk());
      return res.data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to connect email account');
    }
  }
);

export const setupForwardingThunk = createAsyncThunk(
  'emailAccounts/setupForwarding',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post('/email-accounts/forwarding/setup');
      dispatch(fetchAccountsThunk());
      dispatch(fetchNotificationsThunk());
      return res.data.data.account;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to setup email forwarding');
    }
  }
);

export const simulateInboundThunk = createAsyncThunk(
  'emailAccounts/simulateInbound',
  async (
    payload: { accountId: string; templateKey: string; customData?: any },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const res = await api.post('/email-accounts/forwarding/simulate', payload);
      dispatch(fetchAccountsThunk());
      dispatch(fetchPendingDetectedThunk());
      dispatch(fetchNotificationsThunk());
      return res.data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to simulate inbound email');
    }
  }
);

export interface SyncAccountPayload {
  accountId: string;
  month?: number;
  year?: number;
}

export const syncAccountThunk = createAsyncThunk(
  'emailAccounts/sync',
  async (arg: string | SyncAccountPayload, { dispatch, rejectWithValue }) => {
    try {
      const accountId = typeof arg === 'string' ? arg : arg.accountId;
      const body = typeof arg === 'object' && arg.month && arg.year ? {
        month: arg.month,
        year: arg.year,
      } : {};
      const res = await api.post(`/email-accounts/${accountId}/sync`, body);
      dispatch(fetchAccountsThunk());
      dispatch(fetchPendingDetectedThunk());
      dispatch(fetchNotificationsThunk());
      return { accountId, result: res.data.data };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to sync emails');
    }
  }
);

export const pauseAccountThunk = createAsyncThunk(
  'emailAccounts/pause',
  async (accountId: string, { dispatch, rejectWithValue }) => {
    try {
      await api.post(`/email-accounts/${accountId}/pause`);
      dispatch(fetchAccountsThunk());
      return accountId;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to pause sync');
    }
  }
);

export const resumeAccountThunk = createAsyncThunk(
  'emailAccounts/resume',
  async (accountId: string, { dispatch, rejectWithValue }) => {
    try {
      await api.post(`/email-accounts/${accountId}/resume`);
      dispatch(fetchAccountsThunk());
      return accountId;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to resume sync');
    }
  }
);

export const removeAccountThunk = createAsyncThunk(
  'emailAccounts/remove',
  async (accountId: string, { dispatch, rejectWithValue }) => {
    try {
      await api.delete(`/email-accounts/${accountId}`);
      dispatch(fetchAccountsThunk());
      return accountId;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to remove email account');
    }
  }
);

const emailAccountSlice = createSlice({
  name: 'emailAccounts',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchAccountsThunk.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(fetchAccountsThunk.fulfilled, (state, action) => {
      state.accounts = action.payload;
      state.loading = false;
    });
    builder.addCase(fetchAccountsThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    builder.addCase(syncAccountThunk.pending, (state, action) => {
      const accountId = typeof action.meta.arg === 'string' ? action.meta.arg : action.meta.arg.accountId;
      state.isSyncing[accountId] = true;
    });
    builder.addCase(syncAccountThunk.fulfilled, (state, action) => {
      const accountId = typeof action.meta.arg === 'string' ? action.meta.arg : action.meta.arg.accountId;
      state.isSyncing[accountId] = false;
    });
    builder.addCase(syncAccountThunk.rejected, (state, action) => {
      const accountId = typeof action.meta.arg === 'string' ? action.meta.arg : action.meta.arg.accountId;
      state.isSyncing[accountId] = false;
    });
  },
});

export default emailAccountSlice.reducer;
