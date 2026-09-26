import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';
import { RecurringTransaction } from '../../types/index.js';

interface RecurringState {
  recurringList: RecurringTransaction[];
  upcomingList: RecurringTransaction[];
  loading: boolean;
  error: string | null;
}

const initialState: RecurringState = {
  recurringList: [],
  upcomingList: [],
  loading: false,
  error: null,
};

export const fetchRecurringThunk = createAsyncThunk('recurring/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/recurring');
    return res.data.data.recurring;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Failed to load recurring transactions');
  }
});

export const fetchUpcomingThunk = createAsyncThunk('recurring/fetchUpcoming', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/recurring/upcoming');
    return res.data.data.upcoming;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Failed to load upcoming bills');
  }
});

export const createRecurringThunk = createAsyncThunk(
  'recurring/create',
  async (data: any, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post('/recurring', data);
      dispatch(fetchRecurringThunk());
      dispatch(fetchUpcomingThunk());
      return res.data.data.recurring;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create recurring transaction');
    }
  }
);

export const deleteRecurringThunk = createAsyncThunk(
  'recurring/delete',
  async (id: string, { dispatch, rejectWithValue }) => {
    try {
      await api.delete(`/recurring/${id}`);
      dispatch(fetchRecurringThunk());
      dispatch(fetchUpcomingThunk());
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete recurring transaction');
    }
  }
);

const recurringSlice = createSlice({
  name: 'recurring',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchRecurringThunk.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(fetchRecurringThunk.fulfilled, (state, action) => {
      state.recurringList = action.payload;
      state.loading = false;
    });
    builder.addCase(fetchUpcomingThunk.fulfilled, (state, action) => {
      state.upcomingList = action.payload;
    });
  },
});

export default recurringSlice.reducer;
