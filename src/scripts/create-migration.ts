#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Get the migrations directory
const migrationsDir = path.join(__dirname, '../../migrations');

// Format a date for the migration name (YYYYMMDD_HHMMSS)
const getFormattedDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
};

// Get the next migration number
const getNextMigrationNum = (): string => {
  // Get all migration files
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql') && /^\d{5}/.test(file))
    .sort();

  if (files.length === 0) {
    return '00001';
  }

  // Get the highest migration number
  const lastFile = files[files.length - 1];
  const lastNum = parseInt(lastFile.substring(0, 5), 10);

  // Increment and pad with zeros
  return String(lastNum + 1).padStart(5, '0');
};

// Create a new migration file
const createMigration = (name: string, description: string): void => {
  // Create file name
  const timestamp = getFormattedDate();
  const migrationNum = getNextMigrationNum();
  const fileName = `${migrationNum}_${name}.sql`;
  const filePath = path.join(migrationsDir, fileName);

  // Create file content template
  const content = `-- Migration: ${description}
-- Created at: ${new Date().toISOString()}

-- Write your SQL migrations here

-- For example:
-- ALTER TABLE users ADD COLUMN new_column TEXT;

-- Track this migration
INSERT INTO migrations (name) VALUES ('${migrationNum}_${name}');
`;

  // Write file
  fs.writeFileSync(filePath, content);

  console.log(`Created migration file: ${fileName}`);
  console.log(`Path: ${filePath}`);
  console.log('');
  console.log('Run the migration with:');
  console.log('npm run migrate');
};

// Start the script
console.log('Create a new database migration');
console.log('==============================');
console.log('');

rl.question('Enter migration name (snake_case): ', (name) => {
  if (!name || !/^[a-z0-9_]+$/.test(name)) {
    console.error('Invalid name. Use snake_case (e.g., add_user_column)');
    rl.close();
    return;
  }

  rl.question('Enter brief description: ', (description) => {
    createMigration(name, description);
    rl.close();
  });
});