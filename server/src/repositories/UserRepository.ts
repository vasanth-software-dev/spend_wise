import { UserModel } from '../models/User.js';
import { IUser } from '../types/index.js';

export class UserRepository {
  async findById(id: string): Promise<IUser | null> {
    return UserModel.findById(id).lean();
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return UserModel.findOne({ email: email.toLowerCase() }).lean();
  }

  async findByGoogleId(googleId: string): Promise<IUser | null> {
    return UserModel.findOne({ googleId }).lean();
  }

  async create(userData: Partial<IUser>): Promise<IUser> {
    const user = new UserModel(userData);
    return (await user.save()).toObject();
  }

  async update(id: string, updateData: Partial<IUser>): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(id, { $set: updateData }, { new: true }).lean();
  }

  async delete(id: string): Promise<boolean> {
    const result = await UserModel.findByIdAndDelete(id);
    return !!result;
  }
}

export const userRepository = new UserRepository();
