#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_KEY environment variables must be set.');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigrations() {
  try {
    console.log('Starting migrations...');

    // Check if migrations table exists (created in first migration)
    const { data: migrationCheck, error: checkError } = await supabase
      .from('migrations')
      .select('id')
      .limit(1);

    // If migrations table doesn't exist, we need to run the first migration
    const firstRun = checkError && checkError.code === 'PGRST116';

    // Get list of migrations from directory
    const migrationsDir = path.join(__dirname);
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ensure migrations run in order

    console.log(`Found ${migrationFiles.length} migration files`);

    // Get list of already applied migrations (if migrations table exists)
    let appliedMigrations = [];
    if (!firstRun) {
      const { data: migrations, error } = await supabase
        .from('migrations')
        .select('name')
        .order('applied_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to get applied migrations: ${error.message}`);
      }

      appliedMigrations = migrations.map(m => m.name);
      console.log(`Found ${appliedMigrations.length} previously applied migrations`);
    }

    // Find migrations that need to be applied
    const pendingMigrations = migrationFiles.filter(file => {
      const migrationName = path.basename(file, '.sql');
      return !appliedMigrations.includes(migrationName);
    });

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations to apply');
      return;
    }

    console.log(`Applying ${pendingMigrations.length} pending migrations...`);

    // Apply each pending migration
    for (const migrationFile of pendingMigrations) {
      const migrationName = path.basename(migrationFile, '.sql');
      const migrationPath = path.join(migrationsDir, migrationFile);
      const migrationSql = fs.readFileSync(migrationPath, 'utf8');

      console.log(`Running migration: ${migrationName}`);

      try {
        // Execute the SQL (using Supabase's rpc call for raw SQL)
        // Note: This requires a function that can execute SQL in your Supabase setup
        // You might need to create a supabase function called "run_sql" first
        const { error } = await supabase.rpc('run_sql', { sql: migrationSql });

        if (error) {
          throw new Error(`Migration ${migrationName} failed: ${error.message}`);
        }

        // If the migrations table exists (not first run) and not inserting in the migration itself
        if (!firstRun && !migrationSql.includes("INSERT INTO migrations (name) VALUES")) {
          // Record the migration as applied
          const { error: insertError } = await supabase
            .from('migrations')
            .insert({ name: migrationName });

          if (insertError) {
            throw new Error(`Failed to record migration ${migrationName}: ${insertError.message}`);
          }
        }

        console.log(`Migration ${migrationName} applied successfully`);
      } catch (error) {
        console.error(`Error applying migration ${migrationName}:`, error);
        process.exit(1);
      }
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

runMigrations();