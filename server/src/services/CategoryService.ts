import { categoryRepository } from '../repositories/CategoryRepository.js';
import { ICategory } from '../types/index.js';
import { Types } from 'mongoose';

export class CategoryService {
  async getCategories(userId: string): Promise<ICategory[]> {
    return categoryRepository.findByUserId(userId);
  }

  async createCategory(
    userId: string,
    data: { name: string; type?: 'expense' | 'income' | 'both'; icon?: string; color?: string }
  ): Promise<ICategory> {
    const existing = await categoryRepository.findByName(userId, data.name);
    if (existing) {
      throw new Error(`Category "${data.name}" already exists`);
    }

    return categoryRepository.create({
      userId: new Types.ObjectId(userId),
      name: data.name.trim(),
      type: data.type || 'expense',
      icon: data.icon || 'Tag',
      color: data.color || '#64748b',
      isDefault: false,
    });
  }

  async updateCategory(
    id: string,
    userId: string,
    data: Partial<{ name: string; type: 'expense' | 'income' | 'both'; icon: string; color: string }>
  ): Promise<ICategory | null> {
    return categoryRepository.update(id, userId, data);
  }

  async deleteCategory(id: string, userId: string): Promise<boolean> {
    return categoryRepository.delete(id, userId);
  }
}

export const categoryService = new CategoryService();
