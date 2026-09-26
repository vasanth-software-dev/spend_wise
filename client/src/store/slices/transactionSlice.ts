import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';
import { Transaction } from '../../types/index.js';

export interface TransactionFilters {
  search?: string;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  type?: string;
  paymentMethod?: string;
  sortBy?: 'transactionDate' | 'amount' | 'merchant';
  sortOrder?: 'asc' | 'desc';
  page: number;
  limit: number;
}

interface TransactionState {
  transactions: Transaction[];
  total: number;
  page: number;
  totalPages: number;
  filters: TransactionFilters;
  selectedIds: string[];
  loading: boolean;
  error: string | null;
}

const initialFilters: TransactionFilters = {
  search: '',
  startDate: '',
  endDate: '',
  categoryId: '',
  type: '',
  paymentMethod: '',
  sortBy: 'transactionDate',
  sortOrder: 'desc',
  page: 1,
  limit: 15,
};

const initialState: TransactionState = {
  transactions: [],
  total: 0,
  page: 1,
  totalPages: 1,
  filters: initialFilters,
  selectedIds: [],
  loading: false,
  error: null,
};

export const fetchTransactionsThunk = createAsyncThunk(
  'transactions/fetchList',
  async (filters: Partial<TransactionFilters> | undefined, { getState, rejectWithValue }) => {
    try {
      const state = (getState() as { transactions: TransactionState }).transactions;
      const combined = { ...state.filters, ...filters };

      const params = new URLSearchParams();
      if (combined.search) params.append('search', combined.search);
      if (combined.startDate) params.append('startDate', combined.startDate);
      if (combined.endDate) params.append('endDate', combined.endDate);
      if (combined.categoryId) params.append('categoryId', combined.categoryId);
      if (combined.type) params.append('type', combined.type);
      if (combined.paymentMethod) params.append('paymentMethod', combined.paymentMethod);
      if (combined.sortBy) params.append('sortBy', combined.sortBy);
      if (combined.sortOrder) params.append('sortOrder', combined.sortOrder);
      params.append('page', String(combined.page || 1));
      params.append('limit', String(combined.limit || 15));

      const res = await api.get(`/transactions?${params.toString()}`);
      return {
        transactions: res.data.data.transactions,
        pagination: res.data.pagination,
        appliedFilters: combined,
      };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch transactions');
    }
  }
);

export const createTransactionThunk = createAsyncThunk(
  'transactions/create',
  async (txData: any, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post('/transactions', txData);
      dispatch(fetchTransactionsThunk(undefined));
      return res.data.data.transaction;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create transaction');
    }
  }
);

export const updateTransactionThunk = createAsyncThunk(
  'transactions/update',
  async ({ id, data }: { id: string; data: any }, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.patch(`/transactions/${id}`, data);
      dispatch(fetchTransactionsThunk(undefined));
      return res.data.data.transaction;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update transaction');
    }
  }
);

export const deleteTransactionThunk = createAsyncThunk(
  'transactions/delete',
  async (id: string, { dispatch, rejectWithValue }) => {
    try {
      await api.delete(`/transactions/${id}`);
      dispatch(fetchTransactionsThunk(undefined));
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete transaction');
    }
  }
);

export const bulkDeleteThunk = createAsyncThunk(
  'transactions/bulkDelete',
  async (ids: string[], { dispatch, rejectWithValue }) => {
    try {
      await api.post('/transactions/bulk-delete', { ids });
      dispatch(fetchTransactionsThunk(undefined));
      return ids;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete selected transactions');
    }
  }
);

export const bulkCategorizeThunk = createAsyncThunk(
  'transactions/bulkCategorize',
  async ({ ids, categoryId }: { ids: string[]; categoryId: string }, { dispatch, rejectWithValue }) => {
    try {
      await api.post('/transactions/bulk-categorize', { ids, categoryId });
      dispatch(fetchTransactionsThunk(undefined));
      return { ids, categoryId };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to categorize transactions');
    }
  }
);

const transactionSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<Partial<TransactionFilters>>) => {
      state.filters = { ...state.filters, ...action.payload, page: 1 };
    },
    resetFilters: (state) => {
      state.filters = initialFilters;
    },
    toggleSelectId: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      if (state.selectedIds.includes(id)) {
        state.selectedIds = state.selectedIds.filter((item) => item !== id);
      } else {
        state.selectedIds.push(id);
      }
    },
    selectAllIds: (state, action: PayloadAction<boolean>) => {
      if (action.payload) {
        state.selectedIds = state.transactions.map((t) => t._id);
      } else {
        state.selectedIds = [];
      }
    },
    clearSelection: (state) => {
      state.selectedIds = [];
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchTransactionsThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchTransactionsThunk.fulfilled, (state, action) => {
      state.transactions = action.payload.transactions;
      state.total = action.payload.pagination.total;
      state.page = action.payload.pagination.page;
      state.totalPages = action.payload.pagination.totalPages;
      state.filters = action.payload.appliedFilters;
      state.loading = false;
    });
    builder.addCase(fetchTransactionsThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });
    builder.addCase(bulkDeleteThunk.fulfilled, (state) => {
      state.selectedIds = [];
    });
    builder.addCase(bulkCategorizeThunk.fulfilled, (state) => {
      state.selectedIds = [];
    });
  },
});

export const { setFilters, resetFilters, toggleSelectId, selectAllIds, clearSelection } = transactionSlice.actions;
export default transactionSlice.reducer;
