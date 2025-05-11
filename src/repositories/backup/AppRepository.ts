import supabase from '../config/supabase';
import { UserRole } from '../types';
import App, { AppAttributes, AppInput, AppRow, mapToApp } from '../models/App';
import { useSupabase } from '../config/database';

export class AppRepository {
  /**
   * Find an app by ID
   */
  async findById(id: number): Promise<AppAttributes | null> {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('apps')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return null;
      }

      return mapToApp(data);
    } else {
      // Using Sequelize
      const app = await App.findByPk(id);
      return app?.toJSON() as AppAttributes | null;
    }
  }

  /**
   * Find an app by slug
   */
  async findBySlug(slug: string): Promise<AppAttributes | null> {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('apps')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error || !data) {
        return null;
      }

      return mapToApp(data);
    } else {
      // Using Sequelize
      const app = await App.findOne({ where: { slug } });
      return app?.toJSON() as AppAttributes | null;
    }
  }

  /**
   * Find an app by app key
   */
  async findByAppKey(appKey: string): Promise<AppAttributes | null> {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('apps')
        .select('*')
        .eq('app_key', appKey)
        .single();

      if (error || !data) {
        return null;
      }

      return mapToApp(data);
    } else {
      // Using Sequelize
      const app = await App.findOne({ where: { appKey } });
      return app?.toJSON() as AppAttributes | null;
    }
  }

  /**
   * Get all apps
   */
  async findAll(): Promise<AppAttributes[]> {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('apps')
        .select('*');

      if (error || !data) {
        return [];
      }

      return data.map((app: AppRow) => mapToApp(app));
    } else {
      // Using Sequelize
      const apps = await App.findAll();
      return apps.map(app => app.toJSON() as AppAttributes);
    }
  }

  /**
   * Get all apps accessible by a user
   */
  async findByUserId(userId: number): Promise<AppAttributes[]> {
    if (useSupabase) {
      // Get apps where user is an admin or explicitly has access
      const { data, error } = await supabase
        .from('apps')
        .select('*, app_users!inner(*)')
        .or(`owner_id.eq.${userId},app_users.user_id.eq.${userId}`);

      if (error || !data) {
        return [];
      }

      return data.map((app: AppRow) => mapToApp(app));
    } else {
      // Using Sequelize - this would require proper associations setup
      // This is just a simplified example
      const apps = await App.findAll({
        where: {
          ownerId: userId
        }
      });

      // For a complete solution, we would need to query app_users table as well
      // and merge the results

      return apps.map(app => app.toJSON() as AppAttributes);
    }
  }

  /**
   * Create a new app
   */
  async create(app: AppInput): Promise<AppAttributes> {
    const appKey = app.appKey || App.generateAppKey();

    if (useSupabase) {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('apps')
        .insert({
          name: app.name,
          slug: app.slug,
          description: app.description,
          owner_id: app.ownerId,
          github_repo_url: app.githubRepoUrl,
          app_key: appKey,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (error || !data) {
        throw new Error(`Error creating app: ${error?.message}`);
      }

      return mapToApp(data);
    } else {
      // Using Sequelize
      const createdApp = await App.create({
        ...app,
        appKey
      });

      return createdApp.toJSON() as AppAttributes;
    }
  }

  /**
   * Update an app
   */
  async update(id: number, app: Partial<AppInput>): Promise<AppAttributes> {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('apps')
        .update({
          name: app.name,
          description: app.description,
          github_repo_url: app.githubRepoUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        throw new Error(`Error updating app: ${error?.message}`);
      }

      return mapToApp(data);
    } else {
      // Using Sequelize
      const existingApp = await App.findByPk(id);

      if (!existingApp) {
        throw new Error(`App with id ${id} not found`);
      }

      await existingApp.update(app);
      return existingApp.toJSON() as AppAttributes;
    }
  }

  /**
   * Regenerate app key
   */
  async regenerateAppKey(id: number): Promise<string> {
    const newKey = App.generateAppKey();

    if (useSupabase) {
      const { data, error } = await supabase
        .from('apps')
        .update({
          app_key: newKey,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        throw new Error(`Error regenerating app key: ${error?.message}`);
      }

      return newKey;
    } else {
      // Using Sequelize
      const app = await App.findByPk(id);

      if (!app) {
        throw new Error(`App with id ${id} not found`);
      }

      return await app.regenerateAppKey();
    }
  }

  /**
   * Delete an app
   */
  async delete(id: number): Promise<void> {
    if (useSupabase) {
      const { error } = await supabase
        .from('apps')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Error deleting app: ${error.message}`);
      }
    } else {
      // Using Sequelize
      const app = await App.findByPk(id);

      if (!app) {
        throw new Error(`App with id ${id} not found`);
      }

      await app.destroy();
    }
  }

  /**
   * Add a user to an app
   */
  async addUser(appId: number, userId: number, role: UserRole = UserRole.DEVELOPER): Promise<void> {
    if (useSupabase) {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('app_users')
        .upsert({
          app_id: appId,
          user_id: userId,
          role,
          created_at: now,
          updated_at: now
        });

      if (error) {
        throw new Error(`Error adding user to app: ${error.message}`);
      }
    } else {
      // Using Sequelize - we would need a proper AppUser model
      // This is just a placeholder for how it might work
      throw new Error("Adding users via Sequelize not implemented");
    }
  }

  /**
   * Remove a user from an app
   */
  async removeUser(appId: number, userId: number): Promise<void> {
    if (useSupabase) {
      const { error } = await supabase
        .from('app_users')
        .delete()
        .eq('app_id', appId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Error removing user from app: ${error.message}`);
      }
    } else {
      // Using Sequelize - we would need a proper AppUser model
      // This is just a placeholder for how it might work
      throw new Error("Removing users via Sequelize not implemented");
    }
  }

  /**
   * Get users associated with an app
   */
  async getUsers(appId: number): Promise<{ userId: number; role: UserRole }[]> {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('app_users')
        .select('user_id, role')
        .eq('app_id', appId);

      if (error || !data) {
        return [];
      }

      return data.map((user) => ({
        userId: user.user_id,
        role: user.role
      }));
    } else {
      // Using Sequelize - we would need a proper AppUser model
      // This is just a placeholder for how it might work
      return [];
    }
  }
}

export default new AppRepository();