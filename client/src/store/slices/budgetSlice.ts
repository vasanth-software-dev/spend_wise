import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';
import { Budget } from '../../types/index.js';

interface BudgetState {
  budgets: Budget[];
  loading: boolean;
  error: string | null;
}

const initialState: BudgetState = {
  budgets: [],
  loading: false,
  error: null,
};

export const fetchBudgetsThunk = createAsyncThunk('budgets/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/budgets');
    return res.data.data.budgets;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Failed to load budgets');
  }
});

export const createBudgetThunk = createAsyncThunk(
  'budgets/create',
  async (budgetData: any, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post('/budgets', budgetData);
      dispatch(fetchBudgetsThunk());
      return res.data.data.budget;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create budget');
    }
  }
);

export const deleteBudgetThunk = createAsyncThunk(
  'budgets/delete',
  async (id: string, { dispatch, rejectWithValue }) => {
    try {
      await api.delete(`/budgets/${id}`);
      dispatch(fetchBudgetsThunk());
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete budget');
    }
  }
);

const budgetSlice = createSlice({
  name: 'budgets',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchBudgetsThunk.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(fetchBudgetsThunk.fulfilled, (state, action) => {
      state.budgets = action.payload;
      state.loading = false;
    });
    builder.addCase(fetchBudgetsThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });
  },
});

export default budgetSlice.reducer;
