import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { api, setAccessToken } from '../../services/api.js';
import {
  authenticateWithPasskey,
  BiometricError,
  describeBiometricError,
} from '../../services/webauthn.js';
import { User } from '../../types/index.js';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  loading: boolean;
  /** True while the native biometric/passkey prompt is on screen. */
  biometricLoading: boolean;
  /** Set when a biometric attempt failed; never set for a plain cancellation. */
  biometricError: string | null;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isInitializing: true,
  loading: false,
  biometricLoading: false,
  biometricError: null,
  error: null,
};

export const checkAuthThunk = createAsyncThunk('auth/checkAuth', async (_, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/refresh');
    const { user, accessToken } = res.data.data;
    setAccessToken(accessToken);
    return user;
  } catch (err: any) {
    setAccessToken(null);
    return rejectWithValue(err.response?.data?.message || 'Not authenticated');
  }
});

export const loginThunk = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const res = await api.post('/auth/login', credentials);
      const { user, accessToken } = res.data.data;
      setAccessToken(accessToken);
      return user;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Login failed');
    }
  }
);

export const registerThunk = createAsyncThunk(
  'auth/register',
  async (data: { name: string; email: string; password: string; currency?: string }, { rejectWithValue }) => {
    try {
      const res = await api.post('/auth/register', data);
      const { user, accessToken } = res.data.data;
      setAccessToken(accessToken);
      return user;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Registration failed');
    }
  }
);

export const googleDevLoginThunk = createAsyncThunk(
  'auth/googleDevLogin',
  async (data: { email?: string; name?: string } | undefined, { rejectWithValue }) => {
    try {
      const res = await api.post('/auth/google/dev-login', data || {});
      const { user, accessToken } = res.data.data;
      setAccessToken(accessToken);
      return user;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Google sign-in failed');
    }
  }
);

/**
 * Signs in with a device passkey / biometric unlock.
 *
 * The server issues the SAME access token (15m) and HttpOnly refresh cookie
 * (7d) as Google Login, so the existing session and silent-refresh flow is
 * reused unchanged. Dismissing the native prompt is treated as a no-op, not an
 * error state.
 */
export const biometricLoginThunk = createAsyncThunk(
  'auth/biometricLogin',
  async (_, { rejectWithValue }) => {
    try {
      const { accessToken, user } = await authenticateWithPasskey();
      setAccessToken(accessToken);
      return user as User;
    } catch (err) {
      return rejectWithValue({
        message: describeBiometricError(err),
        code: err instanceof BiometricError ? err.code : 'WEBAUTHN_UNKNOWN',
        // A cancelled prompt must not render an error banner.
        cancelled: err instanceof BiometricError && err.cancelled,
      });
    }
  }
);

export const logoutThunk = createAsyncThunk('auth/logout', async () => {
  try {
    await api.post('/auth/logout');
  } finally {
    setAccessToken(null);
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthError: (state) => {
      state.error = null;
    },
    clearBiometricError: (state) => {
      state.biometricError = null;
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
  },
  extraReducers: (builder) => {
    // Check Auth
    builder.addCase(checkAuthThunk.pending, (state) => {
      state.isInitializing = true;
    });
    builder.addCase(checkAuthThunk.fulfilled, (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.isInitializing = false;
    });
    builder.addCase(checkAuthThunk.rejected, (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.isInitializing = false;
    });

    // Login
    builder.addCase(loginThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(loginThunk.fulfilled, (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.loading = false;
    });
    builder.addCase(loginThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // Register
    builder.addCase(registerThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(registerThunk.fulfilled, (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.loading = false;
    });
    builder.addCase(registerThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // Google Dev Login
    builder.addCase(googleDevLoginThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(googleDevLoginThunk.fulfilled, (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.loading = false;
    });
    builder.addCase(googleDevLoginThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // Biometric / Passkey login
    builder.addCase(biometricLoginThunk.pending, (state) => {
      state.biometricLoading = true;
      state.biometricError = null;
    });
    builder.addCase(biometricLoginThunk.fulfilled, (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.biometricLoading = false;
      state.biometricError = null;
    });
    builder.addCase(biometricLoginThunk.rejected, (state, action) => {
      state.biometricLoading = false;
      // Keep the login page usable: a dismissed prompt is silent.
      const payload = action.payload as { message?: string; cancelled?: boolean } | undefined;
      state.biometricError = payload?.cancelled ? null : (payload?.message ?? 'Biometric sign-in failed');
    });

    // Logout
    builder.addCase(logoutThunk.fulfilled, (state) => {
      state.user = null;
      state.isAuthenticated = false;
    });
  },
});

export const { clearAuthError, clearBiometricError, setUser } = authSlice.actions;
export default authSlice.reducer;
