import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';
import { Account, NetWorthSummary } from '../../types/index.js';

interface AccountState {
  accounts: Account[];
  netWorthSummary: NetWorthSummary | null;
  loading: boolean;
  error: string | null;
}

const initialState: AccountState = {
  accounts: [],
  netWorthSummary: null,
  loading: false,
  error: null,
};

export const fetchAccountsThunk = createAsyncThunk('accounts/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/accounts');
    return res.data.data.accounts as Account[];
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Failed to load accounts');
  }
});

export const fetchNetWorthThunk = createAsyncThunk('accounts/fetchNetWorth', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/accounts/net-worth');
    return res.data.data.summary as NetWorthSummary;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Failed to calculate net worth');
  }
});

export const createAccountThunk = createAsyncThunk(
  'accounts/create',
  async (data: Partial<Account>, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post('/accounts', data);
      dispatch(fetchAccountsThunk());
      dispatch(fetchNetWorthThunk());
      return res.data.data.account as Account;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create account');
    }
  }
);

export const updateAccountThunk = createAsyncThunk(
  'accounts/update',
  async ({ id, data }: { id: string; data: Partial<Account> }, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.patch(`/accounts/${id}`, data);
      dispatch(fetchAccountsThunk());
      dispatch(fetchNetWorthThunk());
      return res.data.data.account as Account;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update account');
    }
  }
);

export const deleteAccountThunk = createAsyncThunk(
  'accounts/delete',
  async (id: string, { dispatch, rejectWithValue }) => {
    try {
      await api.delete(`/accounts/${id}`);
      dispatch(fetchAccountsThunk());
      dispatch(fetchNetWorthThunk());
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete account');
    }
  }
);

const accountSlice = createSlice({
  name: 'accounts',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAccountsThunk.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAccountsThunk.fulfilled, (state, action) => {
        state.accounts = action.payload;
        state.loading = false;
      })
      .addCase(fetchAccountsThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchNetWorthThunk.fulfilled, (state, action) => {
        state.netWorthSummary = action.payload;
      });
  },
});

export default accountSlice.reducer;
