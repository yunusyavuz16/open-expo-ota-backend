/**
 * Simple script to run a specific migration
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import dotenv from 'dotenv';
import supabase from '../config/supabase';

// Load environment variables
dotenv.config();

async function runTestMigration() {
  try {
    console.log(chalk.cyan('Running test migration...'));

    // File to run
    const migrationFile = '003_create_example_table.sql';

    // Read migration SQL
    const migrationPath = path.join(__dirname, 'migrations', 'sql', migrationFile);
    if (!fs.existsSync(migrationPath)) {
      console.error(chalk.red(`Migration file not found: ${migrationPath}`));
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log(chalk.yellow('Migration SQL:'));
    console.log(chalk.gray(sql));

    // Execute the SQL
    console.log(chalk.cyan('Applying migration to database...'));
    const { error } = await supabase.rpc('run_migration', {
      sql_string: sql,
      migration_name: migrationFile
    });

    if (error) {
      console.error(chalk.red(`Error running migration:`), error);
      process.exit(1);
    }

    console.log(chalk.green(`✅ Migration ${migrationFile} completed successfully!`));

    // Verify the migration was recorded
    const { data, error: fetchError } = await supabase
      .from('migrations')
      .select('*')
      .eq('name', migrationFile);

    if (fetchError) {
      console.error(chalk.red('Error fetching migration record:'), fetchError);
    } else {
      console.log(chalk.green('Migration record:'), data);
    }

    process.exit(0);
  } catch (error) {
    console.error(chalk.red('Error running test migration:'), error);
    process.exit(1);
  }
}

runTestMigration();