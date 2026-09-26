import { CategoryModel } from '../models/Category.js';
import { ICategory } from '../types/index.js';
import { Types } from 'mongoose';

export const DEFAULT_SYSTEM_CATEGORIES: Array<{
  name: string;
  type: 'expense' | 'income' | 'both';
  icon: string;
  color: string;
}> = [
  { name: 'Food & Dining', type: 'expense', icon: 'Utensils', color: '#f97316' },
  { name: 'Groceries', type: 'expense', icon: 'ShoppingBag', color: '#10b981' },
  { name: 'Shopping', type: 'expense', icon: 'ShoppingCart', color: '#ec4899' },
  { name: 'Transport', type: 'expense', icon: 'Car', color: '#3b82f6' },
  { name: 'Fuel', type: 'expense', icon: 'Fuel', color: '#ef4444' },
  { name: 'Bills & Utilities', type: 'expense', icon: 'Zap', color: '#eab308' },
  { name: 'Rent', type: 'expense', icon: 'Home', color: '#8b5cf6' },
  { name: 'Entertainment', type: 'expense', icon: 'Film', color: '#a855f7' },
  { name: 'Health & Medical', type: 'expense', icon: 'HeartPulse', color: '#14b8a6' },
  { name: 'Education', type: 'expense', icon: 'GraduationCap', color: '#6366f1' },
  { name: 'Travel', type: 'expense', icon: 'Plane', color: '#06b6d4' },
  { name: 'Subscriptions', type: 'expense', icon: 'CreditCard', color: '#f43f5e' },
  { name: 'Salary', type: 'income', icon: 'Briefcase', color: '#22c55e' },
  { name: 'Investments', type: 'income', icon: 'TrendingUp', color: '#0284c7' },
  { name: 'Other', type: 'both', icon: 'MoreHorizontal', color: '#64748b' },
];

export class CategoryRepository {
  async ensureDefaultCategories(): Promise<void> {
    for (const cat of DEFAULT_SYSTEM_CATEGORIES) {
      await CategoryModel.findOneAndUpdate(
        { userId: null, name: cat.name },
        { ...cat, isDefault: true, userId: null },
        { upsert: true, new: true }
      );
    }
  }

  async findByUserId(userId: string): Promise<ICategory[]> {
    return CategoryModel.find({
      $or: [{ userId: null }, { userId: new Types.ObjectId(userId) }],
    })
      .sort({ isDefault: -1, name: 1 })
      .lean();
  }

  async findById(id: string): Promise<ICategory | null> {
    return CategoryModel.findById(id).lean();
  }

  async findByName(userId: string, name: string): Promise<ICategory | null> {
    return CategoryModel.findOne({
      $or: [
        { userId: null, name: { $regex: new RegExp(`^${name}$`, 'i') } },
        { userId: new Types.ObjectId(userId), name: { $regex: new RegExp(`^${name}$`, 'i') } },
      ],
    }).lean();
  }

  async create(data: Partial<ICategory>): Promise<ICategory> {
    const category = new CategoryModel(data);
    return (await category.save()).toObject();
  }

  async update(id: string, userId: string, updateData: Partial<ICategory>): Promise<ICategory | null> {
    // Only allow updating user's custom categories
    return CategoryModel.findOneAndUpdate(
      { _id: id, userId: new Types.ObjectId(userId), isDefault: false },
      { $set: updateData },
      { new: true }
    ).lean();
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await CategoryModel.findOneAndDelete({
      _id: id,
      userId: new Types.ObjectId(userId),
      isDefault: false,
    });
    return !!res;
  }
}

export const categoryRepository = new CategoryRepository();
