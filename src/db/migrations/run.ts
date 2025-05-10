import fs from 'fs';
import path from 'path';
import supabase from '../../config/supabase';

// Define the migration record interface
interface MigrationRecord {
  name: string;
  executed_at?: string;
}

/**
 * Simple migration script for Supabase
 * Reads SQL files from migrations folder and executes them in order
 */
async function runMigrations() {
  console.log('Running migrations...');

  // Get all migration files
  const migrationsDir = path.join(__dirname, 'sql');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Sort to ensure consistent order

  // Get previously executed migrations
  const { data: executedMigrations, error: fetchError } = await supabase
    .from('migrations')
    .select('name');

  if (fetchError) {
    // If table doesn't exist, create it
    if (fetchError.code === '42P01') { // PGRST016 is returned when table doesn't exist
      console.log('Creating migrations table...');
      await supabase.rpc('create_migrations_table');
    } else {
      console.error('Error fetching migrations:', fetchError);
      process.exit(1);
    }
  }

  const executedMigrationNames = executedMigrations
    ? executedMigrations.map((m: MigrationRecord) => m.name)
    : [];

  // Filter out already executed migrations
  const pendingMigrations = migrationFiles.filter(
    file => !executedMigrationNames.includes(file)
  );

  if (pendingMigrations.length === 0) {
    console.log('No pending migrations.');
    return;
  }

  console.log(`Found ${pendingMigrations.length} migrations to run.`);

  // Run each migration
  for (const migrationFile of pendingMigrations) {
    console.log(`Running migration: ${migrationFile}`);

    // Read migration SQL
    const migrationPath = path.join(migrationsDir, migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute the SQL
    const { error } = await supabase.rpc('run_migration', {
      sql_string: sql,
      migration_name: migrationFile
    });

    if (error) {
      console.error(`Error running migration ${migrationFile}:`, error);
      process.exit(1);
    }

    console.log(`Migration ${migrationFile} completed successfully.`);
  }

  console.log('All migrations completed successfully.');
}

// Run migrations
runMigrations()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });