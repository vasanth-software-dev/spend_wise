import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';
import { Goal } from '../../types/index.js';

interface GoalState {
  goals: Goal[];
  selectedGoal: Goal | null;
  loading: boolean;
  detailLoading: boolean;
  submitting: boolean;
  error: string | null;
}

const initialState: GoalState = {
  goals: [],
  selectedGoal: null,
  loading: false,
  detailLoading: false,
  submitting: false,
  error: null,
};

export interface CreateGoalPayload {
  name: string;
  description?: string | null;
  targetAmount: number;
  currentAmount?: number;
  targetDate?: string | null;
  monthlyContribution?: number | null;
  categoryId?: string | null;
  accountId?: string | null;
  icon?: string;
  color?: string;
}

export const fetchGoalsThunk = createAsyncThunk('goals/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/goals');
    return res.data.data.goals as Goal[];
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Failed to load goals');
  }
});

export const fetchGoalThunk = createAsyncThunk(
  'goals/fetchOne',
  async (id: string, { rejectWithValue }) => {
    try {
      const res = await api.get(`/goals/${id}`);
      return res.data.data.goal as Goal;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load goal');
    }
  }
);

export const createGoalThunk = createAsyncThunk(
  'goals/create',
  async (payload: CreateGoalPayload, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post('/goals', payload);
      dispatch(fetchGoalsThunk());
      return res.data.data.goal as Goal;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create goal');
    }
  }
);

export const updateGoalThunk = createAsyncThunk(
  'goals/update',
  async ({ id, data }: { id: string; data: Partial<CreateGoalPayload> }, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.patch(`/goals/${id}`, data);
      dispatch(fetchGoalsThunk());
      return res.data.data.goal as Goal;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update goal');
    }
  }
);

export const deleteGoalThunk = createAsyncThunk(
  'goals/delete',
  async (id: string, { dispatch, rejectWithValue }) => {
    try {
      await api.delete(`/goals/${id}`);
      dispatch(fetchGoalsThunk());
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete goal');
    }
  }
);

export const addContributionThunk = createAsyncThunk(
  'goals/addContribution',
  async (
    { goalId, data }: { goalId: string; data: { amount: number; accountId?: string | null; contributionDate?: string | null; note?: string | null } },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const res = await api.post(`/goals/${goalId}/contributions`, data);
      dispatch(fetchGoalsThunk());
      dispatch(fetchGoalThunk(goalId));
      return res.data.data.goal as Goal;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to add contribution');
    }
  }
);

export const deleteContributionThunk = createAsyncThunk(
  'goals/deleteContribution',
  async (
    { goalId, contributionId }: { goalId: string; contributionId: string },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const res = await api.delete(`/goals/${goalId}/contributions/${contributionId}`);
      dispatch(fetchGoalsThunk());
      dispatch(fetchGoalThunk(goalId));
      return res.data.data.goal as Goal;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to remove contribution');
    }
  }
);

const goalSlice = createSlice({
  name: 'goals',
  initialState,
  reducers: {
    clearSelectedGoal: (state) => {
      state.selectedGoal = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchGoalsThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchGoalsThunk.fulfilled, (state, action) => {
      state.goals = action.payload;
      state.loading = false;
    });
    builder.addCase(fetchGoalsThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    builder.addCase(fetchGoalThunk.pending, (state) => {
      state.detailLoading = true;
      state.error = null;
    });
    builder.addCase(fetchGoalThunk.fulfilled, (state, action) => {
      state.selectedGoal = action.payload;
      state.detailLoading = false;
    });
    builder.addCase(fetchGoalThunk.rejected, (state, action) => {
      state.detailLoading = false;
      state.error = action.payload as string;
    });

    [createGoalThunk, updateGoalThunk, addContributionThunk, deleteContributionThunk].forEach((thunk) => {
      builder.addCase(thunk.pending, (state) => {
        state.submitting = true;
      });
      builder.addCase(thunk.fulfilled, (state) => {
        state.submitting = false;
      });
      builder.addCase(thunk.rejected, (state, action) => {
        state.submitting = false;
        state.error = (action.payload as string) || null;
      });
    });

    builder.addCase(deleteGoalThunk.pending, (state) => {
      state.submitting = true;
    });
    builder.addCase(deleteGoalThunk.fulfilled, (state) => {
      state.submitting = false;
      state.selectedGoal = null;
    });
    builder.addCase(deleteGoalThunk.rejected, (state, action) => {
      state.submitting = false;
      state.error = (action.payload as string) || null;
    });
  },
});

export const { clearSelectedGoal } = goalSlice.actions;
export default goalSlice.reducer;
