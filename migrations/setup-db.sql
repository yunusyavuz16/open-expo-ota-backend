-- This function needs to be created with appropriate permissions in your Supabase database
-- It allows executing raw SQL through the Supabase client

-- Create a function that can execute raw SQL (will be used by the migration script)
CREATE OR REPLACE FUNCTION run_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- This means the function runs with the permissions of the creator
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- Grant execution privilege to the necessary roles
GRANT EXECUTE ON FUNCTION run_sql(text) TO service_role;
GRANT EXECUTE ON FUNCTION run_sql(text) TO authenticated;