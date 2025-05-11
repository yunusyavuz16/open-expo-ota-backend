import dotenv from 'dotenv';
import chalk from 'chalk';
import { sequelize, User, App, AppUser, Bundle, Update, Manifest, Asset } from '../models';

// Load environment variables
dotenv.config();

/**
 * Database context for Sequelize
 * Handles database operations similar to Entity Framework Core
 * This is a transitional layer to help migrate from Supabase to direct Sequelize
 */
export class DatabaseContext {
  private initialized: boolean = false;
  public models: Record<string, any> = {};

  constructor() {
    // Models will be loaded dynamically
  }

  /**
   * Initialize the database connection and models
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log(chalk.cyan('Initializing database context...'));

    try {
      // Verify database connection
      await sequelize.authenticate();
      console.log(chalk.green('Database connection established successfully'));

      // Load models
      this.loadModels();

      this.initialized = true;
      console.log(chalk.green('Database context initialized successfully'));
    } catch (error) {
      console.error(chalk.red('Failed to initialize database context:'), error);
      throw error;
    }
  }

  /**
   * Load all models from the models directory
   */
  private loadModels(): void {
    try {
      this.models = {
        User,
        App,
        AppUser,
        Bundle,
        Update,
        Manifest,
        Asset
      };

      console.log(chalk.green(`Loaded ${Object.keys(this.models).length} models`));
    } catch (error) {
      console.error(chalk.red('Error loading models:'), error);
      console.log(chalk.yellow('Some models could not be loaded, but we will continue.'));
    }
  }

  // User repository methods
  public users = {
    findById: async (id: number) => {
      try {
        return await User.findByPk(id);
      } catch (error) {
        console.error('Error finding user by ID:', error);
        return null;
      }
    },

    findByGithubId: async (githubId: number) => {
      try {
        return await User.findOne({
          where: { githubId }
        });
      } catch (error) {
        console.error('Error finding user by GitHub ID:', error);
        return null;
      }
    },

    create: async (userData: any) => {
      try {
        return await User.create(userData);
      } catch (error) {
        console.error('Error creating user:', error);
        throw error;
      }
    },

    update: async (id: number, userData: any) => {
      try {
        const user = await User.findByPk(id);
        if (!user) return null;
        return await user.update(userData);
      } catch (error) {
        console.error('Error updating user:', error);
        return null;
      }
    }
  }

  // App repository methods
  public apps = {
    findById: async (id: number) => {
      try {
        return await App.findByPk(id);
      } catch (error) {
        console.error('Error finding app by ID:', error);
        return null;
      }
    },

    findBySlug: async (slug: string) => {
      try {
        return await App.findOne({
          where: { slug }
        });
      } catch (error) {
        console.error('Error finding app by slug:', error);
        return null;
      }
    },

    findByUserId: async (userId: number) => {
      try {
        const appUsers = await AppUser.findAll({
          where: { userId },
          include: [{
            model: App,
            as: 'app'
          }]
        });
        return appUsers.map(au => au.get('app'));
      } catch (error) {
        console.error('Error finding apps by user ID:', error);
        return [];
      }
    },

    create: async (appData: any) => {
      try {
        return await App.create(appData);
      } catch (error) {
        console.error('Error creating app:', error);
        throw error;
      }
    },

    update: async (id: number, appData: any) => {
      try {
        const app = await App.findByPk(id);
        if (!app) return null;
        return await app.update(appData);
      } catch (error) {
        console.error('Error updating app:', error);
        return null;
      }
    },

    delete: async (id: number) => {
      try {
        const app = await App.findByPk(id);
        if (!app) return false;
        await app.destroy();
        return true;
      } catch (error) {
        console.error('Error deleting app:', error);
        return false;
      }
    }
  }

  // Add other repository methods for remaining models as needed
}

// Export a singleton instance of the context
export const db = new DatabaseContext();
export default db;