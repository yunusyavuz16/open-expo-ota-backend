/**
 * Main database entry point
 * This file handles database initialization and provides access to models
 */
import dotenv from 'dotenv';
import { sequelize } from './models';
import supabase from '../config/supabase';
import logger from '../utils/logger';

// Load environment variables
dotenv.config();

// Check if we're using Supabase or direct Sequelize
const useSupabase = process.env.USE_SUPABASE === 'true';

/**
 * Initialize the database connection
 */
export const initDatabase = async (): Promise<void> => {
  try {
    if (useSupabase) {
      // Verify connection to Supabase
      const { data, error } = await supabase.from('migrations').select('count').limit(1);

      if (error) {
        // Check if it's just because the migrations table doesn't exist yet
        if (error.code === '42P01') { // PostgreSQL table doesn't exist
          logger.warn('Migrations table not found. Run migrations to create schema.');
        } else {
          logger.error('Unable to connect to Supabase:', error);
          throw error;
        }
      } else {
        logger.info('Supabase connection has been established successfully.');
      }
    } else {
      // Test Sequelize connection
      await sequelize.authenticate();
      logger.info('PostgreSQL connection has been established successfully.');

      // Sync models with database in development (if AUTO_SYNC is enabled)
      if (process.env.NODE_ENV === 'development' && process.env.AUTO_SYNC === 'true') {
        logger.warn('Auto-syncing database models (development only)');
        await sequelize.sync({ alter: true });
      }
    }
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    throw error;
  }
};

// Re-export models
export * from './models';

// Default export for backward compatibility
export default {
  initDatabase,
  sequelize,
  supabase,
  useSupabase
};