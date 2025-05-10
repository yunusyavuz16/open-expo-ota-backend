-- Create the migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Functions for migrations
CREATE OR REPLACE FUNCTION create_migrations_table()
RETURNS void AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION run_migration(sql_string TEXT, migration_name TEXT)
RETURNS void AS $$
BEGIN
  -- Execute the SQL
  EXECUTE sql_string;

  -- Record the migration
  INSERT INTO migrations (name) VALUES (migration_name);
END;
$$ LANGUAGE plpgsql;

-- Create schema for app data
CREATE TYPE user_role AS ENUM ('admin', 'developer');
CREATE TYPE release_channel AS ENUM ('production', 'staging', 'development');
CREATE TYPE platform AS ENUM ('ios', 'android', 'web');

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  github_id INTEGER NOT NULL UNIQUE,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'developer',
  access_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create apps table
CREATE TABLE IF NOT EXISTS apps (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  github_repo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create app_users table for many-to-many relationship
CREATE TABLE IF NOT EXISTS app_users (
  id SERIAL PRIMARY KEY,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'developer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(app_id, user_id)
);

-- Create bundles table
CREATE TABLE IF NOT EXISTS bundles (
  id SERIAL PRIMARY KEY,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  hash TEXT NOT NULL UNIQUE,
  storage_type TEXT NOT NULL DEFAULT 'local',
  storage_path TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create manifests table
CREATE TABLE IF NOT EXISTS manifests (
  id SERIAL PRIMARY KEY,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  update_id INTEGER NOT NULL,
  version TEXT NOT NULL,
  channel release_channel NOT NULL DEFAULT 'development',
  runtime_version TEXT NOT NULL,
  platforms platform[] NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create updates table
CREATE TABLE IF NOT EXISTS updates (
  id SERIAL PRIMARY KEY,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  channel release_channel NOT NULL DEFAULT 'development',
  runtime_version TEXT NOT NULL,
  is_rollback BOOLEAN NOT NULL DEFAULT FALSE,
  bundle_id INTEGER NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  manifest_id INTEGER NOT NULL REFERENCES manifests(id) ON DELETE CASCADE,
  published_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(app_id, version, channel)
);

-- Create assets table
CREATE TABLE IF NOT EXISTS assets (
  id SERIAL PRIMARY KEY,
  update_id INTEGER NOT NULL REFERENCES updates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  storage_type TEXT NOT NULL DEFAULT 'local',
  storage_path TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key to manifests table after updates table is created
ALTER TABLE manifests
ADD CONSTRAINT manifests_update_id_fkey
FOREIGN KEY (update_id) REFERENCES updates(id) ON DELETE CASCADE;

-- Create Supabase RLS (Row Level Security) policies for tables
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- Policy for users - can only view/edit their own data
CREATE POLICY users_policy ON users
  USING (id = auth.uid() OR role = 'admin');

-- Policy for apps - users can view apps they have access to
CREATE POLICY apps_view_policy ON apps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app_users WHERE app_users.app_id = apps.id AND app_users.user_id = auth.uid()
    ) OR
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Policy for app_users - app owners and admins can manage users
CREATE POLICY app_users_policy ON app_users
  USING (
    EXISTS (
      SELECT 1 FROM apps WHERE apps.id = app_users.app_id AND apps.owner_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Policy for bundles - users who can access the app can view bundles
CREATE POLICY bundles_view_policy ON bundles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.app_id = bundles.app_id AND app_users.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM apps WHERE apps.id = bundles.app_id AND apps.owner_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Similar RLS policies for other tables, following the same pattern
-- Policy for manifests
CREATE POLICY manifests_view_policy ON manifests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.app_id = manifests.app_id AND app_users.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM apps WHERE apps.id = manifests.app_id AND apps.owner_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Policy for updates
CREATE POLICY updates_view_policy ON updates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.app_id = updates.app_id AND app_users.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM apps WHERE apps.id = updates.app_id AND apps.owner_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Policy for assets
CREATE POLICY assets_view_policy ON assets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM updates
      JOIN app_users ON updates.app_id = app_users.app_id
      WHERE updates.id = assets.update_id AND app_users.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM updates
      JOIN apps ON updates.app_id = apps.id
      WHERE updates.id = assets.update_id AND apps.owner_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Create indexes for better performance
CREATE INDEX ON app_users (app_id, user_id);
CREATE INDEX ON updates (app_id, channel);
CREATE INDEX ON updates (app_id, version, channel);
CREATE INDEX ON assets (update_id);
CREATE INDEX ON bundles (app_id);
CREATE INDEX ON manifests (app_id);
CREATE INDEX ON manifests (update_id);