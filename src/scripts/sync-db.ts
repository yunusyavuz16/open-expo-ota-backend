#!/usr/bin/env node

import chalk from 'chalk';
import dotenv from 'dotenv';
import { sequelize } from '../config/database';
import { generateModelSQL, runSQL } from '../db/sequelize-supabase-sync';

// Load environment variables
dotenv.config();

// Check if we're using Supabase
const useSupabase = process.env.USE_SUPABASE === 'true';

/**
 * Sync database with current models
 * CAUTION: This is for development use only!
 */
async function syncDatabase() {
  try {
    console.log(chalk.cyan('Synchronizing database with models...'));
    console.log(chalk.yellow('CAUTION: This operation may modify your database structure!'));

    if (process.env.NODE_ENV === 'production') {
      console.error(chalk.red('❌ This script should not be used in production!'));
      console.log(chalk.red('Use proper migrations instead.'));
      process.exit(1);
    }

    if (useSupabase) {
      // For Supabase, we generate SQL and run it
      console.log(chalk.cyan('Syncing with Supabase...'));

      // Generate SQL from models
      const sql = await generateModelSQL();
      console.log(chalk.gray('Generated SQL:'));
      console.log(chalk.gray(sql));

      // Run the SQL
      await runSQL(sql);

      console.log(chalk.green('✅ Database synchronized with models!'));
    } else {
      // For direct PostgreSQL, we use Sequelize sync
      console.log(chalk.cyan('Syncing with PostgreSQL...'));

      await sequelize.sync({ alter: true });

      console.log(chalk.green('✅ Database synchronized with models!'));
    }

    process.exit(0);
  } catch (error) {
    console.error(chalk.red('Error synchronizing database:'), error);
    process.exit(1);
  }
}

syncDatabase();