import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';
import { DebtCandidate } from '../../types/index.js';

interface DebtCandidateState {
  candidates: DebtCandidate[];
  loading: boolean;
  error: string | null;
  resolving: Record<string, boolean>;
}

const initialState: DebtCandidateState = {
  candidates: [],
  loading: false,
  error: null,
  resolving: {},
};

export const fetchDebtCandidatesThunk = createAsyncThunk(
  'debtCandidates/fetch',
  async (status: string | undefined, { rejectWithValue }) => {
    try {
      const res = await api.get('/debt-candidates', {
        params: status ? { status } : undefined,
      });
      return res.data.data.candidates as DebtCandidate[];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load debt suggestions');
    }
  }
);

export const resolveDebtCandidateThunk = createAsyncThunk(
  'debtCandidates/resolve',
  async (
    { id, data }: { id: string; data: { debtId?: string | null; amount?: number; description?: string; debtDate?: string } },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const res = await api.post(`/debt-candidates/${id}/resolve`, data);
      dispatch(fetchDebtCandidatesThunk('PENDING'));
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to apply suggestion');
    }
  }
);

export const ignoreDebtCandidateThunk = createAsyncThunk(
  'debtCandidates/ignore',
  async (id: string, { dispatch, rejectWithValue }) => {
    try {
      await api.post(`/debt-candidates/${id}/ignore`);
      dispatch(fetchDebtCandidatesThunk('PENDING'));
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to dismiss suggestion');
    }
  }
);

const debtCandidateSlice = createSlice({
  name: 'debtCandidates',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDebtCandidatesThunk.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchDebtCandidatesThunk.fulfilled, (state, action) => {
        state.candidates = action.payload;
        state.loading = false;
      })
      .addCase(fetchDebtCandidatesThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(resolveDebtCandidateThunk.pending, (state, action) => {
        state.resolving[action.meta.arg.id] = true;
      })
      .addCase(resolveDebtCandidateThunk.fulfilled, (state, action) => {
        state.resolving[action.meta.arg.id] = false;
      })
      .addCase(resolveDebtCandidateThunk.rejected, (state, action) => {
        state.resolving[action.meta.arg.id] = false;
        state.error = action.payload as string;
      })
      .addCase(ignoreDebtCandidateThunk.pending, (state, action) => {
        state.resolving[action.meta.arg] = true;
      })
      .addCase(ignoreDebtCandidateThunk.fulfilled, (state, action) => {
        state.resolving[action.meta.arg] = false;
      })
      .addCase(ignoreDebtCandidateThunk.rejected, (state, action) => {
        state.resolving[action.meta.arg] = false;
        state.error = action.payload as string;
      });
  },
});

export default debtCandidateSlice.reducer;