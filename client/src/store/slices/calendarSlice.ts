import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';
import {
  CalendarDayDetail,
  CalendarDaySummary,
  CalendarDebtMarker,
  CalendarGoalMarker,
  UpcomingOccurrence,
} from '../../types/index.js';

export interface CalendarMonth {
  year: number;
  month: number;
  startDate: string;
  days: CalendarDaySummary[];
  scheduled: UpcomingOccurrence[];
  goals: CalendarGoalMarker[];
  debts: CalendarDebtMarker[];
  totals: {
    income: number;
    expense: number;
    transfer: number;
    net: number;
    count: number;
  };
}

export interface CalendarUpcoming {
  from: string;
  to: string;
  upcoming: UpcomingOccurrence[];
  goals: CalendarGoalMarker[];
  debts: CalendarDebtMarker[];
  totals: { income: number; expense: number; net: number };
}

interface CalendarState {
  month: CalendarMonth | null;
  day: CalendarDayDetail | null;
  upcoming: CalendarUpcoming | null;
  loading: boolean;
  dayLoading: boolean;
  upcomingLoading: boolean;
  error: string | null;
}

const initialState: CalendarState = {
  month: null,
  day: null,
  upcoming: null,
  loading: false,
  dayLoading: false,
  upcomingLoading: false,
  error: null,
};

export const fetchCalendarMonthThunk = createAsyncThunk(
  'calendar/fetchMonth',
  async ({ year, month }: { year: number; month: number }, { rejectWithValue }) => {
    try {
      const res = await api.get(`/calendar/month?year=${year}&month=${month}`);
      return res.data.data as CalendarMonth;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load calendar');
    }
  }
);

export const fetchCalendarDayThunk = createAsyncThunk(
  'calendar/fetchDay',
  async (date: string, { rejectWithValue }) => {
    try {
      const res = await api.get(`/calendar/day?date=${date}`);
      return res.data.data as CalendarDayDetail;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load day details');
    }
  }
);

export const fetchCalendarUpcomingThunk = createAsyncThunk(
  'calendar/fetchUpcoming',
  async (days: number = 30, { rejectWithValue }) => {
    try {
      const res = await api.get(`/calendar/upcoming?days=${days}`);
      return res.data.data as CalendarUpcoming;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load upcoming activity');
    }
  }
);

const calendarSlice = createSlice({
  name: 'calendar',
  initialState,
  reducers: {
    clearCalendarDay: (state) => {
      state.day = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchCalendarMonthThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchCalendarMonthThunk.fulfilled, (state, action) => {
      state.month = action.payload;
      state.loading = false;
    });
    builder.addCase(fetchCalendarMonthThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    builder.addCase(fetchCalendarDayThunk.pending, (state) => {
      state.dayLoading = true;
      state.error = null;
    });
    builder.addCase(fetchCalendarDayThunk.fulfilled, (state, action) => {
      state.day = action.payload;
      state.dayLoading = false;
    });
    builder.addCase(fetchCalendarDayThunk.rejected, (state, action) => {
      state.dayLoading = false;
      state.error = action.payload as string;
    });

    builder.addCase(fetchCalendarUpcomingThunk.pending, (state) => {
      state.upcomingLoading = true;
    });
    builder.addCase(fetchCalendarUpcomingThunk.fulfilled, (state, action) => {
      state.upcoming = action.payload;
      state.upcomingLoading = false;
    });
    builder.addCase(fetchCalendarUpcomingThunk.rejected, (state) => {
      state.upcomingLoading = false;
    });
  },
});

export const { clearCalendarDay } = calendarSlice.actions;
export default calendarSlice.reducer;
