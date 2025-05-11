/**
 * Temporary UserRepository placeholder for testing database connectivity
 * This will be properly implemented later
 */
import { db } from '../db/context';
import { User } from '../models';

// Basic user repository with minimal functionality
const UserRepository = {
  findById: async (id: number) => {
    return await db.users.findById(id);
  },

  findByGithubId: async (githubId: number) => {
    return await db.users.findByGithubId(githubId);
  },

  create: async (userData: any) => {
    return await db.users.create(userData);
  },

  update: async (id: number, userData: any) => {
    return await db.users.update(id, userData);
  },

  delete: async (id: number) => {
    const user = await User.findByPk(id);
    if (!user) return false;
    await user.destroy();
    return true;
  }
};

export default UserRepository;