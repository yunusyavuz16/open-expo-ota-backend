#!/usr/bin/env node

import chalk from 'chalk';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';

// Load environment variables
dotenv.config();

/**
 * Runs the Sequelize CLI command with the provided arguments
 */
function runSequelizeCLI(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(chalk.cyan(`Running sequelize ${args.join(' ')}...`));

    const sequelizeCli = spawn('npx', ['sequelize-cli', ...args], {
      stdio: 'inherit',
      shell: true
    });

    sequelizeCli.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`sequelize-cli exited with code ${code}`));
      }
    });
  });
}

/**
 * Main function to run migrations using Sequelize CLI
 */
async function migrateWithSequelize() {
  try {
    console.log(chalk.cyan('Running database migrations...'));

    // Run the migrations
    await runSequelizeCLI(['db:migrate']);

    console.log(chalk.green('✅ Migrations completed successfully!'));
    process.exit(0);
  } catch (error) {
    console.error(chalk.red('Error running migrations:'), error);
    process.exit(1);
  }
}

// Run the migration
migrateWithSequelize();