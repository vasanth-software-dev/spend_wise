import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';
import { NotificationItem } from '../../types/index.js';

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
};

export const fetchNotificationsThunk = createAsyncThunk('notifications/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/notifications');
    return res.data.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Failed to load notifications');
  }
});

export const markReadThunk = createAsyncThunk(
  'notifications/markRead',
  async (id: string, { dispatch, rejectWithValue }) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      dispatch(fetchNotificationsThunk());
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to mark read');
    }
  }
);

export const markAllReadThunk = createAsyncThunk(
  'notifications/markAllRead',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      await api.post('/notifications/read-all');
      dispatch(fetchNotificationsThunk());
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to mark all read');
    }
  }
);

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchNotificationsThunk.fulfilled, (state, action) => {
      state.notifications = action.payload.notifications;
      state.unreadCount = action.payload.unreadCount;
      state.loading = false;
    });
  },
});

export default notificationSlice.reducer;
