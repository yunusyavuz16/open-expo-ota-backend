#!/usr/bin/env node

import { sequelize } from '../db/models';
import chalk from 'chalk';

/**
 * This script synchronizes the database with the model definitions.
 * CAUTION: This will alter tables to match the models, which could result in data loss.
 * It's recommended to use migrations in production environments.
 */
async function syncDatabase() {
  try {
    console.log(chalk.cyan('Starting database synchronization...'));
    console.log(chalk.yellow('⚠️  WARNING: This will alter database tables to match models'));
    console.log(chalk.yellow('⚠️  Make sure you have a backup of your data'));

    // Wait for user input in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      console.log(chalk.yellow('Press Ctrl+C to cancel or wait 5 seconds to continue...'));
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log(chalk.cyan('Syncing database schema...'));

    // Alter tables to match the models
    await sequelize.sync({ alter: true });

    console.log(chalk.green('✅ Database successfully synchronized!'));
    process.exit(0);
  } catch (error) {
    console.error(chalk.red('Error synchronizing database:'), error);
    process.exit(1);
  }
}

// Run the sync function
syncDatabase();