#!/usr/bin/env node

import chalk from 'chalk';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { sequelize } from '../config/database';

// Load environment variables
dotenv.config();

/**
 * Format a date to use in migration filename
 */
function formatDateForFilename(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('');
}

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
 * Load all models to ensure they're registered with Sequelize
 */
function loadAllModels() {
  const modelsDir = path.join(__dirname, '..', 'db', 'models');
  const modelFiles = fs.readdirSync(modelsDir)
    .filter(file => file.endsWith('.ts') && !file.startsWith('index'));

  console.log(chalk.cyan(`Loading ${modelFiles.length} models...`));

  for (const file of modelFiles) {
    try {
      require(path.join(modelsDir, file));
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not load model ${file}: ${error}`));
    }
  }
}

/**
 * Generate a migration from current model state
 */
async function generateModelMigration() {
  try {
    console.log(chalk.cyan('Generating migrations from Sequelize models...'));

    // Load all models
    loadAllModels();

    // Verify database connection
    await sequelize.authenticate();
    console.log(chalk.green('Successfully connected to database'));

    // Create a migration name with timestamp
    const timestamp = formatDateForFilename();
    const migrationName = `${timestamp}-model-sync`;

    // Generate migration from current state
    await runSequelizeCLI(['migration:generate', '--name', migrationName]);

    console.log(chalk.green('✅ Model migration generated successfully!'));
    console.log(chalk.yellow('Review the generated migration file before applying it.'));
    console.log(chalk.cyan('Run migrations with: npm run sequelize:migrate'));

    process.exit(0);
  } catch (error) {
    console.error(chalk.red('Error generating migration:'), error);
    process.exit(1);
  }
}

// Run the generator
generateModelMigration();