/**
 * Temporary AppRepository placeholder for testing database connectivity
 * This will be properly implemented later
 */
import { db } from '../db/context';
import { App, User, AppUser } from '../models';
import { UserRole } from '../types';

// Basic app repository with minimal functionality
const AppRepository = {
  findById: async (id: number) => {
    return await db.apps.findById(id);
  },

  findBySlug: async (slug: string) => {
    return await db.apps.findBySlug(slug);
  },

  findByAppKey: async (appKey: string) => {
    return await App.findOne({ where: { appKey } });
  },

  findAll: async () => {
    return await App.findAll();
  },

  findByUserId: async (userId: number) => {
    return await db.apps.findByUserId(userId);
  },

  create: async (app: any) => {
    return await db.apps.create(app);
  },

  update: async (id: number, app: any) => {
    return await db.apps.update(id, app);
  },

  delete: async (id: number) => {
    return await db.apps.delete(id);
  },

  regenerateAppKey: async (id: number) => {
    const app = await App.findByPk(id);
    if (!app) return null;
    return await app.regenerateAppKey();
  },

  addUser: async (appId: number, userId: number, role: UserRole) => {
    return await AppUser.create({
      appId,
      userId,
      role
    });
  },

  removeUser: async (appId: number, userId: number) => {
    const appUser = await AppUser.findOne({
      where: { appId, userId }
    });

    if (!appUser) return false;
    await appUser.destroy();
    return true;
  },

  getUsers: async (appId: number) => {
    const appUsers = await AppUser.findAll({
      where: { appId },
      include: [{ model: User, as: 'user' }]
    });

    return appUsers.map(au => ({
      userId: au.get('user').id,
      role: au.get('role')
    }));
  }
};

export default AppRepository;