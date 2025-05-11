#!/usr/bin/env node

import chalk from 'chalk';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import readline from 'readline';

// Load environment variables
dotenv.config();

// Create readline interface for command line input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

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
 * Main function to create a new migration using Sequelize CLI
 */
async function createSequelizeMigration() {
  try {
    console.log(chalk.cyan('Creating a new Sequelize migration...'));

    // Ask for migration name
    rl.question(chalk.yellow('Enter migration name (e.g., "create-users-table"): '), async (migrationName) => {
      if (!migrationName) {
        console.log(chalk.red('Migration name is required.'));
        rl.close();
        process.exit(1);
      }

      try {
        // Format the name as kebab-case if not already
        const formattedName = migrationName
          .replace(/\s+/g, '-')
          .replace(/([A-Z])/g, '-$1')
          .toLowerCase()
          .replace(/^-/, '')
          .replace(/[-]+/g, '-');

        // Create the migration using Sequelize CLI
        await runSequelizeCLI(['migration:generate', '--name', formattedName]);

        console.log(chalk.green('✅ Migration file created successfully!'));
        console.log(chalk.cyan('Edit the migration file in src/db/migrations/'));
        console.log(chalk.cyan('Then run: npm run sequelize:migrate'));

        rl.close();
        process.exit(0);
      } catch (error) {
        console.error(chalk.red('Error creating migration:'), error);
        rl.close();
        process.exit(1);
      }
    });
  } catch (error) {
    console.error(chalk.red('Error creating migration:'), error);
    if (rl) rl.close();
    process.exit(1);
  }
}

// Run the creator
createSequelizeMigration();