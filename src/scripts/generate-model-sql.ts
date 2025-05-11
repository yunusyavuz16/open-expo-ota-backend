#!/usr/bin/env node

import { Sequelize, DataTypes } from 'sequelize';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Create a temporary Sequelize instance (in-memory SQLite) for generating SQL
const tempSequelize = new Sequelize('database', 'username', 'password', {
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false
});

// Create readline interface for command line input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Define Example model definition using the temporary Sequelize instance
 */
function defineExampleModel() {
  return tempSequelize.define('Example', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active'
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at'
    }
  }, {
    tableName: 'examples',
    timestamps: true,
    underscored: true
  });
}

/**
 * Generate PostgreSQL-compatible SQL for creating tables
 */
async function generateModelSQL(): Promise<string> {
  try {
    // Define models
    const Example = defineExampleModel();

    // Get all models
    const models = Object.values(tempSequelize.models);
    console.log(chalk.cyan(`Found ${models.length} models:`));
    console.log(models.map(m => m.name).join(', '));

    // Generate SQL manually for each model
    let sql = '-- Generated SQL migration from Sequelize models (offline mode)\n';
    sql += `-- Generated on: ${new Date().toISOString()}\n\n`;

    // Manual SQL for Example model
    sql += `-- Table: examples (from model: Example)\n`;
    sql += `CREATE TABLE IF NOT EXISTS examples (\n`;
    sql += `  id SERIAL PRIMARY KEY,\n`;
    sql += `  name TEXT NOT NULL,\n`;
    sql += `  description TEXT,\n`;
    sql += `  is_active BOOLEAN NOT NULL DEFAULT true,\n`;
    sql += `  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n`;
    sql += `  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n`;
    sql += `);\n\n`;

    // Add index for created_at
    sql += `-- Add index for efficient sorting by creation date\n`;
    sql += `CREATE INDEX IF NOT EXISTS examples_created_at_idx ON examples (created_at);\n\n`;

    // Add index for name column
    sql += `-- Add index for name lookups\n`;
    sql += `CREATE INDEX IF NOT EXISTS examples_name_idx ON examples (name);\n\n`;

    return sql;
  } catch (error) {
    console.error(chalk.red('Error generating SQL:'), error);
    throw error;
  }
}

/**
 * Save generated SQL to a migration file
 */
function saveSQLAsMigration(sql: string, migrationName: string): string {
  try {
    // Create migration directory if it doesn't exist
    const migrationsDir = path.join(__dirname, '..', 'db', 'migrations', 'sql');
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
    }

    // Get existing migrations to determine next file number
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    let nextNumber = 1;
    if (files.length > 0) {
      const lastFile = files[files.length - 1];
      const match = lastFile.match(/^(\d+)_/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    // Format number with leading zeros
    const numberStr = nextNumber.toString().padStart(3, '0');

    // Create filename
    const filename = `${numberStr}_${migrationName.replace(/\s+/g, '_').toLowerCase()}.sql`;
    const filePath = path.join(migrationsDir, filename);

    // Write SQL to file
    fs.writeFileSync(filePath, sql, 'utf8');

    return filePath;
  } catch (error) {
    console.error(chalk.red('Error saving SQL as migration:'), error);
    throw error;
  }
}

/**
 * Main function to generate SQL migration from models without database connection
 */
async function generateOfflineModelMigration() {
  try {
    console.log(chalk.cyan('Generating SQL migration from Sequelize models (offline mode)...'));

    // Generate SQL from models
    const sql = await generateModelSQL();
    console.log(chalk.gray('Generated SQL:'));
    console.log(chalk.gray(sql));

    // Ask for the migration name
    rl.question(chalk.yellow('Enter migration name: '), async (migrationName) => {
      if (!migrationName) {
        console.log(chalk.red('Migration name is required.'));
        rl.close();
        process.exit(1);
      }

      // Save SQL as migration file
      const filePath = saveSQLAsMigration(sql, migrationName);

      console.log(chalk.green(`✅ Model SQL migration has been saved to: ${path.relative(process.cwd(), filePath)}`));
      console.log(chalk.yellow('You can now review and edit the migration file before applying it.'));
      console.log(chalk.yellow('To apply the migration, run the SQL manually in Supabase SQL Editor.'));

      rl.close();
      process.exit(0);
    });
  } catch (error) {
    console.error(chalk.red('Error generating model migration:'), error);
    if (rl) rl.close();
    process.exit(1);
  }
}

// Run the generation script
generateOfflineModelMigration();