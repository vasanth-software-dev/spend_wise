import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';
import {
  DashboardSummary,
  SpendingTrendPoint,
  CategoryBreakdownItem,
  TopMerchantItem,
  PaymentDistributionItem,
  Transaction,
} from '../../types/index.js';

export type DashboardTimeRange = 'today' | '7d' | '30d' | '3m' | '6m' | '1y';

interface DashboardState {
  summary: DashboardSummary | null;
  spendingTrend: SpendingTrendPoint[];
  categoryBreakdown: CategoryBreakdownItem[];
  topMerchants: TopMerchantItem[];
  paymentDistribution: PaymentDistributionItem[];
  recentTransactions: Transaction[];
  timeRange: DashboardTimeRange;
  loading: boolean;
  error: string | null;
}

const initialState: DashboardState = {
  summary: null,
  spendingTrend: [],
  categoryBreakdown: [],
  topMerchants: [],
  paymentDistribution: [],
  recentTransactions: [],
  timeRange: '30d',
  loading: false,
  error: null,
};

export const fetchDashboardThunk = createAsyncThunk(
  'dashboard/fetchData',
  async (timeRange: DashboardTimeRange = '30d', { rejectWithValue }) => {
    try {
      const res = await api.get(`/transactions/dashboard?timeRange=${timeRange}`);
      return res.data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load dashboard');
    }
  }
);

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setTimeRange: (state, action) => {
      state.timeRange = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchDashboardThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchDashboardThunk.fulfilled, (state, action) => {
      state.summary = action.payload.summary;
      state.spendingTrend = action.payload.spendingTrend;
      state.categoryBreakdown = action.payload.categoryBreakdown;
      state.topMerchants = action.payload.topMerchants;
      state.paymentDistribution = action.payload.paymentDistribution;
      state.recentTransactions = action.payload.recentTransactions;
      state.timeRange = action.payload.timeRange;
      state.loading = false;
    });
    builder.addCase(fetchDashboardThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });
  },
});

export const { setTimeRange } = dashboardSlice.actions;
export default dashboardSlice.reducer;
