# Database Migrations

This directory contains SQL migration files to set up and maintain the database schema for OpenExpoOTA.

## Requirements

- Supabase project with database access
- Node.js environment with access to the Supabase API

## Setting Up the Database

1. Create a Supabase project if you haven't already.

2. Configure your `.env` file with the following variables:
   ```
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_KEY=your_supabase_service_role_key
   ```

3. Run the SQL function setup script manually in the Supabase SQL editor:
   - Copy the contents of `setup-db.sql`
   - Paste and execute in the Supabase SQL Editor

4. Run the migration script:
   ```bash
   node run-migrations.js
   ```

## Creating New Migrations

1. Create a new SQL file with a numeric prefix for ordering:
   ```
   00002_add_new_table.sql
   ```

2. Write your SQL statements in the file.

3. Run the migration script to apply the changes:
   ```bash
   node run-migrations.js
   ```

The migration runner will track which migrations have been applied and only run new ones.

## Tables Structure

The database includes the following tables:

- `users`: Store user information and GitHub credentials
- `apps`: Store application information
- `app_users`: Manage user access to apps
- `bundles`: Store JavaScript bundles
- `updates`: Track update releases
- `manifests`: Store update manifests
- `assets`: Track update assets
- `migrations`: Track applied migrations

## Troubleshooting

- If you get permission errors when running migrations, make sure your Supabase key has the right permissions.
- If you need to recreate the schema, you can drop all tables and rerun the migrations.