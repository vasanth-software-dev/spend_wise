import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';
import { Category } from '../../types/index.js';

interface CategoryState {
  categories: Category[];
  loading: boolean;
  error: string | null;
}

const initialState: CategoryState = {
  categories: [],
  loading: false,
  error: null,
};

export const fetchCategoriesThunk = createAsyncThunk('categories/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/categories');
    return res.data.data.categories;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch categories');
  }
});

export const createCategoryThunk = createAsyncThunk(
  'categories/create',
  async (categoryData: any, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post('/categories', categoryData);
      dispatch(fetchCategoriesThunk());
      return res.data.data.category;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create category');
    }
  }
);

const categorySlice = createSlice({
  name: 'categories',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchCategoriesThunk.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(fetchCategoriesThunk.fulfilled, (state, action) => {
      state.categories = action.payload;
      state.loading = false;
    });
    builder.addCase(fetchCategoriesThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });
  },
});

export default categorySlice.reducer;
