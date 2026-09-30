import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';
import { Debt, DebtSummary } from '../../types/index.js';

interface DebtState {
  debts: Debt[];
  summary: DebtSummary | null;
  loading: boolean;
  summaryLoading: boolean;
  error: string | null;
}

const initialState: DebtState = {
  debts: [],
  summary: null,
  loading: false,
  summaryLoading: false,
  error: null,
};

export const fetchDebtsThunk = createAsyncThunk('debts/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/debts');
    return res.data.data.debts;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Failed to load debts');
  }
});

export const fetchDebtSummaryThunk = createAsyncThunk(
  'debts/fetchSummary',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/debts/summary');
      return res.data.data.summary;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load debt summary');
    }
  }
);

export const createDebtThunk = createAsyncThunk(
  'debts/create',
  async (debtData: any, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post('/debts', debtData);
      dispatch(fetchDebtsThunk());
      dispatch(fetchDebtSummaryThunk());
      return res.data.data.debt;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create debt');
    }
  }
);

export const updateDebtThunk = createAsyncThunk(
  'debts/update',
  async ({ id, data }: { id: string; data: any }, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.patch(`/debts/${id}`, data);
      dispatch(fetchDebtsThunk());
      dispatch(fetchDebtSummaryThunk());
      return res.data.data.debt;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update debt');
    }
  }
);

export const deleteDebtThunk = createAsyncThunk(
  'debts/delete',
  async (id: string, { dispatch, rejectWithValue }) => {
    try {
      await api.delete(`/debts/${id}`);
      dispatch(fetchDebtsThunk());
      dispatch(fetchDebtSummaryThunk());
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete debt');
    }
  }
);

export const recordPaymentThunk = createAsyncThunk(
  'debts/recordPayment',
  async (
    { id, data }: { id: string; data: any },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const res = await api.post(`/debts/${id}/payments`, data);
      dispatch(fetchDebtsThunk());
      dispatch(fetchDebtSummaryThunk());
      return res.data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to record payment');
    }
  }
);

export const deletePaymentThunk = createAsyncThunk(
  'debts/deletePayment',
  async (
    { debtId, paymentId }: { debtId: string; paymentId: string },
    { dispatch, rejectWithValue }
  ) => {
    try {
      await api.delete(`/debts/${debtId}/payments/${paymentId}`);
      dispatch(fetchDebtsThunk());
      dispatch(fetchDebtSummaryThunk());
      return { debtId, paymentId };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete payment');
    }
  }
);

const debtSlice = createSlice({
  name: 'debts',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    // Fetch debts
    builder.addCase(fetchDebtsThunk.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(fetchDebtsThunk.fulfilled, (state, action) => {
      state.debts = action.payload;
      state.loading = false;
    });
    builder.addCase(fetchDebtsThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // Fetch summary
    builder.addCase(fetchDebtSummaryThunk.pending, (state) => {
      state.summaryLoading = true;
    });
    builder.addCase(fetchDebtSummaryThunk.fulfilled, (state, action) => {
      state.summary = action.payload;
      state.summaryLoading = false;
    });
    builder.addCase(fetchDebtSummaryThunk.rejected, (state, action) => {
      state.summaryLoading = false;
      state.error = action.payload as string;
    });
  },
});

export default debtSlice.reducer;