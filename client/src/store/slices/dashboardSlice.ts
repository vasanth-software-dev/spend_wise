import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
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

export interface FetchDashboardParams {
  timeRange?: DashboardTimeRange;
  month?: number;
  year?: number;
}

interface DashboardState {
  summary: DashboardSummary | null;
  previousSummary: DashboardSummary | null;
  previousCategoryBreakdown: CategoryBreakdownItem[];
  spendingTrend: SpendingTrendPoint[];
  categoryBreakdown: CategoryBreakdownItem[];
  topMerchants: TopMerchantItem[];
  paymentDistribution: PaymentDistributionItem[];
  recentTransactions: Transaction[];
  timeRange: DashboardTimeRange;
  selectedMonth: number;
  selectedYear: number;
  loading: boolean;
  error: string | null;
}

const currentDate = new Date();

const initialState: DashboardState = {
  summary: null,
  previousSummary: null,
  previousCategoryBreakdown: [],
  spendingTrend: [],
  categoryBreakdown: [],
  topMerchants: [],
  paymentDistribution: [],
  recentTransactions: [],
  timeRange: 'today',
  selectedMonth: currentDate.getMonth() + 1,
  selectedYear: currentDate.getFullYear(),
  loading: false,
  error: null,
};

export const fetchDashboardThunk = createAsyncThunk(
  'dashboard/fetchData',
  async (arg: DashboardTimeRange | FetchDashboardParams | undefined, { getState, rejectWithValue }) => {
    try {
      const state = (getState() as any).dashboard;
      let timeRange: DashboardTimeRange = state?.timeRange || 'today';
      let month: number | undefined = state?.selectedMonth;
      let year: number | undefined = state?.selectedYear;

      if (typeof arg === 'string') {
        timeRange = arg;
      } else if (arg && typeof arg === 'object') {
        if (arg.timeRange) timeRange = arg.timeRange;
        if (arg.month !== undefined) month = arg.month;
        if (arg.year !== undefined) year = arg.year;
      }

      const params: Record<string, any> = { timeRange };
      if (month !== undefined) params.month = month;
      if (year !== undefined) params.year = year;

      const res = await api.get('/transactions/dashboard', { params });
      return {
        ...res.data.data,
        selectedMonth: month ?? (new Date().getMonth() + 1),
        selectedYear: year ?? new Date().getFullYear(),
      };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load dashboard');
    }
  }
);

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setTimeRange: (state, action: PayloadAction<DashboardTimeRange>) => {
      state.timeRange = action.payload;
    },
    setSelectedMonthYear: (state, action: PayloadAction<{ month: number; year: number }>) => {
      state.selectedMonth = action.payload.month;
      state.selectedYear = action.payload.year;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchDashboardThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchDashboardThunk.fulfilled, (state, action) => {
      state.summary = action.payload.summary;
      state.previousSummary = action.payload.previousSummary || null;
      state.previousCategoryBreakdown = action.payload.previousCategoryBreakdown || [];
      state.spendingTrend = action.payload.spendingTrend;
      state.categoryBreakdown = action.payload.categoryBreakdown;
      state.topMerchants = action.payload.topMerchants;
      state.paymentDistribution = action.payload.paymentDistribution;
      state.recentTransactions = action.payload.recentTransactions;
      state.timeRange = action.payload.timeRange;
      if (action.payload.selectedMonth) state.selectedMonth = action.payload.selectedMonth;
      if (action.payload.selectedYear) state.selectedYear = action.payload.selectedYear;
      state.loading = false;
    });
    builder.addCase(fetchDashboardThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });
  },
});

export const { setTimeRange, setSelectedMonthYear } = dashboardSlice.actions;
export default dashboardSlice.reducer;
