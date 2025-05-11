/**
 * Main database entry point
 * This file handles database initialization and provides access to models
 */
import { sequelize, setupAssociations } from '../models';
import logger from '../utils/logger';

/**
 * Initialize the database connection
 */
export const initDatabase = async (): Promise<void> => {
  try {
    // Test Sequelize connection
    await sequelize.authenticate();
    logger.info('PostgreSQL connection has been established successfully.');

    // Set up model associations
    setupAssociations();

    // Sync models with database in development (if AUTO_SYNC is enabled)
    if (process.env.NODE_ENV === 'development' && process.env.AUTO_SYNC === 'true') {
      logger.warn('Auto-syncing database models (development only)');
      await sequelize.sync({ alter: true });
    }
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    throw error;
  }
};

// Re-export models
export * from '../models';

// Default export for backward compatibility
export default {
  initDatabase,
  sequelize
};