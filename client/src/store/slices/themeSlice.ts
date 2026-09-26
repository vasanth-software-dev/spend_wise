import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  isDark: boolean;
}

const getInitialMode = (): ThemeMode => {
  const saved = localStorage.getItem('spendwise_theme') as ThemeMode;
  if (saved && ['light', 'dark', 'system'].includes(saved)) {
    return saved;
  }
  return 'system';
};

const calculateIsDark = (mode: ThemeMode): boolean => {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const initialMode = getInitialMode();
const initialIsDark = calculateIsDark(initialMode);

// Apply class to html element immediately
if (typeof document !== 'undefined') {
  if (initialIsDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

const initialState: ThemeState = {
  mode: initialMode,
  isDark: initialIsDark,
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setThemeMode: (state, action: PayloadAction<ThemeMode>) => {
      const mode = action.payload;
      state.mode = mode;
      state.isDark = calculateIsDark(mode);
      localStorage.setItem('spendwise_theme', mode);

      if (state.isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    },
    toggleTheme: (state) => {
      const nextMode = state.isDark ? 'light' : 'dark';
      state.mode = nextMode;
      state.isDark = !state.isDark;
      localStorage.setItem('spendwise_theme', nextMode);

      if (state.isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    },
  },
});

export const { setThemeMode, toggleTheme } = themeSlice.actions;
export default themeSlice.reducer;
