#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { sequelize } from '../db/models';
import { QueryTypes } from 'sequelize';
import chalk from 'chalk';

// Add chalk if it's not already in the dependencies
// npm install chalk

/**
 * Generate a migration file based on model differences
 */
async function generateMigration(): Promise<void> {
  try {
    console.log(chalk.cyan('Generating migration file from code-first models...'));

    // Create migration name from timestamp
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
    const migrationName = `${timestamp}_auto_migration`;

    // Path to migrations directory
    const migrationsDir = path.join(process.cwd(), 'migrations');

    // Ensure migrations directory exists
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
    }

    // Generate SQL for creating tables
    console.log(chalk.yellow('Syncing models with database to detect changes...'));

    // Use Sequelize's sync method to detect changes
    // This won't actually alter the database, just generate the SQL
    const syncOptions = {
      force: false,
      alter: true,
      hooks: false,
      logging: false
    };

    // Capture SQL statements by implementing custom queryInterface
    const originalQuery = sequelize.getQueryInterface().queryGenerator;
    const statements: string[] = [];

    // Mock the query execution to capture SQL
    const executeCapture = (sql: string, options: any) => {
      if (typeof sql === 'string' && !sql.startsWith('SELECT') && !sql.startsWith('SHOW')) {
        statements.push(sql);
      }
      return Promise.resolve([]);
    };

    // Replace query method temporarily
    const originalQueryMethod = sequelize.query.bind(sequelize);
    sequelize.query = executeCapture as any;

    // Run sync to generate SQL statements
    await sequelize.sync(syncOptions);

    // Restore original query method
    sequelize.query = originalQueryMethod;

    // Format statements for SQL file
    let migrationSQL = `-- Migration: ${migrationName}\n`;
    migrationSQL += `-- Generated at: ${new Date().toISOString()}\n\n`;

    // Add statements
    if (statements.length > 0) {
      migrationSQL += statements.join(';\n\n') + ';\n\n';
    } else {
      migrationSQL += '-- No changes detected in models\n\n';
    }

    // Add record of migration
    migrationSQL += `-- Record the migration
INSERT INTO migrations (name, applied_at) VALUES ('${migrationName}', NOW());`;

    // Write migration file
    const migrationPath = path.join(migrationsDir, `${migrationName}.sql`);
    fs.writeFileSync(migrationPath, migrationSQL);

    console.log(chalk.green(`Migration file generated: ${migrationPath}`));
    console.log(chalk.yellow('Review the migration file before applying it!'));

  } catch (error) {
    console.error(chalk.red('Error generating migration:'), error);
    process.exit(1);
  }
}

// Run the migration generator
generateMigration().catch(err => {
  console.error(chalk.red('Unhandled error:'), err);
  process.exit(1);
});